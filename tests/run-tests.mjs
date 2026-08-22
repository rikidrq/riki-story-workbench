import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rikiHash,
  rikiMergeEditableEntry,
  rikiCreatePatch,
  rikiApplyPatchToEntries,
  rikiCreateUndoPatch,
  rikiParseSuggestedPatch,
  rikiCreateMockAdapter,
  rikiCreateRuntime,
} from '../src/riki-workbench.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function entry(overrides = {}) {
  return {
    uid: 7,
    name: '旧标题',
    enabled: true,
    strategy: { type: 'selective', keys: ['旧词'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: { type: 'at_depth', role: 'system', depth: 2, order: 100 },
    content: '旧正文',
    probability: 100,
    extra: { owner: 'user', untouched: true },
    ...overrides,
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

await test('hash ignores object key order', () => {
  assert.equal(rikiHash({ b: 2, a: 1 }), rikiHash({ a: 1, b: 2 }));
});

await test('editable merge preserves unknown fields and stable uid', () => {
  const merged = rikiMergeEditableEntry(entry(), { content: '新正文', strategy: { keys: '新词，另一个词' } });
  assert.equal(merged.uid, 7);
  assert.equal(merged.extra.owner, 'user');
  assert.equal(merged.content, '新正文');
  assert.deepEqual(merged.strategy.keys, ['新词', '另一个词']);
});

await test('editable merge normalizes untrusted enum and numeric values', () => {
  const merged = rikiMergeEditableEntry(entry(), {
    strategy: { type: 'invented-strategy' },
    position: { type: 'invented-position', role: 'developer', depth: 'not-a-number' },
    probability: 999,
  });
  assert.equal(merged.strategy.type, 'selective');
  assert.equal(merged.position.type, 'after_character_definition');
  assert.equal(merged.position.role, 'system');
  assert.equal(merged.position.depth, 4);
  assert.equal(merged.probability, 100);
});

await test('worldbook regex keys preserve RegExp semantics and hash identity', () => {
  const before = entry({ strategy: { type: 'selective', keys: [/雾港/iu], keys_secondary: { logic: 'and_any', keys: [/灯塔/u] }, scan_depth: 'same_as_global' } });
  const merged = rikiMergeEditableEntry(before, { content: '只改正文' });
  assert.equal(merged.strategy.keys[0] instanceof RegExp, true);
  assert.equal(merged.strategy.keys[0].source, '雾港');
  assert.equal(merged.strategy.keys[0].flags.includes('i'), true);
  assert.notEqual(rikiHash(/雾港/u), rikiHash(/灯塔/u));
});

await test('patch applies only to matching current entry', () => {
  const before = entry();
  const after = rikiMergeEditableEntry(before, { content: '新正文' });
  const patch = rikiCreatePatch({ bookName: '测试书', before, after });
  const result = rikiApplyPatchToEntries([before], patch);
  assert.equal(result[0].content, '新正文');
  assert.equal(result[0].extra.untouched, true);
});

await test('stale patch is rejected', () => {
  const before = entry();
  const patch = rikiCreatePatch({ bookName: '测试书', before, after: { content: '计划正文' } });
  assert.throws(() => rikiApplyPatchToEntries([entry({ content: '外部已修改' })], patch), error => error.code === 'STALE_WRITE');
});

await test('undo patch restores prior entry and guards current value', () => {
  const before = entry();
  const patch = rikiCreatePatch({ bookName: '测试书', before, after: { content: '新正文' } });
  const written = rikiApplyPatchToEntries([before], patch)[0];
  const undo = rikiCreateUndoPatch({ bookName: '测试书', entryUid: 7, before, after: written });
  const restored = rikiApplyPatchToEntries([written], undo)[0];
  assert.equal(restored.content, '旧正文');
});

await test('model patch parser accepts bounded proposal block', () => {
  const parsed = rikiParseSuggestedPatch('建议如下。\n<riki_worldbook_patch>{"bookName":"测试书","entryUid":7,"reason":"补足因果","changes":{"content":"新正文"}}</riki_worldbook_patch>');
  assert.equal(parsed.bookName, '测试书');
  assert.equal(parsed.entryUid, 7);
  assert.equal(parsed.changes.content, '新正文');
  assert.equal(rikiParseSuggestedPatch('没有提案'), null);
});

await test('runtime closes read preview apply reread and undo loop', async () => {
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] }, bindings: { character: ['测试书'] } });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  await runtime.refreshInventory();
  runtime.state.draft.content = '运行时新正文';
  const patch = runtime.previewDraft();
  await runtime.applyPatch(patch, patch.patchId);
  assert.equal((await adapter.getWorldbook('测试书'))[0].content, '运行时新正文');
  assert.equal(runtime.state.history.length, 1);
  await runtime.undoLast(true);
  assert.equal((await adapter.getWorldbook('测试书'))[0].content, '旧正文');
  assert.equal(runtime.state.history.length, 0);
});

