import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RIKI_MODEL_MODULE_IDS,
  RIKI_MODEL_LIBRARY_STORAGE_KEY,
  rikiCreateTavernSystemPreset,
  rikiDefaultModelLibrary,
  rikiDeleteApiPreset,
  rikiDeleteSystemPreset,
  rikiDiagnoseFetchFailure,
  rikiFetchModels,
  rikiGetConnectionProfiles,
  rikiLoadModelLibrary,
  rikiNormalizeApiPreset,
  rikiNormalizeModelLibrary,
  rikiNormalizeSystemPreset,
  rikiRedactedRequestDescriptor,
  rikiRequestModel,
  rikiResolveCompilerConfig,
  rikiResolveModuleConfig,
  rikiSaveModelLibrary,
  rikiTavernSystemSnapshot,
  rikiUpsertApiPreset,
  rikiUpsertSystemPreset,
} from '../src/riki-model-config.js';

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

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    snapshot: () => Object.fromEntries(data),
  };
}

function directPreset(overrides = {}) {
  return rikiNormalizeApiPreset({
    id: 'direct-a',
    name: '直连 A',
    transport: 'direct',
    endpoint: 'https://api.example.test/v1',
    apiKey: 'sk-device-secret-123456',
    model: 'story-model',
    temperature: 0.6,
    maxTokens: 4096,
    ...overrides,
  });
}

function resolvedFor(preset, overrides = {}) {
  return {
    apiPresetId: preset.id,
    apiPreset: preset,
    model: preset.model,
    modelSource: 'api_preset',
    systemPresetId: '',
    systemPreset: null,
    ...overrides,
  };
}

function streamingResponse(chunks) {
  const encoded = chunks.map(chunk => typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of encoded) controller.enqueue(chunk);
      controller.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

await test('module and builtin inventories contain only the seven non-runtime-plug-in planning modules', () => {
  assert.deepEqual(RIKI_MODEL_MODULE_IDS, [
    'main', 'outline', 'act', 'chapter', 'character', 'progression_preset', 'format_guard',
  ]);
  const library = rikiDefaultModelLibrary();
  assert.deepEqual(library.systemPresets.map(preset => preset.id).sort(), [
    'builtin_act',
    'builtin_chapter',
    'builtin_character',
    'builtin_controller',
    'builtin_format_guard',
    'builtin_outline',
    'builtin_progression_preset',
  ].sort());
  const allSystemText = library.systemPresets.map(preset => preset.content).join('\n');
  assert.doesNotMatch(allSystemText, /破限|越狱|sex参数|露骨|数据库设计|数据库审查|生图|二创/i);
  assert.deepEqual([...new Set(library.apiPresets.map(preset => preset.transport))], ['tavern']);
});

await test('API normalization defaults to tavern and strips copied profile credentials', () => {
  const fallback = rikiNormalizeApiPreset({ transport: 'unsupported' });
  assert.equal(fallback.transport, 'tavern');
  assert.equal(fallback.viaBackend, false);
  const profile = rikiNormalizeApiPreset({
    id: 'profile-a',
    transport: 'profile',
    profileId: 'cm-1',
    endpoint: 'https://secret.example/v1',
    apiKey: 'must-not-copy',
    secretId: 'must-not-copy-either',
    model: 'profile-model',
  });
  assert.equal(profile.profileId, 'cm-1');
  assert.equal(profile.endpoint, '');
  assert.equal(profile.apiKey, '');
  assert.equal('secretId' in profile, false);
});

await test('device library persists to extension settings and local storage without touching chat state', () => {
  const storage = memoryStorage();
  const chatState = { sentinel: 'unchanged' };
  let saves = 0;
  const context = {
    extensionSettings: {},
    chatMetadata: chatState,
    saveSettingsDebounced() { saves += 1; },
  };
  const environment = { context, storage };
  const library = rikiUpsertApiPreset(rikiDefaultModelLibrary(), directPreset());
  library.activeApiPresetId = 'direct-a';
  const saved = rikiSaveModelLibrary(environment, library);
  assert.equal(saved.apiPresets.find(preset => preset.id === 'direct-a').apiKey, 'sk-device-secret-123456');
  assert.equal(saves, 1);
  assert.deepEqual(chatState, { sentinel: 'unchanged' });
  assert.equal(storage.getItem(RIKI_MODEL_LIBRARY_STORAGE_KEY).includes('sk-device-secret-123456'), true);
  assert.equal(JSON.stringify(context.extensionSettings).includes('sk-device-secret-123456'), true);
  const loaded = rikiLoadModelLibrary(environment);
  assert.equal(loaded.activeApiPresetId, 'direct-a');
  assert.equal(loaded.apiPresets.find(preset => preset.id === 'direct-a').model, 'story-model');
});

await test('source has no chat-level configuration persistence path', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'riki-model-config.js'), 'utf8');
  assert.equal(source.includes('chatMetadata'), false);
  assert.equal(source.includes('chat_metadata'), false);
  assert.equal(source.includes("transport === 'database'"), false);
});

