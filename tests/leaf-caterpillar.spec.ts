import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('perched on a leaf with a caterpillar, the bee is credited with it', async ({ page }) => {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.1); window.__BEE_TEST__!.setCargo(25, 5, 60); });
  const leafId = (await state(page)).caterpillars.leaves[0];
  const leaf = (await page.evaluate(() => window.__BEE_TEST__!.shelters())).find(l => l.id === leafId)!;
  // Come down from straight above the leaf, looking away from its edges.
  await page.evaluate(l => window.__BEE_TEST__!.setPose([l.center[0], l.center[1] + 1.5, l.center[2] + .8], 0, -.9), leaf);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).onLeaf).toBe(leafId);
  await expect.poll(async () => (await state(page)).caterpillars.seen, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
});
