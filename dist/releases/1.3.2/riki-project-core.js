/* Riki Story Workbench 1.3.2 | generated from src/riki-project-core.js */
/**
 * Riki Story Workbench project state machine.
 *
 * This module is deliberately host-agnostic: no SillyTavern globals, storage,
 * network calls, database runtime, or secondary-creation engine.  Callers own
 * persistence and UI.  The data mutators below keep the proven Riki 2.2 flow
 * (branches, messages, modes, proposals, versions, recycle bin, logs, import)
 * while limiting v1.2 to the four user-approved story-planning artifacts.
 */

export const RIKI_PROJECT_SCHEMA_VERSION = 1;
export const RIKI_PROJECT_EXPORT_FORMAT = 'riki_story_project_v2';
export const RIKI_PROJECT_REQUEST_LOG_LIMIT = 30;
export const RIKI_PROJECT_REQUEST_LOG_CHAR_LIMIT = 2_000_000;
export const RIKI_PROJECT_DECISION_LIMIT = 500;

export const RIKI_PROJECT_MODULES = Object.freeze({
  main: Object.freeze({ label: '主控 Agent', artifactKind: '', utility: true }),
  outline: Object.freeze({ label: '总纲 Agent', artifactKind: 'outline' }),
  act: Object.freeze({ label: '大章 Agent', artifactKind: 'acts' }),
  chapter: Object.freeze({ label: '小章 Agent', artifactKind: 'chapters' }),
  character: Object.freeze({ label: '人物 Agent', artifactKind: 'characters' }),
  format_guard: Object.freeze({ label: '格式编译 Agent', artifactKind: '', utility: true }),
});

export const RIKI_PROJECT_ARTIFACT_KINDS = Object.freeze([
  'outline', 'acts', 'chapters', 'characters',
]);

export const RIKI_PROJECT_STAGES = Object.freeze([
  'discovery', 'outline_short', 'outline_final', 'acts_split', 'acts_detail',
  'chapters', 'characters', 'ready',
]);

export const RIKI_PROJECT_STAGE_LABELS = Object.freeze({
  discovery: '需求访谈',
  outline_short: '简短大纲',
  outline_final: '正式总纲',
  acts_split: '大章拆分',
  acts_detail: '大章设计',
  chapters: '小章设计',
  characters: '人物设计',
  ready: '策划完成',
});

export const RIKI_PROJECT_STRATEGY_MODES = Object.freeze({
  detailed: Object.freeze({ label: '常规版', legacyAliases: ['normal'] }),
  brief: Object.freeze({ label: '粗略版', legacyAliases: ['rough'] }),
  lazy: Object.freeze({ label: '懒人版', legacyAliases: [] }),
});

export const RIKI_PROJECT_ARTIFACT_DEPENDENCIES = Object.freeze({
  outline: Object.freeze(['acts', 'chapters', 'characters']),
  acts: Object.freeze(['chapters', 'characters']),
  chapters: Object.freeze(['characters']),
  characters: Object.freeze([]),
});

export const RIKI_PROJECT_LAZY_STEPS = Object.freeze([
  Object.freeze({ kind: 'outline', moduleId: 'outline', task: 'outline_final' }),
  Object.freeze({ kind: 'acts', moduleId: 'act', task: 'acts_generate' }),
  Object.freeze({ kind: 'chapters', moduleId: 'chapter', task: 'chapters_generate' }),
  Object.freeze({ kind: 'characters', moduleId: 'character', task: 'characters_generate' }),
]);

const SENSITIVE_KEY_NAMES = new Set([
  'apikey', 'authorization', 'password', 'proxypassword', 'clientsecret',
  'apisecret', 'accesstoken', 'refreshtoken', 'bearertoken', 'xapikey',
]);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSensitiveKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(value) {
  const normalized = normalizeSensitiveKey(value);
  return SENSITIVE_KEY_NAMES.has(normalized)
    || normalized.endsWith('apikey')
    || normalized.endsWith('authorization')
    || normalized.endsWith('accesstoken')
    || normalized.endsWith('refreshtoken')
    || normalized.endsWith('clientsecret')
    || normalized.endsWith('apisecret')
    || normalized.endsWith('apitoken')
    || normalized.endsWith('authtoken')
    || normalized.endsWith('idtoken')
    || normalized.endsWith('privatekey')
    || normalized.endsWith('secretkey')
    || normalized.endsWith('secretaccesskey')
    || normalized.endsWith('signingkey')
    || normalized.endsWith('credential')
    || normalized.endsWith('credentials');
}

function isUnsafeObjectKey(value) {
  return ['__proto__', 'prototype', 'constructor'].includes(text(value));
}

