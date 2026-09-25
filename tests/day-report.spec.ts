import { expect, test } from '@playwright/test';
import { dayReport, morningLine } from '../src/day-report';
import { startFlyingFixture } from './support/start';

const day = (nectar: number, pollen: number, poppy: number, daisy: number, cornflower: number) =>
  dayReport({ nectar, pollen, pollinatedBySpecies: { poppy, daisy, cornflower }, visited: 20, flowerTotal: 72 });

test('day tiers follow the delivery × pollination table', () => {
  expect(day(92, 140, 4, 5, 5).tier).toBe('fantastic');
  expect(day(92, 140, 1, 1, 1).tier).toBe('good');
  expect(day(50, 140, 4, 4, 4).tier).toBe('good');
  expect(day(61, 140, 2, 3, 2).tier).toBe('good');
  expect(day(50, 140, 2, 3, 0).tier).toBe('reasonable');
  expect(day(20, 90, 1, 1, 1).tier).toBe('reasonable');
  expect(day(90, 140, 0, 2, 0).tier).toBe('okay');
  expect(day(10, 30, 1, 1, 1).tier).toBe('reasonable');
  expect(day(10, 30, 2, 1, 0).tier).toBe('okay');
  expect(day(0, 0, 0, 0, 0).tier).toBe('okay');
});

test('day reports explain the tier and aim a tip at the weakest stat', () => {
  const fantastic = day(92, 140, 4, 5, 5);
  expect(fantastic.title).toBe('A fantastic day!');
  expect(fantastic.why).toBe('All three flowers, 4 or more of each · 14 pollinated · Nectar jar brimming (92%) · Pollen pouch full');
  expect(fantastic.tip).toBe('');
  const reasonable = day(50, 140, 2, 3, 0);
  expect(reasonable.meadow).toContain('The cornflowers missed you today');
  expect(reasonable.tip).toBe('Next summer, carry cornflower pollen to another cornflower.');
  expect(day(40, 140, 0, 1, 0).why).toContain('1 pollinated (a daisy)');
  const okay = day(10, 30, 0, 0, 0);
  expect(okay.queen).toContain('small list');
  expect(okay.meadow).toContain('No flowers were pollinated');
  expect(okay.why).toBe('No flowers pollinated · Jar 10% full · Pouch 21% full');
  expect(morningLine(2, 'okay')).toMatch(/^Summer 2 · /);
  expect(morningLine(2, null)).toBe('');
});

test('R heads home early and the partial delivery is judged at the hive', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false);
    const bee = window.__BEE_TEST__!;
    bee.setDayProgress(.3); bee.setCargo(15, 30, 90); bee.setPollination({ daisy: 1 }); bee.setPose([0, 4, 26], Math.PI, 0);
  });
  const state = () => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
  expect((await state()).harvestReady).toBe(false);
  // Without choosing to go home, the edge does not end the day.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30.6], Math.PI, 0));
  await page.waitForTimeout(400);
  expect((await state()).phase).toBe('flying');
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 26], Math.PI, 0));
  await page.keyboard.press('KeyR');
  await expect.poll(async () => (await state()).headingHome).toBe(true);
  await expect(page.locator('.return-ready')).toBeVisible();
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30.6], Math.PI, 0));
  await expect.poll(async () => (await state()).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
  await expect(page.locator('[data-text="result-title"]')).toHaveText('An okay day');
  await expect(page.locator('[data-text="result-why"]')).toContainText('Jar 10% full');
  await expect(page.locator('[data-text="result-tip"]')).toBeVisible();
  expect((await state()).report.tier).toBe('okay');
});
