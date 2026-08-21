/**
 * Riki 剧情工作台的设备级模型配置与请求适配层。
 *
 * 运行时依赖（全部按能力探测）：
 * - Tavern Helper 4.8.19 声明面的 generateRaw / stopGenerationById；
 * - SillyTavern ConnectionManagerRequestService；
 * - 浏览器 fetch、extensionSettings 与 localStorage。
 *
 * 这个模块有意不接触任何聊天级持久化对象。完整 API 配置（尤其 Key）
 * 只能留在设备级设置或设备本地存储中。
 */

export const RIKI_MODEL_MODULE_IDS = Object.freeze([
  'main',
  'outline',
  'act',
  'chapter',
  'character',
  'progression_preset',
  'format_guard',
]);

export const RIKI_MODEL_LIBRARY_STORAGE_KEY = 'riki_story_workbench_model_library_v1';

const RIKI_MODEL_LIBRARY_EXTENSION_KEY = 'rikiStoryWorkbenchModelLibrary';
const RIKI_MODEL_LIBRARY_VERSION = 1;
const RIKI_DEFAULT_TIMEOUT_MS = 180_000;
const RIKI_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RIKI_VALID_TRANSPORTS = new Set(['tavern', 'profile', 'direct']);
const RIKI_VALID_STRUCTURED_OUTPUT = new Set(['auto', 'force', 'off']);
const RIKI_VOLATILE_LIBRARIES = new WeakMap();
let rikiFallbackVolatileLibrary = null;

const RIKI_MODULE_SYSTEM_PRESETS = Object.freeze({
  main: 'builtin_controller',
  outline: 'builtin_outline',
  act: 'builtin_act',
  chapter: 'builtin_chapter',
  character: 'builtin_character',
  progression_preset: 'builtin_progression_preset',
  format_guard: 'builtin_format_guard',
});

const RIKI_BUILTIN_SYSTEM_PRESETS = Object.freeze([
  Object.freeze({
    id: 'builtin_controller',
    name: 'Riki · 主控路由（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 剧情策划主控。先识别用户是在讨论、修改还是生成正式成果，再选择最合适的策划模块。',
      '保持已确认事实、世界规则和玩家选择权；不要把计划当成已经发生的事实，也不要替玩家做决定。',
      '输出可执行的结论、必要依据、尚待确认项和下一步。不要披露内部推理过程。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_outline',
    name: 'Riki · 总纲策划（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 总纲策划 Agent。根据用户目标与给定世界书，建立题材定位、核心矛盾、因果主线、阶段回报、伏笔回收窗口和可选结局。',
      '明确区分已确认事实、策划提案和仍需用户决定的分支；设定冲突时指出冲突，不擅自覆盖来源。',
      '人物用目标和行动推动剧情，章节节点应产生可观察的局势变化，并为自由探索保留空间。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_act',
    name: 'Riki · 大章策划（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 大章策划 Agent。把已确认总纲拆成阶段目标、主要阻力、转折、代价、阶段结果与下章衔接。',
      '为每个大章提供稳定且可复用的 actId；后续引用必须原样使用，不能偷偷改名或重编号。',
      '每个目标都应有可观察的完成条件；可选路线不得被写成唯一必经流程。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_chapter',
    name: 'Riki · 小章策划（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 小章策划 Agent。把已确认大章展开为连续章节，标明时间范围、出场人物作用、事件诱因、阻力、意外、后果与章末钩子。',
      '为每章提供稳定 chapterId，并逐字复用所属 actId；知识边界、资源变化和人物关系变化必须前后一致。',
      '日常支线可以提供质感和局部回报，但不能替代主线结果，也不能替玩家决定关键行动。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_character',
    name: 'Riki · 人物策划（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 人物策划 Agent。只依据现有证据判断人物重要度，补全外貌锚点、行为化性格、关系、动机、底线、知识边界与阶段作用。',
      '不要因为一次出场就把路人升级成长期核心人物；新增设定要标为提案，并说明它服务于哪段剧情。',
      '人物选择必须符合其已知信息、能力、利益和经历，冲突变化要有可追踪原因。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_progression_preset',
    name: 'Riki · 推进预设（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 推进预设策划 Agent。把节奏偏好、自由探索边界、防剧透规则、连续性提醒和阶段触发条件整理成可确认、可导出的剧情规则成果。',
      '预设只描述策划规则，不声称已写入任何运行系统，也不自动推进故事。',
      '始终保留玩家选择权；幕后信息与玩家可见信息必须分开标注。',
    ].join('\n'),
  }),
  Object.freeze({
    id: 'builtin_format_guard',
    name: 'Riki · 格式编译（内置）',
    source: 'builtin',
    contentVersion: '1',
    content: [
      '你是 Riki 格式编译 Agent。只把已经确认的 source_draft 映射到目标 Schema。',
      '不得增加、删减或改写事实；缺失字段应明确留空或报告缺失，不能猜测补全。',
      '只输出目标格式和必要的格式错误说明，不输出创作建议或内部推理过程。',
    ].join('\n'),
  }),
]);

function rikiText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function rikiArray(value) {
  return Array.isArray(value) ? value : [];
}

function rikiClone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function rikiNow() {
  return new Date().toISOString();
}

function rikiId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function rikiClampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function rikiUniqueStrings(values) {
  return [...new Set(rikiArray(values).map(value => rikiText(value).trim()).filter(Boolean))];
}

function rikiEnvironmentKey(environment) {
  if (environment && typeof environment === 'object') return environment;
  if (globalThis && typeof globalThis === 'object') return globalThis;
  return null;
}

function rikiWindows(environment = {}) {
  const windows = [];
  const add = value => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || windows.includes(value)) return;
    windows.push(value);
  };
  add(environment.hostWindow);
  add(environment.startWindow);
  try { add(environment.startWindow?.parent); } catch (_) {}
  try { add(globalThis.window); } catch (_) {}
  return windows;
}

function rikiContext(environment = {}) {
  try {
    if (typeof environment.context === 'function') return environment.context() || null;
    if (environment.context && typeof environment.context === 'object') return environment.context;
  } catch (_) {}
  for (const owner of rikiWindows(environment)) {
    try {
      const context = owner?.SillyTavern?.getContext?.();
      if (context) return context;
    } catch (_) {}
  }
  return null;
}

function rikiRuntimeFunction(environment, name) {
  if (typeof environment?.[name] === 'function') return environment[name].bind(environment);
  if (typeof environment?.adapter?.[name] === 'function') return environment.adapter[name].bind(environment.adapter);
  for (const owner of rikiWindows(environment)) {
    try {
      if (typeof owner?.[name] === 'function') return owner[name].bind(owner);
      if (typeof owner?.TavernHelper?.[name] === 'function') return owner.TavernHelper[name].bind(owner.TavernHelper);
    } catch (_) {}
  }
  return null;
}