function redactSecretText(value) {
  return text(value)
    .replace(/-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(sk|rk|pk)-[a-z0-9_-]{8,}\b/gi, '[REDACTED_API_KEY]')
    .replace(/\bhf_[a-z0-9]{8,}\b/gi, '[REDACTED_API_TOKEN]')
    .replace(/\bAIza[a-z0-9_-]{20,}\b/gi, '[REDACTED_API_KEY]')
    .replace(/\b(?:github_pat_|ghp_|glpat-|xox[baprs]-|npm_|pypi-)[a-z0-9_-]{8,}\b/gi, '[REDACTED_TOKEN]')
    .replace(/\b(Bearer)\s+[a-z0-9._~+\/-]{8,}/gi, '$1 [REDACTED]')
    .replace(/([?&](?:api[_-]?key|access[_-]?token)=)[^&#\s]+/gi, '$1[REDACTED]');
}

export function rikiProjectClone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

export function rikiProjectNow() {
  return new Date().toISOString();
}

function hash(value) {
  let result = 2166136261;
  for (const char of text(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function rikiProjectId(prefix, seed = '') {
  return `${text(prefix, 'id')}_${hash(`${seed}|${Date.now()}|${Math.random()}`)}`;
}

export function rikiProjectSanitizeSecrets(value) {
  const seen = new WeakSet();
  const visit = current => {
    if (typeof current === 'string') return redactSecretText(current);
    if (current === null || current === undefined || typeof current !== 'object') return current;
    if (seen.has(current)) return '[CIRCULAR_REMOVED]';
    seen.add(current);
    if (Array.isArray(current)) return current.map(visit);
    const result = {};
    for (const [key, item] of Object.entries(current)) {
      if (isSensitiveKey(key) || isUnsafeObjectKey(key)) continue;
      result[key] = visit(item);
    }
    return result;
  };
  return visit(value);
}

function touchState(state) {
  if (isRecord(state)) state.updatedAt = rikiProjectNow();
  return state;
}

function touchConversation(conversation) {
  if (isRecord(conversation)) conversation.updatedAt = rikiProjectNow();
  return conversation;
}

function assertModule(moduleId, { allowEmpty = false } = {}) {
  const id = text(moduleId);
  if (allowEmpty && !id) return '';
  if (!Object.hasOwn(RIKI_PROJECT_MODULES, id)) throw new Error(`未知 Agent 模块：${id || '（空）'}`);
  return id;
}

function assertArtifactKind(kind) {
  const id = text(kind);
  if (!RIKI_PROJECT_ARTIFACT_KINDS.includes(id)) throw new Error(`未知成果类型：${id || '（空）'}`);
  return id;
}

function normalizeStrategyMode(value, fallback = '') {
  const mode = text(value).trim().toLowerCase();
  if (Object.hasOwn(RIKI_PROJECT_STRATEGY_MODES, mode)) return mode;
  if (mode === 'normal' || mode === 'detailed') return 'detailed';
  if (mode === 'rough' || mode === 'brief') return 'brief';
  return fallback;
}

function normalizeDetailLevels(value) {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(['outline', 'act', 'chapter'].map(moduleId => [
    moduleId,
    ['concise', 'normal', 'detailed'].includes(source[moduleId]) ? source[moduleId] : 'normal',
  ]));
}

export function rikiProjectCreateContext(overrides = {}) {
  const source = isRecord(overrides) ? overrides : {};
  const requestedDepth = Number(source.mainChatDepth);
  const depth = requestedDepth === -1 ? -1 : Math.max(0, Math.min(200, Number.isFinite(requestedDepth) ? requestedDepth : 12));
  const selectedEntries = isRecord(source.selectedEntries) ? rikiProjectClone(source.selectedEntries) : {};
  const hasSavedSelection = Object.values(selectedEntries).some(ids => array(ids).length > 0);
  const selectionCustomized = source.selectionCustomized === true
    || (!Object.hasOwn(source, 'selectionCustomized') && hasSavedSelection);
  return {
    version: 3,
    mainChatDepth: depth,
    includeCharacterCard: source.includeCharacterCard === true,
    selectedWorldbooks: [...new Set(array(source.selectedWorldbooks).map(item => text(item).trim()).filter(Boolean))],
    selectedEntries,
    initialized: source.initialized === true,
    selectionCustomized,
    projectBookMode: source.projectBookMode === 'original' ? 'original' : 'own',
  };
}

export function rikiProjectCreateConversation(title = '', options = {}) {
  const stamp = rikiProjectNow();
  const mode = normalizeStrategyMode(options.strategyMode, '');
  return {
    id: text(options.id || rikiProjectId('conversation', title || stamp)),
    title: text(title).trim().slice(0, 60) || '新对话',
    stage: RIKI_PROJECT_STAGES.includes(options.stage) ? options.stage : 'discovery',
    module: Object.hasOwn(RIKI_PROJECT_MODULES, options.module) ? options.module : 'outline',
    messages: [],
    preferences: {},
    preferenceMeta: {},
    strategyMode: mode,
    strategyProgress: {},
    pendingContentConfirmation: null,
    detailLevels: normalizeDetailLevels(options.detailLevels),
    context: rikiProjectCreateContext(options.context),
    pendingProposal: null,
    createdAt: text(options.createdAt || stamp),
    updatedAt: text(options.updatedAt || stamp),
  };
}

function emptyArtifactStore() {
  return Object.fromEntries(RIKI_PROJECT_ARTIFACT_KINDS.map(kind => [kind, {
    currentVersionId: null,
    versions: [],
  }]));
}

function createRuntime() {
  return {
    lazyBatch: null,
    pendingBackgroundJob: null,
    projectWorldbook: null,
  };
}

function normalizeBinding(raw, fallback = {}) {
  const source = isRecord(raw) ? raw : {};
  const bindingText = (key, fallbackValue) => {
    const value = Object.hasOwn(source, key) ? text(source[key]) : text(fallbackValue);
    return redactSecretText(value) === value ? value.slice(0, 500) : '';
  };
  return {
    apiPresetId: bindingText('apiPresetId', fallback.apiPresetId),
    model: bindingText('model', fallback.model),
    systemPresetId: bindingText('systemPresetId', fallback.systemPresetId),
  };
}

export function rikiProjectCreateModelBindings(raw = {}) {
  const builtinSystemIds = {
    main: 'builtin_controller',
    outline: 'builtin_outline',
    act: 'builtin_act',
    chapter: 'builtin_chapter',
    character: 'builtin_character',
    format_guard: 'builtin_format_guard',
  };
  const defaults = {
    main: { apiPresetId: '', model: '', systemPresetId: builtinSystemIds.main },
    default: { apiPresetId: '', model: '', systemPresetId: '' },
    modules: Object.fromEntries(Object.keys(RIKI_PROJECT_MODULES).map(moduleId => [moduleId, {
      apiPresetId: '',
      model: '',
      systemPresetId: builtinSystemIds[moduleId] || '',
    }])),
  };
  const source = isRecord(raw) ? raw : {};
  return {
    routingFallback: source.routingFallback === 'code' ? 'code' : 'api',
    main: normalizeBinding(source.main, defaults.main),
    default: normalizeBinding(source.default, defaults.default),
    modules: Object.fromEntries(Object.keys(RIKI_PROJECT_MODULES).map(moduleId => [
      moduleId,
      normalizeBinding(source.modules?.[moduleId], defaults.modules[moduleId]),
    ])),
  };
}

function normalizeIdentity(identity = {}) {
  if (typeof identity === 'string') return { chatKey: identity };
  return isRecord(identity) ? identity : {};
}

export function rikiProjectCreateState(identity = {}) {
  const source = normalizeIdentity(identity);
  const stamp = rikiProjectNow();
  const conversation = rikiProjectCreateConversation(source.conversationTitle || '故事策划');
  const chatKey = text(source.chatKey);
  return {
    schemaVersion: RIKI_PROJECT_SCHEMA_VERSION,
    scriptVersion: text(source.scriptVersion || '1.3.2'),
    chatKey,
    projectId: text(source.projectId || rikiProjectId('project', chatKey || stamp)),
    title: text(source.title),
    decisions: [],
    requestLogs: [],
    artifacts: emptyArtifactStore(),
    recycleBin: [],
    conversations: [conversation],
    activeConversationId: conversation.id,
    config: rikiProjectCreateModelBindings(source.config),
    runtime: createRuntime(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function rikiProjectNormalizeMessage(message, fallbackId = '') {
  if (!isRecord(message) || !['user', 'assistant', 'system'].includes(message.role)) return null;
  const moduleId = Object.hasOwn(RIKI_PROJECT_MODULES, message.module) ? message.module : '';
  const agentRole = Object.hasOwn(RIKI_PROJECT_MODULES, message.agentRole) ? message.agentRole : '';
  const normalized = {
    id: text(message.id || fallbackId || rikiProjectId('message')),
    role: message.role,
    content: text(message.content),
    raw: text(message.raw || message.content),
    module: moduleId,
    agentRole,
    at: text(message.at || rikiProjectNow()),
    status: text(message.status || 'complete'),
    error: isRecord(message.error) ? rikiProjectClone(message.error) : null,
    payload: isRecord(message.payload) ? rikiProjectClone(message.payload) : null,
    request: isRecord(message.request) ? rikiProjectSanitizeSecrets(message.request) : null,
    proposalId: text(message.proposalId),
    worldbookChangeId: text(message.worldbookChangeId),
    repair: isRecord(message.repair) ? rikiProjectClone(message.repair) : null,
    operationId: text(message.operationId),
    pass: text(message.pass),
    sourceDraftId: text(message.sourceDraftId),
    sourceMessageId: text(message.sourceMessageId),
    tokenUsage: isRecord(message.tokenUsage) ? rikiProjectClone(message.tokenUsage) : null,
  };
  if (normalized.role === 'assistant' && normalized.status === 'compiling' && normalized.content.trim()) {
    normalized.status = 'draft_invalid';
    normalized.error = { name: 'RikiFormatCompileInterrupted', message: '页面在格式编译完成前被关闭或刷新' };
    normalized.repair = {
      available: true,
      mode: 'compiler_only',
      sourceMessageId: normalized.id,
      sourceDraftId: normalized.sourceDraftId,
      operationId: normalized.operationId,
      targetModule: normalized.module,
      task: text(normalized.request?.task || 'chat'),
      reason: normalized.error.message,
    };
  }
  return normalized;
}

function normalizePreferenceMeta(preferences, rawMeta, fallbackTime) {
  const source = isRecord(rawMeta) ? rawMeta : {};
  return Object.fromEntries(Object.keys(preferences).map(key => {
    const existing = isRecord(source[key]) ? source[key] : {};
    const status = existing.status === 'confirmed' ? 'confirmed' : 'inferred';
    return [key, {
      status,
      source: text(existing.source || 'legacy'),
      sourceMessageId: text(existing.sourceMessageId),
      sourceConversationId: text(existing.sourceConversationId),
      updatedAt: text(existing.updatedAt || fallbackTime || rikiProjectNow()),
      confirmedAt: status === 'confirmed'
        ? text(existing.confirmedAt || existing.updatedAt || fallbackTime || rikiProjectNow())
        : '',
    }];
  }));
}

function normalizeProposal(raw, conversationId) {
  if (!isRecord(raw) || !RIKI_PROJECT_ARTIFACT_KINDS.includes(raw.kind)) return null;
  const content = rikiProjectClone(raw.content);
  let generatedItems;
  try { generatedItems = rikiProjectProposalItems(raw.kind, content); }
  catch (_) { return null; }
  const statuses = new Map(array(raw.items).map(item => [text(item?.itemId), item?.status]));
  return {
    proposalId: text(raw.proposalId || rikiProjectId('proposal', `${raw.kind}|${conversationId}`)),
    artifactId: text(raw.artifactId || rikiProjectId(raw.kind, conversationId)),
    kind: raw.kind,
    baseVersionId: text(raw.baseVersionId) || null,
    sourceConversationId: text(raw.sourceConversationId || conversationId),
    content,
    changeLevel: raw.changeLevel === 'major' ? 'major' : 'minor',
    summary: text(raw.summary),
    mergeMode: raw.mergeMode === 'append' ? 'append' : 'replace',
    createdAt: text(raw.createdAt || rikiProjectNow()),
    status: ['pending', 'stale', 'rejected'].includes(raw.status) ? raw.status : 'pending',
    items: generatedItems.map(item => ({
      ...item,
      status: ['pending', 'confirmed', 'rejected'].includes(statuses.get(item.itemId))
        ? statuses.get(item.itemId)
        : 'pending',
    })),
  };
}

function normalizeConversation(raw, index) {
  const source = isRecord(raw) ? raw : {};
  const createdAt = text(source.createdAt || rikiProjectNow());
  const conversation = rikiProjectCreateConversation(source.title || `对话 ${index + 1}`, {
    id: source.id || rikiProjectId('conversation', index),
    stage: source.stage,
    module: source.module,
    strategyMode: normalizeStrategyMode(source.strategyMode, array(source.messages).length ? 'detailed' : ''),
    detailLevels: source.detailLevels,
    context: source.context,
    createdAt,
    updatedAt: source.updatedAt,
  });
  conversation.messages = array(source.messages)
    .map((message, messageIndex) => rikiProjectNormalizeMessage(message, `${conversation.id}_${messageIndex}`))
    .filter(Boolean);
  conversation.preferences = isRecord(source.preferences) ? rikiProjectClone(source.preferences) : {};
  conversation.preferenceMeta = normalizePreferenceMeta(conversation.preferences, source.preferenceMeta, source.updatedAt || createdAt);
  conversation.strategyProgress = isRecord(source.strategyProgress) ? rikiProjectClone(source.strategyProgress) : {};
  const pendingContent = source.pendingContentConfirmation;
  conversation.pendingContentConfirmation = isRecord(pendingContent)
    && text(pendingContent.sourceMessageId)
    && Object.hasOwn(RIKI_PROJECT_MODULES, pendingContent.moduleId)
    ? rikiProjectClone(pendingContent)
    : null;
  conversation.pendingProposal = normalizeProposal(source.pendingProposal, conversation.id);
  return conversation;
}

function normalizeVersion(raw, kind, fallbackIndex = 0) {
  if (!isRecord(raw) || raw.content === undefined) return null;
  const status = ['confirmed', 'superseded', 'deleted'].includes(raw.status) ? raw.status : 'confirmed';
  return {
    artifactId: text(raw.artifactId || rikiProjectId(kind, 'normalized')),
    versionId: text(raw.versionId || rikiProjectId('version', `${kind}|${fallbackIndex}`)),
    version: Math.max(1, Number(raw.version) || fallbackIndex + 1),
    kind,
    baseVersionId: text(raw.baseVersionId) || null,
    sourceConversationId: text(raw.sourceConversationId),
    content: rikiProjectClone(raw.content),
    changeLevel: raw.changeLevel === 'major' ? 'major' : 'minor',
    mergeMode: raw.mergeMode === 'append' ? 'append' : 'replace',
    summary: text(raw.summary),
    createdAt: text(raw.createdAt || rikiProjectNow()),
    confirmedAt: text(raw.confirmedAt || raw.createdAt || rikiProjectNow()),
    status,
  };
}

function normalizeArtifactStore(raw) {
  const result = emptyArtifactStore();
  for (const kind of RIKI_PROJECT_ARTIFACT_KINDS) {
    const source = isRecord(raw?.[kind]) ? raw[kind] : {};
    const seenIds = new Set();
    const versions = array(source.versions).map((item, index) => normalizeVersion(item, kind, index)).filter(Boolean);
    for (const version of versions) {
      if (!seenIds.has(version.versionId)) {
        seenIds.add(version.versionId);
        continue;
      }
      version.versionId = rikiProjectId('version', `${kind}|dedupe`);
      seenIds.add(version.versionId);
    }
    let currentVersionId = text(source.currentVersionId) || null;
    if (!versions.some(item => item.versionId === currentVersionId && item.status !== 'deleted')) {
      currentVersionId = versions.filter(item => item.status === 'confirmed').at(-1)?.versionId || null;
    }
    if (currentVersionId) {
      for (const version of versions) {
        if (version.versionId === currentVersionId) version.status = 'confirmed';
        else if (version.status === 'confirmed') version.status = 'superseded';
      }
    }
    result[kind] = { currentVersionId, versions };
  }
  return result;
}

function normalizeRecycleBin(raw, artifacts) {
  return array(raw).filter(isRecord).map(batch => ({
    batchId: text(batch.batchId || rikiProjectId('trash')),
    kind: RIKI_PROJECT_ARTIFACT_KINDS.includes(batch.kind) ? batch.kind : 'project_import',
    reason: text(batch.reason),
    deletedAt: text(batch.deletedAt || rikiProjectNow()),
    restoredAt: text(batch.restoredAt) || null,
    permanentlyDeletedAt: text(batch.permanentlyDeletedAt) || null,
    items: array(batch.items).filter(item => {
      if (!isRecord(item) || !RIKI_PROJECT_ARTIFACT_KINDS.includes(item.kind)) return false;
      return artifacts[item.kind].versions.some(version => version.versionId === item.versionId);
    }).map(item => ({ kind: item.kind, versionId: text(item.versionId) })),
  })).filter(batch => batch.items.length);
}

function normalizeRequestLogEntry(entry) {
  if (!isRecord(entry)) return null;
  const sanitized = rikiProjectSanitizeSecrets(entry);
  sanitized.id = text(sanitized.id || rikiProjectId('request'));
  sanitized.module = Object.hasOwn(RIKI_PROJECT_MODULES, sanitized.module) ? sanitized.module : '';
  sanitized.targetModule = Object.hasOwn(RIKI_PROJECT_MODULES, sanitized.targetModule) ? sanitized.targetModule : '';
  return sanitized;
}

function normalizeLazySnapshot(raw) {
  if (!isRecord(raw) || !isRecord(raw.artifacts) || !isRecord(raw.conversation)) return null;
  if (!RIKI_PROJECT_ARTIFACT_KINDS.every(kind => (
    isRecord(raw.artifacts[kind]) && Array.isArray(raw.artifacts[kind].versions)
  ))) return null;
  const normalizeSavedBranch = source => {
    if (!isRecord(source) || !text(source.id)) return null;
    return {
      id: text(source.id),
      stage: RIKI_PROJECT_STAGES.includes(source.stage) ? source.stage : 'discovery',
      module: Object.hasOwn(RIKI_PROJECT_MODULES, source.module) ? source.module : 'outline',
      pendingProposal: normalizeProposal(source.pendingProposal, text(source.id)),
      pendingContentConfirmation: isRecord(source.pendingContentConfirmation)
        ? rikiProjectSanitizeSecrets(source.pendingContentConfirmation)
        : null,
      strategyProgress: isRecord(source.strategyProgress)
        ? rikiProjectSanitizeSecrets(source.strategyProgress)
        : {},
    };
  };
  const conversation = normalizeSavedBranch({ ...raw.conversation, id: text(raw.conversation.id || 'snapshot_source') });
  return {
    artifacts: normalizeArtifactStore(raw.artifacts),
    decisions: array(raw.decisions).filter(isRecord).slice(-RIKI_PROJECT_DECISION_LIMIT).map(rikiProjectSanitizeSecrets),
    title: text(raw.title),
    conversation: {
      ...conversation,
      messageCount: Math.max(0, Number(raw.conversation.messageCount) || 0),
    },
    branchStates: array(raw.branchStates).map(normalizeSavedBranch).filter(Boolean),
  };
}

function normalizeLazySteps(batch) {
  const rawSteps = array(batch.steps);
  const generatedByKind = new Map(array(batch.generated).map(item => [item?.kind, text(item?.versionId)]));
  return RIKI_PROJECT_LAZY_STEPS.map(descriptor => {
    const source = rawSteps.find(item => item?.kind === descriptor.kind);
    const generatedVersionId = generatedByKind.get(descriptor.kind);
    const status = ['pending', 'generating', 'complete', 'reused', 'failed'].includes(source?.status)
      ? source.status
      : (generatedVersionId ? 'complete' : 'pending');
    return {
      ...descriptor,
      status,
      versionId: text(source?.versionId || generatedVersionId),
      startedAt: text(source?.startedAt),
      completedAt: text(source?.completedAt),
      error: text(source?.error),
    };
  });
}

function normalizeRuntime(raw) {
  const source = isRecord(raw) ? raw : {};
  const result = createRuntime();
  result.pendingBackgroundJob = isRecord(source.pendingBackgroundJob)
    ? rikiProjectSanitizeSecrets(source.pendingBackgroundJob)
    : null;
  result.projectWorldbook = isRecord(source.projectWorldbook)
    ? { name: text(source.projectWorldbook.name), mode: source.projectWorldbook.mode === 'original' ? 'original' : 'own', createdAt: text(source.projectWorldbook.createdAt), updatedAt: text(source.projectWorldbook.updatedAt) }
    : null;
  if (isRecord(source.lazyBatch)) {
    const batch = rikiProjectSanitizeSecrets(source.lazyBatch);
    result.lazyBatch = {
      batchId: text(batch.batchId || rikiProjectId('lazy_batch')),
      conversationId: text(batch.conversationId),
      status: ['generating', 'failed', 'awaiting_confirmation', 'complete', 'rejected', 'invalidated'].includes(batch.status)
        ? batch.status
        : 'failed',
      startedAt: text(batch.startedAt || rikiProjectNow()),
      resumedAt: text(batch.resumedAt),
      completedAt: text(batch.completedAt),
      failedAt: text(batch.failedAt),
      confirmedAt: text(batch.confirmedAt),
      rejectedAt: text(batch.rejectedAt),
      error: text(batch.error),
      requirement: text(batch.requirement),
      currentStep: isRecord(batch.currentStep) ? batch.currentStep : null,
      failedStep: isRecord(batch.failedStep) ? batch.failedStep : null,
      generated: array(batch.generated).filter(item => isRecord(item) && RIKI_PROJECT_ARTIFACT_KINDS.includes(item.kind)),
      steps: normalizeLazySteps(batch),
      snapshot: normalizeLazySnapshot(batch.snapshot),
      lastCheckpointAt: text(batch.lastCheckpointAt),
    };
  }
  return result;
}

export function rikiProjectNormalizeState(raw, identity = {}) {
  const requested = normalizeIdentity(identity);
  if (!isRecord(raw)) return rikiProjectCreateState(requested);
  if (text(requested.chatKey) && text(raw.chatKey) && text(requested.chatKey) !== text(raw.chatKey)) {
    return rikiProjectCreateState(requested);
  }
  const defaults = rikiProjectCreateState(requested);
  const state = {
    ...defaults,
    schemaVersion: RIKI_PROJECT_SCHEMA_VERSION,
    scriptVersion: text(requested.scriptVersion || raw.scriptVersion || defaults.scriptVersion),
    chatKey: text(requested.chatKey || raw.chatKey),
    projectId: text(requested.projectId || raw.projectId || defaults.projectId),
    title: text(raw.title || requested.title),
    decisions: array(raw.decisions).filter(isRecord).slice(-RIKI_PROJECT_DECISION_LIMIT).map(rikiProjectSanitizeSecrets),
    requestLogs: array(raw.requestLogs).map(normalizeRequestLogEntry).filter(Boolean),
    artifacts: normalizeArtifactStore(raw.artifacts),
    conversations: array(raw.conversations).map(normalizeConversation),
    config: rikiProjectCreateModelBindings(raw.config),
    runtime: normalizeRuntime(raw.runtime),
    createdAt: text(raw.createdAt || defaults.createdAt),
    updatedAt: text(raw.updatedAt || defaults.updatedAt),
  };
  if (!state.conversations.length) state.conversations = [rikiProjectCreateConversation('故事策划')];
  state.activeConversationId = state.conversations.some(item => item.id === raw.activeConversationId)
    ? raw.activeConversationId
    : state.conversations[0].id;
  state.recycleBin = normalizeRecycleBin(raw.recycleBin, state.artifacts);
  if (state.runtime.lazyBatch) {
    for (const step of state.runtime.lazyBatch.steps) {
      const current = rikiProjectCurrentArtifact(state, step.kind);
      if (['complete', 'reused'].includes(step.status) && current?.versionId !== step.versionId) {
        step.status = current ? 'reused' : 'pending';
        step.versionId = current?.versionId || '';
      } else if (step.status === 'pending' && current) {
        step.status = 'reused';
        step.versionId = current.versionId;
      }
    }
    const current = state.runtime.lazyBatch.steps.find(step => step.status === 'generating');
    state.runtime.lazyBatch.currentStep = current || null;
    if (state.runtime.lazyBatch.status === 'generating') {
      const interrupted = state.runtime.lazyBatch.currentStep;
      if (interrupted) {
        interrupted.status = 'failed';
        interrupted.error = '页面刷新或脚本重载中断了正在执行的步骤';
      }
      state.runtime.lazyBatch.status = 'failed';
      state.runtime.lazyBatch.failedAt = rikiProjectNow();
      state.runtime.lazyBatch.error = '页面刷新或脚本重载中断了懒人版流水线，可从已保存断点继续';
      state.runtime.lazyBatch.failedStep = rikiProjectClone(interrupted || null);
      state.runtime.lazyBatch.currentStep = null;
    }
    if (!state.conversations.some(item => item.id === state.runtime.lazyBatch.conversationId)) {
      state.runtime.lazyBatch.status = 'invalidated';
      state.runtime.lazyBatch.orphaned = true;
      state.runtime.lazyBatch.error = '懒人版来源分支已经不存在；请撤销回滚或清除该孤立批次';
      state.runtime.lazyBatch.currentStep = null;
    }
  }
  rikiProjectPruneRequestLogs(state);
  return state;
}

export function rikiProjectActiveConversation(state) {
  if (!isRecord(state)) return null;
  return array(state.conversations).find(item => item.id === state.activeConversationId)
    || array(state.conversations)[0]
    || null;
}

export function rikiProjectNextConversationTitle(state, prefix = '对话') {
  const escaped = text(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`^${escaped}\\s*(\\d+)$`);
  const maximum = array(state?.conversations).reduce((max, conversation) => {
    const match = text(conversation?.title).trim().match(matcher);
    return match ? Math.max(max, Number(match[1]) || 0) : max;
  }, 0);
  return `${prefix} ${maximum + 1}`;
}

export function rikiProjectAddConversation(state, options = {}) {
  if (!isRecord(state)) throw new Error('项目状态不存在');
  const source = options.copyPreferencesFrom
    ? array(state.conversations).find(item => item.id === options.copyPreferencesFrom)
    : (options.copyPreferences ? rikiProjectActiveConversation(state) : null);
  const title = text(options.title).trim() || rikiProjectNextConversationTitle(state);
  const created = rikiProjectCreateConversation(title, options);
  if (source) {
    created.preferences = rikiProjectClone(source.preferences || {});
    created.preferenceMeta = Object.fromEntries(Object.keys(created.preferences).map(key => {
      const previous = isRecord(source.preferenceMeta?.[key]) ? source.preferenceMeta[key] : {};
      return [key, {
        ...rikiProjectClone(previous),
        source: 'copied',
        sourceConversationId: source.id,
        updatedAt: rikiProjectNow(),
      }];
    }));
  }
  state.conversations.push(created);
  if (options.activate !== false) state.activeConversationId = created.id;
  touchState(state);
  return created;
}

export function rikiProjectSetActiveConversation(state, conversationId) {
  const found = array(state?.conversations).find(item => item.id === conversationId);
  if (!found) throw new Error('Agent 对话不存在');
  state.activeConversationId = found.id;
  touchState(state);
  return found;
}

export function rikiProjectRenameConversation(state, conversationId, title) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const next = text(title).trim();
  if (!next) throw new Error('对话名称不能为空');
  conversation.title = next.slice(0, 60);
  touchConversation(conversation);
  touchState(state);
  return conversation;
}

export function rikiProjectDeleteConversation(state, conversationId) {
  const index = array(state?.conversations).findIndex(item => item.id === conversationId);
  if (index < 0) throw new Error('Agent 对话不存在');
  const lazyBatch = state.runtime?.lazyBatch;
  if (lazyBatch?.conversationId === conversationId && !['complete', 'rejected'].includes(lazyBatch.status)) {
    throw new Error('该分支仍承载懒人版批次；请先完成、撤销或清除批次后再删除');
  }
  const [removed] = state.conversations.splice(index, 1);
  if (!state.conversations.length) state.conversations.push(rikiProjectCreateConversation('故事策划'));
  if (state.activeConversationId === conversationId || !state.conversations.some(item => item.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[Math.min(index, state.conversations.length - 1)].id;
  }
  touchState(state);
  return removed;
}

export function rikiProjectCopyPreferences(state, fromConversationId, toConversationId) {
  const source = array(state?.conversations).find(item => item.id === fromConversationId);
  const target = array(state?.conversations).find(item => item.id === toConversationId);
  if (!source || !target) throw new Error('复制偏好所需的来源或目标对话不存在');
  target.preferences = rikiProjectClone(source.preferences || {});
  target.preferenceMeta = Object.fromEntries(Object.keys(target.preferences).map(key => [key, {
    ...rikiProjectClone(source.preferenceMeta?.[key] || {}),
    source: 'copied',
    sourceConversationId: source.id,
    updatedAt: rikiProjectNow(),
  }]));
  touchConversation(target);
  touchState(state);
  return target.preferences;
}

export function rikiProjectSetStrategyMode(state, conversationId, mode, options = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const normalized = normalizeStrategyMode(mode);
  if (!normalized) throw new Error('策略模式必须是 detailed、brief 或 lazy');
  if (!options.force && (conversation.messages.length || conversation.strategyMode) && conversation.strategyMode !== normalized) {
    throw new Error('当前分支已开始，策略模式不能再修改');
  }
  conversation.strategyMode = normalized;
  conversation.strategyProgress = options.preserveProgress ? conversation.strategyProgress || {} : {};
  touchConversation(conversation);
  touchState(state);
  return normalized;
}

export function rikiProjectSetStrategyProgress(state, conversationId, moduleId, status, details = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  assertModule(moduleId);
  if (!['idle', 'asked', 'generating', 'pending_confirmation', 'confirmed', 'rejected', 'failed'].includes(status)) {
    throw new Error(`无效策略进度：${status}`);
  }
  conversation.strategyProgress ||= {};
  conversation.strategyProgress[moduleId] = {
    ...rikiProjectClone(details),
    status,
    updatedAt: rikiProjectNow(),
  };
  touchConversation(conversation);
  touchState(state);
  return conversation.strategyProgress[moduleId];
}

export function rikiProjectStrategyNextAction(conversation, moduleId) {
  if (!isRecord(conversation)) return 'select_mode';
  assertModule(moduleId);
  const mode = normalizeStrategyMode(conversation.strategyMode);
  if (!mode) return 'select_mode';
  const status = text(conversation.strategyProgress?.[moduleId]?.status || 'idle');
  if (['generating', 'pending_confirmation'].includes(status)) return 'wait';
  if (status === 'confirmed') return 'confirmed';
  if (mode === 'lazy') return status === 'asked' ? 'auto_generate' : 'discuss';
  if (mode === 'brief') return status === 'asked' ? 'generate' : 'ask_once';
  return status === 'asked' ? 'generate' : 'discuss';
}

export function rikiProjectUpsertPreference(state, conversationId, key, value, options = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const preferenceKey = text(key).trim();
  if (!preferenceKey) throw new Error('偏好名称不能为空');
  if (isUnsafeObjectKey(preferenceKey)) throw new Error('偏好名称包含不安全的对象路径关键字');
  const oldKey = text(options.oldKey || preferenceKey).trim();
  if (oldKey !== preferenceKey && Object.hasOwn(conversation.preferences, preferenceKey)) {
    throw new Error(`偏好“${preferenceKey}”已经存在`);
  }
  const previousMeta = isRecord(conversation.preferenceMeta?.[oldKey]) ? conversation.preferenceMeta[oldKey] : {};
  if (oldKey !== preferenceKey) {
    delete conversation.preferences[oldKey];
    delete conversation.preferenceMeta[oldKey];
  }
  const status = options.status === 'inferred' ? 'inferred' : 'confirmed';
  conversation.preferences[preferenceKey] = rikiProjectClone(value);
  conversation.preferenceMeta[preferenceKey] = {
    ...rikiProjectClone(previousMeta),
    status,
    source: text(options.source || 'user'),
    sourceMessageId: text(options.sourceMessageId),
    updatedAt: rikiProjectNow(),
    confirmedAt: status === 'confirmed' ? text(previousMeta.confirmedAt || rikiProjectNow()) : '',
  };
  touchConversation(conversation);
  touchState(state);
  return conversation.preferences[preferenceKey];
}

export function rikiProjectConfirmPreference(state, conversationId, key) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation || !Object.hasOwn(conversation.preferences || {}, key)) throw new Error('偏好不存在');
  const stamp = rikiProjectNow();
  conversation.preferenceMeta[key] = {
    ...(conversation.preferenceMeta[key] || {}),
    status: 'confirmed',
    source: 'user',
    updatedAt: stamp,
    confirmedAt: conversation.preferenceMeta[key]?.confirmedAt || stamp,
  };
  touchConversation(conversation);
  touchState(state);
  return conversation.preferenceMeta[key];
}

export function rikiProjectConfirmAllPreferences(state, conversationId) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  for (const key of Object.keys(conversation.preferences || {})) rikiProjectConfirmPreference(state, conversationId, key);
  return Object.keys(conversation.preferences || {}).length;
}

export function rikiProjectDeletePreference(state, conversationId, key) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation || !Object.hasOwn(conversation.preferences || {}, key)) return false;
  delete conversation.preferences[key];
  delete conversation.preferenceMeta[key];
  touchConversation(conversation);
  touchState(state);
  return true;
}

export function rikiProjectClearPreferences(state, conversationId) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const count = Object.keys(conversation.preferences || {}).length;
  conversation.preferences = {};
  conversation.preferenceMeta = {};
  touchConversation(conversation);
  touchState(state);
  return count;
}

export function rikiProjectConfirmedPreferences(conversation) {
  return Object.fromEntries(Object.entries(conversation?.preferences || {}).filter(([key]) => (
    conversation.preferenceMeta?.[key]?.status === 'confirmed'
  )).map(([key, value]) => [key, rikiProjectClone(value)]));
}

export function rikiProjectInferredPreferences(conversation) {
  return Object.fromEntries(Object.entries(conversation?.preferences || {}).filter(([key]) => (
    conversation.preferenceMeta?.[key]?.status !== 'confirmed'
  )).map(([key, value]) => [key, rikiProjectClone(value)]));
}

export function rikiProjectAppendMessage(state, conversationId, message) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const normalized = rikiProjectNormalizeMessage({ ...message, id: message?.id || rikiProjectId('message') });
  if (!normalized) throw new Error('消息 role 必须是 user、assistant 或 system');
  conversation.messages.push(normalized);
  touchConversation(conversation);
  touchState(state);
  return normalized;
}

export function rikiProjectAppendUserMessage(state, conversationId, content, details = {}) {
  const value = text(content).trim();
  if (!value) throw new Error('用户消息不能为空');
  return rikiProjectAppendMessage(state, conversationId, {
    ...details,
    role: 'user',
    content: value,
    raw: value,
    status: details.status || 'complete',
  });
}

export function rikiProjectAppendAssistantMessage(state, conversationId, content, details = {}) {
  return rikiProjectAppendMessage(state, conversationId, {
    ...details,
    role: 'assistant',
    content: text(content),
    raw: details.raw ?? content,
    status: details.status || 'complete',
  });
}

export function rikiProjectPreviousUserForAssistant(conversation, assistantId) {
  const index = array(conversation?.messages).findIndex(item => item.id === assistantId && item.role === 'assistant');
  if (index < 0) return null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (conversation.messages[cursor].role === 'user') return conversation.messages[cursor];
  }
  return null;
}

