import assert from 'node:assert/strict';
import * as core from '../src/riki-project-core.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function makeState(chatKey = 'chat-a') {
  return core.rikiProjectCreateState({ chatKey, projectId: `project-${chatKey}`, scriptVersion: '1.1.0' });
}

function active(state) {
  return core.rikiProjectActiveConversation(state);
}

function confirmProposal(state, conversation, kind, content, options = {}) {
  const proposal = core.rikiProjectProposeArtifact(state, conversation, kind, content, options);
  core.rikiProjectConfirmAllProposalItems(conversation, proposal.proposalId);
  return core.rikiProjectConfirmArtifactProposal(state, conversation.id, proposal.proposalId, options);
}

function seedCompleteProject(state = makeState()) {
  const conversation = active(state);
  confirmProposal(state, conversation, 'outline', { title: '测试故事', premise: '起点' });
  confirmProposal(state, conversation, 'acts', { acts: [{ actId: 'ACT001', title: '第一幕' }] });
  confirmProposal(state, conversation, 'chapters', { chapters: [{ chapterId: 'CH001', actId: 'ACT001', title: '第一章' }] });
  confirmProposal(state, conversation, 'characters', { phase: 'detailed', characters: [{ characterId: 'CHAR001', name: '甲' }] });
  return state;
}

test('模块和成果白名单严格排除数据库、推进预设与二创', () => {
  assert.deepEqual(Object.keys(core.RIKI_PROJECT_MODULES), [
    'main', 'outline', 'act', 'chapter', 'character', 'format_guard',
  ]);
  assert.deepEqual(core.RIKI_PROJECT_ARTIFACT_KINDS, [
    'outline', 'acts', 'chapters', 'characters',
  ]);
  assert.equal(Object.hasOwn(core.RIKI_PROJECT_MODULES, 'database_design'), false);
  assert.equal(Object.hasOwn(core.RIKI_PROJECT_MODULES, 'progression_preset'), false);
  assert.equal(core.RIKI_PROJECT_ARTIFACT_KINDS.includes('database'), false);
});

test('1.1 项目升级会丢弃推进预设成果、绑定、消息模块和懒人步骤', () => {
  const raw = core.rikiProjectCreateState({ chatKey: 'legacy-progression', scriptVersion: '1.1.0' });
  raw.artifacts.progression_preset = { currentVersionId: 'progression-v1', versions: [{ versionId: 'progression-v1', kind: 'progression_preset', status: 'confirmed', content: { rules: '旧规则' } }] };
  raw.config.modules.progression_preset = { apiPresetId: 'tavern-current', model: 'legacy-model', systemPresetId: 'builtin_progression_preset' };
  raw.conversations[0].module = 'progression_preset';
  raw.conversations[0].messages.push({ id: 'legacy-message', role: 'assistant', module: 'progression_preset', agentRole: 'progression_preset', content: '旧推进内容' });
  raw.runtime.lazyBatch = {
    batchId: 'legacy-lazy', conversationId: raw.conversations[0].id, status: 'failed',
    generated: [{ kind: 'progression_preset', versionId: 'progression-v1' }],
    steps: [{ kind: 'progression_preset', moduleId: 'progression_preset', status: 'complete', versionId: 'progression-v1' }],
    snapshot: null,
  };
  const normalized = core.rikiProjectNormalizeState(raw, { chatKey: 'legacy-progression', scriptVersion: '1.2.0' });
  assert.equal(Object.hasOwn(normalized.artifacts, 'progression_preset'), false);
  assert.equal(Object.hasOwn(normalized.config.modules, 'progression_preset'), false);
  assert.equal(normalized.conversations[0].module, 'outline');
  assert.equal(normalized.conversations[0].messages[0].module, '');
  assert.equal(normalized.conversations[0].messages[0].agentRole, '');
  assert.equal(normalized.runtime.lazyBatch.generated.some(item => item.kind === 'progression_preset'), false);
  assert.equal(normalized.runtime.lazyBatch.steps.some(item => item.kind === 'progression_preset'), false);
});

test('新项目建立聊天隔离、四类成果仓与非敏感模型绑定', () => {
  const state = makeState();
  assert.equal(state.chatKey, 'chat-a');
  assert.equal(state.projectId, 'project-chat-a');
  assert.deepEqual(Object.keys(state.artifacts), core.RIKI_PROJECT_ARTIFACT_KINDS);
  assert.equal(state.conversations.length, 1);
  assert.equal(active(state).title, '故事策划');
  assert.equal(state.config.main.systemPresetId, 'builtin_controller');
  assert.equal(state.config.modules.format_guard.systemPresetId, 'builtin_format_guard');
  assert.equal(Object.hasOwn(state.config, 'apiKey'), false);
});

test('状态归一化只保留非敏感模型 ID 并剔除旧数据库形状', () => {
  const raw = makeState();
  raw.artifacts.database = { currentVersionId: 'db-v1', versions: [{ versionId: 'db-v1', content: { tables: [] }, status: 'confirmed' }] };
  raw.config = {
    apiKey: 'sk-config-secret-12345678',
    main: { apiPresetId: 'profile-main', model: 'gpt-main', systemPresetId: '' },
    default: { apiPresetId: 'AIza1234567890abcdefghijklmnopqrst', model: 'sk-model-secret-12345678', systemPresetId: 'hf_abcdefghijklmnopqrstuvwxyz' },
    modules: {
      outline: { apiPresetId: 'profile-outline', model: 'gpt-outline', systemPresetId: 'custom-outline', apiKey: 'sk-module-secret-12345678' },
      database_design: { apiPresetId: 'forbidden' },
    },
  };
  const state = core.rikiProjectNormalizeState(raw, { chatKey: 'chat-a' });
  assert.equal(Object.hasOwn(state.artifacts, 'database'), false);
  assert.equal(Object.hasOwn(state.config, 'apiKey'), false);
  assert.equal(Object.hasOwn(state.config.modules, 'database_design'), false);
  assert.deepEqual(state.config.main, { apiPresetId: 'profile-main', model: 'gpt-main', systemPresetId: '' });
  assert.deepEqual(state.config.modules.outline, {
    apiPresetId: 'profile-outline', model: 'gpt-outline', systemPresetId: 'custom-outline',
  });
  assert.equal(state.config.default.model, '');
  assert.equal(state.config.default.apiPresetId, '');
  assert.equal(state.config.default.systemPresetId, '');
  assert.equal(JSON.stringify(state.config).includes('sk-module-secret'), false);
});