await test('multiple API presets can be saved and deleted with tavern fallback protected', () => {
  let library = rikiDefaultModelLibrary();
  library = rikiUpsertApiPreset(library, directPreset());
  library = rikiUpsertApiPreset(library, { id: 'profile-a', name: '酒馆预设 A', transport: 'profile', profileId: 'cm-1' });
  assert.deepEqual(library.apiPresets.map(preset => preset.id), ['tavern-current', 'direct-a', 'profile-a']);
  library.activeApiPresetId = 'direct-a';
  library = rikiDeleteApiPreset(library, 'direct-a');
  assert.equal(library.activeApiPresetId, 'tavern-current');
  assert.equal(library.apiPresets.some(preset => preset.id === 'direct-a'), false);
  library = rikiDeleteApiPreset(library, 'tavern-current');
  assert.equal(library.apiPresets.some(preset => preset.id === 'tavern-current'), true);
});

await test('tavern-current stable ID cannot be mutated into a direct or profile transport', () => {
  const library = rikiNormalizeModelLibrary({
    activeApiPresetId: 'tavern-current',
    apiPresets: [{ id: 'tavern-current', name: '伪装直连', transport: 'direct', endpoint: 'https://evil.invalid/v1', apiKey: 'sk-should-drop', profileId: 'profile-secret', model: 'allowed-model-override' }],
    systemPresets: [],
  });
  const preset = library.apiPresets.find(item => item.id === 'tavern-current');
  assert.equal(preset.transport, 'tavern');
  assert.equal(preset.endpoint, '');
  assert.equal(preset.apiKey, '');
  assert.equal(preset.profileId, '');
  assert.equal(preset.model, 'allowed-model-override');
});

await test('manual System presets save and delete while builtin contracts stay protected', () => {
  let library = rikiDefaultModelLibrary();
  library = rikiUpsertSystemPreset(library, rikiNormalizeSystemPreset({ id: 'manual-a', name: '自定义', content: '只输出用户可见结果。' }));
  assert.equal(library.systemPresets.find(preset => preset.id === 'manual-a').content, '只输出用户可见结果。');
  library.activeSystemPresetId = 'manual-a';
  library = rikiDeleteSystemPreset(library, 'manual-a');
  assert.equal(library.activeSystemPresetId, '');
  assert.equal(library.systemPresets.some(preset => preset.id === 'manual-a'), false);
  library = rikiDeleteSystemPreset(library, 'builtin_outline');
  assert.equal(library.systemPresets.some(preset => preset.id === 'builtin_outline'), true);
});