export function rikiProjectTruncateMessages(conversation, index, include = false) {
  if (!isRecord(conversation) || !Array.isArray(conversation.messages)) throw new Error('Agent 对话不存在');
  const start = include ? index : index + 1;
  const removed = conversation.messages.splice(Math.max(0, start));
  if (removed.some(item => item.proposalId && item.proposalId === conversation.pendingProposal?.proposalId)) {
    conversation.pendingProposal = null;
  }
  touchConversation(conversation);
  return removed;
}

export function rikiProjectEditUserMessage(state, conversationId, messageId, content) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const index = conversation.messages.findIndex(item => item.id === messageId && item.role === 'user');
  const value = text(content).trim();
  if (index < 0) throw new Error('可编辑的用户消息不存在');
  if (!value) throw new Error('用户消息不能为空');
  const priorAssistant = conversation.messages[index + 1]?.role === 'assistant' ? rikiProjectClone(conversation.messages[index + 1]) : null;
  conversation.messages[index].content = value;
  conversation.messages[index].raw = value;
  conversation.messages[index].at = rikiProjectNow();
  const removed = rikiProjectTruncateMessages(conversation, index, false);
  touchState(state);
  return {
    message: conversation.messages[index],
    removed,
    reroll: priorAssistant ? {
      userText: value,
      moduleId: priorAssistant.module,
      task: text(priorAssistant.request?.task || 'chat'),
      saveArtifactRequested: priorAssistant.request?.saveArtifactRequested === true,
    } : null,
  };
}

