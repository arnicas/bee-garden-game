import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function land(page: Page) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).phase).toBe('landed');
  expect((await state(page)).resting).toBe(false);
}

test('a quiet flower rest advances sunlight, spends stored nectar, pauses and finishes naturally', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/day-rest-1', { recursive: true });
  await land(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowUp');
  await freeze(page, true);
  // Keep this fuel-accounting fixture before the shower; weather costs have
  // their own coverage and must not enter the dry metabolic-cost assertion.
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(30, 5, 45); window.__BEE_TEST__!.setDayProgress(.1); });
  await expect(page.locator('[data-text="day-label"]')).toContainText('MORNING');
  const before = await state(page);
  const initialSun = await page.locator('[data-day-sun]').getAttribute('transform');
  await page.screenshot({ path: 'artifacts/day-rest-1/before-rest.png' });
  await page.keyboard.press('e');
  await freeze(page, false);
  const restYaw = (await state(page)).yaw;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).yaw).toBeLessThan(restYaw);
  expect((await state(page)).resting).toBe(true);
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.keyboard.press('w');
  await page.keyboard.press('f');
  await page.waitForTimeout(300);
  const held = await state(page);
  expect(held.phase).toBe('paused');
  expect(held.resting).toBe(true);
  for (const key of ['restAge', 'dayElapsed', 'energy', 'nectar']) expect(held[key]).toBe(paused[key]);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(3.2);
  await expect(page.locator('[data-text="day-label"]')).toContainText('MORNING');
  await expect(page.locator('[data-action="rest"]')).toContainText('Resting · time passes');
  await page.screenshot({ path: 'artifacts/day-rest-1/resting.png' });
  const middle = await state(page);
  expect(middle.localPosition).toEqual(before.localPosition);
  expect(middle.drinking).toBe(false);
  expect(middle.crawlDistance).toBe(0);
  expect(middle.tongue.extension).toBeLessThan(.03);
  expect(middle.nectarSurface.touching).toBe(false);
  expect(middle.supplies).toEqual(before.supplies);
  expect(middle.pollen).toBe(before.pollen);
  expect(await page.locator('[data-day-sun]').getAttribute('transform')).not.toBe(initialSun);
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  await freeze(page, true);
  const after = await state(page);
  expect(after.dayProgress - before.dayProgress).toBeGreaterThan(.175);
  expect(after.dayProgress - before.dayProgress).toBeLessThan(.19);
  expect(after.energy - before.energy).toBeGreaterThan(35);
  expect(after.energy - before.energy).toBeLessThan(37);
  // Polling may observe completion a few normal frames after the rest ends.
  // Account for both rates rather than treating those frames as resting.
  const elapsed = after.elapsed - before.elapsed;
  const restSeconds = (after.dayElapsed - before.dayElapsed - elapsed) / 17;
  const metabolicCost = restSeconds * .025 + (elapsed - restSeconds) * .065;
  expect(restSeconds).toBeCloseTo(6, 1);
  expect((before.nectar - after.nectar) * 3.5 - (after.energy - before.energy)).toBeCloseTo(metabolicCost, 6);
  expect(elapsed).toBeLessThan(7.5);
  expect(after.supplies).toEqual(before.supplies);
  await expect(page.locator('[data-action="rest"]')).toContainText('Rest and pass time');
  await page.screenshot({ path: 'artifacts/day-rest-1/after-rest.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.keyboard.press('e');
  await page.screenshot({ path: 'artifacts/day-rest-1/resting-small.png' });
  const restBox = await page.locator('[data-action="rest"]').boundingBox();
  expect(restBox!.x).toBeGreaterThanOrEqual(0);
  expect(restBox!.y + restBox!.height).toBeLessThan(500);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('pollinated'));
  await freeze(page, true);
  await page.keyboard.press('e');
  await page.screenshot({ path: 'artifacts/day-rest-1/pollinated-small.png' });
  const fullNote = await page.locator('[data-action="rest"]').boundingBox();
  expect(fullNote!.y + fullNote!.height).toBeLessThan(550);
  await expect(page.locator('.lower-left')).toHaveCount(0);
  expect(errors).toEqual([]);
  await writeFile('artifacts/day-rest-1/metrics.json', JSON.stringify({ before, paused, middle, after, errors }, null, 2));
});

test('rest is optional, wakes on ordinary input, and cannot create energy without nectar', async ({ page }) => {
  await land(page); await freeze(page, true);
  const restButton = page.locator('[data-action="rest"]');
  for (const key of ['e', 'w', 'a', 's', 'd', 'f']) {
    await restButton.click();
    expect((await state(page)).resting).toBe(true);
    await page.keyboard.press(key);
    expect((await state(page)).resting).toBe(false);
    expect((await state(page)).phase).toBe('landed');
  }
  // A key already held when rest starts must also wake on key repeat.
  await page.keyboard.down('w');
  await restButton.click();
  expect((await state(page)).resting).toBe(true);
  await page.keyboard.down('w');
  expect((await state(page)).resting).toBe(false);
  await page.keyboard.up('w');

  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(0, 5, 70); window.__BEE_TEST__!.setDayProgress(.83); });
  await restButton.click();
  const before = await state(page);
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(1.2);
  await freeze(page, true);
  const empty = await state(page);
  expect(empty.dayProgress).toBeGreaterThan(before.dayProgress);
  expect(empty.dayProgress).toBeLessThan(.9);
  expect(empty.energy).toBeLessThan(before.energy);
  expect(empty.nectar).toBe(0);
  expect(empty.phase).toBe('landed');
  await expect(page.locator('[data-text="hint"]')).toContainText('nectar restores it');
  await page.keyboard.press('Space');
  expect((await state(page)).resting).toBe(false);
  expect((await state(page)).phase).toBe('flying');
  await expect(restButton).toBeHidden();
});

test('reduced-motion rest caps recovery, stops for homecoming and resets with a new day', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await land(page); await freeze(page, true);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(.2, 5, 99.8));
  await page.keyboard.press('e'); await freeze(page, false);
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(1);
  await freeze(page, true);
  const recovered = await state(page);
  expect(recovered.energy).toBeCloseTo(100, 6);
  expect(recovered.nectar).toBeGreaterThan(0);
  expect(recovered.nectar).toBeLessThan(.2);
  expect(recovered.nectarSurface.touching).toBe(false);
  await page.screenshot({ path: 'artifacts/day-rest-1/reduced-rest.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(90, 140, 100));
  expect((await state(page)).harvestReady).toBe(true);
  expect((await state(page)).canReturn).toBe(false);
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('landed');
  expect((await state(page)).resting).toBe(true);
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('flying');
  expect((await state(page)).resting).toBe(false);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  await expect.poll(async () => (await state(page)).cameraPosition[2]).toBe(30);
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.resting).toBe(false);
  expect(reset.restAge).toBe(0);
  expect(reset.dayProgress).toBeLessThan(.01);
  expect(reset.energy).toBeGreaterThan(59); expect(reset.energy).toBeLessThanOrEqual(60);
  expect(reset.nectar).toBe(0);
});
