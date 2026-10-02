import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

async function start(page: Page, nectar = 30) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(n => window.__BEE_TEST__!.setCargo(n, 20, 90), nectar);
}

test('flying out at the hive edge, without R, shows the hive marker and heads home early', async ({ page }) => {
  await start(page);
  expect((await state(page)).harvestReady).toBe(false);
  // Inside the meadow, facing the hive edge: the marker gives the arrow a reason.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 25], Math.PI, 0));
  await expect.poll(async () => (await state(page)).nearHomeEdge).toBe(true);
  await expect(page.locator('.home-marker')).toBeVisible();
  await expect(page.locator('[data-text="home-marker-note"]')).toHaveText('Keep flying to go home');
  await expect(page.locator('[data-text="hint"]')).toContainText('Keep flying out');
  await page.screenshot({ path: 'artifacts/edge-home-marker.png' });
  // Keep flying out: a note, then past the edge the day ends with what she carries.
  await page.keyboard.down('w');
  await expect(page.locator('.message-toast')).toContainText('The way home', { timeout: 8_000 });
  await expect.poll(async () => (await state(page)).phase, { timeout: 15_000 }).toBe('returning');
  await page.keyboard.up('w');
  expect((await state(page)).headingHome).toBe(true);
});

test('hovering or turning back at the edge never ends the day, and facing away hides the marker', async ({ page }) => {
  await start(page);
  // At the edge with no W held: nothing happens.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30.5], Math.PI, 0));
  await page.waitForTimeout(2500);
  expect((await state(page)).phase).toBe('flying');
  // Turned back toward the flowers and flying: no marker, no return.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 29], 0, 0));
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  expect((await state(page)).phase).toBe('flying');
  expect((await state(page)).nearHomeEdge).toBe(false);
  await expect(page.locator('.home-marker')).toBeHidden();
});

test('with no nectar for the flight, flying out at the edge says so instead', async ({ page }) => {
  await start(page, 0);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 27], Math.PI, 0));
  await page.keyboard.down('w');
  await expect(page.locator('.message-toast')).toContainText('need a little nectar', { timeout: 8_000 });
  await page.waitForTimeout(2500);
  await page.keyboard.up('w');
  expect((await state(page)).phase).toBe('flying');
});
