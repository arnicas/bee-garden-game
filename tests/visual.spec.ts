import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { Quaternion, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';
import { walkForPollen } from './support/foraging';

const snapshot = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
async function start(page: Page) {
  await page.goto('/?test');
  await expect(page.getByRole('button', { name: 'Take flight', exact: true })).toBeVisible();
  await startFlyingFixture(page);
  await expect.poll(async () => (await snapshot(page)).phase).toBe('flying');
}
async function hold(page: Page, key: string, ms: number) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }

test('moving blossoms keep rooted bases, carry a landed bee, and require a close approach', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    const f = window.__BEE_TEST__!.flowers()[1];
    window.__BEE_TEST__!.setPose([f.center[0], f.center[1] + .55, f.center[2] + f.radius + 3], 0, -.32);
  });
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(false);
  await page.keyboard.press('e');
  expect((await snapshot(page)).phase).toBe('flying');
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false);
    window.__BEE_TEST__!.approachFlower(1);
  });
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('landed');
  const initial = await snapshot(page);
  const first = await page.evaluate(() => window.__BEE_TEST__!.flowers()[1]);
  let excursion = 0, rotationChange = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const { state, f } = await page.evaluate(() => ({ state: window.__BEE_TEST__!.snapshot(), f: window.__BEE_TEST__!.flowers()[1] })) as { state: Record<string, any>; f: typeof first };
    expect(f.base).toEqual(first.base);
    const center = new Vector3().fromArray(f.center), rotation = new Quaternion().fromArray(f.rotation);
    const expected = new Vector3().fromArray(state.localPosition).applyQuaternion(rotation).add(center);
    expect(expected.distanceTo(new Vector3().fromArray(state.position))).toBeLessThan(.001);
    expect(new Vector3().fromArray(state.localPosition).distanceTo(new Vector3().fromArray(initial.localPosition))).toBeLessThan(.001);
    excursion = Math.max(excursion, center.distanceTo(new Vector3().fromArray(first.center)));
    rotationChange = Math.max(rotationChange, rotation.angleTo(new Quaternion().fromArray(first.rotation)));
  }
  expect(excursion).toBeGreaterThan(.15);
  expect(rotationChange).toBeGreaterThan(.04);
});

