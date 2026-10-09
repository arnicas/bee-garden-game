import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const farDry = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.farDry());

/** Skips the flight on to the view at the hive. */
async function atHive(page: Page) {
  await page.evaluate(() => window.__BEE_TEST__!.setEndingTime(8.8));
  await page.waitForTimeout(300);
}

async function flyHome(page: Page, query: string) {
  await page.goto(`/?test${query}`);
  await startFlyingFixture(page);
  expect((await farDry(page)).now).toBe(0);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(70, 140, 100); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await page.keyboard.press('r');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as { phase: string }).phase).toBe('returning');
}

test('flying home after a dry summer, the land beyond the hive fades to straw', async ({ page }) => {
  await flyHome(page, '&moisture=0.1');
  const { target } = await farDry(page);
  expect(target).toBeGreaterThan(.6);
  await expect.poll(async () => (await farDry(page)).now, { timeout: 8_000 }).toBeGreaterThan(target * .7);
  await atHive(page);
  await page.screenshot({ path: 'artifacts/arc/home-dry.png' });
});

test('after an ordinary summer the land stays much greener, and a new day resets it', async ({ page }) => {
  await flyHome(page, '&moisture=0.6');
  const ordinary = (await farDry(page)).target;
  expect(ordinary).toBeLessThan(.45);
  await page.waitForTimeout(3000);
  await atHive(page);
  await page.screenshot({ path: 'artifacts/arc/home-ordinary.png' });
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start'));
  expect((await farDry(page)).now).toBe(0);
});
