import assert from 'node:assert/strict';
import { rikiCreateMockAdapter, rikiCreateRuntime } from '../src/riki-workbench.js';
import * as Project from '../src/riki-project-core.js';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

function envelope(kind, content) {
  return `已完成${kind}候选。\n<riki_artifact>${JSON.stringify({ kind, summary: `${kind}模拟候选`, changeLevel: 'major', mergeMode: 'replace', content })}</riki_artifact>`;
}

function mockResponse(config) {
  const prompts = Array.isArray(config?.ordered_prompts) ? config.ordered_prompts : [];
  const system = prompts.find(message => message?.role === 'system')?.content || '';
  const joined = prompts.map(message => message?.content || '').join('\n');
  if (/格式编译 Agent/u.test(joined) && /<target_kind>outline/u.test(joined)) return envelope('outline', { title: '编译后的雾港蓝焰', premise: '调查失踪案', mainConflict: '记录与记忆冲突', fullOutline: '从港务记录追到旧灯塔。', foreshadowing: [], endings: [], playerFreedom: '玩家决定路线' });
  if (/当前模块：人物 Agent|人物策划|<target_kind>characters/u.test(joined)) {
    const detailed = /粗略版已经确认|characters_detailed_after_rough/u.test(joined);
    return envelope('characters', { phase: detailed ? 'detailed' : (/"mode"\s*:\s*"brief"/u.test(joined) ? 'rough' : 'detailed'), characters: [{ characterId: 'CHAR-001', name: '领航员', tier: '中档', identity: '雾港领航员', goals: ['查清蓝焰异常'], motivation: '保护航线', bottomLine: '不伤害无辜', knowledgeBoundary: '只知道灯塔异常' }] });
  }
  if (/当前模块：小章 Agent|小章策划|<target_kind>chapters/u.test(joined)) return envelope('chapters', { chapters: [{ chapterId: 'CH-001', actId: 'ACT-001', title: '记录空白', requiredGoals: [{ goalId: 'CH-001-G1', actGoalId: 'ACT-001-G1', text: '确认领航员缺席', completionCondition: '记录明确显示缺席' }], dailyTasks: [], keyEvents: ['证词冲突'], endingState: '线索指向灯塔', nextHook: '蓝焰亮起' }] });
  if (/当前模块：大章 Agent|大章策划|<target_kind>acts/u.test(joined)) return envelope('acts', { acts: [{ actId: 'ACT-001', title: '雾港失踪案', coreConflict: '记录与证词冲突', actGoals: [{ goalId: 'ACT-001-G1', text: '找到领航员', dramaticHook: '个人赌注：航线即将关闭', completionCondition: '领航员去向被证实' }], keyEvents: ['检查港务记录'], stageResult: '发现导航被改动', nextActConnection: '进入禁航区', estimatedCapacity: 5 }] });
  if (/当前模块：总纲 Agent|总纲策划/u.test(joined)) return envelope('outline', { title: '雾港蓝焰', premise: '调查失踪案', mainConflict: '公开记录与私人记忆冲突', fullOutline: '从港务记录追到旧灯塔，再进入禁航区。', foreshadowing: [], endings: [], playerFreedom: '路线与结局由玩家选择' });
  return '这是一次剧情讨论回复。';
}

function runtime(chatId) {
  const adapter = rikiCreateMockAdapter({ character: '模拟角色', chatId, books: { 雾港: [] }, generateResponse: mockResponse });
  const app = rikiCreateRuntime({ hostWindow: { localStorage: storage() }, adapter });
  app.state.modelLibrary.apiPresets[0] = { ...app.state.modelLibrary.apiPresets[0], transport: 'tavern', profileId: '' };
  return app;
}

