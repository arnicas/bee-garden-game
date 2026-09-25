import type { Species } from './types';

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
    ? `Tomorrow, carry ${ONE[missing[0]]} pollen to another ${ONE[missing[0]]}.`
    : 'Pollen on your legs pollinates the next flower of the same kind.';
  const deliveryTip = pollen < t.pollenGoal ? 'Tomorrow, fill your pollen pouch before heading home.' : 'Tomorrow, bring home a fuller nectar jar.';
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

/** The Queen's words the next morning, echoing how the day before ended. */
export function morningLine(day: number, previous: DayTier | 'lost' | null): string {
  const lead = `Day ${day} · `;
  switch (previous) {
    case 'fantastic': return lead + 'The hive is still buzzing about yesterday. The Queen smiles as you set out.';
    case 'good': return lead + 'The Queen nods as you leave. Another good day ahead?';
    case 'reasonable': return lead + 'The Queen believes in you. The meadow has flowers waiting.';
    case 'okay': return lead + 'The Queen is watching, kindly. The meadow could use your help today.';
    case 'lost': return lead + 'The hive is glad you’re safe. Fly carefully today.';
    default: return '';
  }
}
