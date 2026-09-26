import { expect, test } from '@playwright/test';
import { countSpecies, friendCounts, MEADOW_PLAN, nextCounts, planNextSummer, trend, type PastFlower } from '../src/meadow-plan';
import { flowerLessonLine, friendsChangeLine, meadowChangeLine, morningLine, nextSummerLine } from '../src/day-report';
import type { Species } from '../src/types';
import { startFlyingFixture } from './support/start';

const none = { daisy: 0, poppy: 0, cornflower: 0 };
const counts = (daisy: number, poppy: number, cornflower: number) => ({ daisy, poppy, cornflower });
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

/** A meadow laid out like world.ts: six opening flowers, then 66 spaced ones. */
function meadow(random = seeded()) {
  const fixed: PastFlower[] = ([['daisy', 0, -3.5], ['poppy', 3, -7], ['cornflower', -3, -6], ['poppy', -3.7, -1.4], ['daisy', 4.7, -.8], ['cornflower', 2.8, -11.5]] as [Species, number, number][])
    .map(([species, x, z]) => ({ species, x, z, height: 3.5, radius: 1, pollinated: false }));
  const rest: PastFlower[] = [];
  const kinds: Species[] = ['daisy', 'poppy', 'cornflower'];
  for (let attempt = 0; rest.length < 66 && attempt < 6000; attempt++) {
    const angle = random() * Math.PI * 2, r = 5.8 + Math.sqrt(random()) * 17.5, x = Math.cos(angle) * r, z = Math.sin(angle) * r - 3;
    if ([...fixed, ...rest].some(f => Math.hypot(f.x - x, f.z - z) < 2.05)) continue;
    rest.push({ species: kinds[rest.length % 3], x, z, height: 3.5, radius: .8, pollinated: false });
  }
  return { fixed, rest };
}

test('annuals follow pollination, the seed bank shrinks, daisies change slowly', () => {
  const normal = counts(22, 22, 22);
  expect(nextCounts(normal, none, counts(1, 1, 1))).toEqual(counts(19, 7, 7));
  expect(nextCounts(normal, counts(0, 4, 8), counts(1, 0, 0))).toEqual(counts(19, 24, 40));
  // Two, then three summers in a row with no poppies pollinated.
  expect(nextCounts(normal, none, counts(1, 2, 3)).poppy).toBe(3);
  expect(nextCounts(normal, none, counts(1, 2, 3)).cornflower).toBe(1);
  // Daisies: about ±12% a summer, never below the minimum.
  expect(nextCounts(counts(20, 22, 22), counts(5, 0, 0), counts(0, 1, 1)).daisy).toBe(23);
  expect(nextCounts(counts(6, 22, 22), none, counts(1, 1, 1)).daisy).toBe(MEADOW_PLAN.perennialMinimum);
  // A single remembered flower can bring a kind back within a summer or two.
  expect(nextCounts(counts(20, 1, 1), counts(0, 2, 0), counts(0, 0, 3)).poppy).toBe(15);
});

test('seedlings grow around the flowers that set seed, blow across the meadow, and skipped annuals leave gaps', () => {
  const { fixed, rest } = meadow();
  // Pollinate the four poppies furthest east.
  const east = rest.filter(f => f.species === 'poppy').sort((a, b) => b.x - a.x).slice(0, 4);
  for (const f of east) f.pollinated = true;
  const plan = planNextSummer({ fixed, seeded: rest, badSummers: none, random: seeded(3) });
  expect(countSpecies(plan.spots)).toEqual(plan.counts);
  expect(plan.counts.poppy).toBe(24);
  expect(plan.counts.cornflower).toBe(7);
  const poppies = plan.spots.filter(s => s.species === 'poppy');
  // Denser where the bee worked, but some blow (or wait in the seed bank) across the meadow.
  const nearParents = poppies.filter(p => east.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 6));
  expect(nearParents.length).toBeGreaterThanOrEqual(8);
  expect(poppies.filter(p => p.x < 0).length).toBeGreaterThanOrEqual(3);
  for (const e of east) expect(poppies.some(p => p.x === e.x && p.z === e.z)).toBe(true);
  expect(plan.gaps.length).toBeGreaterThan(10);
  // Every flower keeps its distance from the others.
  const all = [...fixed, ...plan.spots];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z)).toBeGreaterThanOrEqual(MEADOW_PLAN.spacing - 1e-9);
  // Daisies stay where they were.
  const daisies = rest.filter(f => f.species === 'daisy');
  expect(plan.spots.filter(s => s.species === 'daisy').every(s => daisies.some(d => d.x === s.x && d.z === s.z))).toBe(true);
});

