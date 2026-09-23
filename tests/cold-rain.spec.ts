import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Quaternion, Vector3 } from 'three';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
async function start(page: Page) {
  await mkdir('artifacts/cold-rain-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
}
async function land(page: Page, id: number) {
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(id);
}
async function tuck(page: Page) {
  await page.evaluate(() => window.__BEE_TEST__!.approachShelter(0));
  await expect.poll(async () => (await state(page)).shelterTarget).toBe(0);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).underLeaf).toBe(0);
}

test('rain accumulates cold, exposed flowers cost energy, and leaf shelter restores safety', async ({ page }) => {
  await start(page);
  await land(page, 0);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.34); window.__BEE_TEST__!.setCargo(0, 5, 100); });
  const initial = await state(page);
  await expect.poll(async () => (await state(page)).chill, { timeout: 8000 }).toBeGreaterThan(.2);
  const cold = await state(page);
  expect(cold.rainExposure).toBe(1);
  // The warning precedes the steep weather drain, leaving time to act.
  expect(cold.energy).toBeLessThan(initial.energy);
  expect(cold.energy).toBeGreaterThan(initial.energy - 4);
  expect(cold.coldDrain).toBeLessThan(.5);
  expect(cold.cold).toBeGreaterThan(.16);
  expect(cold.supplies).toEqual(initial.supplies);
  await page.screenshot({ path: 'artifacts/cold-rain-1/cold-flower.png' });
  // With modest fuel, there is time to react and fly after the warning.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 5, 35));
  await page.keyboard.down('Space'); await page.keyboard.down('w');
  const reacting = await state(page);
  await page.waitForTimeout(6000);
  await page.keyboard.up('w'); await page.keyboard.up('Space');
  const afterReaction = await state(page);
  expect(afterReaction.phase).toBe('flying');
  expect(afterReaction.energy).toBeGreaterThan(reacting.energy - 22);
  expect(afterReaction.coldDrain).toBeLessThan(1);
  expect(afterReaction.energyWash.visible).toBe(true);
  await mkdir('artifacts/weather-reaction-1', { recursive: true });
  await page.screenshot({ path: 'artifacts/weather-reaction-1/cold-after-warning.png' });
  await tuck(page);
  const sheltered = await state(page);
  expect(sheltered.rainExposure).toBe(0);
  expect(sheltered.coldDrain).toBeLessThan(.35);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(250);
  const held = await state(page);
  for (const field of ['chill', 'energy', 'dayElapsed']) expect(held[field]).toBe(paused[field]);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(25, 5, 60));
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  const recovered = await state(page);
  expect(recovered.chill).toBe(0);
  expect(recovered.cold).toBe(0);
  expect(recovered.energy).toBeGreaterThan(94);
  expect(recovered.nectar).toBeLessThan(25);
  expect(recovered.supplies).toEqual(initial.supplies);
  await page.screenshot({ path: 'artifacts/cold-rain-1/warmed-under-leaf.png' });
  await writeFile('artifacts/cold-rain-1/recovery.json', JSON.stringify({ initial, cold, reacting, afterReaction, sheltered, paused, recovered }, null, 2));
});

test('rain on each flower has bounded droplets that move with petals and clear on restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  const samples: any[] = [];
  for (const id of [0, 1, 2]) {
    await land(page, id);
    await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.setCargo(0, 0, 100); window.__BEE_TEST__!.setChill(0); });
    await page.waitForTimeout(1400);
    await freeze(page, true);
    const wet = await state(page);
    expect(wet.flowerRain.visible).toBe(true);
    expect(wet.flowerRain.beads).toBeGreaterThan(0);
    expect(wet.flowerRain.draws).toBeLessThanOrEqual(2);
    const blooms = await page.evaluate(() => window.__BEE_TEST__!.flowers());
    for (const sample of wet.flowerRain.samples) {
      const bloom = blooms.find(f => f.id === sample.flowerId)!;
      const expected = new Vector3().fromArray(sample.local).applyQuaternion(new Quaternion().fromArray(bloom.rotation)).add(new Vector3().fromArray(bloom.center));
      expect(expected.distanceTo(new Vector3().fromArray(sample.world))).toBeLessThan(.00001);
      expect(sample.supportError).toBeLessThan(.025);
    }
    expect(wet.diagnostics.renderer.calls).toBeLessThan(300);
    expect(wet.diagnostics.renderer.triangles).toBeLessThan(750_000);
    await page.screenshot({ path: `artifacts/cold-rain-1/wet-flower-${id}.png` });
    await page.waitForTimeout(150);
    expect((await state(page)).flowerRain).toEqual(wet.flowerRain);
    samples.push(wet);
    await freeze(page, false);
  }
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('active-play'));
  expect((await state(page)).flowerRain.visible).toBe(false);
  expect((await state(page)).chill).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('artifacts/cold-rain-1/flowers.json', JSON.stringify({ samples, errors }, null, 2));
});

