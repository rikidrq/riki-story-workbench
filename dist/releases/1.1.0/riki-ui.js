/* Riki Story Workbench 1.1.0 | generated from src/riki-ui.js */
import { RIKI_PLANNING_MODULES, RIKI_ARTIFACT_KINDS, rikiPlanningStage } from './riki-planning.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function safeJson(value, fallback = '{}') {
  try { return JSON.stringify(value, null, 2); } catch (_) { return fallback; }
}

function activeConversation(runtime) {
  const project = runtime.state.project;
  return array(project?.conversations).find(item => item.id === project.activeConversationId) || project?.conversations?.[0] || null;
}

function strategyMode(conversation) {
  return conversation?.strategyMode || conversation?.workflowMode || 'detailed';
}

function selectedContextKeys(conversation) {
  if (Array.isArray(conversation?.selectedContext)) return conversation.selectedContext;
  const context = conversation?.context || {};
  return Object.entries(context.selectedEntries || {}).flatMap(([bookName, ids]) => array(ids).map(uid => `${bookName}::${uid}`));
}

function currentArtifact(project, kind) {
  const store = project?.artifacts?.[kind];
  return array(store?.versions).find(item => item.versionId === store.currentVersionId && item.status === 'confirmed') || null;
}

function artifactLabel(kind) {
  return ({ outline: '总纲', acts: '大章', chapters: '小章', characters: '人物', progression_preset: '推进预设' })[kind] || kind;
}

function stageLabel(stage) {
  return ({ discovery: '需求与总纲', acts: '大章', chapters: '小章', characters: '人物', progression: '推进预设', ready: '策划成果齐备' })[stage] || stage;
}

function statusBadge(status) {
  const labels = { complete: '完成', streaming: '生成中', stopped: '已停止', error: '失败', pending: '待确认', confirmed: '已确认', rejected: '已打回', stale: '已过期', superseded: '旧版本', deleted: '回收站' };
  return `<span class="status status-${escapeHtml(status || 'complete')}">${escapeHtml(labels[status] || status || '完成')}</span>`;
}

function noticeHtml(state) {
  if (!state.notice?.message) return '<div class="notice notice-empty" aria-hidden="true"></div>';
  return `<div class="notice notice-${escapeHtml(state.notice.type || 'info')}" role="status" aria-live="polite">${escapeHtml(state.notice.message)}</div>`;
}

function topNavHtml(state) {
  const views = [
    ['chat', '对话'], ['artifacts', '成果'], ['worldbook', '世界书'], ['settings', '模型与预设'], ['logs', '诊断'],
  ];
  return `<nav class="top-nav" aria-label="工作台区域">${views.map(([id, label]) => `<button data-action="view" data-view="${id}" class="${state.ui.view === id ? 'active' : ''}" aria-current="${state.ui.view === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
}

function conversationListHtml(runtime) {
  const project = runtime.state.project;
  const active = activeConversation(runtime);
  return `<section class="rail-section conversations">
    <div class="rail-title"><span>Agent 分支</span><button class="tiny primary" data-action="conversation-new" title="新建分支">＋</button></div>
    <div class="branch-list">${array(project?.conversations).map(conversation => `
      <div class="branch-row ${conversation.id === active?.id ? 'active' : ''}">
        <button class="branch-main" data-action="conversation-select" data-conversation-id="${escapeHtml(conversation.id)}">
          <strong>${escapeHtml(conversation.title)}</strong><small>${escapeHtml(RIKI_PLANNING_MODULES[conversation.module]?.label || '主控 Agent')} · ${array(conversation.messages).length} 条</small>
        </button>
        <button class="branch-more" data-action="conversation-copy" data-conversation-id="${escapeHtml(conversation.id)}" title="复制分支与偏好">⧉</button>
        <button class="branch-more" data-action="conversation-rename" data-conversation-id="${escapeHtml(conversation.id)}" title="重命名">✎</button>
        <button class="branch-more danger-ghost" data-action="conversation-delete" data-conversation-id="${escapeHtml(conversation.id)}" title="删除">×</button>
      </div>`).join('')}</div>
  </section>`;
}

function workflowHtml(conversation) {
  const modes = [['detailed', '详细版'], ['brief', '粗略版'], ['lazy', '懒人版']];
  return `<section class="rail-section"><div class="rail-title"><span>工作流</span></div>
    <div class="segmented">${modes.map(([id, label]) => `<button data-action="workflow-mode" data-mode="${id}" class="${strategyMode(conversation) === id ? 'active' : ''}">${label}</button>`).join('')}</div>
    ${strategyMode(conversation) === 'lazy' ? '<button class="wide accent" data-action="lazy-start">启动懒人版流水线</button>' : ''}
  </section>`;
}

function moduleListHtml(conversation) {
  const visible = ['main', 'outline', 'act', 'chapter', 'character', 'progression_preset', 'format_guard'];
  return `<section class="rail-section modules"><div class="rail-title"><span>策划 Agent</span></div><div class="module-list">${visible.map(id => {
    const module = RIKI_PLANNING_MODULES[id];
    return `<button data-action="module-select" data-module="${id}" class="module ${conversation?.module === id ? 'active' : ''}"><span class="module-icon">${module.icon}</span><span><strong>${escapeHtml(module.label)}</strong><small>${escapeHtml(module.description)}</small></span></button>`;
  }).join('')}</div></section>`;
}

function leftRailHtml(runtime) {
  const conversation = activeConversation(runtime);
  return `<aside class="left-rail pane pane-left" data-mobile-pane="left">
    ${conversationListHtml(runtime)}
    ${workflowHtml(conversation)}
    ${moduleListHtml(conversation)}
  </aside>`;
}

function messageActions(message) {
  if (message.role === 'user') return `<div class="message-actions"><button data-action="message-edit" data-message-id="${escapeHtml(message.id)}">编辑</button><button data-action="message-delete" data-message-id="${escapeHtml(message.id)}">删除</button><button data-action="message-copy" data-message-id="${escapeHtml(message.id)}">复制</button></div>`;
  if (message.role === 'assistant') return `<div class="message-actions"><button data-action="message-reroll" data-message-id="${escapeHtml(message.id)}">重 Roll</button><button data-action="message-copy" data-message-id="${escapeHtml(message.id)}">复制</button><button data-action="message-delete" data-message-id="${escapeHtml(message.id)}">删除</button></div>`;
  return '';
}

function messageHtml(state, message) {
  const editing = state.ui.editingMessageId === message.id;
  const label = message.role === 'user' ? '你' : message.role === 'assistant' ? (RIKI_PLANNING_MODULES[message.module]?.label || 'Riki') : '系统';
  return `<article class="message message-${escapeHtml(message.role)}" data-message-id="${escapeHtml(message.id)}">
    <header><span>${escapeHtml(label)}</span>${statusBadge(message.status || 'complete')}<time>${escapeHtml(text(message.createdAt || message.at).replace('T', ' ').slice(0, 16))}</time></header>
    ${editing ? `<textarea class="message-editor" data-field="message-edit-draft">${escapeHtml(state.ui.messageEditDraft)}</textarea><div class="inline-actions"><button class="primary" data-action="message-edit-save" data-message-id="${escapeHtml(message.id)}">保存并截断后续</button><button data-action="message-edit-cancel">取消</button></div>` : `<div class="message-content">${escapeHtml(message.content)}</div>`}
    ${message.error ? `<div class="message-error">${escapeHtml(message.error.message || message.error)}</div>` : ''}
    ${messageActions(message)}
  </article>`;
}

function proposalHtml(conversation) {
  const proposal = conversation?.pendingProposal;
  if (!proposal) return '';
  const items = array(proposal.items);
  return `<section class="proposal-card">
    <header><div><span class="eyebrow">正式成果候选</span><h3>${escapeHtml(artifactLabel(proposal.kind))} · ${escapeHtml(proposal.summary || '')}</h3></div>${statusBadge(proposal.status || 'pending')}</header>
    <details><summary>查看候选 JSON 与基线</summary><pre>${escapeHtml(safeJson({ baseVersionId: proposal.baseVersionId, changeLevel: proposal.changeLevel, mergeMode: proposal.mergeMode, content: proposal.content }))}</pre></details>
    ${items.length ? `<div class="proposal-items">${items.map(item => `<div class="proposal-item"><span>${escapeHtml(item.label || item.itemId)}</span><div><button data-action="proposal-item" data-item-id="${escapeHtml(item.itemId)}" data-status="confirmed" class="${item.status === 'confirmed' ? 'active success' : ''}">确认</button><button data-action="proposal-item" data-item-id="${escapeHtml(item.itemId)}" data-status="rejected" class="${item.status === 'rejected' ? 'active danger' : ''}">打回</button></div></div>`).join('')}</div>` : ''}
    <div class="proposal-actions"><button class="primary" data-action="proposal-confirm-all">${items.length ? '全部确认并保存版本' : '确认并保存版本'}</button><button data-action="proposal-edit">编辑 JSON</button><button class="danger-ghost" data-action="proposal-reject">放弃候选</button></div>
  </section>`;
}

