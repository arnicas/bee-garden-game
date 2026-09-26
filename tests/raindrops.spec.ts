import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('raindrops knock the bee and wet her wings; a run of them knocks her down to dry in the grass', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test');
  await startFlyingFixture(page);
  const dry = await state(page);
  // Test pages keep drops off unless asked, so other weather tests stay steady.
  expect(dry.raindrops.on).toBe(false);
  expect(dry.raindrops.wetness).toBe(0);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.setCargo(0, 5, 100); window.__BEE_TEST__!.setPose([2, 7, 4], 0, 0); });
  // One drop: a splash on the view, a knock downward, wetter wings.
  const before = await state(page);
  await page.evaluate(() => window.__BEE_TEST__!.raindrop());
  const hit = await state(page);
  expect(hit.raindrops.count).toBe(1);
  expect(hit.raindrops.wetness).toBeGreaterThan(.1);
  expect(hit.raindrops.splash.visible).toBe(true);
  expect(hit.velocity[1]).toBeLessThan(before.velocity[1]);
  expect(hit.phase).toBe('flying');
  await mkdir('artifacts/raindrops-1', { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/raindrops-1/splash.png' });
  // The splash fades on its own.
  await expect.poll(async () => (await state(page)).raindrops.splash.visible, { timeout: 6000 }).toBe(false);
  // A run of strikes in quick succession knocks her down into the grass.
  await page.evaluate(() => { window.__BEE_TEST__!.setPose([2, 7, 4], 0, 0); for (let i = 0; i < 4; i++) window.__BEE_TEST__!.raindrop(); });
  const knocked = await state(page);
  expect(knocked.raindrops.knockedDown).toBe(true);
  expect(knocked.raindrops.wetness).toBeGreaterThanOrEqual(.8);
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
  // Soaked wings can't fly yet; she grooms them.
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  expect((await state(page)).onGround).toBe(true);
  await expect.poll(async () => (await state(page)).raindrops.groom).toBeGreaterThan(.3);
  await page.screenshot({ path: 'artifacts/raindrops-1/grooming.png' });
  // Rest to dry faster (sheltered in the grass, even in the shower).
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).raindrops.wetness, { timeout: 12000 }).toBeLessThan(.5);
  await expect.poll(async () => (await state(page)).raindrops.knockedDown).toBe(false);
  await page.keyboard.press('e');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  expect(errors).toEqual([]);
});

test('too wet to fly from a flower, Space lets go and drops the bee into the grass', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(0);
  await page.evaluate(() => { window.__BEE_TEST__!.setRaindrops(true); window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.setWetness(.9); });
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).landed).toBeUndefined();
  expect((await state(page)).raindrops.knockedDown).toBe(true);
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
});

test('with soaked wings, walking off the rim of a flower slips the bee over the edge', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(0);
  await page.evaluate(() => { window.__BEE_TEST__!.setRaindrops(true); window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.setWetness(.9); });
  // Landing faces the centre, so walking backwards heads for the rim.
  await page.keyboard.down('s');
  await expect.poll(async () => (await state(page)).landed, { timeout: 8000 }).toBeUndefined();
  await page.keyboard.up('s');
  expect((await state(page)).raindrops.knockedDown).toBe(true);
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
});
