import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalRoot = path.resolve(root, '..', 'story-studio-database', 'src', 'v0.5');
const port = Number(process.env.RIKI_ORIGINAL_AUDIT_PORT || 8179);
const sourceParts = [
  'core.js', 'api.js', 'tables.js', 'presets.js', 'erchuang-data.js',
  'erchuang-inspiration.js', 'erchuang.js', 'agents.js', 'integration.js',
  'ui.js', 'float.js', 'erchuang-ub-css.js', 'erchuang-ui.js', 'main.js',
];

const hostScript = String.raw`
  window.__rikiAudit = { calls: [], downloads: [], events: new Map() };
  const audit = (type, detail = {}) => window.__rikiAudit.calls.push({ type, detail, at: Date.now() });
  const books = {
    '角色设定': [
      { uid: 1, name: '世界规则', enabled: true, content: '港口只在退潮后开放。', key: ['港口'], strategy: { type: 'constant', keys: ['港口'] }, position: { type: 'after_character_definition' } },
      { uid: 2, name: '人物关系', enabled: true, content: '领航员认识灯塔看守。', key: ['领航员'], strategy: { type: 'selective', keys: ['领航员'] }, position: { type: 'after_character_definition' } },
    ],
    '聊天设定': [{ uid: 3, name: '当前线索', enabled: true, content: '蓝焰刚刚熄灭。', key: ['蓝焰'], strategy: { type: 'constant', keys: ['蓝焰'] }, position: { type: 'after_character_definition' } }],
    '全局写作规则': [{ uid: 4, name: '写作规则', enabled: true, content: '保留玩家选择权。', key: [], strategy: { type: 'constant', keys: [] }, position: { type: 'after_character_definition' } }],
  };
  const profiles = [
    { id: 'profile-openai', name: '酒馆 OpenAI 预设', api: 'openai', mode: 'chat', 'api-url': 'https://gateway.example.test/v1', 'secret-id': 'secret-openai', preset: '剧情写作预设', model: 'story-model-a', models: [{ id: 'story-model-a' }, { id: 'story-model-b' }] },
    { id: 'profile-claude', name: '酒馆 Claude 预设', api: 'openai', mode: 'chat', 'api-url': 'https://claude.example.test/v1', 'secret-id': 'secret-claude', preset: '长篇小说预设', model: 'claude-story', models: [{ id: 'claude-story' }] },
  ];
  const chatMetadata = {};
  const extensionSettings = {
    connectionManager: { profiles },
    riki_story_assistant_global_library: null,
  };
  const ctx = {
    extensionSettings,
    chatMetadata,
    chat_metadata: chatMetadata,
    chatId: 'audit-chat',
    chat_file_name: 'audit-chat.jsonl',
    characterId: 0,
    characters: [{ name: '原版审计角色', description: '雾港的调查者。', personality: '谨慎。', scenario: '抵达雾港。', first_mes: '蓝焰尚未点燃。', data: { extensions: { world: '角色设定' } } }],
    chat: [{ is_user: false, mes: '蓝焰尚未点燃。', name: '原版审计角色' }, { is_user: true, mes: '我抵达港口。', name: 'User' }],
    name1: 'User', name2: '原版审计角色',
    powerUserSettings: { context: { preset: { prompts: [] } } },
    CONNECT_API_MAP: { openai: { selected: 'openai', source: 'custom' } },
    ConnectionManagerRequestService: {
      getSupportedProfiles: () => profiles,
      sendRequest: async function* (profileId, messages, maxTokens, stream, options) {
        audit('connection.send', { profileId, messages, maxTokens, stream, options });
        yield { text: '审计模拟回复。', done: true };
      },
    },
    saveSettingsDebounced: () => audit('settings.save'),
    saveSettings: () => audit('settings.save.immediate'),
    updateChatMetadata: patch => { Object.assign(chatMetadata, patch); audit('metadata.update', Object.keys(patch)); },
    saveMetadataDebounced: () => audit('metadata.save'),
    saveMetadata: () => audit('metadata.save.immediate'),
    saveChat: () => audit('chat.save'),
    eventSource: { on: (name, fn) => { window.__rikiAudit.events.set(name, fn); return { stop() {} }; } },
    eventTypes: { CHAT_CHANGED: 'chat_id_changed', CHAT_DELETED: 'chat_deleted' },
    getPresetManager: () => ({ getSelectedPreset: () => ({ prompts: [], prompt_order: [] }) }),
  };
  window.SillyTavern = { getContext: () => ctx };
  window.TavernHelper = {};
  window.toastr = Object.fromEntries(['success','error','warning','info'].map(type => [type, message => audit('toast.' + type, { message: String(message) })]));
  window.confirm = message => { audit('confirm', { message }); return true; };
  window.prompt = (message, value = '') => { audit('prompt', { message, value }); return value || '审计输入'; };
  window.alert = message => audit('alert', { message });
  window.getTavernVersion = () => 'audit-mock';
  window.getTavernHelperVersion = () => 'audit-mock';
  window.getContext = () => ctx;
  window.getButtonEvent = name => 'button:' + name;
  window.eventOn = (name, fn) => { window.__rikiAudit.events.set(name, fn); return { stop() {} }; };
  window.eventOnce = window.eventOn;
  window.eventEmit = async (name, ...args) => { audit('event.emit', { name, args }); window.__rikiAudit.events.get(name)?.(...args); };
  window.tavern_events = { CHAT_CHANGED: 'chat_id_changed', CHAT_DELETED: 'chat_deleted', WORLDINFO_UPDATED: 'worldinfo_updated' };
  window.getWorldbookNames = async () => Object.keys(books);
  window.getGlobalWorldbookNames = async () => ['全局写作规则'];
  window.getCharWorldbookNames = async () => ({ primary: '角色设定', additional: [] });
  window.getChatWorldbookName = async () => '聊天设定';
  window.getWorldbook = async name => structuredClone(books[name] || []);
  window.updateWorldbookWith = async (name, updater) => { books[name] = await updater(structuredClone(books[name] || [])); audit('worldbook.update', { name }); return structuredClone(books[name]); };
  window.createWorldbook = async name => { books[name] ||= []; audit('worldbook.create', { name }); };
  window.deleteWorldbook = async name => { delete books[name]; audit('worldbook.delete', { name }); };
  window.getChatMessages = () => ctx.chat.map((item, message_id) => ({ message_id, role: item.is_user ? 'user' : 'assistant', message: item.mes, mes: item.mes, is_user: item.is_user }));
  window.getCharData = () => structuredClone(ctx.characters[0]);
  window.generateRaw = async config => { audit('generateRaw', config); return '审计模拟回复。'; };
  window.stopGenerationById = id => { audit('generation.stop', { id }); return true; };
  window.initializeGlobal = (name, value) => { window[name] = value; };
  window.waitGlobalInitialized = async name => window[name];
  window.renderMarkdown = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  window.substitudeMacros = value => String(value).replaceAll('{{char}}', ctx.name2).replaceAll('{{user}}', ctx.name1);
  window.URL.createObjectURL = () => 'blob:audit';
  window.URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function() { window.__rikiAudit.downloads.push({ name: this.download, href: this.href }); audit('download', { name: this.download }); };
`;

function html() {
  const scripts = sourceParts.map(file => `<script src="/source/${file}"></script>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Riki 2.2.0 Original Audit</title></head><body><div id="extensionsMenu"></div><div id="chat"></div><textarea id="send_textarea"></textarea><script>${hostScript}</script>${scripts}</body></html>`;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `127.0.0.1:${port}`}`);
  if (url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html());
    return;
  }
  if (url.pathname.startsWith('/source/')) {
    const file = path.basename(url.pathname);
    if (!sourceParts.includes(file)) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(fs.readFileSync(path.join(originalRoot, file), 'utf8'));
    return;
  }
  if (url.pathname === '/api/backends/chat-completions/status') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ data: [{ id: 'story-model-a' }, { id: 'story-model-b' }, { id: 'story-model-c' }] }));
    return;
  }
  response.writeHead(404); response.end('not found');
});

server.listen(port, '127.0.0.1', () => console.log(`Original Riki audit host: http://127.0.0.1:${port}/`));
