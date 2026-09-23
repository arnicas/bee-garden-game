import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page) {
  await mkdir('artifacts/weather-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
}
async function shelter(page: Page) {
  await page.evaluate(() => window.__BEE_TEST__!.approachShelter(0));
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).underLeaf).toBe(0);
}

test('one shower warns, rains, clears and keeps shelters reachable with bounded rendering', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page); await freeze(page, true);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 5.6, 3.5], 0, -.14));
  const samples: Record<string, any> = {};
  for (const [name, day, stage] of [['before', .22, 'clear'], ['clouds', .27, 'approaching'], ['shower', .35, 'rain'], ['clearing', .42, 'clearing'], ['sunshine', .48, 'clear']] as const) {
    await page.evaluate(day => window.__BEE_TEST__!.setDayProgress(day), day);
    await expect.poll(async () => (await state(page)).weather.stage).toBe(stage);
    await expect(page.locator('.weather-note')).toHaveAttribute('data-weather-stage', stage);
    await page.screenshot({ path: `artifacts/weather-1/${name}.png` });
    samples[name] = await state(page);
    expect(samples[name].diagnostics.renderer.calls).toBeLessThan(300);
    expect(samples[name].diagnostics.renderer.triangles).toBeLessThan(750_000);
  }
  expect(samples.before.weather.rain).toBe(0);
  expect(samples.clouds.weather.cloudiness).toBeGreaterThan(0);
  expect(samples.shower.weather.rain).toBe(1);
  expect(samples.sunshine.weather.rain).toBe(0);
  await expect(page.locator('.shelter-guide')).toBeHidden();
  const coverage = await page.evaluate(() => {
    const leaves = window.__BEE_TEST__!.shelters();
    return window.__BEE_TEST__!.flowers().map(f => Math.min(...leaves.map(l => Math.hypot(f.center[0] - l.perch[0], f.center[1] - l.perch[1], f.center[2] - l.perch[2]))));
  });
  expect(Math.max(...coverage)).toBeLessThan(15);
  expect(errors).toEqual([]);
  await writeFile('artifacts/weather-1/stages.json', JSON.stringify({ samples, maxShelterDistance: Math.max(...coverage), errors }, null, 2));
});

test('E tucks under a leaf, rain stays outside, rest passes the shower, and Space flies out', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.34); window.__BEE_TEST__!.setCargo(30, 5, 55); });
  await expect.poll(async () => (await state(page)).audio.weather.rms).toBeGreaterThan(.00001);
  const outside = await state(page);
  await shelter(page);
  await expect(page.locator('.flower-note h2')).toHaveText('Under a leaf');
  await expect(page.locator('.flower-resources')).toBeHidden();
  await expect(page.locator('[data-action="rest"]')).toBeVisible();
  await expect.poll(async () => (await state(page)).audio.weather.sheltered).toBe(true);
  await expect.poll(async () => (await state(page)).audio.weather.leafGain).toBeGreaterThan(.001);
  const dry = await state(page);
  expect(dry.rainExposure).toBe(0);
  expect(dry.audio.weather.targets.air).toBeLessThan(outside.audio.weather.targets.air);
  expect(dry.nectarSurface.visible).toBe(false);
  await page.screenshot({ path: 'artifacts/weather-1/under-leaf.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/weather-1/under-leaf-small.png' });
  const restBox = await page.locator('[data-action="rest"]').boundingBox();
  expect(restBox!.y + restBox!.height).toBeLessThan(500);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeGreaterThan(.00001);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(.5);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.keyboard.press('w'); await page.keyboard.press('f');
  await page.waitForTimeout(250);
  expect((await state(page)).dayElapsed).toBe(paused.dayElapsed);
  expect((await state(page)).restAge).toBe(paused.restAge);
  expect((await state(page)).position).toEqual(paused.position);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect.poll(async () => (await state(page)).weather.stage).toBe('clear');
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const cleared = await state(page);
  expect(cleared.underLeaf).toBe(0);
  expect(cleared.energy).toBeGreaterThan(dry.energy + 34);
  expect(cleared.nectar).toBeLessThan(dry.nectar);
  expect(cleared.pollen).toBe(dry.pollen);
  expect(cleared.supplies).toEqual(dry.supplies);
  await page.screenshot({ path: 'artifacts/weather-1/cleared-under-leaf.png' });
  await page.keyboard.down('Space');
  await page.waitForTimeout(2000);
  await page.keyboard.up('Space');
  const flying = await state(page);
  expect(flying.phase).toBe('flying'); expect(flying.underLeaf).toBeUndefined();
  const leaf = await page.evaluate(() => window.__BEE_TEST__!.shelters()[0]);
  expect(Math.hypot(flying.position[0] - leaf.center[0], flying.position[2] - leaf.center[2])).toBeGreaterThan(leaf.radius + .32);
  await writeFile('artifacts/weather-1/shelter.json', JSON.stringify({ outside, dry, paused, cleared, flying }, null, 2));
});

