import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('after rain in the night the morning is wet: pools part full, mushrooms up, leaves wet, ants still indoors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&drops');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.05); });
  // Test pages pin an ordinary dewy night.
  const before = await state(page);
  expect(before.night).toBe('dewy');
  expect(before.water.puddles.wet).toBe(0);
  expect(before.mushrooms.up).toBe(0);
  await page.evaluate(() => window.__BEE_TEST__!.setNight('wet'));
  const wet = await state(page);
  expect(wet.night).toBe('wet');
  expect(wet.water.puddles.wet).toBeGreaterThan(5);
  expect(wet.mushrooms.up).toBeGreaterThan(5);
  expect(wet.leafWet).toBeGreaterThan(.5);
  expect(wet.ants.inside).toBeGreaterThan(wet.ants.outside);
  // The ants come out over the first minute or so.
  await expect.poll(async () => (await state(page)).ants.outside, { timeout: 30000 }).toBeGreaterThan(wet.ants.outside + 20);
  expect(errors).toEqual([]);
});

test('after a dry night there is no dew and the leaves are dry', async ({ page }) => {
  await page.goto('/?test&drops');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.05); window.__BEE_TEST__!.setNight('dry'); });
  const dry = await state(page);
  expect(dry.night).toBe('dry');
  expect(dry.leafWet).toBe(0);
  expect(dry.mushrooms.up).toBe(0);
});
