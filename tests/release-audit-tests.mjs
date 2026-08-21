import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const runtimeFiles = ['riki-workbench.js', 'riki-project-core.js', 'riki-model-config.js', 'riki-planning.js', 'riki-ui.js'];
const source = runtimeFiles.map(file => read(`src/${file}`)).join('\n');
const release = runtimeFiles.map(file => read(`dist/releases/1.1.0/${file}`)).join('\n');

const bannedRuntimeSymbols = [
  /database_design/iu, /database_review/iu, /AutoCardUpdater/iu, /RIKI_EC_/u,
  /rikiEc[A-Z]/u, /erchuang[-_]/iu, /Zhihuiji/iu, /compileDatabase/iu,
  /installRikiProject/iu, /runDatabase/iu, /FIXED_TABLES/u,
];
for (const pattern of bannedRuntimeSymbols) {
  assert.equal(pattern.test(source), false, `removed engine leaked into src: ${pattern}`);
  assert.equal(pattern.test(release), false, `removed engine leaked into 1.1 release: ${pattern}`);
}

const literalSecretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/u,
  /\bhf_[A-Za-z0-9]{12,}\b/u,
  /\bAIza[0-9A-Za-z_-]{20,}\b/u,
  /Authorization\s*:\s*['"]Bearer\s+[A-Za-z0-9_-]{8,}/iu,
];
for (const pattern of literalSecretPatterns) assert.equal(pattern.test(release), false, `literal credential shape in release: ${pattern}`);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '1.1.0');
const report = JSON.parse(read('dist/build-report.json'));
assert.equal(report.version, '1.1.0');
assert.equal(report.boundaries.cardJson, false);
assert.equal(report.boundaries.cardPng, false);
for (const artifact of report.artifacts) {
  const bytes = fs.readFileSync(path.join(root, artifact.path));
  assert.equal(sha256(bytes), artifact.sha256, artifact.path);
}

const loader = JSON.parse(read('dist/酒馆助手脚本-Riki剧情工作台-版本加载器.json'));
assert.equal((loader.content.match(/const RIKI_VERSION\s*=/g) || []).length, 1);
assert.match(loader.content, /const RIKI_VERSION = '1\.1\.0'/u);
assert.match(loader.content, /@v\$\{RIKI_VERSION\}\/dist\/releases\/\$\{RIKI_VERSION\}/u);
assert.equal(loader.content.includes('@main'), false);

const tagCommit = execFileSync('git', ['rev-list', '-n', '1', 'v1.0.0'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(tagCommit, 'e1b4bd21e1d12f06fa8c086425057a5faa9352cf');
const oldReleaseFromTag = execFileSync('git', ['show', 'v1.0.0:dist/releases/1.0.0/riki-workbench.js'], { cwd: root });
const oldReleaseWorking = fs.readFileSync(path.join(root, 'dist/releases/1.0.0/riki-workbench.js'));
assert.equal(sha256(oldReleaseWorking), sha256(oldReleaseFromTag), 'published 1.0.0 release bytes changed');

const roadmap = read('docs/roadmap/ROADMAP-300.md');
for (const version of ['2.0', '2.5', '3.0', '4.0']) {
  const match = roadmap.match(new RegExp(`## ${version.replace('.', '\\.')}(?:.|\\r|\\n)*?(?=\\n## |$)`, 'u'));
  assert.ok(match, `missing roadmap ${version}`);
  assert.equal(match[0].replace(/\s/gu, '').length >= 300, true, `roadmap ${version} is shorter than 300 non-whitespace characters`);
}

console.log('Release audit passed: removed engines absent, secrets absent, hashes exact, v1.0.0 unchanged, roadmap summaries complete.');
