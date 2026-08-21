const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const playwrightPath = process.env.RIKI_PLAYWRIGHT_PATH || 'playwright';
const { chromium } = require(playwrightPath);

async function inspect(page, viewportName) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8178/preview', { waitUntil: 'networkidle' });
  await page.waitForSelector('#riki-story-workbench-root', { state: 'attached' });
  await page.waitForFunction(() => Boolean(document.querySelector('#riki-story-workbench-root')?.shadowRoot?.querySelector('.shell')));
  const result = await page.locator('#riki-story-workbench-root').evaluate((host, name) => {
    const shadow = host.shadowRoot;
    const shell = shadow.querySelector('.shell');
    const workspace = shadow.querySelector('.workspace');
    const rect = shell.getBoundingClientRect();
    return {
      viewport: name,
      title: shadow.querySelector('h1')?.textContent || '',
      shell: { width: Math.round(rect.width), height: Math.round(rect.height) },
      workspaceDisplay: getComputedStyle(workspace).display,
      bookButtons: shadow.querySelectorAll('[data-action="select-book"]').length,
      entryButtons: shadow.querySelectorAll('[data-action="select-entry"]').length,
      mobileNavDisplay: getComputedStyle(shadow.querySelector('.mobile-nav')).display,
      horizontalOverflow: shell.scrollWidth > shell.clientWidth + 1,
    };
  }, viewportName);
  result.errors = errors;
  return result;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.RIKI_BROWSER_EXECUTABLE ? { executablePath: process.env.RIKI_BROWSER_EXECUTABLE } : {}),
  });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const desktopResult = await inspect(desktop, 'desktop-1440x900');
    const desktopRoot = desktop.locator('#riki-story-workbench-root');
    await desktopRoot.locator('[data-field="content"]').fill('主角刚抵达雾港，并从港务记录发现领航员当晚并未值班。');
    await desktopRoot.locator('[data-action="preview-patch"]').click();
    await desktopRoot.locator('.diff').waitFor({ state: 'visible' });
    desktopResult.diffPreviewOpened = await desktopRoot.locator('.diff').isVisible();
    await desktopRoot.locator('[data-action="close-diff"]').click();
    await desktopRoot.locator('[data-action="toggle-context"]').first().click();
    await desktopRoot.locator('[data-action="tab"][data-tab="discussion"]').click();
    await desktopRoot.locator('[data-input="discussion"]').fill('如何让这条失踪线索更有因果张力？');
    await desktopRoot.locator('[data-action="send-discussion"]').click();
    await desktopRoot.locator('.message.assistant').waitFor({ state: 'visible' });
    desktopResult.discussionMessages = await desktopRoot.locator('.message').count();
    await desktop.screenshot({ path: path.join(root, 'dist', 'preview-desktop.png'), fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const mobileResult = await inspect(mobile, 'mobile-375x812');
    const mobileRoot = mobile.locator('#riki-story-workbench-root');
    await mobileRoot.locator('[data-action="mobile-view"][data-view="entries"]').click();
    await mobileRoot.locator('[data-action="select-entry"]').first().click();
    await mobileRoot.locator('[data-action="mobile-view"][data-view="workspace"]').click();
    mobileResult.editorVisibleAfterNavigation = await mobileRoot.locator('[data-field="content"]').isVisible();
    await mobile.screenshot({ path: path.join(root, 'dist', 'preview-mobile.png'), fullPage: true });

    const mobile320 = await browser.newPage({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
    const mobile320Result = await inspect(mobile320, 'mobile-320x700');
    await mobile320.close();

    const mobile430 = await browser.newPage({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true });
    const mobile430Result = await inspect(mobile430, 'mobile-430x900');
    await mobile430.close();

    const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), results: [desktopResult, mobile320Result, mobileResult, mobile430Result] };
    fs.writeFileSync(path.join(root, 'dist', 'visual-check.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const failures = report.results.flatMap(item => [
      ...item.errors.map(error => `${item.viewport}: ${error}`),
      ...(item.title === 'Riki 剧情工作台' ? [] : [`${item.viewport}: title missing`]),
      ...(item.bookButtons >= 3 ? [] : [`${item.viewport}: book list incomplete`]),
      ...(item.entryButtons >= 1 ? [] : [`${item.viewport}: entry list incomplete`]),
      ...(item.horizontalOverflow ? [`${item.viewport}: horizontal overflow`] : []),
    ]);
    if (desktopResult.mobileNavDisplay !== 'none') failures.push('desktop: mobile nav should be hidden');
    for (const item of [mobile320Result, mobileResult, mobile430Result]) {
      if (item.mobileNavDisplay === 'none') failures.push(`${item.viewport}: mobile nav should be visible`);
    }
    if (!desktopResult.diffPreviewOpened) failures.push('desktop: diff preview did not open');
    if (desktopResult.discussionMessages < 2) failures.push('desktop: discussion flow did not return a reply');
    if (!mobileResult.editorVisibleAfterNavigation) failures.push('mobile: entry editor navigation failed');
    if (failures.length) {
      failures.forEach(item => console.error(`FAIL ${item}`));
      process.exitCode = 1;
    } else {
      console.log('Visual preview checks passed for desktop and mobile.');
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
