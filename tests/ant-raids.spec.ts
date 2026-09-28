import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

test('ants raid a flower’s nectar: they drain it, and the bee can’t sip past them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const daisy = flowers.find(f => f.species === 'daisy' && f.id !== 0)!;
  expect(await page.evaluate(id => window.__BEE_TEST__!.startRaid(id, true), daisy.id)).toBe(true);
  // A poppy has no nectar to raid.
  const poppy = flowers.find(f => f.species === 'poppy')!;
  expect(await page.evaluate(id => window.__BEE_TEST__!.startRaid(id, true), poppy.id)).toBe(false);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antRaids())).find(r => r.flowerId === daisy.id)?.feeding ?? 0).toBeGreaterThanOrEqual(5);

  // Seen from just above the flower: the ants are on the disc.
  const c = daisy.center;
  await page.evaluate(c => window.__BEE_TEST__!.setPose([c[0] + .45, c[1] + .75, c[2] + .45], Math.PI * .25, -1.05), c);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/ant-raids/from-above.png' });

  // They drink it down.
  const before = await page.evaluate(id => window.__BEE_TEST__!.nectar(id), daisy.id);
  await expect.poll(() => page.evaluate(id => window.__BEE_TEST__!.nectar(id), daisy.id), { timeout: 10000 }).toBeLessThan(before - .5);

  // Landing there, the bee can't sip; the hint says why.
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), daisy.id);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).phase).toBe('landed');
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, 40));
  await page.keyboard.down('f');
  await page.waitForTimeout(1500);
  const s = await state(page);
  await page.keyboard.up('f');
  expect(s.canDrink).toBe(false);
  expect(s.drinking).toBe(false);
  expect(s.nectar).toBe(0);
  await expect(page.locator('[data-text="hint"]')).toContainText('Ants are at the nectar');
  await page.screenshot({ path: 'artifacts/ant-raids/raided-daisy.png' });
  expect(errors).toEqual([]);
});

test('rain sends the raiders home', async ({ page }) => {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const cornflower = flowers.find(f => f.species === 'cornflower')!;
  await page.evaluate(id => window.__BEE_TEST__!.startRaid(id, true), cornflower.id);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antRaids())).length).toBeGreaterThan(0);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.36));
  await expect.poll(async () => (await state(page)).weather.rain, { timeout: 30000 }).toBeGreaterThan(.4);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antRaids())).every(r => r.ending), { timeout: 10000 }).toBe(true);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antRaids())).length, { timeout: 40000 }).toBe(0);
});
