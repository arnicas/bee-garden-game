/**
 * Saving a run of summers in the browser (localStorage), so five summers needn't be
 * played in one sitting. Saved when a summer ends (home or lost), cleared when the
 * run ends or a new one starts. Everything is wrapped in try/catch: with storage
 * blocked or full the game plays on, it just won't remember.
 *
 * The save holds the finished summer as it ended (its flowers, which were
 * pollinated, the day's weather and the carried-over values). Continuing rebuilds
 * that meadow and then moves on to the next summer by the same path as "Next
 * summer", so next summer's meadow grows exactly as it would have.
 */
import type { DayTier } from './day-report';
import type { HiveState } from './hive-stores';
import type { FlowerSpot, SpeciesCounts } from './meadow-plan';
import type { Species } from './types';
import type { WeatherPlan } from './weather';

const KEY = 'bee-garden-run-v1';

export interface RunSave {
  v: 1;
  /** The summer that has just ended. */
  summer: number;
  /** That summer's meadow: its seed and seeded flower spots (the fixed flowers are always the same). */
  seed: number;
  spots: FlowerSpot[];
  /** Which flowers were pollinated, by index (fixed flowers first). */
  pollinated: boolean[];
  won: boolean;
  tier: DayTier | null;
  pollinatedBySpecies: Record<Species, number>;
  waterGoal: number;
  weatherPlan: WeatherPlan;
  groundMoisture: number;
  badSummers: SpeciesCounts;
  outcomes: (DayTier | 'lost')[];
  hotDays: number;
  waterDays: number;
  hive: HiveState;
  savedAt: number;
}

export function readRun(): RunSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as RunSave;
    const ok = save && save.v === 1 && Number.isFinite(save.summer) && save.summer >= 1 && Number.isFinite(save.seed)
      && Array.isArray(save.spots) && Array.isArray(save.pollinated) && save.weatherPlan && save.hive && Array.isArray(save.hive.summers) && !save.hive.ending;
    return ok ? save : null;
  } catch { return null; }
}

export function writeRun(save: RunSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage blocked or full: the run lasts this visit */ }
}

export function clearRun(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