export function rikiProjectDeleteMessage(state, conversationId, messageId) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const index = conversation.messages.findIndex(item => item.id === messageId);
  if (index < 0) return [];
  const count = conversation.messages[index].role === 'user' && conversation.messages[index + 1]?.role === 'assistant' ? 2 : 1;
  const removed = conversation.messages.splice(index, count);
  if (removed.some(item => item.proposalId && item.proposalId === conversation.pendingProposal?.proposalId)) {
    conversation.pendingProposal = null;
  }
  touchConversation(conversation);
  touchState(state);
  return removed;
}

export function rikiProjectPrepareReroll(state, conversationId, assistantId) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  const index = conversation.messages.findIndex(item => item.id === assistantId && item.role === 'assistant');
  const assistant = index >= 0 ? rikiProjectClone(conversation.messages[index]) : null;
  const user = rikiProjectPreviousUserForAssistant(conversation, assistantId);
  if (!assistant || !user) throw new Error('没有找到该回复对应的用户消息');
  const removed = rikiProjectTruncateMessages(conversation, index, true);
  touchState(state);
  return {
    userText: user.content,
    userMessageId: user.id,
    moduleId: assistant.module,
    task: text(assistant.request?.task || 'chat'),
    saveArtifactRequested: assistant.request?.saveArtifactRequested === true,
    removed,
  };
}

function characterTierClass(value) {
  const tier = text(value).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (['low', 'lower', 'bottom', '下档', '低档', 'minor', '路人', '路人甲', '一次性', 'batch'].includes(tier)) return 'low';
  if (['medium', 'middle', 'mid', '中档', '中等', 'supporting', '支线', '重要配角', 'act'].includes(tier)) return 'medium';
  if (['high', 'upper', 'top', '上档', '高档', 'core', '核心', '主线', 'story'].includes(tier)) return 'high';
  return '';
}

function isLowTierCharacter(character) {
  return characterTierClass(character?.tier || character?.importance || character?.roleType) === 'low';
}

function contentArray(content, ...keys) {
  if (Array.isArray(content)) return content;
  for (const key of keys) if (Array.isArray(content?.[key])) return content[key];
  return [];
}

export function rikiProjectProposalItemSource(kind, content) {
  assertArtifactKind(kind);
  if (kind === 'acts') return contentArray(content, 'acts');
  if (kind === 'chapters') return contentArray(content, 'chapters', 'batch');
  if (kind === 'characters') {
    const characters = contentArray(content, 'characters', 'detailedCharacters');
    if (text(content?.phase).toLowerCase() === 'rough') return characters.filter(character => !isLowTierCharacter(character));
    return characters;
  }
  return [];
}

export function rikiProjectProposalItemIdentity(kind, item, index = 0) {
  assertArtifactKind(kind);
  if (kind === 'acts') return text(item?.actId || item?.act_id || item?.id || `acts_${index + 1}`);
  if (kind === 'chapters') return text(item?.chapterId || item?.chapter_id || item?.id || `chapters_${index + 1}`);
  if (kind === 'characters') return text(item?.characterId || item?.character_id || item?.id || `characters_${index + 1}`);
  return text(item?.id || `${kind}_${index + 1}`);
}

function artifactKindLabel(kind) {
  return {
    outline: '正式总纲',
    acts: '大章',
    chapters: '小章',
    characters: '人物',
  }[kind] || '项目';
}

export function rikiProjectProposalItems(kind, content) {
  const items = rikiProjectProposalItemSource(kind, content).map((item, index) => ({
    itemId: rikiProjectProposalItemIdentity(kind, item, index),
    label: text(item?.title || item?.name || item?.displayName || item?.identity || `${artifactKindLabel(kind)} ${index + 1}`),
    index,
    content: rikiProjectClone(item),
    status: 'pending',
  }));
  const seen = new Set();
  const duplicates = [];
  for (const item of items) {
    if (seen.has(item.itemId)) duplicates.push(item.itemId);
    seen.add(item.itemId);
  }
  if (duplicates.length) throw new Error(`候选成果包含重复稳定 ID：${unique(duplicates).join('、')}`);
  return items;
}

export function rikiProjectArtifactStore(state, kind) {
  assertArtifactKind(kind);
  const store = state?.artifacts?.[kind];
  if (!isRecord(store) || !Array.isArray(store.versions)) throw new Error(`成果仓不存在：${kind}`);
  return store;
}

export function rikiProjectCurrentArtifact(state, kind) {
  const store = rikiProjectArtifactStore(state, kind);
  return store.versions.find(item => item.versionId === store.currentVersionId && item.status === 'confirmed') || null;
}

export function rikiProjectArtifactVersions(state, kind, options = {}) {
  const versions = rikiProjectArtifactStore(state, kind).versions;
  return options.includeDeleted ? versions : versions.filter(item => item.status !== 'deleted');
}

export function rikiProjectArtifactVersion(state, kind, versionId) {
  return rikiProjectArtifactStore(state, kind).versions.find(item => item.versionId === versionId) || null;
}

function nextArtifactVersionNumber(state, kind) {
  return rikiProjectArtifactStore(state, kind).versions.reduce(
    (maximum, item) => Math.max(maximum, Number(item.version) || 0),
    0,
  ) + 1;
}

export function rikiProjectProposeArtifact(state, conversationOrId, kind, content, options = {}) {
  assertArtifactKind(kind);
  const conversation = typeof conversationOrId === 'string'
    ? array(state?.conversations).find(item => item.id === conversationOrId)
    : conversationOrId;
  if (!conversation || !array(state?.conversations).some(item => item.id === conversation.id)) {
    throw new Error('提案来源对话不存在');
  }
  if (conversation.pendingProposal && options.replacePending !== true) {
    throw new Error('当前分支已有待确认候选，请先确认或打回');
  }
  const current = rikiProjectCurrentArtifact(state, kind);
  const proposal = {
    proposalId: rikiProjectId('proposal', `${kind}|${conversation.id}`),
    artifactId: current?.artifactId || rikiProjectId(kind, state.projectId),
    kind,
    baseVersionId: options.baseVersionId ?? current?.versionId ?? null,
    sourceConversationId: conversation.id,
    content: rikiProjectClone(content),
    changeLevel: options.changeLevel === 'major' ? 'major' : 'minor',
    summary: text(options.summary || `${RIKI_PROJECT_MODULES[options.module || conversation.module]?.label || kind}生成的候选成果`),
    mergeMode: options.mergeMode === 'append' ? 'append' : 'replace',
    createdAt: rikiProjectNow(),
    status: 'pending',
    items: rikiProjectProposalItems(kind, content),
  };
  conversation.pendingProposal = proposal;
  touchConversation(conversation);
  touchState(state);
  return proposal;
}

export function rikiProjectSetProposalItemStatus(conversation, proposalId, itemId, status) {
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在');
  const item = array(proposal.items).find(entry => entry.itemId === itemId);
  if (!item) throw new Error('候选子项不存在');
  if (!['pending', 'confirmed', 'rejected'].includes(status)) throw new Error('无效的候选子项状态');
  item.status = status;
  proposal.status = 'pending';
  touchConversation(conversation);
  return item;
}

export function rikiProjectConfirmAllProposalItems(conversation, proposalId) {
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在');
  if (array(proposal.items).some(item => item.status === 'rejected')) {
    throw new Error('仍有被打回的候选项，请先重做后再保存');
  }
  for (const item of array(proposal.items)) item.status = 'confirmed';
  touchConversation(conversation);
  return proposal;
}

export function rikiProjectProposalReady(proposal) {
  return !array(proposal?.items).length || proposal.items.every(item => item.status === 'confirmed');
}

export function rikiProjectReplaceProposalContent(conversation, proposalId, content) {
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在');
  const nextContent = rikiProjectClone(content);
  const nextItems = rikiProjectProposalItems(proposal.kind, nextContent);
  proposal.content = nextContent;
  proposal.items = nextItems;
  proposal.status = 'pending';
  touchConversation(conversation);
  return proposal;
}