test('聊天身份不匹配时不串档并建立全新项目', () => {
  const raw = makeState('chat-a');
  raw.title = '不应串入';
  const normalized = core.rikiProjectNormalizeState(raw, { chatKey: 'chat-b', projectId: 'new-project' });
  assert.equal(normalized.chatKey, 'chat-b');
  assert.equal(normalized.projectId, 'new-project');
  assert.equal(normalized.title, '');
});

test('分支新建、复制偏好、切换、重命名和删除保持正式成果共享', () => {
  const state = makeState();
  const first = active(state);
  core.rikiProjectUpsertPreference(state, first.id, '题材', '奇幻');
  const second = core.rikiProjectAddConversation(state, { copyPreferences: true });
  assert.notEqual(second.id, first.id);
  assert.equal(second.preferences.题材, '奇幻');
  assert.equal(second.preferenceMeta.题材.source, 'copied');
  second.preferences.题材 = '科幻';
  assert.equal(first.preferences.题材, '奇幻');
  core.rikiProjectRenameConversation(state, second.id, '另一种走向');
  assert.equal(second.title, '另一种走向');
  core.rikiProjectSetActiveConversation(state, first.id);
  assert.equal(active(state).id, first.id);
  confirmProposal(state, first, 'outline', { title: '共享成果' });
  core.rikiProjectDeleteConversation(state, first.id);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').content.title, '共享成果');
  assert.equal(state.conversations.length, 1);
});

test('删除最后一个分支会自动补一个可用分支', () => {
  const state = makeState();
  const onlyId = active(state).id;
  core.rikiProjectDeleteConversation(state, onlyId);
  assert.equal(state.conversations.length, 1);
  assert.notEqual(active(state).id, onlyId);
});

test('详细版、粗略版、懒人版状态和旧别名归一正确', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'rough');
  assert.equal(conversation.strategyMode, 'brief');
  assert.equal(core.rikiProjectStrategyNextAction(conversation, 'outline'), 'ask_once');
  core.rikiProjectSetStrategyProgress(state, conversation.id, 'outline', 'asked');
  assert.equal(core.rikiProjectStrategyNextAction(conversation, 'outline'), 'generate');
  core.rikiProjectAppendUserMessage(state, conversation.id, '开始');
  assert.throws(() => core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy'), /不能再修改/);
  const normalized = core.rikiProjectNormalizeState({ ...state, conversations: [{ ...conversation, strategyMode: 'normal' }] }, { chatKey: 'chat-a' });
  assert.equal(active(normalized).strategyMode, 'detailed');
});

test('偏好推测、确认、重命名、批量确认和清空完整工作', () => {
  const state = makeState();
  const id = active(state).id;
  core.rikiProjectUpsertPreference(state, id, '氛围', '压抑', { status: 'inferred', source: 'model' });
  core.rikiProjectUpsertPreference(state, id, '爽度', '高');
  assert.deepEqual(core.rikiProjectInferredPreferences(active(state)), { 氛围: '压抑' });
  assert.deepEqual(core.rikiProjectConfirmedPreferences(active(state)), { 爽度: '高' });
  core.rikiProjectConfirmPreference(state, id, '氛围');
  core.rikiProjectUpsertPreference(state, id, '整体氛围', '热血', { oldKey: '氛围' });
  assert.equal(Object.hasOwn(active(state).preferences, '氛围'), false);
  assert.equal(active(state).preferences.整体氛围, '热血');
  assert.equal(core.rikiProjectConfirmAllPreferences(state, id), 2);
  assert.equal(core.rikiProjectDeletePreference(state, id, '爽度'), true);
  assert.equal(core.rikiProjectClearPreferences(state, id), 1);
});

test('消息编辑会截断后续并返回重生成描述', () => {
  const state = makeState();
  const conversation = active(state);
  const firstUser = core.rikiProjectAppendUserMessage(state, conversation.id, '原问题');
  core.rikiProjectAppendAssistantMessage(state, conversation.id, '原回答', {
    module: 'outline', request: { task: 'chat', saveArtifactRequested: false },
  });
  core.rikiProjectAppendUserMessage(state, conversation.id, '后续问题');
  core.rikiProjectAppendAssistantMessage(state, conversation.id, '后续回答');
  const result = core.rikiProjectEditUserMessage(state, conversation.id, firstUser.id, '修改问题');
  assert.equal(conversation.messages.length, 1);
  assert.equal(conversation.messages[0].content, '修改问题');
  assert.equal(result.removed.length, 3);
  assert.deepEqual(result.reroll, {
    userText: '修改问题', moduleId: 'outline', task: 'chat', saveArtifactRequested: false,
  });
});

