import { expect, test, type Page } from '@playwright/test';
import { nextMoisture, moistureLine, type WeatherPlan } from '../src/weather';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

const plan = (night: WeatherPlan['night'], rainSeconds: number, heatSeconds: number): WeatherPlan =>
  ({ night, showers: rainSeconds ? [{ start: 100, length: rainSeconds }] : [], heatStart: 300, heatEnd: 300 + heatSeconds, gales: [] });

test('ground moisture carries over: wet days raise it, hot dry days lower it, a third of the way at most', () => {
  expect(nextMoisture(.5, plan('wet', 240, 0))).toBeGreaterThan(.75);
  expect(nextMoisture(.5, plan('dry', 0, 390))).toBeLessThan(.25);
  // An ordinary day (one shower, a midday hot spell, a dewy night) barely moves it.
  expect(Math.abs(nextMoisture(.5, plan('dewy', 120, 195)) - .5)).toBeLessThan(.05);
  expect(nextMoisture(.95, plan('wet', 600, 0))).toBe(1);
  expect(nextMoisture(.05, plan('dry', 0, 600))).toBe(0);
  expect(moistureLine(.2)).toContain('dry summer');
  expect(moistureLine(.8)).toContain('wet summer');
  expect(moistureLine(.5)).toBe('');
});

for (const [name, moisture] of [['dry', .1], ['wet', .9]] as const) {
  test(`a ${name} meadow looks it, and ${name === 'dry' ? 'fewer' : 'all'} pools can fill`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/?test&drops&moisture=${moisture}`);
    await startFlyingFixture(page);
    expect((await state(page)).moisture).toBeCloseTo(moisture, 5);
    const water = (await state(page)).water.puddles;
    if (name === 'dry') expect(water.canFill).toBeLessThan(water.count * .7);
    else expect(water.canFill).toBe(water.count);
    // Morning dew (the test night is dewy): a light sprinkle when dry, full when wet.
    await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.06));
    await expect.poll(async () => (await state(page)).flowerRain.dew).toBeGreaterThan(0);
    const dew = (await state(page)).flowerRain.dew;
    if (name === 'dry') expect(dew).toBeLessThan(.2); else expect(dew).toBeGreaterThan(.9);
    await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 3.2, 8], 0, -.12));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `artifacts/moisture/${name}.png` });
    expect(errors).toEqual([]);
  });
}
