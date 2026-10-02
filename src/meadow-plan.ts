import type { Species } from './types';
import type { DayTier } from './day-report';

/**
 * Summers: each round is one day that stands for a whole summer, and what the
 * bee pollinates shapes the next summer's meadow. Pure functions only, so the
 * rules can be tested without a scene.
 *
 * - Poppies and cornflowers are annuals. They grow back from seed, so their
 *   numbers follow how many were pollinated, and seedlings sprout around the
 *   flowers that set seed, some close by and more blown across the meadow.
 *   Unpollinated ones leave gaps.
 * - A small seed bank is the way back, not a cushion: it shrinks after
 *   summers in a row with no pollination, down to a single flower.
 * - Oxeye daisies are perennials. They keep their places and change slowly.
 * - Aphids live on poppy and cornflower stems; ladybirds follow the aphids and
 *   use daisies as backup food, so both follow the flowers. Butterflies follow
 *   the nectar flowers (daisies and cornflowers).
 * The six hand-placed opening flowers never change.
 */
export type SpeciesCounts = Record<Species, number>;
/** Relative share of each species, used only for the very first meadow. */
export type SpeciesMix = SpeciesCounts;
export const EVEN_MIX: SpeciesMix = { daisy: 1, poppy: 1, cornflower: 1 };
export const SPECIES_ORDER: readonly Species[] = ['daisy', 'poppy', 'cornflower'];
export const ANNUAL: Readonly<Record<Species, boolean>> = { daisy: false, poppy: true, cornflower: true };

export const MEADOW_PLAN = {
  /** Seeded flowers of each kind in a normal meadow (66 in all, plus the six opening flowers). */
  normalEach: 22,
  /** Opening flowers of each kind (never change). */
  fixedEach: 2,
  maxEach: 40,
  maxTotal: 84,
  /** Annuals: next summer = normal × (bank + perPollinated × pollinated), capped at maxEach. */
  annualPerPollinated: .2,
  /** Seed bank share and minimum by summers in a row with none of that kind pollinated (0, 1, 2, 3+). */
  annualBank: [.3, .3, .15, .06],
  annualMinimum: [3, 3, 2, 1],
  /** Daisies: × (shrink + perPollinated × pollinated), at most × maxGrowth. */
  perennialShrink: .88,
  perennialPerPollinated: .06,
  perennialMaxGrowth: 1.15,
  perennialMinimum: 6,
  /** Placement, matching the seeded meadow in world.ts. */
  spacing: 2.05,
  inner: 5.8,
  outer: 23.3,
  centerZ: -3,
  /** Seedlings: this share lands close to the flower that set seed (within
   * seedReach); the rest blow further (blownReach), so kinds mix across the
   * meadow instead of forming patches. Real poppy capsules shake seed out as
   * they sway and cornflower seed travels a little too; at 10 cm a unit, the
   * whole meadow is only a few metres across. */
  seedReach: 3,
  localShare: .3,
  blownReach: [5, 28],
} as const;