test('aphids and ladybirds follow the flowers', () => {
  expect(friendCounts(counts(24, 24, 24))).toEqual({ aphidClusters: 14, ladybirds: 18, butterflies: 8 });
  const thin = friendCounts(counts(18, 9, 4));
  expect(thin.aphidClusters).toBeLessThan(6);
  expect(thin.ladybirds).toBeLessThan(11);
  expect(friendCounts(counts(24, 40, 40)).ladybirds).toBeGreaterThan(18);
});

test('the words name how the meadow changed', () => {
  expect(trend(24, 26)).toBe('same');
  expect(trend(24, 9)).toBe('fewer');
  expect(morningLine(2, 'good')).toMatch(/^Summer 2 · /);
  expect(meadowChangeLine(counts(24, 24, 24), counts(22, 35, 24))).toBe('Poppies have spread where you worked last summer.');
  expect(meadowChangeLine(counts(24, 24, 24), counts(24, 24, 9))).toBe('The cornflowers are sparse this year.');
  expect(meadowChangeLine(counts(24, 24, 24), counts(24, 35, 9))).toBe('Poppies have spread, and the cornflowers are sparse.');
  expect(flowerLessonLine(counts(0, 6, 0), counts(24, 24, 24), counts(21, 35, 9))).toBe('You pollinated 6 poppies, so more grew from their seed. No cornflowers were pollinated, so fewer came back.');
  expect(flowerLessonLine(counts(0, 0, 1), counts(24, 24, 24), counts(21, 9, 13))).toBe('No poppies were pollinated, so fewer came back.');
  expect(flowerLessonLine(counts(0, 1, 1), counts(24, 24, 24), counts(21, 13, 13))).toBe('Only 1 poppy was pollinated, so fewer came back.');
  expect(flowerLessonLine(counts(0, 0, 0), counts(9, 3, 3), counts(8, 3, 3))).toBe('Nothing was pollinated, so only old seed in the soil came up.');
  expect(friendsChangeLine(counts(24, 24, 24), counts(21, 9, 9))).toBe('Fewer poppies and cornflowers meant fewer aphids, so fewer ladybirds stayed.');
  expect(friendsChangeLine(counts(24, 24, 24), counts(24, 38, 38))).toBe('More poppies and cornflowers brought aphids, and more ladybirds came to eat them.');
  expect(friendsChangeLine(counts(24, 24, 24), counts(24, 24, 24))).toBe('');
  expect(nextSummerLine({ now: counts(24, 24, 24), next: counts(22, 9, 26), ladybirds: 18, nextLadybirds: 11, lastSummerLadybirds: 0 })).toBe('Next summer: fewer poppies and ladybirds.');
  expect(nextSummerLine({ now: counts(24, 24, 24), next: counts(24, 24, 24), ladybirds: 18, nextLadybirds: 18, lastSummerLadybirds: 0 })).toBe('Next summer, the meadow will look much the same.');
});

test('a summer with nothing pollinated grows a thinner meadow with fewer friends', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&summers');
  await startFlyingFixture(page);
  const before = await page.evaluate(() => ({ flowers: window.__BEE_TEST__!.flowers().length, ladybirds: window.__BEE_TEST__!.ladybirds().length }));
  const next = await page.evaluate(() => window.__BEE_TEST__!.nextSummer([]));
  expect(next.counts.poppy).toBeLessThanOrEqual(2 + 7);
  expect(next.counts.cornflower).toBeLessThanOrEqual(2 + 7);
  expect(next.badSummers).toEqual({ daisy: 1, poppy: 1, cornflower: 1 });
  expect(next.ladybirds).toBeLessThan(before.ladybirds);
  expect(next.gaps).toBeGreaterThan(20);
  expect((await page.evaluate(() => window.__BEE_TEST__!.flowers().length))).toBeLessThan(before.flowers);
  // The results screen looks ahead to next summer.
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('complete'));
  await expect(page.locator('[data-text="result-eyebrow"]')).toContainText('SUMMER');
  await expect(page.locator('[data-text="result-next"]')).toContainText('Next summer');
  await expect(page.locator('[data-text="restart-label"]')).toHaveText('Next summer');
  // The next summer's start page shows how the meadow changed.
  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect(page.locator('#learning-title')).toHaveText(/^Summer 2 begins/);
  await expect(page.locator('.learning-summer')).toBeVisible();
  await expect(page.locator('[data-text="summer-flowers-line"]')).not.toHaveText('');
  // The keyboard controls fold away after the first summer.
  await expect(page.locator('.learning-controls')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-text="summer-count-poppy"]')).not.toHaveText('');
  await expect(page.locator('[data-text="summer-count-ladybird"]')).not.toHaveText('');
  expect(errors).toEqual([]);
});
