import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
async function start(page: Page) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
}
async function freeze(page: Page, value: boolean) { await page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value); }
async function seek(page: Page, age: number) {
  await page.evaluate(age => window.__BEE_TEST__!.setEndingTime(age), age);
  await expect.poll(async () => (await state(page)).returnAge).toBe(age);
  await page.waitForTimeout(120);
}

test('single day light, aerial detail, homecoming, pause, mute, delivery and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await mkdir('artifacts/day-ending-1', { recursive: true });
  await start(page); await freeze(page, true);
  const captures: Record<string, any> = {};
  for (const [label, day] of [['morning', 0], ['afternoon', .48], ['late-day', .9]] as const) {
    await page.evaluate(value => window.__BEE_TEST__!.setDayProgress(value), day);
    await expect.poll(async () => (await state(page)).dayProgress).toBeCloseTo(day, 4);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/day-ending-1/${label}.png` });
    captures[label] = await state(page);
  }
  // High camera uses cheaper geometry even outside the cinematic; descending restores it.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0,12,3.5]));
  await page.waitForTimeout(150);
  captures.aerial = await state(page);
  const farGrains = await page.evaluate(() => window.__BEE_TEST__!.flowers()[0].visiblePollen);
  expect(farGrains).toBeLessThan(10);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0,4.6,3.5]));
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.flowers()[0].visiblePollen)).toBeGreaterThan(100);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(100, 140, 90); window.__BEE_TEST__!.setDayProgress(.48); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await expect.poll(async () => (await state(page)).cameraPosition[2]).toBe(30);
  const before = await state(page);
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  const accepted = await state(page);
  await expect(page.getByRole('button', { name: 'Skip to totals', exact: true })).toBeVisible();
  await seek(page, 4.8);
  await expect.poll(async () => (await state(page)).ending.stage).toBe('meadow');
  captures.meadow = await state(page);
  expect(captures.meadow.ending.workers).toBe(36);
  expect(captures.meadow.ending.butterflies).toBe(8);
  expect(captures.meadow.diagnostics.renderer.triangles).toBeLessThan(750_000);
  expect(captures.meadow.diagnostics.renderer.calls).toBeLessThan(300);
  await page.screenshot({ path: 'artifacts/day-ending-1/meadow.png' });
  await seek(page, 8.8);
  await expect.poll(async () => (await state(page)).ending.stage).toBe('home');
  captures.home = await state(page);
  expect(captures.home.ending.hiveVisitors).toBe(2);
  expect(captures.home.ending.hiveLanded).toBe(2);
  expect(captures.home.ending.workerDraws).toBe(2);
  await page.screenshot({ path: 'artifacts/day-ending-1/home.png' });
  await seek(page, 9.4);
  captures.dance = await state(page);
  expect(captures.dance.ending.visitorPositions).not.toEqual(captures.home.ending.visitorPositions);
  await page.screenshot({ path: 'artifacts/day-ending-1/hive-dance.png' });
  // Pausing a return freezes the camera and the day, not only the menu.
  await seek(page, 10.6);
  await freeze(page, false);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  expect(paused.phase).toBe('paused');
  await page.waitForTimeout(350);
  expect((await state(page)).returnAge).toBe(paused.returnAge);
  expect((await state(page)).dayProgress).toBe(paused.dayProgress);
  expect((await state(page)).cameraPosition).toEqual(paused.cameraPosition);
  expect((await state(page)).ending.visitorPositions).toEqual(paused.ending.visitorPositions);
  expect((await state(page)).audio.ending.active).toBe(true);
  expect((await state(page)).audio.ending.fade).toBe(paused.audio.ending.fade);
  expect((await state(page)).windEffects.enabled).toBe(false);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).phase, { timeout: 6000 }).toBe('won');
  const delivered = await state(page);
  expect(delivered.nectar).toBeCloseTo(before.nectar - accepted.returnFuel, 8);
  expect(delivered.pollen).toBe(140);
  expect(delivered.dayProgress).toBe(1);
  await expect(page.locator('[data-text="result-nectar"]')).toHaveText(`${Math.floor(delivered.nectar + 1e-6)}%`);
  await page.screenshot({ path: 'artifacts/day-ending-1/totals.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/day-ending-1/totals-small.png' });
  const restart = page.locator('.result-page [data-action="restart"]');
  const box = await restart.boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(600);
  await restart.click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.dayProgress).toBeLessThan(.01); expect(reset.ending.active).toBe(false);
  expect(reset.nectar).toBe(0); expect(reset.pollen).toBe(0);
  expect(reset.audio.loopSources).toBe(delivered.audio.loopSources);
  expect(errors).toEqual([]);
  await writeFile('artifacts/day-ending-1/metrics.json', JSON.stringify({ captures, accepted, delivered, reset, errors }, null, 2));
});

test('the full ending moves continuously from the meadow edge to home within a bounded render budget', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { window.__BEE_TEST__!.approachFlower(2); window.__BEE_TEST__!.setCargo(100,140,90); });
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).phase).toBe('landed');
  expect((await state(page)).harvestReady).toBe(true);
  expect((await state(page)).canReturn).toBe(false);
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  // The flight to the edge has separate real-input coverage. Freeze this
  // cinematic fixture so wind cannot carry it back inside before R arrives.
  await freeze(page, true);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  await expect.poll(async () => (await state(page)).cameraPosition[2]).toBe(30);
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  await freeze(page, false);
  const samples: any[] = [];
  const deadline = Date.now() + 18_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    samples.push({ age: s.returnAge, camera: s.cameraPosition, stage: s.ending.stage, fade: s.ending.fade, renderer: s.diagnostics.renderer, audio: s.audio, frameMs: s.frameMs });
    if (s.phase === 'won') break;
    await page.waitForTimeout(200);
  }
  expect((await state(page)).phase).toBe('won');
  expect(samples.some(s => s.stage === 'meadow' && s.camera[1] > 11)).toBe(true);
  expect(samples.some(s => s.stage === 'home')).toBe(true);
  expect(Math.max(...samples.map(s => s.renderer.triangles))).toBeLessThan(750_000);
  expect(Math.max(...samples.map(s => s.renderer.calls))).toBeLessThan(300);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i-1], b = samples[i];
    if (a.stage === b.stage) expect(Math.hypot(...b.camera.map((v: number, j: number) => v-a.camera[j]))).toBeLessThan(4);
  }
  await writeFile('artifacts/day-ending-1/motion-metrics.json', JSON.stringify(samples, null, 2));
});

test('return can be skipped with Space or a click and reduced motion uses still views', async ({ page }) => {
  await start(page);
  for (const mode of ['space', 'click', 'reduced'] as const) {
    await freeze(page, true);
    await page.evaluate(() => { window.__BEE_TEST__!.setCargo(100, 140, 90); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
    if (mode === 'reduced') await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));
    await expect.poll(async () => (await state(page)).cameraPosition[2]).toBe(30);
    await page.keyboard.press('r');
    await expect.poll(async () => (await state(page)).phase).toBe('returning');
    const before = await state(page);
    if (mode === 'space') await page.keyboard.press('Space');
    else if (mode === 'click') await page.getByRole('button', { name: 'Skip to totals', exact: true }).click();
    else {
      await seek(page, .2); const first = await state(page);
      await seek(page, 1.1); expect((await state(page)).cameraPosition).toEqual(first.cameraPosition);
      await page.screenshot({ path: 'artifacts/day-ending-1/reduced-meadow.png' });
      await seek(page, 2.1); const home = await state(page);
      await seek(page, 2.6); expect((await state(page)).cameraPosition).toEqual(home.cameraPosition);
      expect(home.ending.hiveLanded).toBe(2);
      expect((await state(page)).ending.visitorPositions).toEqual(home.ending.visitorPositions);
      await freeze(page, false);
    }
    await expect.poll(async () => (await state(page)).phase).toBe('won');
    expect((await state(page)).nectar).toBeCloseTo(before.nectar - before.returnFuel, 8);
    await page.locator('.result-page [data-action="restart"]').click();
    await leaveWelcome(page);
    await expect.poll(async () => (await state(page)).phase).toBe('flying');
  }
});
