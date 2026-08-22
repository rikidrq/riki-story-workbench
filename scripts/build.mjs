import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sourceFiles = [
  'riki-workbench.js',
  'riki-project-core.js',
  'riki-model-config.js',
  'riki-planning.js',
  'riki-ui.js',
];
const sourcePath = path.join(root, 'src', sourceFiles[0]);
const dist = path.join(root, 'dist');
const releaseDirectory = path.join(dist, 'releases', pkg.version);
const bundlePath = path.join(releaseDirectory, 'riki-workbench.js');
const remoteLoaderPath = path.join(dist, '酒馆助手脚本-Riki剧情工作台-版本加载器.json');
const localLoaderPath = path.join(dist, '酒馆助手脚本-Riki剧情工作台-本地开发加载器.json');
const importableDirectory = path.join(dist, 'importable');
const importableLoaderPath = path.join(importableDirectory, 'riki-version-loader.script.json');
const componentManifestPath = path.join(importableDirectory, 'component-update-manifest.json');
const stableScriptId = 'd1e7f665-988c-4c72-8ff1-ccbc51aba5d3';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeLf(value) {
  return String(value).replace(/\r\n?/g, '\n');
}

function loaderSource(releaseBase) {
  return `// Riki 剧情工作台版本加载器\n// 发布地址已经固定，日常更新只改下一行。\nconst RIKI_VERSION = '${pkg.version}';\nconst RIKI_RELEASE_BASE = '${releaseBase}';\n\n(async function loadRikiStoryWorkbench() {\n  const hostWindow = (() => {\n    try { return window.parent && window.parent !== window ? window.parent : window; } catch (_) { return window; }\n  })();\n  const statusKey = '__RIKI_STORY_WORKBENCH_LOADER_STATUS__';\n  const url = RIKI_RELEASE_BASE.startsWith('http://127.0.0.1')\n    ? \`${'${RIKI_RELEASE_BASE}'}/${'${RIKI_VERSION}'}/riki-workbench.js\`\n    : \`${'${RIKI_RELEASE_BASE}'}@v${'${RIKI_VERSION}'}/dist/releases/${'${RIKI_VERSION}'}/riki-workbench.js\`;\n  hostWindow[statusKey] = { status: 'loading', version: RIKI_VERSION, url, startedAt: new Date().toISOString() };\n  try {\n    const module = await import(url);\n    if (typeof module.start !== 'function') throw new Error('远程 bundle 未导出 start()');\n    const api = await module.start({ startWindow: window, hostWindow });\n    if (api?.version !== RIKI_VERSION) throw new Error(\`版本校验失败：请求 ${'${RIKI_VERSION}'}，实际 ${'${api?.version || "unknown"}'}\`);\n    hostWindow[statusKey] = { status: 'ready', version: RIKI_VERSION, url, readyAt: new Date().toISOString() };\n  } catch (error) {\n    const message = \`Riki 剧情工作台 ${'${RIKI_VERSION}'} 加载失败：${'${error?.message || error}'}\`;\n    hostWindow[statusKey] = { status: 'failed', version: RIKI_VERSION, url, error: String(error?.message || error), failedAt: new Date().toISOString() };\n    try {\n      const toast = hostWindow.toastr || window.toastr;\n      if (typeof toast?.error === 'function') toast.error(message, 'Riki 剧情工作台');\n      else console.error(message);\n    } catch (_) { console.error(message); }\n  }\n})();\n`;
}

function helperScript(content, info) {
  return {
    type: 'script',
    enabled: true,
    name: 'Riki剧情工作台',
    id: stableScriptId,
    content,
    info,
    button: { enabled: false, buttons: [] },
    data: {},
    export_with: { data: true, button: false },
  };
}

fs.mkdirSync(dist, { recursive: true });
fs.rmSync(releaseDirectory, { recursive: true, force: true });
fs.mkdirSync(releaseDirectory, { recursive: true });
fs.mkdirSync(importableDirectory, { recursive: true });

