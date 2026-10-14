import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
type V3 = [number, number, number];
const ground = (x: number, z: number) => -0.12 + Math.sin(x * 0.17) * Math.cos(z * 0.13) * 0.16 + Math.max(0, Math.hypot(x, z) - 25) * 0.026;
/** Puts the bee's eye at p, looking at q (or straight away from it). */
async function lookFrom(page: Page, p: V3, q: number[], away = false) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  const yaw = Math.atan2(-dx, -dz) + (away ? Math.PI : 0), pitch = away ? 0 : Math.atan2(dy, Math.hypot(dx, dz));
  await page.evaluate(([p, yaw, pitch]) => window.__BEE_TEST__!.setPose(p as V3, yaw as number, pitch as number), [p, yaw, pitch] as const);
}
/** Flies over the middle of the meadow so the friends nearby are placed. */
async function open(page: Page) {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 0], 0, -.3));
  await page.waitForTimeout(600);
}
const lifted = (p: number[]) => p[1] - ground(p[0], p[2]);
const birdSeen = (page: Page, id: number) => page.evaluate(i => window.__BEE_TEST__!.ladybirds().find(b => b.id === i)!.seen, id);
const aphidSeen = (page: Page, id: number) => page.evaluate(i => window.__BEE_TEST__!.aphids().find(c => c.id === i)!.seen, id);

test('a ladybird on a stem counts from the side, well beyond the old close-up range', async ({ page }) => {
  await open(page);
  // Above the grass, so a level look reaches it.
  const birds = (await page.evaluate(() => window.__BEE_TEST__!.ladybirds())).filter(b => b.perch === 'stem' && lifted(b.position) > 1.2 && Math.hypot(b.position[0], b.position[2]) < 12);
  expect(birds.length).toBeGreaterThan(0);
  let counted = false;
  for (const bird of birds.slice(0, 4)) {
    const at = bird.position;
    await lookFrom(page, [at[0] + 1.6, at[1] + .2, at[2] + .4], at);
    try { await expect.poll(() => birdSeen(page, bird.id), { timeout: 3_000 }).toBe(true); counted = true; break; } catch { /* a leaf in the way: try the next */ }
  }
  expect(counted).toBe(true);
});

test('looking the other way, or across deep grass, does not count', async ({ page }) => {
  await open(page);
  const birds = (await page.evaluate(() => window.__BEE_TEST__!.ladybirds())).filter(b => b.perch !== 'flying' && b.position.some(v => v !== 0) && Math.hypot(b.position[0], b.position[2]) < 12);
  const bird = birds.sort((a, b) => lifted(a.position) - lifted(b.position))[0];
  const at = bird.position;
  await lookFrom(page, [at[0] + .8, at[1] + 2.2, at[2]], at, true);
  await page.waitForTimeout(1500);
  expect(await birdSeen(page, bird.id)).toBe(false);
  if (lifted(at) < .6) {
    await lookFrom(page, [at[0] + 2, at[1] + .1, at[2]], at);
    await page.waitForTimeout(1500);
    expect(await birdSeen(page, bird.id)).toBe(false);
  }
});

test('aphids: hidden under the flower head from above, counted after a steady look from the side', async ({ page }) => {
  await open(page);
  const clusters = (await page.evaluate(() => window.__BEE_TEST__!.aphids())).filter(c => c.population > .5 && c.position.some(v => v !== 0) && lifted(c.position) > 1.2);
  expect(clusters.length).toBeGreaterThan(0);
  const cluster = clusters[0], at = cluster.position;
  const flower = (await page.evaluate(() => window.__BEE_TEST__!.flowers())).find(f => f.id === cluster.flowerId)!;
  // Straight down through the flower head: not counted.
  await lookFrom(page, [flower.center[0] + .05, flower.center[1] + 1.4, flower.center[2]], at);
  await page.waitForTimeout(2000);
  expect(await aphidSeen(page, cluster.id)).toBe(false);
  // From the side, about a hand's width off: in plain view, so after a short look it counts.
  await lookFrom(page, [at[0] + .9, at[1], at[2] + .3], at);
  await expect.poll(() => aphidSeen(page, cluster.id), { timeout: 5_000 }).toBe(true);
  await expect(page.locator('.message-toast')).toContainText('Aphids!');
});

