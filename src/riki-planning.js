export const RIKI_PLANNING_MODULES = Object.freeze({
  main: { label: '主控 Agent', icon: '⌘', artifactKind: '', description: '访谈、讨论、判断意图并路由到合适的策划模块。' },
  outline: { label: '总纲 Agent', icon: '纲', artifactKind: 'outline', description: '题材定位、主线因果、伏笔回收、结局与自由探索边界。' },
  act: { label: '大章 Agent', icon: '幕', artifactKind: 'acts', description: '把总纲拆成带稳定 ID、目标、冲突、结果与衔接的大章。' },
  chapter: { label: '小章 Agent', icon: '章', artifactKind: 'chapters', description: '滚动设计可执行小章、事件、人物作用、收尾状态与钩子。' },
  character: { label: '人物 Agent', icon: '人', artifactKind: 'characters', description: '按证据分档设计身份、动机、行为、关系、边界和知识范围。' },
  progression_preset: { label: '推进预设 Agent', icon: '推', artifactKind: 'progression_preset', description: '形成节奏、连续性、防剧透和玩家主动权规则成果，不安装数据库。' },
  format_guard: { label: '格式编译 Agent', icon: '{}', artifactKind: '', description: '把已生成草稿机械映射为成果结构，不补写新事实。' },
});

export const RIKI_ARTIFACT_KINDS = Object.freeze(['outline', 'acts', 'chapters', 'characters', 'progression_preset']);
export const RIKI_LAZY_SEQUENCE = Object.freeze(['outline', 'act', 'chapter', 'character', 'progression_preset']);

const MODULE_KEYWORDS = Object.freeze([
  ['progression_preset', /推进预设|推进规则|节奏规则|防剧透|玩家主动权/u],
  ['character', /人物|角色|人设|动机|性格|关系|外貌|知识边界/u],
  ['chapter', /小章|章节|下一章|五章|章节任务|章纲/u],
  ['act', /大章|篇章|分幕|幕结构|卷纲/u],
  ['outline', /总纲|大纲|主线|题材|故事走向|结局|伏笔/u],
]);

const ACTION_PATTERN = /(生成|开始|写|做|拆分|规划|补全|修改|重写|设计|整理|推进)/u;

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compactJson(value, max = 24000) {
  const raw = JSON.stringify(value, null, 2);
  return raw.length <= max ? raw : `${raw.slice(0, max)}\n…（项目上下文已截断）`;
}

export function rikiPlanningRoute(project, conversation, userText = '', explicitModule = '') {
  if (RIKI_PLANNING_MODULES[explicitModule] && explicitModule !== 'format_guard') {
    return { moduleId: explicitModule, candidates: [explicitModule], ambiguous: false, source: 'explicit' };
  }
  const input = text(userText);
  const current = RIKI_PLANNING_MODULES[conversation?.module] && conversation.module !== 'format_guard'
    ? conversation.module
    : rikiPlanningModuleForStage(rikiPlanningStage(project));
  const matched = MODULE_KEYWORDS.flatMap(([moduleId, pattern]) => {
    const match = input.match(pattern);
    return match ? [{ moduleId, index: match.index || 0, action: ACTION_PATTERN.test(input.slice(Math.max(0, (match.index || 0) - 16), (match.index || 0) + match[0].length + 16)) }] : [];
  });
  if (!matched.length) return { moduleId: current || 'main', candidates: [], ambiguous: false, source: 'stage' };
  const candidates = [...new Set(matched.map(item => item.moduleId))];
  const currentMatch = matched.find(item => item.moduleId === current);
  const chosen = currentMatch || matched.sort((left, right) => Number(right.action) - Number(left.action) || right.index - left.index)[0];
  return {
    moduleId: chosen.moduleId,
    candidates,
    ambiguous: candidates.length > 1 && !currentMatch,
    source: chosen.action ? 'action-keyword' : 'keyword',
  };
}

export function rikiPlanningStage(project) {
  const current = kind => {
    const store = project?.artifacts?.[kind];
    return array(store?.versions).some(version => version.status === 'confirmed' && version.versionId === store.currentVersionId);
  };
  if (!current('outline')) return 'discovery';
  if (!current('acts')) return 'acts';
  if (!current('chapters')) return 'chapters';
  if (!current('characters')) return 'characters';
  if (!current('progression_preset')) return 'progression';
  return 'ready';
}

export function rikiPlanningModuleForStage(stage) {
  return ({ discovery: 'outline', acts: 'act', chapters: 'chapter', characters: 'character', progression: 'progression_preset', ready: 'main' })[stage] || 'main';
}

