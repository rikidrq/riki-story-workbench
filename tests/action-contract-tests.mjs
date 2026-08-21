import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'src', 'riki-ui.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src', 'riki-workbench.js'), 'utf8');

const renderedActions = [...ui.matchAll(/data-action=\\?"([a-z0-9-]+)\\?"/giu)].map(match => match[1]);
const handledActions = [...runtime.matchAll(/action\s*===\s*'([a-z0-9-]+)'/giu)].map(match => match[1]);
const rendered = [...new Set(renderedActions)].sort();
const handled = new Set(handledActions);
const missing = rendered.filter(action => !handled.has(action));

assert.equal(rendered.length >= 70, true, `UI action inventory unexpectedly small: ${rendered.length}`);
assert.deepEqual(missing, [], `UI renders actions without a runtime handler: ${missing.join(', ')}`);

const mustBeClickable = [
  'close', 'refresh', 'view', 'mobile-pane', 'right-tab',
  'conversation-new', 'conversation-select', 'conversation-copy', 'conversation-rename', 'conversation-delete',
  'preference-save', 'preference-edit', 'preference-confirm', 'preference-confirm-all', 'preference-delete', 'preference-clear',
  'workflow-mode', 'lazy-start', 'module-select', 'planning-send', 'generate-formal', 'generation-stop',
  'message-edit', 'message-edit-save', 'message-delete', 'message-reroll', 'message-copy',
  'content-confirm-compile', 'content-return-controller',
  'proposal-item', 'proposal-regenerate-rejected', 'proposal-confirm-all', 'proposal-edit', 'proposal-edit-save', 'proposal-reject',
  'artifact-kind', 'artifact-version', 'artifact-copy', 'artifact-edit', 'artifact-edit-save', 'artifact-delete', 'artifact-backfill-slots',
  'trash-toggle', 'trash-restore', 'trash-empty',
  'worldbook-refresh', 'book-select', 'entry-select', 'context-toggle', 'worldbook-discuss', 'worldbook-suggestion-load', 'worldbook-suggestion-reject', 'worldbook-preview', 'worldbook-apply', 'worldbook-undo',
  'project-export', 'project-import',
  'export-preview-confirm', 'export-preview-copy', 'export-preview-cancel',
  'routing-fallback', 'api-new', 'api-select', 'api-save', 'api-delete', 'models-fetch', 'model-result',
  'settings-module', 'binding-save', 'system-new', 'system-select', 'system-save', 'system-delete', 'system-copy-tavern',
  'context-filter', 'context-select', 'context-project-book-mode',
  'log-select', 'log-mode', 'logs-copy', 'logs-export', 'logs-export-all', 'logs-export-conversation', 'logs-clear-conversation', 'logs-clear-all',
];
assert.deepEqual(mustBeClickable.filter(action => !rendered.includes(action)), [], 'critical interaction disappeared from UI');

assert.match(ui, /:host\(\[hidden\]\)\s*\{\s*display:\s*none\s*!important/u);
assert.match(ui, /@media \(max-width:820px\)/u);
assert.match(ui, /@media \(max-width:390px\)/u);
assert.match(ui, /prefers-reduced-motion/u);
assert.match(ui, /min-height:44px/u);

console.log(`Action contract passed: ${rendered.length} rendered actions, 0 missing handlers.`);
