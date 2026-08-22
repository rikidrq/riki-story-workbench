import { start, rikiCreateMockAdapter } from '/releases/1.3.2/riki-workbench.js?preview=1.3.2-ui-flow';

const adapter = rikiCreateMockAdapter({
  character: '林间旅人',
  chatId: 'preview-story',
  streamResponseParts: 12,
  streamChunkDelayMs: 6,
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
  generateResponse(config) {
    const prompts = Array.isArray(config?.ordered_prompts) ? config.ordered_prompts : [];
    const joined = prompts.map(item => typeof item === 'string' ? item : item?.content || '').join('\n');
    const envelope = (kind, summary, content) => `已完成${summary}，请检查后确认。\n<riki_artifact>${JSON.stringify({ kind, summary, changeLevel: 'major', mergeMode: 'replace', content })}</riki_artifact>`;
    if (prompts.some(item => item?.role === 'system' && /Riki 剧情工作台中的剧情讨论助手/u.test(item?.content || ''))) return `这个改动会让蓝焰异常更早成为可追查线索，同时保持玩家决定调查顺序。\n<riki_worldbook_patch>${JSON.stringify({ bookName: '当前剧情书', entryUid: 1, reason: '补充可观察线索但不替玩家决定行动', changes: { content: '主角刚抵达雾港，正在寻找失踪的领航员；港口蓝焰在无风时短暂偏白，但无人承认见过。' } })}</riki_worldbook_patch>`;
    if (/Markdown 标题、列表和引用/u.test(joined)) return `## 三个可继续讨论的剧情方向

> 先选故事发动机，不急着保存正式成果。

- **记忆悬疑**：港务记录与所有人的私人记忆互相冲突。
- **政治抉择**：公开蓝焰真相会让整个港口失去贸易命脉。
- **关系困局**：失踪领航员主动隐瞒了主角最信任的人。

你更想优先体验哪一种冲突？`;
    if (/当前仍在方向讨论阶段/u.test(joined)) return `## 当前方向还需要你确认

我先不生成正式成果，继续把会改变后续设计的分歧说清楚：

- 你更希望主线由**调查真相**还是**保护雾港**驱动？
- 失踪领航员更适合作为主动隐瞒者，还是被迫离开的关键证人？
- 结局更偏向公开真相、维持秩序，还是保留两条由玩家选择的 IF 路线？

你可以继续回答，也可以在方向稳定后点击确认按钮进入详细设计。`;
    if (/人物 Agent|人物策划|<target_kind>characters|"kind"\s*:\s*"characters"/u.test(joined)) return envelope('characters', '人物候选', { phase: 'detailed', characters: [{ characterId: 'CHAR-001', name: '失踪的领航员', tier: '中档', identity: '雾港领航员', appearanceAnchors: ['蓝焰灼痕'], personalityBehaviors: ['在危险前先检查同伴退路'], goals: ['查清旧灯塔记录被篡改的原因'], motivation: '保护港口航线', bottomLine: '不牺牲无辜者', knowledgeBoundary: '知道蓝焰异常但不知道幕后主使', relationships: [], secrets: ['曾在失踪前私下进入旧灯塔'] }] });
    if (/小章 Agent|小章策划|<target_kind>chapters|"kind"\s*:\s*"chapters"/u.test(joined)) return envelope('chapters', '小章候选', { chapters: [{ chapterId: 'CH-001', actId: 'ACT-001', title: '港务记录的空白', timeRange: '抵达当晚', goals: { required: ['确认领航员未值班'], normal: ['询问港务员'], optional: ['检查蓝焰残留'] }, characters: [{ characterId: 'CHAR-001', purpose: '通过缺席留下矛盾线索' }], events: ['值班记录与目击证词冲突'], knowledgeBoundary: '玩家只知道记录异常', endState: '线索指向旧灯塔', nextHook: '蓝焰在无人处重新亮起' }] });
    if (/大章 Agent|大章策划|<target_kind>acts|"kind"\s*:\s*"acts"/u.test(joined)) return envelope('acts', '大章候选', { acts: [{ actId: 'ACT-001', title: '雾港失踪案', goal: '找到失踪领航员', conflict: '港务记录与私人证词互相矛盾', routes: ['追查港务记录', '调查旧灯塔'], requiredEvents: ['确认领航员当晚未值班'], outcome: '发现蓝焰导航系统被人为改动', nextHook: '线索指向港外禁航区' }] });
    if (/总纲 Agent|总纲策划|outline|总纲/u.test(joined)) return envelope('outline', '总纲候选', { title: '雾港蓝焰', premise: '旅人追查领航员失踪，发现港口导航系统掩盖着旧日交易', genre: ['悬疑', '奇幻'], themes: ['真相与共同体'], mainConflict: '公开记录与人物记忆持续冲突', fullOutline: '主角抵达雾港后从矛盾记录开始调查，逐步进入旧灯塔与禁航区，最终决定公开真相还是保护港口秩序。', foreshadowing: [{ id: 'F-001', setup: '蓝焰颜色异常', payoffWindow: '第二大章' }], endings: [{ id: 'E-001', condition: '公开全部记录', outcome: '港口秩序重建但贸易受损' }], playerFreedom: '调查顺序与最终选择由玩家决定' });
    return '可以把旧灯塔设计成一条“公开线索与私人记忆相互矛盾”的调查线。先让主角从港务记录发现领航员并未值班，再通过蓝焰的异常颜色把冲突引向灯塔内部。';
  },
});

await start({ hostWindow: window, adapter, autoOpen: true });
