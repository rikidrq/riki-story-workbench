const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const playwrightPath = process.env.RIKI_PLAYWRIGHT_PATH || 'playwright';
const { chromium } = require(playwrightPath);
const baseUrl = process.env.RIKI_PREVIEW_URL || 'http://127.0.0.1:8178/preview';

const app = page => page.locator('#riki-story-workbench-root');

async function openPreview(page, viewport) {
  const errors = [];
  await page.addInitScript(() => localStorage.clear());
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(dialog.defaultValue() || '自动测试分支');
    else await dialog.accept();
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('#riki-story-workbench-root')?.shadowRoot?.querySelector('.shell')));
  return app(page).evaluate((host, name) => {
    const shadow = host.shadowRoot;
    const shell = shadow.querySelector('.shell');
    const rect = shell.getBoundingClientRect();
    return {
      viewport: name,
      title: shadow.querySelector('h1')?.textContent || '',
      shell: { width: Math.round(rect.width), height: Math.round(rect.height) },
      topViews: [...shadow.querySelectorAll('[data-action="view"]')].map(node => node.dataset.view),
      modules: [...shadow.querySelectorAll('[data-action="module-select"]')].map(node => node.dataset.module),
      branches: shadow.querySelectorAll('[data-action="conversation-select"]').length,
      mobileMenuDisplay: getComputedStyle(shadow.querySelector('.mobile-menu-button')).display,
      mobileSettingsDisplay: getComputedStyle(shadow.querySelector('.mobile-settings-button')).display,
      horizontalOverflow: shell.scrollWidth > shell.clientWidth + 1,
    };
  }, viewport).then(result => ({ ...result, errors, journey: {} }));
}

async function view(page, id) {
  const root = app(page);
  let entry = root.locator(`[data-action="view"][data-view="${id}"]`).first();
  if (await entry.count() === 0) {
    const tab = ({ artifacts: 'artifacts', worldbook: 'context', settings: 'config', logs: 'logs' })[id];
    if (tab) await root.locator(`[data-action="right-tab"][data-tab="${tab}"]`).click();
    entry = root.locator(`[data-action="view"][data-view="${id}"]`).first();
  }
  await entry.click();
  await root.locator(`.${id === 'chat' ? 'chat' : id}-view`).waitFor({ state: 'visible' });
}

