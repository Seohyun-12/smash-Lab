// Optional real-browser QA. Requires Playwright and a running HTTP server.
// Set PLAYWRIGHT_MODULE to an installed package entrypoint, CHROMIUM_PATH if needed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});
const baseUrl = process.env.SMASH_TEST_URL || 'http://127.0.0.1:8787';
const output = new URL('../outputs/browser/', import.meta.url);
await mkdir(output, { recursive: true });
const errors = [];

async function prepare(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  // Expose state only in the test response, without shipping debug globals in game.js.
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        body +
        `
window.__smashTest={
  state:()=>({destroyed,actions:actions.length,sound,audioState:audioCtx?.state,
    camera:[camera.position.x,camera.position.y,camera.position.z],
    brokenE:blocks.filter(b=>b.userData.buildingId==='E'&&!b.userData.alive).length,
    brokenF:blocks.filter(b=>b.userData.buildingId==='F'&&!b.userData.alive).length}),
  aim(id){
    const b=blocks.find(b=>b.userData.alive&&b.userData.buildingId===id&&b.userData.floor===4&&b.position.z>8);
    const p=b.position.clone().project(camera),r=viewport.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },attack,reset
};`,
    });
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__smashTest);
  return { page, context };
}

async function aim(page, id) {
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  return page.evaluate((id) => window.__smashTest.aim(id), id);
}

try {
  const desktop = await prepare({ viewport: { width: 1440, height: 1100 } });
  const page = desktop.page;
  await page.locator('[data-view="F"]').click();
  await page.locator('[data-weapon="mallet"]').click();
  const point = await aim(page, 'F');
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__smashTest.state().brokenF > 0);
  assert.equal((await page.evaluate(() => window.__smashTest.state())).brokenE, 0);
  await page.locator('#sound').click();
  await page.waitForFunction(() => window.__smashTest.state().audioState === 'running');
  console.log('PASS desktop: F mouse attack, independent E state, AudioContext running');

  await page.locator('#reset').click();
  await page.locator('[data-view="all"]').click();
  for (const mode of ['street', 'map', 'orbit']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    assert.equal(await page.locator(`[data-mode="${mode}"]`).getAttribute('aria-pressed'), 'true');
    await page.locator('.arena').screenshot({ path: new URL(`${mode}.png`, output).pathname });
  }
  console.log('PASS desktop: street, map and orbit views; screenshots saved');
  await desktop.context.close();

  const mobile = await prepare({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const phone = mobile.page;
  await phone.locator('[data-view="F"]').tap();
  await phone.locator('[data-weapon="mallet"]').tap();
  const touch = await aim(phone, 'F');
  await phone.touchscreen.tap(touch.x, touch.y);
  await phone.waitForFunction(() => window.__smashTest.state().brokenF > 0);
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  await phone.locator('#reset').tap();
  await phone.locator('#viewport').scrollIntoViewIfNeeded();
  const rect = await phone.locator('#viewport').boundingBox();
  const before = await phone.evaluate(() => window.__smashTest.state());
  const client = await mobile.context.newCDPSession(phone);
  const x = rect.x + rect.width * 0.5,
    y = rect.y + rect.height * 0.5;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 45, y: y + 10 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const after = await phone.evaluate(() => window.__smashTest.state());
  assert.equal(after.destroyed, 0, 'drag must not attack');
  assert.notDeepEqual(after.camera, before.camera, 'touch drag must orbit');
  await phone.locator('#sound').tap();
  await phone.waitForFunction(() => window.__smashTest.state().audioState === 'running');
  await phone.locator('.arena').screenshot({ path: new URL('mobile.png', output).pathname });
  await mobile.context.close();
  assert.deepEqual(errors, []);
  console.log(
    'PASS mobile emulation: F tap, drag without attack, no horizontal overflow, AudioContext running',
  );
  console.log(
    'Real-phone hardware, actual audible sound and device performance remain unverified.',
  );
} finally {
  await browser.close();
}