function useMockTavern(app) {
  app.state.modelLibrary.apiPresets[0] = { ...app.state.modelLibrary.apiPresets[0], transport: 'tavern', profileId: '' };
  return app;
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await test('simulation round 1: detailed workflow discusses, confirms outline and act versions', async () => {
  const app = runtime('detailed');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  const outlineDraft = await app.sendPlanning('请生成正式总纲候选', { moduleId: 'outline', formal: true });
  assert.equal(outlineDraft.status, 'awaiting_content_confirmation');
  await app.compileLatestDraft(outlineDraft.id);
  assert.equal(branch.pendingProposal.kind, 'outline');
  const outline = await app.confirmCurrentProposal();
  assert.equal(outline.kind, 'outline');
  const actDraft = await app.sendPlanning('请生成正式大章候选', { moduleId: 'act', formal: true });
  assert.equal(actDraft.status, 'awaiting_content_confirmation');
  await app.compileLatestDraft(actDraft.id);
  const act = await app.confirmCurrentProposal();
  assert.equal(act.kind, 'acts');
  assert.equal(Project.rikiProjectCurrentArtifact(app.state.project, 'outline').content.title, '编译后的雾港蓝焰');
  assert.equal(Project.rikiProjectCurrentArtifact(app.state.project, 'acts').content.acts[0].actId, 'ACT-001');
  assert.equal(app.state.project.requestLogs.length >= 2, true);
});

await test('simulation round 2: brief workflow confirms rough characters before detailed version', async () => {
  const app = runtime('brief');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'brief', { force: true });
  await app.sendPlanning('请生成人物粗略版正式候选', { moduleId: 'character', formal: true });
  assert.equal(branch.pendingProposal.content.phase, 'rough');
  await app.confirmCurrentProposal();
  assert.equal(branch.pendingProposal.content.phase, 'detailed');
  const version = await app.confirmCurrentProposal();
  assert.equal(version.kind, 'characters');
  assert.equal(Project.rikiProjectCurrentArtifact(app.state.project, 'characters').content.characters[0].characterId, 'CHAR-001');
  assert.equal(app.state.project.decisions.some(item => item.type === 'character_rough_confirmed'), true);
});

await test('simulation round 3: lazy workflow checkpoints four artifacts, rolls back and can run again', async () => {
  const app = runtime('lazy');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'lazy', { force: true });
  await app.runLazyWorkflow('完整规划雾港失踪案');
  assert.equal(app.state.project.runtime.lazyBatch.status, 'awaiting_confirmation');
  assert.deepEqual(Project.RIKI_PROJECT_ARTIFACT_KINDS.map(kind => Boolean(Project.rikiProjectCurrentArtifact(app.state.project, kind))), [true, true, true, true]);
  Project.rikiProjectRejectLazyBatch(app.state.project);
  assert.deepEqual(Project.RIKI_PROJECT_ARTIFACT_KINDS.map(kind => Project.rikiProjectCurrentArtifact(app.state.project, kind)), [null, null, null, null]);
  await app.runLazyWorkflow('重新规划雾港失踪案');
  Project.rikiProjectConfirmLazyBatch(app.state.project);
  assert.equal(app.state.project.runtime.lazyBatch.status, 'complete');
  assert.equal(Project.rikiProjectStage(app.state.project), 'ready');
});

await test('simulation exports all results without device model configuration or credentials', async () => {
  const app = runtime('export');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  const draft = await app.sendPlanning('请生成正式总纲候选', { moduleId: 'outline', formal: true });
  await app.compileLatestDraft(draft.id);
  await app.confirmCurrentProposal();
  app.state.modelLibrary.apiPresets.push({ id: 'secret', name: 'secret', transport: 'direct', endpoint: 'https://example.com', apiKey: 'sk-never-export', model: 'm' });
  const exported = Project.rikiProjectBuildExport(app.state.project);
  const raw = JSON.stringify(exported);
  assert.equal(raw.includes('sk-never-export'), false);
  assert.equal(raw.includes('apiPresets'), false);
  assert.equal(exported.artifacts.outline.versions.length, 1);
});