async function desktopJourney(page, result) {
  const root = app(page);
  await root.locator('[data-action="workflow-mode"][data-mode="detailed"]').click();
  result.journey.strategySelected = await root.locator('[data-field="composer"]').isEnabled();
  await root.locator('[data-action="conversation-new"]').click();
  result.journey.branchCreated = await root.locator('[data-action="conversation-select"]').count() >= 2;
  await root.locator('[data-action="workflow-mode"][data-mode="detailed"]').click();
  await root.locator('[data-action="right-tab"][data-tab="preferences"]').click();
  await root.locator('[data-action="conversation-copy"]').click();
  result.journey.branchCopied = await root.locator('[data-action="conversation-select"]').count() >= 3;
  await root.locator('[data-action="conversation-rename"]').last().click();
  result.journey.branchRenamed = (await root.locator('[data-action="conversation-select"]').last().innerText()).trim().length > 0;
  await root.locator('[data-action="conversation-delete"]').last().click();
  result.journey.branchDeleted = await root.locator('[data-action="conversation-select"]').count() >= 2;
  await root.locator('[data-action="right-tab"][data-tab="preferences"]').click();
  await root.locator('[data-field="preference-key"]').fill('叙事节奏');
  await root.locator('[data-field="preference-value"]').fill('铺垫—冲突—回报，避免连续灌设定。');
  await root.locator('[data-action="preference-save"]').click();
  result.journey.preferenceSaved = await root.locator('.preference-row').count() === 1;
  result.journey.preferenceConfirmed = (await root.locator('.preference-row').innerText()).includes('已确认');

  await root.locator('[data-action="right-tab"][data-tab="agent"]').click();
  for (const moduleId of ['main', 'outline', 'act', 'chapter', 'character', 'format_guard']) {
    await root.locator(`[data-action="module-select"][data-module="${moduleId}"]`).click();
    result.journey[`module_${moduleId}`] = (await root.locator(`[data-action="module-select"][data-module="${moduleId}"]`).getAttribute('class')).includes('active');
  }
  await root.locator('[data-action="module-select"][data-module="outline"]').click();

  await root.locator('[data-action="right-tab"][data-tab="config"]').click();
  result.journey.settingsVisible = await root.locator('.config-panel-original').isVisible();
  await root.locator('[data-action="api-new"]').click();
  await root.locator('[data-model-field="name"]').fill('视觉测试 API');
  await root.locator('[data-model-field="transport"]').selectOption('profile');
  await root.locator('[data-model-field="profileId"]').selectOption('mock-profile');
  await root.locator('[data-action="models-fetch"]').click();
  await root.locator('[data-action="model-result"]').selectOption('mock-model');
  await root.locator('[data-action="api-save"]').click();
  result.journey.apiSaved = await root.locator('[data-action="api-select"] option', { hasText: '视觉测试 API' }).count() === 1;
  await root.locator('[data-action="system-new"]').click();
  await root.locator('[data-system-field="name"]').fill('视觉测试 System');
  await root.locator('[data-system-field="content"]').fill('保持因果一致，输出可确认结果。');
  await root.locator('[data-action="system-save"]').click();
  result.journey.systemSaved = await root.locator('[data-action="system-select"] option', { hasText: '视觉测试 System' }).count() === 1;
  await root.locator('[data-action="settings-module"]').selectOption('outline');
  await root.locator('[data-binding-field="apiPresetId"]').selectOption({ label: '视觉测试 API' });
  await root.locator('[data-binding-field="systemPresetId"]').selectOption({ label: '视觉测试 System' });
  await root.locator('[data-action="binding-save"]').click();
  result.journey.bindingSaved = (await root.locator('.resolution-box').innerText()).includes('mock-model');
  await root.locator('[data-action="settings-module"]').selectOption('outline');
  await root.locator('[data-binding-field="apiPresetId"]').selectOption({ label: '视觉测试 API' });
  await root.locator('[data-binding-field="model"]').fill('');
  await root.locator('[data-action="binding-save"]').click();
  result.bindingReset = await root.locator('.resolution-box').innerText();
  await root.locator('[data-action="api-select"]').selectOption({ label: '视觉测试 API' });
  await page.screenshot({ path: path.join(rootPath(), 'dist', 'preview-config.png'), fullPage: true });

  await root.locator('[data-action="right-tab"][data-tab="context"]').click();
  await view(page, 'worldbook');
  await root.locator('[data-action="book-select"]').first().click();
  await root.locator('[data-action="entry-select"]').first().click();
  await root.locator('[data-action="context-toggle"]').first().click();
  await root.locator('[data-field="worldbook-discussion"]').fill('讨论这条设定，并给出一个受控世界书修改提案。');
  await root.locator('[data-action="worldbook-discuss"]').click();
  await root.locator('.suggestion-card').waitFor({ state: 'visible' });
  result.journey.worldbookModelSuggestion = true;
  await root.locator('[data-action="worldbook-suggestion-load"]').click();
  result.journey.worldbookSuggestionLoaded = (await root.locator('[data-field="wb-content"]').inputValue()).includes('蓝焰');
  await root.locator('[data-field="wb-content"]').fill('视觉测试修改：主角从港务记录发现领航员当晚并未值班。');
  await root.locator('[data-action="worldbook-preview"]').click();
  result.journey.worldbookDiff = await root.locator('.modal[aria-label="世界书 Diff"]').isVisible();
  await root.locator('[data-action="worldbook-apply"]').click();
  result.journey.worldbookApplied = (await root.locator('[data-field="wb-content"]').inputValue()).includes('视觉测试修改');
  await root.locator('[data-action="worldbook-undo"]').click();
  result.journey.worldbookUndo = !(await root.locator('[data-field="wb-content"]').inputValue()).includes('视觉测试修改');

  await view(page, 'chat');
  await root.locator('[data-action="right-tab"][data-tab="agent"]').click();
  await root.locator('[data-action="module-select"][data-module="outline"]').click();
  await root.locator('[data-action="generate-formal"]').click();
  await page.waitForFunction(() => {
    const shadow = document.querySelector('#riki-story-workbench-root')?.shadowRoot;
    return Boolean(shadow?.querySelector('.content-confirmation,.message-error'));
  });
  if (!(await root.locator('.content-confirmation').isVisible())) {
    throw new Error(`formal content pass failed: ${await root.locator('.message-assistant').last().innerText()}`);
  }
  result.journey.contentConfirmationGate = true;
  await root.locator('[data-action="content-confirm-compile"]').click();
  await page.waitForFunction(() => {
    const shadow = document.querySelector('#riki-story-workbench-root')?.shadowRoot;
    return Boolean(shadow?.querySelector('.proposal-card,.message-error'));
  });
  if (!(await root.locator('.proposal-card').isVisible())) {
    throw new Error(`formal proposal failed: ${await root.locator('.message-assistant').last().innerText()}`);
  }
  result.journey.proposalCreated = true;
  await root.locator('[data-action="proposal-confirm-all"]').click();
  await root.locator('[data-action="right-tab"][data-tab="artifacts"]').click();
  result.journey.artifactConfirmed = await root.locator('[data-action="open-artifact"][data-kind="outline"]').evaluate(node => node.classList.contains('complete'));
  await root.locator('[data-action="project-export"]').first().click();
  result.journey.projectExportPreview = await root.locator('.export-preview').isVisible();
  const projectDownloadPromise = page.waitForEvent('download');
  await root.locator('[data-action="export-preview-confirm"]').click();
  const projectDownload = await projectDownloadPromise;
  const projectDownloadPath = await projectDownload.path();
  result.journey.projectExport = Boolean(projectDownloadPath) && (await projectDownload.suggestedFilename()).endsWith('.json');

  await root.locator('[data-field="composer"]').fill('讨论蓝焰线索怎样更有因果张力？');
  await root.locator('[data-action="planning-send"]').click();
  await page.waitForFunction(() => {
    const shadow = document.querySelector('#riki-story-workbench-root')?.shadowRoot;
    const messages = [...(shadow?.querySelectorAll('.message-assistant') || [])];
    return messages.length >= 2 && !messages.at(-1).querySelector('.status-streaming');
  });
  const assistantCount = await root.locator('.message-assistant').count();
  await root.locator('[data-action="message-reroll"]').last().click();
  await page.waitForFunction(expected => {
    const shadow = document.querySelector('#riki-story-workbench-root')?.shadowRoot;
    const messages = [...(shadow?.querySelectorAll('.message-assistant') || [])];
    return messages.length >= expected && !messages.at(-1).querySelector('.status-streaming');
  }, assistantCount);
  const assistantCountAfter = await root.locator('.message-assistant').count();
  const rerolledText = await root.locator('.message-assistant').last().innerText();
  result.rerolledText = rerolledText;
  result.rerollCounts = { before: assistantCount, after: assistantCountAfter };
  result.journey.rerollWorked = assistantCountAfter >= assistantCount && !rerolledText.includes('生成失败');
  await root.locator('[data-action="message-copy"]').last().click();
  await page.waitForFunction(() => document.querySelector('#riki-story-workbench-root')?.shadowRoot?.querySelector('.notice')?.textContent?.includes('复制'));
  result.journey.messageCopy = (await root.locator('.notice').innerText()).includes('复制');
  const userMessage = root.locator('.message-user').last();
  await userMessage.locator('[data-action="message-edit"]').click();
  await root.locator('[data-field="message-edit-draft"]').fill('编辑后：蓝焰线索如何形成因果闭环？');
  await root.locator('[data-action="message-edit-save"]').click();
  result.journey.messageEdited = (await root.locator('.message-user').last().innerText()).includes('编辑后');
  await root.locator('[data-action="right-tab"][data-tab="agent"]').click();
  await root.locator('[data-action="module-select"][data-module="format_guard"]').click();
  await root.locator('[data-action="generate-formal"]').click();
  await root.locator('.proposal-card').waitFor({ state: 'visible' });
  result.journey.formatCompiler = (await root.locator('.proposal-card').innerText()).includes('候选');
  await root.locator('[data-action="proposal-reject"]').click();

  await view(page, 'artifacts');
  result.journey.artifactView = await root.locator('.artifact-detail pre').first().isVisible();
  await root.locator('[data-action="artifact-copy"]').click();
  await root.locator('[data-action="artifact-edit"]').click();
  const json = await root.locator('[data-field="artifact-edit-json"]').inputValue();
  await root.locator('[data-field="artifact-edit-json"]').fill(json.replace('雾港蓝焰', '雾港蓝焰·修订'));
  await root.locator('[data-action="artifact-edit-save"]').click();
  result.journey.artifactRevisionProposal = await root.locator('.proposal-card').isVisible();
  await root.locator('[data-action="proposal-reject"]').click();

  await view(page, 'artifacts');
  await root.locator('[data-action="artifact-delete"]').click();
  result.journey.artifactDeletedToTrash = await root.locator('[data-action="trash-restore"]').isVisible();
  await root.locator('[data-action="trash-restore"]').click();
  await root.locator('[data-action="artifact-edit"]').waitFor({ state: 'visible' });
  result.journey.artifactRestored = await root.locator('[data-action="artifact-edit"]').isVisible();

  if (projectDownloadPath) {
    await view(page, 'chat');
    const chooserPromise = page.waitForEvent('filechooser');
    await root.locator('[data-action="project-import"]').first().click();
    const chooser = await chooserPromise;
    await chooser.setFiles(projectDownloadPath);
    await page.waitForFunction(() => document.querySelector('#riki-story-workbench-root')?.shadowRoot?.querySelector('.notice')?.textContent?.includes('项目导入完成'));
    result.journey.projectImport = true;
  } else result.journey.projectImport = false;

  await root.locator('[data-action="right-tab"][data-tab="logs"]').click();
  await view(page, 'logs');
  result.logRows = await root.locator('[data-action="log-select"]').allInnerTexts();
  result.journey.logsVisible = await root.locator('[data-action="log-select"]').count() >= 1;
  await root.locator('[data-action="log-mode"][data-mode="input"]').click();
  result.journey.logInputVisible = (await root.locator('.log-detail pre').innerText()).includes('messages');
  await root.locator('[data-action="logs-export"]').click();
  result.journey.logExportPreview = await root.locator('.export-preview').isVisible();
  const logDownloadPromise = page.waitForEvent('download');
  await root.locator('[data-action="export-preview-confirm"]').click();
  const logDownload = await logDownloadPromise;
  result.journey.logExport = (await logDownload.suggestedFilename()).endsWith('.json');
  const secretLeak = await page.evaluate(() => [...Array(localStorage.length)].some((_, index) => {
    const key = localStorage.key(index) || '';
    return key.includes('riki_story_workbench_project_v11') && (localStorage.getItem(key) || '').includes('sk-visual-secret');
  }));
  result.journey.secretExcludedFromProject = !secretLeak;
  await page.screenshot({ path: path.join(rootPath(), 'dist', 'preview-desktop.png'), fullPage: true });
}

