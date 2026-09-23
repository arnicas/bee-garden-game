import { startFlyingFixture } from './support/start';
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });

test('wet leaf tops and sheltered ground rest follow weather, pause and takeoff', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  const state = () => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
  await mkdir('artifacts/grass-shelter-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(() => {
    const leaf = window.__BEE_TEST__!.shelters()[0];
    window.__BEE_TEST__!.setPose([leaf.center[0], leaf.center[1] + 2, leaf.center[2] + 2.9], 0, -.65);
    window.__BEE_TEST__!.setDayProgress(.35);
  });
  await page.waitForTimeout(1700);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
  const leaves = await state();
  expect(leaves.flowerRain.leafBeads).toBeGreaterThan(20);
  expect(leaves.flowerRain.draws).toBe(2);
  expect(leaves.diagnostics.renderer.triangles).toBeLessThan(750_000);
  await page.screenshot({ path: 'artifacts/grass-shelter-1/wet-leaves.png' });
  // A low approach still flies; contact with the floor settles without a new key.
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([7, 1.2, 2], 0, -.95, [0, -.9, 0]);
    window.__BEE_TEST__!.setCargo(0, 5, 60);
    window.__BEE_TEST__!.setChill(.6);
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false);
  });
  await page.keyboard.down('w');
  await expect.poll(async () => (await state()).onGround).toBe(true);
  await page.keyboard.up('w');
  await expect(page.locator('.flower-note h2')).toHaveText('Among the grass');
  await expect(page.locator('.flower-resources')).toBeHidden();
  await expect(page.locator('.flower-pollinated')).toBeHidden();
  await expect(page.locator('.shelter-guide')).toBeHidden();
  const landed = await state();
  expect(landed.grassCover).toBe(1); expect(landed.rainExposure).toBe(0);
  expect(landed.phase).toBe('landed'); expect(landed.coldDrain).toBeLessThan(.35);
  await page.waitForTimeout(1000);
  const idle = await state();
  expect(idle.chill).toBeLessThan(landed.chill - .1);
  expect(idle.energy).toBeLessThan(landed.energy); // Shelter cannot make free energy.
  expect(idle.energy).toBeGreaterThan(landed.energy - .4);
  expect(idle.position).toEqual(landed.position);
  await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
  expect((await state()).position[0]).toBeGreaterThan(idle.position[0] + .2);
  await page.keyboard.press('Escape');
  const paused = await state(); await page.waitForTimeout(200);
  for (const key of ['energy', 'chill', 'dayElapsed']) expect((await state())[key]).toBe(paused[key]);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(25, 5, 50));
  await page.keyboard.press('e');
  await expect.poll(async () => (await state()).restAge).toBeGreaterThan(.5);
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/grass-shelter-1/ground-rest.png' });
  await expect.poll(async () => (await state()).resting).toBe(false);
  const rested = await state();
  expect(rested.energy).toBeGreaterThan(85); expect(rested.nectar).toBeLessThan(15);
  expect(rested.chill).toBe(0); expect(rested.onGround).toBe(true);
  expect(rested.supplies).toEqual(landed.supplies);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await page.keyboard.down('Space'); await page.waitForTimeout(1100); await page.keyboard.up('Space');
  const airborne = await state();
  expect(airborne.onGround).toBe(false); expect(airborne.phase).toBe('flying');
  expect(airborne.position[1]).toBeGreaterThan(rested.position[1] + 2);
  expect(airborne.grassCover).toBe(0); expect(airborne.rainExposure).toBeGreaterThan(.99);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('active-play');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.setPose([7, .9, 2], 0, -.1);
    window.__BEE_TEST__!.setDayProgress(.35);
  });
  await expect.poll(async () => (await state()).grassCover).toBe(1);
  await page.keyboard.press('e');
  expect((await state()).onGround).toBe(true);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('active-play'));
  expect((await state()).onGround).toBe(false);
  expect((await state()).flowerRain.leafBeads).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('artifacts/grass-shelter-1/metrics.json', JSON.stringify({ leaves, landed, idle, paused, rested, airborne, errors }, null, 2));
});
