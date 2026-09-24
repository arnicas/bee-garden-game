import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('arrow keys, W and E reach and land on a moving flower without mouse or modifier keys', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/look-flight-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page, true);
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  const samples = [], held = new Set<string>();
  const key = async (name: string, down: boolean) => {
    if (down && !held.has(name)) { await page.keyboard.down(name); held.add(name); }
    if (!down && held.has(name)) { await page.keyboard.up(name); held.delete(name); }
  };
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    samples.push(s);
    if (s.canLand && s.target === 0) break;
    const f = await page.evaluate(() => window.__BEE_TEST__!.flowers()[0]);
    const dx = f.center[0] - s.position[0], dy = f.center[1] - s.position[1], dz = f.center[2] - s.position[2];
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const turn = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
    await key('ArrowLeft', turn > .05); await key('ArrowRight', turn < -.05);
    await key('ArrowUp', pitch - s.pitch > .05); await key('ArrowDown', pitch - s.pitch < -.05);
    await key('w', true);
    await page.waitForTimeout(75);
  }
  const approach = await state(page);
  expect(approach.canLand).toBe(true);
  expect(approach.target).toBe(0);
  // E engages while still well outside the old feet-catching range.
  const f = await page.evaluate(() => window.__BEE_TEST__!.flowers()[0]);
  expect(Math.hypot(...approach.position.map((n: number, i: number) => n - f.center[i]))).toBeGreaterThan(f.radius + .8);
  await page.keyboard.press('e');
  for (const name of [...held]) await key(name, false);
  await expect.poll(async () => (await state(page)).landingAssist).toBe(0);
  await expect(page.locator('[data-text="interaction"]')).toHaveText('LANDING GENTLY');
  await page.screenshot({ path: 'artifacts/look-flight-1/assisted-approach.png' });
  await expect.poll(async () => (await state(page)).landed).toBe(0);
  const landed = await state(page);
  expect(landed.visited).toBe(1);
  expect(landed.elapsed - approach.elapsed).toBeGreaterThan(.4);
  expect(landed.elapsed - approach.elapsed).toBeLessThan(2);
  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).nectar).toBeGreaterThan(5);
  await page.keyboard.up('f');
  await page.screenshot({ path: 'artifacts/look-flight-1/keyboard-landed.png' });
  expect(errors).toEqual([]);
  await writeFile('artifacts/look-flight-1/keyboard-metrics.json', JSON.stringify({ samples, approach, landed, errors }, null, 2));
  const video = page.video()!;
  await page.close();
  await video.saveAs('artifacts/look-flight-1/keyboard-landing.webm');
});

test('assisted landing pauses, can be cancelled with Space, and resets cleanly', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page, true);
  const approach = async () => {
    await page.evaluate(() => {
      window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
      const f = window.__BEE_TEST__!.flowers()[1];
      window.__BEE_TEST__!.setPose([f.center[0], f.center[1] + .8, f.center[2] + 2.3], 0, -.3);
    });
    await expect.poll(async () => (await state(page)).canLand).toBe(true);
    await page.keyboard.press('e');
    expect((await state(page)).landingAssist).toBe(1);
  };
  await approach();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(150);
  expect((await state(page)).position).toEqual(paused.position);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).landed).toBe(1);

  await approach();
  const before = await state(page);
  await page.keyboard.down('Space');
  expect((await state(page)).landingAssist).toBeUndefined();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect.poll(async () => (await state(page)).position[1]).toBeGreaterThan(before.position[1] + .5);
  await page.keyboard.up('Space');
  expect((await state(page)).phase).toBe('flying');
  expect((await state(page)).visited).toBe(before.visited);

  await approach();
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const fresh = await state(page);
  expect(fresh.landingAssist).toBeUndefined();
  expect(fresh.visited).toBe(1); // The new day begins on the first daisy.
});
