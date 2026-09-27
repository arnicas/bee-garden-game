import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('ant trails run from a mound up a stem; finding one is counted, and walkers step around the bee', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
  const colonies = await page.evaluate(() => window.__BEE_TEST__!.ants());
  expect(colonies.length).toBeGreaterThanOrEqual(3);
  // Every trail leads to a stem with aphids on it.
  const aphids = await page.evaluate(() => window.__BEE_TEST__!.aphids());
  for (const colony of colonies) expect(aphids.some(a => a.flowerId === colony.flowerId)).toBe(true);
  const nest = colonies[0].nest;
  // Down in the grass beside the first mound.
  await page.evaluate(n => window.__BEE_TEST__!.setPose([n[0] + .45, n[1] + .25, n[2]], -Math.PI / 2, -.5), nest);
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
  await expect.poll(async () => (await state(page)).ants.seen).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-text="message"]')).toContainText('ant trail');
  // Ants are out along the ground and up the stem.
  await expect.poll(async () => (await state(page)).ants.onStems, { timeout: 10000 }).toBeGreaterThan(0);
  const ants = await page.evaluate(() => window.__BEE_TEST__!.antsOf(0));
  expect(ants.filter(a => !a.onStem).length).toBeGreaterThan(4);
  // Sit on the trail itself: the ants flow around her.
  const walker = ants.filter(a => !a.onStem).sort((a, b) => Math.hypot(a.position[0] - nest[0], a.position[2] - nest[2]) - Math.hypot(b.position[0] - nest[0], b.position[2] - nest[2]))[Math.floor(ants.length / 4)];
  await page.evaluate(p => window.__BEE_TEST__!.setPose([p[0], p[1] + .2, p[2]], -Math.PI / 2, -.6), walker.position);
  await expect.poll(async () => (await state(page)).onGround, { timeout: 8000 }).toBe(true);
  await expect.poll(async () => (await state(page)).ants.detouring, { timeout: 15000 }).toBeGreaterThan(0);
  const bee = (await state(page)).position as number[];
  const around = await page.evaluate(() => window.__BEE_TEST__!.antsOf(0));
  for (const a of around.filter(a => !a.onStem)) expect(Math.hypot(a.position[0] - bee[0], a.position[2] - bee[2])).toBeGreaterThan(.08);
  await page.screenshot({ path: 'artifacts/ants-1/trail.png' });
  expect(errors).toEqual([]);
});

test('rain sends the ants home into the mound, and they come out again after', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false); window.__BEE_TEST__!.setDayProgress(.12); });
  const outBefore = (await state(page)).ants.outside;
  expect(outBefore).toBeGreaterThan(40);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  await expect.poll(async () => (await state(page)).ants.recall, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await state(page)).ants.outside, { timeout: 40000 }).toBeLessThan(outBefore / 3);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.6));
  await expect.poll(async () => (await state(page)).ants.recall, { timeout: 20000 }).toBe(false);
  await expect.poll(async () => (await state(page)).ants.outside, { timeout: 30000 }).toBeGreaterThan(outBefore / 3);
});
