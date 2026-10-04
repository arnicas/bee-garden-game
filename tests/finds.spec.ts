import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const start = async (page: Page) => {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
};

test('fairy ring mushrooms come up after the shower, are counted when found, and dry in the heat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  const rings = await page.evaluate(() => window.__BEE_TEST__!.fairyRings());
  expect(rings.filter(r => r.kind === 'ring').length).toBe(1);
  expect(rings.filter(r => r.kind === 'patch').length).toBeGreaterThanOrEqual(2);
  expect((await state(page)).mushrooms.up).toBe(0);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await expect.poll(async () => (await state(page)).mushrooms.up, { timeout: 60000 }).toBeGreaterThan(5);
  const ring = rings[0];
  await page.evaluate(r => window.__BEE_TEST__!.setPose([r.center[0] + r.radius + .5, r.center[1] + .5, r.center[2]], Math.PI / 2, -.35), ring);
  await expect.poll(async () => (await state(page)).mushrooms.seen).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('fairy ring');
  await page.screenshot({ path: 'artifacts/finds-1/fairy-ring-full.png' });
  await page.screenshot({ path: 'artifacts/finds-1/fairy-ring.png' });
  // The hot spell dries them.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.62));
  await expect.poll(async () => (await state(page)).mushrooms.dry, { timeout: 60000 }).toBeGreaterThan(.2);
  await page.screenshot({ path: 'artifacts/finds-1/fairy-ring-dry.png' });
  expect(errors).toEqual([]);
});

test('fallen petals lie under the flowers, and a pollinated poppy lets one fall', async ({ page }) => {
  await start(page);
  const petals = await page.evaluate(() => window.__BEE_TEST__!.petals());
  const down = petals.filter(p => !p.falling);
  expect(down.length).toBeGreaterThan(4);
  const poppyPetal = petals.find(p => p.kind === 'poppy')!;
  const before = (await state(page)).petals.petals;
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p.position[0] + .35, p.position[1] + .3, p.position[2]], Math.PI / 2, -.7), poppyPetal);
  await expect.poll(async () => (await state(page)).petals.seen, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('petal');
  await page.screenshot({ path: 'artifacts/finds-1/petal.png' });
  expect(await page.evaluate(id => window.__BEE_TEST__!.dropPetal(id, .2), poppyPetal.flowerId)).toBe(true);
  await expect.poll(async () => (await state(page)).petals.falling).toBe(1);
  await expect.poll(async () => (await state(page)).petals.falling, { timeout: 15000 }).toBe(0);
  expect((await state(page)).petals.petals).toBe(before + 1);
  // Only one petal waits on each poppy.
  expect(await page.evaluate(id => window.__BEE_TEST__!.dropPetal(id, .2), poppyPetal.flowerId)).toBe(false);
});

test('caterpillars eat bites into the leaf edges and are counted when found', async ({ page }) => {
  await start(page);
  // Caterpillars are placed once the bee is near their leaves: hover over the meadow first.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 0], 0, -.3));
  await page.waitForTimeout(600);
  const caterpillars = await page.evaluate(() => window.__BEE_TEST__!.caterpillars());
  expect(caterpillars.length).toBeGreaterThanOrEqual(4);
  const first = caterpillars.find(c => c.position.some(v => v !== 0))!;
  expect(first).toBeTruthy();
  // Look down at it from just above the leaf.
  await page.evaluate(c => window.__BEE_TEST__!.setPose([c.position[0] + .25, c.position[1] + .55, c.position[2] + .25], Math.PI * .25, -1), first);
  const area = (await state(page)).caterpillars.biteArea;
  await expect.poll(async () => (await state(page)).caterpillars.seen, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('caterpillar');
  await expect.poll(async () => (await state(page)).caterpillars.biteArea, { timeout: 15000 }).toBeGreaterThan(area);
  await page.screenshot({ path: 'artifacts/finds-1/caterpillar.png' });
});