export function rikiProjectMergeProposalRevision(conversation, proposalId, nextContent) {
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在');
  const currentSource = rikiProjectProposalItemSource(proposal.kind, proposal.content);
  if (!currentSource.length) return rikiProjectReplaceProposalContent(conversation, proposalId, nextContent);
  rikiProjectProposalItems(proposal.kind, nextContent);
  const nextSource = rikiProjectProposalItemSource(proposal.kind, nextContent);
  const rejectedIds = new Set(array(proposal.items).filter(item => item.status === 'rejected').map(item => item.itemId));
  if (!rejectedIds.size) throw new Error('当前没有被打回的子项');
  const replacements = new Map();
  nextSource.forEach((item, index) => replacements.set(
    rikiProjectProposalItemIdentity(proposal.kind, item, index),
    rikiProjectClone(item),
  ));
  const unexpected = [...replacements.keys()].filter(id => !rejectedIds.has(id));
  if (unexpected.length) throw new Error(`模型返回了未被打回的子项：${unexpected.join('、')}；已确认项不会被覆盖`);
  const missing = [...rejectedIds].filter(id => !replacements.has(id));
  if (missing.length) throw new Error(`模型没有返回全部被打回子项：${missing.join('、')}`);
  const mergedSource = currentSource.map((item, index) => {
    const id = rikiProjectProposalItemIdentity(proposal.kind, item, index);
    return rejectedIds.has(id) ? replacements.get(id) : rikiProjectClone(item);
  });
  let mergedContent = rikiProjectClone(proposal.content);
  if (Array.isArray(mergedContent)) mergedContent = mergedSource;
  else if (proposal.kind === 'acts') mergedContent.acts = mergedSource;
  else if (proposal.kind === 'chapters') {
    if (Array.isArray(mergedContent.chapters)) mergedContent.chapters = mergedSource;
    else mergedContent.batch = mergedSource;
  } else if (proposal.kind === 'characters') {
    if (Array.isArray(mergedContent.characters)) mergedContent.characters = mergedSource;
    else mergedContent.detailedCharacters = mergedSource;
  }
  const previousStatuses = new Map(array(proposal.items).map(item => [item.itemId, item.status]));
  const nextItems = rikiProjectProposalItems(proposal.kind, mergedContent).map(item => ({
    ...item,
    status: rejectedIds.has(item.itemId) ? 'pending' : (previousStatuses.get(item.itemId) || 'pending'),
  }));
  proposal.content = mergedContent;
  proposal.items = nextItems;
  proposal.status = 'pending';
  touchConversation(conversation);
  return proposal;
}

export function rikiProjectRejectProposal(state, conversationId, proposalId, reason = '') {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在');
  proposal.status = 'rejected';
  state.decisions.push({
    id: rikiProjectId('decision'),
    type: 'artifact_proposal_rejected',
    kind: proposal.kind,
    proposalId,
    reason: text(reason),
    sourceConversationId: conversation.id,
    at: rikiProjectNow(),
  });
  conversation.pendingProposal = null;
  state.decisions = state.decisions.slice(-RIKI_PROJECT_DECISION_LIMIT);
  touchConversation(conversation);
  touchState(state);
  return proposal;
}

export function rikiProjectProposalIsStale(state, proposal) {
  if (!proposal || !RIKI_PROJECT_ARTIFACT_KINDS.includes(proposal.kind)) return true;
  const current = rikiProjectCurrentArtifact(state, proposal.kind);
  return (current?.versionId || null) !== (proposal.baseVersionId || null);
}

function unique(values) {
  return [...new Set(array(values).map(item => text(item).trim()).filter(Boolean))];
}

function mergeAppendContent(kind, previousContent, nextContent) {
  const previousItems = rikiProjectProposalItemSource(kind, previousContent);
  const nextItems = rikiProjectProposalItemSource(kind, nextContent);
  const previousIds = new Set(previousItems.map((item, index) => rikiProjectProposalItemIdentity(kind, item, index)));
  const duplicateIds = nextItems
    .map((item, index) => rikiProjectProposalItemIdentity(kind, item, index))
    .filter(id => previousIds.has(id));
  if (duplicateIds.length) throw new Error(`增量成果包含已有 ID：${unique(duplicateIds).join('、')}`);
  const mergedItems = [...rikiProjectClone(previousItems), ...rikiProjectClone(nextItems)];
  if (Array.isArray(previousContent)) return mergedItems;
  const merged = { ...rikiProjectClone(previousContent), ...rikiProjectClone(nextContent) };
  if (kind === 'chapters') merged.chapters = mergedItems;
  else if (kind === 'acts') {
    merged.acts = mergedItems;
    if (merged.plan && Array.isArray(merged.plan.skeleton)) {
      const appendedIds = new Set(nextItems.map((item, index) => rikiProjectProposalItemIdentity('acts', item, index)));
      merged.plan.skeleton = merged.plan.skeleton.filter(entry => !appendedIds.has(text(entry?.actId || entry?.act_id || entry?.id)));
    }
  } else if (kind === 'characters') merged.characters = mergedItems;
  return merged;
}

function completedModuleForKind(kind) {
  return {
    outline: 'outline',
    acts: 'act',
    chapters: 'chapter',
    characters: 'character',
  }[kind] || '';
}

export function rikiProjectConfirmArtifactProposal(state, conversationId, proposalId, options = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId) throw new Error('待确认成果不存在或已经变化');
  if (proposal.kind === 'characters' && text(proposal.content?.phase).toLowerCase() === 'rough') {
    throw new Error('人物粗略候选不能直接保存为正式人物成果；请先整批确认粗略版');
  }
  const contentItemIds = rikiProjectProposalItems(proposal.kind, proposal.content).map(item => item.itemId);
  const proposalItemIds = array(proposal.items).map(item => item.itemId);
  if (JSON.stringify(contentItemIds) !== JSON.stringify(proposalItemIds)) {
    throw new Error('候选内容与逐项确认清单已经不一致，请重新建立候选');
  }
  if (!rikiProjectProposalReady(proposal)) throw new Error('批量成果仍有未确认或被打回的子项，不能整体保存');
  if (rikiProjectProposalIsStale(state, proposal)) {
    proposal.status = 'stale';
    throw new Error('另一条 Agent 对话已保存了更新版本；本提案已经过期，请基于最新成果重新生成');
  }
  const store = rikiProjectArtifactStore(state, proposal.kind);
  let confirmedContent = rikiProjectClone(proposal.content);
  if (proposal.mergeMode === 'append') {
    if (!['chapters', 'characters', 'acts'].includes(proposal.kind)) {
      throw new Error(`成果类型 ${proposal.kind} 不允许增量追加`);
    }
    const previous = rikiProjectCurrentArtifact(state, proposal.kind);
    if (!previous) throw new Error('增量追加缺少已确认的基础版本');
    confirmedContent = mergeAppendContent(proposal.kind, previous.content, proposal.content);
  }
  const version = {
    artifactId: proposal.artifactId,
    versionId: rikiProjectId('version', `${proposal.kind}|${proposal.proposalId}`),
    version: nextArtifactVersionNumber(state, proposal.kind),
    kind: proposal.kind,
    baseVersionId: proposal.baseVersionId,
    sourceConversationId: conversation.id,
    content: confirmedContent,
    changeLevel: proposal.changeLevel,
    mergeMode: proposal.mergeMode,
    summary: proposal.summary,
    createdAt: proposal.createdAt,
    confirmedAt: rikiProjectNow(),
    status: 'confirmed',
  };
  if (store.currentVersionId) {
    const previous = store.versions.find(item => item.versionId === store.currentVersionId);
    if (previous) previous.status = 'superseded';
  }
  store.versions.push(version);
  store.currentVersionId = version.versionId;
  proposal.status = 'confirmed';
  conversation.pendingProposal = null;
  for (const branch of state.conversations) {
    if (branch.pendingProposal?.kind === proposal.kind
      && branch.pendingProposal.proposalId !== proposalId
      && rikiProjectProposalIsStale(state, branch.pendingProposal)) {
      branch.pendingProposal.status = 'stale';
    }
  }
  state.decisions.push({
    id: rikiProjectId('decision'),
    type: 'artifact_confirmed',
    kind: proposal.kind,
    versionId: version.versionId,
    sourceConversationId: conversation.id,
    at: rikiProjectNow(),
  });
  state.decisions = state.decisions.slice(-RIKI_PROJECT_DECISION_LIMIT);
  if (proposal.kind === 'outline') state.title = text(version.content?.title || version.content?.storyTitle || state.title);
  const completedModule = completedModuleForKind(proposal.kind);
  if (completedModule) {
    conversation.strategyProgress ||= {};
    conversation.strategyProgress[completedModule] = {
      status: 'confirmed',
      confirmedAt: rikiProjectNow(),
      versionId: version.versionId,
    };
  }
  if (options.advance !== false) rikiProjectSyncConversationStage(state, conversation);
  touchConversation(conversation);
  touchState(state);
  return version;
}

function replaceCharacterSlots(value, replacements, counter) {
  if (typeof value === 'string') {
    let next = value;
    for (const [slot, name] of replacements) {
      const pattern = new RegExp(`\\{\\{\\s*${slot.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*\\}\\}`, 'giu');
      next = next.replace(pattern, () => { counter.count += 1; return name; });
    }
    return next;
  }
  if (Array.isArray(value)) return value.map(item => replaceCharacterSlots(item, replacements, counter));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceCharacterSlots(item, replacements, counter)]));
  return value;
}

export function rikiProjectBackfillCharacterSlots(state, options = {}) {
  const characterVersion = options.characterVersion || rikiProjectCurrentArtifact(state, 'characters');
  const characters = array(characterVersion?.content?.characters || characterVersion?.content?.detailedCharacters);
  const replacements = new Map();
  for (const character of characters) {
    const slot = text(character?.slotRef || character?.slot_ref).replace(/[{}\s]/gu, '').toUpperCase();
    const name = text(character?.name || character?.identity).trim();
    if (/^(?:HIGH|MID)\d+$/u.test(slot) && name) replacements.set(slot, name);
  }
  if (!replacements.size) return [];
  const created = [];
  for (const kind of ['acts', 'chapters']) {
    const current = rikiProjectCurrentArtifact(state, kind);
    if (!current) continue;
    const counter = { count: 0 };
    const content = replaceCharacterSlots(rikiProjectClone(current.content), replacements, counter);
    if (!counter.count) continue;
    current.status = 'superseded';
    const version = {
      ...rikiProjectClone(current),
      versionId: rikiProjectId('version', `${kind}|slot-backfill|${characterVersion?.versionId || rikiProjectNow()}`),
      version: nextArtifactVersionNumber(state, kind),
      baseVersionId: current.versionId,
      sourceConversationId: text(options.conversationId || characterVersion?.sourceConversationId),
      content,
      changeLevel: 'minor',
      mergeMode: 'replace',
      summary: `人物槽位回填：${counter.count} 处`,
      createdAt: rikiProjectNow(),
      confirmedAt: rikiProjectNow(),
      status: 'confirmed',
    };
    const store = rikiProjectArtifactStore(state, kind);
    store.versions.push(version);
    store.currentVersionId = version.versionId;
    created.push(version);
  }
  if (created.length) {
    state.decisions.push({ id: rikiProjectId('decision'), type: 'character_slots_backfilled', characterVersionId: characterVersion?.versionId || '', affectedVersions: created.map(item => item.versionId), replacements: Object.fromEntries(replacements), at: rikiProjectNow() });
    state.decisions = state.decisions.slice(-RIKI_PROJECT_DECISION_LIMIT);
    touchState(state);
  }
  return created;
}

export function rikiProjectConfirmRoughCharacterProposal(state, conversationId, proposalId) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  const proposal = conversation?.pendingProposal;
  if (!proposal || proposal.proposalId !== proposalId || proposal.kind !== 'characters'
    || text(proposal.content?.phase).toLowerCase() !== 'rough') {
    throw new Error('人物粗略候选不存在');
  }
  rikiProjectConfirmAllProposalItems(conversation, proposalId);
  if (!rikiProjectProposalReady(proposal)) throw new Error('人物粗略版仍有未确认或被打回的子项');
  for (const item of proposal.items) {
    state.decisions.push({
      id: rikiProjectId('decision'),
      type: 'character_rough_confirmed',
      characterId: item.itemId,
      content: rikiProjectClone(item.content),
      sourceConversationId: conversation.id,
      at: rikiProjectNow(),
    });
  }
  proposal.status = 'confirmed';
  conversation.pendingProposal = null;
  conversation.stage = 'characters';
  conversation.module = 'character';
  conversation.strategyProgress.character = { status: 'generating', roughConfirmedAt: rikiProjectNow() };
  state.decisions = state.decisions.slice(-RIKI_PROJECT_DECISION_LIMIT);
  touchConversation(conversation);
  touchState(state);
  return proposal.items.map(item => rikiProjectClone(item));
}