await test('module resolution follows module then default then main and respects explicit preset model boundary', () => {
  let library = rikiDefaultModelLibrary();
  library = rikiUpsertApiPreset(library, directPreset({ id: 'direct-a', model: 'preset-a' }));
  library = rikiUpsertApiPreset(library, directPreset({ id: 'direct-b', model: 'preset-b' }));
  const projectConfig = {
    main: { apiPresetId: 'direct-a', model: 'main-model' },
    default: { model: 'default-model' },
    modules: {
      outline: { model: 'outline-model' },
      act: { apiPresetId: 'direct-b' },
    },
  };
  const outline = rikiResolveModuleConfig(projectConfig, 'outline', library);
  assert.equal(outline.apiPresetId, 'direct-a');
  assert.equal(outline.model, 'outline-model');
  assert.equal(outline.modelSource, 'module_override');
  assert.equal(outline.systemPresetId, 'builtin_outline');
  const act = rikiResolveModuleConfig(projectConfig, 'act', library);
  assert.equal(act.apiPresetId, 'direct-b');
  assert.equal(act.model, 'preset-b');
  assert.equal(act.modelSource, 'api_preset');
  const main = rikiResolveModuleConfig(projectConfig, 'main', library);
  assert.equal(main.model, 'main-model');
});

await test('format compiler inherits target API and model unless it has an explicit override', () => {
  let library = rikiDefaultModelLibrary();
  library = rikiUpsertApiPreset(library, directPreset({ id: 'direct-a', model: 'preset-a' }));
  library = rikiUpsertApiPreset(library, directPreset({ id: 'direct-b', model: 'preset-b' }));
  const inherited = rikiResolveCompilerConfig({ modules: { chapter: { apiPresetId: 'direct-a', model: 'chapter-model' } } }, 'chapter', library);
  assert.equal(inherited.apiPresetId, 'direct-a');
  assert.equal(inherited.model, 'chapter-model');
  assert.equal(inherited.modelSource, 'inherit:module_override');
  const overridden = rikiResolveCompilerConfig({ modules: {
    chapter: { apiPresetId: 'direct-a', model: 'chapter-model' },
    format_guard: { apiPresetId: 'direct-b' },
  } }, 'chapter', library);
  assert.equal(overridden.apiPresetId, 'direct-b');
  assert.equal(overridden.model, 'preset-b');
});

await test('Connection Manager inventory and request descriptor expose references but no secrets', () => {
  const profile = {
    id: 'cm-1', name: '远程连接', api: 'openai', mode: 'chat', model: 'cm-model',
    'api-url': 'https://user:pass@example.test/v1?token=hidden-token',
    'secret-id': 'vault-secret-id',
  };
  const environment = { connectionManagerService: { getSupportedProfiles: () => [profile] } };
  const profiles = rikiGetConnectionProfiles(environment);
  const serialized = JSON.stringify(profiles);
  assert.equal(profiles[0].id, 'cm-1');
  assert.equal(serialized.includes('vault-secret-id'), false);
  assert.equal(serialized.includes('hidden-token'), false);
  assert.equal(serialized.includes('pass@'), false);
  const preset = rikiNormalizeApiPreset({ id: 'profile-a', transport: 'profile', profileId: 'cm-1' });
  const descriptor = rikiRedactedRequestDescriptor(resolvedFor(preset), environment);
  assert.equal(JSON.stringify(descriptor).includes('vault-secret-id'), false);
  assert.equal(descriptor.credential.includes('已隐藏'), true);
});

await test('direct request descriptor redacts key, URL userinfo, and sensitive query values', () => {
  const preset = directPreset({ endpoint: 'https://alice:password@example.test/v1?api_key=url-secret' });
  const descriptor = rikiRedactedRequestDescriptor(resolvedFor(preset));
  const serialized = JSON.stringify(descriptor);
  assert.equal(serialized.includes('sk-device-secret-123456'), false);
  assert.equal(serialized.includes('password@'), false);
  assert.equal(serialized.includes('url-secret'), false);
  assert.equal(descriptor.credential.includes('已隐藏'), true);
});