const zero = (): SpeciesCounts => ({ daisy: 0, poppy: 0, cornflower: 0 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far ground moisture (0 parched – 1 sodden, .5 ordinary) is from ordinary,
 * each side 0–1. The meadow's look (world.ts) uses the same scale. */
export function moistureShift(moisture = .5): { dry: number; wet: number } {
  return { dry: clamp((.5 - moisture) / .4, 0, 1), wet: clamp((moisture - .5) / .4, 0, 1) };
}
/** Each kind's multiplier at full dry and full wet (see docs/design/Seasons_Design.md).
 * Poppies and cornflowers are annuals of open, well-drained ground; the oxeye
 * daisy is a grassland perennial that suffers in drought. Small, so the bee's
 * pollination still leads. */
export const MOISTURE_SPECIES: Readonly<Record<Species, { dry: number; wet: number }>> = {
  daisy: { dry: .8, wet: 1.15 }, poppy: { dry: 1.25, wet: .8 }, cornflower: { dry: 1.1, wet: 1 },
};
export function moistureFactor(species: Species, moisture = .5): number {
  const { dry, wet } = moistureShift(moisture), k = MOISTURE_SPECIES[species];
  return 1 + (k.dry - 1) * dry + (k.wet - 1) * wet;
}
/** The first summer's mix for this ground (even when ordinary). */
export function moistureMix(moisture = .5): SpeciesMix {
  return { daisy: moistureFactor('daisy', moisture), poppy: moistureFactor('poppy', moisture), cornflower: moistureFactor('cornflower', moisture) };
}

/** What a finished day leaves behind for the next one. */
export interface DayOutcome {
  pollinatedBySpecies: SpeciesCounts;
  /** True when the harvest reached the hive; false for a lost or restarted day. */
  completed: boolean;
  /** The day's result tier at the hive, 'lost' when the bee didn't get home,
   * or null for a day restarted partway. */
  tier: DayTier | 'lost' | null;
}

/** A flower's place in the meadow, carried from one summer to the next. */
export interface FlowerSpot { species: Species; x: number; z: number; height: number; radius: number }
export interface PastFlower extends FlowerSpot { pollinated: boolean }

export function countSpecies(spots: readonly { species: Species }[]): SpeciesCounts {
  const counts = zero();
  for (const spot of spots) counts[spot.species]++;
  return counts;
}

/** Summers in a row with no flower of each kind pollinated, after this one. */
export function nextBadSummers(previous: SpeciesCounts, pollinated: SpeciesCounts): SpeciesCounts {
  const out = zero();
  for (const s of SPECIES_ORDER) out[s] = (pollinated[s] ?? 0) > 0 ? 0 : (previous[s] ?? 0) + 1;
  return out;
}

/** How many seeded flowers of each kind grow next summer.
 * @param seeded this summer's seeded flowers (not the six opening ones)
 * @param pollinated flowers pollinated this summer, opening ones included
 * @param badSummers streaks after this summer (see nextBadSummers)
 * @param moisture next summer's ground moisture, which nudges each kind (moistureFactor) */
export function nextCounts(seeded: SpeciesCounts, pollinated: SpeciesCounts, badSummers: SpeciesCounts, moisture = .5): SpeciesCounts {
  const p = MEADOW_PLAN, out = zero();
  for (const s of SPECIES_ORDER) {
    const helped = pollinated[s] ?? 0, ground = moistureFactor(s, moisture);
    if (ANNUAL[s]) {
      const streak = Math.min(3, badSummers[s] ?? 0);
      out[s] = clamp(Math.round(p.normalEach * (p.annualBank[streak] + p.annualPerPollinated * helped) * ground), p.annualMinimum[streak], p.maxEach);
    } else {
      const factor = Math.min(p.perennialMaxGrowth, p.perennialShrink + p.perennialPerPollinated * helped) * ground;
      out[s] = clamp(Math.round((seeded[s] ?? 0) * factor), p.perennialMinimum, p.maxEach);
    }
  }
  const total = SPECIES_ORDER.reduce((sum, s) => sum + out[s], 0);
  if (total > p.maxTotal) for (const s of SPECIES_ORDER) out[s] = Math.max(1, Math.floor(out[s] * p.maxTotal / total));
  return out;
}

/** Aphid clusters, ladybirds, butterflies, snails and caterpillars for a meadow
 * with these flower counts (opening flowers included) and ground moisture. A
 * normal meadow in an ordinary summer has 14 clusters, 18 ladybirds, 8
 * butterflies, 12 snails and 5 caterpillars. Butterflies want nectar only, so
 * they follow the daisies and cornflowers and leave a poppy-heavy meadow.
 * Moisture changes them boldly, so a summer's character shows within a minute:
 * a dry one is an ant-and-ladybird summer (aphids boom, butterflies bask, snails
 * seal up), a wet one a snail summer (rain knocks the aphids off, butterflies
 * shelter, caterpillars find lush leaves). */
export function friendCounts(all: SpeciesCounts, moisture = .5): { aphidClusters: number; ladybirds: number; butterflies: number; snails: number; caterpillars: number } {
  const normal = MEADOW_PLAN.normalEach + MEADOW_PLAN.fixedEach, { dry, wet } = moistureShift(moisture);
  const hosts = (all.poppy ?? 0) + (all.cornflower ?? 0);
  const aphidClusters = clamp(Math.round(14 * hosts / (2 * normal) * (1 + .4 * dry - .35 * wet)), 2, 24);
  const ladybirds = clamp(Math.round(18 * (.65 * aphidClusters / 14 + .35 * (all.daisy ?? 0) / normal)), 4, 28);
  const butterflies = clamp(Math.round(8 * ((all.daisy ?? 0) + (all.cornflower ?? 0)) / (2 * normal) * (1 + .3 * dry - .4 * wet)), 1, 14);
  // Snails need the damp shade of a full meadow: 12 normally, fewer when it's thin, and many more in a wet summer.
  const flowersTotal = (all.daisy ?? 0) + (all.poppy ?? 0) + (all.cornflower ?? 0);
  const snails = clamp(Math.round(12 * flowersTotal / (3 * normal) * (1 - .55 * dry + .65 * wet)), 2, 20);
  const caterpillars = Math.round(5 + 3 * wet - dry);
  return { aphidClusters, ladybirds, butterflies, snails, caterpillars };
}

export interface SummerPlan {
  /** Next summer's seeded flowers, in planting order. */
  spots: FlowerSpot[];
  /** Where unpollinated annuals stood and nothing grew back. */
  gaps: FlowerSpot[];
  counts: SpeciesCounts;
  badSummers: SpeciesCounts;
}

/** Lays out next summer's meadow from this one.
 * @param fixed the six opening flowers (spacing only; pollinated ones also seed nearby)
 * @param seeded this summer's other flowers */
export function planNextSummer(input: { fixed: readonly PastFlower[]; seeded: readonly PastFlower[]; badSummers: SpeciesCounts; random: () => number; moisture?: number }): SummerPlan {
  const { fixed, seeded, random } = input, p = MEADOW_PLAN;
  const pollinated = countSpecies([...fixed, ...seeded].filter(f => f.pollinated));
  const badSummers = nextBadSummers(input.badSummers, pollinated);
  const counts = nextCounts(countSpecies(seeded), pollinated, badSummers, input.moisture);

  const taken: { x: number; z: number }[] = fixed.map(f => ({ x: f.x, z: f.z }));
  const spots: FlowerSpot[] = [];
  const planted = zero();
  const fits = (x: number, z: number) => {
    const r = Math.hypot(x, z - p.centerZ);
    return r >= p.inner && r <= p.outer && taken.every(t => Math.hypot(t.x - x, t.z - z) >= p.spacing);
  };
  const add = (spot: FlowerSpot) => { spots.push(spot); taken.push(spot); planted[spot.species]++; };
  const sprout = (species: Species, x: number, z: number): FlowerSpot => ({ species, x, z, height: 2.8 + random() * 2.1, radius: .68 + random() * .36 });
  const near = (species: Species, parent: { x: number; z: number }, reach: number, from = p.spacing * .9) => {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = random() * Math.PI * 2, d = from + random() * (reach - from);
      const x = parent.x + Math.cos(angle) * d, z = parent.z + Math.sin(angle) * d;
      if (fits(x, z)) return sprout(species, x, z);
    }
    return null;
  };
  const anywhere = (species: Species) => {
    for (let attempt = 0; attempt < 600; attempt++) {
      const angle = random() * Math.PI * 2, r = p.inner + Math.sqrt(random()) * (p.outer - p.inner);
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r + p.centerZ;
      if (fits(x, z)) return sprout(species, x, z);
    }
    return null;
  };
  const shuffled = <T>(items: readonly T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  /** New plants from parents in turn: some close by, the rest blown further. */
  const spread = (species: Species, target: number, parents: readonly { x: number; z: number }[], local: number = p.localShare) => {
    let stuck = 0;
    for (let i = 0; planted[species] < target && parents.length && stuck < parents.length * 2; i++) {
      const parent = parents[i % parents.length];
      const spot = random() < local ? near(species, parent, p.seedReach) : near(species, parent, p.blownReach[1], p.blownReach[0]);
      if (spot) { add(spot); stuck = 0; } else stuck++;
    }
    while (planted[species] < target) { const spot = anywhere(species); if (!spot) break; add(spot); }
  };

  // Daisies first: perennial clumps keep their places (pollinated ones surely),
  // and new ones spread from pollinated daisies, or any daisy.
  const daisies = seeded.filter(f => f.species === 'daisy');
  const keepOrder = [...shuffled(daisies.filter(f => f.pollinated)), ...shuffled(daisies.filter(f => !f.pollinated))];
  for (const d of keepOrder.slice(0, counts.daisy)) add({ species: 'daisy', x: d.x, z: d.z, height: d.height, radius: d.radius });
  const daisyParents = [...fixed, ...seeded].filter(f => f.species === 'daisy' && f.pollinated);
  spread('daisy', counts.daisy, daisyParents.length ? daisyParents : daisies, 1);

  // Annuals: a seedling where each pollinated flower stood, the seed bank at a
  // few old places, then more seedlings around the flowers that set seed.
  const gaps: FlowerSpot[] = [];
  for (const species of SPECIES_ORDER.filter(s => ANNUAL[s])) {
    const target = counts[species];
    const old = seeded.filter(f => f.species === species);
    const parents = [...fixed, ...seeded].filter(f => f.species === species && f.pollinated);
    for (const parent of shuffled(old.filter(f => f.pollinated))) {
      if (planted[species] >= target) break;
      if (fits(parent.x, parent.z)) add(sprout(species, parent.x, parent.z));
    }
    const bank = Math.min(target, Math.round(p.normalEach * p.annualBank[Math.min(3, badSummers[species])]));
    for (const spot of shuffled(old.filter(f => !f.pollinated))) {
      if (planted[species] >= Math.max(bank, target - parents.length * 6) || planted[species] >= target) break;
      if (fits(spot.x, spot.z)) add(sprout(species, spot.x, spot.z));
    }
    spread(species, target, parents.length ? parents : old);
    for (const spot of old) if (!spot.pollinated && !spots.some(s => Math.hypot(s.x - spot.x, s.z - spot.z) < 1)) gaps.push({ ...spot });
  }
  return { spots, gaps, counts, badSummers };
}

/** Next summer's change for one kind, for the results screen and morning line. */
export type Trend = 'more' | 'fewer' | 'same';
export function trend(now: number, next: number): Trend {
  const change = next - now;
  if (Math.abs(change) < Math.max(2, now * .15)) return 'same';
  return change > 0 ? 'more' : 'fewer';
}

/** 0–1: how dry a thin meadow keeps the ground (a normal meadow of 72 is 0).
 * Snails in a dry meadow more often stay sealed, even when it's damp. */
export function meadowDryness(all: SpeciesCounts): number {
  const total = (all.daisy ?? 0) + (all.poppy ?? 0) + (all.cornflower ?? 0);
  return clamp((3 * (MEADOW_PLAN.normalEach + MEADOW_PLAN.fixedEach) - total) / 36, 0, 1);
}