function artifactLeafMap(value, path = [], output = new Map()) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      if (!value.length) output.set(JSON.stringify(path), { path, value: [] });
      else value.forEach((item, index) => artifactLeafMap(item, [...path, index], output));
    } else {
      const keys = Object.keys(value);
      if (!keys.length) output.set(JSON.stringify(path), { path, value: {} });
      else keys.forEach(key => artifactLeafMap(value[key], [...path, key], output));
    }
  } else output.set(JSON.stringify(path), { path, value });
  return output;
}

export function rikiProjectArtifactDiff(before, after) {
  const left = artifactLeafMap(before);
  const right = artifactLeafMap(after);
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(key => {
    const previous = left.get(key);
    const next = right.get(key);
    if (JSON.stringify(previous?.value) === JSON.stringify(next?.value)) return [];
    return [{ path: (next || previous)?.path || [], before: previous?.value, after: next?.value }];
  });
}

export function rikiProjectSetArtifactPath(root, path, value) {
  const segments = array(path);
  if (!segments.length) return value;
  if (segments.some(segment => typeof segment === 'string' && isUnsafeObjectKey(segment))) {
    throw new Error('成果路径包含不安全的对象路径关键字');
  }
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = typeof segments[index + 1] === 'number' ? [] : {};
    cursor = cursor[key];
  }
  cursor[segments.at(-1)] = value;
  return root;
}

export function rikiProjectVersionDiff(state, kind, beforeVersionId, afterVersionId = '') {
  const before = rikiProjectArtifactVersion(state, kind, beforeVersionId);
  const after = afterVersionId
    ? rikiProjectArtifactVersion(state, kind, afterVersionId)
    : rikiProjectCurrentArtifact(state, kind);
  if (!before || !after) throw new Error('用于比较的成果版本不存在');
  return rikiProjectArtifactDiff(before.content, after.content);
}

export function rikiProjectCreateArtifactRevisionProposal(state, conversationId, kind, content, options = {}) {
  const current = rikiProjectCurrentArtifact(state, kind);
  if (!current) throw new Error('当前没有可修改的已确认版本');
  const diffs = rikiProjectArtifactDiff(current.content, content);
  if (!diffs.length) throw new Error('没有检测到修改');
  const proposal = rikiProjectProposeArtifact(state, conversationId, kind, content, {
    ...options,
    baseVersionId: current.versionId,
    changeLevel: options.changeLevel || 'major',
    summary: options.summary || `用户从成果工作台修改了 ${diffs.length} 处字段`,
  });
  return { proposal, diffs };
}

export function rikiProjectStage(state) {
  if (!rikiProjectCurrentArtifact(state, 'outline')) return 'discovery';
  if (!rikiProjectCurrentArtifact(state, 'acts')) return 'acts_split';
  if (!rikiProjectCurrentArtifact(state, 'chapters')) return 'chapters';
  if (!rikiProjectCurrentArtifact(state, 'characters')) return 'characters';
  return 'ready';
}

export function rikiProjectModuleForStage(stage) {
  if (['discovery', 'outline_short', 'outline_final'].includes(stage)) return 'outline';
  if (['acts_split', 'acts_detail'].includes(stage)) return 'act';
  if (stage === 'chapters') return 'chapter';
  if (stage === 'characters') return 'character';
  return 'main';
}

export function rikiProjectSyncConversationStage(state, conversationOrId) {
  const conversation = typeof conversationOrId === 'string'
    ? array(state?.conversations).find(item => item.id === conversationOrId)
    : conversationOrId;
  if (!conversation) return rikiProjectStage(state);
  const stage = rikiProjectStage(state);
  if (stage !== 'discovery' || !['outline_short', 'outline_final'].includes(conversation.stage)) conversation.stage = stage;
  conversation.module = rikiProjectModuleForStage(conversation.stage);
  touchConversation(conversation);
  return conversation.stage;
}

export function rikiProjectNextStageAfterArtifact(kind) {
  assertArtifactKind(kind);
  return {
    outline: 'acts_split',
    acts: 'chapters',
    chapters: 'characters',
    characters: 'ready',
  }[kind];
}

export function rikiProjectNextModuleAfterArtifact(kind) {
  return rikiProjectModuleForStage(rikiProjectNextStageAfterArtifact(kind));
}

export function rikiProjectRouteAnalysis(state, conversation, userText = '', explicitModule = '') {
  const source = text(userText);
  const currentModule = Object.hasOwn(RIKI_PROJECT_MODULES, conversation?.module)
    ? conversation.module
    : rikiProjectModuleForStage(rikiProjectStage(state));
  if (Object.hasOwn(RIKI_PROJECT_MODULES, explicitModule)) {
    return { moduleId: explicitModule, candidates: [explicitModule], ambiguous: false, matched: false };
  }
  const actionRoutes = [
    ['outline', /(生成|开始|写|做|拆分|整理|规划|补全|定|重写)\s*[^。！？\n]*(总纲|大纲|主纲)/],
    ['act', /(生成|开始|写|做|拆分|规划|补全|重写)\s*[^。！？\n]*(大章|篇章|分幕)/],
    ['chapter', /(生成|开始|写|做|拆分|规划|补全|重写)\s*[^。！？\n]*(小章|章节|下一批)/],
    ['character', /(生成|开始|写|做|设计|规划|补全|重写)\s*[^。！？\n]*(人物|角色|人设)/],
  ];
  const actionMatches = [];
  for (const [moduleId, pattern] of actionRoutes) {
    const match = source.match(pattern);
    if (match) actionMatches.push({ module: moduleId, end: match.index + match[0].length, index: match.index, phrase: text(match[0]) });
  }
  if (actionMatches.length) {
    const distinct = unique(actionMatches.map(item => item.module));
    const preferred = actionMatches.find(item => item.module === currentModule)
      || actionMatches.reduce((best, item) => (item.end > best.end ? item : best), actionMatches[0]);
    return {
      moduleId: preferred.module,
      candidates: distinct,
      ambiguous: distinct.length > 1 && !actionMatches.some(item => item.module === currentModule),
      matched: true,
      actionMatches,
    };
  }
  const routes = [
    ['character', /人物|角色|外貌|性格|身材|人设/],
    ['chapter', /小章|章节任务|五章|下一批|第\s*\d+\s*章/],
    ['act', /大章|篇章|分幕|幕结构/],
    ['outline', /总纲|大纲|主纲|故事走向|结局|题材|氛围/],
  ];
  const keywordMatches = [];
  for (const [moduleId, pattern] of routes) {
    const match = source.match(pattern);
    if (match) keywordMatches.push({ module: moduleId, index: match.index, phrase: text(match[0]) });
  }
  if (keywordMatches.length) {
    const distinct = unique(keywordMatches.map(item => item.module));
    const preferred = keywordMatches.find(item => item.module === currentModule)
      || keywordMatches.reduce((best, item) => (item.index > best.index ? item : best), keywordMatches[0]);
    return { moduleId: preferred.module, candidates: distinct, ambiguous: false, matched: true, keywordMatches };
  }
  return { moduleId: currentModule, candidates: [], ambiguous: false, matched: false };
}

export function rikiProjectRoute(state, conversation, userText = '', explicitModule = '') {
  return rikiProjectRouteAnalysis(state, conversation, userText, explicitModule).moduleId;
}

export function rikiProjectChangeRequiresConfirmation(kind, previousContent, nextContent) {
  assertArtifactKind(kind);
  if (previousContent === undefined || previousContent === null) return true;
  if (JSON.stringify(previousContent) === JSON.stringify(nextContent)) return false;
  return true;
}

export function rikiProjectDeletionImpact(state, kind) {
  assertArtifactKind(kind);
  const affected = [kind, ...RIKI_PROJECT_ARTIFACT_DEPENDENCIES[kind]];
  return affected.filter(target => !!rikiProjectCurrentArtifact(state, target)).map(target => ({
    kind: target,
    label: artifactKindLabel(target),
    versionId: rikiProjectCurrentArtifact(state, target)?.versionId,
  }));
}

function invalidateLazyBatch(state, reason) {
  if (!state.runtime?.lazyBatch || ['complete', 'rejected'].includes(state.runtime.lazyBatch.status)) return;
  state.runtime.lazyBatch.status = 'invalidated';
  state.runtime.lazyBatch.error = text(reason || '成果变化使当前懒人版批次失效');
}

export function rikiProjectDeleteArtifactBatch(state, kind, reason = '') {
  const impact = rikiProjectDeletionImpact(state, kind);
  if (!impact.length) throw new Error('没有可删除的对应成果');
  const batch = {
    batchId: rikiProjectId('trash', kind),
    kind,
    reason: text(reason),
    deletedAt: rikiProjectNow(),
    restoredAt: null,
    permanentlyDeletedAt: null,
    items: impact.map(item => {
      const store = rikiProjectArtifactStore(state, item.kind);
      const version = store.versions.find(entry => entry.versionId === store.currentVersionId);
      if (version) version.status = 'deleted';
      store.currentVersionId = null;
      return { kind: item.kind, versionId: item.versionId };
    }),
  };
  state.recycleBin.push(batch);
  const affectedKinds = new Set(impact.map(item => item.kind));
  for (const conversation of state.conversations) {
    if (affectedKinds.has(conversation.pendingProposal?.kind)) conversation.pendingProposal.status = 'stale';
    rikiProjectSyncConversationStage(state, conversation);
  }
  invalidateLazyBatch(state, '用户删除了当前批次依赖的成果');
  touchState(state);
  return batch;
}

export function rikiProjectRestoreArtifactBatch(state, batchId) {
  const batch = array(state?.recycleBin).find(item => (
    item.batchId === batchId && !item.restoredAt && !item.permanentlyDeletedAt
  ));
  if (!batch) throw new Error('回收站批次不存在或已经恢复');
  const resolved = batch.items.map(item => {
    const store = rikiProjectArtifactStore(state, item.kind);
    const version = store.versions.find(entry => entry.versionId === item.versionId);
    if (!version) throw new Error(`无法恢复 ${item.kind}：版本已不存在`);
    return { item, store, version };
  });
  for (const { item, store, version } of resolved) {
    const current = rikiProjectCurrentArtifact(state, item.kind);
    if (current && current.versionId !== version.versionId) current.status = 'superseded';
    version.status = 'confirmed';
    store.currentVersionId = version.versionId;
  }
  batch.restoredAt = rikiProjectNow();
  for (const conversation of state.conversations) {
    if (conversation.pendingProposal?.status === 'stale'
      && !rikiProjectProposalIsStale(state, conversation.pendingProposal)) {
      conversation.pendingProposal.status = 'pending';
    }
  }
  for (const conversation of state.conversations) rikiProjectSyncConversationStage(state, conversation);
  touchState(state);
  return batch;
}

export function rikiProjectEmptyRecycleBin(state) {
  const deletedKeys = new Set();
  for (const batch of array(state?.recycleBin)) {
    if (batch.restoredAt || batch.permanentlyDeletedAt) continue;
    batch.permanentlyDeletedAt = rikiProjectNow();
    for (const item of batch.items) deletedKeys.add(`${item.kind}\u0000${item.versionId}`);
  }
  for (const [kind, store] of Object.entries(state.artifacts || {})) {
    store.versions = array(store.versions).filter(item => !deletedKeys.has(`${kind}\u0000${item.versionId}`));
  }
  touchState(state);
  return deletedKeys.size;
}

export function rikiProjectPruneRequestLogs(state, limits = {}) {
  const maximumCount = Math.max(1, Number(limits.count) || RIKI_PROJECT_REQUEST_LOG_LIMIT);
  const maximumCharacters = Math.max(1, Number(limits.characters) || RIKI_PROJECT_REQUEST_LOG_CHAR_LIMIT);
  const logs = array(state?.requestLogs);
  while (logs.length > maximumCount) logs.shift();
  let size = logs.reduce((sum, item) => sum + JSON.stringify(item).length, 0);
  while (logs.length > 1 && size > maximumCharacters) size -= JSON.stringify(logs.shift()).length;
  if (logs.length === 1 && size > maximumCharacters) {
    const source = logs[0];
    const compact = {
      id: text(source.id),
      conversationId: text(source.conversationId),
      module: text(source.module),
      targetModule: text(source.targetModule),
      task: text(source.task),
      status: text(source.status),
      startedAt: text(source.startedAt),
      endedAt: text(source.endedAt),
      truncated: true,
      truncationReason: `单条日志超过 ${maximumCharacters} 字符预算`,
      originalCharacters: size,
    };
    if (isRecord(source.error)) compact.error = rikiProjectSanitizeSecrets(source.error);
    if (JSON.stringify(compact).length <= maximumCharacters) logs[0] = compact;
    else if (maximumCharacters >= 2) logs[0] = {};
    else logs.splice(0, 1);
  }
  state.requestLogs = logs;
  return logs;
}