test('an ant mound counts quickly from a little way off', async ({ page }) => {
  await open(page);
  const colonies = await page.evaluate(() => window.__BEE_TEST__!.antColonies());
  expect(colonies.length).toBeGreaterThan(0);
  const nest = colonies[0].nest;
  // About 2.5 units off and 2 up, looking down at the bare mound.
  await lookFrom(page, [nest[0] + 1.6, nest[1] + 2, nest[2] + 1.2], nest);
  const start = Date.now();
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antColonies())).find(c => c.id === colonies[0].id)!.seen, { timeout: 4_000 }).toBe(true);
  expect(Date.now() - start).toBeLessThan(2500);
  await expect(page.locator('.message-toast')).toContainText('Ants!');
});

test('right beside an ant mound, it counts only once she looks down at it', async ({ page }) => {
  await open(page);
  const colony = (await page.evaluate(() => window.__BEE_TEST__!.antColonies()))[0];
  const nest = colony.nest;
  // Level, half a unit away and facing past it: the mound sits below the view, so it doesn't count.
  await page.evaluate(n => window.__BEE_TEST__!.setPose([n[0] + .5, n[1] + .5, n[2]], Math.PI / 2, 0), nest);
  await page.waitForTimeout(1500);
  expect((await page.evaluate(() => window.__BEE_TEST__!.antColonies())).find(c => c.id === colony.id)!.seen).toBe(false);
  // Looking down at it: a quick look is enough.
  await lookFrom(page, [nest[0] + .5, nest[1] + .5, nest[2]], nest);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.antColonies())).find(c => c.id === colony.id)!.seen, { timeout: 3_000 }).toBe(true);
});

test('landing on a flower with a butterfly at its nectar counts the butterfly', async ({ page }) => {
  await open(page);
  let butterfly: { id: number; flowerId: number } | undefined;
  for (let i = 0; i < 40 && !butterfly; i++) {
    butterfly = (await page.evaluate(() => window.__BEE_TEST__!.butterflies())).find(b => b.state === 'feeding' && b.flowerId >= 0 && !b.seen);
    if (!butterfly) await page.waitForTimeout(500);
  }
  expect(butterfly).toBeTruthy();
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), butterfly!.flowerId);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as any).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.butterflies())).find(b => b.id === butterfly!.id)!.seen, { timeout: 3_000 }).toBe(true);
});

test('standing on a flower, the aphids on its stem below are hidden by the head', async ({ page }) => {
  await open(page);
  const clusters = (await page.evaluate(() => window.__BEE_TEST__!.aphids())).filter(c => c.population > .5 && c.position.some(v => v !== 0) && !c.seen);
  expect(clusters.length).toBeGreaterThan(0);
  const cluster = clusters[0];
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), cluster.flowerId);
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot())).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot())).phase).toBe('landed');
  await page.waitForTimeout(2500);
  expect(await aphidSeen(page, cluster.id)).toBe(false);
});

test('the real view decides: the depth check is running while flying', async ({ page }) => {
  await open(page);
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.sightReady())).toBe(true);
});

test('a clump of mushrooms by a pool counts from a little way off, once it is in plain view', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__BEE_TEST__!.growMushrooms());
  const patch = (await page.evaluate(() => window.__BEE_TEST__!.fairyRings())).find(r => r.kind === 'patch')!;
  const c = patch.center;
  // About 20 cm off and a little above the grass, looking at the clump.
  await lookFrom(page, [c[0] + 1.6, c[1] + 1.5, c[2] + 1.2], [c[0], c[1] + .3, c[2]]);
  await page.screenshot({ path: 'artifacts/spotting/mushrooms-off.png' });
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.fairyRings())).find(r => r.id === patch.id)!.seen, { timeout: 5_000 }).toBe(true);
});
