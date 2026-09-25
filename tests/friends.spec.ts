import { expect, test } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test('ladybirds live on stems, leaves and the ground, and meeting one is counted', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
  const birds = await page.evaluate(() => window.__BEE_TEST__!.ladybirds());
  expect(birds.length).toBeGreaterThanOrEqual(12);
  expect(new Set(birds.map(b => b.perch)).size).toBeGreaterThanOrEqual(2);
  const bird = birds.find(b => b.perch === 'stem')!;
  // Come within reach from the side it faces.
  await page.evaluate(b => {
    const pos = b.position.map((v: number, i: number) => v + b.up[i] * .3 + (i === 1 ? .05 : 0)) as [number, number, number];
    window.__BEE_TEST__!.setPose(pos, Math.atan2(b.up[0], b.up[2]), -.1);
  }, bird);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Record<string, any>).ladybirds.seen).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('ladybird');
  expect(errors).toEqual([]);
});