await test('current Tavern System snapshot follows enabled system order and deduplicates content', () => {
  const environment = {
    getPresetPrompts: () => [
      { role: 'system', content: '系统甲' },
      { role: 'user', content: '忽略用户项' },
      { role: 'system', content: '系统甲' },
      { role: 'system', content: '禁用项', enabled: false },
    ],
    context: { extensionSettings: { prompts: [{ role: 'system', content: '系统乙' }] } },
  };
  assert.equal(rikiTavernSystemSnapshot(environment), '系统甲\n\n系统乙');
  const preset = rikiCreateTavernSystemPreset(environment, { id: 'snapshot-a', name: '快照 A' });
  assert.equal(preset.source, 'tavern-snapshot');
  assert.equal(preset.content, '系统甲\n\n系统乙');
});

await test('tavern transport uses generateRaw current connection and prepends selected System preset', async () => {
  let captured = null;
  const environment = {
    adapter: {
      async generateRaw(config) { captured = config; return '酒馆回复'; },
      stopGeneration() { return true; },
    },
  };
  const library = rikiDefaultModelLibrary();
  const resolved = rikiResolveModuleConfig({ modules: { outline: { model: '酒馆覆盖模型' } } }, 'outline', library);
  const deltas = [];
  const result = await rikiRequestModel(environment, resolved, [{ role: 'user', content: '规划故事' }], {
    onDelta: delta => deltas.push(delta),
  });
  assert.equal(result.text, '酒馆回复');
  assert.equal(result.transport, 'tavern');
  assert.equal(captured.ordered_prompts[0].role, 'system');
  assert.equal(captured.ordered_prompts.at(-1).content, '规划故事');
  assert.equal(captured.custom_api.model, '酒馆覆盖模型');
  assert.equal(captured.should_silence, true);
  assert.deepEqual(deltas, ['酒馆回复']);
});

await test('tavern transport maps AbortSignal to stopGeneration and rejects AbortError', async () => {
  let stopId = '';
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const environment = {
    adapter: {
      generateRaw: () => pending,
      stopGeneration(id) { stopId = id; return true; },
    },
  };
  const preset = rikiDefaultModelLibrary().apiPresets[0];
  const controller = new AbortController();
  const request = rikiRequestModel(environment, resolvedFor(preset), [{ role: 'user', content: '开始' }], { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
  assert.equal(stopId.startsWith('riki-model-'), true);
  release('迟到结果');
});

await test('profile transport consumes cumulative Connection Manager stream and forwards AbortSignal', async () => {
  let captured = null;
  const service = {
    async sendRequest(...args) {
      captured = args;
      return async function* stream() {
        yield { text: '你' };
        yield { text: '你好', usage: { prompt_tokens: 12 } };
      };
    },
  };
  const preset = rikiNormalizeApiPreset({ id: 'profile-a', transport: 'profile', profileId: 'cm-1', model: 'cm-model' });
  const controller = new AbortController();
  const deltas = [];
  const result = await rikiRequestModel({ connectionManagerService: service }, resolvedFor(preset), [{ role: 'user', content: '你好' }], {
    signal: controller.signal,
    onDelta: delta => deltas.push(delta),
  });
  assert.equal(result.text, '你好');
  assert.equal(result.streamed, true);
  assert.equal(result.inputTokens, 12);
  assert.deepEqual(deltas, ['你', '好']);
  assert.equal(captured[0], 'cm-1');
  assert.equal(captured[3].signal, controller.signal);
  assert.equal(captured[4].model, 'cm-model');
});

await test('direct transport parses chunked UTF-8 OpenAI SSE and emits deltas', async () => {
  let requestUrl = '';
  let requestInit = null;
  const first = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n');
  const second = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"好"}}],"usage":{"prompt_tokens":9}}\n\ndata: [DONE]\n\n');
  const environment = {
    fetch: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return streamingResponse([first.subarray(0, first.length - 1), first.subarray(first.length - 1), second]);
    },
  };
  const preset = directPreset();
  const deltas = [];
  const result = await rikiRequestModel(environment, resolvedFor(preset), [{ role: 'user', content: '问候' }], {
    onDelta: delta => deltas.push(delta),
  });
  assert.equal(requestUrl, 'https://api.example.test/v1/chat/completions');
  assert.equal(requestInit.headers.Authorization, 'Bearer sk-device-secret-123456');
  assert.equal(JSON.parse(requestInit.body).stream, true);
  assert.equal(result.text, '你好');
  assert.equal(result.streamed, true);
  assert.equal(result.inputTokens, 9);
  assert.deepEqual(deltas, ['你', '好']);
  assert.equal(JSON.stringify(result.descriptor).includes('sk-device-secret-123456'), false);
});