await test('confirmed artifacts sync to an own project book and can migrate to the character book', async () => {
  const adapter = rikiCreateMockAdapter({
    character: '同步角色', chatId: 'worldbook-sync',
    bindings: { character: ['角色原书'] },
    books: { 角色原书: [{ uid: 9, name: '原有设定', enabled: true, content: '这条不能被覆盖。', strategy: { type: 'constant', keys: [] }, position: { type: 'after_character_definition' } }] },
    generateResponse: mockResponse,
  });
  const app = useMockTavern(rikiCreateRuntime({ hostWindow: { localStorage: storage() }, adapter }));
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  const draft = await app.sendPlanning('请生成正式总纲候选', { moduleId: 'outline', formal: true });
  await app.compileLatestDraft(draft.id);
  await app.confirmCurrentProposal();
  const own = app.state.project.runtime.projectWorldbook;
  assert.equal(own.mode, 'own');
  assert.equal(adapter.calls.some(item => item.type === 'worldbook.create' && item.name === own.name), true);
  assert.equal(adapter.calls.some(item => item.type === 'worldbook.bind-chat' && item.name === own.name), true);
  await app.dispatch('project.worldbook.mode', { mode: 'original' });
  assert.equal(app.state.project.runtime.projectWorldbook.mode, 'original');
  assert.equal(app.state.project.runtime.projectWorldbook.name, '角色原书');
  const original = await adapter.getWorldbook('角色原书');
  assert.equal(original.some(item => item.name === '原有设定' && item.content === '这条不能被覆盖。'), true);
  assert.equal(original.some(item => item.name === 'Riki·总纲'), true);
  assert.equal(adapter.calls.some(item => item.type === 'worldbook.delete' && item.name === own.name), true);
});

await test('character-bound worldbooks and recent Tavern messages enter the selected planning context', async () => {
  const adapter = rikiCreateMockAdapter({
    character: '上下文角色', chatId: 'context',
    bindings: { character: ['角色设定'] },
    books: { 角色设定: [{ uid: 7, name: '港口规则', enabled: true, content: '蓝焰只在退潮后点燃。', strategy: { type: 'constant', keys: [] }, position: { type: 'after_character_definition' } }] },
    recentChatMessages: [
      { role: 'user', content: `最早正文不应越过预算。${'旧'.repeat(5000)}` },
      ...Array.from({ length: 198 }, (_, index) => ({ role: 'assistant', content: `中间正文${index}：${'雾'.repeat(5000)}` })),
      { role: 'user', content: '我刚刚抵达港口。' },
    ],
    generateResponse: '先讨论当前线索。',
  });
  const app = useMockTavern(rikiCreateRuntime({ hostWindow: { localStorage: storage() }, adapter }));
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  branch.context.mainChatDepth = -1;
  await app.refreshInventory();
  assert.deepEqual(branch.context.selectedWorldbooks, ['角色设定']);
  assert.deepEqual(branch.context.selectedEntries['角色设定'], ['7']);
  await app.sendPlanning('先讨论世界设定', { moduleId: 'outline', formal: false });
  const config = adapter.calls.find(item => item.type === 'generateRaw')?.config || {};
  const contextMessage = config.ordered_prompts.find(item => item?.role === 'system' && item.content?.includes('<selected_worldbook_context>'));
  const sent = JSON.stringify(config);
  assert.match(sent, /蓝焰只在退潮后点燃/);
  assert.match(sent, /我刚刚抵达港口/);
  assert.doesNotMatch(sent, /最早正文不应越过预算/);
  assert.ok(contextMessage.content.length < 49_000, `上下文字符预算失效：${contextMessage.content.length}`);
});

