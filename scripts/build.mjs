import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sourcePath = path.join(root, 'src', 'riki-workbench.js');
const dist = path.join(root, 'dist');
const releaseDirectory = path.join(dist, 'releases', pkg.version);
const bundlePath = path.join(releaseDirectory, 'riki-workbench.js');
const remoteLoaderPath = path.join(dist, '酒馆助手脚本-Riki剧情工作台-版本加载器.json');
const localLoaderPath = path.join(dist, '酒馆助手脚本-Riki剧情工作台-本地开发加载器.json');
const importableDirectory = path.join(dist, 'importable');
const importableLoaderPath = path.join(importableDirectory, 'riki-version-loader.script.json');
const componentManifestPath = path.join(importableDirectory, 'component-update-manifest.json');
const stableScriptId = 'd1e7f665-988c-4c72-8ff1-ccbc51aba5d3';
const buttonName = '打开 Riki 剧情工作台';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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
    button: { enabled: true, buttons: [{ name: buttonName, visible: true }] },
    data: {},
    export_with: { data: true, button: true },
  };
}

fs.mkdirSync(dist, { recursive: true });
fs.rmSync(releaseDirectory, { recursive: true, force: true });
fs.mkdirSync(releaseDirectory, { recursive: true });
fs.mkdirSync(importableDirectory, { recursive: true });

const source = fs.readFileSync(sourcePath, 'utf8');
if ((source.match(/__RIKI_VERSION__/g) || []).length !== 1) {
  throw new Error('源码必须且只能包含一个 __RIKI_VERSION__ 构建标记');
}
const bundle = `/* Riki Story Workbench ${pkg.version} | generated; edit src/riki-workbench.js */\n${source.replace('__RIKI_VERSION__', pkg.version).trimEnd()}\n`;
fs.writeFileSync(bundlePath, bundle, 'utf8');

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
    { path: path.relative(root, bundlePath).replaceAll('\\', '/'), sha256: sha256(bundle) },
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