await test('direct transport accepts non-stream completion fallback without changing transport', async () => {
  const environment = {
    fetch: async () => new Response(JSON.stringify({
      choices: [{ message: { content: '完整回复' } }],
      usage: { prompt_tokens: 7 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  };
  const result = await rikiRequestModel(environment, resolvedFor(directPreset()), [{ role: 'user', content: '测试' }]);
  assert.equal(result.text, '完整回复');
  assert.equal(result.streamed, false);
  assert.equal(result.fallback, true);
  assert.equal(result.transport, 'direct');
});

await test('direct model list normalizes URL and supports data/models response shapes', async () => {
  let captured = null;
  const names = await rikiFetchModels({
    fetch: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }] }), { status: 200 });
    },
  }, directPreset(), new AbortController().signal);
  assert.equal(captured.url, 'https://api.example.test/v1/models');
  assert.equal(captured.init.headers.Authorization, 'Bearer sk-device-secret-123456');
  assert.deepEqual(names, ['a-model', 'z-model']);
});

await test('profile model list can use runtime profile names without copying its secret', async () => {
  const rawProfile = {
    id: 'cm-1', model: 'current-model', models: [{ id: 'model-b' }, { id: 'model-a' }],
    'secret-id': 'runtime-only-secret',
  };
  const names = await rikiFetchModels({ connectionManagerService: { getSupportedProfiles: () => [rawProfile] } }, {
    transport: 'profile', profileId: 'cm-1', model: '',
  });
  assert.deepEqual(names, ['current-model', 'model-a', 'model-b']);
});

await test('Failed to fetch reports CORS, HTTPS mixed content, and unreachable endpoint explicitly', async () => {
  const diagnosed = rikiDiagnoseFetchFailure(new TypeError('Failed to fetch'), 'http://api.example.test/v1', { location: { protocol: 'https:' } });
  assert.match(diagnosed.message, /CORS/);
  assert.match(diagnosed.message, /HTTPS\/HTTP 混合内容/);
  assert.match(diagnosed.message, /设备或网络是否能访问/);
  assert.match(diagnosed.message, /不会静默切换传输方式/);
  await assert.rejects(
    () => rikiFetchModels({
      location: { protocol: 'https:' },
      fetch: async () => { throw new TypeError('Failed to fetch'); },
    }, directPreset({ endpoint: 'http://api.example.test' })),
    error => /CORS/.test(error.message) && /混合内容/.test(error.message),
  );
});

await test('pre-aborted direct request never calls fetch', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => rikiRequestModel({ fetch: async () => { calls += 1; } }, resolvedFor(directPreset()), [{ role: 'user', content: '停止' }], { signal: controller.signal }),
    error => error.name === 'AbortError',
  );
  assert.equal(calls, 0);
});

await test('viaBackend true uses the explicit SillyTavern backend service and preserves stream deltas', async () => {
  const preset = directPreset({ viaBackend: true });
  const deltas = [];
  let payload;
  const result = await rikiRequestModel({
    context: {
      ChatCompletionService: {
        processRequest: async value => {
          payload = value;
          return (async function* stream() {
            yield { text: '酒馆' };
            yield { text: '酒馆后端' };
          })();
        },
      },
    },
    fetch: async () => { throw new Error('browser fetch must not be used'); },
  }, resolvedFor(preset), [{ role: 'user', content: '测试' }], { onDelta: delta => deltas.push(delta) });
  assert.equal(result.text, '酒馆后端');
  assert.equal(result.viaBackend, true);
  assert.deepEqual(deltas, ['酒馆', '后端']);
  assert.equal(payload.chat_completion_source, 'custom');
  assert.equal(payload.custom_url.endsWith('/v1'), true);
});

