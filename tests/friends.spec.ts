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

test('ladybirds find aphid clusters and eat them down', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
  const clusters = await page.evaluate(() => window.__BEE_TEST__!.aphids());
  expect(clusters.length).toBeGreaterThanOrEqual(8);
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  // Hover a little way off the first clusters so their ladybirds are in view but not shy.
  const host = flowers.find(f => f.id === clusters[0].flowerId)!;
  await page.evaluate(c => window.__BEE_TEST__!.setPose([c[0] + 1.6, c[1] + .4, c[2] + 1.6], Math.PI * 1.25, -.2), host.base);
  await expect.poll(async () => ((await page.evaluate(() => window.__BEE_TEST__!.snapshot())) as Record<string, any>).ladybirds.eating, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
  const before = (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Record<string, any>).ladybirds.aphids;
  await expect.poll(async () => ((await page.evaluate(() => window.__BEE_TEST__!.snapshot())) as Record<string, any>).ladybirds.aphids, { timeout: 20000 }).toBeLessThan(before);
});
