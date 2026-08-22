/* Riki Story Workbench 1.3.2 | generated from src/riki-ui.js */
import { RIKI_PLANNING_MODULES, RIKI_ARTIFACT_KINDS, rikiPlanningStage } from './riki-planning.js';
import { rikiResolveModuleConfig } from './riki-model-config.js';
import { rikiProjectStrategyNextAction } from './riki-project-core.js';

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

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/gu, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/__([^_]+)__/gu, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, '<em>$1</em>');
}

function markdownHtml(value) {
  const source = text(value).replace(/\r\n?/gu, '\n');
  if (!source.trim()) return '<p class="stream-placeholder">正在连接模型…</p>';
  const lines = source.split('\n');
  const output = [];
  let inCode = false;
  let code = [];
  let list = '';
  const closeList = () => { if (list) output.push(`</${list}>`); list = ''; };
  for (const line of lines) {
    if (/^```/u.test(line)) {
      closeList();
      if (inCode) { output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = []; }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/u);
    if (heading) { closeList(); const level = heading[1].length + 1; output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const quote = line.match(/^>\s?(.*)$/u);
    if (quote) { closeList(); output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`); continue; }
    const unordered = line.match(/^[-*+]\s+(.+)$/u);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/u);
    if (unordered || ordered) {
      const nextList = ordered ? 'ol' : 'ul';
      if (list !== nextList) { closeList(); list = nextList; output.push(`<${list}>`); }
      output.push(`<li>${inlineMarkdown((ordered || unordered)[1])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) { output.push('<span class="paragraph-gap" aria-hidden="true"></span>'); continue; }
    output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  if (inCode) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  closeList();
  return output.join('');
}

function activeConversation(runtime) {
  const project = runtime.state.project;
  return array(project?.conversations).find(item => item.id === project.activeConversationId) || project?.conversations?.[0] || null;
}

function strategyMode(conversation) {
  return conversation?.strategyMode || conversation?.workflowMode || '';
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
  return ({ outline: '总纲', acts: '大章', chapters: '小章', characters: '人物' })[kind] || kind;
}

function stageLabel(stage) {
  return ({ discovery: '需求与总纲', outline_short: '简短大纲', outline_final: '正式总纲', acts_split: '大章拆分', acts_detail: '大章设计', acts: '大章', chapters: '小章', characters: '人物', ready: '策划成果齐备' })[stage] || stage;
}

function statusBadge(status) {
  const labels = { complete: '完成', running: '进行中', streaming: '生成中', compiling: '格式编译中', awaiting_content_confirmation: '等待正文确认', stopped: '已停止', error: '失败', pending: '待确认', confirmed: '已确认', rejected: '已打回', stale: '已过期', superseded: '旧版本', deleted: '回收站' };
  return `<span class="status status-${escapeHtml(status || 'complete')}">${escapeHtml(labels[status] || status || '完成')}</span>`;
}

function noticeHtml(state) {
  if (!state.notice?.message) return '';
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
    <div class="rail-title"><span>Agent 对话</span><button class="tiny" data-action="conversation-new" title="新建对话" aria-label="新建对话">＋</button></div>
    <div class="branch-list">${array(project?.conversations).map(conversation => `
      <div class="branch-row ${conversation.id === active?.id ? 'active' : ''}">
        <button class="branch-main" data-action="conversation-select" data-conversation-id="${escapeHtml(conversation.id)}">
          <strong>${escapeHtml(conversation.title)}</strong><small>${escapeHtml(stageLabel(conversation.stage || 'discovery'))} · ${array(conversation.messages).length} 条消息</small>
        </button>
        <button class="branch-more" data-action="conversation-rename" data-conversation-id="${escapeHtml(conversation.id)}" title="重命名" aria-label="重命名">✎</button>
        <button class="branch-more danger-ghost" data-action="conversation-delete" data-conversation-id="${escapeHtml(conversation.id)}" title="删除" aria-label="删除">⌫</button>
      </div>`).join('')}</div>
    <p class="rail-help">对话历史、阶段和上下文选择相互独立；正式成果与项目世界书在当前酒馆聊天内共享。</p>
  </section>`;
}

function workflowHtml(conversation) {
  const modes = [['detailed', '常规版'], ['lazy', '懒人版']];
  return `<section class="rail-section"><div class="rail-title"><span>工作流</span></div>
    <div class="segmented">${modes.map(([id, label]) => `<button data-action="workflow-mode" data-mode="${id}" class="${strategyMode(conversation) === id ? 'active' : ''}">${label}</button>`).join('')}</div>
  </section>`;
}

function moduleListHtml(conversation) {
  const visible = ['main', 'outline', 'act', 'chapter', 'character', 'format_guard'];
  return `<section class="rail-section modules"><div class="rail-title"><span>策划 Agent</span></div><div class="module-list">${visible.map(id => {
    const module = RIKI_PLANNING_MODULES[id];
    return `<button data-action="module-select" data-module="${id}" class="module ${conversation?.module === id ? 'active' : ''}"><span class="module-icon">${module.icon}</span><span><strong>${escapeHtml(module.label)}</strong><small>${escapeHtml(module.description)}</small></span></button>`;
  }).join('')}</div></section>`;
}

function leftRailHtml(runtime) {
  return `<aside class="left-rail pane pane-left" data-mobile-pane="left">
    ${conversationListHtml(runtime)}
  </aside>`;
}

function messageActions(message) {
  if (message.role === 'user') return `<div class="message-actions"><button data-action="message-edit" data-message-id="${escapeHtml(message.id)}">编辑</button><button data-action="message-delete" data-message-id="${escapeHtml(message.id)}">删除</button></div>`;
  if (message.role === 'assistant') return `<div class="message-actions"><button data-action="message-reroll" data-message-id="${escapeHtml(message.id)}">重 Roll</button><button data-action="message-delete" data-message-id="${escapeHtml(message.id)}">删除</button><button data-action="message-copy" data-message-id="${escapeHtml(message.id)}">复制</button></div>`;
  return '';
}

function requestLogDiagnostic(log) {
  return {
    status: log?.status || '', module: log?.module || '', pass: log?.pass || '',
    transport: log?.transport || '', model: log?.model || '', startedAt: log?.startedAt || '', endedAt: log?.endedAt || '',
    streamed: log?.streamed ?? null, fallback: log?.fallback ?? null,
    notice: log?.output?.notice || '', inputTokens: log?.output?.inputTokens ?? null,
    visibleOutput: log?.output?.visibleOutput || '', error: log?.output?.error || log?.error || null,
  };
}

function messageRequestHtml(state, message) {
  const request = message.request && typeof message.request === 'object' ? message.request : null;
  const ids = [...new Set([
    ...array(request?.logIds), request?.contentLogId, request?.compilerLogId, request?.logId,
  ].map(text).filter(Boolean))];
  const logs = ids.map(id => array(state.project?.requestLogs).find(log => log.id === id)).filter(Boolean);
  if (!request && !logs.length) return '';
  const selected = logs.find(log => log.id === state.ui.messageLogId) || logs[0] || null;
  const mode = ['input', 'diagnostic', 'raw', 'combined'].includes(state.ui.messageLogMode) ? state.ui.messageLogMode : 'combined';
  const display = !selected ? request
    : mode === 'input' ? selected.input
      : mode === 'diagnostic' ? requestLogDiagnostic(selected)
        : mode === 'raw' ? selected.output?.rawOutput || selected.output?.error || ''
          : selected;
  const logButtons = logs.map((log, index) => `<div class="message-log-group"><b>${escapeHtml(log.pass === 'compiler' ? '格式编译' : index ? `请求 ${index + 1}` : '内容生成')} · ${statusBadge(log.status || 'running')}</b><div>${[['input','输入'],['diagnostic','输出诊断'],['raw','AI 原文'],['combined','合并收发']].map(([id,label]) => `<button data-action="message-log-view" data-log-id="${escapeHtml(log.id)}" data-log-mode="${id}" class="${selected?.id === log.id && mode === id ? 'active' : ''}">${label}</button>`).join('')}</div></div>`).join('');
  const displayText = typeof display === 'string' ? display : safeJson(display);
  const truncated = displayText.length > 16000;
  const preview = truncated ? `${displayText.slice(0, 16000)}\n\n[回复内预览已截断；完整内容仍可在“日志”页查看或导出。]` : displayText;
  return `<details class="message-request" ${selected && state.ui.messageLogId === selected.id ? 'open' : ''}><summary>请求详情${logs.length ? ` · ${escapeHtml(logs.at(-1)?.status || '')}` : ''}</summary>${logButtons}<pre class="message-log-output" data-log-id="${escapeHtml(selected?.id || '')}">${escapeHtml(preview)}</pre></details>`;
}

function stageFollowupHtml(state, conversation, message, isLatestAssistant) {
  if (!isLatestAssistant || message.role !== 'assistant' || message.status !== 'complete' || state.generation?.active) return '';
  const moduleId = conversation?.module || 'outline';
  const progress = conversation?.strategyProgress?.[moduleId];
  if (progress?.messageId && progress.messageId !== message.id) return '';
  const action = rikiProjectStrategyNextAction(conversation, moduleId);
  const isCompiler = moduleId === 'format_guard';
  if (!isCompiler && !['generate', 'auto_generate'].includes(action)) return '';
  const label = ({
    outline: '确认当前方向并生成总纲详细草稿',
    act: '确认大章走向并生成大章详细草稿',
    chapter: '确认小章走向并生成小章详细草稿',
    character: '确认人物方向并生成人物详细草稿',
  })[moduleId] || '确认当前方向并进入详细设计';
  return `<div class="stage-confirmation message-followup"><div><strong>${isCompiler ? '格式编译只处理已经确认过的正文' : '这一轮讨论完成后，由你决定是否进入正式生成'}</strong><small>${isCompiler ? '不会补写新剧情；找不到可编译正文时会明确报错。' : '按钮跟随当前回复；你也可以继续讨论，旧回复上的入口会自动让位给最新一轮。'}</small></div><div>${isCompiler ? '' : '<button data-action="discussion-continue">继续讨论</button>'}${action === 'auto_generate' ? '<button class="formal-button" data-action="lazy-start">确认方向并开始自动生成</button>' : `<button class="formal-button" data-action="generate-formal">${escapeHtml(label)}</button>`}</div></div>`;
}

function messageHtml(state, message, followup = '') {
  const editing = state.ui.editingMessageId === message.id;
  const label = message.role === 'user' ? '你' : message.role === 'assistant' ? (RIKI_PLANNING_MODULES[message.module]?.label || 'Riki') : '系统';
  const module = message.role === 'assistant' ? RIKI_PLANNING_MODULES[message.module] : null;
  const when = text(message.createdAt || message.at);
  const clock = when.includes('T') ? when.slice(11, 16) : when.slice(0, 5);
  const request = messageRequestHtml(state, message);
  const status = message.status && message.status !== 'complete' ? statusBadge(message.status) : '';
  const error = message.error ? `<div class="message-error"><strong>本轮请求未完成</strong><small>${escapeHtml(message.error.message || message.error)}</small></div>` : '';
  const contentGate = message.status === 'awaiting_content_confirmation' ? `<div class="content-confirmation"><strong>正文已生成，尚未写入正式成果</strong><small>确认正文后才调用格式编译 Agent；也可以先回主控继续讨论和修改。</small><div><button class="primary" data-action="content-confirm-compile" data-message-id="${escapeHtml(message.id)}">确认正文并格式转换</button><button data-action="content-return-controller" data-message-id="${escapeHtml(message.id)}">回主控讨论</button></div></div>` : '';
  return `<article class="message turn message-${escapeHtml(message.role)} ${message.error ? 'is-error' : ''} ${message.status === 'streaming' ? 'is-streaming' : ''}" data-message-id="${escapeHtml(message.id)}">
    <div class="message-avatar" aria-hidden="true">${message.role === 'user' ? '我' : message.role === 'assistant' ? 'R' : 'i'}</div>
    <div class="message-main"><header><strong>${escapeHtml(label)}</strong>${module ? `<span class="module-badge">${escapeHtml(module.label)}</span>` : ''}${status}<time>${escapeHtml(clock)}</time></header>
    ${editing ? `<textarea class="message-editor" data-field="message-edit-draft">${escapeHtml(state.ui.messageEditDraft)}</textarea><div class="inline-actions"><button data-action="message-edit-cancel">取消</button><button class="primary" data-action="message-edit-save" data-message-id="${escapeHtml(message.id)}">保存并重新生成</button></div>` : `<div class="message-content">${markdownHtml(message.content)}${message.status === 'streaming' ? '<span class="stream-caret" aria-hidden="true"></span>' : ''}</div>`}
    ${error}${contentGate}${followup}${request}${messageActions(message)}</div>
  </article>`;
}

function proposalHtml(conversation) {
  const proposal = conversation?.pendingProposal;
  if (!proposal) return '';
  const items = array(proposal.items);
  const rejected = items.filter(item => item.status === 'rejected');
  return `<section class="proposal-card">
    <header><div><span class="eyebrow">正式成果候选</span><h3>${escapeHtml(artifactLabel(proposal.kind))} · ${escapeHtml(proposal.summary || '')}</h3></div>${statusBadge(proposal.status || 'pending')}</header>
    <details><summary>查看候选 JSON 与基线</summary><pre>${escapeHtml(safeJson({ baseVersionId: proposal.baseVersionId, changeLevel: proposal.changeLevel, mergeMode: proposal.mergeMode, content: proposal.content }))}</pre></details>
    ${items.length ? `<div class="proposal-items">${items.map(item => `<div class="proposal-item"><span>${escapeHtml(item.label || item.itemId)}</span><div><button data-action="proposal-item" data-item-id="${escapeHtml(item.itemId)}" data-status="confirmed" class="${item.status === 'confirmed' ? 'active success' : ''}">确认</button><button data-action="proposal-item" data-item-id="${escapeHtml(item.itemId)}" data-status="rejected" class="${item.status === 'rejected' ? 'active danger' : ''}">打回</button></div></div>`).join('')}</div>` : ''}
    <div class="proposal-actions">${rejected.length ? `<button class="accent" data-action="proposal-regenerate-rejected">只重做被打回的 ${rejected.length} 项</button>` : ''}<button class="primary" data-action="proposal-confirm-all">${items.length ? '全部确认并保存版本' : '确认并保存版本'}</button><button data-action="proposal-edit">编辑 JSON</button><button class="danger-ghost" data-action="proposal-reject">放弃候选</button></div>
  </section>`;
}

function chatViewHtml(runtime) {
  const state = runtime.state;
  const project = state.project;
  const conversation = activeConversation(runtime);
  const stage = rikiPlanningStage(project);
  const messages = array(conversation?.messages);
  const mode = strategyMode(conversation);
  const lazyBatch = project?.runtime?.lazyBatch?.conversationId === conversation?.id ? project.runtime.lazyBatch : null;
  const selectedModule = RIKI_PLANNING_MODULES[conversation?.module] || RIKI_PLANNING_MODULES.outline;
  const latestAssistant = [...messages].reverse().find(message => message.role === 'assistant');
  const strategyChooser = !mode && !messages.length ? `<div class="empty-state strategy-welcome"><div class="empty-glyph">✦</div><h3>先选择这次策划方式</h3><p>选定后会自动读取你勾选的世界书与正文，并由总纲 Agent 发出第一轮讨论。</p><div class="strategy-cards"><button data-action="workflow-mode" data-mode="lazy"><strong>懒人版</strong><small>总纲 Agent 自动发起讨论；你确认方向后，连续生成、格式转换并保存全部成果。</small></button><button data-action="workflow-mode" data-mode="detailed"><strong>常规版</strong><small>总纲 Agent 自动发起讨论；每阶段确认方向和正文后再保存成果。</small></button></div></div>` : '';
  const regularWelcome = mode && !messages.length ? `<div class="empty-state strategy-welcome"><div class="empty-glyph">✦</div><h3>正在准备第一轮总纲讨论</h3><p>Riki 会先读取当前角色绑定世界书，再由总纲 Agent 提出关键问题。</p></div>` : '';
  return `<section class="content-view chat-view" data-stage="${escapeHtml(stage)}">
    ${lazyBatch ? `<div class="lazy-progress"><strong>懒人版：</strong>${escapeHtml(lazyBatch.status || '')} · ${escapeHtml(lazyBatch.currentStep?.moduleId || lazyBatch.currentStep?.kind || '')} · 已完成 ${array(lazyBatch.generated).length}/${4}${lazyBatch.error ? ` · ${escapeHtml(lazyBatch.error)}` : ''}${lazyBatch.status === 'awaiting_confirmation' ? '<span class="lazy-actions"><button data-action="lazy-confirm">统一确认</button><button data-action="lazy-reject" class="danger-ghost">整批回滚</button></span>' : ''}${lazyBatch.status === 'failed' ? '<span class="lazy-actions"><button data-action="lazy-reject" class="danger-ghost">回滚失败批次</button></span>' : ''}</div>` : ''}
    <div class="messages ${state.generation?.active ? 'streaming-active' : ''}" id="riki-messages">${messages.length ? messages.map(message => messageHtml(state, message, stageFollowupHtml(state, conversation, message, latestAssistant?.id === message.id))).join('') : strategyChooser || regularWelcome}</div>
    ${proposalHtml(conversation)}
    ${state.ui.showProposalEditor ? `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="编辑成果候选"><header><h3>编辑候选 JSON</h3><button data-action="proposal-edit-cancel" aria-label="关闭">×</button></header><textarea class="json-editor" data-field="proposal-edit-json">${escapeHtml(state.ui.proposalEditJson)}</textarea><footer><button data-action="proposal-edit-cancel">取消</button><button class="primary" data-action="proposal-edit-save">保存为待确认候选</button></footer></section></div>` : ''}
    <footer class="composer">
      <div class="compose-box"><textarea data-field="composer" placeholder="${mode ? '输入你的剧情想法，或继续讨论当前阶段…' : '请先在上方选择总体策略模式'}" ${state.busy || !mode ? 'disabled' : ''}>${escapeHtml(state.ui.composerDraft || '')}</textarea>${state.generation?.active ? `<button class="send-button danger" data-action="generation-stop" aria-label="停止生成">■</button>` : `<button class="send-button primary" data-action="planning-send" aria-label="发送" ${mode ? '' : 'disabled'}>➤</button>`}</div>
      <div class="composer-meta"><span>${mode ? `${escapeHtml(selectedModule.label)} · ${escapeHtml(({ detailed: '常规版', brief: '粗略版（兼容）', lazy: '懒人版' })[mode] || mode)} · 上下文 ${selectedContextKeys(conversation).length} 条` : '正式成果双调用 · 编译失败不自动重试'}</span><span>${escapeHtml(state.resolvedModelConfig?.apiPresetName || '尚未配置模型连接')} · ${escapeHtml(state.resolvedModelConfig?.model || '模型由连接决定')}</span></div>
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
    <section class="worldbook-ai"><div><span class="eyebrow">模型讨论与受控提案</span><p>用当前 Agent 的酒馆连接预设、模型与 System 配置讨论世界书；只有返回明确提案后，才可载入编辑器继续做 Diff 与二次确认。</p></div><textarea data-field="worldbook-discussion" placeholder="例如：结合当前剧情，讨论是否需要补充这条世界规则；若需要修改，请只返回一个受控修改提案。">${escapeHtml(state.ui.worldbookDiscussionInput || '')}</textarea><button class="primary" data-action="worldbook-discuss" ${state.generation?.active ? 'disabled' : ''}>让模型讨论并提出修改</button>${state.pendingSuggestion ? `<div class="suggestion-card"><strong>模型返回了世界书修改提案</strong><small>${escapeHtml(state.pendingSuggestion.reason || '未填写理由')}</small><div><button class="primary" data-action="worldbook-suggestion-load">载入编辑器审查</button><button class="danger-ghost" data-action="worldbook-suggestion-reject">拒绝提案</button></div></div>` : ''}</section>
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

function legacySettingsViewHtml(runtime) {
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
  const conversation = activeConversation(runtime);
  const ownLogs = logs.filter(item => item.conversationId === conversation?.id);
  const mode = ['input', 'diagnostic', 'raw', 'combined'].includes(state.ui.logMode) ? state.ui.logMode : 'combined';
  let payload = selected;
  if (selected && mode === 'input') payload = selected.input;
  if (selected && mode === 'diagnostic') payload = { status: selected.status, module: selected.module, pass: selected.pass, transport: selected.transport, model: selected.model, startedAt: selected.startedAt, endedAt: selected.endedAt, streamed: selected.streamed, fallback: selected.fallback, notice: selected.output?.notice || '', inputTokens: selected.output?.inputTokens ?? null, error: selected.output?.error || selected.error || null };
  if (selected && mode === 'raw') payload = selected.output?.rawOutput || selected.output?.error || '';
  const display = typeof payload === 'string' ? payload : safeJson(payload);
  return `<section class="content-view logs-view"><div class="content-toolbar"><div><span class="eyebrow">可观测性</span><h2>请求日志与输入/输出诊断</h2><p>完整输入、输出诊断、AI 原文与合并收发相互独立；API Key、Authorization 与酒馆 secret 引用均被隐藏。</p></div><div class="toolbar-actions"><button data-action="logs-copy" ${selected ? '' : 'disabled'}>复制当前视图</button><button data-action="logs-export" ${selected ? '' : 'disabled'}>导出当前视图</button><button data-action="logs-export-conversation" ${ownLogs.length ? '' : 'disabled'}>导出当前分支</button><button data-action="logs-export-all" ${logs.length ? '' : 'disabled'}>导出全部</button><button data-action="logs-clear-conversation" class="danger-ghost" ${ownLogs.length ? '' : 'disabled'}>清空当前分支</button><button data-action="logs-clear-all" class="danger-ghost" ${logs.length ? '' : 'disabled'}>清空全部</button></div></div><div class="logs-layout"><aside class="log-list">${logs.length ? logs.map(log => `<button data-action="log-select" data-log-id="${escapeHtml(log.id)}" class="${selected?.id === log.id ? 'active' : ''}"><strong>${escapeHtml(RIKI_PLANNING_MODULES[log.module]?.label || log.module || '请求')}</strong><span>${statusBadge(log.status)}</span><small>${escapeHtml(text(log.startedAt).replace('T', ' ').slice(0, 19))} · ${escapeHtml(log.transport || '')} · ${escapeHtml(log.model || '')}</small></button>`).join('') : '<div class="empty-mini">还没有请求日志</div>'}</aside><div class="log-detail">${selected ? `<div class="diagnostic-tabs"><button data-action="log-mode" data-mode="input" class="${mode === 'input' ? 'active' : ''}">完整输入</button><button data-action="log-mode" data-mode="diagnostic" class="${mode === 'diagnostic' ? 'active' : ''}">输出诊断</button><button data-action="log-mode" data-mode="raw" class="${mode === 'raw' ? 'active' : ''}">AI 原文</button><button data-action="log-mode" data-mode="combined" class="${mode === 'combined' ? 'active' : ''}">合并收发</button></div><pre>${escapeHtml(display)}</pre>` : '<div class="empty-state"><h3>运行一次 Agent 请求后查看</h3></div>'}</div></div></section>`;
}

function contextPanelHtml(runtime) {
  const state = runtime.state;
  const conversation = activeConversation(runtime);
  const selected = new Set(selectedContextKeys(conversation));
  const books = array(state.inventory);
  const search = text(state.ui.contextSearch).trim().toLowerCase();
  const filter = state.ui.contextFilter || 'all';
  const matches = entry => { const haystack = `${entry.name} ${entry.uid} ${array(entry.strategy?.keys).join(' ')} ${entry.content}`.toLowerCase(); return (!search || haystack.includes(search)) && (filter === 'all' || filter === 'enabled' && entry.enabled !== false || filter === 'blue' && entry.strategy?.type === 'constant' || filter === 'green' && entry.strategy?.type !== 'constant'); };
  return `<div class="right-panel-content"><div class="right-title"><h3>世界书与条目</h3><span>已选 ${selected.size} 条</span></div><p class="muted">默认选择当前角色卡绑定世界书。只有勾选条目会投喂；全部资料按不可信上下文处理。</p><label class="compact-field">携带最近正文<select data-action="context-depth"><option value="0" ${conversation?.context?.mainChatDepth === 0 ? 'selected' : ''}>不携带</option><option value="6" ${conversation?.context?.mainChatDepth === 6 ? 'selected' : ''}>最近 6 条</option><option value="12" ${conversation?.context?.mainChatDepth === 12 ? 'selected' : ''}>最近 12 条</option><option value="24" ${conversation?.context?.mainChatDepth === 24 ? 'selected' : ''}>最近 24 条</option><option value="-1" ${conversation?.context?.mainChatDepth === -1 ? 'selected' : ''}>全部（受总预算限制）</option></select></label><label class="compact-field">成果存放方式<select data-action="context-project-book-mode"><option value="own" ${(conversation?.context?.projectBookMode || 'own') === 'own' ? 'selected' : ''}>独立项目书（当前聊天）</option><option value="original" ${conversation?.context?.projectBookMode === 'original' ? 'selected' : ''}>直写角色原世界书</option></select></label><p class="muted">确认成果后自动同步；独立模式创建并绑定当前聊天专属书，直写模式只替换角色主世界书中的 Riki· 前缀条目，其他条目不动。</p><input class="context-search" data-field="context-search" value="${escapeHtml(state.ui.contextSearch || '')}" placeholder="搜索标题、uid、关键词、正文"><label class="compact-field">筛选<select data-action="context-filter"><option value="all" ${filter === 'all' ? 'selected' : ''}>全部</option><option value="enabled" ${filter === 'enabled' ? 'selected' : ''}>仅启用</option><option value="blue" ${filter === 'blue' ? 'selected' : ''}>蓝灯</option><option value="green" ${filter === 'green' ? 'selected' : ''}>绿灯</option></select></label><div class="panel-actions"><button data-action="context-select" data-mode="all">全选</button><button data-action="context-select" data-mode="none">全不选</button><button data-action="context-select" data-mode="blue">仅蓝灯</button><button data-action="context-select" data-mode="green">仅绿灯</button><button data-action="context-select" data-mode="filtered">全选筛选结果</button><button data-action="view" data-view="worldbook">管理与修改世界书</button></div><div class="context-books">${books.map(book => { const entries = array(state.books.get(book.name)).filter(matches); return `<details ${book.name === state.activeBookName ? 'open' : ''}><summary><span>${escapeHtml(book.name)}</span>${bookBadges(book)}</summary>${entries.length ? entries.map(entry => { const key = `${book.name}::${entry.uid}`; return `<label class="context-entry"><input type="checkbox" data-action="context-checkbox" data-book="${escapeHtml(book.name)}" data-uid="${escapeHtml(entry.uid)}" ${selected.has(key) ? 'checked' : ''}><span><strong>${escapeHtml(entry.name)}</strong><small>uid=${escapeHtml(entry.uid)} · ${entry.strategy?.type === 'constant' ? '蓝灯' : '绿灯'} · ${escapeHtml(text(entry.content).slice(0, 90))}</small></span></label>`; }).join('') : `<button data-action="context-load-book" data-book="${escapeHtml(book.name)}">读取条目</button>`}</details>`; }).join('') || '<div class="empty-mini">尚未读取世界书库存</div>'}</div></div>`;
}

function progressPanelHtml(runtime) {
  const project = runtime.state.project;
  const hasCharacters = Boolean(currentArtifact(project, 'characters'));
  return `<div class="right-panel-content"><div class="right-title"><h3>${escapeHtml(project.title || '未命名项目')}</h3><span>${escapeHtml(stageLabel(rikiPlanningStage(project)))}</span></div><div class="progress-list">${RIKI_ARTIFACT_KINDS.map(kind => { const artifact = currentArtifact(project, kind); return `<button data-action="open-artifact" data-kind="${kind}" class="${artifact ? 'complete' : ''}"><span>${artifact ? '✓' : '○'}</span><div><strong>${escapeHtml(artifactLabel(kind))}</strong><small>${artifact ? `v${artifact.version} · ${artifact.summary || '已确认'}` : '尚无已确认版本'}</small></div></button>`; }).join('')}</div>${hasCharacters ? '<section class="panel-section"><div class="right-title"><h3>人物槽位回填</h3><span>版本化，不覆盖旧成果</span></div><p class="muted">把大章/小章中的 {{HIGHn}} / {{MIDn}} 替换为已确认人物姓名；有变化时分别建立下游新版本。</p><button data-action="artifact-backfill-slots">重新检查并回填人物槽位</button></section>' : ''}<section class="panel-section"><div class="right-title"><h3>跨设备迁移</h3><span>不含 API 密钥</span></div><p class="muted">导出完整版本链、决策记录与分支偏好；已有成果时导入会先进入可恢复的回收站。</p><div class="panel-actions"><button data-action="project-export">导出全部策划成果</button><button class="primary" data-action="project-import">从文件导入成果</button></div></section><section class="panel-section"><div class="right-title"><h3>回收站</h3><span>${array(project.recycleBin).filter(item => !item.restoredAt && !item.permanentlyDeletedAt).length} 批</span></div><button data-action="view" data-view="artifacts">打开版本链与回收站</button></section></div>`;
}

function configPanelHtml(runtime) {
  const state = runtime.state;
  const library = state.modelLibrary || { apiPresets: [], systemPresets: [] };
  const api = state.modelDraft || array(library.apiPresets)[0] || {};
  const system = state.systemDraft || array(library.systemPresets)[0] || {};
  const scope = state.ui.settingsModule || 'main';
  const binding = state.bindingDraft || {};
  const profile = array(state.connectionProfiles).find(item => item.id === api.profileId);
  const moduleOptions = [['main','主控 Agent 配置（可绑轻量模型）'],['default','默认配置（所有次 Agent 继承）'], ...Object.entries(RIKI_PLANNING_MODULES).filter(([id]) => id !== 'main').map(([id,item]) => [id,item.label])];
  const modelOptions = array(state.availableModels);
  return `<div class="right-panel-content config-panel-original">
    <div class="right-title"><h3>配置作用域</h3><button data-action="settings-refresh">重新读取</button></div>
    <p class="muted">API 配置、模型选择与 System 预设保存在设备级 extensionSettings / 本地存储；重新导入版本后继续沿用。</p>
    <label class="compact-field">歧义路由模式<select data-action="routing-fallback"><option value="api" ${state.project?.config?.routingFallback !== 'code' ? 'selected' : ''}>只调用 API（主控模型决定）</option><option value="code" ${state.project?.config?.routingFallback === 'code' ? 'selected' : ''}>只走代码规则（零请求）</option></select></label>
    <label class="compact-field">正在配置<select data-action="settings-module">${moduleOptions.map(([id,label]) => `<option value="${id}" ${scope === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
    <section class="panel-section"><div class="right-title"><h3>API、酒馆连接预设与模型</h3><span>设备全局库</span></div>
      <label class="compact-field">Riki API 配置<select data-action="api-select">${apiPresetOptions(library, api.id)}</select></label>
      <div class="panel-actions"><button data-action="api-new">新建 API</button><button class="primary" data-action="api-save">保存 API</button><button class="danger-ghost" data-action="api-delete" ${api.id === 'tavern-profile-default' ? 'disabled' : ''}>删除</button></div>
      <label class="compact-field">配置名称<input data-model-field="name" value="${escapeHtml(api.name)}"></label>
      <label class="compact-field">连接方式<select data-model-field="transport"><option value="profile" ${api.transport === 'profile' ? 'selected' : ''}>引用酒馆连接预设（地址 + Key）</option><option value="direct" ${api.transport === 'direct' ? 'selected' : ''}>独立 OpenAI-compatible SSE</option></select></label>
      ${api.transport === 'profile' ? `<label class="compact-field">酒馆连接预设<select data-model-field="profileId"><option value="">请选择</option>${array(state.connectionProfiles).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === api.profileId ? 'selected' : ''}>${escapeHtml(item.name || item.id)}</option>`).join('')}</select></label>${profile ? `<div class="profile-ref"><strong>${escapeHtml(profile.name)}</strong><small>地址：${escapeHtml(profile.endpoint || '由酒馆来源决定')}</small><small>Key：${escapeHtml(profile.credential || '酒馆密钥库引用（已隐藏）')}</small><small>酒馆生成预设：${escapeHtml(profile.tavernPreset || '未绑定')}</small><em>Riki 只保存连接预设 ID；不复制 Key 明文。</em></div>` : '<p class="muted">先在酒馆“连接配置文件”中保存 URL、API Key 与生成预设，再回到这里选择。</p>'}` : `<label class="compact-field">端点 URL<input data-model-field="endpoint" value="${escapeHtml(api.endpoint)}" placeholder="https://example.com/v1"></label><label class="compact-field">API Key<input type="password" data-model-field="apiKey" value="${escapeHtml(api.apiKey)}"></label><label class="compact-field">发送路径<select data-model-field="viaBackend"><option value="false" ${!api.viaBackend ? 'selected' : ''}>纯前端浏览器 SSE</option><option value="true" ${api.viaBackend ? 'selected' : ''}>经酒馆后端转发</option></select></label>`}
      <label class="compact-field">模型（可手填）<input data-model-field="model" value="${escapeHtml(api.model)}"></label>
      ${modelOptions.length ? `<label class="compact-field">获取到的模型<select data-action="model-result"><option value="">选择模型</option>${modelOptions.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('')}</select></label>` : ''}
      <label class="compact-field">结构化输出<select data-model-field="structuredOutput"><option value="auto" ${api.structuredOutput === 'auto' ? 'selected' : ''}>自动</option><option value="force" ${api.structuredOutput === 'force' ? 'selected' : ''}>强制 JSON Schema</option><option value="off" ${api.structuredOutput === 'off' ? 'selected' : ''}>关闭</option></select></label>
      <div class="panel-actions"><button data-action="models-fetch">通过当前连接获取模型</button></div>
      <label class="compact-field">绑定 API<select data-binding-field="apiPresetId"><option value="">继承上层</option>${apiPresetOptions(library, binding.apiPresetId || '')}</select></label>
      <label class="compact-field">模块模型覆盖<input data-binding-field="model" value="${escapeHtml(binding.model || '')}" placeholder="留空继承 API 模型"></label>
      <label class="compact-field">System 绑定<select data-binding-field="systemPresetId">${systemPresetOptions(library, binding.systemPresetId || '')}</select></label>
      <div class="panel-actions"><button class="primary" data-action="binding-save">保存当前作用域绑定</button></div>
      <div class="resolution-box"><strong>实际请求解析</strong><pre>${escapeHtml(safeJson(state.resolvedModelConfig || {}))}</pre></div>
    </section>
    <section class="panel-section"><div class="right-title"><h3>System 附加预设</h3><span>设备全局</span></div>
      <label class="compact-field">编辑预设<select data-action="system-select">${array(library.systemPresets).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === system.id ? 'selected' : ''}>${escapeHtml(item.name)}${item.source === 'builtin' ? '（内置）' : ''}</option>`).join('')}</select></label>
      <div class="panel-actions"><button data-action="system-new">新建</button><button data-action="system-copy-tavern">导入酒馆当前 System 内容</button><button class="danger-ghost" data-action="system-delete" ${system.source === 'builtin' ? 'disabled' : ''}>删除</button></div>
      <label class="compact-field">预设名称<input data-system-field="name" value="${escapeHtml(system.name || '')}"></label>
      <label class="config-stack">每轮附加到 system 的内容<textarea class="system-editor-compact" data-system-field="content">${escapeHtml(system.content || '')}</textarea></label>
      <div class="panel-actions"><button class="primary" data-action="system-save">保存并继续使用</button></div>
    </section>
  </div>`;
}

function settingsViewHtml(runtime) {
  return `<section class="content-view settings-view original-settings-view">
    <div class="content-toolbar"><div><span class="eyebrow">设备级配置</span><h2>模型连接与 Agent 预设</h2><p>与原版相同：从酒馆连接预设引用 URL、密钥和 Settings Preset；Riki 只保存 profile ID 与模型选择。</p></div><div class="toolbar-actions"><button data-action="settings-refresh">重新读取酒馆连接预设</button></div></div>
    ${configPanelHtml(runtime)}
  </section>`;
}

function preferencesPanelHtml(runtime) {
  const state = runtime.state;
  const conversation = activeConversation(runtime);
  const entries = Object.entries(conversation?.preferences || {});
  const editing = text(state.ui.preferenceOriginalKey);
  return `<div class="right-panel-content"><div class="right-title"><h3>当前分支偏好</h3><span>${entries.length} 项 · 不与其他分支共享</span></div><div class="scope-strip"><div><strong>设备全局</strong><small>API、模型、System 预设</small></div><div><strong>项目共享</strong><small>已确认总纲、大章、小章与人物</small></div><div><strong>分支独立</strong><small>消息、偏好、上下文与草稿</small></div></div><p class="muted">模型提取的新偏好默认只是推测，不会直接成为强约束；用户手动新增默认立即确认。</p><div class="preference-list">${entries.length ? entries.map(([key, value]) => { const meta = conversation.preferenceMeta?.[key] || {}; return `<div class="preference-row ${editing === key ? 'editing' : ''}"><div><strong>${escapeHtml(key)}</strong><small>${escapeHtml(typeof value === 'string' ? value : safeJson(value))}</small><span>${meta.status === 'confirmed' ? '用户已确认' : '模型推测'} · ${escapeHtml(meta.source === 'user' ? '用户手动' : meta.source || '模型提取')}</span></div><div>${meta.status !== 'confirmed' ? `<button data-action="preference-confirm" data-key="${escapeHtml(key)}">确认</button>` : ''}<button data-action="preference-edit" data-key="${escapeHtml(key)}">编辑</button><button data-action="preference-delete" data-key="${escapeHtml(key)}" class="danger-ghost">删除</button></div></div>`; }).join('') : '<div class="empty-mini">当前分支还没有保存任何剧情偏好。</div>'}</div>${entries.length ? '<div class="card-actions"><button data-action="preference-confirm-all">全部确认</button><button data-action="preference-clear" class="danger-ghost">清空本分支偏好</button></div>' : ''}<section class="panel-section"><div class="right-title"><h3>${editing ? '编辑偏好' : '手动新增偏好'}</h3><span>${editing ? `原名称：${escapeHtml(editing)}` : '默认标记为用户确认'}</span></div><div class="preference-form"><input data-field="preference-key" value="${escapeHtml(state.ui.preferenceKey || '')}" placeholder="偏好名称，例如：结局倾向"><textarea data-field="preference-value" placeholder="偏好值，例如：开放式结局，保留两条 IF 路线">${escapeHtml(state.ui.preferenceValue || '')}</textarea><label class="preference-status">约束状态<select data-field="preference-status"><option value="inferred" ${state.ui.preferenceStatus === 'inferred' ? 'selected' : ''}>模型推测 · 仅供核对</option><option value="confirmed" ${state.ui.preferenceStatus !== 'inferred' ? 'selected' : ''}>用户确认 · 作为强约束</option></select></label><button class="primary" data-action="preference-save">${editing ? '保存修改' : '新增并确认'}</button></div></section><section class="panel-section"><div class="right-title"><h3>创建讨论分支</h3><span>名称自动递增</span></div><div class="panel-actions"><button data-action="conversation-new">新建空白分支</button><button class="primary" data-action="conversation-copy" data-conversation-id="${escapeHtml(conversation?.id)}">复制偏好到新分支</button></div></section></div>`;
}

function agentPanelHtml(runtime) {
  const conversation = activeConversation(runtime);
  const modules = ['main', 'outline', 'act', 'chapter', 'character', 'format_guard'];
  const logs = array(runtime.state.project?.requestLogs).filter(item => item.conversationId === conversation?.id);
  const latest = logs.at(-1);
  const lazyCanStart = conversation?.strategyMode === 'lazy' && array(conversation.messages).some(message => message.role === 'user') && array(conversation.messages).some(message => message.role === 'assistant' && message.status === 'complete' && message.request?.task !== 'lazy_intro');
  const routeSource = latest?.pass === 'controller_route' ? '主控模型判断目标模块' : '代码阶段标签选择';
  const executionLabel = runtime.state.generation?.active ? `${RIKI_PLANNING_MODULES[runtime.state.generation.moduleId]?.label || 'Agent'} · 生成中` : latest ? `${RIKI_PLANNING_MODULES[latest.module]?.label || latest.module} · ${latest.pass || 'chat'}` : '等待用户发送任务';
  const validationLabel = conversation?.pendingProposal ? '结构有效，等待用户逐项确认' : latest?.status === 'error' ? '最近请求失败，未进入确认门' : latest ? '协议与模块成果检查完成' : '尚未执行';
  const gateLabel = conversation?.pendingProposal ? `${artifactLabel(conversation.pendingProposal.kind)}候选等待确认` : '当前没有待确认候选';
  const stages = [
    ['主 Agent 路由', `${routeSource} ${RIKI_PLANNING_MODULES[conversation?.module]?.label || '主控 Agent'}`, latest ? '完成' : '就绪'],
    ['次 Agent 执行', executionLabel, runtime.state.generation?.active ? '进行中' : latest ? (latest.status === 'error' ? '失败' : '完成') : '等待'],
    ['结构校验', validationLabel, latest ? (latest.status === 'error' ? '失败' : '完成') : '等待'],
    ['用户确认门禁', gateLabel, conversation?.pendingProposal ? '进行中' : latest ? '完成' : '等待'],
  ];
  const levelOptions = moduleId => [['concise','精简'],['normal','一般'],['detailed','详细']].map(([value,label]) => `<option value="${value}" ${conversation?.detailLevels?.[moduleId] === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<div class="right-panel-content"><div class="right-title"><h3>主 Agent 调度台</h3><span>${logs.length} 次本分支请求</span></div><p class="muted">无已确认成果时按代码阶段标签路由；存在歧义时才调用主控模型。这里展示执行状态，不展示隐藏思维链。</p><button class="return-controller ${conversation?.module === 'main' ? 'active' : ''}" data-action="module-select" data-module="main">回到主控 Agent 继续讨论</button>
    <div class="agent-stage-list">${stages.map(([name,detail,status]) => `<div class="agent-stage"><i class="${status === '失败' ? 'danger-dot' : ''}"></i><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div><em>${escapeHtml(status)}</em></div>`).join('')}</div>
    ${conversation?.strategyMode ? `<section class="panel-section"><div class="right-title"><h3>总体策略模式</h3><span>新建对话时锁定</span></div><div class="strategy-summary"><strong>${escapeHtml(({detailed:'常规版',brief:'粗略版（兼容）',lazy:'懒人版'})[conversation.strategyMode] || conversation.strategyMode)}</strong><small>${conversation.strategyMode === 'lazy' ? '首轮由总纲 Agent 自动发起讨论；确认方向后连续生成、格式转换与保存。' : '首轮由总纲 Agent 自动发起讨论；每阶段正文确认后才格式转换并保存。'}</small></div><label class="compact-field">总纲详细度<select data-action="detail-level" data-module="outline">${levelOptions('outline')}</select></label><label class="compact-field">大章详细度<select data-action="detail-level" data-module="act">${levelOptions('act')}</select></label><label class="compact-field">小章详细度<select data-action="detail-level" data-module="chapter">${levelOptions('chapter')}</select></label>${conversation.strategyMode === 'lazy' && !lazyCanStart ? '<p class="muted">总纲 Agent 回复后，自动生成按钮会直接出现在该条回复下面。</p>' : ''}</section>` : '<p class="muted">请先回到中间工作区选择本对话的策划方式。</p>'}
    <section class="panel-section"><div class="right-title"><h3>次 Agent 阵列</h3><span>${logs.length} 次请求</span></div><div class="agent-console-list">${modules.filter(id => id !== 'main').map(id => { const module = RIKI_PLANNING_MODULES[id]; let resolved = {}; try { resolved = rikiResolveModuleConfig(runtime.state.project.config, id, runtime.state.modelLibrary); } catch (_) {} const status = runtime.state.generation?.active && runtime.state.generation.moduleId === id ? '生成中' : conversation?.module === id ? '当前执行' : id === 'format_guard' ? '按需调用' : '待命'; return `<button data-action="module-select" data-module="${id}" class="${conversation?.module === id ? 'active' : ''}"><span>${module.icon}</span><div><strong>${escapeHtml(module.label)}<em>${escapeHtml(status)}</em></strong><small>${escapeHtml(resolved.apiPreset?.name || '未配置')} · ${escapeHtml(resolved.model || '模型由连接决定')}</small><small>${resolved.systemPreset?.name ? escapeHtml(resolved.systemPreset.name) : '继承 System 预设'}</small></div></button>`; }).join('')}</div></section>
    <section class="panel-section"><div class="right-title"><h3>最近调度轨迹</h3><span>不展示思维链</span></div>${logs.length ? logs.slice(-4).reverse().map(log => `<div class="trace-row"><strong>${escapeHtml(RIKI_PLANNING_MODULES[log.module]?.label || log.module || '请求')} · ${escapeHtml(log.pass || 'chat')}</strong><small>${escapeHtml(log.status || '')} · ${escapeHtml(log.model || '')} · ${escapeHtml(text(log.startedAt).slice(11,19))}</small></div>`).join('') : '<div class="empty-mini">当前分支还没有请求。</div>'}</section>
  </div>`;
}

function logsPanelHtml(runtime) {
  const logs = array(runtime.state.project?.requestLogs);
  const latest = logs.at(-1);
  const conversation = activeConversation(runtime);
  const ownLogs = logs.filter(item => item.conversationId === conversation?.id);
  return `<div class="right-panel-content"><div class="right-title"><h3>请求日志</h3><span>最近 ${logs.length} 条</span></div><p class="muted">每轮记录实际模型输入、输出、路由、耗时和错误，并深层移除 API Key 与授权信息。当前分支与全部日志的清理范围彼此独立。</p>${latest ? `<div class="latest-log"><strong>${escapeHtml(RIKI_PLANNING_MODULES[latest.module]?.label || latest.module || '请求')}</strong><small>${escapeHtml(latest.status || '')} · ${escapeHtml(latest.model || '')}</small></div>` : '<div class="empty-mini">还没有请求日志</div>'}<div class="panel-actions"><button class="primary" data-action="view" data-view="logs">查看完整日志与诊断</button><button data-action="logs-export-all" ${logs.length ? '' : 'disabled'}>导出全部 JSON</button><button data-action="logs-export-conversation" ${ownLogs.length ? '' : 'disabled'}>导出当前对话</button><button class="danger-ghost" data-action="logs-clear-conversation" ${ownLogs.length ? '' : 'disabled'}>清空当前对话日志</button><button class="danger-ghost" data-action="logs-clear-all" ${logs.length ? '' : 'disabled'}>清空全部日志</button></div></div>`;
}

function versionsPanelHtml(runtime) {
  const project = runtime.state.project;
  const releases = [
    { version: runtime.version, level: '功能复刻', title: '原版连接链、完整右栏与消息视觉复原', changes: ['酒馆连接预设引用 URL、Key 和 Settings Preset；模型可获取、手填、选择并持久化。', '恢复七标签、各 Agent System 预设、调度状态、偏好编辑、四种日志视图与范围清理。', 'LLM 输出改为原版头像消息流，支持安全 Markdown、流式光标、错误卡与请求详情。', '世界书讨论使用当前 Riki 模型配置，修改仍需载入编辑器、Diff、确认写入与回读。'] },
    { version: '1.2.0', level: '结构对齐', title: '三栏工作台与原版功能迁移', changes: ['恢复成果、上下文、配置、偏好、Agent、日志、版本七标签。', '保留总纲、大章、小章、人物成果，明确剔除数据库、推进预设与二创。'] },
    { version: '1.1.0', level: '第一版', title: '独立剧情工作台底座', changes: ['世界书库存、受控修改、Agent 讨论、成果版本链与项目迁移。', '电脑与手机共用版本加载器。'] },
  ];
  return `<div class="right-panel-content"><div class="right-title"><h3>版本更新明细</h3><span>当前 v${escapeHtml(runtime.version)}</span></div><p class="muted">加载器只需要修改一次版本号；设备 API 与 Agent 预设会继续沿用。</p><div class="release-list">${releases.map(release => `<article><header><strong>v${escapeHtml(release.version)} · ${escapeHtml(release.title)}</strong><em>${escapeHtml(release.level)}</em></header>${release.changes.map(change => `<p>• ${escapeHtml(change)}</p>`).join('')}</article>`).join('')}</div><dl class="config-summary"><dt>产品</dt><dd>Riki剧情助手</dd><dt>脚本 ID</dt><dd>d1e7f665-988c-4c72-8ff1-ccbc51aba5d3</dd><dt>当前阶段</dt><dd>${escapeHtml(stageLabel(rikiPlanningStage(project)))}</dd><dt>保存方式</dt><dd>版本化成果 + 受控世界书写入</dd></dl><div class="boundary-box"><strong>本版明确不包含</strong><ul><li>SP·数据库内核、固定表和动态表</li><li>推进预设与数据库运行期</li><li>灵感二创、生图与素材库</li><li>记忆引擎与 MVU 模板迁移</li></ul></div><div class="panel-actions"><button data-action="refresh">刷新当前数据</button><button data-action="view" data-view="artifacts">查看成果版本链</button><button data-action="project-export">导出项目</button></div></div>`;
}

function exportPreviewHtml(runtime) {
  const preview = runtime.state.ui.exportPreview;
  if (!preview) return '';
  const content = typeof preview.payload === 'string' ? preview.payload : safeJson(preview.payload);
  return `<div class="export-backdrop"><section class="export-preview" role="dialog" aria-modal="true" aria-label="导出预览"><header><div><span class="eyebrow">导出预览</span><h2>${escapeHtml(preview.title || '确认导出')}</h2><small>${escapeHtml(preview.filename || '')} · ${content.length.toLocaleString('zh-CN')} 字符</small></div><button data-action="export-preview-cancel" aria-label="关闭">×</button></header><pre>${escapeHtml(content)}</pre><footer><button data-action="export-preview-cancel">取消</button><button data-action="export-preview-copy">复制内容</button><button class="primary" data-action="export-preview-confirm">确认导出</button></footer></section></div>`;
}

function rightRailHtml(runtime) {
  const state = runtime.state;
  const tabs = [['artifacts', '成果'], ['context', '上下文'], ['config', '配置'], ['preferences', '偏好'], ['agent', 'Agent'], ['logs', '日志'], ['versions', '版本']];
  const body = state.ui.rightTab === 'artifacts' ? progressPanelHtml(runtime)
    : state.ui.rightTab === 'config' ? configPanelHtml(runtime)
      : state.ui.rightTab === 'preferences' ? preferencesPanelHtml(runtime)
        : state.ui.rightTab === 'agent' ? agentPanelHtml(runtime)
          : state.ui.rightTab === 'logs' ? logsPanelHtml(runtime)
            : state.ui.rightTab === 'versions' ? versionsPanelHtml(runtime) : contextPanelHtml(runtime);
  return `<aside class="right-rail pane pane-right" data-mobile-pane="right"><nav class="right-tabs">${tabs.map(([id, label]) => `<button data-action="right-tab" data-tab="${id}" class="${state.ui.rightTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>${body}</aside>`;
}

function mainContentHtml(runtime) {
  const view = runtime.state.ui.view;
  const returnButton = '<button class="return-chat" data-action="view" data-view="chat">← 返回 Agent 对话</button>';
  if (view === 'artifacts') return `<div class="secondary-view">${returnButton}${artifactsViewHtml(runtime)}</div>`;
  if (view === 'worldbook') return `<div class="secondary-view">${returnButton}${worldbookViewHtml(runtime)}</div>`;
  if (view === 'settings') return `<div class="secondary-view">${returnButton}${settingsViewHtml(runtime)}</div>`;
  if (view === 'logs') return `<div class="secondary-view">${returnButton}${logsViewHtml(runtime)}</div>`;
  return chatViewHtml(runtime);
}

function mobileNavHtml() { return ''; }

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
    .messages { flex:1; min-height:0; overflow:auto; padding:18px clamp(12px,4vw,64px); scroll-behavior:auto; }
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

    /* 1.2：恢复 Riki剧情助手 2.2 的真实信息架构。 */
    .overlay { padding:0; place-items:stretch; background:#080a10; backdrop-filter:none; }
    .shell { --bg:#0b0d13;--surface:#11141d;--surface2:#171a23;--line:rgba(255,255,255,.075);--muted:#898e9c;--accent:#957cff;width:100vw;height:100dvh;min-height:0;grid-template-rows:64px minmax(0,1fr);border:0;border-radius:0;background:radial-gradient(circle at 55% -15%,rgba(143,110,255,.08),transparent 35%),#090b11;box-shadow:none;position:relative;}
    .app-header { min-height:64px;padding:0 18px;gap:12px;background:rgba(9,11,17,.95);border-bottom:1px solid var(--line);backdrop-filter:blur(18px);z-index:20; }
    .brand-mark { width:38px;height:38px;border-radius:13px;background:linear-gradient(145deg,#a68aff,#7453e5);font-size:19px;box-shadow:0 10px 28px rgba(129,91,238,.28); }
    .brand h1 { font-size:15px;letter-spacing:.01em; }.brand p { margin-top:2px;font-size:9px;color:#777d8b; }
    .stage-pill { display:flex;align-items:center;gap:7px;min-height:34px;padding:0 12px;border:1px solid rgba(157,140,255,.24);border-radius:999px;background:rgba(157,140,255,.07);font-size:10px;color:#d7d0ff; }
    .stage-pill i { width:7px;height:7px;border-radius:50%;background:#63d4b6;box-shadow:0 0 0 4px rgba(99,212,182,.08); }
    .header-actions button { width:38px;min-height:38px;border:0;background:transparent;border-radius:10px;color:#c4c8d1;font-size:21px; }
    .mobile-menu-button,.mobile-settings-button { display:none; }
    .workspace { grid-template-columns:260px minmax(0,1fr) 330px;background:#090b11; }
    .pane { background:#0b0e15; }.left-rail { border-right:1px solid var(--line);overflow:auto; }.right-rail { border-left:1px solid var(--line); }
    .rail-section { padding:14px 10px;border-bottom:0; }.rail-title { padding:3px 4px 10px;margin:0;font-size:10px;color:#8d91a0; }.rail-title .tiny { border:0;background:transparent;font-size:20px;color:#c8cbd3; }
    .branch-list { gap:8px; }.branch-row { grid-template-columns:minmax(0,1fr) 30px 30px;padding:5px;border-radius:13px;background:#12151d;border-color:rgba(255,255,255,.06); }.branch-row.active { border-color:rgba(157,140,255,.22);background:linear-gradient(145deg,rgba(157,140,255,.10),rgba(255,255,255,.025)); }
    .branch-main { padding:8px 6px; }.branch-main strong { font-size:12px; }.branch-main small { color:#727887;font-size:9px; }.branch-more { align-self:center;color:#a6aab4; }
    .rail-help { margin:10px;padding:12px;border:1px solid rgba(255,255,255,.055);border-radius:12px;background:rgba(255,255,255,.018);color:#767c8a;font-size:9px;line-height:1.65; }
    .main-pane { background:#090b11; }.chat-view { position:relative; }.messages { padding:28px clamp(18px,5vw,86px) 22px; }
    .empty-state { color:#858a98; }.strategy-welcome { min-height:100%;padding-bottom:30px; }.strategy-welcome .empty-glyph { width:64px;height:64px;border-radius:19px;background:linear-gradient(145deg,#a58aff,#7453e5);font-size:27px;box-shadow:0 18px 50px rgba(122,86,231,.25); }.strategy-welcome h3 { margin:22px 0 8px;color:#f2f2f5;font-size:31px;line-height:1.2; }.strategy-welcome p { max-width:620px;margin:0 0 26px;color:#7f8491;font-size:13px;line-height:1.8; }
    .strategy-cards { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(620px,100%); }.strategy-cards button { min-height:96px;padding:16px;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:#10131a;color:#ececf1; }.strategy-cards strong,.strategy-cards small { display:block; }.strategy-cards strong { font-size:13px; }.strategy-cards small { margin-top:8px;color:#878c99;font-size:10px;line-height:1.6; }
    .quick-prompts button { min-height:44px;border-color:rgba(255,255,255,.08);border-radius:12px;background:#11141b;color:#d9dbe2; }
    .composer { position:relative;padding:14px clamp(12px,5vw,50px) max(10px,env(safe-area-inset-bottom));background:#090b11;border-top:1px solid var(--line); }.compose-box { position:relative; }.composer textarea { min-height:62px;max-height:180px;padding:18px 66px 18px 16px;border-color:rgba(255,255,255,.09);border-radius:15px;background:#141821;color:#edf0f6;font-size:13px; }.composer textarea:disabled { color:#686e7a; }
    .send-button { position:absolute;right:8px;bottom:8px;width:48px;height:48px;min-height:48px;border:0;border-radius:13px;font-size:18px; }.composer-meta { display:flex;justify-content:space-between;gap:10px;margin:7px 2px 0;color:#777d89;font-size:8px; }.formal-button { min-height:36px;padding:6px 11px;border:1px solid rgba(125,155,255,.34);border-radius:9px;background:rgba(87,111,210,.16);color:#dfe6ff;font-size:10px; }
    .stage-confirmation{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px;padding:10px 11px;border:1px solid rgba(112,139,236,.22);border-radius:12px;background:rgba(47,62,116,.14)}.message-followup{margin-top:12px}.stage-confirmation strong,.stage-confirmation small{display:block}.stage-confirmation strong{font-size:11px}.stage-confirmation small{margin-top:3px;color:#8f98ab;font-size:9px}.stage-confirmation>div:last-child{display:flex;gap:7px;flex:0 0 auto}.stage-confirmation button{min-height:36px;padding:6px 10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.035);font-size:10px}
    .message { border-color:rgba(255,255,255,.065);background:#11141c; }.message-user { background:rgba(114,86,190,.14); }
    .right-tabs { display:flex;grid-template-columns:none;gap:0;padding:8px 7px 6px;overflow-x:auto;scrollbar-width:none;background:#0b0e15; }.right-tabs::-webkit-scrollbar{display:none}.right-tabs button { flex:0 0 auto;min-width:45px;padding:0 7px;color:#c3c5cc;font-size:11px; }.right-tabs button.active { color:#fff;background:rgba(147,116,246,.16);box-shadow:inset 0 0 0 1px rgba(157,140,255,.12); }
    .right-panel-content { flex:1;padding:13px 10px 24px; }.right-title { text-transform:none;letter-spacing:0;color:#b8bbc5; }.right-title h3 { margin:0;font-size:12px; }.right-title span { color:#777d89;font-size:9px; }.panel-section { margin-top:14px;padding-top:14px;border-top:1px solid var(--line); }.panel-actions { display:flex;gap:6px;flex-wrap:wrap;margin:10px 0; }.panel-actions button,.panel-section>button,.right-title button { min-height:34px;padding:5px 9px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.035);font-size:10px; }
    .compact-field { display:grid;grid-template-columns:1fr minmax(110px,1.2fr);align-items:center;gap:8px;margin:8px 0;color:#9da2af;font-size:10px; }.compact-field select,.compact-field input { width:100%;min-width:0;min-height:34px;border:1px solid var(--line);border-radius:8px;background:#11141c;color:#e7e8ed;padding:4px 7px; }.config-stack{display:grid;gap:6px;color:#9da2af;font-size:10px}.system-editor-compact{width:100%;min-height:180px;resize:vertical;border:1px solid var(--line);border-radius:9px;background:#0c1018;color:#e7e8ed;padding:8px;font:9px/1.5 ui-monospace,monospace}.profile-ref{display:grid;gap:4px;margin:8px 0;padding:9px;border:1px solid rgba(157,140,255,.18);border-radius:9px;background:#11141b}.profile-ref strong{font-size:10px}.profile-ref small,.profile-ref em{color:#858b99;font-size:8px;overflow-wrap:anywhere}.profile-ref em{font-style:normal;color:#aaa1d8}
    .progress-list button { background:#11141c;border-color:rgba(255,255,255,.055); }.agent-console-list { display:grid;gap:6px; }.agent-console-list button { display:grid;grid-template-columns:28px 1fr;gap:8px;text-align:left;padding:8px;border:1px solid rgba(255,255,255,.05);border-radius:10px;background:#11141b; }.agent-console-list button.active { border-color:rgba(157,140,255,.3);background:rgba(139,106,242,.09); }.agent-console-list strong,.agent-console-list small { display:block; }.agent-console-list small { margin-top:3px;color:#797f8c;font-size:9px;line-height:1.4; }.latest-log { padding:10px;border:1px solid var(--line);border-radius:10px;background:#11141b; }.latest-log strong,.latest-log small { display:block; }.latest-log small { margin-top:4px;color:var(--muted);font-size:9px; }
    .notice { position:absolute;top:64px;left:260px;right:330px;z-index:15;border:0;border-bottom:1px solid var(--line);pointer-events:none; }
    .secondary-view { height:100%;min-height:0;display:flex;flex-direction:column;position:relative; }.secondary-view>.content-view { flex:1;height:auto; }.return-chat { flex:0 0 auto;align-self:flex-start;margin:8px 10px 0;min-height:32px;padding:4px 9px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.035);font-size:10px; }
    .mobile-nav { display:none!important; }

    @media (max-width:820px) {
      .shell { grid-template-rows:calc(56px + env(safe-area-inset-top)) minmax(0,1fr); }
      .app-header { min-height:56px;padding:max(7px,env(safe-area-inset-top)) 8px 7px;gap:7px; }
      .mobile-menu-button,.mobile-settings-button { display:grid;place-items:center;width:36px;height:36px;min-height:36px;padding:0;border:0;border-radius:9px;background:transparent;color:#d2d4db;font-size:18px; }
      .brand-mark { width:34px;height:34px;border-radius:11px;font-size:16px; }.brand { gap:7px; }.brand h1 { font-size:13px; }.brand p { display:block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px; }
      .stage-pill { display:none; }.header-actions button { width:36px;min-height:36px;font-size:20px; }
      .workspace { display:block;position:relative;min-height:0; }.pane,.main-pane { position:absolute;inset:0;display:none; }.workspace[data-mobile-pane="left"] .pane-left,.workspace[data-mobile-pane="main"] .main-pane,.workspace[data-mobile-pane="right"] .pane-right { display:flex; }
      .left-rail,.right-rail { width:100%;border:0;background:#0b0e15; }.left-rail { flex-direction:column;overflow:auto; }.right-rail { flex-direction:column; }.main-pane { background:#090b11; }
      .strategy-welcome { justify-content:start;place-content:start center;padding:40px 18px 20px; }.strategy-welcome .empty-glyph { width:54px;height:54px;border-radius:17px; }.strategy-welcome h3 { margin-top:18px;font-size:24px; }.strategy-welcome p { margin-bottom:20px;font-size:11px;line-height:1.75; }
      .strategy-cards { grid-template-columns:1fr;gap:9px; }.strategy-cards button { min-height:78px;padding:13px; }.strategy-cards small { margin-top:5px; }
      .messages { padding:18px 10px 14px; }.message { padding:11px; }.message-actions { opacity:.9; }
      .composer { padding:9px 9px max(8px,env(safe-area-inset-bottom)); }.composer textarea { min-height:64px;padding:14px 58px 14px 13px;font-size:12px; }.send-button { width:44px;height:44px;min-height:44px; }.composer-meta { font-size:7px; }.composer-meta span:first-child { max-width:48%; }.composer-meta span:last-child { max-width:48%;text-align:right; }.stage-confirmation{align-items:stretch;flex-direction:column}.stage-confirmation>div:last-child{display:grid;grid-template-columns:1fr}.stage-confirmation button{min-height:44px}
      .right-tabs { padding-top:7px; }.right-tabs button { min-width:50px;min-height:38px; }.right-panel-content { padding-bottom:max(22px,env(safe-area-inset-bottom)); }
      .notice { top:calc(56px + env(safe-area-inset-top));left:0;right:0; }
      .artifact-layout,.worldbook-grid,.settings-grid,.logs-layout { display:block;overflow:auto; }.content-toolbar { padding:10px; }.content-toolbar p { display:none; }.toolbar-actions button:not(:first-child) { display:none; }
    }

    /* 1.3：按原版 2.2.0 的消息流、配置密度与 LLM 输出层级复原。 */
    .overlay { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif; }
    .workspace { grid-template-columns:260px minmax(0,1fr) 340px; }
    .messages { padding:30px clamp(18px,4vw,56px) 26px; }
    .turn { display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;max-width:820px;margin:0 auto 24px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none; }
    .turn.message-user { max-width:820px;margin-left:auto;background:transparent; }
    .message-avatar { display:grid;place-items:center;width:32px;height:32px;border-radius:11px;background:linear-gradient(145deg,#2b3240,#1b202b);color:#eef0f5;font-size:10px;font-weight:800;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035); }
    .message-assistant .message-avatar { color:#fff;background:linear-gradient(145deg,#a58aff,#705bd6);box-shadow:0 8px 20px rgba(112,91,214,.2); }
    .turn.is-error .message-avatar { color:#ffd1d6;background:rgba(255,126,138,.2); }
    .message-main { min-width:0; }
    .turn header { min-height:28px;margin:0;display:flex;align-items:center;gap:8px;color:#8c94a6;font-size:10px; }
    .turn header strong { color:#eef0f5;font-size:11px; }
    .turn header time { margin-left:auto;color:#737a89;font-size:8px; }
    .module-badge { padding:3px 7px;border-radius:999px;background:rgba(105,213,191,.1);color:#a9eadc;font-size:8px; }
    .message-content { margin-top:5px;color:#e5e8ef;font-size:14px;line-height:1.72;overflow-wrap:anywhere;white-space:normal; }
    .message-content p { margin:.35em 0; }.message-content p:first-child { margin-top:0; }.message-content p:last-child { margin-bottom:0; }
    .message-content h2,.message-content h3,.message-content h4 { margin:1.2em 0 .5em;color:#f3f3f7;line-height:1.28;letter-spacing:-.01em; }.message-content h2{font-size:1.42em}.message-content h3{font-size:1.25em}.message-content h4{font-size:1.1em}
    .message-content ul,.message-content ol { margin:.65em 0;padding-left:1.45em; }.message-content li { margin:.28em 0; }
    .message-content blockquote { margin:.85em 0;padding:.45em .9em;border-left:3px solid #9d8cff;border-radius:0 8px 8px 0;background:rgba(157,140,255,.055);color:#c9cbd5; }
    .message-content code { padding:2px 5px;border-radius:5px;background:rgba(255,255,255,.075);color:#dcd6ff;font:12px/1.5 ui-monospace,"Cascadia Code",monospace; }
    .message-content pre { max-width:100%;margin:.85em 0;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#07090d;overflow:auto; }.message-content pre code { padding:0;background:transparent;color:#d8dbe5; }
    .paragraph-gap { display:block;height:.55em; }
    .stream-placeholder { color:#858b99; }.stream-caret { display:inline-block;width:6px;height:1em;margin-left:3px;background:#9d8cff;vertical-align:-2px;animation:riki-stream-blink .8s steps(1) infinite; }
    @keyframes riki-stream-blink { 50% { opacity:.18; } }
    .message-actions { display:flex;gap:4px;margin-top:8px;opacity:.42;transition:opacity .18s; }.turn:hover .message-actions { opacity:1; }
    .message-actions button { min-height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:#858c9b;font-size:9px; }.message-actions button:hover { color:#eef0f5;background:rgba(255,255,255,.055); }
    .message-request { margin-top:10px;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:rgba(255,255,255,.018); }.message-request summary { padding:9px 11px;color:#7f8694;font-size:9px;cursor:pointer; }.message-request pre { max-height:260px;margin:0;padding:11px;border:0;border-top:1px solid rgba(255,255,255,.065);background:transparent;color:#aeb4c2;white-space:pre-wrap;overflow:auto;font:9px/1.55 ui-monospace,monospace; }.message-log-group{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.055)}.message-log-group b{display:flex;align-items:center;gap:5px;color:#aeb6c7;font-size:9px}.message-log-group>div{display:flex;gap:4px;flex-wrap:wrap}.message-log-group button{min-height:30px;padding:4px 7px;border:1px solid rgba(255,255,255,.07);border-radius:7px;background:transparent;color:#8e96a8;font-size:8px}.message-log-group button.active{border-color:rgba(124,151,255,.35);background:rgba(82,106,196,.18);color:#eef1ff}
    .message-error { display:grid;gap:5px;margin-top:10px;padding:11px 13px;border:1px solid rgba(255,126,138,.27);border-radius:11px;background:rgba(255,126,138,.075);color:#ffd2d7; }.message-error strong{font-size:11px}.message-error small{color:#d8a9af;font-size:10px;line-height:1.5}
    .content-confirmation{display:grid;gap:6px;margin-top:11px;padding:11px 13px;border:1px solid rgba(246,201,104,.25);border-radius:11px;background:rgba(246,201,104,.06)}.content-confirmation strong{color:#f5d78d;font-size:11px}.content-confirmation small{color:#a99a78;font-size:9px;line-height:1.5}.content-confirmation>div{display:flex;gap:6px;flex-wrap:wrap}.content-confirmation button{min-height:34px;padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.04);font-size:9px}
    .composer { padding:12px clamp(12px,4vw,54px) max(12px,env(safe-area-inset-bottom)); }.compose-box { display:flex;align-items:flex-end;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:#151922;box-shadow:0 16px 40px rgba(0,0,0,.18); }.composer textarea { min-height:44px;max-height:150px;padding:10px 58px 10px 8px;border:0;border-radius:10px;background:transparent;font-size:14px;line-height:1.55; }.send-button { right:8px;bottom:8px;width:44px;height:44px;min-height:44px; }
    .proposal-card { max-width:820px;border-color:rgba(157,140,255,.28);background:linear-gradient(145deg,rgba(157,140,255,.085),rgba(105,213,191,.02)); }
    .config-panel-original { padding:14px; }.config-panel-original>.muted { display:block;margin:0 0 13px;padding:10px 11px;border-radius:10px;background:rgba(255,255,255,.025);line-height:1.55; }
    .config-panel-original .panel-section { padding-top:17px; }.config-panel-original .compact-field { grid-template-columns:1fr;gap:6px;margin:10px 0;color:#8f96a5;font-size:9px; }.config-panel-original .compact-field input,.config-panel-original .compact-field select { min-height:42px;padding:8px 10px;border-radius:10px;background:#0c0f16;color:#eceef4;font-size:11px; }.config-panel-original .panel-actions button { min-height:38px;padding-inline:12px; }
    .profile-ref { padding:11px;border-radius:11px;background:linear-gradient(145deg,rgba(157,140,255,.07),rgba(255,255,255,.018)); }.profile-ref strong{font-size:11px}.profile-ref small,.profile-ref em{font-size:9px;line-height:1.45}
    .system-editor-compact { min-height:220px;padding:11px;font-size:10px;line-height:1.6; }
    .original-settings-view>.right-panel-content { width:min(900px,100%);margin:0 auto; }.original-settings-view { overflow:auto; }
    .agent-stage-list { display:grid;gap:7px;margin-top:10px;padding:9px;border:1px solid rgba(157,140,255,.16);border-radius:13px;background:rgba(157,140,255,.04); }.agent-stage { display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.055);border-radius:10px;background:#11141b; }.agent-stage i{width:7px;height:7px;border-radius:50%;background:#69d5bf;box-shadow:0 0 0 4px rgba(105,213,191,.08)}.agent-stage i.danger-dot{background:#ff7e8a;box-shadow:0 0 0 4px rgba(255,126,138,.08)}.agent-stage strong,.agent-stage small{display:block}.agent-stage strong{font-size:10px}.agent-stage small{margin-top:3px;color:#7d8391;font-size:8px;line-height:1.35}.agent-stage em{color:#8f96a5;font-size:8px;font-style:normal}
    .return-controller { width:100%;min-height:36px;margin:4px 0 9px;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:#11141b;color:#aeb3c0;font-size:10px; }.return-controller.active { border-color:rgba(105,213,191,.2);background:rgba(105,213,191,.07);color:#b5eee2; }
    .strategy-summary { padding:10px;border:1px solid rgba(105,213,191,.16);border-radius:10px;background:rgba(105,213,191,.04); }.strategy-summary strong,.strategy-summary small{display:block}.strategy-summary strong{color:#a9eadc;font-size:10px}.strategy-summary small{margin-top:5px;color:#8b919f;font-size:9px;line-height:1.5}
    .scope-strip { display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0; }.scope-strip>div { padding:8px;border:1px solid rgba(255,255,255,.055);border-radius:9px;background:#11141b; }.scope-strip strong,.scope-strip small{display:block}.scope-strip strong{font-size:9px}.scope-strip small{margin-top:4px;color:#777d8b;font-size:7px;line-height:1.35}.preference-row.editing{border-color:rgba(157,140,255,.3);background:rgba(157,140,255,.055)}.preference-status{display:grid;gap:5px;color:#8f96a5;font-size:9px}.preference-status select{min-height:38px;border:1px solid var(--line);border-radius:8px;background:#0c0f16;color:#eceef4;padding:6px 8px}
    .agent-console-list button strong { display:flex;align-items:center;gap:6px; }.agent-console-list button strong em { margin-left:auto;color:#69d5bf;font-size:8px;font-style:normal;font-weight:500; }.agent-console-list button small+small { color:#706f85; }
    .trace-row { padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.055); }.trace-row strong,.trace-row small{display:block}.trace-row strong{font-size:9px}.trace-row small{margin-top:4px;color:#777d8b;font-size:8px}
    .release-list{display:grid;gap:8px;margin:10px 0 16px}.release-list article{padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:#11141b}.release-list header{display:flex;gap:7px;align-items:flex-start}.release-list header strong{font-size:10px;line-height:1.4}.release-list header em{margin-left:auto;padding:2px 5px;border-radius:999px;background:rgba(157,140,255,.1);color:#d7d0ff;font-size:7px;font-style:normal;white-space:nowrap}.release-list p{margin:7px 0 0;color:#858b99;font-size:8px;line-height:1.5}
    .diagnostic-tabs { flex-wrap:wrap;margin-bottom:9px; }.diagnostic-tabs button { min-height:34px;padding:5px 10px;color:#979eae;font-size:10px; }.diagnostic-tabs button.active { color:#fff;background:rgba(157,140,255,.16); }
    .log-detail pre { color:#cbd0db;font-size:10px;line-height:1.55; }
    .worldbook-ai { display:grid;grid-template-columns:minmax(180px,.7fr) minmax(260px,1.4fr) auto;gap:9px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:rgba(157,140,255,.025); }.worldbook-ai p{margin:4px 0 0;color:#858b99;font-size:9px;line-height:1.45}.worldbook-ai textarea{min-height:58px;max-height:120px;resize:vertical;border:1px solid var(--line);border-radius:9px;background:#0c0f16;color:#edf0f6;padding:8px;font-size:10px;line-height:1.5}.worldbook-ai>button{min-height:40px;border:1px solid var(--line);border-radius:9px;padding:6px 10px}.suggestion-card{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(105,213,191,.2);border-radius:10px;background:rgba(105,213,191,.055)}.suggestion-card strong,.suggestion-card small{display:block}.suggestion-card strong{font-size:10px}.suggestion-card small{color:#8c94a6;font-size:9px}.suggestion-card>div{display:flex;gap:6px}.suggestion-card button{min-height:32px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.04);font-size:9px}
    .export-backdrop{position:absolute;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:rgba(2,4,8,.82)}.export-preview{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(980px,96%);max-height:90%;overflow:hidden;border:1px solid rgba(157,140,255,.25);border-radius:16px;background:#10141e;box-shadow:0 28px 90px rgba(0,0,0,.55)}.export-preview>header,.export-preview>footer{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}.export-preview>header h2{margin:2px 0;font-size:15px}.export-preview>header small{color:#858b99;font-size:9px}.export-preview>header button{margin-left:auto;width:38px;min-height:38px;border:0;border-radius:9px;background:transparent;color:#ddd;font-size:20px}.export-preview>pre{min-height:240px;margin:0;padding:14px;overflow:auto;background:#080b11;color:#cbd0db;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.55 ui-monospace,monospace}.export-preview>footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0}.export-preview>footer button{min-height:38px;padding:6px 12px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.04);font-size:10px}

    @media (max-width:820px) {
      .workspace { grid-template-columns:1fr; }.turn { grid-template-columns:32px minmax(0,1fr);gap:10px;margin-bottom:21px; }.message-content{font-size:13px}.message-request pre{max-height:220px}.config-panel-original{padding:12px 10px max(24px,env(safe-area-inset-bottom))}.composer textarea{font-size:13px}.toolbar-actions{max-width:100%;overflow:auto;flex-wrap:nowrap}.toolbar-actions button{flex:0 0 auto!important;display:inline-flex!important}.scope-strip{grid-template-columns:1fr}.worldbook-ai{grid-template-columns:1fr;padding:10px}.suggestion-card{grid-template-columns:1fr}.suggestion-card>div{flex-wrap:wrap}.export-backdrop{padding:0}.export-preview{width:100%;max-height:100%;height:100%;border:0;border-radius:0}.export-preview>pre{min-height:0}
    }
    @media (max-width:360px) { .brand-mark { display:none; }.brand p { max-width:126px; }.strategy-welcome h3 { font-size:21px; } }
    @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important;transition:none!important;animation:none!important; } }
  `;
}

function scrollScope(state) {
  return `${state.ui?.view || 'chat'}:${state.ui?.rightTab || 'artifacts'}:${state.ui?.mobilePane || 'main'}`;
}

function clearStreamingUpdate(runtime) {
  const update = runtime.streamingUiUpdate;
  if (!update) return;
  const host = runtime.hostWindow || globalThis;
  if (update.timer) (host.clearTimeout || clearTimeout)(update.timer);
  if (update.raf) (host.cancelAnimationFrame || clearTimeout)(update.raf);
  runtime.streamingUiUpdate = null;
}

function scrollTargets(runtime, scope) {
  const root = runtime.shadow;
  if (!root) return [];
  const selectors = [
    '.left-rail', '.right-rail', '.main-pane', '.content-view',
    '.right-panel-content', '.original-settings-view', '.settings-grid',
    '.artifact-layout', '.artifact-kinds', '.artifact-versions', '.artifact-detail',
    '.worldbook-grid', '.book-column .scroll-list', '.entry-column .scroll-list', '.entry-editor',
    '.logs-layout', '.log-list', '.log-detail', '.secondary-view',
  ];
  return selectors.flatMap(selector => [...root.querySelectorAll(selector)].map((node, index) => ({ key: `${scope}:${selector}:${index}`, node })));
}

function captureScrollPositions(runtime, state) {
  runtime.uiScrollPositions ||= new Map();
  const scope = runtime.renderedUiScope || scrollScope(state);
  for (const { key, node } of scrollTargets(runtime, scope)) runtime.uiScrollPositions.set(key, { top: node.scrollTop, left: node.scrollLeft });
}

function restoreScrollPositions(runtime, state) {
  const positions = runtime.uiScrollPositions;
  if (!positions) return;
  const scope = scrollScope(state);
  for (const { key, node } of scrollTargets(runtime, scope)) {
    const position = positions.get(key);
    if (!position) continue;
    node.scrollTop = position.top;
    node.scrollLeft = position.left;
  }
}

export function rikiRenderWorkbench(runtime, options = {}) {
  const state = runtime.state;
  if (!runtime.shadow) return;
  if (!state.ui) return;
  const active = runtime.shadow.activeElement;
  const focusKey = active?.dataset?.field || active?.dataset?.modelField || active?.dataset?.systemField || active?.dataset?.bindingField || '';
  const selection = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
  const messagesScroll = runtime.shadow.querySelector('#riki-messages')?.scrollTop;
  captureScrollPositions(runtime, state);
  clearStreamingUpdate(runtime);
  const conversation = activeConversation(runtime);
  const stage = rikiPlanningStage(state.project);
  const module = RIKI_PLANNING_MODULES[conversation?.module] || RIKI_PLANNING_MODULES.main;
  runtime.shadow.innerHTML = `<style>${rikiWorkbenchStyle()}</style><div class="overlay"><section class="shell" role="dialog" aria-modal="true" aria-label="Riki剧情助手${escapeHtml(runtime.version)}"><header class="app-header"><button class="mobile-menu-button" data-action="mobile-pane" data-pane="left" title="对话列表" aria-label="对话列表">☰</button><div class="brand"><div class="brand-mark">✦</div><div><h1>Riki剧情助手</h1><p>${escapeHtml(runtime.identity?.character || '当前角色')} · v${escapeHtml(runtime.version)} · 故事策划</p></div></div><div class="header-spacer"></div><div class="stage-pill"><i></i>${escapeHtml(module.label)} · ${escapeHtml(stageLabel(stage))}</div><button class="mobile-settings-button" data-action="mobile-pane" data-pane="right" title="设置" aria-label="设置">⚙</button><div class="header-actions"><button data-action="close" title="关闭工作台" aria-label="关闭">×</button></div></header>${noticeHtml(state)}<div class="workspace" data-mobile-pane="${escapeHtml(state.ui.mobilePane || 'main')}">${leftRailHtml(runtime)}<main class="main-pane pane" data-mobile-pane="main">${mainContentHtml(runtime)}</main>${rightRailHtml(runtime)}</div>${mobileNavHtml(state)}${exportPreviewHtml(runtime)}</section></div>`;
  runtime.renderedUiScope = scrollScope(state);
  if (focusKey) {
    const selector = `[data-field="${CSS.escape(focusKey)}"],[data-model-field="${CSS.escape(focusKey)}"],[data-system-field="${CSS.escape(focusKey)}"],[data-binding-field="${CSS.escape(focusKey)}"]`;
    const next = runtime.shadow.querySelector(selector);
    try { next?.focus?.({ preventScroll: true }); } catch (_) { next?.focus?.(); }
    if (selection && typeof next?.setSelectionRange === 'function') {
      try { next.setSelectionRange(selection[0], selection[1]); } catch (_) {}
    }
  }
  restoreScrollPositions(runtime, state);
  if (options.scrollMessagesToEnd) {
    const messages = runtime.shadow.querySelector('#riki-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  } else if (Number.isFinite(messagesScroll)) {
    const messages = runtime.shadow.querySelector('#riki-messages');
    if (messages) messages.scrollTop = messagesScroll;
  }
}

export function rikiUpdateStreamingMessage(runtime, messageId, content) {
  const host = runtime.hostWindow || globalThis;
  const update = runtime.streamingUiUpdate ||= { pending: null, timer: null, raf: null, last: new Map() };
  update.pending = { messageId: text(messageId), content: text(content) };
  if (update.timer || update.raf) return;
  const flush = () => {
    update.raf = null;
    const pending = update.pending;
    update.pending = null;
    if (!pending) return;
    const messages = runtime.shadow?.querySelector('#riki-messages');
    const followTail = Boolean(messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 180);
    const node = runtime.shadow?.querySelector(`[data-message-id="${CSS.escape(pending.messageId)}"] .message-content`);
    if (node && update.last.get(pending.messageId) !== pending.content) {
      node.innerHTML = `${markdownHtml(pending.content)}<span class="stream-caret" aria-hidden="true"></span>`;
      update.last.set(pending.messageId, pending.content);
    }
    if (followTail && messages) messages.scrollTop = messages.scrollHeight;
  };
  const queueFrame = () => {
    update.timer = null;
    const fallbackTimer = host.setTimeout?.bind(host) || globalThis.setTimeout;
    const raf = host.requestAnimationFrame?.bind(host) || (callback => fallbackTimer(callback, 16));
    update.raf = raf(flush);
  };
  const setTimer = host.setTimeout?.bind(host) || setTimeout;
  update.timer = setTimer(queueFrame, 40);
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
  launcher.textContent = 'Riki';
  launcher.title = '打开 Riki 剧情工作台';
  launcher.setAttribute('aria-label', '打开 Riki 剧情工作台');
  launcher.style.cssText = 'position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(84px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147481000;display:grid;place-items:center;min-width:68px;height:44px;padding:0 15px;border-radius:15px;border:1px solid rgba(150,132,255,.55);color:#fff;font:800 13px system-ui;background:linear-gradient(145deg,#8e75f0,#6547d6);box-shadow:0 12px 36px rgba(61,43,146,.48);cursor:pointer;touch-action:manipulation;';
  launcher.addEventListener('click', () => runtime.open());
  document.body.appendChild(launcher);
  runtime.disposers.push(() => launcher.remove());
  rikiRenderWorkbench(runtime);
  runtime.state.mounted = true;
  return root;
}
