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
  return [last ? 'The Queen’s fifth summer, and her last.' : '', low].filter(Boolean).join(' ');
}

/** The end of a run, in words (until the winter and leaving scenes are made). */
export function endingLine(ending: ArcEnding): string {
  return ending === 'wintered' ? 'Five summers done, and the Queen’s last. The colony is strong: in spring it will swarm.'
    : ending === 'lean' ? 'Five summers done, and the Queen’s last. A young queen will take her place, and the colony will just get by.'
    : ending === 'collapse' ? 'Five summers done, and the Queen’s last. There isn’t enough honey to see the colony through the winter.'
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
  /** How the summer went, for its colour: bright (fantastic, good), fair (reasonable), poor (okay, lost). */
  tone: 'bright' | 'fair' | 'poor';
  /** Small pictures of what went well or badly (up to four), with words for each. */
  marks: { kind: SummerMark; good: boolean; label: string }[];
}

export type SummerMark = 'honey' | 'flowers' | 'friends' | 'water' | 'helped' | 'wilted' | 'lightLoad' | 'dryStalks' | 'thirsty';

/** What a summer did well or badly, shown as small pictures on its card. */
export function summerMarks(r: SummerRecord): SummerCard['marks'] {
  const lost = r.outcome === 'lost', load = haul(r), hotDay = r.waterGoal > 0, watered = hotDay && r.water >= r.waterGoal - 1e-6;
  const marks: SummerCard['marks'] = [];
  const add = (kind: SummerMark, good: boolean, label: string, when: boolean) => { if (when) marks.push({ kind, good, label }); };
  add('wilted', false, 'Didn’t make it home', lost);
  add('honey', true, 'A full load home', !lost && load >= .85);
  add('flowers', true, `${r.pollinated} flowers pollinated`, r.pollinated >= 8);
  add('friends', true, 'Meadow friends met', r.friends >= 3);
  add('water', true, 'Water for the hot hive', watered);
  add('helped', true, r.helped === 1 ? 'A tired sister helped home' : `${r.helped} tired sisters helped home`, r.helped > 0);
  add('lightLoad', false, 'A light load', !lost && load < .45);
  add('dryStalks', false, r.meadow < .8 ? 'A thin meadow' : 'Few flowers pollinated', !lost && (r.pollinated <= 2 || r.meadow < .8));
  add('thirsty', false, 'The hive went thirsty', hotDay && !watered);
  // Bad news first when the day went badly, good news first otherwise; four at most.
  return marks.sort((a, b) => Number(lost ? a.good : b.good) - Number(lost ? b.good : a.good)).slice(0, 4);
}

/** The Queen's Farewell: her speech at the end of a run, with a card per summer. */
export interface RunSummary {
  title: string;
  /** What becomes of the colony, as a short heading ("A swarm in spring"). */
  outcome: string;
  /** Happy, bittersweet or sad: sets the page's tone. */
  mood: 'happy' | 'bittersweet' | 'sad';
  cards: SummerCard[];
  /** Her speech, a paragraph at a time. */
  speech: string[];
  /** The bee facts behind it, plainly. */
  facts: string;
}

const DAY: Record<SummerOutcome, string> = { fantastic: 'Fantastic', good: 'Good', reasonable: 'Reasonable', okay: 'Okay', lost: 'Not home' };
const SEASON: Record<NonNullable<SummerRecord['season']>, string> = { wet: 'Wet', ordinary: 'Mild', dry: 'Dry', hotdry: 'Hot, dry' };
const OUTCOME: Record<ArcEnding, [string, RunSummary['mood']]> = {
  wintered: ['A swarm in spring', 'happy'], lean: ['A new queen', 'bittersweet'],
  collapse: ['A hungry winter', 'sad'], absconded: ['The colony moves on', 'sad'],
};

