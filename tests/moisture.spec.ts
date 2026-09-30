import { expect, test, type Page } from '@playwright/test';
import { coverLine, coverMoisture, nextMoisture, moistureLine, type WeatherPlan } from '../src/weather';
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

test('the meadow left behind holds water in the ground: a patchy one dries faster, a full one keeps it damp', () => {
  const ordinary = plan('dewy', 120, 195);
  expect(nextMoisture(.5, ordinary, 1)).toBe(nextMoisture(.5, ordinary));
  // Half a meadow (little pollinated) loses about .11 more; enough to tip ordinary summers dry within three.
  expect(nextMoisture(.5, ordinary) - nextMoisture(.5, ordinary, .5)).toBeCloseTo(.11, 2);
  expect(nextMoisture(.5, ordinary, 1.15)).toBeGreaterThan(nextMoisture(.5, ordinary));
  // Smaller than the weather: a wet day still wets a patchy meadow.
  expect(nextMoisture(.5, plan('wet', 240, 0), .5)).toBeGreaterThan(.6);
  let m = .5; for (let i = 0; i < 3; i++) m = nextMoisture(m, ordinary, .55);
  expect(m).toBeLessThan(.3);
  expect(coverLine(coverMoisture(.5))).toContain('patchy');
  expect(coverLine(coverMoisture(.5), true)).toContain('drier');
  expect(coverLine(coverMoisture(1))).toBe('');
});

for (const [name, moisture] of [['dry', .1], ['wet', .9]] as const) {
  test(`a ${name} meadow looks it, and ${name === 'dry' ? 'fewer' : 'all'} pools can fill`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/?test&drops&moisture=${moisture}`);
    await startFlyingFixture(page);
    expect((await state(page)).moisture).toBeCloseTo(moisture, 5);
    // Flowers and friends: daisies droop and brown in the dry; the wet is a snail-and-mushroom summer.
    const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
    const daisies = flowers.filter(f => f.species === 'daisy' && f.id !== 0), s = await state(page);
    if (name === 'dry') {
      expect(daisies.filter(f => f.droop > .3).length).toBeGreaterThan(daisies.length / 2);
      expect(daisies.some(f => f.browned)).toBe(true);
      expect(s.mushrooms.mushrooms).toBe(0);
      expect(s.ants.colonies).toBeGreaterThanOrEqual(5);
      expect(s.snails.count).toBeLessThanOrEqual(6);
    } else {
      expect(flowers.every(f => f.droop === 0 && !f.browned)).toBe(true);
      expect(s.mushrooms.rings).toBeGreaterThanOrEqual(6);
      expect(s.ants.colonies).toBeLessThanOrEqual(3);
      expect(s.snails.count).toBeGreaterThanOrEqual(16);
      expect(s.caterpillars.count).toBeGreaterThanOrEqual(7);
    }
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