test('助手重 Roll 会保留对应用户消息并删除该回复之后全部消息', () => {
  const state = makeState();
  const conversation = active(state);
  const user = core.rikiProjectAppendUserMessage(state, conversation.id, '问题');
  const assistant = core.rikiProjectAppendAssistantMessage(state, conversation.id, '回答', {
    module: 'act', request: { task: 'acts_generate', saveArtifactRequested: true },
  });
  core.rikiProjectAppendUserMessage(state, conversation.id, '尾消息');
  const reroll = core.rikiProjectPrepareReroll(state, conversation.id, assistant.id);
  assert.equal(conversation.messages.length, 1);
  assert.equal(conversation.messages[0].id, user.id);
  assert.equal(reroll.userText, '问题');
  assert.equal(reroll.moduleId, 'act');
  assert.equal(reroll.saveArtifactRequested, true);
});

test('删除用户消息级联删除紧随其后的助手回复', () => {
  const state = makeState();
  const conversation = active(state);
  const user = core.rikiProjectAppendUserMessage(state, conversation.id, '问题');
  core.rikiProjectAppendAssistantMessage(state, conversation.id, '回答');
  const removed = core.rikiProjectDeleteMessage(state, conversation.id, user.id);
  assert.equal(removed.length, 2);
  assert.equal(conversation.messages.length, 0);
});

test('中断的格式编译消息归一为可手动修复草稿', () => {
  const message = core.rikiProjectNormalizeMessage({
    role: 'assistant', content: '可见正文', status: 'compiling', module: 'outline', request: { task: 'outline_final' },
  });
  assert.equal(message.status, 'draft_invalid');
  assert.equal(message.repair.available, true);
  assert.equal(message.repair.mode, 'compiler_only');
});

test('总纲正式提案保存为版本并推进项目阶段', () => {
  const state = makeState();
  const conversation = active(state);
  const version = confirmProposal(state, conversation, 'outline', { title: '长夜' });
  assert.equal(version.version, 1);
  assert.equal(version.status, 'confirmed');
  assert.equal(state.title, '长夜');
  assert.equal(core.rikiProjectStage(state), 'acts_split');
  assert.equal(conversation.module, 'act');
  assert.equal(conversation.strategyProgress.outline.status, 'confirmed');
});

test('并行分支使用 stale base 检查阻止覆盖较新正式版本', () => {
  const state = makeState();
  const first = active(state);
  confirmProposal(state, first, 'outline', { title: 'v1' });
  const second = core.rikiProjectAddConversation(state, { title: '并行分支' });
  const proposalA = core.rikiProjectProposeArtifact(state, first, 'outline', { title: 'v2-A' });
  const proposalB = core.rikiProjectProposeArtifact(state, second, 'outline', { title: 'v2-B' });
  core.rikiProjectConfirmArtifactProposal(state, first.id, proposalA.proposalId);
  assert.equal(proposalB.status, 'stale');
  assert.throws(
    () => core.rikiProjectConfirmArtifactProposal(state, second.id, proposalB.proposalId),
    /已经过期/,
  );
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').content.title, 'v2-A');
});

test('大章逐项确认、打回、只重做被打回项并冻结已确认项', () => {
  const state = makeState();
  const conversation = active(state);
  confirmProposal(state, conversation, 'outline', { title: '故事' });
  const proposal = core.rikiProjectProposeArtifact(state, conversation, 'acts', {
    acts: [{ actId: 'ACT001', title: '一' }, { actId: 'ACT002', title: '二' }],
  });
  core.rikiProjectSetProposalItemStatus(conversation, proposal.proposalId, 'ACT001', 'confirmed');
  core.rikiProjectSetProposalItemStatus(conversation, proposal.proposalId, 'ACT002', 'rejected');
  assert.throws(() => core.rikiProjectConfirmArtifactProposal(state, conversation.id, proposal.proposalId), /未确认或被打回/);
  core.rikiProjectMergeProposalRevision(conversation, proposal.proposalId, {
    acts: [{ actId: 'ACT002', title: '二（重做）' }],
  });
  assert.equal(proposal.items.find(item => item.itemId === 'ACT001').status, 'confirmed');
  assert.equal(proposal.items.find(item => item.itemId === 'ACT002').status, 'pending');
  assert.equal(proposal.content.acts[0].title, '一');
  assert.equal(proposal.content.acts[1].title, '二（重做）');
  core.rikiProjectSetProposalItemStatus(conversation, proposal.proposalId, 'ACT002', 'confirmed');
  const version = core.rikiProjectConfirmArtifactProposal(state, conversation.id, proposal.proposalId);
  assert.equal(version.content.acts.length, 2);
});

test('同一批成果中的重复稳定 ID 在建立提案时即被拒绝', () => {
  const state = makeState();
  const conversation = active(state);
  assert.throws(() => core.rikiProjectProposeArtifact(state, conversation, 'acts', {
    acts: [{ actId: 'ACT001', title: '一' }, { actId: 'ACT001', title: '重复' }],
  }), /重复稳定 ID/);
  assert.equal(conversation.pendingProposal, null);
});

test('替换候选内容先校验后赋值，失败不会污染原候选且确认前再次防御复验', () => {
  const state = makeState();
  const conversation = active(state);
  const proposal = core.rikiProjectProposeArtifact(state, conversation, 'acts', {
    acts: [{ actId: 'ACT001', title: '原一' }, { actId: 'ACT002', title: '原二' }],
  });
  const original = structuredClone(proposal.content);
  assert.throws(() => core.rikiProjectReplaceProposalContent(conversation, proposal.proposalId, {
    acts: [{ actId: 'ACT001' }, { actId: 'ACT001' }],
  }), /重复稳定 ID/);
  assert.deepEqual(proposal.content, original);
  assert.deepEqual(proposal.items.map(item => item.itemId), ['ACT001', 'ACT002']);
  core.rikiProjectConfirmAllProposalItems(conversation, proposal.proposalId);
  proposal.content = { acts: [{ actId: 'ACT001' }, { actId: 'ACT001' }] };
  assert.throws(() => core.rikiProjectConfirmArtifactProposal(state, conversation.id, proposal.proposalId), /重复稳定 ID/);
});

