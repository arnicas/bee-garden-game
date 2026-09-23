import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { walkForPollen } from './support/foraging';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const flower = (page: Page, id: number) => page.evaluate(id => window.__BEE_TEST__!.flowers()[id], id);
const freeze = (page: Page, paused: boolean) => page.evaluate(paused => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(paused), paused);

for (const [id, species] of [[0, 'daisy'], [1, 'poppy'], [2, 'cornflower']] as const) {
  test(`${species} pollen grains deplete with supplies, persist on return, and refill on restart`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await mkdir('artifacts/walking-forage-1/pollen', { recursive: true });
    await page.goto('/?test');
    await startFlyingFixture(page);
    await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
    await page.evaluate(id => {
      // Stable flower pose makes full/partial/empty frames directly comparable.
      window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
      window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
      window.__BEE_TEST__!.approachFlower(id);
    }, id);
    await expect.poll(async () => (await state(page)).canLand).toBe(true);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).landed).toBe(id);
    const full = await flower(page, id), neighbor = await flower(page, (id + 1) % 3);
    const initialSupply = (await state(page)).supplies.find(([flowerId]: [number]) => flowerId === id)[1].pollen;
    expect(full.pollenFraction).toBe(1);
    expect(full.visiblePollen).toBeGreaterThan(40);
    await page.screenshot({ path: `artifacts/walking-forage-1/pollen/${species}-full.png` });

    // Landing on a swaying flower, looking around, and resting cannot collect.
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(false));
    const perched = await state(page);
    await freeze(page, false);
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(perched.elapsed + .5);
    await page.keyboard.up('ArrowRight');
    expect((await state(page)).position).not.toEqual(perched.position);
    expect((await state(page)).pollen).toBe(0);
    expect((await flower(page, id)).pollenFraction).toBe(1);
    // Face the center again, then walk backwards along the outer petals.
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(520);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('s');
    await page.waitForTimeout(500);
    await page.keyboard.up('s');
    expect((await state(page)).pollen).toBe(0);
    expect((await flower(page, id)).visiblePollen).toBe(full.visiblePollen);
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));

    // Actual footsteps inside the center start collection; stopping stops it.
    await walkForPollen(page, s => s.pollen > 3);
    const stopped = await state(page);
    await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(stopped.elapsed + .5);
    expect((await state(page)).pollen).toBe(stopped.pollen);
    expect((await state(page)).supplies).toEqual(stopped.supplies);
    await page.screenshot({ path: `artifacts/walking-forage-1/pollen/${species}-resting-in-pollen.png` });
    // Full cargo still lets contact coat the legs, without overflowing storage.
    await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 140));
    const fullCargo = await state(page);
    await walkForPollen(page, s => s.carriedPollen[species] > fullCargo.carriedPollen[species] + .08);
    const coated = await state(page);
    expect(coated.pollen).toBe(140);
    const coatOnlyTaken = fullCargo.supplies.find(([flowerId]: [number]) => flowerId === id)[1].pollen
      - coated.supplies.find(([flowerId]: [number]) => flowerId === id)[1].pollen;
    expect(coatOnlyTaken).toBeGreaterThan(0);
    await page.evaluate(pollen => window.__BEE_TEST__!.setCargo(0, pollen), stopped.pollen);

    await walkForPollen(page, s => s.supplies.find(([flowerId]: [number]) => flowerId === id)[1].pollen / initialSupply < .52);
    await freeze(page, true);
    const partial = await flower(page, id), partialState = await state(page);
    expect(partial.visiblePollen).toBeGreaterThan(0);
    expect(partial.visiblePollen).toBeLessThan(full.visiblePollen * .6);
    expect(partial.visiblePollen).toBe(Math.ceil(partial.pollenFraction * full.visiblePollen));
    expect((await flower(page, (id + 1) % 3)).pollenFraction).toBe(neighbor.pollenFraction);
    await page.screenshot({ path: `artifacts/walking-forage-1/pollen/${species}-partial.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    expect((await flower(page, id)).visiblePollen).toBe(partial.visiblePollen);
    await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();

    // Force a distant LOD, then revisit while simulation is frozen.
    await page.keyboard.press('Space');
    await page.evaluate(() => window.__BEE_TEST__!.setPose([34, 4, 0]));
    await expect.poll(async () => (await flower(page, id)).visiblePollen).toBeLessThan(partial.visiblePollen);
    expect((await flower(page, id)).pollenFraction).toBe(partial.pollenFraction);
    await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
    await expect.poll(async () => (await state(page)).canLand).toBe(true);
    await page.keyboard.press('e');
    await expect.poll(async () => (await flower(page, id)).visiblePollen).toBe(partial.visiblePollen);

    await freeze(page, false);
    await walkForPollen(page, s => s.supplies.find(([flowerId]: [number]) => flowerId === id)[1].pollen === 0);
    await freeze(page, true);
    const empty = await flower(page, id), emptyState = await state(page);
    expect(empty.visiblePollen).toBe(0);
    expect(emptyState.pollen).toBeCloseTo((initialSupply - coatOnlyTaken) * .5, 5);
    await expect(page.locator('[data-text="pollen"]')).toHaveText(`${Math.floor(emptyState.pollen + 1e-8)} / 140`);
    await page.screenshot({ path: `artifacts/walking-forage-1/pollen/${species}-empty.png` });
    await page.keyboard.press('Space');
    await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
    await expect.poll(async () => (await state(page)).canLand).toBe(true);
    await page.keyboard.press('e');
    expect((await flower(page, id)).visiblePollen).toBe(0);
    expect((await state(page)).pollen).toBe(emptyState.pollen);

    await page.keyboard.press('Escape');
    await page.locator('.pause-page [data-action="restart"]').click();
    await leaveWelcome(page);
    await expect.poll(async () => (await flower(page, id)).visiblePollen).toBe(full.visiblePollen);
    expect((await flower(page, id)).pollenFraction).toBe(1);
    expect((await state(page)).pollen).toBe(0);
    expect(errors).toEqual([]);
    const metrics = { full, fullCargo, coated, coatOnlyTaken, partial, partialState, empty, emptyState, errors };
    await writeFile(`artifacts/walking-forage-1/pollen/${species}-metrics.json`, JSON.stringify(metrics, null, 2));
    await testInfo.attach('pollen-depletion', { body: JSON.stringify(metrics), contentType: 'application/json' });
  });
}
