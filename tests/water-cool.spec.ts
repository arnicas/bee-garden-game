import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('too hot with water in the jar: hold F to cool off with a drop, and the hive needs it topped up', async ({ page }) => {
  await page.goto('/?test&hivewater');
  await startFlyingFixture(page);
  // Flying high in the open with the hive's water already carried, and overheating.
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(60, 140, 100, 15); window.__BEE_TEST__!.setPose([0, 5, 6], 0, 0); window.__BEE_TEST__!.setHeat(.8); });
  await expect(page.locator('[data-text="hint"]')).toContainText('Hold F to cool yourself');
  const before = await state(page);
  expect(before.water.carried).toBe(15);
  await page.keyboard.down('f');
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.coolingWithWater())).toBe(true);
  await expect(page.locator('[data-text="hint"]')).toContainText('Cooling with a drop of your water');
  await page.waitForTimeout(1500);
  await page.keyboard.up('f');
  const after = await state(page);
  expect(after.heat).toBeLessThan(before.heat - .2);
  expect(after.water.carried).toBeLessThan(14);
  expect(after.water.carried).toBeGreaterThan(9);
  // The hive's water is short again, so the day isn't ready to go home.
  expect(after.harvestReady).toBe(false);
  await expect(page.locator('.message-toast')).toContainText('topped up');
});

test('with nothing in the jar, or when not hot, F does nothing in flight', async ({ page }) => {
  await page.goto('/?test&hivewater');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(60, 140, 100, 15); window.__BEE_TEST__!.setPose([0, 5, 6], 0, 0); window.__BEE_TEST__!.setHeat(0); });
  await page.keyboard.down('f');
  await page.waitForTimeout(600);
  await page.keyboard.up('f');
  expect((await state(page)).water.carried).toBe(15);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(60, 140, 100, 0); window.__BEE_TEST__!.setHeat(.8); });
  await page.keyboard.down('f');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__BEE_TEST__!.coolingWithWater())).toBe(false);
  await page.keyboard.up('f');
});
