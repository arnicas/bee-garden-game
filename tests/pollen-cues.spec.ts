import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { walkForPollen } from './support/foraging';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const pollenColors = { daisy: '#fff4dc', poppy: '#ed514c', cornflower: '#639df5' } as const;
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
const flowers = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.flowers());
const matches = async (page: Page) => (await flowers(page)).filter(f => f.pollenMatch).map(f => f.id);
async function land(page: Page, id: number) {
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(id);
}
async function start(page: Page) {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
}

for (const species of ['daisy', 'poppy', 'cornflower'] as const) {
  test(`${species} keeps coating and pollinating with a full pollen pouch`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await mkdir('artifacts/foraging-balance-1', { recursive: true });
    await start(page);
    await page.evaluate(() => {
      window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
      window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
      window.__BEE_TEST__!.setCargo(100, 139.8);
    });
    const [donor, recipient, next] = (await flowers(page)).filter(f => f.species === species);
    await land(page, donor.id);
    await freeze(page, false);
    await walkForPollen(page, s => (s.carriedPollen[species] ?? 0) > .18);
    await freeze(page, true);
    const coated = await state(page);
    expect(coated.pollen).toBe(140); // A nearly full pouch cannot overflow.
    expect(coated.forelegPollenColors[pollenColors[species]]).toBeGreaterThan(0);
    expect((await flowers(page)).find(f => f.id === donor.id)!.pollenFraction).toBeLessThan(1);
    await expect(page.locator('.goal-seal')).toHaveCount(0);
    await expect(page.locator('[data-text="pollen"]')).toHaveText('100%');
    await page.screenshot({ path: `artifacts/foraging-balance-1/${species}-full-pouch.png` });
    await page.keyboard.press('q');
    await expect.poll(() => matches(page)).toContain(recipient.id);
    await land(page, recipient.id);
    const delivered = await state(page);
    expect(delivered.pollinated).toBe(1);
    expect(delivered.carriedPollen[species]).toBe(0);
    expect(delivered.pollen).toBe(140);
    await expect.poll(() => matches(page)).toEqual([]);
    // Transfer frees the coat for more pollen even though cargo remains full.
    await freeze(page, false);
    const before = await state(page);
    await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(before.elapsed + .3);
    expect((await state(page)).carriedPollen[species]).toBe(0);
    await walkForPollen(page, s => (s.carriedPollen[species] ?? 0) > .18);
    await freeze(page, true);
    const recoated = await state(page);
    expect(recoated.pollen).toBe(140);
    expect(recoated.forelegPollenColors[pollenColors[species]]).toBeGreaterThan(0);
    await expect.poll(() => matches(page)).toContain(next.id);
    await land(page, next.id);
    const deliveredAgain = await state(page);
    expect(deliveredAgain.pollinated).toBe(2);
    expect(deliveredAgain.carriedPollen[species]).toBe(0);
    expect(deliveredAgain.pollen).toBe(140);
    if (species === 'daisy') {
      await page.setViewportSize({ width: 1024, height: 600 });
      await page.screenshot({ path: 'artifacts/foraging-balance-1/transferred-small-window.png' });
    }
    expect(errors).toEqual([]);
    await writeFile(`artifacts/foraging-balance-1/${species}-metrics.json`, JSON.stringify({ coated, delivered, recoated, deliveredAgain, errors }, null, 2));
  });

  test(`${species} pollen shows on the arms and guides only matching fresh flowers`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await mkdir('artifacts/pollen-knuckles-1', { recursive: true });
    await start(page);
    const [donor, recipient] = (await flowers(page)).filter(f => f.species === species);
    await expect(page.locator('.carried-pollen, .pollen-guide')).toHaveCount(0);
    expect((await state(page)).forelegPollen).toBe(0);
    await land(page, donor.id);
    await walkForPollen(page, s => (s.carriedPollen[species] ?? 0) > .18);
    await freeze(page, true);
    await expect.poll(async () => Object.keys((await state(page)).forelegPollenColors)).toEqual([pollenColors[species]]);
    expect((await state(page)).forelegPollen).toBeGreaterThanOrEqual(16);
    const collected = await state(page);
    expect(collected.recentPollen).toBe(species);
    expect(collected.forelegPollenColors[pollenColors[species]]).toBe(collected.forelegPollen);
    await page.screenshot({ path: `artifacts/pollen-knuckles-1/${species}-on-arms.png` });
    await page.keyboard.press('q');
    const freshIds = (await flowers(page)).filter(f => f.species === species && f.id !== donor.id).map(f => f.id);
    await expect.poll(() => matches(page)).toEqual(freshIds);
    await page.keyboard.press('Space');
    await freeze(page, false);
    await expect.poll(async () => (await state(page)).forelegCurl).toBeGreaterThan(.97);
    await freeze(page, true);
    const airborne = await state(page);
    expect(airborne.forelegPollen).toBe(collected.forelegPollen);
    expect(airborne.forelegPollenColors).toEqual(collected.forelegPollenColors);
    // Frame the recipient from outside landing range to see the full petal glow.
    const f = (await flowers(page)).find(f => f.id === recipient.id)!;
    await page.evaluate(center => window.__BEE_TEST__!.setPose([center[0], center[1] + 1.8, center[2] + 5], 0, -.3), f.center);
    await page.screenshot({ path: `artifacts/pollen-knuckles-1/${species}-matching-vision.png` });
    await page.keyboard.press('q');
    await expect.poll(() => matches(page)).toEqual([]);
    await page.screenshot({ path: `artifacts/pollen-knuckles-1/${species}-ordinary-vision.png` });
    await page.keyboard.press('q');
    await expect.poll(() => matches(page)).toEqual(freshIds);
    if (species === 'daisy') {
      // Record a complete pulse and the curl transition with the real simulation running.
      await page.keyboard.down('Shift');
      await freeze(page, false);
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(800);
        await page.screenshot({ path: `artifacts/pollen-knuckles-1/daisy-pulse-${i}.png` });
      }
      await page.keyboard.up('Shift');
      await freeze(page, true);
      await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));
      await expect.poll(() => matches(page)).toEqual(freshIds);
      expect((await state(page)).forelegCurl).toBe(1);
      await page.screenshot({ path: 'artifacts/pollen-knuckles-1/daisy-reduced-motion.png' });
      await page.setViewportSize({ width: 1024, height: 600 });
      await expect(page.locator('.carried-pollen, .pollen-guide')).toHaveCount(0);
      expect((await state(page)).forelegPollenColors).toEqual(collected.forelegPollenColors);
      await page.screenshot({ path: 'artifacts/pollen-knuckles-1/daisy-small-window.png' });
    }
    // Pause collection before landing so consumed loose pollen cannot refill yet.
    await land(page, recipient.id);
    await expect.poll(async () => (await state(page)).pollinated).toBe(1);
    await expect(page.locator('.carried-pollen, .pollen-guide')).toHaveCount(0);
    await expect.poll(() => matches(page)).toEqual([]);
    const delivered = await state(page);
    expect(delivered.carriedPollen[species]).toBe(0);
    expect(delivered.forelegPollen).toBe(0);
    expect(delivered.forelegPollenColors).toEqual({});
    expect(delivered.recentPollen).toBeNull();
    expect(delivered.pollen).toBe(collected.pollen);
    const notice = page.locator('.pollination-toast');
    await expect(notice).toBeVisible();
    await expect(notice.locator('.pollination-bloom:not([hidden])')).toHaveCount(1);
    await expect(notice.locator(`[data-pollinated-species="${species}"]`)).toBeVisible();
    await expect(notice.locator('.pollination-plus')).toHaveText('+1');
    await expect(notice.locator('.pollination-announcement')).toContainText(`${species[0].toUpperCase()}${species.slice(1)} pollinated.`);
    await mkdir('artifacts/pollination-notice-1', { recursive: true });
    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: width === 1024 ? 600 : 720 });
      const bounds = await notice.boundingBox();
      const heading = await page.locator('.game-heading').boundingBox();
      const actions = await page.locator('.top-actions').boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(100);
      expect(bounds!.height).toBeLessThanOrEqual(56);
      // The notice sits at top: 132px and is 54px tall, just below the day timeline.
      expect(bounds!.y + bounds!.height).toBeLessThan(190);
      const clock = await page.locator('.day-timeline').boundingBox();
      expect(bounds!.y).toBeGreaterThan(clock!.y + clock!.height);
      expect(bounds!.x).toBeGreaterThan(heading!.x + heading!.width);
      expect(bounds!.x + bounds!.width).toBeLessThan(actions!.x);
      await page.screenshot({ path: `artifacts/pollination-notice-1/${species}-${width}.png` });
    }
    await notice.screenshot({ path: `artifacts/pollination-notice-1/${species}-badge.png` });
    await page.screenshot({ path: `artifacts/pollen-knuckles-1/${species}-transferred.png` });
    await writeFile(`artifacts/pollen-knuckles-1/${species}-metrics.json`, JSON.stringify({ collected, airborne, delivered, matchingIds: freshIds, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}

test('mixed pollen stays distinct through transfer, pause, and a fresh trip', async ({ page }) => {
  await mkdir('artifacts/pollen-knuckles-1', { recursive: true });
  await start(page);
  for (const [id, species] of [[0, 'daisy'], [1, 'poppy']] as const) {
    await land(page, id);
    await walkForPollen(page, s => (s.carriedPollen[species] ?? 0) > .26);
  }
  const twoTypes = await state(page);
  expect(twoTypes.forelegPollen).toBe(72);
  expect(twoTypes.recentPollen).toBe('poppy');
  expect(twoTypes.forelegPollenColors[pollenColors.poppy]).toBeGreaterThan(twoTypes.forelegPollenColors[pollenColors.daisy]);
  expect(Object.keys(twoTypes.forelegPollenColors).sort()).toEqual([pollenColors.daisy, pollenColors.poppy].sort());
  await land(page, 2);
  await walkForPollen(page, s => (s.carriedPollen.cornflower ?? 0) > .12);
  await freeze(page, true);
  await page.keyboard.press('q');
  await expect(page.locator('.carried-pollen')).toHaveCount(0);
  const mixed = await state(page);
  // A new species must appear even when the total grain count is already capped.
  expect(mixed.forelegPollen).toBe(twoTypes.forelegPollen);
  expect(Object.keys(mixed.forelegPollenColors).sort()).toEqual(Object.values(pollenColors).sort());
  for (const count of Object.values(mixed.forelegPollenColors)) expect(count).toBeGreaterThanOrEqual(8);
  expect(mixed.recentPollen).toBe('cornflower');
  expect(mixed.forelegPollenColors[pollenColors.cornflower]).toBeGreaterThan(mixed.forelegPollenColors[pollenColors.poppy]);
  await expect.poll(async () => [...new Set((await flowers(page)).filter(f => f.pollenMatch).map(f => f.species))].sort()).toEqual(['cornflower', 'daisy', 'poppy']);
  await page.screenshot({ path: 'artifacts/pollen-knuckles-1/mixed-pollen.png' });
  await land(page, 4);
  await expect.poll(async () => Object.keys((await state(page)).forelegPollenColors).sort()).toEqual([pollenColors.poppy, pollenColors.cornflower].sort());
  await expect.poll(async () => [...new Set((await flowers(page)).filter(f => f.pollenMatch).map(f => f.species))].sort()).toEqual(['cornflower', 'poppy']);
  const transferred = await state(page);
  expect(transferred.forelegPollen).toBeGreaterThan(0);
  expect(transferred.pollen).toBe(mixed.pollen);
  expect(transferred.recentPollen).toBe('cornflower');
  await page.screenshot({ path: 'artifacts/pollen-knuckles-1/mixed-after-transfer.png' });
  // Deliver the newest type: the remaining red becomes the knuckle patch.
  const nextBlue = (await flowers(page)).find(f => f.species === 'cornflower' && f.id !== 2)!;
  await land(page, nextBlue.id);
  await expect.poll(async () => (await state(page)).recentPollen).toBe('poppy');
  const fallback = await state(page);
  expect(Object.keys(fallback.forelegPollenColors)).toEqual([pollenColors.poppy]);
  expect(fallback.pollen).toBe(mixed.pollen);
  await page.screenshot({ path: 'artifacts/pollen-knuckles-1/newest-transferred.png' });
  // Standing does not invent new pollen; walking recoats the knuckles blue.
  await freeze(page, false);
  await walkForPollen(page, s => (s.carriedPollen.cornflower ?? 0) > .12);
  await freeze(page, true);
  const recoated = await state(page);
  expect(recoated.recentPollen).toBe('cornflower');
  expect(recoated.forelegPollenColors[pollenColors.cornflower]).toBeGreaterThan(recoated.forelegPollenColors[pollenColors.poppy]);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).phase).toBe('paused');
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  expect((await state(page)).forelegPollenColors).toEqual(recoated.forelegPollenColors);
  expect((await state(page)).recentPollen).toBe('cornflower');
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await expect.poll(async () => (await state(page)).forelegPollen).toBe(0);
  expect((await state(page)).forelegPollenColors).toEqual({});
  expect((await state(page)).recentPollen).toBeNull();
  await page.keyboard.press('q');
  await expect.poll(() => matches(page)).toEqual([]);
  await writeFile('artifacts/pollen-knuckles-1/mixed-metrics.json', JSON.stringify({ twoTypes, mixed, transferred, fallback, recoated }, null, 2));
});
