import type { Species } from './types';

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
}

/** The species mix for the next day's meadow, given the day before.
 *
 * This is the hook for multi-day play, where flowers the bee pollinated come
 * back in greater numbers. It returns an even mix for now. A first version
 * could be:
 *
 *   weight = 1 + 0.12 * previous.pollinatedBySpecies[species]
 *
 * with a floor (say 0.4) so no species disappears from the meadow. */
export function speciesMixAfter(previous: DayOutcome | null): SpeciesMix {
  void previous;
  return { ...EVEN_MIX };
}
