/**
 * The hive's stores across a run of five summers (docs/design/Summers_Arc.md).
 *
 * There is no hive meter: these numbers stay hidden and are felt through words and
 * scenes (the Queen, the start page, the bees at the entrance, fallen bees, the
 * ending). Stores are counted in "winters": 1 is about what the colony needs to see
 * one winter through. First guesses, meant to be tuned through play.
 *
 * In play, a summer's honey is her haul times the meadow: what she brought home, and
 * how many flowers the meadow holds (which her pollination builds, summer after
 * summer). A lost day brings nothing. The words around it say why one bee's haul
 * stands for the hive's: a forager who comes home loaded dances, and the dance sends
 * her sisters to the same flowers (recruitment). That's true to honeybees.
 */
import type { SummerOutcome } from './day-report';

export const ARC = {
  summers: 5,
  /** Stores at the start of the first summer (a colony that came through one winter). */
  start: 1,
  /** What the colony eats and uses each summer, raising brood. */
  use: 1,
  /** A summer's honey from a full haul (1) in a normal meadow. */
  honey: 1.15,
  /** A hot day with too little water: brood overheats and foragers go for water instead. */
  thirst: .2,
  /** The most the hive can hold (comb space). */
  most: 3,
  /** At the end of summer five: a good winter at or above this, a lean one at or above `lean`. */
  good: 1.6,
  lean: .9,
  /** Leaving early: stores below this after two poor summers in a row (from summer 3). */
  leave: .3,
};

export type ArcEnding = 'wintered' | 'lean' | 'collapse' | 'absconded';

/** What one summer brought home, recorded when it ends. */
export interface SummerRecord {
  summer: number;
  outcome: SummerOutcome;
  /** Delivered to the hive (0 when lost). */
  nectar: number;
  pollen: number;
  /** Water carried home on a hot day, and how much the hive asked for (0 on other days). */
  water: number;
  waterGoal: number;
  /** Flowers in the meadow this summer, against a normal meadow (1 = 72 flowers). */
  meadow: number;
  pollinated: number;
  /** Ground moisture at the end of the summer, 0 parched – 1 sodden. */
  moisture: number;
  friends: number;
  helped: number;
  /** The summer's weather: its season, how many showers, and whether the hive asked for water in the heat. */
  season?: 'wet' | 'ordinary' | 'dry' | 'hotdry';
  showers?: number;
  hot?: boolean;
}

export interface HiveState {
  stores: number;
  /** Oldest first. */
  summers: SummerRecord[];
  ending: ArcEnding | null;
}