await test('viaBackend requires the declared Tavern backend capability and never silently falls back', async () => {
  const preset = directPreset({ viaBackend: true });
  await assert.rejects(
    () => rikiRequestModel({ fetch: async () => { throw new Error('must not call'); } }, resolvedFor(preset), [{ role: 'user', content: '测试' }]),
    error => /缺少 ChatCompletionService/.test(error.message) && /关闭“经酒馆后端转发”/.test(error.message),
  );
});

await test('viaBackend model inventory uses the Tavern status endpoint only when explicitly enabled', async () => {
  let request;
  const names = await rikiFetchModels({
    context: { getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF': 'test' }) },
    fetch: async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'backend-model' }] }), text: async () => '' };
    },
  }, directPreset({ viaBackend: true }));
  assert.deepEqual(names, ['backend-model']);
  assert.equal(request.url, '/api/backends/chat-completions/status');
  assert.equal(JSON.parse(request.init.body).chat_completion_source, 'custom');
});

await test('unknown transport is rejected instead of being silently rerouted', async () => {
  let calls = 0;
  await assert.rejects(
    () => rikiRequestModel({ fetch: async () => { calls += 1; } }, {
      apiPresetId: 'invalid-a',
      apiPreset: { id: 'invalid-a', transport: 'unknown-route' },
    }, [{ role: 'user', content: '测试' }]),
    error => /不支持的模型传输方式/.test(error.message),
  );
  assert.equal(calls, 0);
});

await test('SSE done marker without text is treated as an incomplete response', async () => {
  await assert.rejects(
    () => rikiRequestModel({
      fetch: async () => streamingResponse(['data: [DONE]\n\n']),
    }, resolvedFor(directPreset()), [{ role: 'user', content: '测试' }]),
    error => /结束标记，没有文本内容/.test(error.message),
  );
});

await test('profile request errors redact the runtime secret reference', async () => {
  const environment = {
    connectionManagerService: {
      getSupportedProfiles: () => [{ id: 'cm-1', 'secret-id': 'runtime-vault-secret' }],
      sendRequest: async () => { throw new Error('gateway rejected runtime-vault-secret'); },
    },
  };
  const preset = rikiNormalizeApiPreset({ id: 'profile-a', transport: 'profile', profileId: 'cm-1' });
  await assert.rejects(
    () => rikiRequestModel(environment, resolvedFor(preset), [{ role: 'user', content: '测试' }]),
    error => error.message.includes('[redacted]') && !error.message.includes('runtime-vault-secret'),
  );
});

await test('retryable direct HTTP failure retries before streaming and keeps diagnostics redacted', async () => {
  let calls = 0;
  const waits = [];
  const environment = {
    fetch: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('temporary failure for sk-device-secret-123456', { status: 503 });
      }
      return streamingResponse(['data: {"choices":[{"delta":{"content":"恢复"}}]}\n\ndata: [DONE]\n\n']);
    },
  };
  const result = await rikiRequestModel(environment, resolvedFor(directPreset()), [{ role: 'user', content: '测试' }], {
    retryDelayMs: 0,
    onRetryWait: receipt => waits.push(receipt),
  });
  assert.equal(result.text, '恢复');
  assert.equal(calls, 2);
  assert.equal(waits.length, 1);
  assert.equal(waits[0].detail.includes('sk-device-secret-123456'), false);
  assert.equal(waits[0].detail.includes('[redacted]'), true);
});

console.log(`\n${passed} model-config tests passed.`);
