import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Quaternion, Vector3 } from 'three';
import { leafSurfaceHeight } from '../src/shelters';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const frame = (page: Page) => page.evaluate(() => ({ state: window.__BEE_TEST__!.snapshot(), leaf: window.__BEE_TEST__!.shelters()[0] })) as Promise<{ state: Record<string, any>; leaf: { center: number[]; rotation: number[]; topPerch: number[]; perch: number[]; root: number[]; radius: number } }>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page, above: boolean) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.evaluate(above => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    window.__BEE_TEST__!.setDayProgress(.1);
    window.__BEE_TEST__!.setCargo(25, 5, 50);
    if (above) {
      const leaf = window.__BEE_TEST__!.shelters()[0];
      window.__BEE_TEST__!.setPose([leaf.center[0], leaf.center[1] + 1.5, leaf.center[2] + .8], 0, -.9);
    } else window.__BEE_TEST__!.approachShelter(0);
  }, above);
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
}

test('a dry leaf top carries the resting bee with the wind and releases it with Space', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await mkdir('artifacts/leaf-rest-1', { recursive: true });
  await start(page, true);
  await expect(page.locator('[data-text="interaction"]')).toHaveText('E  ·  LAND ON LEAF');
  await page.keyboard.press('e'); await freeze(page, false);
  await expect.poll(async () => (await state(page)).onLeaf).toBe(0);
  await expect(page.locator('.flower-note h2')).toHaveText('On a leaf');
  await expect(page.locator('.flower-resources')).toBeHidden();
  await expect(page.locator('.flower-pollinated')).toBeHidden();
  const perched = await frame(page), samples = [perched];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(100);
    const sample = await frame(page); samples.push(sample);
    expect(sample.state.position).toEqual(sample.leaf.topPerch);
    expect(sample.leaf.root).toEqual(perched.leaf.root);
    expect(sample.state.underLeaf).toBeUndefined();
    expect(sample.state.rainExposure).toBe(0);
    expect(sample.state.supplies).toEqual(perched.state.supplies);
  }
  const excursion = Math.max(...samples.map(s => new Vector3().fromArray(s.leaf.center).distanceTo(new Vector3().fromArray(perched.leaf.center))));
  const tilt = Math.max(...samples.map(s => new Quaternion().fromArray(s.leaf.rotation).angleTo(new Quaternion().fromArray(perched.leaf.rotation))));
  expect(excursion).toBeGreaterThan(.12);
  expect(tilt).toBeGreaterThan(.025);
  expect((await state(page)).nectarSurface.visible).toBe(false);
  await page.screenshot({ path: 'artifacts/leaf-rest-1/dry-top.png' });
  await page.keyboard.press('Escape');
  const paused = await frame(page); await page.waitForTimeout(200);
  expect((await frame(page)).state.position).toEqual(paused.state.position);
  expect((await frame(page)).leaf.rotation).toEqual(paused.leaf.rotation);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).restAge).toBeGreaterThan(.3);
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/leaf-rest-1/top-rest-small.png' });
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const rested = await state(page);
  expect(rested.onLeaf).toBe(0);
  expect(rested.energy).toBeGreaterThan(perched.state.energy + 34);
  expect(rested.nectar).toBeLessThan(perched.state.nectar);
  expect(rested.supplies).toEqual(perched.state.supplies);
  expect(rested.pollinated).toBe(0); expect(rested.visited).toBe(0);
  await page.keyboard.down('Space'); await page.waitForTimeout(1000); await page.keyboard.up('Space');
  const airborne = await state(page);
  expect(airborne.phase).toBe('flying'); expect(airborne.onLeaf).toBeUndefined();
  expect(airborne.position[1]).toBeGreaterThan(rested.position[1] + 2);
  expect(errors).toEqual([]);
  await writeFile('artifacts/leaf-rest-1/top-metrics.json', JSON.stringify({ perched, samples, excursion, tilt, paused, rested, airborne, errors }, null, 2));
});