test('real input flies, lands, gathers, takes off and delivers a balanced harvest', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  const before = await snapshot(page);
  expect(before.forelegCurl).toBeGreaterThan(.95);
  await page.keyboard.down('w');
  // Steer against the crosswind using real keys, keeping the first daisy ahead.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const current = await snapshot(page);
    if (current.canLand && current.target === 0) break;
    const position = current.position;
    const x = position[0];
    const flower = await page.evaluate(() => window.__BEE_TEST__!.flowers()[0]);
    const flowerX = flower.center[0];
    if (x > flowerX + .12) await page.keyboard.down('a'); else await page.keyboard.up('a');
    if (x < flowerX - .12) await page.keyboard.down('d'); else await page.keyboard.up('d');
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('w');
  await page.keyboard.up('a'); await page.keyboard.up('d');
  const approaching = await snapshot(page);
  expect(approaching.position[2]).toBeLessThan(before.position[2] - 3);
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('landed');
  await expect.poll(async () => (await snapshot(page)).forelegCurl).toBeLessThan(.05);
  const landed = await snapshot(page);
  await page.keyboard.down('a');
  await expect.poll(async () => Math.abs((await snapshot(page)).localPosition[0] - landed.localPosition[0]), { intervals: [50] }).toBeGreaterThan(.05);
  await page.keyboard.up('a');
  const crawled = await snapshot(page);
  expect(Math.abs(crawled.localPosition[0] - landed.localPosition[0])).toBeGreaterThan(.035);
  await page.keyboard.down('d');
  await expect.poll(async () => Math.abs((await snapshot(page)).localPosition[0] - landed.localPosition[0]), { intervals: [30] }).toBeLessThan(.02);
  await page.keyboard.up('d');
  await page.keyboard.down('f');
  // A daisy now gives 13 nectar per visit (see Flower_Facts.md), part of it eaten for energy.
  await expect.poll(async () => (await snapshot(page)).nectar, { timeout: 20_000 }).toBeGreaterThan(8);
  await page.keyboard.up('f');
  await walkForPollen(page, s => s.pollen > 10);
  await page.screenshot({ path: 'artifacts/qa/foraging-daisy.png' });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('flying');
  await expect.poll(async () => (await snapshot(page)).forelegCurl).toBeGreaterThan(.95);
  // Isolate the second landing/foraging interaction from navigational skill.
  // The initial approach above is entirely real input; this is test-state setup.
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(2));
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('landed');
  await page.keyboard.down('f');
  await expect.poll(async () => (await snapshot(page)).nectar, { timeout: 20_000 }).toBeGreaterThan(30); // daisy + cornflower (28 per visit), less what the bee eats
  await page.keyboard.up('f');
  await walkForPollen(page, s => s.pollen >= 16); // cornflowers now give 10 pollen per visit
  // Two flowers cannot fill the larger day harvest. The multi-flower/full-pouch
  // checks cover gathering; isolate delivery here after proving the new gate.
  expect((await snapshot(page)).harvestReady).toBe(false);
  await page.evaluate(() => { const s = window.__BEE_TEST__!.snapshot() as any; window.__BEE_TEST__!.setCargo(70, 140, s.energy); });
  await expect.poll(async () => (await snapshot(page)).harvestReady).toBe(true);
  const harvest = await snapshot(page);
  expect(harvest.canReturn).toBe(false);
  await page.keyboard.press('r');
  expect((await snapshot(page)).phase).toBe('landed');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('flying');
  // Return navigation has separate real-input coverage; isolate delivery here.
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await expect.poll(async () => (await snapshot(page)).cameraPosition[2]).toBe(30);
  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('returning');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 16_000 }).toBe('won');
  const result = await snapshot(page);
  expect(result.nectar).toBeLessThan(harvest.nectar);
  expect(result.nectar).toBeGreaterThanOrEqual(45);
  expect(result.pollen).toBeGreaterThanOrEqual(140);
  expect(result.resultScore).toBeGreaterThan(1000);
  await page.screenshot({ path: 'artifacts/qa/delivery.png' });
  await testInfo.attach('harvest-metrics', { body: JSON.stringify({ before, approaching, landed, crawled, harvest, result, errors }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('pause, UV, energy conversion, failed flight and retry are consistent', async ({ page }) => {
  await start(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Back to the breeze', exact: true })).toBeVisible();
  const paused = await snapshot(page); await page.waitForTimeout(350);
  expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.keyboard.press('q');
  await expect(page.getByLabel('Toggle bee vision', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('m');
  await expect(page.getByLabel('Unmute sound', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(10, 0, 20));
  await page.waitForTimeout(500);
  const fuel = await snapshot(page); expect(fuel.nectar).toBeLessThan(10); expect(fuel.energy).toBeGreaterThan(20);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, .02));
  await expect.poll(async () => (await snapshot(page)).phase).toBe('lost');
  await page.screenshot({ path: 'artifacts/qa/failed.png' });
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await expect.poll(async () => (await snapshot(page)).phase).toBe('flying');
  expect((await snapshot(page)).nectar).toBe(0);
});

test('pollen-only poppies work, matching flowers pollinate, cargo cannot duplicate', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(1));
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await walkForPollen(page, s => s.pollen > 8);
  expect((await snapshot(page)).nectar).toBe(0);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(3));
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).pollinated).toBe(1);
  await expect(page.locator('.pollination-toast .pollination-announcement')).toContainText('Poppy pollinated.');
  await expect(page.locator('.pollination-summary')).toContainText('1 flower pollinated');
  await expect(page.locator('.flower-pollinated')).toBeVisible();
  await page.screenshot({ path: 'artifacts/qa/pollination-feedback.png' });
  expect((await snapshot(page)).pollen).toBeGreaterThan(8);
  await walkForPollen(page, s => s.supplies.find(([id]: [number]) => id === 3)[1].pollen < .01);
  const depleted = await snapshot(page);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(3));
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  expect((await snapshot(page)).pollen).toBe(depleted.pollen);
  expect((await snapshot(page)).pollinated).toBe(1);
  await expect(page.locator('.pollination-toast')).toBeHidden();
  await expect(page.locator('.flower-pollinated')).toBeVisible();
});