await test('ready project uses the main controller model only for ambiguous routing', async () => {
  const adapter = rikiCreateMockAdapter({
    character: '路由角色', chatId: 'controller',
    books: { 路由设定: [{ uid: 8, name: '路由证据', enabled: true, content: '第二幕必须发生在旧港。', strategy: { type: 'constant', keys: [] }, position: { type: 'after_character_definition' } }] },
    bindings: { character: ['路由设定'] },
    recentChatMessages: [{ role: 'user', content: '我已经抵达旧港。' }],
    generateResponse(config) {
      const joined = JSON.stringify(config?.ordered_prompts || []);
      if (joined.includes('本轮只做路由')) return '{"targetModule":"act","intent":"modify","scope":"调整第二大章","downstream":["chapter","character"],"reason":"用户同时提到大章与人物，但主要动作落在大章"}';
      return '先从第二大章的阶段目标与人物代价开始讨论。';
    },
  });
  const app = useMockTavern(rikiCreateRuntime({ hostWindow: { localStorage: storage() }, adapter }));
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  await app.refreshInventory();
  const confirm = (kind, content) => {
    const proposal = Project.rikiProjectProposeArtifact(app.state.project, branch, kind, content);
    Project.rikiProjectConfirmAllProposalItems(branch, proposal.proposalId);
    Project.rikiProjectConfirmArtifactProposal(app.state.project, branch.id, proposal.proposalId);
  };
  confirm('outline', { title: '故事' });
  confirm('acts', { acts: [{ actId: 'ACT-1', title: '第一幕' }] });
  confirm('chapters', { chapters: [{ chapterId: 'CH-1', actId: 'ACT-1', title: '第一章' }] });
  confirm('characters', { phase: 'detailed', characters: [{ characterId: 'CHAR-1', name: '甲' }] });
  await app.sendPlanning('我想调整大章和人物的衔接', {});
  assert.equal(adapter.calls.filter(item => item.type === 'generateRaw').length, 2);
  const controllerCall = JSON.stringify(adapter.calls.filter(item => item.type === 'generateRaw')[0].config);
  assert.match(controllerCall, /第二幕必须发生在旧港/);
  assert.match(controllerCall, /我已经抵达旧港/);
  assert.equal(branch.messages.at(-1).module, 'act');
  assert.equal(branch.messages.at(-1).request.route.source, 'model-controller');
});

await test('closing the workbench keeps an in-flight generation alive and reopening reveals completion', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const adapter = rikiCreateMockAdapter({
    character: '模拟角色', chatId: 'background', books: { 雾港: [] },
    generateResponse: async config => { await pending; return mockResponse(config); },
  });
  const app = useMockTavern(rikiCreateRuntime({ hostWindow: { localStorage: storage() }, adapter }));
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  app.state.open = true;
  const running = app.sendPlanning('请生成正式总纲候选', { moduleId: 'outline', formal: true });
  for (let index = 0; index < 20 && !app.state.generation.active; index += 1) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(app.state.generation.active, true);
  app.close();
  assert.equal(app.state.generation.background, true);
  release();
  const draft = await running;
  assert.equal(draft.status, 'awaiting_content_confirmation');
  app.open();
  assert.equal(app.state.open, true);
  assert.equal(app.state.generation.active, false);
  await app.compileLatestDraft(draft.id);
  assert.equal(branch.pendingProposal.kind, 'outline');
});

await test('Command Core exposes project, branch, artifact and redacted model operations', async () => {
  const app = runtime('command-core');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  const draft = await app.dispatch('planning.send', { text: '请生成正式总纲候选', moduleId: 'outline', formal: true });
  await app.dispatch('planning.confirmContent', { messageId: draft.id });
  await app.dispatch('artifact.confirmProposal');
  const status = await app.dispatch('status');
  assert.equal(status.artifactKinds.outline !== null, true);
  assert.equal((await app.dispatch('conversation.list')).length, 1);
  assert.equal((await app.dispatch('artifact.current', { kind: 'outline' })).kind, 'outline');
  assert.equal((await app.dispatch('project.export')).format, Project.RIKI_PROJECT_EXPORT_FORMAT);
  assert.equal(JSON.stringify(await app.dispatch('model.library')).includes('apiKey'), false);
  assert.equal((await app.dispatch('model.resolve', { moduleId: 'outline' })).transport, 'tavern');
});

await test('format compiler uses the latest planning draft and inherits its target module', async () => {
  const app = runtime('compiler');
  const branch = Project.rikiProjectActiveConversation(app.state.project);
  Project.rikiProjectSetStrategyMode(app.state.project, branch.id, 'detailed', { force: true });
  await app.sendPlanning('先给我一份总纲草稿，不保存正式版本', { moduleId: 'outline', formal: false });
  assert.equal(branch.pendingProposal, null);
  branch.module = 'format_guard';
  await app.compileLatestDraft();
  assert.equal(branch.pendingProposal.kind, 'outline');
  assert.equal(branch.pendingProposal.content.title, '编译后的雾港蓝焰');
  await app.confirmCurrentProposal();
  assert.equal(Project.rikiProjectCurrentArtifact(app.state.project, 'outline').content.title, '编译后的雾港蓝焰');
});

console.log(`${passed} runtime simulation rounds passed.`);