export function rikiProjectAppendRequestLog(state, entry, limits = {}) {
  const normalized = normalizeRequestLogEntry(entry);
  if (!normalized) throw new Error('请求日志必须是对象');
  state.requestLogs ||= [];
  state.requestLogs.push(normalized);
  rikiProjectPruneRequestLogs(state, limits);
  touchState(state);
  return state.requestLogs.at(-1) || null;
}

export function rikiProjectRequestLogById(state, logId) {
  return array(state?.requestLogs).find(item => item.id === logId) || null;
}

export function rikiProjectClearConversationRequestLogs(state, conversationId) {
  const logs = array(state?.requestLogs);
  const retained = logs.filter(item => item?.conversationId !== conversationId);
  state.requestLogs = retained;
  touchState(state);
  return logs.length - retained.length;
}

export function rikiProjectClearAllRequestLogs(state) {
  const removed = array(state?.requestLogs).length;
  state.requestLogs = [];
  touchState(state);
  return removed;
}

export function rikiProjectBuildRequestLogExport(state, options = {}) {
  const logs = array(state?.requestLogs).filter(item => (
    !options.conversationId || item.conversationId === options.conversationId
  ));
  return rikiProjectSanitizeSecrets({
    format: 'riki_request_logs_v1',
    exportedAt: rikiProjectNow(),
    projectId: text(state?.projectId),
    conversationId: text(options.conversationId),
    logs,
  });
}

function lazySnapshot(state, conversation) {
  return {
    artifacts: rikiProjectClone(state.artifacts),
    decisions: rikiProjectClone(state.decisions),
    title: state.title,
    conversation: {
      id: conversation.id,
      messageCount: conversation.messages.length,
      stage: conversation.stage,
      module: conversation.module,
      pendingProposal: rikiProjectClone(conversation.pendingProposal),
      strategyProgress: rikiProjectClone(conversation.strategyProgress || {}),
    },
    branchStates: state.conversations.map(branch => ({
      id: branch.id,
      stage: branch.stage,
      module: branch.module,
      pendingProposal: rikiProjectClone(branch.pendingProposal),
      pendingContentConfirmation: rikiProjectClone(branch.pendingContentConfirmation),
      strategyProgress: rikiProjectClone(branch.strategyProgress || {}),
    })),
  };
}

function restoreLazySnapshot(state, conversation, snapshot) {
  if (!isRecord(snapshot)) throw new Error('懒人版回滚快照不存在');
  state.artifacts = rikiProjectClone(snapshot.artifacts);
  state.decisions = rikiProjectClone(snapshot.decisions);
  state.title = text(snapshot.title);
  if (conversation) {
    conversation.messages.splice(Math.max(0, Number(snapshot.conversation?.messageCount) || 0));
    conversation.stage = RIKI_PROJECT_STAGES.includes(snapshot.conversation?.stage) ? snapshot.conversation.stage : 'discovery';
    conversation.module = Object.hasOwn(RIKI_PROJECT_MODULES, snapshot.conversation?.module) ? snapshot.conversation.module : 'outline';
    conversation.pendingProposal = rikiProjectClone(snapshot.conversation?.pendingProposal || null);
    conversation.pendingContentConfirmation = rikiProjectClone(snapshot.conversation?.pendingContentConfirmation || null);
    conversation.strategyProgress = rikiProjectClone(snapshot.conversation?.strategyProgress || {});
  }
  for (const saved of array(snapshot.branchStates)) {
    const branch = state.conversations.find(item => item.id === saved?.id);
    if (!branch) continue;
    branch.stage = RIKI_PROJECT_STAGES.includes(saved.stage) ? saved.stage : branch.stage;
    branch.module = Object.hasOwn(RIKI_PROJECT_MODULES, saved.module) ? saved.module : branch.module;
    branch.pendingProposal = rikiProjectClone(saved.pendingProposal || null);
    branch.pendingContentConfirmation = rikiProjectClone(saved.pendingContentConfirmation || null);
    branch.strategyProgress = rikiProjectClone(saved.strategyProgress || {});
  }
  reconcileProposalStaleness(state);
}

function reconcileProposalStaleness(state) {
  for (const branch of array(state?.conversations)) {
    const proposal = branch.pendingProposal;
    if (!proposal) continue;
    if (rikiProjectProposalIsStale(state, proposal)) proposal.status = 'stale';
    else if (proposal.status === 'stale') proposal.status = 'pending';
  }
}

export function rikiProjectStartLazyBatch(state, conversationId, options = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  if (!conversation) throw new Error('Agent 对话不存在');
  if (conversation.strategyMode !== 'lazy') throw new Error('当前对话不是懒人版');
  const existing = state.runtime?.lazyBatch;
  if (existing && !['complete', 'rejected'].includes(existing.status)) {
    throw new Error('已有懒人版批次尚未收口；失败批次请显式继续、撤销或清除，不能覆盖原始回滚点');
  }
  state.runtime ||= createRuntime();
  const batch = {
    batchId: rikiProjectId('lazy_batch'),
    conversationId: conversation.id,
    status: 'generating',
    startedAt: rikiProjectNow(),
    completedAt: '',
    failedAt: '',
    confirmedAt: '',
    rejectedAt: '',
    error: '',
    requirement: text(options.requirement),
    snapshot: lazySnapshot(state, conversation),
    currentStep: null,
    failedStep: null,
    generated: [],
    steps: RIKI_PROJECT_LAZY_STEPS.map(descriptor => {
      const current = rikiProjectCurrentArtifact(state, descriptor.kind);
      return {
        ...descriptor,
        status: current ? 'reused' : 'pending',
        versionId: current?.versionId || '',
        startedAt: '',
        completedAt: current ? rikiProjectNow() : '',
        error: '',
      };
    }),
    lastCheckpointAt: '',
  };
  state.runtime.lazyBatch = batch;
  touchState(state);
  return batch;
}

export function rikiProjectResumeLazyBatch(state, conversationId, options = {}) {
  const conversation = array(state?.conversations).find(item => item.id === conversationId);
  const batch = state?.runtime?.lazyBatch;
  if (!conversation || !batch || batch.conversationId !== conversationId) throw new Error('待继续的懒人版批次不存在');
  if (!['failed', 'invalidated'].includes(batch.status)) throw new Error('只有失败或失效的懒人版批次可以继续');
  if (!isRecord(batch.snapshot)) throw new Error('原始回滚快照不存在，不能安全继续该批次');
  for (const step of array(batch.steps)) {
    const current = rikiProjectCurrentArtifact(state, step.kind);
    if (current && ['complete', 'reused'].includes(step.status) && current.versionId === step.versionId) continue;
    if (current && batch.generated.some(item => item.kind === step.kind && item.versionId === current.versionId)) {
      step.status = 'complete';
      step.versionId = current.versionId;
      continue;
    }
    step.status = current ? 'reused' : 'pending';
    step.versionId = current?.versionId || '';
    step.startedAt = '';
    step.completedAt = current ? rikiProjectNow() : '';
    step.error = '';
  }
  batch.status = 'generating';
  batch.resumedAt = rikiProjectNow();
  batch.error = '';
  batch.failedAt = '';
  batch.failedStep = null;
  batch.currentStep = null;
  if (text(options.requirement).trim()) batch.requirement = text(options.requirement).trim();
  touchConversation(conversation);
  touchState(state);
  return batch;
}

export function rikiProjectStartLazyStep(state, kind) {
  assertArtifactKind(kind);
  const batch = state?.runtime?.lazyBatch;
  if (!batch || batch.status !== 'generating') throw new Error('没有正在生成的懒人版批次');
  const descriptor = RIKI_PROJECT_LAZY_STEPS.find(item => item.kind === kind);
  if (batch.currentStep?.status === 'generating') throw new Error(`懒人版步骤 ${artifactKindLabel(batch.currentStep.kind)} 尚未完成`);
  const expected = array(batch.steps).find(step => ['pending', 'failed'].includes(step.status));
  if (!expected) throw new Error('懒人版没有待生成步骤');
  if (expected.kind !== kind) throw new Error(`懒人版必须按顺序先处理：${artifactKindLabel(expected.kind)}`);
  const step = batch.steps.find(item => item.kind === kind);
  Object.assign(step, { ...descriptor, status: 'generating', versionId: '', startedAt: rikiProjectNow(), completedAt: '', error: '' });
  batch.currentStep = step;
  touchState(state);
  return batch.currentStep;
}

export function rikiProjectCompleteLazyStep(state, kind, versionId) {
  const batch = state?.runtime?.lazyBatch;
  if (!batch || batch.status !== 'generating' || batch.currentStep?.kind !== kind) {
    throw new Error('懒人版当前步骤与待完成成果不一致');
  }
  const version = rikiProjectArtifactVersion(state, kind, versionId);
  if (!version || version.status !== 'confirmed') throw new Error('懒人版步骤缺少已确认成果断点');
  if (!batch.generated.some(item => item.kind === kind && item.versionId === versionId)) {
    batch.generated.push({ kind, versionId });
  }
  const step = batch.steps.find(item => item.kind === kind);
  Object.assign(step, { status: 'complete', versionId, completedAt: rikiProjectNow(), continuation: 'auto_next_module', error: '' });
  batch.currentStep = step;
  batch.lastCheckpointAt = rikiProjectNow();
  touchState(state);
  return batch.currentStep;
}

export function rikiProjectFailLazyBatch(state, error) {
  const batch = state?.runtime?.lazyBatch;
  if (!batch || batch.status !== 'generating') throw new Error('只有正在生成的懒人版批次可以标记失败');
  batch.status = 'failed';
  batch.failedAt = rikiProjectNow();
  batch.error = text(error?.message || error);
  batch.failedStep = rikiProjectClone(batch.currentStep || null);
  const step = batch.steps?.find(item => item.kind === batch.currentStep?.kind);
  if (step) {
    step.status = 'failed';
    step.error = batch.error;
  }
  batch.currentStep = null;
  touchState(state);
  return batch;
}

export function rikiProjectCompleteLazyBatch(state, options = {}) {
  const batch = state?.runtime?.lazyBatch;
  if (!batch || batch.status !== 'generating') throw new Error('没有正在生成的懒人版批次');
  if (batch.currentStep?.status === 'generating') throw new Error('懒人版当前步骤尚未完成');
  const missingKinds = array(batch.steps).filter(step => {
    if (!['complete', 'reused'].includes(step.status)) return true;
    return rikiProjectCurrentArtifact(state, step.kind)?.versionId !== step.versionId;
  }).map(step => step.kind);
  if (missingKinds.length) throw new Error(`懒人版仍缺少成果：${missingKinds.map(artifactKindLabel).join('、')}`);
  batch.status = options.awaitConfirmation === false ? 'complete' : 'awaiting_confirmation';
  batch.completedAt = rikiProjectNow();
  batch.currentStep = null;
  touchState(state);
  return batch;
}

export function rikiProjectConfirmLazyBatch(state) {
  const batch = state?.runtime?.lazyBatch;
  if (!batch || batch.status !== 'awaiting_confirmation') throw new Error('没有等待统一确认的懒人版批次');
  batch.status = 'complete';
  batch.confirmedAt = rikiProjectNow();
  batch.snapshot = null;
  touchState(state);
  return batch;
}

export function rikiProjectRejectLazyBatch(state) {
  const batch = state?.runtime?.lazyBatch;
  if (!batch || !['awaiting_confirmation', 'failed', 'generating', 'invalidated'].includes(batch.status)) {
    throw new Error('没有可撤销的懒人版批次');
  }
  const conversation = array(state.conversations).find(item => item.id === batch.conversationId);
  restoreLazySnapshot(state, conversation, batch.snapshot);
  const result = { ...rikiProjectClone(batch), status: 'rejected', rejectedAt: rikiProjectNow() };
  state.runtime.lazyBatch = null;
  touchConversation(conversation);
  touchState(state);
  return result;
}

export function rikiProjectClearLazyBatch(state) {
  const previous = state?.runtime?.lazyBatch || null;
  if (state?.runtime) state.runtime.lazyBatch = null;
  touchState(state);
  return previous;
}

function exportConversationDescriptor(conversation) {
  return rikiProjectSanitizeSecrets({
    id: text(conversation?.id),
    title: text(conversation?.title),
    stage: RIKI_PROJECT_STAGES.includes(conversation?.stage) ? conversation.stage : 'discovery',
    module: Object.hasOwn(RIKI_PROJECT_MODULES, conversation?.module) ? conversation.module : 'outline',
    strategyMode: normalizeStrategyMode(conversation?.strategyMode, ''),
    strategyProgress: isRecord(conversation?.strategyProgress) ? conversation.strategyProgress : {},
    detailLevels: normalizeDetailLevels(conversation?.detailLevels),
    preferences: isRecord(conversation?.preferences) ? conversation.preferences : {},
    preferenceMeta: isRecord(conversation?.preferenceMeta) ? conversation.preferenceMeta : {},
    createdAt: text(conversation?.createdAt),
    updatedAt: text(conversation?.updatedAt),
  });
}