function chatViewHtml(runtime) {
  const state = runtime.state;
  const project = state.project;
  const conversation = activeConversation(runtime);
  const stage = rikiPlanningStage(project);
  const messages = array(conversation?.messages);
  const lazyBatch = project?.runtime?.lazyBatch?.conversationId === conversation?.id ? project.runtime.lazyBatch : null;
  const selectedModule = RIKI_PLANNING_MODULES[conversation?.module] || RIKI_PLANNING_MODULES.main;
  return `<section class="content-view chat-view">
    <div class="content-toolbar">
      <div><span class="eyebrow">${escapeHtml(stageLabel(stage))}</span><h2>${escapeHtml(conversation?.title || '故事策划')}</h2><p>${escapeHtml(selectedModule.label)} · ${escapeHtml(selectedModule.description)}</p></div>
      <div class="toolbar-actions"><button data-action="conversation-rename" data-conversation-id="${escapeHtml(conversation?.id)}">重命名分支</button><button data-action="project-export">导出项目</button><button data-action="project-import">导入项目</button></div>
    </div>
    ${lazyBatch ? `<div class="lazy-progress"><strong>懒人版：</strong>${escapeHtml(lazyBatch.status || '')} · ${escapeHtml(lazyBatch.currentStep?.moduleId || lazyBatch.currentStep?.kind || '')} · 已完成 ${array(lazyBatch.generated).length}/${5}${lazyBatch.error ? ` · ${escapeHtml(lazyBatch.error)}` : ''}${lazyBatch.status === 'awaiting_confirmation' ? '<span class="lazy-actions"><button data-action="lazy-confirm">统一确认</button><button data-action="lazy-reject" class="danger-ghost">整批回滚</button></span>' : ''}${lazyBatch.status === 'failed' ? '<span class="lazy-actions"><button data-action="lazy-reject" class="danger-ghost">回滚失败批次</button></span>' : ''}</div>` : ''}
    <div class="messages" id="riki-messages">${messages.length ? messages.map(message => messageHtml(state, message)).join('') : `<div class="empty-state"><div class="empty-glyph">R</div><h3>从主控访谈或任一策划 Agent 开始</h3><p>选中的世界书条目、已确认成果和本分支偏好会组成上下文。数据库与二创不会进入本工作台。</p><div class="quick-prompts"><button data-action="quick-prompt" data-text="先采访我，梳理这个故事的题材、主角、核心矛盾和我不希望出现的内容。">开始需求访谈</button><button data-action="quick-prompt" data-text="请读取我选中的世界书，指出目前最值得先解决的三个剧情矛盾。">检查现有设定</button><button data-action="quick-prompt" data-text="现在生成一份可确认的正式总纲候选。">生成正式总纲</button></div></div>`}</div>
    ${proposalHtml(conversation)}
    ${state.ui.showProposalEditor ? `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="编辑成果候选"><header><h3>编辑候选 JSON</h3><button data-action="proposal-edit-cancel" aria-label="关闭">×</button></header><textarea class="json-editor" data-field="proposal-edit-json">${escapeHtml(state.ui.proposalEditJson)}</textarea><footer><button data-action="proposal-edit-cancel">取消</button><button class="primary" data-action="proposal-edit-save">保存为待确认候选</button></footer></section></div>` : ''}
    <footer class="composer">
      <div class="composer-meta"><span>${escapeHtml(selectedModule.label)}</span><span>${escapeHtml(({ detailed: '详细版', brief: '粗略版', lazy: '懒人版' })[strategyMode(conversation)] || '详细版')}</span><span>上下文 ${selectedContextKeys(conversation).length} 条</span></div>
      <textarea data-field="composer" placeholder="讨论剧情，或明确说“生成正式总纲 / 大章 / 小章 / 人物 / 推进预设”…" ${state.busy ? 'disabled' : ''}>${escapeHtml(state.ui.composerDraft || '')}</textarea>
      <div class="composer-actions"><span class="hint">Ctrl/⌘ + Enter 发送</span>${state.generation?.active ? `<button class="danger" data-action="generation-stop">停止生成</button>` : `<button data-action="generate-formal">${conversation?.module === 'format_guard' ? '编译最近草稿' : '生成本模块正式候选'}</button><button class="primary" data-action="planning-send">发送</button>`}</div>
    </footer>
  </section>`;
}

function artifactVersionsHtml(project, kind, selectedVersionId) {
  const store = project?.artifacts?.[kind];
  const versions = array(store?.versions).slice().reverse();
  if (!versions.length) return '<div class="empty-mini">还没有版本</div>';
  return versions.map(version => `<button data-action="artifact-version" data-kind="${kind}" data-version-id="${escapeHtml(version.versionId)}" class="version-row ${selectedVersionId === version.versionId ? 'active' : ''}"><span>v${Number(version.version) || 1}</span><strong>${escapeHtml(version.summary || artifactLabel(kind))}</strong>${statusBadge(version.status)}</button>`).join('');
}

function artifactsViewHtml(runtime) {
  const state = runtime.state;
  const project = state.project;
  const kind = state.ui.artifactKind || 'outline';
  const store = project?.artifacts?.[kind];
  const selectedId = state.ui.artifactVersionId || store?.currentVersionId || '';
  const selected = array(store?.versions).find(item => item.versionId === selectedId) || currentArtifact(project, kind);
  const previous = selected?.baseVersionId ? array(store?.versions).find(item => item.versionId === selected.baseVersionId) : null;
  const trash = array(project?.recycleBin).filter(batch => !batch.restoredAt && !batch.permanentlyDeletedAt);
  return `<section class="content-view artifacts-view">
    <div class="content-toolbar"><div><span class="eyebrow">正式成果</span><h2>版本链与 Diff</h2><p>只有确认后的候选才成为当前项目事实；删除会进入回收站。</p></div><div class="toolbar-actions"><button data-action="project-export">导出全部成果</button></div></div>
    <div class="artifact-layout">
      <aside class="artifact-kinds">${RIKI_ARTIFACT_KINDS.map(id => `<button data-action="artifact-kind" data-kind="${id}" class="${kind === id ? 'active' : ''}"><span>${escapeHtml(artifactLabel(id))}</span>${currentArtifact(project, id) ? '<b>✓</b>' : '<b>—</b>'}</button>`).join('')}<button data-action="trash-toggle" class="trash-button"><span>回收站</span><b>${trash.length}</b></button></aside>
      <div class="artifact-versions"><h3>${escapeHtml(artifactLabel(kind))}版本</h3>${artifactVersionsHtml(project, kind, selectedId)}</div>
      <div class="artifact-detail">${selected ? `<header><div><span class="eyebrow">${escapeHtml(selected.versionId)}</span><h3>${escapeHtml(selected.summary || artifactLabel(kind))}</h3></div>${statusBadge(selected.status)}</header><div class="artifact-actions"><button data-action="artifact-copy" data-kind="${kind}" data-version-id="${escapeHtml(selected.versionId)}">复制 JSON</button>${selected.status === 'confirmed' ? `<button data-action="artifact-edit" data-kind="${kind}" data-version-id="${escapeHtml(selected.versionId)}">基于此版本修改</button><button class="danger-ghost" data-action="artifact-delete" data-kind="${kind}">删除当前及下游成果</button>` : ''}</div><details open><summary>成果内容</summary><pre>${escapeHtml(safeJson(selected.content))}</pre></details>${previous ? `<details><summary>相对基础版本的完整对照</summary><div class="diff-grid"><pre>${escapeHtml(safeJson(previous.content))}</pre><pre>${escapeHtml(safeJson(selected.content))}</pre></div></details>` : ''}` : '<div class="empty-state"><h3>尚无已确认成果</h3><p>返回对话页，让对应 Agent 生成正式候选并确认。</p></div>'}</div>
    </div>
    ${state.ui.showTrash ? `<div class="trash-drawer"><header><h3>回收站</h3><button data-action="trash-empty" class="danger-ghost">永久清空</button></header>${trash.length ? trash.map(batch => `<div class="trash-row"><div><strong>${escapeHtml(artifactLabel(batch.kind))}</strong><small>${escapeHtml(batch.reason || '手动删除')} · ${escapeHtml(text(batch.deletedAt).slice(0, 16))}</small></div><button data-action="trash-restore" data-batch-id="${escapeHtml(batch.batchId)}">恢复整批</button></div>`).join('') : '<div class="empty-mini">回收站为空</div>'}</div>` : ''}
    ${state.ui.showArtifactEditor ? `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="修改成果"><header><h3>基于当前版本创建修改候选</h3><button data-action="artifact-edit-cancel" aria-label="关闭">×</button></header><textarea class="json-editor" data-field="artifact-edit-json">${escapeHtml(state.ui.artifactEditJson)}</textarea><footer><button data-action="artifact-edit-cancel">取消</button><button class="primary" data-action="artifact-edit-save">生成修改候选</button></footer></section></div>` : ''}
  </section>`;
}