await test('runtime rejects a patch that was not produced by the current preview', async () => {
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] } });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  await runtime.refreshInventory();
  const forged = rikiCreatePatch({ bookName: '测试书', before: entry(), after: { content: '绕过预览' } });
  await assert.rejects(() => runtime.applyPatch(forged, forged.patchId), error => error.code === 'CONFIRMATION_REQUIRED');
});

await test('runtime serializes concurrent writes from the same workbench', async () => {
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] } });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  await runtime.refreshInventory();
  runtime.state.draft.content = '并发目标';
  const patch = runtime.previewDraft();
  const results = await Promise.allSettled([
    runtime.applyPatch(patch, patch.patchId),
    runtime.applyPatch(patch, patch.patchId),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal((await adapter.getWorldbook('测试书'))[0].content, '并发目标');
});

await test('undo keeps history when host return does not match restore target', async () => {
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] } });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  await runtime.refreshInventory();
  runtime.state.draft.content = '运行时新正文';
  const patch = runtime.previewDraft();
  await runtime.applyPatch(patch, patch.patchId);
  const originalUpdate = adapter.updateWorldbookWith;
  adapter.updateWorldbookWith = async name => adapter.getWorldbook(name);
  await assert.rejects(() => runtime.undoLast(true), error => error.code === 'WRITE_VERIFY_FAILED');
  assert.equal(runtime.state.history.length, 1);
  adapter.updateWorldbookWith = originalUpdate;
});

await test('runtime rejects external change after preview', async () => {
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] } });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  await runtime.refreshInventory();
  runtime.state.draft.content = '计划正文';
  const patch = runtime.previewDraft();
  await adapter.updateWorldbookWith('测试书', entries => [{ ...entries[0], content: '外部正文' }]);
  await assert.rejects(() => runtime.applyPatch(patch, patch.patchId), error => error.code === 'STALE_WRITE');
});

await test('chat change swaps isolated discussion state and restores it by identity', async () => {
  const storage = memoryStorage();
  let identity = { character: '角色甲', chatId: 'chat-a' };
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] } });
  adapter.contextIdentity = () => ({ ...identity });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: storage }, adapter });
  runtime.state.conversation.messages.push({ id: 'a1', role: 'user', content: '甲聊天内容' });
  runtime.state.conversation.selectedContext.push('测试书::7');
  runtime.persistConversation();
  identity = { character: '角色乙', chatId: 'chat-b' };
  runtime.handleChatChange();
  assert.equal(runtime.state.conversation.messages.length, 0);
  assert.equal(runtime.state.conversation.selectedContext.length, 0);
  assert.equal(runtime.state.conversation.identity.chatId, 'chat-b');
  identity = { character: '角色甲', chatId: 'chat-a' };
  runtime.handleChatChange();
  assert.equal(runtime.state.conversation.messages[0].content, '甲聊天内容');
  assert.deepEqual(runtime.state.conversation.selectedContext, ['测试书::7']);
});

await test('worldbook discussion uses the saved Tavern profile without creating host chat messages', async () => {
  const response = '<riki_worldbook_patch>{"bookName":"测试书","entryUid":7,"reason":"优化","changes":{"content":"提案正文"}}</riki_worldbook_patch>';
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry()] }, generateResponse: response });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  const profilePreset = runtime.state.modelLibrary.apiPresets.find(item => item.id === 'tavern-profile-default');
  profilePreset.profileId = 'mock-profile'; profilePreset.model = 'mock-model';
  runtime.persistModelLibrary(runtime.state.modelLibrary);
  await runtime.refreshInventory();
  runtime.toggleContext('测试书', 7, true);
  await runtime.sendDiscussion('讨论这条设定');
  assert.equal(adapter.calls.filter(call => call.type === 'connection.send').length, 1);
  assert.equal(adapter.calls.filter(call => call.type === 'generateRaw').length, 0);
  assert.equal(runtime.state.pendingSuggestion.changes.content, '提案正文');
  assert.equal(runtime.state.conversation.messages.length, 2);
});

