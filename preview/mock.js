import { start, rikiCreateMockAdapter } from '/releases/1.0.0/riki-workbench.js';

const adapter = rikiCreateMockAdapter({
  character: '林间旅人',
  chatId: 'preview-story',
  bindings: { character: ['雾港设定集'], chat: '当前剧情书', global: ['写作规则'] },
  books: {
    '当前剧情书': [
      { uid: 1, name: '当前剧情方向', enabled: true, strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' }, position: { type: 'at_depth', role: 'system', depth: 2, order: 900 }, probability: 100, content: '主角刚抵达雾港，正在寻找失踪的领航员。' },
    ],
    '雾港设定集': [
      { uid: 11, name: '雾港', enabled: true, strategy: { type: 'selective', keys: ['雾港', '港口'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' }, position: { type: 'after_character_definition', role: 'system', depth: 4, order: 200 }, probability: 100, content: '一座终年被潮雾笼罩的贸易港，灯塔使用蓝焰导航。' },
      { uid: 12, name: '失踪的领航员', enabled: true, strategy: { type: 'selective', keys: ['领航员', '失踪'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' }, position: { type: 'at_depth', role: 'system', depth: 3, order: 300 }, probability: 100, content: '领航员在三日前失踪，最后一次被看见是在旧灯塔附近。' },
    ],
    '写作规则': [
      { uid: 21, name: '玩家主动权', enabled: true, strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' }, position: { type: 'before_character_definition', role: 'system', depth: 4, order: 1000 }, probability: 100, content: '不要替玩家决定关键行动。' },
    ],
  },
  generateResponse: '可以把旧灯塔设计成一条“公开线索与私人记忆相互矛盾”的调查线。先让主角从港务记录发现领航员并未值班，再通过蓝焰的异常颜色把冲突引向灯塔内部。',
});

await start({ hostWindow: window, adapter, autoOpen: true });