function bookBadges(book) {
  return `${book.boundToChat ? '<span class="book-badge chat">聊天</span>' : ''}${book.boundToCharacter ? '<span class="book-badge character">角色</span>' : ''}${book.globalEnabled ? '<span class="book-badge global">全局</span>' : ''}` || '<span class="book-badge idle">未绑定</span>';
}

function worldbookViewHtml(runtime) {
  const state = runtime.state;
  const books = array(state.inventory).filter(item => item.name.toLowerCase().includes(text(state.searchBooks).toLowerCase()));
  const entries = array(state.books.get(state.activeBookName)).filter(item => `${item.name}\n${item.content}`.toLowerCase().includes(text(state.searchEntries).toLowerCase()));
  const active = entries.find(item => text(item.uid) === text(state.activeEntryUid)) || state.draft;
  const contextKeys = selectedContextKeys(activeConversation(runtime));
  return `<section class="content-view worldbook-view">
    <div class="content-toolbar"><div><span class="eyebrow">原世界书</span><h2>库存、上下文与受控修改</h2><p>修改必须经过 Diff、确认、写后回读；模型提案不会自动写入。</p></div><div class="toolbar-actions"><button data-action="worldbook-refresh">刷新库存</button><button data-action="worldbook-undo" ${state.history.length ? '' : 'disabled'}>撤销最近修改</button></div></div>
    <div class="worldbook-grid">
      <div class="book-column"><input data-field="book-search" value="${escapeHtml(state.searchBooks)}" placeholder="搜索世界书"><div class="scroll-list">${books.map(book => `<button data-action="book-select" data-book="${escapeHtml(book.name)}" class="book-row ${state.activeBookName === book.name ? 'active' : ''}"><strong>${escapeHtml(book.name)}</strong><span>${bookBadges(book)}</span></button>`).join('') || '<div class="empty-mini">没有世界书</div>'}</div></div>
      <div class="entry-column"><input data-field="entry-search" value="${escapeHtml(state.searchEntries)}" placeholder="搜索条目"><div class="scroll-list">${entries.map(entry => { const selected = contextKeys.includes(`${state.activeBookName}::${entry.uid}`); return `<div class="entry-row ${text(state.activeEntryUid) === text(entry.uid) ? 'active' : ''}"><button data-action="entry-select" data-uid="${escapeHtml(entry.uid)}"><strong>${escapeHtml(entry.name)}</strong><small>uid=${escapeHtml(entry.uid)} · ${entry.enabled ? '启用' : '停用'}</small></button><button data-action="context-toggle" data-book="${escapeHtml(state.activeBookName)}" data-uid="${escapeHtml(entry.uid)}" data-checked="${selected ? 'true' : 'false'}" class="context-toggle ${selected ? 'active' : ''}" title="加入策划上下文">${selected ? '✓' : '+'}</button></div>`; }).join('') || '<div class="empty-mini">请选择世界书</div>'}</div></div>
      <div class="entry-editor">${active && state.draft ? `<div class="form-grid"><label class="span-2">条目名称<input data-field="wb-name" value="${escapeHtml(state.draft.name)}"></label><label>启用<select data-field="wb-enabled"><option value="true" ${state.draft.enabled ? 'selected' : ''}>启用</option><option value="false" ${!state.draft.enabled ? 'selected' : ''}>停用</option></select></label><label>概率<input type="number" min="0" max="100" data-field="wb-probability" value="${escapeHtml(state.draft.probability)}"></label><label>策略<select data-field="wb-strategy"><option value="selective" ${state.draft.strategy.type === 'selective' ? 'selected' : ''}>关键词</option><option value="constant" ${state.draft.strategy.type === 'constant' ? 'selected' : ''}>常驻</option><option value="vectorized" ${state.draft.strategy.type === 'vectorized' ? 'selected' : ''}>向量</option></select></label><label>关键词<input data-field="wb-keys" value="${escapeHtml(array(state.draft.strategy.keys).join('，'))}"></label><label>位置<select data-field="wb-position"><option value="after_character_definition" ${state.draft.position.type === 'after_character_definition' ? 'selected' : ''}>角色定义后</option><option value="before_character_definition" ${state.draft.position.type === 'before_character_definition' ? 'selected' : ''}>角色定义前</option><option value="before_author_note" ${state.draft.position.type === 'before_author_note' ? 'selected' : ''}>作者注前</option><option value="at_depth" ${state.draft.position.type === 'at_depth' ? 'selected' : ''}>指定深度</option></select></label><label>深度<input type="number" data-field="wb-depth" value="${escapeHtml(state.draft.position.depth)}"></label><label class="span-2">正文<textarea class="worldbook-content" data-field="wb-content">${escapeHtml(state.draft.content)}</textarea></label></div><div class="editor-actions"><button data-action="draft-reset">放弃编辑</button><button class="primary" data-action="worldbook-preview">预览 Diff</button></div>` : '<div class="empty-state"><h3>选择一个世界书条目</h3></div>'}</div>
    </div>
    ${state.diffOpen && state.pendingPatch ? `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="世界书 Diff"><header><h3>确认世界书修改</h3><button data-action="diff-close" aria-label="关闭">×</button></header><div class="diff-grid"><pre>${escapeHtml(safeJson(state.pendingPatch.before))}</pre><pre>${escapeHtml(safeJson(state.pendingPatch.after))}</pre></div><footer><button data-action="diff-close">返回</button><button class="primary" data-action="worldbook-apply" data-confirmation-id="${escapeHtml(state.pendingPatch.patchId)}">确认写入并回读</button></footer></section></div>` : ''}
  </section>`;
}

function apiPresetOptions(library, selected) {
  return array(library?.apiPresets).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}

