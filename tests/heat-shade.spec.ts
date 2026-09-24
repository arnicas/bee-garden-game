import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { startFlyingFixture, leaveWelcome } from './support/start';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page) {
  await mkdir('artifacts/heat-shade-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
}
async function approach(page: Page) {
  await page.evaluate(() => window.__BEE_TEST__!.approachShelter(0));
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
}

test('sun heats an exposed flower, wakes the quiet UI, and real E shade/rest cools without free food', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(0);
  await freeze(page, true);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(0, 5, 100); window.__BEE_TEST__!.setQuietTime(12); });
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '0');
  const before = await state(page);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.55));
  await freeze(page, false);
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-text="weather"]')).toHaveText('Hot sun');
  await expect(page.locator('[data-text="shelter-label"]')).toHaveText('Cool shade');
  await expect.poll(async () => (await state(page)).heat, { timeout: 15000 }).toBeGreaterThan(.34);
  const hot = await state(page);
  expect(hot.heatExposure).toBe(1); expect(hot.shade).toBe(0);
  // Orange pigment is already visible during the low-cost reaction window.
  expect(hot.energy).toBeLessThan(before.energy);
  expect(hot.energy).toBeGreaterThan(before.energy - 2);
  expect(hot.heatDrain).toBeLessThan(.12);
  expect(hot.chill).toBe(0); expect(hot.coldDrain).toBe(0);
  expect(hot.supplies).toEqual(before.supplies);
  expect(hot.energyWash.warmth).toBe(1);
  expect(hot.quietFade).toBe(0);
  await page.screenshot({ path: 'artifacts/heat-shade-1/flower-too-hot.png' });
  // With modest fuel, there is time to react and fly after the warning.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 5, 35));
  await page.keyboard.down('Space'); await page.keyboard.down('w');
  const reacting = await state(page);
  await page.waitForTimeout(6000);
  await page.keyboard.up('w'); await page.keyboard.up('Space');
  const afterReaction = await state(page);
  expect(afterReaction.phase).toBe('flying');
  expect(afterReaction.energy).toBeGreaterThan(reacting.energy - 22);
  expect(afterReaction.heatDrain).toBeLessThan(1);
  expect(afterReaction.energyWash.visible).toBe(true);
  await mkdir('artifacts/weather-reaction-1', { recursive: true });
  await page.screenshot({ path: 'artifacts/weather-reaction-1/heat-after-warning.png' });
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(250);
  for (const field of ['heat', 'energy', 'dayElapsed', 'heatDrain']) expect((await state(page))[field]).toBe(paused[field]);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await approach(page);
  expect((await state(page)).leafTopTarget).toBe(false);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).underLeaf).toBe(0);
  await expect.poll(async () => (await state(page)).heatExposure).toBe(0);
  const covered = await state(page);
  expect(covered.shade).toBe(1); expect(covered.heatDrain).toBeLessThan(.15);
  expect(covered.onLeaf).toBeUndefined();
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(20, 5, 55));
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(.3);
  await page.screenshot({ path: 'artifacts/heat-shade-1/cooling-under-leaf.png' });
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  await freeze(page, true);
  const cooled = await state(page);
  expect(cooled.heat).toBe(0); expect(cooled.heatDrain).toBe(0);
  expect(cooled.energy).toBeGreaterThan(89); expect(cooled.nectar).toBeLessThan(10);
  expect(cooled.energyWash.visible).toBe(false);
  expect(cooled.supplies).toEqual(before.supplies);
  await page.screenshot({ path: 'artifacts/heat-shade-1/cooled-under-leaf.png' });
  expect(errors).toEqual([]);
  await writeFile('artifacts/heat-shade-1/exposure-recovery.json', JSON.stringify({ before, hot, reacting, afterReaction, paused, covered, cooled, errors }, null, 2));
});

