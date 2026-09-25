import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
const supply = (snapshot: Record<string, any>, id: number): number => snapshot.supplies.find(([flowerId]: [number]) => flowerId === id)[1].nectar;

async function perch(page: Page, id: number, nectar: number, energy: number) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(({ id, nectar, energy }) => {
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.approachFlower(id);
    window.__BEE_TEST__!.setCargo(nectar, 100, energy);
  }, { id, nectar, energy });
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(id);
  await freeze(page, false);
}

test('full stores automatically refill energy without input, persist through pause, and stop when full', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Even a pollen-only perch can be a resting place: this meal uses stored nectar.
  await perch(page, 1, 100, 55);
  const before = await state(page);
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(68);
  await freeze(page, true);
  const fed = await state(page);
  expect(fed.nectar).toBeLessThan(100);
  expect(fed.autoFeeding).toBe(true);
  expect(fed.drinking).toBe(false);
  expect(supply(fed, 1)).toBe(0);
  expect((before.nectar - fed.nectar) * 3.5)
    .toBeCloseTo(fed.energy - before.energy + (fed.elapsed - before.elapsed) * .065, 5);
  await expect(page.locator('[data-text="energy-note"]')).toHaveText('Eating stored nectar · energy rising');
  await mkdir('artifacts/sidebar-auto-feed-1', { recursive: true });
  await page.screenshot({ path: 'artifacts/sidebar-auto-feed-1/automatic-meal.png' });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect((await state(page)).nectar).toBe(fed.nectar);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).autoFeeding, { timeout: 12_000 }).toBe(false);
  await expect(page.locator('[data-text="energy"]')).toHaveText('100%');
  const full = await state(page);
  await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(full.elapsed + .4);
  const rested = await state(page);
  expect(rested.nectar).toBe(full.nectar);
  expect(rested.energy).toBeLessThan(full.energy);

  // A partial store must not silently start another full meal.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(90, 100, 65));
  const partial = await state(page);
  await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(partial.elapsed + .4);
  expect((await state(page)).energy).toBeLessThan(65);
  expect((await state(page)).nectar).toBe(90);
  expect((await state(page)).autoFeeding).toBe(false);

  // The same automatic meal works on the wing, and restart clears it.
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(100, 100, 65));
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(73);
  expect((await state(page)).autoFeeding).toBe(true);
  expect((await state(page)).nectar).toBeLessThan(100);
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  expect((await state(page)).autoFeeding).toBe(false);
  expect((await state(page)).nectar).toBe(0);
  expect(errors).toEqual([]);
});

test('each nectar drop gives half the harvest while sipping still restores energy promptly', async ({ page }) => {
  await perch(page, 0, 0, 60);
  await expect.poll(async () => (await state(page)).canDrink).toBe(true);
  await freeze(page, true);
  await expect(page.locator('[data-supply="nectar"]')).toHaveAttribute('aria-label', 'Nectar here: 13% of a jar');
  const before = await state(page);
  await page.keyboard.down('f');
  await freeze(page, false);
  // The existing short landing settle comes before the first sip. Measure the
  // recovery rate once the tongue is drinking, not during that input delay.
  await expect.poll(async () => (await state(page)).drinking, { intervals: [50] }).toBe(true);
  const active = await state(page);
  await expect.poll(async () => (await state(page)).elapsed, { intervals: [50] }).toBeGreaterThan(active.elapsed + 1);
  await freeze(page, true);
  const sipping = await state(page);
  const duration = sipping.elapsed - active.elapsed;
  const accounted = (s: Record<string, any>) => s.nectar - before.nectar
    + (s.energy - before.energy + (s.elapsed - before.elapsed) * .065) / 3.5;
  expect((sipping.energy - active.energy) / duration).toBeCloseTo(6 - .065, 4);
  expect(accounted(sipping)).toBeCloseTo((supply(before, 0) - supply(sipping, 0)) * .5, 5);
  expect(sipping.nectar).toBeGreaterThan(0);
  await freeze(page, false);
  await expect.poll(async () => supply(await state(page), 0), { intervals: [50] }).toBeLessThan(.01);
  await freeze(page, true);
  await page.keyboard.up('f');
  const empty = await state(page);
  expect(accounted(empty)).toBeCloseTo(13, 4);
  expect(empty.nectar).toBeLessThan(13); // Some of the smaller harvest fed the bee.
  await expect(page.locator('[data-supply="nectar"]')).toHaveAttribute('aria-label', 'Nectar here: 0% of a jar');
  await expect(page.locator('[data-supply="nectar"]')).toHaveClass(/is-empty/);
  await mkdir('artifacts/harvest-yield-1', { recursive: true });
  await page.screenshot({ path: 'artifacts/harvest-yield-1/daisy-after-sipping.png' });
  await writeFile('artifacts/harvest-yield-1/nectar.json', JSON.stringify({ before, sipping, empty, usableNectar: accounted(empty) }, null, 2));
});

