import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { flightWindAt } from '../src/wind';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);

test('gusts have calm intervals, gradual approaches, shifting direction and low shelter', () => {
  const samples = Array.from({ length: 600 }, (_, t) => flightWindAt(0, 8, 0, t));
  const speeds = samples.map(w => Math.hypot(w.x, w.z));
  expect(speeds.filter(s => s < .5).length).toBeGreaterThan(150);
  expect(speeds.filter(s => s > 5).length).toBeGreaterThan(100);
  expect(Math.max(...speeds)).toBeLessThan(7);
  expect(Math.max(...speeds.slice(1).map((s, i) => Math.abs(s - speeds[i])))).toBeLessThan(.9);
  // Different fronts can carry the bee toward substantially different places.
  expect(samples[26].clone().normalize().dot(samples[190].clone().normalize())).toBeLessThan(.6);
  expect(flightWindAt(0, 3, 0, 26).length()).toBeLessThan(1.6);
});

test('the sun carries the current arrow, and strong flight costs more than drifting or flying low', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/gusts-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await freeze(page, true);
  await expect(page.locator('.wind-readout')).toHaveCount(0);
  const arrow = page.locator('[data-wind-arrow]');
  for (const [name, t, day] of [['calm', 0, .12], ['gust', 26, .5], ['rain-gust', 26, .35]] as const) {
    await page.evaluate(({ t, day }) => {
      window.__BEE_TEST__!.setPose([0, 8, 0], 0, -.15);
      window.__BEE_TEST__!.setDayProgress(day);
      window.__BEE_TEST__!.setWindTime(t);
    }, { t, day });
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-day-wind]')!.getAttribute('transform'))).toBe(`translate(${(24 + day * 432).toFixed(2)} ${(43 - 72 * day * (1 - day) + (name === 'rain-gust' ? 45 : 32)).toFixed(2)})`);
    await expect(page.locator('.day-timeline')).toHaveAttribute('aria-label', name === 'calm' ? /Light air/ : /Strong gust/);
    await page.screenshot({ path: `artifacts/gusts-1/${name}.png` });
    await page.locator('.day-timeline').screenshot({ path: `artifacts/gusts-1/${name}-strip.png` });
  }
  const facing = await arrow.getAttribute('transform');
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 8, 0], Math.PI / 2, -.15));
  await expect(arrow).not.toHaveAttribute('transform', facing!);
  const turned = await arrow.getAttribute('transform');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await arrow.getAttribute('transform')).toBe(turned);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect(page.locator('.day-timeline')).toHaveCSS('opacity', '1');
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/gusts-1/laptop.png' });
  const bounds = await page.locator('.day-timeline').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(132);

  const measurements: Record<string, any> = {};
  for (const [name, t, height, steering, downwind] of [
    ['calm', 0, 8, true, false], ['headwind', 26, 8, true, false],
    ['tailwind', 26, 8, true, true], ['drifting', 26, 8, false, false],
    ['low', 26, 3, true, false],
  ] as const) {
    await freeze(page, true);
    const w = flightWindAt(0, height, 0, t);
    const yaw = Math.atan2(w.x, w.z) + (downwind ? Math.PI : 0);
    await page.evaluate(({ t, height, yaw, downwind }) => {
      window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start');
      window.__BEE_TEST__!.setPose(downwind ? [-4, height, -12] : [0, height, 0], yaw, 0);
      window.__BEE_TEST__!.setCargo(0, 0, 100);
      window.__BEE_TEST__!.setWindTime(t);
    }, { t, height, yaw, downwind });
    if (steering) await page.keyboard.down('w');
    await freeze(page, false);
    await expect.poll(async () => (await state(page)).elapsed, { intervals: [50] }).toBeGreaterThan(1);
    const before = await state(page);
    await expect.poll(async () => (await state(page)).elapsed, { intervals: [50] }).toBeGreaterThan(before.elapsed + 2);
    await freeze(page, true);
    const after = await state(page);
    if (steering) await page.keyboard.up('w');
    expect(after.phase).toBe('flying');
    expect(Math.hypot(after.position[0], after.position[2])).toBeLessThan(30);
    measurements[name] = { before, after, rate: (before.energy - after.energy) / (after.elapsed - before.elapsed) };
  }
  await writeFile('artifacts/gusts-1/metrics.json', JSON.stringify({ measurements, errors }, null, 2));
  expect(measurements.headwind.rate).toBeGreaterThan(measurements.calm.rate + .8);
  expect(measurements.headwind.rate).toBeGreaterThan(measurements.tailwind.rate + .4);
  expect(measurements.drifting.rate).toBeLessThan(1.1);
  expect(measurements.low.after.windDrain).toBe(0);
  expect(measurements.low.rate).toBeLessThan(measurements.headwind.rate - .8);
  expect(errors).toEqual([]);
});
