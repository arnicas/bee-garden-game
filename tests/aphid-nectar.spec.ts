import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const supplyOf = (s: Record<string, any>, id: number) => s.supplies.find(([flowerId]: [number]) => flowerId === id)[1];

/** Sips for a moment and returns how much reached the jar per unit taken from the flower. */
async function sipShare(page: Page, flowerId: number, cornflower: boolean) {
  if (cornflower) {
    const florets: number[] = supplyOf(await state(page), flowerId).florets;
    await page.evaluate(i => window.__BEE_TEST__!.walkToFloret(i), florets.findIndex(a => a > 1));
  }
  await expect.poll(async () => (await state(page)).canDrink).toBe(true);
  const before = await state(page);
  await page.keyboard.down('f');
  await expect.poll(async () => supplyOf(await state(page), flowerId).nectar).toBeLessThan(supplyOf(before, flowerId).nectar - 2);
  await page.keyboard.up('f');
  const after = await state(page);
  return (after.nectar - before.nectar) / (supplyOf(before, flowerId).nectar - supplyOf(after, flowerId).nectar);
}

test('aphids on a stem take some of the flower’s nectar, shown on its bar; with them gone it all comes back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&aphids&friends');
  await startFlyingFixture(page);
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const clusters = await page.evaluate(() => window.__BEE_TEST__!.aphids());
  const species = (id: number) => flowers.find(f => f.id === id)!.species;
  // A daisy if one has aphids (the simplest to sip), else a cornflower.
  const cluster = clusters.find(c => species(c.flowerId) === 'daisy') ?? clusters.find(c => species(c.flowerId) === 'cornflower')!;
  expect(cluster).toBeTruthy();
  const id = cluster.flowerId, cornflower = species(id) === 'cornflower';
  await page.evaluate(([c]) => { window.__BEE_TEST__!.setAphids(c, 1); window.__BEE_TEST__!.setCargo(0, 0, 100); }, [cluster.id]);
  await page.evaluate(f => window.__BEE_TEST__!.approachFlower(f), id);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(id);
  await expect(page.locator('.message-toast')).toContainText('Aphids on the stem');
  await expect(page.locator('[data-text="flower-forage"]')).toContainText('Aphids on the stem take some of its nectar');
  const bar = page.locator('[data-supply="nectar"]');
  const vars = () => bar.evaluate(el => ({ supply: Number(el.style.getPropertyValue('--supply')), sapped: Number(el.style.getPropertyValue('--sapped')) }));
  const heavy = await vars();
  expect(heavy.sapped).toBeGreaterThan(heavy.supply * 1.4);
  await expect(bar).toHaveAttribute('aria-label', /aphids on the stem/);
  await page.screenshot({ path: 'artifacts/aphid-nectar.png', clip: { x: 0, y: 140, width: 640, height: 220 } });
  // About a third of each sip goes to the aphids.
  const sapped = await sipShare(page, id, cornflower);
  expect(sapped).toBeCloseTo(.5 * (1 - .35), 1);
  // A ladybird eats them down: the whole sip reaches the jar again, and the bar is whole.
  await page.evaluate(([c]) => window.__BEE_TEST__!.setAphids(c, 0), [cluster.id]);
  await expect(page.locator('[data-text="flower-forage"]')).toContainText('Move to collect pollen');
  const clear = await vars();
  expect(clear.sapped).toBeCloseTo(clear.supply, 2);
  expect(await sipShare(page, id, cornflower)).toBeCloseTo(.5, 1);
  expect(errors).toEqual([]);
});

test('without ?aphids, test pages keep every flower’s full nectar', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  const clusters = await page.evaluate(() => window.__BEE_TEST__!.aphids());
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect(page.locator('[data-text="flower-forage"]')).not.toContainText('Aphids');
  expect(clusters.length).toBeGreaterThan(0);
});