export function rikiModeContract(mode, moduleId, detailLevels = {}) {
  const detail = detailLevels[moduleId] || detailLevels[{ act: 'act', chapter: 'chapter', outline: 'outline' }[moduleId]] || 'normal';
  const normalizedMode = mode === 'rough' ? 'brief' : mode;
  const modeName = ({ detailed: '详细版', brief: '粗略版', lazy: '懒人版' })[normalizedMode] || '详细版';
  const detailName = ({ concise: '精简', normal: '一般', detailed: '详细' })[detail] || '一般';
  if (normalizedMode === 'brief') {
    return `当前工作流：${modeName}。先给结构骨架和关键决策，不填充无证据细节；人物先按上/中/下档输出粗略候选，中上档逐人确认后再精细化。模块密度：${detailName}。`;
  }
  if (normalizedMode === 'lazy') {
    return `当前工作流：${modeName}。本轮是自动流水线中的一个确定步骤；直接交付可确认成果，不反问、不只给按钮、不跳到数据库/二创/安装。模块密度：${detailName}。`;
  }
  return `当前工作流：${modeName}。先讨论和澄清，再在用户明确要求生成/保存时形成正式候选；任何候选都必须经过确认。模块密度：${detailName}。`;
}

export function rikiArtifactSchemaHint(kind) {
  const hints = {
    outline: {
      title: '故事标题', premise: '一句话核心命题', genre: ['题材标签'], themes: ['主题'],
      mainConflict: '主线矛盾与因果链', fullOutline: '完整总纲正文',
      foreshadowing: [{ id: 'F-001', setup: '伏笔', payoffWindow: '回收窗口' }],
      endings: [{ id: 'E-001', condition: '触发条件', outcome: '结局' }], playerFreedom: '自由探索边界',
    },
    acts: {
      acts: [{ actId: 'ACT-001', title: '大章名', goal: '阶段目标', conflict: '核心冲突', routes: ['路线/可选任务'], requiredEvents: ['必发事件'], outcome: '阶段结果', nextHook: '下章衔接' }],
    },
    chapters: {
      chapters: [{ chapterId: 'CH-001', actId: 'ACT-001', title: '小章名', timeRange: '时间范围', goals: { required: [], normal: [], optional: [] }, characters: [{ characterId: 'CHAR-001', purpose: '出场作用' }], events: ['关键事件'], knowledgeBoundary: '信息边界', endState: '收尾状态', nextHook: '下一章钩子' }],
    },
    characters: {
      phase: 'rough 或 detailed', characters: [{ characterId: 'CHAR-001', name: '人物名', tier: '上档/中档/下档', identity: '身份', appearanceAnchors: [], personalityBehaviors: [], goals: [], motivation: '动机', bottomLine: '底线', knowledgeBoundary: '知识边界', relationships: [], secrets: [] }],
    },
    progression_preset: {
      title: '推进规则名', visibleRules: ['可告知玩家的规则'], backstageRules: ['幕后规则'], pacing: '节奏偏好', continuity: ['连续性注意点'], spoilerPolicy: '防剧透策略', playerAgency: '不替玩家决定的硬边界',
    },
  };
  return hints[kind] ? compactJson(hints[kind]) : '{}';
}

export function rikiModuleSystemPrompt(moduleId, { mode = 'detailed', detailLevels = {} } = {}) {
  const module = RIKI_PLANNING_MODULES[moduleId] || RIKI_PLANNING_MODULES.main;
  const common = `你是 Riki 剧情工作台中的${module.label}。你只处理虚构故事策划：保持事实、人物动机、时间、信息边界与因果链一致；候选不是已经发生的事实；不替玩家决定关键行动；发现与已确认成果或世界书冲突时明确指出。不要进入数据库、MVU、记忆引擎、灵感二创、生图或素材库任务。不要输出隐藏思维链，只给可核验结论和必要理由。`;
  if (moduleId === 'main') {
    return `${common}\n\n你的职责是访谈、讨论、总结偏好并选择模块。若用户要正式生成成果，明确说明建议路由到总纲/大章/小章/人物/推进预设中的哪一个；不要自己伪造已保存成果。`;
  }
  if (moduleId === 'format_guard') {
    return `${common}\n\n你是机械格式编译器。只把 source_draft 中已有事实映射到用户给出的目标 JSON 结构；不能新增、删除或改写事实。输出且只输出 <riki_artifact>合法 JSON</riki_artifact>。`;
  }
  const kind = module.artifactKind;
  return `${common}\n\n${rikiModeContract(mode, moduleId, detailLevels)}\n\n当用户仅讨论时，正常中文回复，不输出机器块。当用户明确要求生成、保存、形成正式版本，回复可读摘要后追加：\n<riki_artifact>\n{"kind":"${kind}","summary":"本次候选摘要","changeLevel":"major 或 minor","mergeMode":"replace 或 append","content":这里放成果 JSON}\n</riki_artifact>\n\n目标 content 结构示意：\n${rikiArtifactSchemaHint(kind)}\n\n稳定 ID 一旦引用必须逐字复用；不要用数组下标代替业务 ID。`;
}

