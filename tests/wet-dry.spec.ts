import { expect, test, type Page } from '@playwright/test';
import { ARC, summerGain, type SummerRecord } from '../src/hive-stores';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const nectarOf = (s: Record<string, any>, id: number): number => s.supplies.find(([flowerId]: [number]) => flowerId === id)[1].nectar;

test('rainy days cost the hive a little from its stores, a very wet one about .15', () => {
  const day: SummerRecord = { summer: 1, outcome: 'good', nectar: 80, pollen: 100, water: 0, waterGoal: 0, meadow: 1, pollinated: 10, moisture: .5, friends: 0, helped: 0 };
  expect(summerGain(day).rain).toBe(0);
  expect(summerGain({ ...day, rainMinutes: 1 }).rain).toBe(0);
  expect(summerGain({ ...day, rainMinutes: 3 }).rain).toBeCloseTo(.15);
  expect(summerGain({ ...day, rainMinutes: 9 }).rain).toBe(ARC.rainMost);
  expect(summerGain({ ...day, rainMinutes: 3 }).gain).toBeCloseTo(summerGain(day).gain - .15);
});

test('a shower washes nectar out of open flowers, and the sun brings some back', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  // A cornflower: it stays open in the rain (daisies close and keep most of theirs).
  const daisy = (await page.evaluate(() => window.__BEE_TEST__!.flowers())).find(f => f.species === 'cornflower')!;
  const full = nectarOf(await state(page), daisy.id);
  // The fixed day's shower falls at 150–270 s.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(210 / 600));
  await expect.poll(async () => (await state(page)).weather.rain, { timeout: 5_000 }).toBeGreaterThan(.5);
  await expect.poll(async () => nectarOf(await state(page), daisy.id), { timeout: 10_000 }).toBeLessThan(full * .95);
  const washed = nectarOf(await state(page), daisy.id);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(330 / 600));
  await expect.poll(async () => (await state(page)).weather.rain, { timeout: 5_000 }).toBeLessThan(.03);
  await expect.poll(async () => nectarOf(await state(page), daisy.id), { timeout: 10_000 }).toBeGreaterThan(washed + .05);
  expect(nectarOf(await state(page), daisy.id)).toBeLessThanOrEqual(full + 1e-6);
});

test('parched ground: every flower starts with less nectar', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  const ordinary = await state(page);
  await page.goto('/?test&moisture=0.05');
  await startFlyingFixture(page);
  const parched = await state(page);
  const daisyId = (await page.evaluate(() => window.__BEE_TEST__!.flowers())).find(f => f.species === 'daisy')!.id;
  expect(nectarOf(parched, daisyId)).toBeLessThan(nectarOf(ordinary, daisyId) * .8);
});

test('in a hard shower the poppies and daisies close up, and open again after', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const daisy = flowers.find(f => f.species === 'daisy' && f.id !== 0)!, poppy = flowers.find(f => f.species === 'poppy')!;
  const look = async (f: { center: number[] }, name: string) => {
    await page.evaluate(c => window.__BEE_TEST__!.setPose([c[0] + .9, c[1] + .7, c[2] + .9], Math.atan2(.9, .9), -.55), f.center);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/wet-dry/${name}.png` });
  };
  await look(daisy, 'daisy-open'); await look(poppy, 'poppy-open');
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(210 / 600));
  await expect.poll(async () => (await state(page)).petalsClosed, { timeout: 12_000 }).toBeGreaterThan(.95);
  await look(daisy, 'daisy-closed'); await look(poppy, 'poppy-closed');
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(330 / 600));
  await expect.poll(async () => (await state(page)).petalsClosed, { timeout: 15_000 }).toBeLessThan(.05);
});
