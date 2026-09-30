import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('perched on a leaf with a ladybird, the bee is credited with it', async ({ page }) => {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.1); window.__BEE_TEST__!.setCargo(25, 5, 60); });
  const { birds, leaves } = await page.evaluate(() => ({ birds: window.__BEE_TEST__!.ladybirds(), leaves: window.__BEE_TEST__!.shelters() }));
  const onTop = birds.filter(b => b.perch === 'leaf' && b.up[1] > .5);
  test.skip(!onTop.length, 'no ladybird on a leaf top in this meadow');
  const bird = onTop[0];
  const leaf = leaves.reduce((best, l) => Math.hypot(l.center[0] - bird.position[0], l.center[2] - bird.position[2]) < Math.hypot(best.center[0] - bird.position[0], best.center[2] - bird.position[2]) ? l : best);
  await page.evaluate(l => window.__BEE_TEST__!.setPose([l.center[0], l.center[1] + 1.5, l.center[2] + .8], 0, -.9), leaf);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).onLeaf).toBe(leaf.id);
  await expect.poll(async () => (await state(page)).ladybirds.seen, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
});