for (const file of sourceFiles) {
  if (!fs.existsSync(path.join(root, 'src', file))) throw new Error(`缺少当前运行模块：src/${file}`);
}
const source = fs.readFileSync(sourcePath, 'utf8');
if ((source.match(/__RIKI_VERSION__/g) || []).length !== 1) {
  throw new Error('源码必须且只能包含一个 __RIKI_VERSION__ 构建标记');
}
const releaseModules = sourceFiles.map(file => {
  const raw = normalizeLf(fs.readFileSync(path.join(root, 'src', file), 'utf8'));
  const content = file === 'riki-workbench.js'
    ? raw.replace('__RIKI_VERSION__', pkg.version)
    : raw;
  const generated = `/* Riki Story Workbench ${pkg.version} | generated from src/${file} */\n${content.trimEnd()}\n`;
  const target = path.join(releaseDirectory, file);
  fs.writeFileSync(target, generated, 'utf8');
  return { file, target, content: generated };
});
const bundle = releaseModules[0].content;

const remoteBase = 'https://gcore.jsdelivr.net/gh/rikidrq/riki-story-workbench';
const localBase = 'http://127.0.0.1:8178/releases';
const remoteLoader = helperScript(
  loaderSource(remoteBase),
  `Riki 剧情工作台正式版本加载器。发布地址已固定；以后更新只改 RIKI_VERSION。当前构建 ${pkg.version}。`,
);
const localLoader = helperScript(
  loaderSource(localBase),
  `Riki 剧情工作台本地开发加载器。先运行 npm run preview，再导入本文件。以后更新只改 RIKI_VERSION。当前构建 ${pkg.version}。`,
);
const remoteLoaderContent = `${JSON.stringify(remoteLoader, null, 2)}\n`;
const localLoaderContent = `${JSON.stringify(localLoader, null, 2)}\n`;
fs.writeFileSync(remoteLoaderPath, remoteLoaderContent, 'utf8');
fs.writeFileSync(localLoaderPath, localLoaderContent, 'utf8');

const componentSpec = {
  schemaVersion: 1,
  deliveryMode: 'component',
  kind: 'helper-script',
  items: [{ artifactName: 'riki-version-loader', value: remoteLoader }],
};
fs.writeFileSync(path.join(dist, 'component-update-spec.json'), `${JSON.stringify(componentSpec, null, 2)}\n`, 'utf8');

const importableContent = remoteLoaderContent;
fs.writeFileSync(importableLoaderPath, importableContent, 'utf8');
fs.writeFileSync(componentManifestPath, `${JSON.stringify({
  schemaVersion: 1,
  deliveryMode: 'component',
  kind: 'helper-script',
  artifacts: [{
    artifactName: 'riki-version-loader',
    id: stableScriptId,
    kind: 'helper-script',
    relativePath: 'riki-version-loader.script.json',
    sha256: sha256(importableContent),
  }],
}, null, 2)}\n`, 'utf8');

const report = {
  schemaVersion: 1,
  project: pkg.name,
  version: pkg.version,
  deliveryMode: 'component',
  stableScriptId,
  artifacts: [
    ...releaseModules.map(module => ({ path: path.relative(root, module.target).replaceAll('\\', '/'), sha256: sha256(module.content) })),
    { path: path.relative(root, remoteLoaderPath).replaceAll('\\', '/'), sha256: sha256(remoteLoaderContent) },
    { path: path.relative(root, localLoaderPath).replaceAll('\\', '/'), sha256: sha256(localLoaderContent) },
    { path: path.relative(root, importableLoaderPath).replaceAll('\\', '/'), sha256: sha256(importableContent) },
  ],
  boundaries: { cardJson: false, cardPng: false, installed: false, published: false },
};
fs.writeFileSync(path.join(dist, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Built ${path.relative(root, bundlePath)}`);
console.log(`Built ${path.relative(root, remoteLoaderPath)}`);
console.log(`Built ${path.relative(root, localLoaderPath)}`);