function rootPath() { return root; }

async function mobileJourney(page, result, screenshot) {
  const root = app(page);
  result.journey.mobileHeaderControls = await root.locator('.mobile-menu-button').isVisible() && await root.locator('.mobile-settings-button').isVisible();
  await root.locator('[data-action="mobile-pane"][data-pane="left"]').tap();
  result.journey.leftPane = await root.locator('.pane-left').isVisible();
  await root.locator('[data-action="mobile-pane"][data-pane="left"]').tap();
  result.journey.mainPane = await root.locator('.main-pane').isVisible();
  await root.locator('[data-action="mobile-pane"][data-pane="right"]').tap();
  await root.locator('[data-action="right-tab"][data-tab="agent"]').tap();
  await root.locator('[data-action="module-select"][data-module="character"]').tap();
  await root.locator('[data-action="mobile-pane"][data-pane="right"]').tap();
  await root.locator('[data-action="right-tab"][data-tab="context"]').tap();
  await root.locator('[data-action="view"][data-view="worldbook"]').tap();
  await root.locator('[data-action="book-select"]').first().tap();
  await root.locator('[data-action="entry-select"]').first().tap();
  result.journey.worldbookEditor = await root.locator('[data-field="wb-content"]').isVisible();
  await root.locator('[data-action="mobile-pane"][data-pane="right"]').tap();
  result.journey.rightPane = await root.locator('.pane-right').isVisible();
  await root.locator('[data-action="mobile-pane"][data-pane="right"]').tap();
  await root.locator('[data-action="close"]').tap();
  await page.waitForFunction(() => document.querySelector('#riki-story-workbench-root')?.hidden === true);
  Object.assign(result.journey, await root.evaluate(host => ({
    closedHidden: host.hidden,
    closedDisplay: getComputedStyle(host).display,
    closedOverlayVisible: Boolean(host.shadowRoot?.querySelector('.overlay')?.checkVisibility?.()),
  })));
  await page.locator('#riki-story-workbench-launcher').tap();
  await page.waitForFunction(() => document.querySelector('#riki-story-workbench-root')?.hidden === false);
  result.journey.reopened = await root.evaluate(host => !host.hidden && getComputedStyle(host).display !== 'none');
  if (screenshot) await page.screenshot({ path: path.join(rootPath(), 'dist', 'preview-mobile.png'), fullPage: true });
}