test('pollination cues require matching pollen, count each flower once, and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/meadow-coverage-1', { recursive: true });
  await start(page);
  const captureCoverage = async (name: string) => {
    const originalSize = page.viewportSize()!;
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
    for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => {
        const summary = document.querySelector('.pollination-summary')!.getBoundingClientRect();
        const flower = document.querySelector('.flower-note')!.getBoundingClientRect();
        return {
          clear: summary.right < innerWidth * .3 && (!flower.height || (flower.top > summary.bottom && flower.bottom < innerHeight)),
          fits: [...document.querySelectorAll<HTMLElement>('.meadow-label, .meadow-visits, .petal-tally, .petal-name')].every(el => el.scrollWidth <= el.clientWidth + 1),
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        };
      });
      expect(layout).toEqual({ clear: true, fits: true, overflow: false });
      await page.screenshot({ path: `artifacts/meadow-coverage-1/${name}-${size.width}.png`, animations: 'disabled' });
      if (size.width === 1280) await page.locator('.pollination-summary').screenshot({ path: `artifacts/meadow-coverage-1/counter-${name}.png`, animations: 'disabled' });
    }
    await page.setViewportSize(originalSize);
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  };
  const coverage = page.locator('.meadow-coverage');
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 0 of 3');
  await captureCoverage('no-types');
  const landOn = async (id: number) => {
    await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
    await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
    await page.keyboard.press('e');
    await expect.poll(async () => (await snapshot(page)).phase).toBe('landed');
  };
  await landOn(1);
  await expect(page.locator('.pollination-toast')).toBeHidden();
  await walkForPollen(page, s => s.pollen > 8);
  await expect(page.locator('.pollen-guide')).toHaveCount(0);
  expect((await snapshot(page)).forelegPollenColors['#ed514c']).toBeGreaterThan(0);
  await landOn(0); // Poppy pollen must not fertilize a daisy.
  expect((await snapshot(page)).pollinated).toBe(0);
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 0 of 3');
  await expect(page.locator('.pollination-toast')).toBeHidden();
  await landOn(3);
  await expect.poll(async () => (await snapshot(page)).pollinated).toBe(1);
  await expect(page.locator('[data-text="coverage-poppy"]')).toHaveText('1');
  await expect(page.locator('[data-text="coverage-daisy"]')).toHaveText('0');
  await expect(page.locator('[data-text="coverage-cornflower"]')).toHaveText('0');
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 1 of 3');
  await expect(page.locator('.pollination-summary .meadow-thanks')).toHaveCSS('opacity', '0');
  await captureCoverage('poppy-only');
  await expect(page.locator('.pollination-toast')).toBeVisible();
  await page.keyboard.press('Escape');
  const paused = (await snapshot(page)).elapsed;
  await page.waitForTimeout(200);
  expect((await snapshot(page)).elapsed).toBe(paused);
  await expect(page.locator('.pollination-toast')).toBeHidden();
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await expect(page.locator('.pollination-toast')).toBeVisible();
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 1 of 3');
  await walkForPollen(page, s => s.supplies.find(([id]: [number]) => id === 3)[1].pollen < 40);
  await landOn(1); // A second distinct flower receives new matching pollen.
  await expect.poll(async () => (await snapshot(page)).pollinated).toBe(2);
  await walkForPollen(page, s => s.supplies.find(([id]: [number]) => id === 1)[1].pollen < 28);
  await landOn(3); // Returning with more pollen cannot inflate the flower count.
  expect((await snapshot(page)).pollinated).toBe(2);
  await expect(page.locator('.pollination-summary')).toContainText('2 flowers pollinated');
  await expect(page.locator('[data-text="coverage-poppy"]')).toHaveText('2');
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 1 of 3');
  // Collect real pollen and transfer it between two blooms of each missing type.
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  for (const [index, species] of (['daisy', 'cornflower'] as const).entries()) {
    const [donor, recipient] = flowers.filter(flower => flower.species === species);
    const before = (await snapshot(page)).supplies.find(([id]: [number]) => id === donor.id)[1].pollen;
    await landOn(donor.id);
    await walkForPollen(page, s => s.supplies.find(([id]: [number]) => id === donor.id)[1].pollen < before - 2);
    await landOn(recipient.id);
    await expect(page.locator(`[data-text="coverage-${species}"]`)).toHaveText('1');
    await expect(coverage).toHaveAttribute('aria-label', `Flower types pollinated: ${index + 2} of 3`);
    await expect(page.locator('[data-text="pollination-count"]')).toHaveText(String(index + 3));
  }
  await expect(page.locator('.species-petal.is-pollinated')).toHaveCount(3);
  await expect(page.locator('[data-text="meadow-label"]')).toHaveText('ALL THREE HAPPY');
  await expect(page.locator('.pollination-summary .meadow-thanks')).toHaveCSS('opacity', '0.9');
  await captureCoverage('all-three');
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await expect(page.locator('.pollination-summary')).toContainText('0 flowers pollinated');
  await expect(coverage).toHaveAttribute('aria-label', 'Flower types pollinated: 0 of 3');
  await expect(page.locator('.species-petal.is-pollinated')).toHaveCount(0);
  for (const species of ['poppy', 'daisy', 'cornflower']) await expect(page.locator(`[data-text="coverage-${species}"]`)).toHaveText('0');
  await expect(page.locator('[data-text="meadow-label"]')).toHaveText('QUIET MEADOW');
  await expect(page.locator('.pollination-summary .meadow-thanks')).toHaveCSS('opacity', '0');
  await expect(page.locator('.pollination-toast')).toBeHidden();
  expect(errors).toEqual([]);
});