function systemPresetOptions(library, selected) {
  return `<option value="">继承 / 无额外 System</option>${array(library?.systemPresets).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
}

function settingsViewHtml(runtime) {
  const state = runtime.state;
  const library = state.modelLibrary || { apiPresets: [], systemPresets: [] };
  const draft = state.modelDraft || array(library.apiPresets)[0] || {};
  const systemDraft = state.systemDraft || array(library.systemPresets)[0] || {};
  const moduleId = state.ui.settingsModule || 'main';
  const projectConfig = state.project?.config || {};
  const persistedBinding = moduleId === 'main' ? projectConfig.main || {}
    : moduleId === 'default' ? projectConfig.default || {}
      : projectConfig.modules?.[moduleId] || {};
  const binding = state.bindingDraft || persistedBinding;
  const profiles = array(state.connectionProfiles);
  const models = array(state.availableModels);
  return `<section class="content-view settings-view">
    <div class="content-toolbar"><div><span class="eyebrow">设备级配置</span><h2>模型连接与 Agent 预设</h2><p>API Key 只存设备级 extensionSettings / 本地存储；不会进入聊天、日志、项目导出或世界书。</p></div><div class="toolbar-actions"><button data-action="settings-refresh">重新读取酒馆连接</button></div></div>
    <div class="settings-grid">
      <section class="settings-card"><header><div><span class="eyebrow">Connection</span><h3>API 配置库</h3></div><div><button data-action="api-new">新建</button><button data-action="api-delete" class="danger-ghost">删除</button></div></header>
        <label>编辑配置<select data-action="api-select" data-field="api-selected">${apiPresetOptions(library, draft.id)}</select></label>
        <div class="form-grid"><label class="span-2">名称<input data-model-field="name" value="${escapeHtml(draft.name)}"></label><label>连接方式<select data-model-field="transport"><option value="tavern" ${draft.transport === 'tavern' ? 'selected' : ''}>酒馆当前连接</option><option value="profile" ${draft.transport === 'profile' ? 'selected' : ''}>Connection Manager</option><option value="direct" ${draft.transport === 'direct' ? 'selected' : ''}>独立 OpenAI-compatible</option></select></label><label>模型<input data-model-field="model" list="riki-model-list" value="${escapeHtml(draft.model)}" placeholder="可获取或手填"><datalist id="riki-model-list">${models.map(model => `<option value="${escapeHtml(model)}"></option>`).join('')}</datalist></label>${draft.transport === 'profile' ? `<label class="span-2">酒馆连接预设<select data-model-field="profileId"><option value="">请选择</option>${profiles.map(profile => `<option value="${escapeHtml(profile.id)}" ${profile.id === draft.profileId ? 'selected' : ''}>${escapeHtml(profile.name || profile.id)} · ${escapeHtml(profile.model || '')}</option>`).join('')}</select></label>` : ''}${draft.transport === 'direct' ? `<label class="span-2">端点 URL<input data-model-field="endpoint" value="${escapeHtml(draft.endpoint)}" placeholder="https://example.com/v1"></label><label class="span-2">API Key<input type="password" autocomplete="off" data-model-field="apiKey" value="${escapeHtml(draft.apiKey)}" placeholder="仅保存在本设备"></label><label class="check span-2"><input type="checkbox" data-model-field="viaBackend" ${draft.viaBackend ? 'checked' : ''}> 经酒馆后端转发（默认关闭；仅在你明确需要时启用）</label>` : ''}<label>Temperature<input type="number" min="0" max="2" step="0.1" data-model-field="temperature" value="${escapeHtml(draft.temperature ?? 0.7)}"></label><label>Max tokens<input type="number" min="256" data-model-field="maxTokens" value="${escapeHtml(draft.maxTokens ?? 16000)}"></label></div>
        <div class="card-actions"><button data-action="models-fetch" ${draft.transport === 'tavern' ? 'disabled' : ''}>获取模型列表</button><button class="primary" data-action="api-save">保存 API 配置</button></div>
      </section>
      <section class="settings-card"><header><div><span class="eyebrow">Routing</span><h3>主 Agent 与模块覆盖</h3></div></header><label>配置范围<select data-action="settings-module" data-field="settings-module"><option value="main" ${moduleId === 'main' ? 'selected' : ''}>主控 Agent</option><option value="default" ${moduleId === 'default' ? 'selected' : ''}>次 Agent 默认</option>${Object.entries(RIKI_PLANNING_MODULES).filter(([id]) => !['main'].includes(id)).map(([id, item]) => `<option value="${id}" ${moduleId === id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label><label>API 配置<select data-binding-field="apiPresetId">${apiPresetOptions(library, binding.apiPresetId || '')}</select></label><label>模块模型覆盖<input data-binding-field="model" value="${escapeHtml(binding.model)}" placeholder="留空继承 API 配置"></label><label>System 预设<select data-binding-field="systemPresetId">${systemPresetOptions(library, binding.systemPresetId || '')}</select></label><div class="resolution-box"><strong>实际请求解析</strong><pre>${escapeHtml(safeJson(state.resolvedModelConfig || {}))}</pre></div><div class="card-actions"><button class="primary" data-action="binding-save">保存模块绑定</button></div></section>
      <section class="settings-card system-card"><header><div><span class="eyebrow">System Prompt</span><h3>Agent System 预设库</h3></div><div><button data-action="system-new">新建</button><button data-action="system-copy-tavern">复制酒馆当前预设</button><button data-action="system-delete" class="danger-ghost">删除</button></div></header><label>编辑预设<select data-action="system-select">${array(library.systemPresets).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === systemDraft.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>名称<input data-system-field="name" value="${escapeHtml(systemDraft.name)}"></label><label>System 内容<textarea class="system-editor" data-system-field="content">${escapeHtml(systemDraft.content)}</textarea></label><div class="card-actions"><span class="hint">内置预设可复制后自定义；不会把 API Key 写入内容。</span><button class="primary" data-action="system-save">保存 System 预设</button></div></section>
    </div>
  </section>`;
}

function logsViewHtml(runtime) {
  const state = runtime.state;
  const logs = array(state.project?.requestLogs).slice().reverse();
  const selected = logs.find(item => item.id === state.ui.logId) || logs[0];
  return `<section class="content-view logs-view"><div class="content-toolbar"><div><span class="eyebrow">可观测性</span><h2>请求日志与输入/输出诊断</h2><p>日志中的 API Key、Authorization 与 Connection Manager secret 均被隐藏。</p></div><div class="toolbar-actions"><button data-action="logs-export" ${selected ? '' : 'disabled'}>导出当前诊断</button><button data-action="logs-clear" class="danger-ghost" ${logs.length ? '' : 'disabled'}>清空日志</button></div></div><div class="logs-layout"><aside class="log-list">${logs.length ? logs.map(log => `<button data-action="log-select" data-log-id="${escapeHtml(log.id)}" class="${selected?.id === log.id ? 'active' : ''}"><strong>${escapeHtml(RIKI_PLANNING_MODULES[log.module]?.label || log.module || '请求')}</strong><span>${statusBadge(log.status)}</span><small>${escapeHtml(text(log.startedAt).replace('T', ' ').slice(0, 19))} · ${escapeHtml(log.transport || '')} · ${escapeHtml(log.model || '')}</small></button>`).join('') : '<div class="empty-mini">还没有请求日志</div>'}</aside><div class="log-detail">${selected ? `<div class="diagnostic-tabs"><button data-action="log-mode" data-mode="summary" class="${state.ui.logMode === 'summary' ? 'active' : ''}">摘要</button><button data-action="log-mode" data-mode="input" class="${state.ui.logMode === 'input' ? 'active' : ''}">完整输入</button><button data-action="log-mode" data-mode="output" class="${state.ui.logMode === 'output' ? 'active' : ''}">完整输出</button></div><pre>${escapeHtml(safeJson(state.ui.logMode === 'input' ? selected.input : state.ui.logMode === 'output' ? selected.output : selected))}</pre>` : '<div class="empty-state"><h3>运行一次 Agent 请求后查看</h3></div>'}</div></div></section>`;
}

function contextPanelHtml(runtime) {
  const state = runtime.state;
  const conversation = activeConversation(runtime);
  const selected = new Set(selectedContextKeys(conversation));
  const books = array(state.inventory);
  return `<div class="right-panel-content"><div class="right-title"><h3>世界书上下文</h3><span>${selected.size} 条</span></div><p class="muted">只有这里勾选的条目会发给策划 Agent。它们被标记为资料，不会当作可执行指令。</p><div class="context-books">${books.map(book => { const entries = array(state.books.get(book.name)); return `<details ${book.name === state.activeBookName ? 'open' : ''}><summary><span>${escapeHtml(book.name)}</span>${bookBadges(book)}</summary>${entries.length ? entries.map(entry => { const key = `${book.name}::${entry.uid}`; return `<label class="context-entry"><input type="checkbox" data-action="context-checkbox" data-book="${escapeHtml(book.name)}" data-uid="${escapeHtml(entry.uid)}" ${selected.has(key) ? 'checked' : ''}><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(text(entry.content).slice(0, 90))}</small></span></label>`; }).join('') : `<button data-action="context-load-book" data-book="${escapeHtml(book.name)}">读取条目</button>`}</details>`; }).join('') || '<div class="empty-mini">尚未读取世界书库存</div>'}</div></div>`;
}

function progressPanelHtml(runtime) {
  const project = runtime.state.project;
  return `<div class="right-panel-content"><div class="right-title"><h3>策划进度</h3><span>${escapeHtml(stageLabel(rikiPlanningStage(project)))}</span></div><div class="progress-list">${RIKI_ARTIFACT_KINDS.map(kind => { const artifact = currentArtifact(project, kind); return `<button data-action="open-artifact" data-kind="${kind}" class="${artifact ? 'complete' : ''}"><span>${artifact ? '✓' : '○'}</span><div><strong>${escapeHtml(artifactLabel(kind))}</strong><small>${artifact ? `v${artifact.version} · ${artifact.summary || '已确认'}` : '尚未确认'}</small></div></button>`; }).join('')}</div><div class="boundary-box"><strong>1.1 边界</strong><ul><li>不包含 SP·数据库内核或模板</li><li>不安装推进预设到数据库</li><li>不包含灵感二创、生图或素材库</li><li>不包含记忆引擎</li></ul></div></div>`;
}

function configPanelHtml(runtime) {
  const state = runtime.state;
  const conversation = activeConversation(runtime);
  return `<div class="right-panel-content"><div class="right-title"><h3>当前请求配置</h3><button data-action="view" data-view="settings">打开配置</button></div><dl class="config-summary"><dt>分支</dt><dd>${escapeHtml(conversation?.title)}</dd><dt>模块</dt><dd>${escapeHtml(RIKI_PLANNING_MODULES[conversation?.module]?.label || '')}</dd><dt>模式</dt><dd>${escapeHtml(strategyMode(conversation))}</dd><dt>API</dt><dd>${escapeHtml(state.resolvedModelConfig?.apiPresetName || state.resolvedModelConfig?.apiPresetId || '未解析')}</dd><dt>连接</dt><dd>${escapeHtml(state.resolvedModelConfig?.transport || '')}</dd><dt>模型</dt><dd>${escapeHtml(state.resolvedModelConfig?.model || '由酒馆当前连接决定')}</dd><dt>System</dt><dd>${escapeHtml(state.resolvedModelConfig?.systemPresetName || '继承')}</dd></dl></div>`;
}

function preferencesPanelHtml(runtime) {
  const state = runtime.state;
  const conversation = activeConversation(runtime);
  const entries = Object.entries(conversation?.preferences || {});
  return `<div class="right-panel-content"><div class="right-title"><h3>分支偏好</h3><span>${entries.length} 项</span></div><p class="muted">偏好只属于当前 Agent 分支；复制分支时可复制，正式确认后会标记来源。</p><div class="preference-form"><input data-field="preference-key" value="${escapeHtml(state.ui.preferenceKey || '')}" placeholder="偏好名称，如：叙事节奏"><textarea data-field="preference-value" placeholder="偏好内容；可填写文本或 JSON">${escapeHtml(state.ui.preferenceValue || '')}</textarea><button class="primary" data-action="preference-save">保存为推测偏好</button></div><div class="preference-list">${entries.length ? entries.map(([key, value]) => { const meta = conversation.preferenceMeta?.[key] || {}; return `<div class="preference-row"><div><strong>${escapeHtml(key)}</strong><small>${escapeHtml(typeof value === 'string' ? value : safeJson(value))}</small><span>${meta.status === 'confirmed' ? '已确认' : '待确认'} · ${escapeHtml(meta.source || 'manual')}</span></div><div>${meta.status !== 'confirmed' ? `<button data-action="preference-confirm" data-key="${escapeHtml(key)}">确认</button>` : ''}<button data-action="preference-edit" data-key="${escapeHtml(key)}">编辑</button><button data-action="preference-delete" data-key="${escapeHtml(key)}" class="danger-ghost">删除</button></div></div>`; }).join('') : '<div class="empty-mini">还没有分支偏好</div>'}</div>${entries.length ? '<div class="card-actions"><button data-action="preference-confirm-all">全部确认</button><button data-action="preference-clear" class="danger-ghost">清空偏好</button></div>' : ''}</div>`;
}

function rightRailHtml(runtime) {
  const state = runtime.state;
  const tabs = [['context', '上下文'], ['progress', '进度'], ['preferences', '偏好'], ['config', '配置']];
  const body = state.ui.rightTab === 'progress' ? progressPanelHtml(runtime)
    : state.ui.rightTab === 'preferences' ? preferencesPanelHtml(runtime)
      : state.ui.rightTab === 'config' ? configPanelHtml(runtime) : contextPanelHtml(runtime);
  return `<aside class="right-rail pane pane-right" data-mobile-pane="right"><nav class="right-tabs">${tabs.map(([id, label]) => `<button data-action="right-tab" data-tab="${id}" class="${state.ui.rightTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>${body}</aside>`;
}

function mainContentHtml(runtime) {
  const view = runtime.state.ui.view;
  if (view === 'artifacts') return artifactsViewHtml(runtime);
  if (view === 'worldbook') return worldbookViewHtml(runtime);
  if (view === 'settings') return settingsViewHtml(runtime);
  if (view === 'logs') return logsViewHtml(runtime);
  return chatViewHtml(runtime);
}

function mobileNavHtml(state) {
  const tabs = [['left', '分支/Agent'], ['main', '工作区'], ['right', '上下文/进度']];
  return `<nav class="mobile-nav" aria-label="手机工作台导航">${tabs.map(([id, label]) => `<button data-action="mobile-pane" data-pane="${id}" class="${state.ui.mobilePane === id ? 'active' : ''}">${label}</button>`).join('')}</nav>`;
}

export function rikiWorkbenchStyle() {
  return `
    :host { all: initial; color-scheme: dark; }
    :host([hidden]) { display: none !important; }
    *, *::before, *::after { box-sizing: border-box; }
    button, input, textarea, select { font: inherit; }
    button { color: inherit; cursor: pointer; min-height: 42px; }
    button:disabled { cursor: not-allowed; opacity: .48; }
    button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #86a8ff; outline-offset: 2px; }
    .overlay { position: fixed; inset: 0; z-index: 2147482000; display: grid; place-items: center; padding: 10px; background: rgba(4,7,13,.76); backdrop-filter: blur(12px); color: #edf2ff; font-family: Inter, "Microsoft YaHei", system-ui, sans-serif; }
    .shell { --bg:#0c111e; --surface:#121a2b; --surface2:#182238; --line:rgba(173,191,238,.13); --muted:#91a0bf; --accent:#7698ff; width:min(1680px,99vw); height:min(1050px,98dvh); min-height:560px; display:grid; grid-template-rows:auto auto auto minmax(0,1fr) auto; overflow:hidden; border:1px solid rgba(141,164,226,.28); border-radius:22px; background:linear-gradient(155deg,#10182a 0%,#090e19 68%); box-shadow:0 32px 100px rgba(0,0,0,.55); }
    .app-header { min-height:62px; display:flex; align-items:center; gap:14px; padding:9px 14px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.018); }
    .brand { display:flex; gap:10px; align-items:center; min-width:0; }
    .brand-mark { width:38px; height:38px; display:grid; place-items:center; border-radius:13px; font-weight:900; background:linear-gradient(145deg,#4777ed,#8d4fdf); box-shadow:0 8px 24px rgba(86,105,231,.35); }
    .brand h1 { margin:0; font-size:16px; letter-spacing:.03em; }
    .brand p { margin:2px 0 0; color:var(--muted); font-size:11px; }
    .version { padding:5px 9px; border:1px solid rgba(118,152,255,.32); border-radius:999px; color:#a9c0ff; font:700 11px ui-monospace,monospace; }
    .header-spacer { flex:1; }
    .header-actions { display:flex; gap:6px; }
    .header-actions button { width:42px; border:1px solid var(--line); border-radius:11px; background:rgba(255,255,255,.045); font-size:18px; }
    .top-nav { display:flex; gap:4px; padding:6px 12px; border-bottom:1px solid var(--line); overflow:auto; background:rgba(6,10,18,.55); }
    .top-nav button { min-height:34px; padding:5px 13px; border:0; border-radius:9px; background:transparent; color:#aebbd6; white-space:nowrap; }
    .top-nav button.active { color:#fff; background:rgba(105,140,240,.18); box-shadow:inset 0 0 0 1px rgba(122,154,255,.24); }
    .notice { padding:7px 14px; border-bottom:1px solid var(--line); font-size:12px; }.notice-empty{min-height:0;padding:0;border:0}
    .notice-success { color:#b4f5d5; background:rgba(46,167,110,.13); }.notice-error { color:#ffc0c4; background:rgba(198,62,75,.16); }.notice-info { color:#bed2ff; background:rgba(70,111,211,.13); }
    .workspace { min-height:0; display:grid; grid-template-columns:278px minmax(0,1fr) 322px; }
    .pane { min-width:0; min-height:0; overflow:hidden; background:rgba(9,14,25,.72); }
    .left-rail { overflow:auto; border-right:1px solid var(--line); }
    .right-rail { border-left:1px solid var(--line); display:flex; flex-direction:column; }
    .rail-section { padding:11px; border-bottom:1px solid var(--line); }
    .rail-title,.right-title { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; color:#9caccc; font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
    .tiny { min-height:26px; width:30px; padding:0; border:1px solid var(--line); border-radius:8px; background:rgba(255,255,255,.05); }
    .primary,.accent { border-color:transparent!important; color:#fff!important; background:linear-gradient(145deg,#547dec,#7654d7)!important; }
    .danger { border-color:transparent!important; background:#a53547!important; }.danger-ghost { color:#f0a4ad!important; }
    .branch-list,.module-list { display:grid; gap:5px; }
    .branch-row { display:grid; grid-template-columns:1fr repeat(3,30px); gap:3px; padding:3px; border:1px solid transparent; border-radius:11px; }
    .branch-row.active { border-color:rgba(118,152,255,.25); background:rgba(96,128,226,.1); }
    .branch-main { min-width:0; text-align:left; border:0; background:transparent; padding:6px; }
    .branch-main strong,.branch-main small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.branch-main strong { font-size:12px; }.branch-main small { margin-top:3px; color:var(--muted); font-size:10px; }
    .branch-more { min-height:30px; border:0; border-radius:8px; background:transparent; color:#aab8d4; padding:0; }
    .segmented { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:3px; border-radius:11px; background:rgba(255,255,255,.04); }
    .segmented button { min-height:34px; border:0; border-radius:8px; background:transparent; color:#9eacc8; font-size:11px; }.segmented button.active { color:#fff; background:#26385e; }
    .wide { width:100%; margin-top:8px; border:1px solid var(--line); border-radius:9px; }
    .module { display:grid; grid-template-columns:32px 1fr; gap:8px; align-items:center; text-align:left; padding:7px; border:1px solid transparent; border-radius:11px; background:transparent; }
    .module:hover,.module.active { border-color:rgba(118,152,255,.25); background:rgba(96,128,226,.1); }.module-icon { width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#1d2943;color:#abc0ff;font-weight:800; }.module strong,.module small { display:block; }.module strong { font-size:12px; }.module small { margin-top:2px;color:var(--muted);font-size:9.5px;line-height:1.35; }
    .main-pane { min-width:0; min-height:0; overflow:hidden; background:rgba(11,16,28,.78); }
    .content-view { height:100%; min-height:0; display:flex; flex-direction:column; }
    .content-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:13px 16px; border-bottom:1px solid var(--line); }
    .content-toolbar h2 { margin:2px 0; font-size:17px; }.content-toolbar p { margin:0;color:var(--muted);font-size:11px; }.eyebrow { color:#88a9ff; font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
    .toolbar-actions,.inline-actions,.card-actions,.proposal-actions,.editor-actions,.composer-actions,.artifact-actions { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
    .toolbar-actions button,.inline-actions button,.card-actions button,.proposal-actions button,.editor-actions button,.composer-actions button,.artifact-actions button { min-height:36px; padding:6px 10px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.045); font-size:11px; }
    .messages { flex:1; min-height:0; overflow:auto; padding:18px clamp(12px,4vw,64px); scroll-behavior:smooth; }
    .message { max-width:920px; margin:0 auto 14px; padding:13px 15px; border:1px solid var(--line); border-radius:15px; background:rgba(19,27,45,.78); }
    .message-user { margin-left:auto; max-width:780px; background:rgba(55,78,135,.28); }.message-system { border-style:dashed;color:#b7c1d8; }
    .message header { display:flex; align-items:center; gap:8px; margin-bottom:8px; color:#9dadca; font-size:10px; }.message header time { margin-left:auto; }.message-content { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.65; font-size:13px; }.message-actions { display:flex; gap:4px; margin-top:9px; opacity:.72; }.message-actions button { min-height:28px; padding:3px 7px; border:0; border-radius:7px; color:#b3c1dd; background:transparent; font-size:10px; }.message-error { margin-top:8px;padding:7px;border-radius:8px;background:rgba(172,54,67,.16);color:#ffc1c7;font-size:11px; }
    .status { display:inline-flex; align-items:center; min-height:20px; padding:2px 6px; border-radius:999px; color:#b7c5df; background:rgba(255,255,255,.07); font-size:9px; white-space:nowrap; }.status-streaming,.status-pending { color:#c9d7ff;background:rgba(81,119,218,.23); }.status-confirmed,.status-complete { color:#aff0d1;background:rgba(47,162,111,.2); }.status-error,.status-rejected { color:#ffc2c7;background:rgba(186,61,74,.2); }
    .message-editor,.composer textarea,.worldbook-content,.system-editor { width:100%; resize:vertical; border:1px solid var(--line); border-radius:10px; background:rgba(0,0,0,.22); color:#fff; padding:10px; line-height:1.55; }
    .empty-state { min-height:100%; display:grid; place-content:center; justify-items:center; text-align:center; color:var(--muted); padding:30px; }.empty-state h3 { margin:8px 0;color:#dde6fb; }.empty-state p { max-width:600px;line-height:1.6; }.empty-glyph { width:70px;height:70px;display:grid;place-items:center;border-radius:24px;background:linear-gradient(145deg,#345ed0,#8150d4);color:#fff;font-size:28px;font-weight:900;box-shadow:0 18px 45px rgba(77,83,213,.28); }.quick-prompts { display:flex;gap:7px;flex-wrap:wrap;justify-content:center; }.quick-prompts button { border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);padding:7px 10px; }
    .proposal-card { max-width:940px; margin:0 auto 10px; padding:13px; border:1px solid rgba(105,143,255,.35); border-radius:15px; background:rgba(39,58,106,.23); }.proposal-card header { display:flex;justify-content:space-between;gap:8px; }.proposal-card h3 { margin:3px 0 0;font-size:14px; }.proposal-card details pre,.artifact-detail pre,.log-detail pre,.resolution-box pre { max-height:320px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:rgba(0,0,0,.22);border:1px solid var(--line);border-radius:9px;padding:10px;font:11px/1.5 ui-monospace,monospace; }.proposal-items { display:grid;gap:5px;margin:9px 0; }.proposal-item { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px;border-radius:9px;background:rgba(255,255,255,.035); }.proposal-item button { min-height:30px;border:1px solid var(--line);border-radius:7px;background:transparent; }
    .composer { padding:10px 14px max(10px,env(safe-area-inset-bottom)); border-top:1px solid var(--line); background:rgba(8,13,23,.94); }.composer textarea { min-height:82px;max-height:230px; }.composer-meta { display:flex;gap:10px;margin-bottom:6px;color:#93a3c1;font-size:10px; }.composer-actions { justify-content:flex-end;margin-top:7px; }.hint,.muted { color:var(--muted);font-size:10px; }.composer-actions .hint { margin-right:auto; }
    .lazy-progress { padding:7px 16px;border-bottom:1px solid var(--line);background:rgba(90,74,184,.13);color:#c9c2ff;font-size:11px; }.lazy-actions{display:inline-flex;gap:5px;margin-left:10px}.lazy-actions button{min-height:28px;border:1px solid var(--line);border-radius:7px;background:rgba(255,255,255,.05);font-size:10px}
    .right-tabs { display:grid;grid-template-columns:repeat(4,1fr);padding:6px;border-bottom:1px solid var(--line); }.right-tabs button { min-height:34px;border:0;border-radius:8px;background:transparent;color:#99a9c7;font-size:10px; }.right-tabs button.active { color:#fff;background:#223153; }.right-panel-content { min-height:0;overflow:auto;padding:12px; }.context-books details { border-bottom:1px solid var(--line); }.context-books summary { padding:9px 2px;cursor:pointer;font-size:11px; }.context-entry { display:grid;grid-template-columns:20px 1fr;gap:7px;padding:7px;border-radius:8px; }.context-entry:hover { background:rgba(255,255,255,.035); }.context-entry strong,.context-entry small { display:block; }.context-entry strong { font-size:11px; }.context-entry small { margin-top:3px;color:var(--muted);font-size:9px;line-height:1.35; }.book-badge { display:inline-block;margin-left:3px;padding:2px 4px;border-radius:5px;background:rgba(255,255,255,.07);font-size:8px; }.book-badge.chat{color:#b8d2ff}.book-badge.character{color:#cfbbff}.book-badge.global{color:#aee8cb}.progress-list { display:grid;gap:6px; }.progress-list button { display:grid;grid-template-columns:28px 1fr;text-align:left;gap:7px;padding:8px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025); }.progress-list button.complete { border-color:rgba(60,174,120,.25); }.progress-list strong,.progress-list small { display:block; }.progress-list small { color:var(--muted);font-size:9px; }.boundary-box { margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025);font-size:10px; }.boundary-box ul { padding-left:17px;line-height:1.7;color:var(--muted); }.config-summary { display:grid;grid-template-columns:76px 1fr;gap:8px;font-size:11px; }.config-summary dt { color:var(--muted); }.config-summary dd { margin:0;overflow-wrap:anywhere; }.preference-form{display:grid;gap:6px}.preference-form input,.preference-form textarea{width:100%;border:1px solid var(--line);border-radius:8px;background:rgba(0,0,0,.2);color:#fff;padding:7px;font-size:10px}.preference-form textarea{min-height:72px;resize:vertical}.preference-list{display:grid;gap:6px;margin-top:10px}.preference-row{padding:8px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.025)}.preference-row>div:last-child{display:flex;gap:3px;margin-top:5px}.preference-row strong,.preference-row small,.preference-row span{display:block}.preference-row small{max-height:72px;overflow:auto;margin-top:3px;color:#c5d0e8;font-size:9px;white-space:pre-wrap}.preference-row span{margin-top:4px;color:var(--muted);font-size:8px}.preference-row button{min-height:28px;border:0;border-radius:6px;background:rgba(255,255,255,.04);font-size:9px}
    .artifact-layout { flex:1;min-height:0;display:grid;grid-template-columns:150px 240px 1fr; }.artifact-kinds,.artifact-versions,.artifact-detail { min-height:0;overflow:auto;padding:11px;border-right:1px solid var(--line); }.artifact-kinds button { width:100%;display:flex;justify-content:space-between;border:0;border-radius:9px;background:transparent;padding:7px 9px; }.artifact-kinds button.active { background:#223153; }.artifact-versions h3 { margin:4px 0 9px;font-size:12px; }.version-row { width:100%;display:grid;grid-template-columns:30px 1fr auto;gap:5px;align-items:center;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:7px; }.version-row.active { border-color:rgba(118,152,255,.3);background:rgba(96,128,226,.1); }.version-row strong { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px; }.artifact-detail { border-right:0;padding:16px; }.artifact-detail>header { display:flex;justify-content:space-between; }.artifact-detail h3 { margin:3px 0 8px; }.diff-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px; }.trash-drawer { position:absolute;right:16px;bottom:16px;width:min(520px,calc(100% - 32px));max-height:60%;overflow:auto;padding:12px;border:1px solid var(--line);border-radius:14px;background:#111a2b;box-shadow:0 18px 60px rgba(0,0,0,.5); }.trash-drawer header,.trash-row { display:flex;align-items:center;justify-content:space-between;gap:8px; }.trash-row { padding:8px;border-top:1px solid var(--line); }.trash-row strong,.trash-row small { display:block; }.trash-row small { color:var(--muted);font-size:9px; }
    .worldbook-grid { flex:1;min-height:0;display:grid;grid-template-columns:220px 260px 1fr; }.book-column,.entry-column,.entry-editor { min-width:0;min-height:0;display:flex;flex-direction:column;padding:10px;border-right:1px solid var(--line); }.book-column input,.entry-column input,.form-grid input,.form-grid select,.settings-card input,.settings-card select,.settings-card textarea { width:100%;min-height:38px;border:1px solid var(--line);border-radius:9px;background:rgba(0,0,0,.2);color:#fff;padding:7px; }.scroll-list { flex:1;min-height:0;overflow:auto;margin-top:8px; }.book-row { width:100%;text-align:left;border:0;border-radius:9px;background:transparent;padding:8px; }.book-row.active { background:#223153; }.book-row strong,.book-row span { display:block; }.entry-row { display:grid;grid-template-columns:1fr 34px;border-radius:9px; }.entry-row.active { background:#223153; }.entry-row>button { border:0;background:transparent;text-align:left;padding:7px; }.entry-row strong,.entry-row small { display:block; }.entry-row small { color:var(--muted);font-size:9px; }.context-toggle.active { color:#aee8cb; }.entry-editor { border-right:0;overflow:auto; }.form-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px; }.form-grid label,.settings-card label { color:#9cabca;font-size:10px; }.span-2 { grid-column:1/-1; }.worldbook-content { min-height:300px;margin-top:5px; }.editor-actions { justify-content:flex-end;margin-top:9px; }
    .settings-grid { flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(340px,1fr) minmax(300px,.8fr);gap:10px;padding:12px; }.settings-card { align-self:start;padding:13px;border:1px solid var(--line);border-radius:14px;background:rgba(19,27,45,.72); }.settings-card>header { display:flex;justify-content:space-between;gap:8px;margin-bottom:10px; }.settings-card h3 { margin:3px 0;font-size:14px; }.settings-card label { display:block;margin:7px 0; }.settings-card label>input,.settings-card label>select,.settings-card label>textarea { margin-top:4px; }.settings-card .check { display:flex;align-items:center;gap:7px; }.settings-card .check input { width:auto;min-height:0;margin:0; }.system-card { grid-column:1/-1; }.system-editor { min-height:320px!important; }.resolution-box { margin-top:10px; }.resolution-box strong { font-size:10px; }
    .logs-layout { flex:1;min-height:0;display:grid;grid-template-columns:300px 1fr; }.log-list,.log-detail { min-height:0;overflow:auto;padding:10px;border-right:1px solid var(--line); }.log-list button { width:100%;display:grid;grid-template-columns:1fr auto;text-align:left;gap:4px;padding:8px;border:1px solid transparent;border-radius:9px;background:transparent; }.log-list button.active { border-color:rgba(118,152,255,.3);background:rgba(96,128,226,.1); }.log-list small { grid-column:1/-1;color:var(--muted);font-size:9px; }.log-detail { border-right:0; }.diagnostic-tabs { display:flex;gap:5px; }.diagnostic-tabs button { border:0;border-radius:8px;background:transparent; }.diagnostic-tabs button.active { background:#223153; }.log-detail pre { max-height:calc(100% - 50px); }
    .modal-backdrop { position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:16px;background:rgba(2,5,10,.78); }.modal { width:min(1000px,96%);max-height:90%;overflow:auto;padding:14px;border:1px solid var(--line);border-radius:15px;background:#111a2b; }.modal>header,.modal>footer { display:flex;align-items:center;justify-content:space-between;gap:8px; }.modal>header button { border:0;background:transparent;font-size:20px; }.modal>footer { justify-content:flex-end;margin-top:10px; }.json-editor{width:100%;min-height:55dvh;margin-top:10px;resize:vertical;border:1px solid var(--line);border-radius:10px;background:#080d17;color:#eaf0ff;padding:11px;font:11px/1.5 ui-monospace,monospace}.empty-mini { padding:16px;text-align:center;color:var(--muted);font-size:10px; }
    .mobile-nav { display:none; }
    @media (hover:hover) { button:hover:not(:disabled) { filter:brightness(1.12); } .message-actions { opacity:.25; }.message:hover .message-actions { opacity:.85; } }
    @media (max-width:1100px) { .workspace { grid-template-columns:240px minmax(0,1fr) 280px; }.module small { display:none; }.artifact-layout { grid-template-columns:130px 190px 1fr; }.worldbook-grid { grid-template-columns:180px 220px 1fr; } }
    @media (max-width:820px) {
      .overlay { padding:0; }.shell { width:100vw;height:100dvh;min-height:0;border:0;border-radius:0;grid-template-rows:auto auto auto minmax(0,1fr) auto; }.app-header { min-height:56px;padding-top:max(8px,env(safe-area-inset-top)); }.brand p,.version { display:none; }.top-nav { padding-inline:6px; }.workspace { display:block;position:relative;min-height:0; }.pane,.main-pane { position:absolute;inset:0;display:none; }.workspace[data-mobile-pane="left"] .pane-left,.workspace[data-mobile-pane="main"] .main-pane,.workspace[data-mobile-pane="right"] .pane-right { display:flex; }.left-rail { border:0;flex-direction:column;overflow:auto;padding-bottom:8px; }.right-rail { border:0; }.main-pane { background:#0b101c; }.mobile-nav { display:grid;grid-template-columns:repeat(3,1fr);padding:6px max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));border-top:1px solid var(--line);background:#0a0f1b; }.mobile-nav button { min-height:44px;border:0;border-radius:9px;background:transparent;color:#9baac6;font-size:11px; }.mobile-nav button.active { color:#fff;background:#223153; }.content-toolbar { padding:10px; }.content-toolbar p { display:none; }.toolbar-actions button:not(:first-child) { display:none; }.messages { padding:12px 9px; }.message { padding:11px; }.message-actions { opacity:.9; }.composer { padding:8px 8px max(8px,env(safe-area-inset-bottom)); }.composer textarea { min-height:70px; }.artifact-layout,.worldbook-grid,.settings-grid,.logs-layout { display:block;overflow:auto; }.artifact-kinds { display:flex;overflow:auto;border:0; }.artifact-kinds button { width:auto;min-width:100px; }.artifact-versions,.artifact-detail,.book-column,.entry-column,.entry-editor,.log-list,.log-detail { height:auto;max-height:none;border:0;border-bottom:1px solid var(--line); }.artifact-versions { max-height:180px; }.book-column,.entry-column { min-height:180px;max-height:260px; }.entry-editor { min-height:420px; }.worldbook-content { min-height:240px; }.settings-grid { padding:8px; }.settings-card { margin-bottom:8px; }.system-editor { min-height:260px!important; }.logs-layout { min-height:0; }.log-list { max-height:220px; }.diff-grid { grid-template-columns:1fr; }.proposal-card { margin-inline:8px; }.content-toolbar h2 { font-size:15px; }.quick-prompts { display:grid; }.header-actions button { min-height:44px;width:44px; }
    }
    @media (max-width:390px) { .brand h1 { font-size:14px; }.top-nav button { padding-inline:9px;font-size:10px; }.composer-actions .hint { display:none; }.form-grid { grid-template-columns:1fr; }.span-2 { grid-column:auto; }.proposal-item { align-items:flex-start;flex-direction:column; }.settings-card>header { flex-direction:column; }.content-toolbar { align-items:flex-start; }.toolbar-actions { justify-content:flex-end; } }
    @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important;transition:none!important;animation:none!important; } }
  `;
}

export function rikiRenderWorkbench(runtime, options = {}) {
  const state = runtime.state;
  if (!runtime.shadow) return;
  if (!state.ui) return;
  const active = runtime.shadow.activeElement;
  const focusKey = active?.dataset?.field || active?.dataset?.modelField || active?.dataset?.systemField || active?.dataset?.bindingField || '';
  const selection = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
  const messagesScroll = runtime.shadow.querySelector('#riki-messages')?.scrollTop;
  runtime.shadow.innerHTML = `<style>${rikiWorkbenchStyle()}</style><div class="overlay"><section class="shell" role="dialog" aria-modal="true" aria-label="Riki 剧情工作台"><header class="app-header"><div class="brand"><div class="brand-mark">R</div><div><h1>Riki 剧情工作台</h1><p>非数据库剧情策划 · 分支 Agent · 成果版本 · 世界书</p></div></div><span class="version">v${escapeHtml(runtime.version)}</span><div class="header-spacer"></div><div class="header-actions"><button data-action="refresh" title="刷新当前数据" aria-label="刷新">↻</button><button data-action="close" title="关闭工作台" aria-label="关闭">×</button></div></header>${topNavHtml(state)}${noticeHtml(state)}<div class="workspace" data-mobile-pane="${escapeHtml(state.ui.mobilePane || 'main')}">${leftRailHtml(runtime)}<main class="main-pane pane" data-mobile-pane="main">${mainContentHtml(runtime)}</main>${rightRailHtml(runtime)}</div>${mobileNavHtml(state)}</section></div>`;
  if (focusKey) {
    const selector = `[data-field="${CSS.escape(focusKey)}"],[data-model-field="${CSS.escape(focusKey)}"],[data-system-field="${CSS.escape(focusKey)}"],[data-binding-field="${CSS.escape(focusKey)}"]`;
    const next = runtime.shadow.querySelector(selector);
    next?.focus?.();
    if (selection && typeof next?.setSelectionRange === 'function') {
      try { next.setSelectionRange(selection[0], selection[1]); } catch (_) {}
    }
  }
  if (options.scrollMessagesToEnd) {
    const messages = runtime.shadow.querySelector('#riki-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  } else if (Number.isFinite(messagesScroll)) {
    const messages = runtime.shadow.querySelector('#riki-messages');
    if (messages) messages.scrollTop = messagesScroll;
  }
}

export function rikiUpdateStreamingMessage(runtime, messageId, content) {
  const node = runtime.shadow?.querySelector(`[data-message-id="${CSS.escape(text(messageId))}"] .message-content`);
  if (node) node.textContent = text(content);
  const messages = runtime.shadow?.querySelector('#riki-messages');
  if (messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 180) messages.scrollTop = messages.scrollHeight;
}

export function rikiMountWorkbench(runtime) {
  const document = runtime.hostWindow?.document || globalThis.document;
  if (!document?.body) throw new Error('宿主 document.body 尚不可用');
  document.getElementById('riki-story-workbench-root')?.remove();
  document.getElementById('riki-story-workbench-launcher')?.remove();
  const root = document.createElement('div');
  root.id = 'riki-story-workbench-root';
  root.hidden = !runtime.state.open;
  const shadow = root.attachShadow({ mode: 'open' });
  document.body.appendChild(root);
  runtime.root = root;
  runtime.shadow = shadow;
  const clickHandler = event => {
    const target = event.target?.closest?.('[data-action]');
    if (!target) return;
    if (target.matches?.('select,input,textarea')) return;
    event.preventDefault();
    event.stopPropagation();
    Promise.resolve(runtime.uiAction?.(target.dataset.action, target, event)).catch(error => runtime.reportUiError?.(error));
  };
  const inputHandler = event => {
    runtime.uiInput?.(event.target, event);
    if (event.type === 'change' && event.target?.dataset?.action) {
      Promise.resolve(runtime.uiAction?.(event.target.dataset.action, event.target, event)).catch(error => runtime.reportUiError?.(error));
    }
  };
  const keyHandler = event => {
    if (event.key === 'Escape') {
      const modal = shadow.querySelector('.modal-backdrop');
      if (modal) runtime.uiAction?.('diff-close', modal, event);
      else runtime.close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && event.target?.matches?.('[data-field="composer"]')) {
      event.preventDefault();
      Promise.resolve(runtime.uiAction?.('planning-send', event.target, event)).catch(error => runtime.reportUiError?.(error));
    }
  };
  shadow.addEventListener('click', clickHandler);
  shadow.addEventListener('input', inputHandler);
  shadow.addEventListener('change', inputHandler);
  shadow.addEventListener('keydown', keyHandler);
  runtime.disposers.push(() => shadow.removeEventListener('click', clickHandler));
  runtime.disposers.push(() => shadow.removeEventListener('input', inputHandler));
  runtime.disposers.push(() => shadow.removeEventListener('change', inputHandler));
  runtime.disposers.push(() => shadow.removeEventListener('keydown', keyHandler));
  const launcher = document.createElement('button');
  launcher.id = 'riki-story-workbench-launcher';
  launcher.type = 'button';
  launcher.textContent = 'R';
  launcher.title = '打开 Riki 剧情工作台';
  launcher.setAttribute('aria-label', '打开 Riki 剧情工作台');
  launcher.style.cssText = 'position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(76px,calc(env(safe-area-inset-bottom) + 62px));z-index:2147481000;width:52px;height:52px;border-radius:18px;border:1px solid rgba(119,161,255,.48);color:#fff;font:800 18px system-ui;background:linear-gradient(145deg,#416fe1,#7b4ddf);box-shadow:0 10px 35px rgba(39,74,190,.45);cursor:pointer;';
  launcher.addEventListener('click', () => runtime.open());
  document.body.appendChild(launcher);
  runtime.disposers.push(() => launcher.remove());
  rikiRenderWorkbench(runtime);
  runtime.state.mounted = true;
  return root;
}
