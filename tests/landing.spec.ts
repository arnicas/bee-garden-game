import { startFlyingFixture } from './support/start';
import { expect, test } from '@playwright/test';
import { Quaternion, Vector3 } from 'three';

test.use({ viewport: { width: 1280, height: 720 } });

test('E lands on a flower directly beneath the bee without aiming down at it', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    const f = window.__BEE_TEST__!.flowers()[1];
    window.__BEE_TEST__!.setPose([f.center[0], f.center[1] + .65, f.center[2]], 0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.snapshot().canLand), { timeout: 1500 }).toBe(true);
  await expect(page.locator('[data-text="hint"]')).toContainText('Land on corn poppy');
  await page.screenshot({ path: 'artifacts/landing-1/overhead-ready.png' });
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.snapshot().landed)).toBe(1);
  await page.screenshot({ path: 'artifacts/landing-1/overhead-landed.png' });
});

test('landing catches wind drift, assists earlier approaches, and rejects unreachable petals', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true); window.__BEE_TEST__!.setWindTime(26); });
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const f = flowers[1];
  const pose = async (local: Vector3, velocity: [number, number, number] = [0, 0, 0], pitch = 0) => {
    const current = await page.evaluate(() => window.__BEE_TEST__!.flowers()[1]);
    const world = local.applyQuaternion(new Quaternion().fromArray(current.rotation)).add(new Vector3().fromArray(current.center)).toArray() as [number, number, number];
    const yaw = Math.atan2(world[0] - current.center[0], world[2] - current.center[2]);
    await page.evaluate(({ world, velocity, pitch, yaw }) => window.__BEE_TEST__!.setPose(world, yaw, pitch, velocity), { world, velocity, pitch, yaw });
  };
  const state = () => page.evaluate(() => window.__BEE_TEST__!.snapshot());
  // Even peak-gust drift must not revive the old 1.65 speed gate.
  await pose(new Vector3(f.radius * .75, .65, 0), [6.5, 0, .4]);
  await expect.poll(async () => (await state()).canLand).toBe(true);
  expect((await state()).target).toBe(1);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state()).landed).toBe(1);

  for (const local of [new Vector3(0, 2.1, 0), new Vector3(0, .55, f.radius + 1.05)]) {
    await pose(local, [6.5, 0, .4], -.32);
    await expect.poll(async () => (await state()).canLand).toBe(true);
    await page.keyboard.press('e');
    expect((await state()).landingAssist).toBe(1);
    expect((await state()).phase).toBe('flying');
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
    await expect.poll(async () => (await state()).landed).toBe(1);
    await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true); window.__BEE_TEST__!.setWindTime(26); });
  }

  await pose(new Vector3(0, 4.2, 0), [0, 0, 0], -1.35);
  await page.keyboard.press('e');
  expect((await state()).phase).toBe('flying');
  await expect(page.locator('.message-toast')).toContainText('press W');

  await pose(new Vector3(0, -.35, 0), [0, 0, 0], 1.25);
  await page.keyboard.press('e');
  expect((await state()).phase).toBe('flying');
  await expect(page.locator('.message-toast')).toContainText('Space to climb');

  // The opposite side can sit directly above the tutorial daisy as the poppy
  // sways; that is a valid overhead landing, not an unreachable approach.
  await pose(new Vector3(0, .55, -(f.radius + 3)), [0, 0, 0], -.32);
  expect((await state()).target).toBe(1);
  expect((await state()).canLand).toBe(false);
  await page.keyboard.press('e');
  expect((await state()).phase).toBe('flying');
  await expect(page.locator('.message-toast')).toContainText('move closer');

  // E handles braking: even a fast close pass no longer needs Shift.
  await pose(new Vector3(0, .65, 0), [8, 0, 0]);
  await page.keyboard.press('e');
  expect((await state()).landed).toBe(1);

  // Each species permits an overhead catch regardless of camera heading.
  for (const id of [0, 2]) {
    const bloom = flowers[id];
    await page.evaluate(bloom => window.__BEE_TEST__!.setPose([bloom.center[0], bloom.center[1] + .65, bloom.center[2]], Math.PI, .3), bloom);
    await expect.poll(async () => (await state()).canLand).toBe(true);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state()).landed).toBe(id);
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('e');
  expect((await state()).phase).toBe('flying');
  await expect(page.locator('.message-toast')).toContainText('moment after takeoff');
  expect(errors).toEqual([]);
});
