import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { flightWindAt, MEADOW_EDGE_START } from '../src/wind';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const snapshot = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const radius = (state: Record<string, any>) => Math.hypot(state.position[0], state.position[2]);

test('outer gust points inward all around the meadow at low and high flight heights', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    for (const height of [.6, 4.5, 13]) for (let time = 0; time < 30; time += .5) {
      const wind = flightWindAt(outward.x * 37, height, outward.z * 37, time);
      // Even full forward thrust cannot defeat the outermost current.
      expect(wind.dot(outward)).toBeLessThan(-3.6);
    }
  }
});

test('the grass-only edge carries outward flight back smoothly and remains escapable inward', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/meadow-edge-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('windy');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.setPose([35, 4.3, 0], -Math.PI / 2, -.15, [4, 0, 0]);
  });
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  expect(flowers).toHaveLength(72);
  for (const f of flowers) {
    // Include the maximum authored head sweep and its entire petal radius.
    expect(Math.hypot(f.base[0], f.base[2]) + f.height * .28 + f.radius).toBeLessThan(MEADOW_EDGE_START);
  }
  await expect(page.locator('[data-text="wind"]')).toContainText('meadow’s edge');
  await expect(page.locator('[data-text="hint"]')).toContainText('carrying you back');
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'artifacts/meadow-edge-1/grass-only-outward.png' });
  const start = await snapshot(page), samples = [start];
  await page.keyboard.down('w');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  while (samples.at(-1)!.elapsed < start.elapsed + 3) {
    await page.waitForTimeout(90);
    samples.push(await snapshot(page));
  }
  await page.keyboard.up('w');
  const pushed = await snapshot(page);
  // Inertia can cross the old radius; there is no positional clamp or teleport.
  expect(Math.max(...samples.map(radius))).toBeGreaterThan(35.05);
  expect(radius(pushed)).toBeLessThan(34.5);
  expect(samples.some(s => s.velocity[0] < -1)).toBe(true);
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].elapsed - samples[i - 1].elapsed;
    expect(new Vector3().fromArray(samples[i].position).distanceTo(new Vector3().fromArray(samples[i - 1].position))).toBeLessThan(15 * dt + .01);
  }

  // Release the controls to ride the gust, then steer home with S while facing out.
  await expect.poll(async () => (await snapshot(page)).elapsed).toBeGreaterThan(pushed.elapsed + 1.5);
  const riding = await snapshot(page);
  expect(radius(riding)).toBeLessThan(radius(pushed));
  await page.keyboard.down('s');
  await expect.poll(async () => radius(await snapshot(page))).toBeLessThan(29.5);
  await page.keyboard.up('s');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
  const returned = await snapshot(page);
  await page.screenshot({ path: 'artifacts/meadow-edge-1/after-the-gust.png' });
  await page.evaluate(() => {
    const state = window.__BEE_TEST__!.snapshot();
    window.__BEE_TEST__!.setPose(state.position as [number, number, number], Math.PI / 2, -.15);
  });
  await page.screenshot({ path: 'artifacts/meadow-edge-1/flowers-toward-the-center.png' });

  // Full cargo, low flight, and Shift must not bypass the exposed perimeter.
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('windy');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.setPose([-37, 1.2, 0], Math.PI / 2, -.15);
    window.__BEE_TEST__!.setCargo(90, 90);
  });
  const lowStart = await snapshot(page);
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect.poll(async () => (await snapshot(page)).elapsed).toBeGreaterThan(lowStart.elapsed + 2);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  const lowReturned = await snapshot(page);
  expect(radius(lowReturned)).toBeLessThan(35);
  await page.keyboard.press('Escape');
  const paused = await snapshot(page);
  await page.waitForTimeout(150);
  expect((await snapshot(page)).position).toEqual(paused.position);
  expect(errors).toEqual([]);
  const metrics = { start, samples, pushed, riding, returned, lowStart, lowReturned, errors };
  await writeFile('artifacts/meadow-edge-1/motion-metrics.json', JSON.stringify(metrics, null, 2));
  await testInfo.attach('edge-gust-motion', { body: JSON.stringify(metrics), contentType: 'application/json' });
});