test('wind carries idle bees, Shift controls drift at an energy cost, and low air provides shelter', async ({ page }, testInfo) => {
  await start(page);
  const fixture = async () => page.evaluate(async () => {
    await window.__THREE_GAME_TEST_HOOKS__!.setState('windy');
    await window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
  });
  await fixture();
  const initial = await snapshot(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await page.waitForTimeout(2500);
  const riding = await snapshot(page);
  const rideDistance = new Vector3().fromArray(riding.position).distanceTo(new Vector3().fromArray(initial.position));
  expect(rideDistance).toBeGreaterThan(3);
  expect(new Vector3().fromArray(riding.velocity).dot(new Vector3().fromArray(riding.wind))).toBeGreaterThan(2);
  expect(riding.flightMode).toBe('riding');
  // The wind arrow and windsock are hidden for now; swaying vegetation is the wind cue.
  await expect(page.locator('[data-wind-arrow]')).toBeHidden();
  // Releasing thrust does not delete the bee's world momentum.
  await hold(page, 'w', 400);
  const released = await snapshot(page);
  await page.waitForTimeout(70);
  expect(new Vector3().fromArray((await snapshot(page)).velocity).distanceTo(new Vector3().fromArray(released.velocity))).toBeLessThan(.65);

  await fixture();
  await page.keyboard.down('Shift');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await page.waitForTimeout(2500);
  const steady = await snapshot(page);
  const steadyDistance = new Vector3().fromArray(steady.position).distanceTo(new Vector3().fromArray(initial.position));
  expect(steadyDistance).toBeLessThan(rideDistance * .25);
  expect(steady.energy).toBeLessThan(riding.energy - .2);
  expect(steady.flightMode).toBe('steady');
  await page.keyboard.up('Shift');

  // At full load the bee can still fly upwind near the grass tops.
  await fixture();
  const yaw = Math.atan2(initial.wind[0], initial.wind[2]);
  await page.evaluate(yaw => { window.__BEE_TEST__!.setPose([0, 3.45, 3.5], yaw, 0); window.__BEE_TEST__!.setCargo(90, 140); }, yaw);
  const shelteredStart = await snapshot(page);
  await page.keyboard.down('w');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await page.waitForTimeout(2500); await page.keyboard.up('w');
  const sheltered = await snapshot(page);
  const movement = new Vector3().fromArray(sheltered.position).sub(new Vector3().fromArray(shelteredStart.position));
  expect(movement.dot(new Vector3().fromArray(initial.wind).setY(0).normalize())).toBeLessThan(-.4);
  expect(new Vector3().fromArray(sheltered.wind).length()).toBeLessThan(new Vector3().fromArray(initial.wind).length() * .7);

  // Loaded bees can steady and land on a swaying poppy, then ride its frame.
  await page.keyboard.down('Shift');
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(1));
  await expect.poll(async () => (await snapshot(page)).canLand).toBe(true);
  await page.keyboard.press('e'); await page.keyboard.up('Shift');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('landed');
  await page.keyboard.press('Escape');
  const paused = await snapshot(page); await page.waitForTimeout(300);
  const stillPaused = await snapshot(page);
  expect(stillPaused.position).toEqual(paused.position);
  expect(stillPaused.windTime).toBe(paused.windTime);
  expect(stillPaused.windEffects).toEqual(paused.windEffects);
  await testInfo.attach('wind-mechanics', { body: JSON.stringify({ initial, riding, steady, shelteredStart, sheltered, rideDistance, steadyDistance }, null, 2), contentType: 'application/json' });
});

test('desktop captures are varied, controls fit, and screenshot pause freezes state', async ({ page }) => {
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__THREE_GAME_TEST_HOOKS__);
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    for (const state of ['title', 'active-play', 'windy', 'landed', 'uv', 'pollinated', 'complete']) {
      await page.evaluate(async state => {
        const hooks = window.__THREE_GAME_TEST_HOOKS__!;
        await hooks.setPausedForScreenshot(false); await hooks.seed(481);
        const ack = await hooks.setState(state); if (ack.state !== state) throw new Error('Missing state acknowledgment');
        await hooks.setPausedForScreenshot(true); await hooks.setReducedMotion(true);
      }, state);
      await page.waitForTimeout(500);
      const elapsed = (await snapshot(page)).elapsed;
      await page.waitForTimeout(100); expect((await snapshot(page)).elapsed).toBe(elapsed);
      const buffer = await page.screenshot({ path: `artifacts/qa/${state}-${size.width}.png` });
      const png = PNG.sync.read(buffer); const colors = new Set<string>();
      for (let i = 0; i < png.data.length; i += 140) colors.add(`${png.data[i] >> 4},${png.data[i+1] >> 4},${png.data[i+2] >> 4}`);
      expect(colors.size).toBeGreaterThan(70);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
      expect(overflow).toBe(false);
    }
  }
});