function audit(report) {
  const failures = [];
  for (const item of report.results) {
    if (item.title !== 'Riki剧情助手') failures.push(`${item.viewport}: title missing`);
    if (item.horizontalOverflow) failures.push(`${item.viewport}: horizontal overflow`);
    failures.push(...item.errors.map(error => `${item.viewport}: ${error}`));
    for (const [name, value] of Object.entries(item.journey)) {
      if (value === false && !['closedOverlayVisible'].includes(name)) failures.push(`${item.viewport}: ${name} failed`);
    }
  }
  const desktop = report.results.find(item => item.viewport.startsWith('desktop'));
  if (desktop.mobileMenuDisplay !== 'none' || desktop.mobileSettingsDisplay !== 'none') failures.push('desktop: mobile drawer controls visible');
  for (const mobile of report.results.filter(item => item.viewport.startsWith('mobile'))) {
    if (mobile.mobileMenuDisplay === 'none' || mobile.mobileSettingsDisplay === 'none') failures.push(`${mobile.viewport}: mobile drawer controls hidden`);
    if (mobile.journey.closedDisplay !== 'none') failures.push(`${mobile.viewport}: closed display ${mobile.journey.closedDisplay}`);
    if (mobile.journey.closedOverlayVisible) failures.push(`${mobile.viewport}: overlay visible after close`);
  }
  return failures;
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.RIKI_BROWSER_EXECUTABLE ? { executablePath: process.env.RIKI_BROWSER_EXECUTABLE } : {}) });
  try {
    const results = [];
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const desktopResult = await openPreview(desktop, 'desktop-1440x900');
    await desktopJourney(desktop, desktopResult);
    results.push(desktopResult);
    await desktop.close();
    for (const viewport of [{ width: 320, height: 700 }, { width: 375, height: 812 }, { width: 430, height: 900 }]) {
      const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      const result = await openPreview(page, `mobile-${viewport.width}x${viewport.height}`);
      await mobileJourney(page, result, viewport.width === 375);
      results.push(result);
      await page.close();
    }
    const report = { schemaVersion: 2, checkedAt: new Date().toISOString(), results };
    fs.writeFileSync(path.join(root, 'dist', 'visual-check.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const failures = audit(report);
    if (failures.length) { failures.forEach(value => console.error(`FAIL ${value}`)); process.exitCode = 1; }
    else console.log('Visual and interaction checks passed for desktop and 320/375/430 mobile viewports.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