test('entry goes around the canopy, Space cancels, and rain modestly affects flight', async ({ page }) => {
  await start(page); await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setDayProgress(.35);
    const leaf = window.__BEE_TEST__!.shelters()[0];
    window.__BEE_TEST__!.setPose([leaf.center[0], leaf.center[1] + 1.4, leaf.center[2] + .6], 0, -1.3);
  });
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  await page.keyboard.press('e');
  expect((await state(page)).shelterAssist).toBe(0);
  await page.keyboard.press('Space');
  expect((await state(page)).shelterAssist).toBeUndefined();
  await page.keyboard.press('e'); await freeze(page, false);
  const entry: any[] = [];
  for (let i = 0; i < 24; i++) {
    const s = await state(page);
    const leaf = await page.evaluate(() => window.__BEE_TEST__!.shelters()[0]);
    const radial = Math.hypot(s.position[0] - leaf.center[0], s.position[2] - leaf.center[2]);
    const clearance = s.position[1] - leaf.center[1];
    entry.push({ radial, clearance, underLeaf: s.underLeaf });
    expect(radial > leaf.radius + .32 || clearance > .3 || clearance < -.32).toBe(true);
    if (s.underLeaf === 0) break;
    await page.waitForTimeout(100);
  }
  expect((await state(page)).underLeaf).toBe(0);
  const flights: any[] = [];
  for (const day of [.1, .35]) {
    await freeze(page, true);
    await page.evaluate(day => { window.__THREE_GAME_TEST_HOOKS__!.setState('active-play'); window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true); window.__BEE_TEST__!.setDayProgress(day); window.__BEE_TEST__!.setCargo(0, 0, 100); window.__BEE_TEST__!.setPose([0, 8, 3.5], 0, 0); }, day);
    await page.keyboard.down('w'); await freeze(page, false);
    await page.waitForTimeout(1800);
    await freeze(page, true); await page.keyboard.up('w');
    flights.push(await state(page));
  }
  expect(flights[1].energy).toBeLessThan(flights[0].energy);
  expect(flights[1].position[2]).toBeGreaterThan(flights[0].position[2]);
  expect(flights[1].rainExposure).toBe(1);
  await writeFile('artifacts/weather-1/flight.json', JSON.stringify({ entry, flights }, null, 2));
});

test('reduced rain, return and restart preserve source and resource lifecycles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await shelter(page);
  await page.screenshot({ path: 'artifacts/weather-1/reduced-rain.png' });
  const before = await state(page);
  await freeze(page, true);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(90, 140, 100));
  expect((await state(page)).harvestReady).toBe(true);
  expect((await state(page)).canReturn).toBe(false);
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('landed');
  expect((await state(page)).underLeaf).toBe(0);
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('flying');
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  await expect.poll(async () => (await state(page)).cameraPosition[2]).toBe(30);
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  await freeze(page, false);
  expect((await state(page)).underLeaf).toBeUndefined();
  await expect.poll(async () => (await state(page)).weather.rain).toBe(0);
  await expect.poll(async () => (await state(page)).audio.weather.targets).toEqual({ air: 0, leaf: 0 });
  await expect.poll(async () => (await state(page)).audio.weather.gain).toBeLessThan(.00001);
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.underLeaf).toBeUndefined(); expect(reset.resting).toBe(false);
  expect(reset.weather.stage).toBe('clear'); expect(reset.weather.rain).toBe(0);
  expect(reset.nectar).toBe(0); expect(reset.dayProgress).toBeLessThan(.01);
  expect(reset.audio.loopSources).toBe(before.audio.loopSources);
  expect(reset.audio.retainedNodes).toBe(before.audio.retainedNodes);
});
