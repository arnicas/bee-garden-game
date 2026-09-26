import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function perch(page: Page) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(25, 5, 55); window.__BEE_TEST__!.approachFlower(0); });
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).phase).toBe('landed');
}
async function scenic(page: Page) {
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(22));
  await expect.poll(async () => (await state(page)).restView.blend, { timeout: 12000 }).toBe(1);
}

test('quiet rest fades the HUD naturally, keeps ordinary time, and consumes only the wake gesture', async ({ page }) => {
  await mkdir('artifacts/quiet-rest-1', { recursive: true });
  await perch(page);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const rested = await state(page);
  await expect.poll(async () => (await state(page)).quietFade).toBe(1);
  const quiet = await state(page);
  expect(quiet.dayElapsed - rested.dayElapsed).toBeCloseTo(quiet.elapsed - rested.elapsed, 5);
  expect(quiet.nectar).toBeCloseTo(rested.nectar, 5);
  expect(quiet.supplies).toEqual(rested.supplies);
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '0');
  await expect(page.locator('.top-actions')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'artifacts/quiet-rest-1/quiet-petal.png' });
  await page.keyboard.down('Space');
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  await page.keyboard.down('Space'); // Real held-key repeat cannot take off.
  await page.waitForTimeout(150);
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  await writeFile('artifacts/quiet-rest-1/quiet-metrics.json', JSON.stringify({ rested, quiet }, null, 2));
});

test('the meadow view rises, orbits with workers, pauses and returns to the same moving perch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await mkdir('artifacts/quiet-rest-1', { recursive: true });
  await perch(page);
  const before = await state(page);
  await scenic(page);
  const wide = await state(page);
  expect(wide.cameraPosition[1]).toBeGreaterThan(12);
  expect(wide.phase).toBe('landed');
  expect(wide.localPosition).toEqual(before.localPosition);
  expect(wide.supplies).toEqual(before.supplies);
  expect(wide.ending.workers).toBe(36);
  expect(wide.ending.butterflies).toBe(8);
  expect(wide.ending.perchedBee).toBe(true);
  expect(wide.ending.active).toBe(false);
  expect(wide.diagnostics.renderer.triangles).toBeLessThan(650000);
  expect(wide.audio.ending.swarm).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/quiet-rest-1/meadow-wide.png' });
  await page.waitForTimeout(1600);
  const orbit = await state(page);
  expect(orbit.cameraPosition[0]).not.toBe(wide.cameraPosition[0]);
  // Backgrounding pauses the presentation and simulation without losing the perch.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const paused = await state(page);
  await page.waitForTimeout(250);
  expect((await state(page)).restView).toEqual(paused.restView);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  // Resume click clears idle age; the camera smoothly comes home.
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  const back = await state(page);
  expect(back.cameraPosition).toEqual(back.position);
  expect(back.localPosition).toEqual(before.localPosition);
  expect(back.ending.workers).toBe(0);
  expect(back.supplies).toEqual(before.supplies);
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/quiet-rest-1/wake-small.png' });
  await scenic(page);
  await page.mouse.click(600, 370);
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  expect((await state(page)).phase).toBe('landed');
  expect((await state(page)).drinking).toBe(false);
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  // Multiple wake gestures must not erase a held movement key's release latch.
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(22));
  await expect.poll(async () => (await state(page)).restView.blend).toBeGreaterThan(.12);
  const beforeWake = await state(page);
  await page.keyboard.down('w');
  await page.mouse.click(600, 370, { button: 'right' });
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  await page.keyboard.down('w');
  await page.waitForTimeout(100);
  expect((await state(page)).localPosition).toEqual(beforeWake.localPosition);
  await page.keyboard.up('w');
  // An auxiliary click must not leave idle blocked forever.
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(9));
  await expect.poll(async () => (await state(page)).quietAge).toBeGreaterThan(9.1);
  await page.keyboard.press('x');
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  expect((await state(page)).restView.blend).toBe(0);
  expect((await state(page)).quietFade).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('artifacts/quiet-rest-1/scenic-metrics.json', JSON.stringify({ before, wide, orbit, paused, back, errors }, null, 2));
});

test('low energy and exposed rain restore the view; sheltered rain has no working swarm', async ({ page }) => {
  await mkdir('artifacts/quiet-rest-1', { recursive: true });
  await perch(page);
  await scenic(page);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 5, 34));
  await expect.poll(async () => (await state(page)).quietFade).toBe(0);
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(0, 5, 80); window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.setQuietTime(25); });
  await expect.poll(async () => (await state(page)).quietAge).toBe(0);
  expect((await state(page)).rainExposure).toBeGreaterThan(.9);
  await page.evaluate(() => window.__BEE_TEST__!.approachShelter(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).underLeaf).toBe(0);
  await scenic(page);
  const sheltered = await state(page);
  expect(sheltered.rainExposure).toBe(0);
  expect(sheltered.ending.workers).toBe(0);
  expect(sheltered.ending.perchedBee).toBe(true);
  expect(sheltered.audio.weather.targets.leaf).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/quiet-rest-1/rain-meadow.png' });
  await page.keyboard.press('x');
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  const shelteredBack = await state(page);
  expect(shelteredBack.underLeaf).toBe(0);
  expect(shelteredBack.cameraPosition).toEqual(shelteredBack.position);
});

test('reduced motion uses a still elevated view and a brief dissolve, with keyboard wake', async ({ page }) => {
  await mkdir('artifacts/quiet-rest-1', { recursive: true });
  await perch(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));
  await scenic(page);
  const before = await state(page);
  await page.waitForTimeout(1400);
  const after = await state(page);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  expect(after.cameraQuaternion).toEqual(before.cameraQuaternion);
  await freeze(page, true);
  await page.screenshot({ path: 'artifacts/quiet-rest-1/reduced-motion.png' });
  await freeze(page, false);
  await page.keyboard.press('Escape'); // First press wakes only.
  await expect.poll(async () => (await state(page)).restView.blend).toBe(0);
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).phase).toBe('paused');
});

test('Escape waking from a pointer-lock release does not also open the pause menu', async ({ page }) => {
  await perch(page);
  // This headless browser declines native pointer lock. Supply its browser
  // state/events, while sending real keyboard input through the game handlers.
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('#game-canvas') });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(11));
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '0');
  await page.keyboard.down('Escape');
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.keyboard.up('Escape');
  expect((await state(page)).phase).toBe('landed');
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).phase).toBe('paused');
});
