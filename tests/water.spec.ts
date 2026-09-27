import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('rain fills small pools on the ground; the bee sips from one to cool down, and snails keep to the rims', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&drops');
  await startFlyingFixture(page);
  const puddles = await page.evaluate(() => window.__BEE_TEST__!.puddles());
  expect(puddles.length).toBeGreaterThanOrEqual(8);
  // Dry at the start of the day; the shower fills them.
  expect((await state(page)).water.puddles.wet).toBe(0);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await expect.poll(async () => (await state(page)).water.puddles.wet, { timeout: 15000 }).toBeGreaterThan(0);
  // Some snails wait at the rims of the pools.
  const snails = await page.evaluate(() => window.__BEE_TEST__!.snails());
  const atRims = snails.filter(s => puddles.some(p => Math.hypot(s.position[0] - p.x, s.position[2] - p.z) < p.radius * 1.6));
  expect(atRims.length).toBeGreaterThan(0);
  // Down in the grass beside the first pool (by the opening corridor).
  const pool = puddles[0];
  await page.evaluate(({ x, z, r }) => { window.__BEE_TEST__!.setPuddleFill(1); window.__BEE_TEST__!.setHeat(.5); window.__BEE_TEST__!.setPose([x + r * .9, .3, z], Math.PI / 2, -.6); }, { x: pool.x, z: pool.z, r: pool.radius });
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
  await expect.poll(async () => (await state(page)).water.near).toBe('puddle');
  const before = await state(page);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).water.sipping).toBe(true);
  await expect.poll(async () => (await state(page)).water.sips).toBeGreaterThan(1);
  // Sipping water is heard: a slurp every so often.
  expect((await state(page)).audio.slurps).toBeGreaterThan(1);
  await page.keyboard.up('f');
  expect((await state(page)).heat).toBeLessThan(before.heat);
  await page.screenshot({ path: 'artifacts/water-1/puddle.png' });
  expect(errors).toEqual([]);
});

test('raindrops on a poppy can be sipped: water, not food', async ({ page }) => {
  await page.goto('/?test&drops');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(1));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(1);
  // Drops gather on the petals as the shower goes on.
  await expect.poll(async () => (await state(page)).water.near, { timeout: 15000 }).toBe('drops');
  const before = await state(page);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).water.sipping).toBe(true);
  await page.waitForTimeout(600);
  const after = await state(page);
  await page.keyboard.up('f');
  // The drops keep gathering while it rains, so check the sipping itself.
  expect(after.water.sips).toBeGreaterThan(before.water.sips + .3);
  expect(after.nectar).toBe(before.nectar);
  await page.screenshot({ path: 'artifacts/water-1/drops.png' });
});