test('重做返回未被打回项或遗漏被打回项时明确拒绝', () => {
  const state = makeState();
  const conversation = active(state);
  const proposal = core.rikiProjectProposeArtifact(state, conversation, 'chapters', {
    chapters: [{ chapterId: 'CH001' }, { chapterId: 'CH002' }],
  });
  core.rikiProjectSetProposalItemStatus(conversation, proposal.proposalId, 'CH002', 'rejected');
  assert.throws(() => core.rikiProjectMergeProposalRevision(conversation, proposal.proposalId, {
    chapters: [{ chapterId: 'CH001' }, { chapterId: 'CH002' }],
  }), /未被打回/);
  assert.throws(() => core.rikiProjectMergeProposalRevision(conversation, proposal.proposalId, { chapters: [] }), /没有返回全部/);
});

test('大章增量追加保留旧项、移除已补全骨架并拒绝重复 ID', () => {
  const state = makeState();
  const conversation = active(state);
  confirmProposal(state, conversation, 'outline', { title: '故事' });
  confirmProposal(state, conversation, 'acts', {
    acts: [{ actId: 'ACT001', title: '一' }],
    plan: { skeleton: [{ actId: 'ACT002', title: '二' }] },
  });
  const append = core.rikiProjectProposeArtifact(state, conversation, 'acts', {
    acts: [{ actId: 'ACT002', title: '二' }],
  }, { mergeMode: 'append' });
  core.rikiProjectConfirmAllProposalItems(conversation, append.proposalId);
  const version = core.rikiProjectConfirmArtifactProposal(state, conversation.id, append.proposalId);
  assert.deepEqual(version.content.acts.map(item => item.actId), ['ACT001', 'ACT002']);
  assert.deepEqual(version.content.plan.skeleton, []);
  const duplicate = core.rikiProjectProposeArtifact(state, conversation, 'acts', {
    acts: [{ actId: 'ACT002', title: '重复' }],
  }, { mergeMode: 'append' });
  core.rikiProjectConfirmAllProposalItems(conversation, duplicate.proposalId);
  assert.throws(() => core.rikiProjectConfirmArtifactProposal(state, conversation.id, duplicate.proposalId), /已有 ID/);
});

test('人物粗略版只为中上档建立逐项门并不保存正式人物成果', () => {
  const state = makeState();
  const conversation = active(state);
  const proposal = core.rikiProjectProposeArtifact(state, conversation, 'characters', {
    phase: 'rough',
    characters: [
      { characterId: 'HIGH1', name: '主角', tier: '上档' },
      { characterId: 'LOW1', name: '路人', tier: '下档' },
    ],
  });
  assert.deepEqual(proposal.items.map(item => item.itemId), ['HIGH1']);
  assert.throws(() => core.rikiProjectConfirmArtifactProposal(state, conversation.id, proposal.proposalId), /粗略候选/);
  const confirmed = core.rikiProjectConfirmRoughCharacterProposal(state, conversation.id, proposal.proposalId);
  assert.equal(confirmed.length, 1);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'characters'), null);
  assert.equal(state.decisions.some(item => item.type === 'character_rough_confirmed'), true);
  assert.equal(conversation.strategyProgress.character.status, 'generating');
});

test('成果工作台 Diff 和修改候选保持当前版本不可直接覆盖', () => {
  const state = makeState();
  const conversation = active(state);
  const v1 = confirmProposal(state, conversation, 'outline', { title: 'A', nested: { value: 1 } });
  const { proposal, diffs } = core.rikiProjectCreateArtifactRevisionProposal(
    state,
    conversation.id,
    'outline',
    { title: 'B', nested: { value: 2 } },
  );
  assert.equal(proposal.baseVersionId, v1.versionId);
  assert.equal(diffs.length, 2);
  const patched = core.rikiProjectSetArtifactPath({ nested: { value: 1 } }, ['nested', 'value'], 3);
  assert.equal(patched.nested.value, 3);
});

test('成果路径编辑拒绝 prototype pollution 关键路径', () => {
  assert.equal(({}).rikiPolluted, undefined);
  assert.throws(() => core.rikiProjectSetArtifactPath({}, ['__proto__', 'rikiPolluted'], 'yes'), /不安全/);
  assert.throws(() => core.rikiProjectSetArtifactPath({}, ['constructor', 'prototype', 'rikiPolluted'], 'yes'), /不安全/);
  assert.equal(({}).rikiPolluted, undefined);
  const sanitized = core.rikiProjectSanitizeSecrets(JSON.parse('{"safe":1,"__proto__":{"rikiPolluted":"yes"}}'));
  assert.deepEqual(sanitized, { safe: 1 });
});

test('级联删除进入一个回收站批次并可整批恢复', () => {
  const state = seedCompleteProject();
  const impact = core.rikiProjectDeletionImpact(state, 'acts');
  assert.deepEqual(impact.map(item => item.kind), ['acts', 'chapters', 'characters']);
  const batch = core.rikiProjectDeleteArtifactBatch(state, 'acts', '重做结构');
  assert.equal(batch.items.length, 3);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').content.title, '测试故事');
  assert.equal(core.rikiProjectCurrentArtifact(state, 'acts'), null);
  assert.equal(core.rikiProjectStage(state), 'acts_split');
  core.rikiProjectRestoreArtifactBatch(state, batch.batchId);
  assert.equal(core.rikiProjectStage(state), 'ready');
  assert.equal(core.rikiProjectCurrentArtifact(state, 'characters').content.characters[0].name, '甲');
});