test('dry entry goes around the rim and rain on top wakes the bee for E shelter', async ({ page }) => {
  await mkdir('artifacts/leaf-rest-1', { recursive: true });
  await start(page, false);
  await page.keyboard.press('e');
  expect((await state(page)).leafTopTarget).toBe(true);
  await page.keyboard.press('Space');
  expect((await state(page)).shelterAssist).toBeUndefined();
  await page.keyboard.press('e'); await freeze(page, false);
  const entry: any[] = [];
  const checkApproach = async (top: boolean) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const f = await frame(page);
      const local = new Vector3().fromArray(f.state.position).sub(new Vector3().fromArray(f.leaf.center)).applyQuaternion(new Quaternion().fromArray(f.leaf.rotation).invert());
      const radial = Math.hypot(local.x, local.z), surface = leafSurfaceHeight(local.x, local.z);
      entry.push({ top, local: local.toArray(), radial, surface });
      expect(radial > f.leaf.radius + .32 || local.y >= surface + .24 || local.y <= surface - .3).toBe(true);
      if (top ? f.state.onLeaf === 0 : f.state.underLeaf === 0) return;
      await page.waitForTimeout(60);
    }
    throw new Error('Leaf approach did not finish');
  };
  await checkApproach(true);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.299));
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).weather.rain).toBeGreaterThan(.05);
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  expect((await state(page)).onLeaf).toBe(0); // Weather does not teleport the bee.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await page.waitForTimeout(1100);
  const wet = await state(page);
  expect(wet.rainExposure).toBe(1); expect(wet.chill).toBeGreaterThan(.02);
  expect(wet.flowerRain.leafBeads).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Shelter beneath', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/leaf-rest-1/rain-on-top.png' });
  await page.keyboard.press('e');
  await checkApproach(false);
  const dry = await state(page);
  expect(dry.onLeaf).toBeUndefined(); expect(dry.rainExposure).toBe(0);
  await expect(page.locator('.flower-note h2')).toHaveText('Under a leaf');
  await page.screenshot({ path: 'artifacts/leaf-rest-1/tucked-under.png' });
  await writeFile('artifacts/leaf-rest-1/rain-metrics.json', JSON.stringify({ entry, wet, dry }, null, 2));
});

test('reduced leaf motion stays still and a fresh day clears a top perch', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, true);
  await page.keyboard.press('e'); await freeze(page, false);
  await expect.poll(async () => (await state(page)).onLeaf).toBe(0);
  const initial = await frame(page);
  await page.waitForTimeout(600);
  expect((await state(page)).position).toEqual(initial.state.position);
  expect((await frame(page)).leaf.rotation).toEqual(initial.leaf.rotation);
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.onLeaf).toBeUndefined(); expect(reset.underLeaf).toBeUndefined();
  expect(reset.shelterAssist).toBeUndefined(); expect(reset.resting).toBe(false);
  expect(reset.phase).toBe('flying'); expect(reset.rainExposure).toBe(0);
});

test('E from just beneath a rainy leaf stays below its surface', async ({ page }) => {
  await start(page, true);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  const f = await frame(page);
  const position = new Vector3(0, -.3, -.12).applyQuaternion(new Quaternion().fromArray(f.leaf.rotation)).add(new Vector3().fromArray(f.leaf.center)).toArray();
  await page.evaluate(p => window.__BEE_TEST__!.setPose(p as [number, number, number], 0, 0), position);
  await page.keyboard.press('e'); await freeze(page, false);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const sample = await frame(page);
    const local = new Vector3().fromArray(sample.state.position).sub(new Vector3().fromArray(sample.leaf.center)).applyQuaternion(new Quaternion().fromArray(sample.leaf.rotation).invert());
    expect(local.y).toBeLessThan(leafSurfaceHeight(local.x, local.z));
    if (sample.state.underLeaf === 0) break;
    await page.waitForTimeout(50);
  }
  expect((await state(page)).underLeaf).toBe(0);
});