export function newHive(): HiveState {
  return { stores: ARC.start, summers: [], ending: null };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 0–1.2: how loaded the bee came home (nectar against the goal, pollen against the pouch). */
export function haul(r: Pick<SummerRecord, 'outcome' | 'nectar' | 'pollen'>): number {
  if (r.outcome === 'lost') return 0;
  return clamp(.5 * Math.min(1.4, r.nectar / 45) + .5 * Math.min(1, r.pollen / 140), 0, 1.2);
}

/** The change in stores over one summer, with the reasons (for the end-of-run summary). */
export function summerGain(r: SummerRecord): { gain: number; honey: number; thirst: number } {
  const meadow = clamp(r.meadow, .3, 1.4);
  const honey = meadow * ARC.honey * haul(r);
  const thirst = r.waterGoal > 0 && r.water < r.waterGoal - 1e-6 ? ARC.thirst * (1 - r.water / r.waterGoal) : 0;
  return { gain: honey - thirst - ARC.use, honey, thirst };
}

const poor = (o: SummerOutcome) => o === 'lost' || o === 'okay';

/** Adds a finished summer; returns the new state, with an ending once the run is over. */
export function recordSummer(state: HiveState, r: SummerRecord): HiveState {
  if (state.ending) return state;
  const summers = [...state.summers, r];
  const stores = clamp(state.stores + summerGain(r).gain, 0, ARC.most);
  let ending: ArcEnding | null = null;
  const lastTwo = summers.slice(-2);
  // Leaving early takes real neglect: two poor summers in a row on low stores, never before summer 3.
  if (summers.length >= 3 && summers.length < ARC.summers && stores < ARC.leave && lastTwo.length === 2 && lastTwo.every(s => poor(s.outcome))) ending = 'absconded';
  else if (summers.length >= ARC.summers) ending = stores >= ARC.good ? 'wintered' : stores >= ARC.lean ? 'lean' : 'collapse';
  return { stores, summers, ending };
}

/**
 * 0–1: how hard the colony is pressed, for things the player sees (fallen bees,
 * the bees at the entrance, the start page's "stores are low", the Queen). None in
 * the first summer. Low stores press most; a hot summer without water adds to it.
 */
export function hiveStress(state: HiveState): number {
  if (!state.summers.length) return 0;
  const last = state.summers[state.summers.length - 1];
  const low = clamp((1.1 - state.stores) / .9, 0, 1);
  const thirsty = last.waterGoal > 0 && last.water < last.waterGoal - 1e-6 ? .25 : 0;
  return clamp(low + thirsty, 0, 1);
}

/** A typical day of each kind, for starting partway through a run (dev: ?arc=GGOL). */
const SAMPLE: Record<string, [SummerOutcome, number, number]> = {
  F: ['fantastic', 90, 140], G: ['good', 60, 140], R: ['reasonable', 45, 100], O: ['okay', 25, 60], L: ['lost', 0, 0],
};
export function hiveFromCode(code: string): HiveState {
  return [...code.toUpperCase()].filter(c => SAMPLE[c]).reduce((state, c, i) => {
    const [outcome, nectar, pollen] = SAMPLE[c];
    return recordSummer(state, { summer: i + 1, outcome, nectar, pollen, water: 0, waterGoal: 0, meadow: 1, pollinated: 0, moisture: .5, friends: 0, helped: 0 });
  }, newHive());
}

/** One line for the start page about the hive, or '' when there's nothing to say. */
export function hiveLine(state: HiveState, summer: number): string {
  const word = storesWord(state.stores), last = summer >= ARC.summers;
  const low = word === 'very low' ? 'The hive’s stores are very low. The colony needs a good summer.'
    : word === 'low' ? 'The hive’s stores are low. A full jar and pouch today would help.' : '';
  return [last ? 'The last summer before winter.' : '', low].filter(Boolean).join(' ');
}

/** The end of a run, in words (until the winter and leaving scenes are made). */
export function endingLine(ending: ArcEnding): string {
  return ending === 'wintered' ? 'Five summers done. The comb is full of honey, and the colony will cluster warm through the winter.'
    : ending === 'lean' ? 'Five summers done. A lean winter: there is just enough honey to see the colony through.'
    : ending === 'collapse' ? 'Five summers done, but there isn’t enough honey stored to see the colony through the winter.'
    : 'There wasn’t enough in the meadow to see the colony through. They have gone to find a better place.';
}

/** Stores in words, for the start page and the Queen (never a number). */
export function storesWord(stores: number): 'plenty' | 'enough' | 'low' | 'very low' {
  return stores >= 1.6 ? 'plenty' : stores >= 1 ? 'enough' : stores >= .5 ? 'low' : 'very low';
}

/** Flowers in a normal meadow (the `meadow` share of 1). */
const NORMAL_FLOWERS = 72;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number, one: string, many: string) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface SummerCard {
  summer: number;
  /** How the day went, in a word or two ("Good", "Not home"). */
  day: string;
  /** The summer's weather in a word or two ("Wet", "Hot, dry"). */
  weather: string;
  /** 0–1: how loaded she came home, for a small honey bar. */
  haul: number;
  pollinated: number;
  flowers: number;
  lost: boolean;
}

export interface RunSummary {
  title: string;
  ending: string;
  cards: SummerCard[];
  weather: string;
  meadow: string;
  hive: string;
  queen: string;
}

const DAY: Record<SummerOutcome, string> = { fantastic: 'Fantastic', good: 'Good', reasonable: 'Reasonable', okay: 'Okay', lost: 'Not home' };
const SEASON: Record<NonNullable<SummerRecord['season']>, string> = { wet: 'Wet', ordinary: 'Mild', dry: 'Dry', hotdry: 'Hot, dry' };