test('删除后恢复同一基础版本会把已不再过期的候选重置为 pending', () => {
  const state = makeState();
  const conversation = active(state);
  confirmProposal(state, conversation, 'outline', { title: 'v1' });
  const proposal = core.rikiProjectProposeArtifact(state, conversation, 'outline', { title: 'v2' });
  const batch = core.rikiProjectDeleteArtifactBatch(state, 'outline');
  assert.equal(proposal.status, 'stale');
  core.rikiProjectRestoreArtifactBatch(state, batch.batchId);
  assert.equal(core.rikiProjectProposalIsStale(state, proposal), false);
  assert.equal(proposal.status, 'pending');
});

test('永久清空回收站只移除未恢复批次中的版本', () => {
  const state = seedCompleteProject();
  const batch = core.rikiProjectDeleteArtifactBatch(state, 'outline');
  assert.equal(batch.items.length, 4);
  assert.equal(core.rikiProjectEmptyRecycleBin(state), 4);
  assert.equal(state.artifacts.outline.versions.length, 0);
  assert.throws(() => core.rikiProjectRestoreArtifactBatch(state, batch.batchId), /不存在或已经恢复/);
});

test('回收站恢复先完整预检，缺失任一版本时不会半恢复', () => {
  const state = seedCompleteProject();
  const batch = core.rikiProjectDeleteArtifactBatch(state, 'acts');
  const missing = batch.items.at(-1);
  state.artifacts[missing.kind].versions = state.artifacts[missing.kind].versions.filter(item => item.versionId !== missing.versionId);
  assert.throws(() => core.rikiProjectRestoreArtifactBatch(state, batch.batchId), /版本已不存在/);
  for (const item of batch.items.slice(0, -1)) {
    assert.equal(state.artifacts[item.kind].currentVersionId, null);
    assert.equal(state.artifacts[item.kind].versions.find(version => version.versionId === item.versionId).status, 'deleted');
  }
  assert.equal(batch.restoredAt, null);
});

test('永久清空回收站用 kind+versionId 复合键，不误删其他成果同名版本', () => {
  const state = seedCompleteProject();
  const outline = core.rikiProjectCurrentArtifact(state, 'outline');
  const characters = core.rikiProjectCurrentArtifact(state, 'characters');
  characters.versionId = outline.versionId;
  state.artifacts.characters.currentVersionId = outline.versionId;
  const batch = core.rikiProjectDeleteArtifactBatch(state, 'characters');
  assert.equal(batch.items[0].versionId, outline.versionId);
  assert.equal(core.rikiProjectEmptyRecycleBin(state), 1);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').versionId, outline.versionId);
  assert.equal(state.artifacts.outline.versions.some(version => version.versionId === outline.versionId), true);
});

test('请求日志在写入时脱敏并按条数与体积裁剪', () => {
  const state = makeState();
  core.rikiProjectAppendRequestLog(state, { id: '1', module: 'outline', apiKey: 'sk-secret-one-12345678', rawOutput: 'ok' }, { count: 2, characters: 10_000 });
  core.rikiProjectAppendRequestLog(state, { id: '2', module: 'database_design', authorization: 'Bearer abcdefghijk', rawOutput: 'ok' }, { count: 2, characters: 10_000 });
  core.rikiProjectAppendRequestLog(state, { id: '3', module: 'act', rawOutput: 'Bearer token-token-token' }, { count: 2, characters: 10_000 });
  state.requestLogs[0] = core.rikiProjectSanitizeSecrets({ ...state.requestLogs[0], headers: { 'x-goog-api-key': 'google-secret-value' } });
  assert.deepEqual(state.requestLogs.map(item => item.id), ['2', '3']);
  assert.equal(state.requestLogs[0].module, '');
  const serialized = JSON.stringify(state.requestLogs);
  assert.equal(serialized.includes('sk-secret'), false);
  assert.equal(serialized.includes('abcdefghijk'), false);
  assert.equal(serialized.includes('google-secret-value'), false);
  assert.equal(core.rikiProjectRequestLogById(state, '3').id, '3');
  const exported = JSON.stringify(core.rikiProjectBuildRequestLogExport(state));
  assert.equal(exported.includes('token-token-token'), false);
  assert.equal(core.rikiProjectClearAllRequestLogs(state), 2);
});

test('单条超大请求日志也严格服从体积预算并留下明确截断标记', () => {
  const state = makeState();
  const stored = core.rikiProjectAppendRequestLog(state, {
    id: 'huge', module: 'outline', rawOutput: 'x'.repeat(4_000), status: 'complete',
  }, { count: 30, characters: 400 });
  assert.equal(state.requestLogs.length, 1);
  assert.equal(JSON.stringify(state.requestLogs).length <= 402, true);
  assert.equal(stored.truncated, true);
  assert.equal(stored.originalCharacters > 4_000, true);
});