test('manual sipping fills storage and energy but an empty flower cannot supply extra nectar', async ({ page }) => {
  await perch(page, 2, 99, 65);
  await expect.poll(async () => (await state(page)).canDrink).toBe(true);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).nectar).toBe(100);
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(75);
  await page.keyboard.up('f');
  // Gather the remaining flower supply, then try the same action again.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 100, 100));
  await page.keyboard.down('f');
  await expect.poll(async () => supply(await state(page), 2)).toBeLessThan(.01);
  await page.keyboard.up('f');
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(90, 100, 60));
  await expect.poll(async () => (await state(page)).canDrink).toBe(false);
  const depleted = await state(page);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(depleted.elapsed + .5);
  const after = await state(page);
  expect(after.energy).toBeLessThan(depleted.energy);
  expect(after.nectar).toBe(90);
  expect(after.drinking).toBe(false);
  expect(supply(after, 2)).toBeGreaterThanOrEqual(0);
  await page.keyboard.up('f');
});


test('a full bee curls its tongue, stops sipping, and resumes when resources are needed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/walking-forage-1/nectar', { recursive: true });
  await perch(page, 2, 85, 95);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(false));
  await expect.poll(async () => (await state(page)).canDrink).toBe(true);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).tongue.extension).toBeGreaterThan(.95);
  await page.screenshot({ path: 'artifacts/walking-forage-1/nectar/sipping.png' });
  await expect.poll(async () => (await state(page)).satiated).toBe(true);
  await expect.poll(async () => (await state(page)).tongue.extension).toBeLessThan(.01);
  const full = await state(page);
  expect(full.nectar).toBe(100);
  expect(full.energy).toBeGreaterThan(99);
  expect(full.drinking).toBe(false);
  expect(full.canDrink).toBe(false);
  expect(full.tongue.visible).toBe(true);
  await expect(page.locator('[data-text="interaction"]')).toHaveText('ALL TOPPED UP');
  await page.screenshot({ path: 'artifacts/walking-forage-1/nectar/curled-full.png' });
  // Holding F and pressing it again cannot waste nectar on sub-percent hunger.
  await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(full.elapsed + .6);
  await page.keyboard.up('f');
  await page.keyboard.press('f');
  expect(supply(await state(page), 2)).toBe(supply(full, 2));
  expect((await state(page)).drinking).toBe(false);
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/walking-forage-1/nectar/curled-small-window.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  expect((await state(page)).satiated).toBe(true);
  // Arriving already full also gives the right guidance; the curl hides in flight.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).tongue.visible).toBe(false);
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect(page.locator('[data-text="message"]')).toHaveText('All topped up. Walk through the center for pollen.');
  expect((await state(page)).drinking).toBe(false);
  await expect.poll(async () => (await state(page)).tongue.visible).toBe(true);
  // Full storage with low energy must still allow feeding from the flower.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(100, 100, 70));
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).tongue.extension).toBeGreaterThan(.95);
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(76);
  expect((await state(page)).satiated).toBe(false);
  await page.keyboard.up('f');
  // Full energy with room for nectar must also allow sipping.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(80, 100, 100));
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).nectar).toBeGreaterThan(83);
  await page.keyboard.up('f');
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  expect((await state(page)).satiated).toBe(false);
  await expect.poll(async () => (await state(page)).tongue.visible).toBe(false);
  expect(errors).toEqual([]);
});
