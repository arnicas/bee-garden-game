import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const florets = (snapshot: Record<string, any>, id: number): number[] => snapshot.supplies.find(([flowerId]: [number]) => flowerId === id)[1].florets;

test('cornflower nectar hides in the disc florets: walk in, then hold F and move from bead to bead', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(0, 100, 60); window.__BEE_TEST__!.approachFlower(2); });
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(2);
  const landed = await state(page);
  const start = florets(landed, 2);
  expect(start.length).toBeGreaterThanOrEqual(5);
  // Daisies keep one easy pool; a cornflower's florets each hold a share.
  expect(florets(landed, 0)).toEqual([]);
  // On the outer florets there is nothing to sip, but the beads show where to go.
  expect(landed.canDrink).toBe(false);
  expect(landed.nectarBeads.count).toBe(start.length);
  // Walk in with F held: the tongue finds a floret and drains it.
  await page.keyboard.down('f');
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).drinking, { intervals: [30] }).toBe(true);
  await page.keyboard.up('w');
  const first = (await state(page)).nectarFloret;
  expect(first).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => florets(await state(page), 2)[first]).toBeLessThan(.01);
  // That floret is dry: its bead is gone. Step to another and keep sipping.
  const next = start.findIndex((_, i) => i !== first);
  await page.evaluate(i => window.__BEE_TEST__!.walkToFloret(i), next);
  await expect.poll(async () => (await state(page)).nectarFloret).toBe(next);
  await expect.poll(async () => florets(await state(page), 2)[next]).toBeLessThan(start[next]);
  expect((await state(page)).nectarBeads.count).toBeLessThan(start.length);
  await page.keyboard.up('f');
  // The flower's total follows its florets.
  const after = await state(page);
  const total = after.supplies.find(([id]: [number]) => id === 2)[1].nectar;
  expect(total).toBeCloseTo(florets(after, 2).reduce((a, b) => a + b, 0), 6);
  expect(errors).toEqual([]);
});