test('深层日志脱敏覆盖 apiToken、私钥类字段和常见 HF/Gemini token 文本', () => {
  const state = makeState();
  core.rikiProjectAppendRequestLog(state, {
    id: 'secrets',
    nested: { apiToken: 'hf_abcdefghijklmnopqrstuvwxyz', privateKey: 'private-value' },
    rawOutput: 'hf_abcdefghijklmnopqrstuvwxyz AIza1234567890abcdefghijklmnopqrst',
  });
  const serialized = JSON.stringify(core.rikiProjectBuildRequestLogExport(state));
  assert.equal(serialized.includes('apiToken'), false);
  assert.equal(serialized.includes('private-value'), false);
  assert.equal(serialized.includes('hf_abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(serialized.includes('AIza1234567890'), false);
});

test('项目导出保留完整版本链和全部分支偏好但排除配置、日志、消息和密钥', () => {
  const state = makeState();
  const first = active(state);
  core.rikiProjectUpsertPreference(state, first.id, '题材', '悬疑');
  const v1 = confirmProposal(state, first, 'outline', { title: 'v1', apiKey: 'sk-artifact-secret-12345678' });
  const v2 = confirmProposal(state, first, 'outline', { title: 'v2' });
  assert.equal(v1.status, 'superseded');
  assert.equal(v2.status, 'confirmed');
  const second = core.rikiProjectAddConversation(state, { copyPreferences: true, title: '支线' });
  core.rikiProjectAppendUserMessage(state, second.id, '不应导出的聊天');
  state.config.main.apiPresetId = 'device-profile';
  state.decisions.push({ type: 'note', accessToken: 'secret-access-token' });
  core.rikiProjectAppendRequestLog(state, { id: 'log', apiKey: 'sk-log-secret-12345678' });
  const exported = core.rikiProjectBuildExport(state);
  assert.equal(exported.artifacts.outline.versions.length, 2);
  assert.equal(exported.artifacts.outline.currentVersionId, v2.versionId);
  assert.equal(exported.conversations.length, 2);
  assert.equal(exported.conversations[0].preferences.题材, '悬疑');
  assert.equal(Object.hasOwn(exported, 'config'), false);
  assert.equal(Object.hasOwn(exported, 'requestLogs'), false);
  assert.equal(Object.hasOwn(exported.conversations[1], 'messages'), false);
  const serialized = JSON.stringify(exported);
  assert.equal(serialized.includes('sk-artifact-secret'), false);
  assert.equal(serialized.includes('secret-access-token'), false);
  assert.equal(serialized.includes('device-profile'), false);
  assert.equal(serialized.includes('database'), false);
});

test('项目导入恢复完整版本链、分支偏好和来源映射', () => {
  const source = makeState('source');
  const first = active(source);
  core.rikiProjectSetStrategyMode(source, first.id, 'detailed');
  core.rikiProjectUpsertPreference(source, first.id, '题材', '冒险');
  confirmProposal(source, first, 'outline', { title: 'v1' });
  confirmProposal(source, first, 'outline', { title: 'v2' });
  core.rikiProjectAddConversation(source, { title: '第二分支', copyPreferences: true });
  const payload = core.rikiProjectBuildExport(source);
  const target = makeState('target');
  const result = core.rikiProjectApplyImport(target, payload);
  assert.deepEqual(result.importedKinds, ['outline']);
  assert.equal(result.versionCount, 2);
  assert.equal(result.importedConversationCount, 2);
  assert.equal(target.artifacts.outline.versions.length, 2);
  assert.equal(core.rikiProjectCurrentArtifact(target, 'outline').content.title, 'v2');
  assert.equal(target.conversations.length, 2);
  assert.equal(target.conversations[0].preferences.题材, '冒险');
  assert.equal(target.artifacts.outline.versions.every(version => target.conversations.some(item => item.id === version.sourceConversationId)), true);
});

test('已有成果导入必须显式替换且旧成果以单批进入回收站', () => {
  const source = makeState('source');
  confirmProposal(source, active(source), 'outline', { title: '导入成果' });
  const payload = core.rikiProjectBuildExport(source);
  const target = makeState('target');
  confirmProposal(target, active(target), 'outline', { title: '本地旧成果' });
  confirmProposal(target, active(target), 'acts', { acts: [{ actId: 'A1' }] });
  assert.throws(() => core.rikiProjectApplyImport(target, payload), /替换导入/);
  const result = core.rikiProjectApplyImport(target, payload, { replace: true });
  assert.ok(result.trashBatchId);
  const batch = target.recycleBin.find(item => item.batchId === result.trashBatchId);
  assert.deepEqual(batch.items.map(item => item.kind), ['outline', 'acts']);
  assert.equal(core.rikiProjectCurrentArtifact(target, 'outline').content.title, '导入成果');
  assert.equal(core.rikiProjectCurrentArtifact(target, 'acts'), null);
});

test('旧版导出可迁移但含 database 成果的文件被明确拒绝', () => {
  const legacy = {
    format: 'riki_project_export_v1',
    artifacts: {
      outline: [{ artifactId: 'o', versionId: 'v1', version: 1, content: { title: '旧项目' } }],
    },
    conversations: [{ title: '旧分支', strategyMode: 'brief', preferences: { 氛围: '冷' } }],
  };
  const normalized = core.rikiProjectNormalizeExport(legacy);
  assert.equal(normalized.artifacts.outline.versions.length, 1);
  assert.equal(normalized.conversations[0].strategyMode, 'brief');
  assert.throws(() => core.rikiProjectNormalizeExport({
    ...legacy,
    artifacts: { ...legacy.artifacts, database: [{ versionId: 'db', content: {} }] },
  }), /禁止导入数据库资产/);
});

test('空项目导出不能作为成果项目导入', () => {
  const payload = core.rikiProjectBuildExport(makeState());
  assert.throws(() => core.rikiProjectNormalizeExport(payload), /没有任何已确认成果/);
});

test('已放入回收站且没有当前版本的成果不会被导出后复活', () => {
  const state = makeState();
  confirmProposal(state, active(state), 'outline', { title: '待删除' });
  core.rikiProjectDeleteArtifactBatch(state, 'outline');
  const payload = core.rikiProjectBuildExport(state);
  assert.equal(payload.artifacts.outline.currentVersionId, null);
  assert.deepEqual(payload.artifacts.outline.versions, []);
  assert.throws(() => core.rikiProjectNormalizeExport(payload), /没有任何已确认成果/);
});

test('项目阶段依次经过总纲、大章、小章、人物到 ready', () => {
  const state = makeState();
  const conversation = active(state);
  assert.equal(core.rikiProjectStage(state), 'discovery');
  confirmProposal(state, conversation, 'outline', { title: '故事' });
  assert.equal(core.rikiProjectStage(state), 'acts_split');
  confirmProposal(state, conversation, 'acts', { acts: [{ actId: 'A1' }] });
  assert.equal(core.rikiProjectStage(state), 'chapters');
  confirmProposal(state, conversation, 'chapters', { chapters: [{ chapterId: 'C1' }] });
  assert.equal(core.rikiProjectStage(state), 'characters');
  confirmProposal(state, conversation, 'characters', { characters: [{ characterId: 'P1' }] });
  assert.equal(core.rikiProjectStage(state), 'ready');
  assert.equal(conversation.module, 'main');
});

test('确定性路由支持四个策划成果与显式主控/格式编译', () => {
  const state = makeState();
  const conversation = active(state);
  assert.equal(core.rikiProjectRoute(state, conversation, '请开始生成大章'), 'act');
  assert.notEqual(core.rikiProjectRoute(state, conversation, '设计人物之后再写推进预设'), 'progression_preset');
  assert.equal(core.rikiProjectRoute(state, conversation, '随便聊聊', 'main'), 'main');
  assert.equal(core.rikiProjectRoute(state, conversation, '修复结构', 'format_guard'), 'format_guard');
  const analysis = core.rikiProjectRouteAnalysis(state, conversation, '生成大章，然后生成角色');
  assert.equal(analysis.ambiguous, true);
  assert.deepEqual(new Set(analysis.candidates), new Set(['act', 'character']));
});

test('懒人版保存每步断点、可失败、可统一确认和整批回滚', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  const batch = core.rikiProjectStartLazyBatch(state, conversation.id, { requirement: '偏温暖' });
  core.rikiProjectStartLazyStep(state, 'outline');
  const version = confirmProposal(state, conversation, 'outline', { title: '自动总纲' });
  core.rikiProjectCompleteLazyStep(state, 'outline', version.versionId);
  assert.equal(batch.generated.length, 1);
  assert.ok(batch.lastCheckpointAt);
  core.rikiProjectStartLazyStep(state, 'acts');
  core.rikiProjectFailLazyBatch(state, new Error('模型暂时不可用'));
  assert.equal(batch.status, 'failed');
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').content.title, '自动总纲');
  const rejected = core.rikiProjectRejectLazyBatch(state);
  assert.equal(rejected.status, 'rejected');
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline'), null);
  assert.equal(state.runtime.lazyBatch, null);

  const nextBatch = core.rikiProjectStartLazyBatch(state, conversation.id);
  assert.throws(() => core.rikiProjectCompleteLazyBatch(state), /仍缺少成果/);
  const steps = [
    ['outline', { title: '自动故事' }],
    ['acts', { acts: [{ actId: 'ACT001' }] }],
    ['chapters', { chapters: [{ chapterId: 'CH001', actId: 'ACT001' }] }],
    ['characters', { characters: [{ characterId: 'CHAR001' }] }],
  ];
  for (const [kind, content] of steps) {
    core.rikiProjectStartLazyStep(state, kind);
    const checkpoint = confirmProposal(state, conversation, kind, content);
    core.rikiProjectCompleteLazyStep(state, kind, checkpoint.versionId);
  }
  core.rikiProjectCompleteLazyBatch(state);
  assert.equal(nextBatch.status, 'awaiting_confirmation');
  core.rikiProjectConfirmLazyBatch(state);
  assert.equal(nextBatch.status, 'complete');
  assert.equal(nextBatch.snapshot, null);
});

test('懒人版步骤严格按顺序且未完成步骤不能被下一步覆盖', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  core.rikiProjectStartLazyBatch(state, conversation.id);
  assert.throws(() => core.rikiProjectStartLazyStep(state, 'acts'), /先处理.*正式总纲/);
  core.rikiProjectStartLazyStep(state, 'outline');
  assert.throws(() => core.rikiProjectStartLazyStep(state, 'acts'), /尚未完成/);
  const version = confirmProposal(state, conversation, 'outline', { title: '总纲' });
  core.rikiProjectCompleteLazyStep(state, 'outline', version.versionId);
  assert.equal(core.rikiProjectStartLazyStep(state, 'acts').kind, 'acts');
});

