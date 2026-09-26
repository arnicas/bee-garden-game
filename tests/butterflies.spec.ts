import { expect, test } from '@playwright/test';
import { friendCounts } from '../src/meadow-plan';
import { butterflyChangeLine } from '../src/day-report';
import { startFlyingFixture } from './support/start';

test('butterflies follow the nectar flowers and leave a poppy meadow', () => {
  expect(friendCounts({ daisy: 24, poppy: 24, cornflower: 24 }).butterflies).toBe(8);
  expect(friendCounts({ daisy: 10, poppy: 60, cornflower: 6 }).butterflies).toBeLessThan(4);
  expect(butterflyChangeLine({ daisy: 24, poppy: 24, cornflower: 24 }, { daisy: 10, poppy: 60, cornflower: 6 })).toContain('moved on');
  expect(butterflyChangeLine({ daisy: 24, poppy: 24, cornflower: 24 }, { daisy: 26, poppy: 10, cornflower: 40 })).toContain('more butterflies');
  expect(butterflyChangeLine({ daisy: 24, poppy: 24, cornflower: 24 }, { daisy: 24, poppy: 24, cornflower: 24 })).toBe('');
});

test('butterflies sip only from daisies and cornflowers, a visit drains nectar, and meeting one is counted', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.2); });
  const list = await page.evaluate(() => window.__BEE_TEST__!.butterflies());
  expect(list.length).toBeGreaterThanOrEqual(6);
  const feeding = list.filter(b => b.state === 'feeding');
  expect(feeding.length).toBeGreaterThan(0);
  expect(feeding.every(b => b.species !== 'poppy')).toBe(true);
  // A little nectar goes while a butterfly sips.
  const start = await page.evaluate(id => window.__BEE_TEST__!.nectar(id), feeding[0].flowerId);
  await expect.poll(() => page.evaluate(id => window.__BEE_TEST__!.nectar(id), feeding[0].flowerId), { timeout: 8000 }).toBeLessThan(start - .4);
  // Come near one (not so near that it flies off).
  const near = (await page.evaluate(() => window.__BEE_TEST__!.butterflies())).find(b => b.state === 'feeding')!;
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p[0] + 1.2, p[1] + .2, p[2]], Math.PI / 2, -.1), near.position);
  await expect.poll(async () => ((await page.evaluate(() => window.__BEE_TEST__!.snapshot())) as Record<string, any>).butterflies.seen).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('butterfly');
  expect(errors).toEqual([]);
});

test('in rain butterflies shelter under leaves or in the grass, and come out after', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.35); });
  const snapshot = async () => ((await page.evaluate(() => window.__BEE_TEST__!.snapshot())) as Record<string, any>).butterflies;
  const count = (await snapshot()).count;
  await expect.poll(async () => (await snapshot()).sheltering, { timeout: 15000 }).toBe(count);
  expect((await page.evaluate(() => window.__BEE_TEST__!.butterflies())).every(b => b.state === 'sheltering')).toBe(true);
  // The shower clears: out they come.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.455));
  await expect.poll(async () => (await snapshot()).sheltering, { timeout: 15000 }).toBe(0);
  expect(errors).toEqual([]);
});
