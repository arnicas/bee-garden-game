import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const flowers = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.flowers());
const bits = (n: number) => n.toString(2).split('').filter(b => b === '1').length;
const start = async (page: Page) => {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
};

test('fallen petals lie only under poppies, each one missing from its flower, and a falling one leaves the head', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  const petals = await page.evaluate(() => window.__BEE_TEST__!.petals());
  const all = await flowers(page);
  for (const f of all) {
    const below = petals.filter(p => p.flowerId === f.id && !p.falling).length;
    if (f.species !== 'poppy') { expect(f.petalsGone).toBe(0); expect(below).toBe(0); }
    else expect(bits(f.petalsGone)).toBe(below);
  }
  // A poppy already missing petals, seen from just above.
  const gappy = all.filter(f => f.species === 'poppy' && bits(f.petalsGone) >= 1).sort((a, b) => bits(b.petalsGone) - bits(a.petalsGone))[0];
  expect(gappy).toBeTruthy();
  await page.evaluate(f => window.__BEE_TEST__!.setPose([f.center[0] + .9, f.center[1] + 1.1, f.center[2] + .9], Math.PI * .25, -.85), gappy);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/petal-loss/poppy-gaps.png' });
  // Pollinated: one more lets go, and the head has one fewer.
  const before = bits(gappy.petalsGone);
  expect(await page.evaluate(id => window.__BEE_TEST__!.dropPetal(id, .2), gappy.id)).toBe(true);
  await expect.poll(async () => (await state(page)).petals.falling).toBe(1);
  expect(bits((await flowers(page)).find(f => f.id === gappy.id)!.petalsGone)).toBe(before + 1);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/petal-loss/poppy-falling.png' });
  expect(errors).toEqual([]);
});

test('a heavy shower knocks a petal off a nearby poppy', async ({ page }) => {
  await start(page);
  const poppy = (await flowers(page)).find(f => f.species === 'poppy' && f.id !== 0)!;
  await page.evaluate(f => window.__BEE_TEST__!.setPose([f.center[0] + 2, f.center[1] + .5, f.center[2]], Math.PI / 2, -.2), poppy);
  const gone = async () => (await flowers(page)).filter(f => f.species === 'poppy').reduce((n, f) => n + bits(f.petalsGone), 0);
  const before = await gone();
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.38));
  await expect.poll(async () => (await state(page)).weather.rain, { timeout: 20000 }).toBeGreaterThan(.6);
  await expect.poll(gone, { timeout: 60000 }).toBeGreaterThan(before);
});

test('fallen petals are at all stages: some fresh, some withered dark and papery', async ({ page }) => {
  await start(page);
  const petals = await page.evaluate(() => window.__BEE_TEST__!.petals());
  expect(petals.some(p => p.age < .4)).toBe(true);
  expect(petals.some(p => p.age >= .4)).toBe(true);
  expect((await state(page)).petals.withered).toBeGreaterThan(0);
  // Close by a withered one, and a fresher one if there is one near it.
  const old = petals.filter(p => p.age >= .7).sort((a, b) => b.age - a.age)[0] ?? petals.sort((a, b) => b.age - a.age)[0];
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p.position[0] + .45, p.position[1] + .4, p.position[2]], Math.PI / 2, -.8), old);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/petal-loss/withered.png' });
  const young = petals.filter(p => p.age < .3)[0];
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p.position[0] + .45, p.position[1] + .4, p.position[2]], Math.PI / 2, -.8), young);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/petal-loss/fresh.png' });
});
