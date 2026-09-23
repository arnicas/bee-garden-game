import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const nextFrame = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function canvasPixels(page: Page) {
  await page.locator('#ui').evaluate(el => { el.style.visibility = 'hidden'; });
  const png = PNG.sync.read(await page.locator('#game-canvas').screenshot());
  await page.locator('#ui').evaluate(el => { el.style.visibility = ''; });
  return png;
}
function changes(before: PNG, after: PNG, from: number, to: number) {
  let delta = 0, blueShift = 0, count = 0;
  for (let y = Math.floor(before.height * .3); y < before.height * .7; y++) {
    for (let x = Math.floor(before.width * from); x < before.width * to; x++) {
      const i = (y * before.width + x) * 4;
      delta += (Math.abs(after.data[i] - before.data[i]) + Math.abs(after.data[i + 1] - before.data[i + 1]) + Math.abs(after.data[i + 2] - before.data[i + 2])) / 3;
      blueShift += (after.data[i + 2] - after.data[i]) - (before.data[i + 2] - before.data[i]);
      count++;
    }
  }
  return { delta: delta / count, blueShift: blueShift / count };
}

test('blue pigment grows inward with low energy, preserves the center, and costs one draw', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/energy-wash-1', { recursive: true });
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__THREE_GAME_TEST_HOOKS__);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
    window.__THREE_GAME_TEST_HOOKS__!.setState('landed');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
  });
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  const healthy = await state(page), baseline = await canvasPixels(page);
  expect(healthy.energyWash.visible).toBe(false);
  const samples = [];
  for (const energy of [30, 20, 8, 2]) {
    await page.evaluate(energy => window.__BEE_TEST__!.setCargo(0, 5, energy), energy);
    await nextFrame(page);
    const current = await state(page), painted = await canvasPixels(page);
    const left = changes(baseline, painted, .01, .12), right = changes(baseline, painted, .88, .99);
    const center = changes(baseline, painted, .42, .58);
    expect(left.blueShift).toBeGreaterThan(7); expect(right.blueShift).toBeGreaterThan(7);
    expect(center.delta).toBeLessThan(.05);
    expect(current.diagnostics.renderer.calls - healthy.diagnostics.renderer.calls).toBe(1);
    expect(current.diagnostics.renderer.triangles - healthy.diagnostics.renderer.triangles).toBe(2);
    expect(current.energyWash.textureBytes).toBe(256 * 256 * 4);
    if (samples.length) expect(left.delta + right.delta).toBeGreaterThan(samples.at(-1)!.left.delta + samples.at(-1)!.right.delta);
    samples.push({ energy, left, right, center, wash: current.energyWash, renderer: current.diagnostics.renderer });
    await page.screenshot({ path: `artifacts/energy-wash-1/energy-${energy}.png` });
  }
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(250);
  expect((await state(page)).energyWash).toEqual(paused.energyWash);
  await page.getByRole('button', { name: 'Back to the breeze' }).click();
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/energy-wash-1/critical-1024.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 5, 100));
  await nextFrame(page);
  expect((await state(page)).energyWash.visible).toBe(false);
  await page.evaluate(() => window.__BEE_TEST__!.setChill(.8));
  await nextFrame(page);
  expect((await state(page)).energyWash.visible).toBe(true);
  await page.screenshot({ path: 'artifacts/energy-wash-1/cold-with-full-energy.png' });
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  expect((await state(page)).energyWash.visible).toBe(false);
  expect(errors).toEqual([]);
  await writeFile('artifacts/energy-wash-1/metrics.json', JSON.stringify({ healthy: healthy.diagnostics.renderer, samples, errors }, null, 2));
});