test('失败懒人批次不能被新批次覆盖，显式继续保留最初回滚点', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  const batch = core.rikiProjectStartLazyBatch(state, conversation.id);
  const originalSnapshot = batch.snapshot;
  core.rikiProjectStartLazyStep(state, 'outline');
  const outline = confirmProposal(state, conversation, 'outline', { title: '部分断点' });
  core.rikiProjectCompleteLazyStep(state, 'outline', outline.versionId);
  core.rikiProjectStartLazyStep(state, 'acts');
  core.rikiProjectFailLazyBatch(state, new Error('大章失败'));
  assert.throws(() => core.rikiProjectStartLazyBatch(state, conversation.id), /不能覆盖原始回滚点/);
  const resumed = core.rikiProjectResumeLazyBatch(state, conversation.id, { requirement: '继续但更稳' });
  assert.equal(resumed.snapshot, originalSnapshot);
  assert.equal(resumed.status, 'generating');
  assert.equal(resumed.requirement, '继续但更稳');
  assert.equal(resumed.steps.find(step => step.kind === 'outline').status, 'complete');
  assert.equal(resumed.steps.find(step => step.kind === 'acts').status, 'pending');
  core.rikiProjectRejectLazyBatch(state);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline'), null);
});

test('已完成或等待确认的懒人批次不能被反向标记为失败', () => {
  const state = seedCompleteProject();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  core.rikiProjectStartLazyBatch(state, conversation.id);
  core.rikiProjectCompleteLazyBatch(state);
  assert.throws(() => core.rikiProjectFailLazyBatch(state, new Error('迟到错误')), /只有正在生成/);
  core.rikiProjectConfirmLazyBatch(state);
  assert.throws(() => core.rikiProjectFailLazyBatch(state, new Error('更迟错误')), /只有正在生成/);
});

