import { expect, test, type Page } from '@playwright/test';
import { friendCounts, meadowDryness } from '../src/meadow-plan';
import { snailChangeLine } from '../src/day-report';
import { startFlyingFixture } from './support/start';

const snapshot = async (page: Page) => ((await page.evaluate(() => window.__BEE_TEST__!.snapshot())) as Record<string, any>).snails;

test('snail numbers and dryness follow how full the meadow is', () => {
  const normal = { daisy: 24, poppy: 24, cornflower: 24 }, thin = { daisy: 18, poppy: 9, cornflower: 5 };
  expect(friendCounts(normal).snails).toBe(12);
  expect(friendCounts(thin).snails).toBeLessThan(7);
  expect(meadowDryness(normal)).toBe(0);
  expect(meadowDryness(thin)).toBeGreaterThan(.9);
  expect(snailChangeLine(normal, thin)).toContain('fewer snails');
  expect(snailChangeLine(normal, normal)).toBe('');
});

test('snails come out in rain, tuck in when dry, climb away from the heat, and pull in their tentacles near the bee', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  const count = (await snapshot(page)).count;
  expect(count).toBeGreaterThanOrEqual(8);
  // A dry, mild late morning: in their shells.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.2));
  await expect.poll(async () => (await snapshot(page)).tucked, { timeout: 10000 }).toBe(count);
  // The shower: out and crawling.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await expect.poll(async () => (await snapshot(page)).crawling, { timeout: 10000 }).toBe(count);
  await expect.poll(async () => Math.max(...(await page.evaluate(() => window.__BEE_TEST__!.snails())).map(s => s.extension)), { timeout: 10000 }).toBeGreaterThan(.8);
  // Close to one: its tentacles pull in.
  const out = (await page.evaluate(() => window.__BEE_TEST__!.snails())).sort((a, b) => b.extension - a.extension)[0];
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p[0] + .25, p[1] + .15, p[2]], Math.PI / 2, -.4), out.position);
  await expect.poll(async () => (await page.evaluate(id => window.__BEE_TEST__!.snails()[id].extension, out.id)), { timeout: 8000 }).toBeLessThan(.7);
  // The hot spell: every snail heads up a stem (or seals where it is).
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.6));
  await expect.poll(async () => { const s = await snapshot(page); return s.climbing + s.sealed; }, { timeout: 10000 }).toBe(count);
  expect(errors).toEqual([]);
});
