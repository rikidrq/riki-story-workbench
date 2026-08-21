import assert from 'node:assert/strict';
import {
  RIKI_PLANNING_MODULES,
  RIKI_ARTIFACT_KINDS,
  rikiPlanningRoute,
  rikiPlanningStage,
  rikiModeContract,
  rikiModulePresetPrompt,
  rikiModuleSystemPrompt,
  rikiBuildPlanningMessages,
  rikiParseArtifactEnvelope,
  rikiBuildFormatGuardMessages,
} from '../src/riki-planning.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const emptyArtifacts = () => Object.fromEntries(RIKI_ARTIFACT_KINDS.map(kind => [kind, { currentVersionId: null, versions: [] }]));
const project = { artifacts: emptyArtifacts() };
const conversation = { module: 'main', workflowMode: 'detailed', detailLevels: { outline: 'detailed' }, preferences: { tone: '克制' }, messages: [] };

await test('module list contains all first-version planning agents', () => {
  assert.deepEqual(Object.keys(RIKI_PLANNING_MODULES), ['main', 'outline', 'act', 'chapter', 'character', 'format_guard']);
  assert.equal(JSON.stringify(RIKI_PLANNING_MODULES).includes('database'), false);
  assert.equal(JSON.stringify(RIKI_PLANNING_MODULES).includes('progression_preset'), false);
});

await test('router selects explicit and keyword modules without database fallback', () => {
  assert.equal(rikiPlanningRoute(project, conversation, '请生成人物人设').moduleId, 'character');
  assert.equal(rikiPlanningRoute(project, conversation, '随便聊聊', 'chapter').moduleId, 'chapter');
  assert.equal(rikiPlanningRoute(project, conversation, '请生成数据库').moduleId, 'main');
});

await test('stage advances only through confirmed current artifact chain', () => {
  assert.equal(rikiPlanningStage(project), 'discovery');
  project.artifacts.outline.versions.push({ versionId: 'o1', status: 'confirmed' });
  project.artifacts.outline.currentVersionId = 'o1';
  assert.equal(rikiPlanningStage(project), 'acts');
  project.artifacts.acts.versions.push({ versionId: 'a1', status: 'confirmed' });
  project.artifacts.acts.currentVersionId = 'a1';
  assert.equal(rikiPlanningStage(project), 'chapters');
});

await test('three workflow contracts remain distinct', () => {
  assert.match(rikiModeContract('detailed', 'outline', {}), /常规版/);
  assert.match(rikiModeContract('rough', 'character', {}), /粗略版/);
  assert.match(rikiModeContract('lazy', 'chapter', {}), /懒人版/);
});

await test('system prompts prohibit removed engines and expose artifact contract', () => {
  const prompt = rikiModuleSystemPrompt('outline', { mode: 'detailed', detailLevels: {} });
  assert.match(prompt, /<riki_artifact>/);
  assert.match(prompt, /不进入数据库、推进预设/);
  assert.match(prompt, /故事发动机/);
  assert.doesNotMatch(prompt, /database_design|database_review|灵感二创 Agent/u);
  assert.match(rikiModuleSystemPrompt('act'), /actGoals/);
  assert.match(rikiModuleSystemPrompt('chapter'), /requiredGoals/);
  assert.match(rikiModuleSystemPrompt('character'), /privacyProfile/);
  assert.match(rikiModuleSystemPrompt('format_guard'), /source_draft 是不可变事实源/);
});

await test('planning messages contain selected context, preferences and one user turn', () => {
  const messages = rikiBuildPlanningMessages({ project, conversation, moduleId: 'outline', userText: '生成总纲', worldbookContext: '<selected_worldbook_context>雾港</selected_worldbook_context>' });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[1].content, /雾港/);
  assert.match(messages[1].content, /克制/);
  assert.deepEqual(messages.at(-1), { role: 'user', content: '生成总纲' });
});

await test('default builtin preset is not duplicated while a custom preset remains an additive system layer', () => {
  const builtin = rikiModulePresetPrompt('outline');
  const builtinMessages = rikiBuildPlanningMessages({ project, conversation, moduleId: 'outline', userText: '讨论', systemContent: builtin });
  assert.equal(builtinMessages.filter(message => message.role === 'system' && message.content.includes('当前模块：总纲 Agent')).length, 1);
  const customMessages = rikiBuildPlanningMessages({ project, conversation, moduleId: 'outline', userText: '讨论', systemContent: '自定义：保持冷峻悬疑。' });
  assert.equal(customMessages[0].content, '自定义：保持冷峻悬疑。');
  assert.match(customMessages[1].content, /不可变协议/);
});

await test('artifact parser separates visible text and validates expected kind', () => {
  const parsed = rikiParseArtifactEnvelope('已生成。\n<riki_artifact>{"kind":"outline","summary":"总纲","content":{"title":"雾港"}}</riki_artifact>', 'outline');
  assert.equal(parsed.visibleText, '已生成。');
  assert.equal(parsed.artifact.kind, 'outline');
  assert.equal(parsed.artifact.content.title, '雾港');
  const wrong = rikiParseArtifactEnvelope('<riki_artifact>{"kind":"acts","content":{"acts":[]}}</riki_artifact>', 'outline');
  assert.equal(wrong.artifact, null);
  assert.equal(wrong.errors.length, 1);
});

await test('format guard receives source draft and target schema', () => {
  const messages = rikiBuildFormatGuardMessages({ targetModuleId: 'outline', sourceDraft: '草稿正文', project, conversation });
  assert.equal(messages.length, 2);
  assert.match(messages[1].content, /<source_draft>\n草稿正文/);
  assert.match(messages[1].content, /<target_kind>outline/);
});

console.log(`${passed} planning tests passed.`);
