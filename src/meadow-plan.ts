import type { Species } from './types';
import type { DayTier } from './day-report';

/** Relative share of each species among the meadow's seeded flowers. Only the
 * proportions matter; the six hand-placed opening flowers are never affected. */
export type SpeciesMix = Record<Species, number>;

export const EVEN_MIX: SpeciesMix = { daisy: 1, poppy: 1, cornflower: 1 };

/** What a finished day leaves behind for the next one. Add fields here as
 * multi-day play grows (flowers visited, harvest delivered, and so on). */
export interface DayOutcome {
  pollinatedBySpecies: Record<Species, number>;
  /** True when the harvest reached the hive; false for a lost or restarted day. */
  completed: boolean;
  /** The day's result tier at the hive, 'lost' when the bee didn't get home,
   * or null for a day restarted partway. */
  tier: DayTier | 'lost' | null;
}

/** The species mix for the next day's meadow, given the day before.
 *
 * Flowers the bee pollinated set seed and come back in greater numbers; kinds it
 * skipped thin out a little. Pollination counts even on a day the bee didn't get
 * home. Each weight is 0.75 + 0.1 per flower pollinated, kept between 0.5 and
 * 1.8, so no kind ever disappears. A day with no pollination keeps an even mix. */
export function speciesMixAfter(previous: DayOutcome | null): SpeciesMix {
  if (!previous) return { ...EVEN_MIX };
  const weight = (species: Species) => Math.min(1.8, Math.max(.5, .75 + .1 * (previous.pollinatedBySpecies[species] ?? 0)));
  return { daisy: weight('daisy'), poppy: weight('poppy'), cornflower: weight('cornflower') };
}