test('hot weather interrupts a leaf-top rest and E routes underneath, while mild weather still offers the top', async ({ page }) => {
  await start(page); await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setDayProgress(.1);
    const leaf = window.__BEE_TEST__!.shelters()[0];
    window.__BEE_TEST__!.setPose([leaf.center[0], leaf.center[1] + 1.5, leaf.center[2] + .8], 0, -.9);
  });
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  expect((await state(page)).leafTopTarget).toBe(true);
  await page.keyboard.press('e'); await freeze(page, false);
  await expect.poll(async () => (await state(page)).onLeaf).toBe(0);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.455));
  await page.keyboard.press('e');
  expect((await state(page)).resting).toBe(true);
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const exposed = await state(page);
  expect(exposed.onLeaf).toBe(0); expect(exposed.needsShade).toBe(true);
  expect(exposed.weather.rain).toBe(0); expect(exposed.shade).toBe(0);
  await expect(page.locator('[data-text="hint"]')).toContainText('tuck into shade');
  await expect(page.locator('[data-text="interaction"]')).toHaveText('');
  await page.screenshot({ path: 'artifacts/heat-shade-1/sun-on-leaf-top.png' });
  await page.keyboard.press('e');
  expect((await state(page)).leafTopTarget).toBe(false);
  await expect.poll(async () => (await state(page)).underLeaf).toBe(0);
  const { under, perch } = await page.evaluate(() => ({ under: window.__BEE_TEST__!.snapshot() as Record<string, any>, perch: window.__BEE_TEST__!.shelters()[0].perch }));
  expect(under.position).toEqual(perch);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(1);
  expect((await state(page)).heat).toBe(0);
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/heat-shade-1/shade-rest-1024.png' });
  await page.keyboard.down('Space'); await page.waitForTimeout(1700); await page.keyboard.up('Space');
  expect((await state(page)).phase).toBe('flying');
  expect((await state(page)).underLeaf).toBeUndefined();
  await freeze(page, true);
  await page.evaluate(() => { window.__BEE_TEST__!.setHeat(0); window.__BEE_TEST__!.setDayProgress(.84); });
  await approach(page);
  expect((await state(page)).weather.sunHeat).toBe(0);
  expect((await state(page)).leafTopTarget).toBe(true);
  await writeFile('artifacts/heat-shade-1/leaf-route.json', JSON.stringify({ exposed, under }, null, 2));
});

test('dense grass cools without creating energy, climbing exposes the bee, and rain extinguishes heat', async ({ page }) => {
  await start(page); await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([7, .9, 2], 0, -.1);
    window.__BEE_TEST__!.setDayProgress(.55);
    window.__BEE_TEST__!.setCargo(0, 5, 70);
    window.__BEE_TEST__!.setHeat(.85);
  });
  await expect.poll(async () => (await state(page)).grassCover).toBe(1);
  await page.keyboard.press('e');
  expect((await state(page)).onGround).toBe(true);
  const before = await state(page);
  await freeze(page, false); await page.waitForTimeout(1500);
  const idle = await state(page);
  expect(idle.shade).toBe(1); expect(idle.heatExposure).toBe(0);
  expect(idle.heat).toBeLessThan(before.heat - .2);
  expect(idle.energy).toBeLessThan(before.energy);
  expect(idle.energy).toBeGreaterThan(before.energy - .4);
  await page.screenshot({ path: 'artifacts/heat-shade-1/cooling-in-grass.png' });
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(.5);
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const rested = await state(page);
  expect(rested.heat).toBe(0); expect(rested.energy).toBeLessThan(idle.energy);
  expect(rested.energy).toBeGreaterThan(idle.energy - .5); expect(rested.nectar).toBe(0);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.55));
  await page.keyboard.down('Space'); await page.waitForTimeout(1700); await page.keyboard.up('Space');
  const flying = await state(page);
  expect(flying.onGround).toBe(false); expect(flying.heatExposure).toBe(1);
  expect(flying.heat).toBeGreaterThan(0);
  await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 8, 3.5]);
    window.__BEE_TEST__!.setDayProgress(.35);
    window.__BEE_TEST__!.setHeat(.7);
    window.__BEE_TEST__!.setCargo(0, 5, 100);
  });
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).heat).toBe(0);
  const rainy = await state(page);
  expect(rainy.weather.sunHeat).toBe(0); expect(rainy.heatDrain).toBe(0);
  expect(rainy.rainExposure).toBe(1); expect(rainy.chill).toBeGreaterThan(.1);
  expect(rainy.energyWash.warmth).toBe(0);
  await expect(page.locator('[data-text="weather"]')).toHaveText('Raining');
  await writeFile('artifacts/heat-shade-1/grass-and-rain.json', JSON.stringify({ before, idle, rested, flying, rainy }, null, 2));
});

