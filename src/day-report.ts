import type { Species, SummerPreview } from './types';
import { ANNUAL, friendCounts, SPECIES_ORDER, trend, type SpeciesCounts } from './meadow-plan';

/**
 * How a day at the hive is judged. Two ratings, delivery and pollination, pick
 * one of four tiers from a small table; pollination counts for more than cargo,
 * because it is what the meadow depends on. The thresholds are first guesses
 * from the game's numbers, meant to be tuned through play.
 */
export type DayTier = 'fantastic' | 'good' | 'reasonable' | 'okay';
export type Delivery = 'brimming' | 'full' | 'partial';
export type Pollination = 'flourishing' | 'allThree' | 'some' | 'few';

export const REPORT_THRESHOLDS = {
  /** The hive's nectar goal, after the flight home. */
  nectarGoal: 45,
  pollenGoal: 140,
  /** Jar capacity, for showing nectar as a share of the jar. */
  nectarCapacity: 100,
  /** Delivered nectar for a "brimming" jar (the most possible is 95). */
  brimmingNectar: 85,
  /** Flowers of each kind for a "flourishing" meadow. */
  flourishingEach: 4,
  /** Total pollinated for "some"; fewer counts as "few". */
  someTotal: 3,
};

export interface DayStats {
  /** Nectar and pollen delivered to the hive (after the flight home). */
  nectar: number;
  pollen: number;
  pollinatedBySpecies: Readonly<Record<Species, number>>;
  visited: number;
  flowerTotal: number;
}

export interface DayReport {
  tier: DayTier;
  delivery: Delivery;
  pollination: Pollination;
  title: string;
  queen: string;
  meadow: string;
  /** The stats behind the tier, as one short line. */
  why: string;
  /** Advice aimed at the weakest stat; empty on the better tiers. */
  tip: string;
}

const TIERS: Record<Delivery, Record<Pollination, DayTier>> = {
  brimming: { flourishing: 'fantastic', allThree: 'good', some: 'reasonable', few: 'okay' },
  full: { flourishing: 'good', allThree: 'good', some: 'reasonable', few: 'okay' },
  partial: { flourishing: 'reasonable', allThree: 'reasonable', some: 'okay', few: 'okay' },
};

const SPECIES: readonly Species[] = ['poppy', 'daisy', 'cornflower'];
const ONE: Record<Species, string> = { poppy: 'poppy', daisy: 'daisy', cornflower: 'cornflower' };
const MANY: Record<Species, string> = { poppy: 'poppies', daisy: 'daisies', cornflower: 'cornflowers' };

const list = (words: string[]) => words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function deliveryOf(stats: DayStats): Delivery {
  const t = REPORT_THRESHOLDS;
  const pollenFull = stats.pollen >= t.pollenGoal - 1e-6;
  if (pollenFull && stats.nectar >= t.brimmingNectar) return 'brimming';
  if (pollenFull && stats.nectar >= t.nectarGoal) return 'full';
  return 'partial';
}