await test('discussion truncates the first oversized worldbook context entry', async () => {
  const oversized = `${'长'.repeat(60000)}TAIL_SHOULD_NOT_BE_SENT`;
  const adapter = rikiCreateMockAdapter({ books: { 测试书: [entry({ content: oversized })] }, generateResponse: '已讨论' });
  const runtime = rikiCreateRuntime({ hostWindow: { localStorage: memoryStorage() }, adapter });
  const profilePreset = runtime.state.modelLibrary.apiPresets.find(item => item.id === 'tavern-profile-default');
  profilePreset.profileId = 'mock-profile'; profilePreset.model = 'mock-model';
  runtime.persistModelLibrary(runtime.state.modelLibrary);
  await runtime.refreshInventory();
  runtime.toggleContext('测试书', 7, true);
  await runtime.sendDiscussion('检查上下文限制');
  const call = adapter.calls.find(item => item.type === 'connection.send');
  const context = call.messages.find(item => item.content.includes('<selected_worldbook_context>')).content;
  assert.equal(context.includes('TAIL_SHOULD_NOT_BE_SENT'), false);
  assert.equal(context.includes('[条目内容已按上下文上限截断]'), true);
  assert.equal(context.length < 49000, true);
});

await test('build artifacts use one editable version constant and component shape', () => {
  const remotePath = path.join(root, 'dist', '酒馆助手脚本-Riki剧情工作台-版本加载器.json');
  const localPath = path.join(root, 'dist', '酒馆助手脚本-Riki剧情工作台-本地开发加载器.json');
  const remote = JSON.parse(fs.readFileSync(remotePath, 'utf8'));
  const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  for (const artifact of [remote, local]) {
    assert.equal(artifact.type, 'script');
    assert.equal(artifact.id, 'd1e7f665-988c-4c72-8ff1-ccbc51aba5d3');
    assert.equal(artifact.button.enabled, false);
    assert.deepEqual(artifact.button.buttons, []);
    assert.equal(artifact.export_with.button, false);
    assert.equal((artifact.content.match(/const RIKI_VERSION\s*=/g) || []).length, 1);
    assert.equal(artifact.content.includes('RIKI_RELEASE_BASE'), true);
  }
  assert.match(local.content, /127\.0\.0\.1:8178\/releases/);
  assert.match(remote.content, /@v\$\{RIKI_VERSION\}\/dist\/releases\/\$\{RIKI_VERSION\}\/riki-workbench\.js/);
  assert.equal(remote.content.includes('@main'), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist', 'importable', 'riki-version-loader.script.json'), 'utf8')), remote);
});

await test('build preserves prior release directories', () => {
  const legacyDirectory = path.join(root, 'dist', 'releases', '0.9.9-test');
  fs.mkdirSync(legacyDirectory, { recursive: true });
  fs.writeFileSync(path.join(legacyDirectory, 'keep.txt'), 'rollback', 'utf8');
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { cwd: root, stdio: 'pipe' });
    assert.equal(fs.readFileSync(path.join(legacyDirectory, 'keep.txt'), 'utf8'), 'rollback');
  } finally {
    fs.rmSync(legacyDirectory, { recursive: true, force: true });
  }
});

await test('build report hashes exact artifact bytes', () => {
  const report = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'build-report.json'), 'utf8'));
  for (const artifact of report.artifacts) {
    assert.equal(fileSha256(path.join(root, artifact.path)), artifact.sha256, artifact.path);
  }
});

await test('release bundle and responsive preview contract exist', () => {
  const bundlePath = path.join(root, 'dist', 'releases', '1.0.0', 'riki-workbench.js');
  const source = fs.readFileSync(bundlePath, 'utf8');
  assert.match(source, /export async function start/);
  assert.match(source, /@media \(max-width: 820px\)/);
  assert.match(source, /100dvh/);
  assert.match(source, /safe-area-inset-bottom/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /min-height: 44px/);
  assert.equal(fs.existsSync(path.join(root, 'preview', 'index.html')), true);
});

await test('component mode emits no card package', () => {
  const report = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'build-report.json'), 'utf8'));
  assert.equal(report.deliveryMode, 'component');
  assert.equal(report.boundaries.cardJson, false);
  assert.equal(report.boundaries.cardPng, false);
  const all = fs.readdirSync(path.join(root, 'dist'), { recursive: true }).map(String);
  const unexpectedPackages = all.filter(file => /\.charx$/iu.test(file) || (/\.png$/iu.test(file) && !/^preview-(desktop|mobile|config)\.png$/iu.test(file)));
  assert.deepEqual(unexpectedPackages, []);
});

console.log(`${passed} tests passed.`);