test('orange pigment uses the existing draw and heat exhaustion supports pause, reduced motion and retry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('landed');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.setDayProgress(.55);
  });
  const pixels = async () => {
    await page.locator('#ui').evaluate(el => { el.style.visibility = 'hidden'; });
    const png = PNG.sync.read(await page.locator('#game-canvas').screenshot());
    await page.locator('#ui').evaluate(el => { el.style.visibility = ''; });
    return png;
  };
  const baseline = await pixels(), healthy = await state(page);
  await page.evaluate(() => window.__BEE_TEST__!.setHeat(.85));
  await expect.poll(async () => (await state(page)).energyWash.warmth).toBe(1);
  const orange = await pixels(), hot = await state(page);
  const shifts: Record<string, number> = {};
  for (const [name, from, to] of [['left', .01, .12], ['right', .88, .99], ['center', .42, .58]] as const) {
    let total = 0, count = 0;
    for (let y = Math.floor(baseline.height * .3); y < baseline.height * .7; y++) for (let x = Math.floor(baseline.width * from); x < baseline.width * to; x++) {
      const i = (y * baseline.width + x) * 4;
      total += (orange.data[i] - orange.data[i + 2]) - (baseline.data[i] - baseline.data[i + 2]); count++;
    }
    shifts[name] = total / count;
  }
  expect(shifts.left).toBeGreaterThan(20); expect(shifts.right).toBeGreaterThan(20);
  expect(Math.abs(shifts.center)).toBeLessThan(.05);
  expect(hot.diagnostics.renderer.calls - healthy.diagnostics.renderer.calls).toBe(1);
  expect(hot.diagnostics.renderer.triangles - healthy.diagnostics.renderer.triangles).toBe(2);
  expect(hot.energyWash.textureBytes).toBe(256 * 256 * 4);
  await page.screenshot({ path: 'artifacts/heat-shade-1/orange-warning.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/heat-shade-1/orange-warning-1024.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 12, 2));
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  const failing = await state(page);
  expect(failing.energy).toBe(0); expect(failing.lossFromHeat).toBe(true);
  expect(failing.lossFromRain).toBe(false);
  await page.keyboard.press('Escape');
  const paused = await state(page); await page.waitForTimeout(250);
  expect((await state(page)).lossProgress).toBe(paused.lossProgress);
  expect((await state(page)).energyWash).toEqual(paused.energyWash);
  expect((await state(page)).cameraPosition).toEqual(paused.cameraPosition);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('lost');
  await expect(page.locator('[data-text="result-eyebrow"]')).toHaveText('TOO MUCH SUN');
  await expect(page.locator('[data-text="result-description"]')).toContainText('cool beneath a leaf');
  const lost = await state(page);
  expect(lost.pollen).toBe(12); expect(lost.nectar).toBe(0);
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
  await page.screenshot({ path: 'artifacts/heat-shade-1/heat-exhaustion.png' });
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.heat).toBe(0); expect(reset.heatDrain).toBe(0);
  expect(reset.weather.sunHeat).toBe(0); expect(reset.lossFromHeat).toBe(false);
  expect(reset.energyWash.visible).toBe(false);
  expect(reset.audio.loopSources).toBe(lost.audio.loopSources);
  expect(reset.audio.retainedNodes).toBe(lost.audio.retainedNodes);
  await writeFile('artifacts/heat-shade-1/orange-and-loss.json', JSON.stringify({ hot, shifts, failing, paused, lost, reset }, null, 2));
});