/** The run of summers, summed up for the closing page (once it has an ending). */
export function runSummary(state: HiveState): RunSummary | null {
  const ending = state.ending, all = state.summers;
  if (!ending || !all.length) return null;
  const first = all[0], last = all[all.length - 1];
  const cards: SummerCard[] = all.map(r => ({
    summer: r.summer, day: DAY[r.outcome], lost: r.outcome === 'lost',
    weather: `${SEASON[r.season ?? 'ordinary']}${r.hot && r.season !== 'hotdry' ? ', hot' : ''}${(r.showers ?? 0) > 0 && r.season !== 'wet' ? ', showers' : ''}`,
    haul: Math.min(1, haul(r)), pollinated: r.pollinated, flowers: Math.round(r.meadow * NORMAL_FLOWERS),
  }));

  // The weather: what kind of summers, the showers, and the heat (with the water she carried).
  const wet = all.filter(r => r.season === 'wet').length, dry = all.filter(r => r.season === 'dry' || r.season === 'hotdry').length;
  const showers = all.reduce((n, r) => n + (r.showers ?? 0), 0);
  const hot = all.filter(r => r.waterGoal > 0), watered = hot.filter(r => r.water >= r.waterGoal - 1e-6).length;
  const kinds = [wet ? count(wet, 'wet summer', 'wet summers') : '', dry ? count(dry, 'dry summer', 'dry summers') : ''].filter(Boolean);
  const weather = [
    kinds.length ? `${capital(kinds.join(' and '))}${wet + dry < all.length ? `, the rest mild` : ''}.` : 'Mild summers, one after another.',
    showers ? `${capital(count(showers, 'shower', 'showers'))} to shelter from.` : '',
    hot.length ? `${capital(count(hot.length, 'hot day', 'hot days'))}; you carried water home on ${watered === hot.length ? (hot.length === 1 ? 'it' : 'all of them') : WORDS[watered] ?? watered}.` : '',
  ].filter(Boolean).join(' ');

  // The meadow: what she pollinated, and how the meadow and its ground changed.
  const pollinated = all.reduce((n, r) => n + r.pollinated, 0);
  const f1 = Math.round(first.meadow * NORMAL_FLOWERS), fn = Math.round(last.meadow * NORMAL_FLOWERS);
  const change = fn >= f1 + 4 ? `The meadow grew from ${f1} flowers to ${fn}.` : fn <= f1 - 4 ? `The meadow thinned from ${f1} flowers to ${fn}.` : `The meadow held at about ${fn} flowers.`;
  const ground = last.moisture < first.moisture - .15 ? ' The ground grew drier.' : last.moisture > first.moisture + .15 ? ' The ground grew damper.' : '';
  const meadow = `${pollinated ? `You pollinated ${pollinated} ${pollinated === 1 ? 'flower' : 'flowers'} in ${count(all.length, 'summer', 'summers')}.` : 'No flowers were pollinated.'} ${change}${ground}`;

  // The hive: what came home, the days lost, the hive mates helped, and the stores now.
  const jars = Math.round(all.reduce((n, r) => n + r.nectar, 0) / 100), pouches = Math.round(all.reduce((n, r) => n + r.pollen, 0) / 140);
  const lost = all.filter(r => r.outcome === 'lost').length, helped = all.reduce((n, r) => n + r.helped, 0);
  const stores = storesWord(state.stores);
  const hive = [
    jars || pouches ? `You brought home about ${count(jars, 'jar', 'jars')} of nectar and ${count(pouches, 'pouch', 'pouches')} of pollen.` : 'Little came home.',
    lost ? (lost === 1 ? 'One day you didn’t make it home.' : `On ${WORDS[lost] ?? lost} days you didn’t make it home.`) : '',
    helped ? `You helped ${count(helped, 'tired hive mate', 'tired hive mates')} home.` : '',
    stores === 'plenty' ? 'The comb is full.' : stores === 'enough' ? 'The stores are enough.' : 'The stores are low.',
  ].filter(Boolean).join(' ');

  // The Queen: her feeling for the bee, the hive and the meadow.
  // Her best summer: the best day, then the fuller load.
  const RANK: Record<SummerOutcome, number> = { fantastic: 4, good: 3, reasonable: 2, okay: 1, lost: 0 };
  const score = (r: SummerRecord) => RANK[r.outcome] * 2 + haul(r);
  const best = all.reduce((b, r) => score(r) > score(b) ? r : b, first);
  const queen = ending === 'wintered' ? `The Queen will remember these summers all winter. Summer ${best.summer} was your finest.`
    : ending === 'lean' ? 'The Queen thanks you. It will be a thin winter, but they will see it through.'
    : ending === 'collapse' ? 'The Queen knows how hard the meadow was. There isn’t enough to last the winter.'
    : 'The Queen has led the colony away, to look for a richer meadow.';
  const forMeadow = fn >= f1 + 4 ? ' She says the meadow is fuller for your visits.' : fn <= f1 - 4 ? ' She worries for the meadow.' : '';
  const title = ending === 'wintered' ? 'Ready for winter' : ending === 'lean' ? 'A lean winter ahead' : ending === 'collapse' ? 'A hungry winter' : 'The colony has moved on';
  return { title, ending: endingLine(ending), cards, weather, meadow, hive, queen: queen + forMeadow };
}