export function pollinationOf(stats: DayStats): Pollination {
  const counts = SPECIES.map(species => stats.pollinatedBySpecies[species] ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (counts.every(n => n >= REPORT_THRESHOLDS.flourishingEach)) return 'flourishing';
  if (counts.every(n => n > 0)) return 'allThree';
  if (total >= REPORT_THRESHOLDS.someTotal) return 'some';
  return 'few';
}

export function dayReport(stats: DayStats): DayReport {
  const t = REPORT_THRESHOLDS;
  const delivery = deliveryOf(stats), pollination = pollinationOf(stats);
  const tier = TIERS[delivery][pollination];
  const total = SPECIES.reduce((sum, species) => sum + (stats.pollinatedBySpecies[species] ?? 0), 0);
  const helped = SPECIES.filter(species => (stats.pollinatedBySpecies[species] ?? 0) > 0);
  const missing = SPECIES.filter(species => !helped.includes(species));
  const pollen = Math.floor(stats.pollen + 1e-6);

  // Why: what was pollinated, then what came home.
  const why: string[] = [];
  if (pollination === 'flourishing') why.push(`All three flowers, ${t.flourishingEach} or more of each`, `${total} pollinated`);
  else if (pollination === 'allThree') why.push('All three flowers pollinated', `${total} pollinated`);
  else if (total > 0) why.push(`${total} pollinated (${list(helped.map(s => stats.pollinatedBySpecies[s] === 1 ? `a ${ONE[s]}` : MANY[s]))})`);
  else why.push('No flowers pollinated');
  const jar = Math.floor(Math.min(1, stats.nectar / t.nectarCapacity) * 100 + 1e-6), pouch = Math.floor(Math.min(1, stats.pollen / t.pollenGoal) * 100 + 1e-6);
  why.push(delivery === 'brimming' ? `Nectar jar brimming (${jar}%)` : `Jar ${jar}% full`);
  why.push(pollen >= t.pollenGoal ? 'Pollen pouch full' : `Pouch ${pouch}% full`);

  // One tip, aimed at what most held the day back.
  const pollinationTip = missing.length && total > 0
    ? `Next summer, carry ${ONE[missing[0]]} pollen to another ${ONE[missing[0]]}.`
    : 'Pollen on your legs pollinates the next flower of the same kind.';
  const deliveryTip = pollen < t.pollenGoal ? 'Next summer, fill your pollen pouch before heading home.' : 'Next summer, bring home a fuller nectar jar.';
  const weakPollination = pollination === 'some' || pollination === 'few';

  const lines: Record<DayTier, Pick<DayReport, 'title' | 'queen' | 'meadow' | 'tip'>> = {
    fantastic: {
      title: 'A fantastic day!',
      queen: 'The Queen is delighted. She’s telling the whole hive about you.',
      meadow: 'The meadow is humming. Every kind of flower will set seed.',
      tip: '',
    },
    good: {
      title: 'A good day',
      queen: 'The Queen is very pleased with your delivery.',
      meadow: 'Poppies, daisies and cornflowers all had a visit. The meadow is happy.',
      tip: '',
    },
    reasonable: {
      title: 'A reasonable day',
      queen: 'The Queen hoped for a little more, but she believes in you.',
      meadow: missing.length
        ? `Some of the meadow is still waiting. The ${list(missing.map(s => MANY[s]))} missed you today.`
        : 'Every kind of flower had a visit, but the hive’s stores are low.',
      tip: weakPollination ? pollinationTip : deliveryTip,
    },
    okay: {
      title: 'An okay day',
      queen: 'The Queen has added your name to a small list. It’s not a bad list. Yet.',
      meadow: total === 0
        ? 'The meadow is a little concerned. No flowers were pollinated today.'
        : `The meadow is a little concerned. Only ${total} ${total === 1 ? 'flower was' : 'flowers were'} pollinated.`,
      tip: weakPollination ? pollinationTip : deliveryTip,
    },
  };
  return { tier, delivery, pollination, ...lines[tier], why: capital(why.join(' · ')) };
}

/** The Queen's words at the start of a summer, echoing how the last one ended. */
export function morningLine(summer: number, previous: DayTier | 'lost' | null): string {
  const lead = `Summer ${summer} · `;
  switch (previous) {
    case 'fantastic': return lead + 'The hive is still buzzing about last summer. The Queen smiles as you set out.';
    case 'good': return lead + 'The Queen nods as you leave. Another good summer ahead?';
    case 'reasonable': return lead + 'The Queen believes in you. The meadow has flowers waiting.';
    case 'okay': return lead + 'The Queen is watching, kindly. The meadow could use your help this summer.';
    case 'lost': return lead + 'The hive is glad of a new summer. Fly carefully.';
    default: return '';
  }
}

/** One short sentence on how the meadow changed since last summer, or ''. */
export function meadowChangeLine(before: SpeciesCounts, after: SpeciesCounts): string {
  const by = (kind: 'more' | 'fewer') => SPECIES_ORDER.filter(s => trend(before[s], after[s]) === kind)
    .sort((a, b) => Math.abs(after[b] - before[b]) - Math.abs(after[a] - before[a]));
  const grew = by('more'), thinned = by('fewer');
  if (grew.length && thinned.length) return `${capital(MANY[grew[0]])} have spread, and the ${MANY[thinned[0]]} are sparse.`;
  if (grew.length) return `${capital(MANY[grew[0]])} have spread where you worked last summer.`;
  if (thinned.length) return `The ${MANY[thinned[0]]} are sparse this year.`;
  return '';
}

/** The results screen's look ahead: which flowers and friends there will be more or fewer of. */
export function nextSummerLine(preview: SummerPreview): string {
  const more: string[] = [], fewer: string[] = [];
  for (const s of SPECIES_ORDER) {
    const t = trend(preview.now[s], preview.next[s]);
    if (t === 'more') more.push(MANY[s]); else if (t === 'fewer') fewer.push(MANY[s]);
  }
  const bugs = trend(preview.ladybirds, preview.nextLadybirds);
  if (bugs === 'more') more.push('ladybirds'); else if (bugs === 'fewer') fewer.push('ladybirds');
  const parts = [more.length ? `more ${list(more)}` : '', fewer.length ? `fewer ${list(fewer)}` : ''].filter(Boolean);
  return parts.length ? `Next summer: ${parts.join(', ')}.` : 'Next summer, the meadow will look much the same.';
}

/** The knock-on effect for the meadow friends: poppies and cornflowers feed the
 * aphids, aphids and daisies feed the ladybirds. One sentence, or ''. */
export function friendsChangeLine(before: SpeciesCounts, after: SpeciesCounts): string {
  const was = friendCounts(before), now = friendCounts(after);
  const aphids = trend(was.aphidClusters, now.aphidClusters), ladybirds = trend(was.ladybirds, now.ladybirds);
  const daisies = trend(before.daisy, after.daisy);
  if (ladybirds === 'fewer') return aphids === 'fewer'
    ? 'Fewer poppies and cornflowers meant fewer aphids, so fewer ladybirds stayed.'
    : 'With fewer daisies to fall back on, fewer ladybirds stayed.';
  if (ladybirds === 'more') return aphids === 'more'
    ? 'More poppies and cornflowers brought aphids, and more ladybirds came to eat them.'
    : 'More daisies drew more ladybirds.';
  if (aphids === 'fewer') return 'Fewer poppies and cornflowers meant fewer aphids for the ladybirds.';
  if (aphids === 'more') return 'More poppies and cornflowers brought more aphids for the ladybirds.';
  return daisies === 'fewer' ? 'The ladybirds have fewer daisies to fall back on.' : '';
}

/** What last summer's pollination did to this summer's flowers: the cause, so
 * the counts read as a lesson. One or two sentences. */
export function flowerLessonLine(pollinated: SpeciesCounts, before: SpeciesCounts, after: SpeciesCounts): string {
  const n = (s: Species) => pollinated[s] ?? 0;
  const kind = (s: Species, count: number) => count === 1 ? ONE[s] : MANY[s];
  const annuals = SPECIES_ORDER.filter(s => ANNUAL[s]);
  const grew = annuals.filter(s => n(s) > 0 && after[s] > before[s]).sort((a, b) => n(b) - n(a));
  const thinned = annuals.filter(s => after[s] < before[s]);
  const unhelped = thinned.filter(s => n(s) === 0), few = thinned.filter(s => n(s) > 0);
  const parts: string[] = [];
  if (grew.length) parts.push(`You pollinated ${n(grew[0])} ${kind(grew[0], n(grew[0]))}, so more grew from their seed.`);
  if (unhelped.length) parts.push(`No ${list(unhelped.map(s => MANY[s]))} were pollinated, so fewer came back.`);
  else if (few.length) parts.push(`Only ${n(few[0])} ${kind(few[0], n(few[0]))} ${n(few[0]) === 1 ? 'was' : 'were'} pollinated, so fewer came back.`);
  if (parts.length) return parts.join(' ');
  return SPECIES_ORDER.every(s => n(s) === 0) ? 'Nothing was pollinated, so only old seed in the soil came up.' : 'Your pollination kept the flowers about as they were.';
}

/** How the butterflies changed with the nectar flowers, or ''. */
export function butterflyChangeLine(before: SpeciesCounts, after: SpeciesCounts): string {
  const change = trend(friendCounts(before).butterflies, friendCounts(after).butterflies);
  if (change === 'fewer') return after.poppy > after.daisy + after.cornflower
    ? 'Poppies have no nectar, so in a poppy meadow the butterflies moved on.'
    : 'With fewer daisies and cornflowers, fewer butterflies came to sip.';
  if (change === 'more') return 'More daisies and cornflowers drew more butterflies, which sip nectar too.';
  return '';
}
