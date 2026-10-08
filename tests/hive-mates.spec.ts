import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
type V3 = [number, number, number];
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const bees = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.groundedBees());

async function open(page: Page) {
  await page.goto('/?test&hivemates&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.1); window.__BEE_TEST__!.setCargo(25, 5, 60); });
}

test('a day can hold tired bees (on a leaf and by a pool) and a fallen one', async ({ page }) => {
  await open(page);
  const all = await bees(page);
  expect(all.filter(b => b.kind === 'tired').map(b => b.place).sort()).toEqual(['leaf', 'rim']);
  expect(all.filter(b => b.kind === 'fallen').map(b => b.cause)).toEqual(['cold']);
  expect(all.every(b => b.state === 'resting' && b.position.some(v => v !== 0))).toBe(true);
});

test('land beside a tired bee, hold F to share nectar: she flies home and the results count her', async ({ page }) => {
  await open(page);
  const bee = (await bees(page)).find(b => b.kind === 'tired' && b.place === 'leaf')!;
  const leaf = (await page.evaluate(() => window.__BEE_TEST__!.shelters())).find(l => l.id === bee.leafId)!;
  await page.evaluate(l => window.__BEE_TEST__!.setPose([l.center[0], l.center[1] + 1.5, l.center[2] + .8], 0, -.9), leaf);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.screenshot({ path: 'artifacts/hive-mates/tired-from-above.png' });
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).onLeaf).toBe(leaf.id);
  await expect(page.locator('[data-text="hint"]')).toContainText('Hold F to share');
  await page.screenshot({ path: 'artifacts/hive-mates/tired-on-leaf.png' });
  const before = (await state(page)).nectar;
  await page.keyboard.down('f');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/hive-mates/sharing.png' });
  await expect.poll(async () => (await bees(page)).find(b => b.id === bee.id)!.state, { timeout: 8_000 }).not.toBe('resting');
  await page.keyboard.up('f');
  const shared = before - (await state(page)).nectar;
  expect(shared).toBeGreaterThan(2);
  expect(shared).toBeLessThan(4);
  await expect(page.locator('.message-toast')).toContainText('on her way home');
  await expect.poll(async () => (await bees(page)).find(b => b.id === bee.id)!.state, { timeout: 12_000 }).toBe('gone');
  // Home for the day: the results count her.
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0));
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
  await expect(page.locator('[data-text="result-finds"]')).toContainText('1 hive mate helped home');
});

test('a fallen bee by a pool lies still, and her note says what happened to her', async ({ page }) => {
  await open(page);
  const bee = (await bees(page)).find(b => b.kind === 'fallen')!;
  const q = bee.position, p: V3 = [q[0] + .7, q[1] + .6, q[2] + .3];
  const yaw = Math.atan2(-(q[0] - p[0]), -(q[2] - p[2])), pitch = Math.atan2(q[1] - p[1], Math.hypot(q[0] - p[0], q[2] - p[2]));
  await page.evaluate(([p, yaw, pitch]) => window.__BEE_TEST__!.setPose(p as V3, yaw as number, pitch as number), [p, yaw, pitch] as const);
  await expect.poll(async () => (await bees(page)).find(b => b.id === bee.id)!.seen, { timeout: 5_000 }).toBe(true);
  await expect(page.locator('.message-toast')).toContainText('A fallen bee.');
  await expect(page.locator('.message-toast')).toContainText('cold rain');
  await page.screenshot({ path: 'artifacts/hive-mates/fallen-by-pool.png' });
  // She doesn't move, and can't be helped.
  const at = (await bees(page)).find(b => b.id === bee.id)!.position;
  await page.waitForTimeout(800);
  expect((await bees(page)).find(b => b.id === bee.id)!.position).toEqual(at);
});