function exportVersion(version) {
  return rikiProjectSanitizeSecrets({
    artifactId: text(version.artifactId),
    versionId: text(version.versionId),
    version: Math.max(1, Number(version.version) || 1),
    baseVersionId: text(version.baseVersionId) || null,
    sourceConversationId: text(version.sourceConversationId),
    changeLevel: version.changeLevel === 'major' ? 'major' : 'minor',
    mergeMode: version.mergeMode === 'append' ? 'append' : 'replace',
    summary: text(version.summary),
    content: version.content,
    createdAt: text(version.createdAt),
    confirmedAt: text(version.confirmedAt),
    status: version.status === 'confirmed' ? 'confirmed' : 'superseded',
  });
}

/**
 * Export only portable project data.  Device model bindings, API presets,
 * request logs, messages, runtime jobs, and world-book host state are omitted.
 */
export function rikiProjectBuildExport(state) {
  const artifacts = {};
  for (const kind of RIKI_PROJECT_ARTIFACT_KINDS) {
    const store = rikiProjectArtifactStore(state, kind);
    const current = rikiProjectCurrentArtifact(state, kind);
    const versions = current
      ? store.versions.filter(version => version.status !== 'deleted').map(exportVersion)
      : [];
    artifacts[kind] = {
      currentVersionId: versions.some(version => version.versionId === current?.versionId)
        ? current.versionId
        : null,
      versions,
    };
  }
  return rikiProjectSanitizeSecrets({
    format: RIKI_PROJECT_EXPORT_FORMAT,
    exporterVersion: text(state?.scriptVersion || '1.3.2'),
    exportedAt: rikiProjectNow(),
    title: text(state?.title),
    projectId: text(state?.projectId),
    artifacts,
    decisions: array(state?.decisions).slice(-RIKI_PROJECT_DECISION_LIMIT),
    conversations: array(state?.conversations).map(exportConversationDescriptor),
  });
}

function rawArtifactVersions(rawArtifacts, kind) {
  const source = rawArtifacts?.[kind];
  if (Array.isArray(source)) return { currentVersionId: '', versions: source };
  if (isRecord(source)) return {
    currentVersionId: text(source.currentVersionId),
    versions: array(source.versions),
  };
  return { currentVersionId: '', versions: [] };
}

function normalizeExportConversation(raw, index) {
  const source = rikiProjectSanitizeSecrets(isRecord(raw) ? raw : {});
  const preferences = isRecord(source.preferences) ? source.preferences : {};
  return {
    id: text(source.id || `imported_conversation_${index + 1}`),
    title: text(source.title).trim().slice(0, 60) || `导入对话 ${index + 1}`,
    stage: RIKI_PROJECT_STAGES.includes(source.stage) ? source.stage : 'discovery',
    module: Object.hasOwn(RIKI_PROJECT_MODULES, source.module) ? source.module : 'outline',
    strategyMode: normalizeStrategyMode(source.strategyMode, ''),
    strategyProgress: isRecord(source.strategyProgress) ? source.strategyProgress : {},
    detailLevels: normalizeDetailLevels(source.detailLevels),
    preferences,
    preferenceMeta: normalizePreferenceMeta(preferences, source.preferenceMeta, source.updatedAt || source.createdAt),
    createdAt: text(source.createdAt || rikiProjectNow()),
    updatedAt: text(source.updatedAt || source.createdAt || rikiProjectNow()),
  };
}

export function rikiProjectNormalizeExport(raw) {
  const acceptedFormats = new Set([
    RIKI_PROJECT_EXPORT_FORMAT,
    'riki_story_project_v1',
    'riki_project_export_v1',
  ]);
  if (!isRecord(raw) || !acceptedFormats.has(raw.format)) {
    throw new Error(`不是有效的 Riki 项目导出文件（format 应为 ${RIKI_PROJECT_EXPORT_FORMAT}）`);
  }
  const legacyDatabase = raw.artifacts?.database;
  if ((Array.isArray(legacyDatabase) && legacyDatabase.length)
    || (isRecord(legacyDatabase) && array(legacyDatabase.versions).length)) {
    throw new Error('该文件包含旧版 database 成果；Riki 1.2 项目核心禁止导入数据库资产');
  }
  const artifacts = {};
  for (const kind of RIKI_PROJECT_ARTIFACT_KINDS) {
    const source = rawArtifactVersions(raw.artifacts, kind);
    const seen = new Set();
    const versions = source.versions.map((item, index) => normalizeVersion(
      rikiProjectSanitizeSecrets(item),
      kind,
      index,
    )).filter(Boolean);
    for (const version of versions) {
      if (!seen.has(version.versionId)) seen.add(version.versionId);
      else {
        version.versionId = rikiProjectId('version', `${kind}|import-dedupe`);
        seen.add(version.versionId);
      }
    }
    let currentVersionId = source.currentVersionId;
    if (!versions.some(item => item.versionId === currentVersionId && item.status !== 'deleted')) {
      currentVersionId = versions.filter(item => item.status === 'confirmed').at(-1)?.versionId
        || versions.filter(item => item.status !== 'deleted').at(-1)?.versionId
        || null;
    }
    for (const version of versions) {
      if (version.versionId === currentVersionId) version.status = 'confirmed';
      else version.status = 'superseded';
    }
    artifacts[kind] = { currentVersionId, versions };
  }
  if (!Object.values(artifacts).some(store => store.versions.length)) {
    throw new Error('导出文件中没有任何已确认成果');
  }
  return {
    format: RIKI_PROJECT_EXPORT_FORMAT,
    title: text(raw.title),
    projectId: text(raw.projectId),
    artifacts,
    decisions: array(raw.decisions).filter(isRecord).map(rikiProjectSanitizeSecrets),
    conversations: array(raw.conversations).map(normalizeExportConversation),
  };
}

function moveAllCurrentArtifactsToTrash(state, reason) {
  const items = RIKI_PROJECT_ARTIFACT_KINDS.flatMap(kind => {
    const store = rikiProjectArtifactStore(state, kind);
    const current = rikiProjectCurrentArtifact(state, kind);
    if (!current) return [];
    current.status = 'deleted';
    store.currentVersionId = null;
    return [{ kind, versionId: current.versionId }];
  });
  if (!items.length) return null;
  const batch = {
    batchId: rikiProjectId('trash', 'project_import'),
    kind: 'project_import',
    reason: text(reason || '导入项目时整批替换'),
    deletedAt: rikiProjectNow(),
    restoredAt: null,
    permanentlyDeletedAt: null,
    items,
  };
  state.recycleBin.push(batch);
  return batch;
}

function applyImportedConversationDescriptor(target, descriptor) {
  target.title = descriptor.title;
  target.stage = descriptor.stage;
  target.module = descriptor.module;
  target.strategyMode = descriptor.strategyMode;
  target.strategyProgress = rikiProjectClone(descriptor.strategyProgress);
  target.detailLevels = normalizeDetailLevels(descriptor.detailLevels);
  target.preferences = rikiProjectClone(descriptor.preferences);
  target.preferenceMeta = normalizePreferenceMeta(target.preferences, descriptor.preferenceMeta, descriptor.updatedAt);
  target.createdAt = descriptor.createdAt;
  target.updatedAt = rikiProjectNow();
  target.pendingProposal = null;
  target.pendingContentConfirmation = null;
  return target;
}

function importConversationDescriptors(state, descriptors, options) {
  const idMap = new Map();
  if (!descriptors.length || options.importConversations === false) {
    const target = rikiProjectActiveConversation(state);
    const first = descriptors[0];
    if (first && target) {
      target.preferences = rikiProjectClone(first.preferences);
      target.preferenceMeta = normalizePreferenceMeta(target.preferences, first.preferenceMeta, first.updatedAt);
    }
    for (const descriptor of descriptors) idMap.set(descriptor.id, target?.id || '');
    return { idMap, imported: target && first ? [target] : [] };
  }
  const current = rikiProjectActiveConversation(state);
  const canReuse = options.reuseEmptyConversation !== false
    && state.conversations.length === 1
    && current
    && !current.messages.length
    && !Object.keys(current.preferences || {}).length
    && !current.strategyMode;
  const imported = [];
  descriptors.forEach((descriptor, index) => {
    let target;
    if (index === 0 && canReuse) target = current;
    else {
      target = rikiProjectCreateConversation(descriptor.title, {
        strategyMode: descriptor.strategyMode,
        detailLevels: descriptor.detailLevels,
        stage: descriptor.stage,
        module: descriptor.module,
      });
      state.conversations.push(target);
    }
    applyImportedConversationDescriptor(target, descriptor);
    idMap.set(descriptor.id, target.id);
    imported.push(target);
  });
  if ((canReuse || options.activateImported === true) && imported[0]) state.activeConversationId = imported[0].id;
  return { idMap, imported };
}

function uniqueImportedVersionId(store, desired, kind) {
  if (desired && !store.versions.some(item => item.versionId === desired)) return desired;
  let candidate;
  do candidate = rikiProjectId('version', `${kind}|import`);
  while (store.versions.some(item => item.versionId === candidate));
  return candidate;
}

export function rikiProjectApplyImport(state, raw, options = {}) {
  const data = rikiProjectNormalizeExport(raw);
  const existing = RIKI_PROJECT_ARTIFACT_KINDS.filter(kind => !!rikiProjectCurrentArtifact(state, kind));
  if (existing.length && options.replace !== true) {
    throw new Error('当前项目已有已确认成果；必须明确选择“替换导入”才能继续');
  }
  const trashBatch = existing.length ? moveAllCurrentArtifactsToTrash(state, '导入项目时整批替换') : null;
  const { idMap: conversationIdMap, imported: importedConversations } = importConversationDescriptors(
    state,
    data.conversations,
    options,
  );
  const fallbackConversation = importedConversations[0] || rikiProjectActiveConversation(state);
  const importedKinds = [];
  let versionCount = 0;
  for (const kind of RIKI_PROJECT_ARTIFACT_KINDS) {
    const source = data.artifacts[kind];
    if (!source.versions.length) continue;
    importedKinds.push(kind);
    const store = rikiProjectArtifactStore(state, kind);
    const versionIdMap = new Map();
    const hasExistingHistory = store.versions.length > 0;
    let nextNumber = store.versions.reduce((maximum, item) => Math.max(maximum, Number(item.version) || 0), 0) + 1;
    const imported = source.versions.map(item => {
      const versionId = uniqueImportedVersionId(store, item.versionId, kind);
      versionIdMap.set(item.versionId, versionId);
      const mappedConversation = conversationIdMap.get(item.sourceConversationId) || fallbackConversation?.id || '';
      const version = {
        ...rikiProjectClone(item),
        versionId,
        version: hasExistingHistory ? nextNumber++ : item.version,
        sourceConversationId: mappedConversation,
        kind,
        status: 'superseded',
      };
      store.versions.push(version);
      return version;
    });
    for (const version of imported) {
      version.baseVersionId = versionIdMap.get(version.baseVersionId) || version.baseVersionId || null;
    }
    const mappedCurrentId = versionIdMap.get(source.currentVersionId) || imported.at(-1)?.versionId || null;
    const current = store.versions.find(item => item.versionId === mappedCurrentId);
    if (current) current.status = 'confirmed';
    store.currentVersionId = current?.versionId || null;
    versionCount += imported.length;
  }
  const importedDecisions = data.decisions.map(decision => ({
    ...rikiProjectClone(decision),
    sourceConversationId: conversationIdMap.get(decision.sourceConversationId)
      || fallbackConversation?.id
      || '',
  }));
  state.decisions = [...array(state.decisions), ...importedDecisions].slice(-RIKI_PROJECT_DECISION_LIMIT);
  if (data.title) state.title = data.title;
  for (const branch of state.conversations) {
    branch.pendingProposal = null;
    branch.pendingContentConfirmation = null;
    rikiProjectSyncConversationStage(state, branch);
  }
  state.runtime = createRuntime();
  state.decisions.push({
    id: rikiProjectId('decision'),
    type: 'project_imported',
    importedKinds,
    versionCount,
    importedConversationCount: importedConversations.length,
    sourceProjectId: data.projectId,
    at: rikiProjectNow(),
  });
  state.decisions = state.decisions.slice(-RIKI_PROJECT_DECISION_LIMIT);
  touchState(state);
  return {
    importedKinds,
    versionCount,
    importedConversationCount: importedConversations.length,
    trashBatchId: trashBatch?.batchId || '',
  };
}