/** The run of summers, as the Queen's farewell speech (once the run has ended). */
export function runSummary(state: HiveState): RunSummary | null {
  const ending = state.ending, all = state.summers;
  if (!ending || !all.length) return null;
  const first = all[0], last = all[all.length - 1], n = all.length;
  const cards: SummerCard[] = all.map(r => ({
    summer: r.summer, day: DAY[r.outcome], lost: r.outcome === 'lost',
    weather: `${SEASON[r.season ?? 'ordinary']}${r.hot && r.season !== 'hotdry' ? ', hot' : ''}${(r.showers ?? 0) > 0 && r.season !== 'wet' ? ', showers' : ''}`,
    haul: Math.min(1, haul(r)), pollinated: r.pollinated, flowers: Math.round(r.meadow * NORMAL_FLOWERS),
    tone: r.outcome === 'fantastic' || r.outcome === 'good' ? 'bright' : r.outcome === 'reasonable' ? 'fair' : 'poor',
    marks: summerMarks(r),
  }));

  // Opening: who is speaking, and why "you" were every summer's forager.
  const opening = `My daughters, and you, little forager: ${count(n, 'summer has', 'summers have')} passed since this hive was mine. A queen can live five years; a forager in summer lives about six weeks. So it was never one bee who flew for me. It was a daughter each summer, and you were every one of them.`;

  // The weather she remembers.
  const wet = all.filter(r => r.season === 'wet').length, dry = all.filter(r => r.season === 'dry' || r.season === 'hotdry').length;
  const showers = all.reduce((k, r) => k + (r.showers ?? 0), 0);
  const hot = all.filter(r => r.waterGoal > 0), watered = hot.filter(r => r.water >= r.waterGoal - 1e-6).length;
  const kinds = [wet ? count(wet, 'wet summer', 'wet summers') : '', dry ? count(dry, 'dry one', 'dry ones') : ''].filter(Boolean);
  const weather = [
    kinds.length ? `We had ${kinds.join(' and ')}${wet + dry < n ? ', and the rest were mild' : ''}.` : 'The summers were mild, one after another.',
    showers ? `You sheltered from ${count(showers, 'shower', 'showers')}.` : '',
    hot.length ? `On ${count(hot.length, 'hot day', 'hot days')} the comb needed cooling, and you carried water home on ${watered === hot.length ? (hot.length === 1 ? 'it' : 'all of them') : WORDS[watered] ?? watered}.` : '',
  ].filter(Boolean).join(' ');

  // The meadow.
  const pollinated = all.reduce((k, r) => k + r.pollinated, 0);
  const f1 = Math.round(first.meadow * NORMAL_FLOWERS), fn = Math.round(last.meadow * NORMAL_FLOWERS);
  const change = fn >= f1 + 4 ? `The meadow grew from ${f1} flowers to ${fn}; it is fuller for your visits.` : fn <= f1 - 4 ? `The meadow thinned from ${f1} flowers to ${fn}. I worry for it.` : `The meadow held at about ${fn} flowers.`;
  const ground = last.moisture < first.moisture - .15 ? ' The ground grew drier.' : last.moisture > first.moisture + .15 ? ' The ground grew damper.' : '';
  const meadow = `${pollinated ? `You pollinated ${pollinated} ${pollinated === 1 ? 'flower' : 'flowers'}.` : 'No flowers were pollinated.'} ${change}${ground}`;

  // The hive: what came home, the lost days, the hive mates helped, her best summer.
  const jars = Math.round(all.reduce((k, r) => k + r.nectar, 0) / 100), pouches = Math.round(all.reduce((k, r) => k + r.pollen, 0) / 140);
  const lost = all.filter(r => r.outcome === 'lost').length, helped = all.reduce((k, r) => k + r.helped, 0);
  const RANK: Record<SummerOutcome, number> = { fantastic: 4, good: 3, reasonable: 2, okay: 1, lost: 0 };
  const score = (r: SummerRecord) => RANK[r.outcome] * 2 + haul(r);
  const best = all.reduce((b, r) => score(r) > score(b) ? r : b, first);
  const hive = [
    jars || pouches ? `You brought home about ${count(jars, 'jar', 'jars')} of nectar and ${count(pouches, 'pouch', 'pouches')} of pollen.` : 'Little came home.',
    lost ? (lost === 1 ? 'One day you didn’t come back to us.' : `On ${WORDS[lost] ?? lost} days you didn’t come back to us.`) : '',
    helped ? `You helped ${count(helped, 'tired sister', 'tired sisters')} home.` : '',
    best.outcome !== 'lost' && best.outcome !== 'okay' ? `Summer ${best.summer} was your finest.` : '',
  ].filter(Boolean).join(' ');

  // Her farewell: what becomes of her and the colony.
  const farewell = ending === 'wintered'
    ? 'The comb is heavy with honey and the hive is crowded, so in spring we will swarm. I will fly out with half of you to find a new home, and a young queen, my daughter, will stay to reign here. One hive becomes two. That is how bees thank a good meadow.'
    : ending === 'lean'
    ? 'I am old now, and my scent is fading. You have already begun to raise a young queen in a cell on the comb. When she emerges she will take my place, and I will slip away. The stores are thin, but they are enough, and she will begin her reign in a meadow you kept alive.'
    : ending === 'collapse'
    ? 'I am old, and there is too little honey for the winter. The cluster cannot keep warm until spring, and the colony will dwindle, and I with it. But the flowers you pollinated will seed next year’s meadow, for whichever bees come after us.'
    : 'The meadow could not feed us, and we cannot stay. Tomorrow we leave together, all of us, to look for a richer place, and the empty comb stays behind. I am sorry, little one. You did what one bee can do.';

  const facts = 'True to bees: a honeybee queen lives two to five years; a worker in summer, about six weeks. When a queen grows old the workers raise a new one (supersedure), and a strong colony swarms: the old queen leaves with half the workers, and a daughter takes the hive. A colony short of food can leave its hive altogether (absconding).';
  const [outcome, mood] = OUTCOME[ending];
  return { title: 'The Queen’s Farewell', outcome, mood, cards, speech: [opening, weather, meadow, hive, farewell].map(capital), facts };
}