test('soaked exhaustion closes to black, pauses, fades sound and resets without delivering cargo', async ({ page }) => {
  await start(page);
  await freeze(page, true);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setPose([0, 6, 3.5], 0, -.2);
    window.__BEE_TEST__!.setDayProgress(.35);
    window.__BEE_TEST__!.setCargo(20, 12, 30);
    window.__BEE_TEST__!.setChill(1);
  });
  await page.screenshot({ path: 'artifacts/cold-rain-1/soaked-warning.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(20, 12, 3));
  await freeze(page, false);
  // Even emergency feeding cannot offset fully soaked energy loss forever.
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  const failing = await state(page);
  expect(failing.nectar).toBeGreaterThan(15);
  expect(failing.energy).toBe(0);
  expect(failing.lossFromRain).toBe(true);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  expect(paused.windEffects.enabled).toBe(false);
  await page.keyboard.press('w'); await page.keyboard.press('e');
  await page.waitForTimeout(300);
  expect((await state(page)).lossProgress).toBe(paused.lossProgress);
  expect((await state(page)).cameraPosition).toEqual(paused.cameraPosition);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect.poll(async () => (await state(page)).lossProgress).toBeGreaterThan(.45);
  await freeze(page, true);
  await page.screenshot({ path: 'artifacts/cold-rain-1/fading.png' });
  await freeze(page, false);
  await expect.poll(async () => (await state(page)).phase).toBe('lost');
  await expect(page.locator('.result-page')).toBeVisible();
  await expect(page.locator('[data-text="result-description"]')).toContainText(/rain|cold/i);
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
  const lost = await state(page);
  expect(lost.lossProgress).toBe(1);
  expect(lost.pollen).toBe(12);
  expect(lost.nectar).toBe(failing.nectar);
  await page.screenshot({ path: 'artifacts/cold-rain-1/lost.png' });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.screenshot({ path: 'artifacts/cold-rain-1/lost-small.png' });
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  const reset = await state(page);
  expect(reset.phase).toBe('flying'); expect(reset.chill).toBe(0);
  expect(reset.cold).toBe(0); expect(reset.lossProgress).toBe(0);
  expect(reset.audio.loopSources).toBe(lost.audio.loopSources);
  expect(reset.audio.retainedNodes).toBe(lost.audio.retainedNodes);
  await expect.poll(async () => (await state(page)).audio.outputRms).toBeGreaterThan(.00001);
  await writeFile('artifacts/cold-rain-1/exhaustion.json', JSON.stringify({ failing, paused, lost, reset }, null, 2));
});

test('ordinary exhaustion also closes, supports skip and uses a still reduced-motion ending', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, .01));
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  const before = await state(page);
  await page.waitForTimeout(300);
  const after = await state(page);
  expect(after.lossProgress).toBeGreaterThan(before.lossProgress);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  expect(after.cameraQuaternion).toEqual(before.cameraQuaternion);
  expect(after.lossFromRain).toBe(false);
  await page.keyboard.press('Escape');
  const paused = await state(page);
  await page.waitForTimeout(150);
  expect((await state(page)).forelegCurl).toBe(after.forelegCurl);
  expect((await state(page)).lossProgress).toBe(paused.lossProgress);
  expect((await state(page)).windEffects.enabled).toBe(false);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.locator('[data-action="skip-return"]').click();
  expect((await state(page)).phase).toBe('lost');
  await page.screenshot({ path: 'artifacts/cold-rain-1/dry-loss-reduced.png' });
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, .01));
  await expect.poll(async () => (await state(page)).phase).toBe('failing');
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('lost');
});
