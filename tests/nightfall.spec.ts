import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const folder = 'artifacts/nightfall-1';
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page) {
  await mkdir(folder, { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('landed'));
}
async function readFromResults(page: Page, phase: string) {
  const before = await state(page);
  const opener = page.getByRole('button', { name: 'About bees', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Small wonders.' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.result-page')).toBeHidden();
  await expect(page.locator('.pause-page')).toBeHidden();
  await expect(page.locator('[data-facts-return]')).toHaveText('Day’s totals');
  await dialog.getByRole('tab', { name: 'Sun & shade', exact: true }).click();
  for (const key of ['w', 'f', 'Space', 'r', 'q', 'm']) await page.keyboard.press(key);
  const reading = await state(page);
  for (const key of ['phase', 'energy', 'nectar', 'pollen', 'elapsed', 'dayElapsed', 'resultScore']) expect(reading[key]).toEqual(before[key]);
  await page.screenshot({ path: `${folder}/${phase}-bee-info.png` });
  await page.keyboard.down('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.down('Escape');
  expect((await state(page)).phase).toBe(phase);
  await page.keyboard.up('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('.result-page')).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  // The mouse/back button follows the same return path.
  await opener.click();
  await page.locator('[data-action="facts-close"]').click();
  await expect(opener).toBeFocused();
}

test('an unfinished day closes in charcoal, pauses, keeps its harvest and opens bee notes from results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page);
  await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 6, 3.5], 0, -.2);
    window.__BEE_TEST__!.setCargo(12, 80, 28); // An existing blue hunger cue must be replaced.
    window.__BEE_TEST__!.setDayProgress(1);
  });
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  const beginning = await state(page);
  expect(beginning.lossFromNight).toBe(true);
  expect(beginning.lossFromRain).toBe(false);
  expect(beginning.lossFromHeat).toBe(false);
  expect(beginning.energy).toBeGreaterThan(0);
  await expect.poll(async () => (await state(page)).lossProgress).toBeGreaterThan(.25);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(250);
  const held = await state(page);
  expect(held.lossProgress).toBe(paused.lossProgress);
  expect(held.energyWash).toEqual(paused.energyWash);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect.poll(async () => (await state(page)).lossProgress).toBeGreaterThan(.47);
  await freeze(page, true);
  const middle = await state(page);
  expect(middle.energyWash.ink).toBe('181316');
  expect(middle.energyWash.nightfall).toBeGreaterThan(.47);
  expect(middle.energyWash.draws).toBe(1);
  await expect(page.locator('.loss-veil')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: `${folder}/charcoal-clouds.png` });
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).lossProgress).toBeGreaterThan(.86);
  await freeze(page, true);
  await page.screenshot({ path: `${folder}/last-light.png` });
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).phase).toBe('lost');
  const lost = await state(page);
  expect(lost.energyWash.nightfall).toBe(1);
  expect(lost.pollen).toBe(beginning.pollen);
  expect(lost.nectar).toBe(beginning.nectar);
  expect(lost.energy).toBe(beginning.energy);
  await expect(page.locator('[data-text="result-title"]')).toHaveText('Night in the meadow.');
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
  await page.screenshot({ path: `${folder}/night-results.png` });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: `${folder}/night-results-laptop.png` });
  const actions = await page.locator('.result-actions').boundingBox();
  expect(actions!.y + actions!.height).toBeLessThanOrEqual(600);
  await readFromResults(page, 'lost');
  await page.locator('.result-page [data-action="restart"]').click();
  await expect(page.locator('.learning-page')).toBeVisible();
  const reset = await state(page);
  expect(reset.lossFromNight).toBe(false);
  expect(reset.nightfallChecked).toBe(false);
  expect(reset.energyWash.visible).toBe(false);
  expect(reset.dayElapsed).toBe(0);
  expect(errors).toEqual([]);
  await writeFile(`${folder}/night.json`, JSON.stringify({ beginning, paused, middle, lost, reset, errors }, null, 2));
});

test('sunset wakes a rest and leaves a final minute instead of silently skipping it', async ({ page }) => {
  await start(page);
  await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setCargo(20, 70, 85);
    window.__BEE_TEST__!.setDayProgress(.899);
    window.__BEE_TEST__!.setQuietTime(9);
  });
  await page.keyboard.press('x'); // Wake the quiet view first.
  await page.keyboard.press('e');
  expect((await state(page)).resting).toBe(true);
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  await freeze(page, true);
  const dusk = await state(page);
  expect(dusk.phase).toBe('landed');
  expect(dusk.dayElapsed).toBeGreaterThanOrEqual(540);
  expect(dusk.dayElapsed).toBeLessThan(541);
  expect(dusk.quietFade).toBe(0);
  await expect(page.locator('.message-toast')).toContainText('One minute of daylight');
  await expect(page.locator('[data-text="day-label"]')).toHaveText('SUNSET');
  await page.screenshot({ path: `${folder}/sunset-warning.png` });
});

test('both supplies matter at nightfall, while a ready harvest can finish the homeward flight', async ({ page }) => {
  await start(page);
  for (const [nectar, pollen] of [[90, 139], [49, 140]]) {
    await page.evaluate(({ nectar, pollen }) => {
      window.__THREE_GAME_TEST_HOOKS__!.setState('landed');
      window.__BEE_TEST__!.setCargo(nectar, pollen, 100);
      window.__BEE_TEST__!.setDayProgress(1);
    }, { nectar, pollen });
    await expect.poll(async () => (await state(page)).phase).toBe('failing');
    expect((await state(page)).lossFromNight).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).phase).toBe('lost');
  }
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('landed');
    window.__BEE_TEST__!.setCargo(50, 140, 100);
    window.__BEE_TEST__!.setDayProgress(1);
  });
  await expect.poll(async () => (await state(page)).nightfallChecked).toBe(true);
  const ready = await state(page);
  expect(ready.phase).toBe('landed');
  expect(ready.harvestReady).toBe(true);
  expect(ready.energyWash.nightfall).toBe(0);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('won');
  expect((await state(page)).nectar).toBe(45);
  await page.screenshot({ path: `${folder}/success-results.png` });
  await readFromResults(page, 'won');
});

test('reduced motion keeps the camera still and reaches the same night result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 6, 3.5], 0, -.2);
    window.__BEE_TEST__!.setCargo(10, 40, 90);
    window.__BEE_TEST__!.setDayProgress(1);
  });
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  const before = await state(page);
  await expect.poll(async () => (await state(page)).phase).toBe('lost');
  const after = await state(page);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  expect(after.energyWash.nightfall).toBe(1);
  expect(after.energy).toBeGreaterThan(0);
  await page.screenshot({ path: `${folder}/reduced-night.png` });
});