function rikiFetcher(environment = {}) {
  if (typeof environment.fetch === 'function') return environment.fetch.bind(environment);
  for (const owner of rikiWindows(environment)) {
    try { if (typeof owner?.fetch === 'function') return owner.fetch.bind(owner); } catch (_) {}
  }
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
}

function rikiStorageTargets(environment = {}) {
  const targets = [];
  const add = storage => {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || targets.includes(storage)) return;
    targets.push(storage);
  };
  try { add(environment.storage); } catch (_) {}
  try { add(environment.localStorage); } catch (_) {}
  for (const owner of rikiWindows(environment)) {
    try { add(owner.localStorage); } catch (_) {}
  }
  return targets;
}

function rikiExtensionHolder(environment = {}) {
  const context = rikiContext(environment);
  const holder = environment.extensionSettings || context?.extensionSettings;
  if (!holder || typeof holder !== 'object') return null;
  if (typeof environment.saveSettings === 'function') {
    return { holder, saver: environment.saveSettings.bind(environment) };
  }
  const saver = context?.saveSettingsDebounced || context?.saveSettings;
  return { holder, saver: typeof saver === 'function' ? saver.bind(context) : null };
}

function rikiSetVolatileLibrary(environment, library) {
  const key = rikiEnvironmentKey(environment);
  if (key) RIKI_VOLATILE_LIBRARIES.set(key, rikiClone(library));
  else rikiFallbackVolatileLibrary = rikiClone(library);
}

function rikiGetVolatileLibrary(environment) {
  const key = rikiEnvironmentKey(environment);
  return key ? RIKI_VOLATILE_LIBRARIES.get(key) || null : rikiFallbackVolatileLibrary;
}

function rikiReadStoredValue(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

export function rikiNormalizeApiPreset(preset = {}, index = 0) {
  const transport = RIKI_VALID_TRANSPORTS.has(preset.transport) ? preset.transport : 'tavern';
  const normalized = {
    id: rikiText(preset.id).trim() || rikiId(`api-${index + 1}`),
    name: rikiText(preset.name).trim() || `API 配置 ${index + 1}`,
    transport,
    endpoint: transport === 'direct' ? rikiText(preset.endpoint).trim() : '',
    apiKey: transport === 'direct' ? rikiText(preset.apiKey) : '',
    model: rikiText(preset.model).trim(),
    profileId: transport === 'profile' ? rikiText(preset.profileId).trim() : '',
    viaBackend: transport === 'direct' && preset.viaBackend === true,
    temperature: rikiClampNumber(preset.temperature, 0, 2, 0.7),
    maxTokens: Math.round(rikiClampNumber(preset.maxTokens, 256, 200_000, 16_000)),
    structuredOutput: RIKI_VALID_STRUCTURED_OUTPUT.has(preset.structuredOutput) ? preset.structuredOutput : 'auto',
  };
  return normalized;
}

export function rikiNormalizeSystemPreset(preset = {}, index = 0) {
  const source = preset.source === 'builtin'
    ? 'builtin'
    : preset.source === 'tavern-snapshot'
      ? 'tavern-snapshot'
      : 'manual';
  return {
    id: rikiText(preset.id).trim() || rikiId(`system-${index + 1}`),
    name: rikiText(preset.name).trim() || `Agent System 预设 ${index + 1}`,
    content: rikiText(preset.content).trim(),
    source,
    contentVersion: rikiText(preset.contentVersion).trim() || '1',
    updatedAt: rikiText(preset.updatedAt).trim() || rikiNow(),
  };
}

function rikiTavernApiPreset() {
  return rikiNormalizeApiPreset({
    id: 'tavern-current',
    name: '酒馆当前连接',
    transport: 'tavern',
    model: '',
    temperature: 0.7,
    maxTokens: 16_000,
    structuredOutput: 'auto',
  });
}

export function rikiDefaultModelLibrary() {
  return {
    version: RIKI_MODEL_LIBRARY_VERSION,
    activeApiPresetId: 'tavern-current',
    activeSystemPresetId: '',
    apiPresets: [rikiTavernApiPreset()],
    systemPresets: RIKI_BUILTIN_SYSTEM_PRESETS.map(preset => rikiNormalizeSystemPreset(preset)),
  };
}

export function rikiNormalizeModelLibrary(library = {}) {
  const apiPresets = rikiArray(library.apiPresets).map(rikiNormalizeApiPreset);
  const tavernIndex = apiPresets.findIndex(preset => preset.id === 'tavern-current');
  if (tavernIndex < 0) apiPresets.unshift(rikiTavernApiPreset());
  else {
    const stored = apiPresets[tavernIndex];
    apiPresets[tavernIndex] = rikiNormalizeApiPreset({
      ...rikiTavernApiPreset(),
      model: stored.model,
      temperature: stored.temperature,
      maxTokens: stored.maxTokens,
      structuredOutput: stored.structuredOutput,
    });
  }

  const systemPresets = rikiArray(library.systemPresets).map(rikiNormalizeSystemPreset);
  for (const builtin of RIKI_BUILTIN_SYSTEM_PRESETS) {
    if (!systemPresets.some(preset => preset.id === builtin.id)) systemPresets.unshift(rikiNormalizeSystemPreset(builtin));
  }

  const requestedApiId = rikiText(library.activeApiPresetId).trim();
  const requestedSystemId = rikiText(library.activeSystemPresetId).trim();
  return {
    version: RIKI_MODEL_LIBRARY_VERSION,
    activeApiPresetId: apiPresets.some(preset => preset.id === requestedApiId) ? requestedApiId : 'tavern-current',
    activeSystemPresetId: systemPresets.some(preset => preset.id === requestedSystemId) ? requestedSystemId : '',
    apiPresets,
    systemPresets,
  };
}

export function rikiLoadModelLibrary(environment = {}) {
  let source = null;
  const extension = rikiExtensionHolder(environment);
  if (extension) source = rikiReadStoredValue(extension.holder[RIKI_MODEL_LIBRARY_EXTENSION_KEY]);
  if (!source) {
    for (const storage of rikiStorageTargets(environment)) {
      try {
        source = rikiReadStoredValue(storage.getItem(RIKI_MODEL_LIBRARY_STORAGE_KEY));
        if (source) break;
      } catch (_) {}
    }
  }
  if (!source) source = rikiGetVolatileLibrary(environment);
  const normalized = rikiNormalizeModelLibrary(source || rikiDefaultModelLibrary());
  rikiSetVolatileLibrary(environment, normalized);
  return normalized;
}

export function rikiSaveModelLibrary(environment = {}, library = {}) {
  const normalized = rikiNormalizeModelLibrary(library);
  rikiSetVolatileLibrary(environment, normalized);

  const extension = rikiExtensionHolder(environment);
  if (extension) {
    try {
      extension.holder[RIKI_MODEL_LIBRARY_EXTENSION_KEY] = rikiClone(normalized);
      const saveResult = extension.saver?.();
      if (saveResult && typeof saveResult.catch === 'function') saveResult.catch(() => {});
    } catch (_) {}
  }
  const serialized = JSON.stringify(normalized);
  for (const storage of rikiStorageTargets(environment)) {
    try { storage.setItem(RIKI_MODEL_LIBRARY_STORAGE_KEY, serialized); } catch (_) {}
  }
  return normalized;
}

export function rikiUpsertApiPreset(library, preset) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const normalizedPreset = rikiNormalizeApiPreset(preset, normalizedLibrary.apiPresets.length);
  const index = normalizedLibrary.apiPresets.findIndex(item => item.id === normalizedPreset.id);
  if (index >= 0) normalizedLibrary.apiPresets[index] = normalizedPreset;
  else normalizedLibrary.apiPresets.push(normalizedPreset);
  return normalizedLibrary;
}

