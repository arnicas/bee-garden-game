import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await freeze(page, true);
}

test('return requires the hive-facing edge, flight height and a balanced harvest', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(90, 140, 75));
  expect((await state(page)).harvestReady).toBe(true);
  expect((await state(page)).canReturn).toBe(false);
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('flying');
  await expect(page.locator('[data-text="message"]')).toContainText('meadow edge');
  await page.getByRole('button', { name: /Way home/ }).click();
  expect((await state(page)).phase).toBe('flying');
  // A full load cannot return from another side or below the flight threshold.
  for (const position of [[30, 4, 0], [9, 4, 30], [0, 4, 29.9], [0, 1, 30]]) {
    await page.evaluate(p => window.__BEE_TEST__!.setPose(p as [number, number, number], Math.PI, 0), position);
    await page.keyboard.press('r');
    expect((await state(page)).phase).toBe('flying');
    expect((await state(page)).canReturn).toBe(false);
  }
  await expect(page.locator('[data-text="message"]')).toContainText('Space');
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  // Short of the goal, reaching the edge doesn't end the day by itself; the bee
  // goes home early only after choosing to with R (see day-report.spec.ts).
  for (const cargo of [[49.9, 140, 70], [50, 139.9, 70], [50, 140, 0], [50, 35, 70]]) {
    await page.evaluate(([nectar, pollen, energy]) => window.__BEE_TEST__!.setCargo(nectar, pollen, energy), cargo);
    expect((await state(page)).phase).toBe('flying');
    expect((await state(page)).harvestReady).toBe(false);
    expect((await state(page)).canReturn).toBe(false);
  }
  // The outer part of the broad arrival zone is as valid as its center.
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([7.5, 4, 30], Math.PI, 0);
    window.__BEE_TEST__!.setCargo(50, 140, 70);
  });
  await page.keyboard.press('r');
  expect((await state(page)).phase).toBe('returning');
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('won');
  expect((await state(page)).nectar).toBe(45);
  await page.keyboard.press('r');
  expect((await state(page)).nectar).toBe(45); // Delivery is charged once.
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  expect((await state(page)).harvestReady).toBe(false);
  expect((await state(page)).returnFuel).toBe(0);
  await expect(page.locator('.home-marker')).toBeHidden();
});

test('a heavy bee follows the marker through wind and flies into the ending without R', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await mkdir('artifacts/homeward-flight-1', { recursive: true });
  await start(page);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 7.8, 2], 0, 0);
    window.__BEE_TEST__!.setCargo(90, 140, 70);
  });
  const before = await state(page);
  await expect(page.locator('.home-marker')).toBeHidden(); // Home is behind us.
  await page.keyboard.down('ArrowLeft');
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).yaw, { intervals: [50] }).toBeGreaterThan(Math.PI - .03);
  await page.keyboard.up('ArrowLeft');
  await freeze(page, true);
  await expect(page.locator('.home-marker')).toBeVisible();
  await page.screenshot({ path: 'artifacts/homeward-flight-1/facing-home.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/homeward-flight-1/facing-home-small.png' });
  const pointed = await state(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect((await state(page)).position).toEqual(pointed.position);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await freeze(page, false);
  await page.keyboard.down('w');
  const samples: Record<string, any>[] = [];
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const s = await state(page); samples.push(s);
    if (s.phase === 'returning') break;
    expect(s.phase).toBe('flying');
    // Keep the marker ahead with normal arrow-key steering. Counter crosswind
    // using lateral input; never mutate pose, cargo or time during the crossing.
    const targetYaw = Math.atan2(s.position[0], -(30 - s.position[2]));
    const delta = Math.atan2(Math.sin(targetYaw - s.yaw), Math.cos(targetYaw - s.yaw));
    if (delta > .07) await page.keyboard.down('ArrowLeft'); else await page.keyboard.up('ArrowLeft');
    if (delta < -.07) await page.keyboard.down('ArrowRight'); else await page.keyboard.up('ArrowRight');
    if (s.position[0] > 1.4) await page.keyboard.down('d'); else await page.keyboard.up('d');
    if (s.position[0] < -1.4) await page.keyboard.down('a'); else await page.keyboard.up('a');
    await page.waitForTimeout(100);
  }
  for (const key of ['w', 'a', 'd', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(key);
  const arrived = await state(page);
  expect(arrived.phase).toBe('returning');
  expect(arrived.position[2]).toBeGreaterThanOrEqual(30);
  expect(Math.abs(arrived.position[0])).toBeLessThanOrEqual(8);
  expect(arrived.elapsed - before.elapsed).toBeGreaterThan(8);
  expect(arrived.energy).toBeLessThan(before.energy - 12);
  expect(arrived.homeDistance).toBeLessThan(.85);
  expect(arrived.nectar).toBe(90);
  expect(samples.some(s => s.loadSway > .1)).toBe(true);
  expect(samples.some(s => s.loadSway < -.1)).toBe(true);
  expect(Math.max(...samples.map(s => Math.abs(s.loadSway)))).toBeLessThanOrEqual(.22);
  await expect(page.locator('.home-marker')).toBeHidden();
  await page.screenshot({ path: 'artifacts/homeward-flight-1/arrival.png' });
  await expect.poll(async () => (await state(page)).phase, { timeout: 16_000 }).toBe('won');
  const delivered = await state(page);
  expect(delivered.nectar).toBe(85);
  expect(delivered.pollen).toBe(140);
  expect(errors).toEqual([]);
  await writeFile('artifacts/homeward-flight-1/metrics.json', JSON.stringify({ before, pointed, samples, arrived, delivered, errors }, null, 2));
});

test('holding Space while rising into the exit does not skip the ending', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 1.3, 30.4], Math.PI, 0);
    window.__BEE_TEST__!.setCargo(90, 140, 75);
  });
  await page.keyboard.down('Space');
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  await page.waitForTimeout(600);
  await page.keyboard.down('Space'); // Native key repeat after Skip receives focus.
  await page.keyboard.up('Space');
  expect((await state(page)).phase).toBe('returning');
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('won');
});