test('懒人版批次要求可归一化恢复且来源分支在批次结束前禁止删除', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  core.rikiProjectStartLazyBatch(state, conversation.id, { requirement: '保持温暖基调' });
  assert.throws(() => core.rikiProjectDeleteConversation(state, conversation.id), /承载懒人版批次/);
  const normalized = core.rikiProjectNormalizeState(state, { chatKey: 'chat-a' });
  assert.equal(normalized.runtime.lazyBatch.requirement, '保持温暖基调');
});

test('懒人版整批回滚恢复其他分支被标 stale 的提案状态', () => {
  const state = makeState();
  const first = active(state);
  confirmProposal(state, first, 'outline', { title: 'v1' });
  core.rikiProjectSetStrategyMode(state, first.id, 'lazy');
  core.rikiProjectStartLazyBatch(state, first.id);
  const second = core.rikiProjectAddConversation(state, { title: '批次开始后新建的并行分支' });
  const otherProposal = core.rikiProjectProposeArtifact(state, second, 'outline', { title: '并行 v2' });
  core.rikiProjectSetActiveConversation(state, first.id);
  confirmProposal(state, first, 'outline', { title: '自动 v2' });
  assert.equal(otherProposal.status, 'stale');
  core.rikiProjectRejectLazyBatch(state);
  assert.equal(second.pendingProposal.status, 'pending');
  assert.equal(core.rikiProjectProposalIsStale(state, second.pendingProposal), false);
  assert.equal(core.rikiProjectCurrentArtifact(state, 'outline').content.title, 'v1');
});

test('归一化懒人快照剔除 database，缺少任一合法成果仓时拒绝危险回滚', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  core.rikiProjectStartLazyBatch(state, conversation.id);
  state.runtime.lazyBatch.snapshot.artifacts.database = {
    currentVersionId: 'db', versions: [{ versionId: 'db', status: 'confirmed', content: { tables: [] } }],
  };
  const safe = core.rikiProjectNormalizeState(state, { chatKey: 'chat-a' });
  assert.equal(Object.hasOwn(safe.runtime.lazyBatch.snapshot.artifacts, 'database'), false);
  core.rikiProjectRejectLazyBatch(safe);
  assert.equal(Object.hasOwn(safe.artifacts, 'database'), false);

  const malformed = makeState();
  const malformedConversation = active(malformed);
  core.rikiProjectSetStrategyMode(malformed, malformedConversation.id, 'lazy');
  core.rikiProjectStartLazyBatch(malformed, malformedConversation.id);
  delete malformed.runtime.lazyBatch.snapshot.artifacts.outline;
  const normalized = core.rikiProjectNormalizeState(malformed, { chatKey: 'chat-a' });
  assert.equal(normalized.runtime.lazyBatch.snapshot, null);
  assert.throws(() => core.rikiProjectRejectLazyBatch(normalized), /回滚快照不存在/);
  assert.deepEqual(Object.keys(normalized.artifacts), core.RIKI_PROJECT_ARTIFACT_KINDS);
});

test('成果删除会使正在运行的懒人批次明确失效', () => {
  const state = makeState();
  const conversation = active(state);
  core.rikiProjectSetStrategyMode(state, conversation.id, 'lazy');
  confirmProposal(state, conversation, 'outline', { title: '已有总纲' });
  core.rikiProjectStartLazyBatch(state, conversation.id);
  core.rikiProjectDeleteArtifactBatch(state, 'outline');
  assert.equal(state.runtime.lazyBatch.status, 'invalidated');
});

test('版本 Diff 可比较历史版本与当前版本', () => {
  const state = makeState();
  const conversation = active(state);
  const first = confirmProposal(state, conversation, 'outline', { title: '一', value: 1 });
  const second = confirmProposal(state, conversation, 'outline', { title: '二', value: 2 });
  const diff = core.rikiProjectVersionDiff(state, 'outline', first.versionId, second.versionId);
  assert.deepEqual(diff.map(item => item.path.join('.')).sort(), ['title', 'value']);
});

test('所有核心入口均为纯数据函数且模块可独立加载', () => {
  const required = [
    'rikiProjectCreateState', 'rikiProjectNormalizeState', 'rikiProjectActiveConversation',
    'rikiProjectAddConversation', 'rikiProjectRenameConversation', 'rikiProjectDeleteConversation',
    'rikiProjectAppendMessage', 'rikiProjectEditUserMessage', 'rikiProjectDeleteMessage', 'rikiProjectPrepareReroll',
    'rikiProjectProposeArtifact', 'rikiProjectConfirmArtifactProposal', 'rikiProjectSetProposalItemStatus',
    'rikiProjectCurrentArtifact', 'rikiProjectDeleteArtifactBatch', 'rikiProjectRestoreArtifactBatch',
    'rikiProjectEmptyRecycleBin', 'rikiProjectBuildExport', 'rikiProjectApplyImport',
    'rikiProjectAppendRequestLog', 'rikiProjectPruneRequestLogs', 'rikiProjectArtifactDiff',
    'rikiProjectStage', 'rikiProjectRoute',
  ];
  for (const name of required) assert.equal(typeof core[name], 'function', `${name} should be exported`);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    console.error(`not ok ${passed + 1} - ${name}`);
    throw error;
  }
}

console.log(`Riki project core: ${passed}/${tests.length} tests passed.`);