export function rikiDeleteApiPreset(library, presetId) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const id = rikiText(presetId).trim();
  if (!id || id === 'tavern-current') return normalizedLibrary;
  normalizedLibrary.apiPresets = normalizedLibrary.apiPresets.filter(preset => preset.id !== id);
  if (normalizedLibrary.activeApiPresetId === id) normalizedLibrary.activeApiPresetId = 'tavern-current';
  return normalizedLibrary;
}

export function rikiUpsertSystemPreset(library, preset) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const normalizedPreset = rikiNormalizeSystemPreset(preset, normalizedLibrary.systemPresets.length);
  const index = normalizedLibrary.systemPresets.findIndex(item => item.id === normalizedPreset.id);
  if (index >= 0) normalizedLibrary.systemPresets[index] = normalizedPreset;
  else normalizedLibrary.systemPresets.push(normalizedPreset);
  return normalizedLibrary;
}

export function rikiDeleteSystemPreset(library, presetId) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const id = rikiText(presetId).trim();
  if (!id || RIKI_BUILTIN_SYSTEM_PRESETS.some(preset => preset.id === id)) return normalizedLibrary;
  normalizedLibrary.systemPresets = normalizedLibrary.systemPresets.filter(preset => preset.id !== id);
  if (normalizedLibrary.activeSystemPresetId === id) normalizedLibrary.activeSystemPresetId = '';
  return normalizedLibrary;
}

function rikiProjectModelConfig(projectConfig = {}) {
  return projectConfig?.config && typeof projectConfig.config === 'object'
    ? projectConfig.config
    : projectConfig || {};
}

function rikiFindApiPreset(library, presetId) {
  return library.apiPresets.find(preset => preset.id === presetId) || null;
}

function rikiFindSystemPreset(library, presetId) {
  return library.systemPresets.find(preset => preset.id === presetId) || null;
}

export function rikiResolveModuleConfig(projectConfig, moduleId, library = rikiDefaultModelLibrary()) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const config = rikiProjectModelConfig(projectConfig);
  const main = config.main || {};
  const defaults = config.default || {};
  const moduleOverride = config.modules?.[moduleId] || {};
  const layers = moduleId === 'main'
    ? [
        { value: main, source: 'main_override' },
        { value: defaults, source: 'default_override' },
      ]
    : [
        { value: moduleOverride, source: 'module_override' },
        { value: defaults, source: 'default_override' },
        { value: main, source: 'main_override' },
      ];

  const explicitApiLayer = layers.find(layer => rikiText(layer.value.apiPresetId).trim());
  const apiPresetId = rikiText(explicitApiLayer?.value.apiPresetId).trim()
    || normalizedLibrary.activeApiPresetId
    || 'tavern-current';
  const storedApiPreset = rikiFindApiPreset(normalizedLibrary, apiPresetId)
    || rikiFindApiPreset(normalizedLibrary, 'tavern-current')
    || rikiTavernApiPreset();

  let model = rikiText(storedApiPreset.model).trim();
  let modelSource = 'api_preset';
  for (const layer of layers) {
    const layerModel = rikiText(layer.value.model).trim();
    if (layerModel) {
      model = layerModel;
      modelSource = layer.source;
      break;
    }
    const layerApiPresetId = rikiText(layer.value.apiPresetId).trim();
    if (layerApiPresetId) {
      model = rikiText(rikiFindApiPreset(normalizedLibrary, layerApiPresetId)?.model || storedApiPreset.model).trim();
      modelSource = 'api_preset';
      break;
    }
  }

  const explicitSystemId = rikiText(layers.find(layer => rikiText(layer.value.systemPresetId).trim())?.value.systemPresetId).trim();
  const systemPresetId = explicitSystemId
    || normalizedLibrary.activeSystemPresetId
    || RIKI_MODULE_SYSTEM_PRESETS[moduleId]
    || '';
  const systemPreset = rikiFindSystemPreset(normalizedLibrary, systemPresetId);

  return {
    apiPresetId: storedApiPreset.id,
    apiPreset: { ...storedApiPreset, model },
    model,
    modelSource,
    systemPresetId: systemPreset?.id || '',
    systemPreset,
  };
}

export function rikiResolveCompilerConfig(projectConfig, targetModuleId, library = rikiDefaultModelLibrary()) {
  const normalizedLibrary = rikiNormalizeModelLibrary(library);
  const inherited = rikiResolveModuleConfig(projectConfig, targetModuleId, normalizedLibrary);
  const config = rikiProjectModelConfig(projectConfig);
  const override = config.modules?.format_guard || {};
  const explicitApiPresetId = rikiText(override.apiPresetId).trim();
  const apiPresetId = explicitApiPresetId || inherited.apiPresetId;
  const storedApiPreset = rikiFindApiPreset(normalizedLibrary, apiPresetId)
    || rikiFindApiPreset(normalizedLibrary, 'tavern-current')
    || inherited.apiPreset;
  const explicitModel = rikiText(override.model).trim();
  const model = explicitModel
    || (explicitApiPresetId ? rikiText(storedApiPreset.model).trim() : inherited.model)
    || rikiText(storedApiPreset.model).trim();
  const modelSource = explicitModel
    ? 'format_guard_override'
    : explicitApiPresetId
      ? 'api_preset'
      : `inherit:${inherited.modelSource}`;
  const systemPresetId = rikiText(override.systemPresetId).trim() || inherited.systemPresetId;
  const systemPreset = rikiFindSystemPreset(normalizedLibrary, systemPresetId) || inherited.systemPreset || null;
  return {
    apiPresetId: storedApiPreset.id,
    apiPreset: { ...storedApiPreset, model },
    model,
    modelSource,
    systemPresetId: systemPreset?.id || '',
    systemPreset,
    inheritedFromModuleId: targetModuleId,
  };
}

