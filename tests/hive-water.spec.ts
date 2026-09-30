import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { FIXED_WEATHER_PLAN, hiveNeedsWater } from '../src/weather';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('only a long hot spell makes a hot day', () => {
  expect(hiveNeedsWater(FIXED_WEATHER_PLAN)).toBe(true);
  expect(hiveNeedsWater({ ...FIXED_WEATHER_PLAN, heatStart: 300, heatEnd: 450 })).toBe(false);
});

test('on a hot day the hive asks for water: sipping at a pool carries it home in the jar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&drops&hivewater');
  await startFlyingFixture(page);
  let s = await state(page);
  expect(s.water.goal).toBe(15);
  expect(s.water.carried).toBe(0);
  // Groundwater: the pools start the day part full, even without rain.
  expect(s.water.puddles.wet).toBeGreaterThan(3);
  expect(Math.max(...s.water.puddles.springs)).toBeGreaterThan(.2);
  await expect(page.locator('[data-water-caption]')).toBeVisible();
  // Nectar and pollen alone are not enough.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(80, 140, 100, 0));
  await expect.poll(async () => (await state(page)).harvestReady).toBe(false);
  // Down by the first pool: hold F to sip, and the water goes in the jar.
  const pool = (await page.evaluate(() => window.__BEE_TEST__!.puddles()))[0];
  await page.evaluate(({ x, z, r }) => { window.__BEE_TEST__!.setPuddleFill(1); window.__BEE_TEST__!.setPose([x + r * .9, .3, z], Math.PI / 2, -.6); }, { x: pool.x, z: pool.z, r: pool.radius });
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
  await expect.poll(async () => (await state(page)).water.near).toBe('puddle');
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).water.carried, { timeout: 15000 }).toBeGreaterThanOrEqual(15);
  await page.keyboard.up('f');
  s = await state(page);
  expect(s.water.carried).toBe(15);
  expect(s.harvestReady).toBe(true);
  await expect(page.locator('[data-water-caption]')).toHaveClass(/is-full/);
  const jar = await page.locator('[data-fill="water"]').first().getAttribute('height');
  expect(Number(jar)).toBeGreaterThan(5);
  await page.locator('.nectar-meter').screenshot({ path: 'artifacts/hive-water/jar.png' });
  // Water takes room in the crop: nectar can't overfill it.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(85, 140, 100, 15));
  expect((await state(page)).load).toBeGreaterThan(.99);
  expect(errors).toEqual([]);
});

test('an ordinary test day asks for no water, and dry grass shades less', async ({ page }) => {
  await page.goto('/?test&moisture=0.1');
  await startFlyingFixture(page);
  const s = await state(page);
  expect(s.water.goal).toBe(0);
  await expect(page.locator('[data-water-caption]')).toBeHidden();
  expect(s.water.grassShade).toBeLessThan(.4);
  await page.goto('/?test');
  await startFlyingFixture(page);
  expect((await state(page)).water.grassShade).toBe(1);
});