export function rikiBuildPlanningContext({ project, conversation, worldbookContext = '', includeArtifacts = true }) {
  const blocks = [];
  if (worldbookContext) blocks.push(worldbookContext);
  const preferences = conversation?.preferences && typeof conversation.preferences === 'object' ? conversation.preferences : {};
  blocks.push(`<branch_preferences>\n${compactJson(preferences, 10000)}\n</branch_preferences>`);
  if (includeArtifacts) {
    const artifacts = {};
    for (const kind of RIKI_ARTIFACT_KINDS) {
      const store = project?.artifacts?.[kind];
      const version = array(store?.versions).find(item => item.versionId === store.currentVersionId && item.status === 'confirmed');
      if (version) artifacts[kind] = { versionId: version.versionId, version: version.version, content: version.content };
    }
    blocks.push(`<confirmed_project_artifacts>\n${compactJson(artifacts, 30000)}\n</confirmed_project_artifacts>`);
  }
  blocks.push(`<workflow_state>\n${compactJson({ mode: conversation?.strategyMode || conversation?.workflowMode || 'detailed', stage: rikiPlanningStage(project), module: conversation?.module || 'main', detailLevels: conversation?.detailLevels || {} }, 4000)}\n</workflow_state>`);
  return blocks.join('\n\n');
}

export function rikiBuildPlanningMessages({ project, conversation, moduleId, userText, worldbookContext = '', systemContent = '' }) {
  const resolvedModule = RIKI_PLANNING_MODULES[moduleId] ? moduleId : 'main';
  const history = array(conversation?.messages)
    .filter(message => ['user', 'assistant'].includes(message.role) && message.status !== 'deleted')
    .slice(-24)
    .map(message => ({ role: message.role, content: text(message.content) }));
  return [
    { role: 'system', content: systemContent || rikiModuleSystemPrompt(resolvedModule, { mode: conversation?.strategyMode || conversation?.workflowMode, detailLevels: conversation?.detailLevels }) },
    { role: 'system', content: rikiBuildPlanningContext({ project, conversation, worldbookContext }) },
    ...history,
    { role: 'user', content: text(userText) },
  ];
}

function parseJsonCandidate(raw) {
  const candidate = text(raw).trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
  if (!candidate) return null;
  try { return JSON.parse(candidate); } catch (_) { return null; }
}

export function rikiParseArtifactEnvelope(rawText, expectedKind = '') {
  const raw = text(rawText);
  const tagged = raw.match(/<riki_artifact>\s*([\s\S]*?)\s*<\/riki_artifact>/iu);
  let envelope = tagged ? parseJsonCandidate(tagged[1]) : null;
  if (!envelope) {
    const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)].map(match => parseJsonCandidate(match[1])).find(value => value?.kind && value?.content !== undefined);
    envelope = fenced || null;
  }
  if (!envelope || typeof envelope !== 'object') return { visibleText: raw.trim(), artifact: null, errors: [] };
  const kind = text(envelope.kind);
  const errors = [];
  if (!RIKI_ARTIFACT_KINDS.includes(kind)) errors.push(`未知成果类型：${kind || '空'}`);
  if (expectedKind && kind !== expectedKind) errors.push(`成果类型应为 ${expectedKind}，实际为 ${kind || '空'}`);
  if (!envelope.content || typeof envelope.content !== 'object') errors.push('成果 content 必须是对象或数组');
  const visibleText = tagged ? raw.replace(tagged[0], '').trim() : raw.trim();
  if (errors.length) return { visibleText, artifact: null, errors };
  return {
    visibleText,
    errors: [],
    artifact: {
      kind,
      summary: text(envelope.summary || `${RIKI_PLANNING_MODULES[Object.keys(RIKI_PLANNING_MODULES).find(id => RIKI_PLANNING_MODULES[id].artifactKind === kind)]?.label || kind}候选`),
      changeLevel: envelope.changeLevel === 'minor' ? 'minor' : 'major',
      mergeMode: envelope.mergeMode === 'append' ? 'append' : 'replace',
      content: clone(envelope.content),
    },
  };
}

export function rikiBuildFormatGuardMessages({ targetModuleId, sourceDraft, project, conversation }) {
  const module = RIKI_PLANNING_MODULES[targetModuleId];
  const kind = module?.artifactKind;
  if (!kind) throw new Error('格式编译缺少目标成果模块');
  return [
    { role: 'system', content: rikiModuleSystemPrompt('format_guard') },
    { role: 'user', content: `<target_kind>${kind}</target_kind>\n<target_schema>\n${rikiArtifactSchemaHint(kind)}\n</target_schema>\n<source_draft>\n${text(sourceDraft)}\n</source_draft>\n<confirmed_context>\n${rikiBuildPlanningContext({ project, conversation, includeArtifacts: true })}\n</confirmed_context>` },
  ];
}

export function rikiPlanningTaskText(moduleId, workflowMode, options = {}) {
  const label = RIKI_PLANNING_MODULES[moduleId]?.label || moduleId;
  const action = options.reviseRejected ? '只重做被打回的子项，并逐字保留已确认子项与稳定 ID'
    : options.reroll ? '基于上一条用户要求重新生成一个不同但兼容已确认事实的候选'
      : '生成本阶段可确认的正式候选';
  return `${label}任务：${action}。当前模式为 ${workflowMode || 'detailed'}。必须输出可读摘要和 <riki_artifact> 机器块；不得跳到数据库、安装或二创。${options.extra ? `\n补充要求：${text(options.extra)}` : ''}`;
}