function rikiConnectionManager(environment = {}) {
  if (environment.connectionManagerService) return environment.connectionManagerService;
  return rikiContext(environment)?.ConnectionManagerRequestService || null;
}

function rikiRawConnectionProfiles(environment = {}) {
  const service = rikiConnectionManager(environment);
  try {
    const supported = service?.getSupportedProfiles?.();
    if (Array.isArray(supported) && supported.length) return supported.filter(profile => profile?.id);
  } catch (_) {}
  return rikiArray(rikiContext(environment)?.extensionSettings?.connectionManager?.profiles).filter(profile => profile?.id);
}

function rikiRedactUrl(value) {
  const raw = rikiText(value).trim();
  if (!raw) return '';
  try {
    const base = typeof globalThis.location?.href === 'string' ? globalThis.location.href : 'https://riki.invalid/';
    const url = new URL(raw, base);
    if (url.username) url.username = '[redacted]';
    if (url.password) url.password = '[redacted]';
    for (const key of [...url.searchParams.keys()]) {
      if (/key|token|secret|auth|password/i.test(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.origin === 'https://riki.invalid' ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch (_) {
    return raw
      .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[redacted]@')
      .replace(/([?&](?:key|token|secret|auth|password)=)[^&#\s]*/gi, '$1[redacted]');
  }
}

function rikiRedactText(value, secrets = []) {
  let result = rikiText(value);
  for (const secret of rikiArray(secrets)) {
    const text = rikiText(secret);
    if (text) result = result.split(text).join('[redacted]');
  }
  return result
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;"'}]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted]');
}

function rikiPublicProfile(profile) {
  if (!profile) return null;
  return {
    id: rikiRedactText(profile.id).trim(),
    name: rikiRedactText(profile.name || profile.id).trim(),
    api: rikiRedactText(profile.api).trim(),
    mode: rikiRedactText(profile.mode).trim(),
    model: rikiRedactText(profile.model).trim(),
    models: rikiUniqueStrings(rikiArray(profile.models).map(item => rikiRedactText(typeof item === 'string' ? item : item?.id || item?.name))),
    tavernPreset: rikiRedactText(profile.preset).trim(),
    endpoint: rikiRedactUrl(profile['api-url']),
    credential: profile['secret-id'] ? '酒馆密钥库引用（已隐藏）' : '未绑定酒馆密钥',
  };
}

export function rikiGetConnectionProfiles(environment = {}) {
  return rikiRawConnectionProfiles(environment).map(rikiPublicProfile).filter(profile => profile?.id);
}

export function rikiRedactedRequestDescriptor(resolved = {}, environment = {}) {
  const preset = resolved.apiPreset || {};
  const profile = preset.transport === 'profile'
    ? rikiGetConnectionProfiles(environment).find(item => item.id === preset.profileId) || null
    : null;
  return {
    apiPresetId: rikiRedactText(resolved.apiPresetId || preset.id, [preset.apiKey]).trim(),
    apiPresetName: rikiRedactText(preset.name, [preset.apiKey]).trim(),
    transport: RIKI_VALID_TRANSPORTS.has(preset.transport) ? preset.transport : 'unknown',
    model: rikiRedactText(resolved.model || preset.model || profile?.model, [preset.apiKey]).trim(),
    modelSource: rikiRedactText(resolved.modelSource, [preset.apiKey]).trim(),
    endpoint: preset.transport === 'direct' ? rikiRedactUrl(preset.endpoint) : profile?.endpoint || '',
    profile,
    credential: preset.transport === 'direct'
      ? (preset.apiKey ? 'Riki 设备级 API Key（已隐藏）' : '未配置 Key')
      : preset.transport === 'profile'
        ? profile?.credential || '无明文 Key'
        : '由酒馆当前连接管理',
  };
}

function rikiAddSystemPromptCandidate(candidates, item) {
  if (!item || item.enabled === false) return;
  const role = rikiText(item.role || item.type).toLowerCase();
  if (role !== 'system' && !role.includes('system')) return;
  const content = rikiText(item.content || item.prompt || item.value).trim();
  if (content) candidates.push(content);
}

export function rikiTavernSystemSnapshot(environment = {}) {
  const context = rikiContext(environment);
  const candidates = [];
  const add = item => rikiAddSystemPromptCandidate(candidates, item);

  try { rikiArray(rikiRuntimeFunction(environment, 'getPresetPrompts')?.()).forEach(add); } catch (_) {}
  try {
    const manager = typeof context?.getPresetManager === 'function'
      ? context.getPresetManager('openai') || context.getPresetManager()
      : null;
    let preset = null;
    if (manager && typeof manager.getSelectedPresetName === 'function' && typeof manager.getCompletionPresetByName === 'function') {
      const name = manager.getSelectedPresetName();
      if (name) preset = manager.getCompletionPresetByName(name);
    }
    if (!preset && manager && typeof manager.getSelectedPreset === 'function') {
      const selected = manager.getSelectedPreset();
      if (selected && typeof selected === 'object') preset = selected;
      else {
        const list = manager.getPresetList?.();
        if (Array.isArray(list?.presets) && typeof selected === 'number') preset = list.presets[selected];
      }
    }
    if (preset && Array.isArray(preset.prompts)) {
      const byId = Object.fromEntries(preset.prompts.filter(item => item?.identifier).map(item => [item.identifier, item]));
      const orders = rikiArray(preset.prompt_order);
      const orderEntry = orders.find(item => item?.character_id === 100001)
        || orders.find(item => item?.character_id === 100000)
        || [...orders].sort((left, right) => rikiArray(right?.order).length - rikiArray(left?.order).length)[0];
      const ordered = rikiArray(orderEntry?.order).length
        ? orderEntry.order.filter(item => item?.enabled !== false).map(item => byId[item.identifier]).filter(Boolean)
        : preset.prompts;
      ordered.forEach(add);
    }
  } catch (_) {}

  const sources = [
    context?.powerUserSettings?.context?.preset?.prompts,
    context?.extensionSettings?.prompts,
    context?.promptManager?.serviceSettings?.prompts,
    ...rikiWindows(environment).map(owner => owner?.promptManager?.serviceSettings?.prompts),
  ];
  for (const source of sources) rikiArray(source).forEach(add);
  return rikiUniqueStrings(candidates).join('\n\n').trim();
}

export function rikiCreateTavernSystemPreset(environment = {}, options = {}) {
  const content = rikiTavernSystemSnapshot(environment);
  if (!content) throw new Error('没有从酒馆当前预设中读取到启用的 System 内容');
  return rikiNormalizeSystemPreset({
    id: rikiText(options.id).trim() || rikiId('tavern-system'),
    name: rikiText(options.name).trim() || `酒馆 System 快照 · ${new Date().toLocaleString('zh-CN')}`,
    content,
    source: 'tavern-snapshot',
    contentVersion: '1',
  });
}

export function rikiSaveTavernSystemPreset(environment = {}, library = {}, options = {}) {
  const next = rikiUpsertSystemPreset(library, rikiCreateTavernSystemPreset(environment, options));
  return rikiSaveModelLibrary(environment, next);
}

function rikiAbortError(reason) {
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  const error = new Error(rikiText(reason?.message || reason).trim() || '用户已停止生成');
  error.name = 'AbortError';
  return error;
}

function rikiThrowIfAborted(signal) {
  if (signal?.aborted) throw rikiAbortError(signal.reason);
}

function rikiAbortAwareDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    rikiThrowIfAborted(signal);
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    };
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const timer = setTimeout(finish(resolve), Math.max(0, Number(milliseconds) || 0));
    const onAbort = finish(() => reject(rikiAbortError(signal?.reason)));
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

async function rikiRaceWithAbort(promise, signal, onAbort) {
  rikiThrowIfAborted(signal);
  if (!signal) return promise;
  let listener;
  const aborted = new Promise((_, reject) => {
    listener = () => {
      try { onAbort?.(); } catch (_) {}
      reject(rikiAbortError(signal.reason));
    };
    signal.addEventListener('abort', listener, { once: true });
  });
  try { return await Promise.race([promise, aborted]); }
  finally { signal.removeEventListener('abort', listener); }
}

function rikiNormalizeCompletionUrl(value) {
  const url = rikiText(value).trim().replace(/\/+$/, '');
  if (!url) return '';
  if (/\/chat\/completions$/i.test(url)) return url;
  if (/\/v\d+$/i.test(url)) return `${url}/chat/completions`;
  return `${url}/v1/chat/completions`;
}

function rikiNormalizeModelsUrl(value) {
  const url = rikiText(value).trim().replace(/\/+$/, '');
  if (!url) return '';
  if (/\/chat\/completions$/i.test(url)) return url.replace(/\/chat\/completions$/i, '/models');
  if (/\/models$/i.test(url)) return url;
  if (/\/v\d+$/i.test(url)) return `${url}/models`;
  return `${url}/v1/models`;
}

function rikiExtractCompletionText(result) {
  if (typeof result === 'string') return result.trim();
  const candidates = [
    result?.content,
    result?.message?.content,
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.result?.choices?.[0]?.message?.content,
    result?.data?.choices?.[0]?.message?.content,
    result?.text,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const joined = candidate.map(part => typeof part === 'string' ? part : rikiText(part?.text)).join('').trim();
      if (joined) return joined;
    }
  }
  return '';
}

function rikiExtractInputTokens(value) {
  const usages = [value?.usage, value?.result?.usage, value?.data?.usage, value?.response?.usage];
  for (const usage of usages) {
    const count = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.inputTokens);
    if (Number.isFinite(count) && count >= 0) return Math.round(count);
  }
  return null;
}

function rikiModelNamesFromResponse(data) {
  const list = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : Array.isArray(data)
        ? data
        : [];
  return rikiUniqueStrings(list.map(item => typeof item === 'string' ? item : item?.id || item?.name))
    .sort((left, right) => left.localeCompare(right));
}

function rikiPageProtocol(environment = {}) {
  if (rikiText(environment.location?.protocol)) return rikiText(environment.location.protocol);
  for (const owner of rikiWindows(environment)) {
    try { if (rikiText(owner.location?.protocol)) return rikiText(owner.location.protocol); } catch (_) {}
  }
  return '';
}

export function rikiDiagnoseFetchFailure(error, endpoint = '', environment = {}) {
  if (error?.name === 'AbortError') return rikiAbortError(error);
  const message = rikiRedactText(error?.message || error);
  const mixedContent = rikiPageProtocol(environment) === 'https:' && /^http:\/\//i.test(rikiText(endpoint));
  const prefix = mixedContent ? 'HTTPS 页面请求了 HTTP 地址，浏览器会拦截混合内容' : '浏览器未能完成网络请求';
  return new Error(`${prefix}（Failed to fetch）：请依次检查端点是否允许 CORS、是否存在 HTTPS/HTTP 混合内容，以及当前设备或网络是否能访问该地址。脚本不会静默切换传输方式${message ? `。原始提示：${message}` : ''}`);
}

async function rikiReadErrorBody(response, secrets = []) {
  try { return rikiRedactText((await response.text()).slice(0, 500), secrets); }
  catch (_) { return ''; }
}

async function rikiFetchResponse(environment, url, init, secrets = []) {
  const fetcher = rikiFetcher(environment);
  if (!fetcher) throw new Error('当前环境没有可用的 fetch；请手动填写模型或改用酒馆连接');
  try { return await fetcher(url, init); }
  catch (error) {
    if (init?.signal?.aborted) throw rikiAbortError(init.signal.reason);
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(rikiText(error?.message || error))) {
      throw rikiDiagnoseFetchFailure(error, url, environment);
    }
    throw new Error(rikiRedactText(error?.message || error, secrets));
  }
}

function rikiCurrentTavernModelNames(environment = {}) {
  const context = rikiContext(environment);
  const values = [
    environment.currentModel,
    context?.model,
    context?.chatCompletionSettings?.openai_model,
    context?.chatCompletionSettings?.model,
    context?.powerUserSettings?.model,
    ...rikiWindows(environment).flatMap(owner => [
      owner?.openai_settings?.openai_model,
      owner?.openai_settings?.custom_model,
      owner?.textgenerationwebui_settings?.model,
      owner?.online_status,
    ]),
  ];
  return rikiUniqueStrings(values);
}

export async function rikiFetchModels(environment = {}, preset = {}, signal) {
  const normalized = rikiNormalizeApiPreset(preset);
  rikiThrowIfAborted(signal);

  if (normalized.transport === 'tavern') {
    const getter = rikiRuntimeFunction(environment, 'getModelList');
    if (getter) {
      try {
        const names = rikiUniqueStrings(await getter({})).sort((left, right) => left.localeCompare(right));
        if (names.length) return names;
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(signal?.reason || error);
      }
    }
    const localNames = rikiCurrentTavernModelNames(environment);
    if (localNames.length) return localNames;
    throw new Error('酒馆当前连接没有暴露可读取的模型列表；可以保留空模型以沿用酒馆当前模型，或手动填写模型覆盖');
  }

  if (normalized.transport === 'profile') {
    const rawProfile = rikiRawConnectionProfiles(environment).find(profile => rikiText(profile.id) === normalized.profileId);
    if (!rawProfile) throw new Error('选择的 Connection Manager profile 不存在或当前不受支持');
    const localNames = rikiUniqueStrings([
      normalized.model,
      rawProfile.model,
      ...rikiArray(rawProfile.models).map(item => typeof item === 'string' ? item : item?.id || item?.name),
    ]);
    const context = rikiContext(environment);
    const apiMap = context?.CONNECT_API_MAP?.[rawProfile.api];
    if (apiMap?.selected !== 'openai' || !apiMap?.source) {
      if (localNames.length) return localNames.sort((left, right) => left.localeCompare(right));
      throw new Error('该 profile 没有可读取的模型列表；请手动填写模型名');
    }
    const response = await rikiFetchResponse(environment, '/api/backends/chat-completions/status', {
      method: 'POST',
      signal,
      cache: 'no-cache',
      headers: typeof context?.getRequestHeaders === 'function'
        ? context.getRequestHeaders()
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_completion_source: apiMap.source,
        secret_id: rawProfile['secret-id'],
        custom_url: rikiText(rawProfile['api-url']),
        vertexai_region: rikiText(rawProfile['api-url']),
        zai_endpoint: rikiText(rawProfile['api-url']),
        siliconflow_endpoint: rikiText(rawProfile['api-url']),
        minimax_endpoint: rikiText(rawProfile['api-url']),
      }),
    });
    if (!response.ok) {
      const detail = await rikiReadErrorBody(response);
      throw new Error(`通过 Connection Manager profile 获取模型失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
    const remoteNames = rikiModelNamesFromResponse(await response.json());
    const names = rikiUniqueStrings([...remoteNames, ...localNames]).sort((left, right) => left.localeCompare(right));
    if (!names.length) throw new Error('Connection Manager profile 已响应，但没有返回可识别的模型；请手动填写');
    return names;
  }

  if (normalized.viaBackend) {
    const context = rikiContext(environment);
    if (typeof context?.getRequestHeaders !== 'function') {
      throw new Error('当前酒馆版本无法经后端转发获取独立 API 模型；请关闭“经酒馆后端转发”后使用允许浏览器跨域的网关，或手动填写模型名');
    }
    const modelsUrl = rikiNormalizeModelsUrl(normalized.endpoint);
    if (!modelsUrl) throw new Error('请先填写 OpenAI-compatible 端点 URL，或直接手动填写模型名');
    const response = await rikiFetchResponse(environment, '/api/backends/chat-completions/status', {
      method: 'POST',
      signal,
      cache: 'no-cache',
      headers: context.getRequestHeaders(),
      body: JSON.stringify({
        chat_completion_source: 'custom',
        custom_url: modelsUrl.replace(/\/models\/?$/iu, ''),
        custom_include_headers: JSON.stringify(normalized.apiKey ? { Authorization: `Bearer ${normalized.apiKey}` } : {}),
      }),
    }, [normalized.apiKey]);
    if (!response.ok) {
      const detail = await rikiReadErrorBody(response, [normalized.apiKey]);
      throw new Error(`经酒馆后端获取模型失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
    const data = await response.json();
    const names = rikiModelNamesFromResponse(data);
    if (!names.length) throw new Error('酒馆后端已响应，但没有返回可识别的模型；仍可手动填写模型名');
    return names;
  }
  const url = rikiNormalizeModelsUrl(normalized.endpoint);
  if (!url) throw new Error('请先填写 OpenAI-compatible 端点 URL，或直接手动填写模型名');
  const response = await rikiFetchResponse(environment, url, {
    method: 'GET',
    signal,
    headers: normalized.apiKey ? { Authorization: `Bearer ${normalized.apiKey}` } : {},
  }, [normalized.apiKey]);
  if (!response.ok) {
    const detail = await rikiReadErrorBody(response, [normalized.apiKey]);
    throw new Error(`获取模型失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
  }
  const data = await response.json();
  const names = rikiModelNamesFromResponse(data);
  if (!names.length) throw new Error('服务端没有返回可识别的模型；仍可手动填写模型名');
  return names;
}

function rikiNormalizeMessages(messages) {
  return rikiArray(messages).map(message => {
    const role = ['system', 'user', 'assistant'].includes(message?.role) ? message.role : 'user';
    return { role, content: rikiText(message?.content) };
  }).filter(message => message.content.trim());
}

function rikiMessagesForResolved(resolved, messages, options = {}) {
  const normalized = rikiNormalizeMessages(messages);
  const systemContent = rikiText(resolved?.systemPreset?.content).trim();
  if (options.includeSystemPreset === false || !systemContent) return normalized;
  if (normalized.some(message => message.role === 'system' && message.content.trim() === systemContent)) return normalized;
  return [{ role: 'system', content: systemContent }, ...normalized];
}

function rikiTavernCustomApi(preset, options = {}) {
  const customApi = {
    max_tokens: Math.round(rikiClampNumber(options.maxTokens ?? preset.maxTokens, 256, 200_000, 16_000)),
    temperature: rikiClampNumber(options.temperature ?? preset.temperature, 0, 2, 0.7),
  };
  if (rikiText(preset.model).trim()) customApi.model = rikiText(preset.model).trim();
  return customApi;
}

async function rikiRequestTavern(environment, preset, messages, options = {}) {
  const generateRaw = rikiRuntimeFunction(environment, 'generateRaw');
  if (!generateRaw) throw new Error('当前 Tavern Helper 未提供 generateRaw，无法使用酒馆当前连接');
  const generationId = rikiText(options.generationId).trim() || rikiId('riki-model');
  const stop = () => {
    if (typeof environment?.adapter?.stopGeneration === 'function') return environment.adapter.stopGeneration(generationId);
    return rikiRuntimeFunction(environment, 'stopGenerationById')?.(generationId);
  };
  rikiThrowIfAborted(options.signal);
  const request = Promise.resolve(generateRaw({
    generation_id: generationId,
    should_stream: options.stream !== false,
    should_silence: true,
    ordered_prompts: messages,
    custom_api: rikiTavernCustomApi(preset, options),
  }));
  let result;
  try { result = await rikiRaceWithAbort(request, options.signal, stop); }
  catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(options.signal?.reason || error);
    throw new Error(`酒馆当前连接生成失败：${rikiRedactText(error?.message || error)}`);
  }
  const text = rikiExtractCompletionText(result);
  if (!text) throw new Error('酒馆当前连接已完成请求，但没有返回文本');
  options.onDelta?.(text, text);
  return {
    text,
    streamed: false,
    fallback: true,
    notice: options.stream === false ? '' : '酒馆连接的流式事件由 Tavern Helper 管理；当前适配层在完成时回填全文。',
    inputTokens: rikiExtractInputTokens(result),
  };
}

async function rikiRequestProfile(environment, preset, messages, options = {}) {
  const service = rikiConnectionManager(environment);
  if (typeof service?.sendRequest !== 'function') throw new Error('当前酒馆没有可用的 ConnectionManagerRequestService.sendRequest');
  if (!rikiText(preset.profileId).trim()) throw new Error('尚未选择 Connection Manager profile');
  const rawProfile = rikiRawConnectionProfiles(environment).find(profile => rikiText(profile.id) === rikiText(preset.profileId));
  const profileSecrets = [rawProfile?.['secret-id']];
  rikiThrowIfAborted(options.signal);

  let generated;
  try {
    generated = await rikiRaceWithAbort(Promise.resolve(service.sendRequest(
      preset.profileId,
      messages,
      Math.round(rikiClampNumber(options.maxTokens ?? preset.maxTokens, 256, 200_000, 16_000)),
      { stream: options.stream !== false, signal: options.signal },
      {
        ...(rikiText(preset.model).trim() ? { model: rikiText(preset.model).trim() } : {}),
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      },
    )), options.signal);
    if (typeof generated === 'function') generated = await generated();
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(options.signal?.reason || error);
    throw new Error(`Connection Manager profile 请求失败：${rikiRedactText(error?.message || error, profileSecrets)}`);
  }

  if (!generated || typeof generated[Symbol.asyncIterator] !== 'function') {
    const text = rikiExtractCompletionText(generated);
    if (!text) throw new Error('Connection Manager profile 没有返回可读取的流或完整文本');
    options.onDelta?.(text, text);
    return { text, streamed: false, fallback: true, inputTokens: rikiExtractInputTokens(generated) };
  }

  let full = '';
  let inputTokens = null;
  try {
    for await (const chunk of generated) {
      rikiThrowIfAborted(options.signal);
      const usage = rikiExtractInputTokens(chunk);
      if (usage !== null) inputTokens = usage;
      const cumulative = typeof chunk?.text === 'string' ? chunk.text : '';
      if (!cumulative) continue;
      const delta = cumulative.startsWith(full) ? cumulative.slice(full.length) : cumulative;
      full = cumulative;
      if (delta) options.onDelta?.(delta, full);
    }
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(options.signal?.reason || error);
    throw new Error(`Connection Manager profile 流式读取失败：${rikiRedactText(error?.message || error, profileSecrets)}`);
  }
  if (!full.trim()) throw new Error('Connection Manager profile 已完成请求，但没有返回文本');
  return { text: full, streamed: true, fallback: false, inputTokens };
}

function rikiSseContent(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(part => typeof part === 'string' ? part : rikiText(part?.text)).join('');
}

function rikiParseOpenAiSseData(payload) {
  const data = rikiText(payload).trim();
  if (!data) return { valid: false, done: false, text: '', inputTokens: null };
  if (data === '[DONE]') return { valid: true, done: true, text: '', inputTokens: null };
  try {
    const json = JSON.parse(data);
    const choice = json?.choices?.[0] || {};
    const text = rikiSseContent(choice?.delta?.content)
      || rikiSseContent(choice?.message?.content)
      || rikiText(choice?.text);
    return { valid: true, done: false, text, inputTokens: rikiExtractInputTokens(json) };
  } catch (_) {
    return { valid: false, done: false, text: '', inputTokens: null };
  }
}

function rikiApplySsePayload(payload, state, options) {
  const parsed = rikiParseOpenAiSseData(payload);
  if (!parsed.valid) return false;
  state.sawSse = true;
  if (parsed.inputTokens !== null) state.inputTokens = parsed.inputTokens;
  if (parsed.text) {
    state.full += parsed.text;
    options.onDelta?.(parsed.text, state.full);
  }
  if (parsed.done) state.done = true;
  return true;
}

function rikiProcessSseBlock(block, state, options, allowLineFallback = false) {
  const dataLines = rikiText(block).split(/\r?\n/)
    .filter(line => line.trimStart().startsWith('data:'))
    .map(line => line.trimStart().slice(5).trimStart());
  if (!dataLines.length) return;
  if (rikiApplySsePayload(dataLines.join('\n'), state, options)) return;
  if (allowLineFallback || dataLines.length > 1) {
    for (const line of dataLines) {
      rikiApplySsePayload(line, state, options);
      if (state.done) break;
    }
  }
}

async function rikiConsumeDirectResponse(response, options = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const raw = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {}
    const text = rikiExtractCompletionText(parsed);
    if (!text) throw new Error('OpenAI-compatible 端点返回成功，但没有可读取的文本');
    options.onDelta?.(text, text);
    return { text, streamed: false, fallback: true, inputTokens: rikiExtractInputTokens(parsed) };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { full: '', inputTokens: null, sawSse: false, done: false };
  let buffer = '';
  let raw = '';
  while (true) {
    rikiThrowIfAborted(options.signal);
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    raw += chunk;
    buffer += chunk;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      rikiProcessSseBlock(block, state, options);
      if (state.done) {
        try { await reader.cancel(); } catch (_) {}
        if (!state.full.trim()) throw new Error('OpenAI-compatible 端点只返回了结束标记，没有文本内容');
        return { text: state.full, streamed: true, fallback: false, inputTokens: state.inputTokens };
      }
    }
  }
  const tail = decoder.decode();
  if (tail) { raw += tail; buffer += tail; }
  if (buffer.trim()) rikiProcessSseBlock(buffer, state, options, true);
  if (state.sawSse && state.full.trim()) {
    return { text: state.full, streamed: true, fallback: false, inputTokens: state.inputTokens };
  }
  if (!state.sawSse) {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {}
    const text = rikiExtractCompletionText(parsed);
    if (text) {
      options.onDelta?.(text, text);
      return { text, streamed: false, fallback: true, inputTokens: rikiExtractInputTokens(parsed) };
    }
  }
  throw new Error('OpenAI-compatible 端点返回成功，但没有有效 SSE 事件或完整文本');
}

function rikiDirectRequestBody(preset, messages, options) {
  return {
    model: rikiText(preset.model).trim(),
    messages,
    stream: true,
    temperature: rikiClampNumber(options.temperature ?? preset.temperature, 0, 2, 0.7),
    max_tokens: Math.round(rikiClampNumber(options.maxTokens ?? preset.maxTokens, 256, 200_000, 16_000)),
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
  };
}

function rikiBackendForwardPayload(preset, url, messages, options) {
  const body = rikiDirectRequestBody(preset, messages, options);
  return {
    chat_completion_source: 'custom',
    custom_url: url.replace(/\/chat\/completions\/?$/iu, ''),
    custom_include_headers: JSON.stringify(preset.apiKey ? { Authorization: `Bearer ${preset.apiKey}` } : {}),
    ...body,
    stream: true,
  };
}

async function rikiRequestDirectViaBackend(environment, preset, url, messages, options = {}) {
  const context = rikiContext(environment);
  const service = environment.chatCompletionService || context?.ChatCompletionService;
  if (typeof service?.processRequest !== 'function') {
    throw new Error('当前酒馆版本缺少 ChatCompletionService，无法经后端转发独立 API；请关闭“经酒馆后端转发”，或改用 Connection Manager profile');
  }
  rikiThrowIfAborted(options.signal);
  let generated;
  try {
    generated = await rikiRaceWithAbort(Promise.resolve(service.processRequest(
      rikiBackendForwardPayload(preset, url, messages, options),
      { presetName: undefined },
      true,
      options.signal,
    )), options.signal);
    if (typeof generated === 'function') generated = await generated();
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(options.signal?.reason || error);
    throw new Error(`独立 API 经酒馆后端转发失败：${rikiRedactText(error?.message || error, [preset.apiKey])}`);
  }
  if (!generated || typeof generated[Symbol.asyncIterator] !== 'function') {
    const complete = rikiExtractCompletionText(generated);
    if (!complete) throw new Error('酒馆后端转发没有返回可读取的流或完整文本');
    options.onDelta?.(complete, complete);
    return { text: complete, streamed: false, fallback: true, viaBackend: true, inputTokens: rikiExtractInputTokens(generated) };
  }
  let full = '';
  let inputTokens = null;
  try {
    for await (const chunk of generated) {
      rikiThrowIfAborted(options.signal);
      const usage = rikiExtractInputTokens(chunk);
      if (usage !== null) inputTokens = usage;
      const cumulative = typeof chunk?.text === 'string' ? chunk.text : rikiExtractCompletionText(chunk);
      if (!cumulative) continue;
      const delta = cumulative.startsWith(full) ? cumulative.slice(full.length) : cumulative;
      full = cumulative.startsWith(full) ? cumulative : `${full}${cumulative}`;
      if (delta) options.onDelta?.(delta, full);
    }
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw rikiAbortError(options.signal?.reason || error);
    throw new Error(`独立 API 酒馆后端流读取失败：${rikiRedactText(error?.message || error, [preset.apiKey])}`);
  }
  if (!full.trim()) throw new Error('酒馆后端转发已完成，但没有返回文本');
  return { text: full, streamed: true, fallback: false, viaBackend: true, inputTokens };
}

async function rikiRequestDirect(environment, preset, messages, options = {}) {
  const url = rikiNormalizeCompletionUrl(preset.endpoint);
  if (!url) throw new Error('独立 OpenAI-compatible API 尚未填写端点 URL');
  if (!rikiText(preset.model).trim()) throw new Error('独立 OpenAI-compatible API 尚未填写模型');
  if (preset.viaBackend) return rikiRequestDirectViaBackend(environment, preset, url, messages, options);
  rikiThrowIfAborted(options.signal);

  const requestController = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => requestController.abort(options.signal?.reason);
  options.signal?.addEventListener?.('abort', onExternalAbort, { once: true });
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || RIKI_DEFAULT_TIMEOUT_MS);
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort(new Error('request timeout'));
  }, timeoutMs);

  try {
    const maxAttempts = Math.max(1, Math.min(3, Number.isFinite(Number(options.maxAttempts)) ? Number(options.maxAttempts) : 2));
    const retryDelayMs = Math.max(0, Number.isFinite(Number(options.retryDelayMs)) ? Number(options.retryDelayMs) : 10_000);
    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      response = await rikiFetchResponse(environment, url, {
        method: 'POST',
        signal: requestController.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(preset.apiKey ? { Authorization: `Bearer ${preset.apiKey}` } : {}),
        },
        body: JSON.stringify(rikiDirectRequestBody(preset, messages, options)),
      }, [preset.apiKey]);
      if (response.ok) break;

      const detail = await rikiReadErrorBody(response, [preset.apiKey]);
      if (options.responseFormat && [400, 404, 422].includes(Number(response.status))) {
        throw new Error(`OpenAI-compatible 端点拒绝 response_format/json_schema：HTTP ${response.status}${detail ? ` · ${detail}` : ''}；请关闭结构化输出或改用兼容模式`);
      }
      if (attempt < maxAttempts && RIKI_RETRYABLE_STATUS.has(Number(response.status))) {
        options.onRetryWait?.({ attempt, status: Number(response.status), delayMs: retryDelayMs, detail });
        await rikiAbortAwareDelay(retryDelayMs, requestController.signal);
        continue;
      }
      throw new Error(`OpenAI-compatible 请求失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}${attempt > 1 ? `（共尝试 ${attempt} 次）` : ''}`);
    }
    return await rikiConsumeDirectResponse(response, { ...options, signal: requestController.signal });
  } catch (error) {
    if (timedOut) throw new Error(`OpenAI-compatible 请求超过 ${Math.round(timeoutMs / 1000)} 秒无响应，已停止；请检查端点可达性、模型状态或网关限速`);
    if (options.signal?.aborted || (requestController.signal.aborted && error?.name === 'AbortError')) {
      throw rikiAbortError(options.signal?.reason || error);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener?.('abort', onExternalAbort);
  }
}

export async function rikiRequestModel(environment = {}, resolved = {}, messages = [], options = {}) {
  const rawTransport = resolved?.apiPreset?.transport;
  if (rawTransport && !RIKI_VALID_TRANSPORTS.has(rawTransport)) {
    throw new Error(`不支持的模型传输方式：${rikiRedactText(rawTransport)}`);
  }
  const basePreset = rikiNormalizeApiPreset(resolved.apiPreset || {});
  const preset = { ...basePreset, model: rikiText(resolved.model || basePreset.model).trim() };
  const preparedMessages = rikiMessagesForResolved(resolved, messages, options);
  if (!preparedMessages.length) throw new Error('模型请求没有可发送的消息');
  const startedAt = rikiNow();
  let result;
  if (preset.transport === 'tavern') result = await rikiRequestTavern(environment, preset, preparedMessages, options);
  else if (preset.transport === 'profile') result = await rikiRequestProfile(environment, preset, preparedMessages, options);
  else if (preset.transport === 'direct') result = await rikiRequestDirect(environment, preset, preparedMessages, options);
  else throw new Error(`不支持的模型传输方式：${rikiText(preset.transport)}`);

  return {
    ...result,
    transport: preset.transport,
    model: preset.model,
    apiPresetId: rikiText(resolved.apiPresetId || preset.id),
    startedAt,
    endedAt: rikiNow(),
    descriptor: rikiRedactedRequestDescriptor({ ...resolved, apiPreset: preset }, environment),
  };
}
