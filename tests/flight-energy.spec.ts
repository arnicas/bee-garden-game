import { startFlyingFixture } from './support/start';
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('flight needs regular fuel while riding and resting conserve energy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = () => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  const measure = async (flying: boolean) => {
    await page.evaluate(() => {
      window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start');
      window.__BEE_TEST__!.setPose([0, 6.2, 3.5], 0, 0);
      window.__BEE_TEST__!.setCargo(0, 0, 100);
    });
    if (flying) await page.keyboard.down('w');
    // Let airspeed settle before measuring expenditure in actual play.
    await page.waitForTimeout(1200);
    const before = await state();
    await expect.poll(async () => (await state()).elapsed).toBeGreaterThan(before.elapsed + 2);
    const after = await state();
    if (flying) await page.keyboard.up('w');
    expect(after.phase).toBe('flying');
    expect(after.rainExposure).toBe(0);
    return { before, after, rate: (before.energy - after.energy) / (after.elapsed - before.elapsed) };
  };
  const riding = await measure(false);
  const flying = await measure(true);
  // A full bar lasts roughly 50 seconds of continuous dry, empty-handed flight.
  expect(flying.rate).toBeGreaterThan(1.8);
  expect(flying.rate).toBeLessThan(2.3);
  expect(riding.rate).toBeGreaterThan(.64);
  expect(riding.rate).toBeLessThan(1.1);
  expect(flying.rate).toBeGreaterThan(riding.rate * 1.7);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.approachFlower(1);
    window.__BEE_TEST__!.setCargo(0, 0, 60);
  });
  await expect.poll(async () => (await state()).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state()).landed).toBe(1);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  const perched = await state();
  await expect.poll(async () => (await state()).elapsed).toBeGreaterThan(perched.elapsed + 1);
  const idle = await state();
  const idleRate = (perched.energy - idle.energy) / (idle.elapsed - perched.elapsed);
  expect(idleRate).toBeCloseTo(.065, 5);
  await page.keyboard.press('e');
  const resting = await state();
  await expect.poll(async () => (await state()).elapsed).toBeGreaterThan(resting.elapsed + 1);
  const rested = await state();
  expect(rested.resting).toBe(true);
  expect((resting.energy - rested.energy) / (rested.elapsed - resting.elapsed)).toBeCloseTo(.025, 5);
  expect(rested.energy).toBeLessThan(resting.energy); // Rest cannot create food.
  expect(errors).toEqual([]);
  await mkdir('artifacts/foraging-balance-1', { recursive: true });
  await writeFile('artifacts/foraging-balance-1/energy-metrics.json', JSON.stringify({ riding, flying, perched, idle, resting, rested, errors }, null, 2));
});
