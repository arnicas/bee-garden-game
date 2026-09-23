import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
test('ground paint reads near the grass and from above, follows daylight and survives meadow replacement', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  const folder = `artifacts/ground-paint-1/${process.env.BEE_GROUND_CAPTURE === 'before' ? 'before' : 'after'}`;
  await mkdir(folder, { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
    window.__BEE_TEST__!.setDayProgress(.12);
  });
  const views = [];
  for (const [name, position, pitch, day] of [
    ['near-soil', [0, 1, 2], -1.15, .12],
    ['grass-tops', [0, 3.2, 2], -1.3, .12],
    ['meadow', [0, 8, 4], -.7, .12],
    ['rain', [0, 1, 2], -1.15, .35],
    ['evening', [0, 1, 2], -1.15, .86],
  ] as const) {
    await page.evaluate(({ position, pitch, day }) => {
      window.__BEE_TEST__!.setDayProgress(day);
      window.__BEE_TEST__!.setPose([...position], 0, pitch);
    }, { position, pitch, day });
    await expect.poll(() => page.evaluate(() => (window.__BEE_TEST__!.snapshot() as any).dayProgress)).toBeCloseTo(day, 4);
    await page.screenshot({ path: `${folder}/${name}.png` });
    const snapshot = await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as any;
    expect(snapshot.diagnostics.renderer.calls).toBeLessThan(300);
    expect(snapshot.diagnostics.renderer.triangles).toBeLessThan(750_000);
    views.push({ name, renderer: snapshot.diagnostics.renderer, frameMs: snapshot.frameMs });
  }
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.12));
  await page.screenshot({ path: `${folder}/laptop.png` });
  // A real low flight exposes temporal aliasing that still captures can hide.
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 2, 2], 0, -.45);
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(false);
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false);
  });
  await page.keyboard.down('w');
  await page.waitForTimeout(2500);
  await page.keyboard.up('w');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
  await page.screenshot({ path: `${folder}/low-flight.png` });
  const textures: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.seed(481));
    await page.waitForTimeout(150);
    textures.push(await page.evaluate(() => (window.__BEE_TEST__!.snapshot() as any).diagnostics.renderer.textures));
  }
  expect(textures[2]).toBe(textures[0]);
  expect(errors).toEqual([]);
  await writeFile(`${folder}/metrics.json`, JSON.stringify({ views, textures, errors }, null, 2));
});
