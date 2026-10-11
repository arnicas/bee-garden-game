import { MathUtils } from 'three';

export interface MeadowWeather {
  stage: 'clear' | 'approaching' | 'rain' | 'clearing';
  rain: number;
  cloudiness: number;
  sunHeat: number;
  /** 0–1 strength of a windy spell; the wind field and the daylight strip both read it. */
  gale: number;
}

/** A shower window in day seconds: clouds gather, rain falls, then the sky clears. */
export interface Shower { start: number; length: number; }
/** What the night before left behind: rain, an ordinary dewy night, or a dry, warm one. */
export type NightWeather = 'wet' | 'dewy' | 'dry';
/** One day's weather: the night before, none to two showers and a hot spell, never overlapping. */
export interface WeatherPlan { night: NightWeather; showers: Shower[]; heatStart: number; heatEnd: number; gales: Shower[];
  /** How strong the hot spell is (1 ordinary; a cool summer's is weaker, a hot one's stronger). Absent means 1. */
  heatStrength?: number; }

/** The summer's kind of weather, which biases each day's plan (see docs/design/Seasons_Design.md). */
export type Season = 'wet' | 'ordinary' | 'dry' | 'hotdry';

interface SeasonShape {
  /** Night roll thresholds: below the first is a wet night, below the second dewy, else dry. */
  nights: [number, number];
  /** Shower count thresholds (none, one, else two), or null for the ordinary rule by night. */
  showers: [number, number] | null;
  showerLength: number;
  /** Hot spell length (min, spread) in day seconds, and where in the day it tends to fall. */
  heat: [number, number]; heatPeak: number;
  /** Chance of a second windy spell. */
  twoGales: number;
  /** How strong the hot spell is (1 unless the heat is chosen). */
  strength?: number;
}

/** The weather a player can choose before the first summer (docs/design/Weather_Scenarios.md):
 * how much rain and how much heat, each pinned for the whole run or left to nature,
 * which rolls a season each summer as before. */
export type RainLevel = 'little' | 'ordinary' | 'lots';
export type HeatLevel = 'cool' | 'ordinary' | 'hot';
export interface WeatherChoice { rain: RainLevel | 'nature'; heat: HeatLevel | 'nature'; }
export const NATURE_DECIDES: WeatherChoice = { rain: 'nature', heat: 'nature' };
const SEASONS: Record<Season, SeasonShape> = {
  ordinary: { nights: [.3, .8], showers: null, showerLength: 1, heat: [150, 45], heatPeak: 320, twoGales: .35 },
  wet: { nights: [.5, .95], showers: [.02, .4], showerLength: 1.25, heat: [95, 35], heatPeak: 360, twoGales: .35 },
  dry: { nights: [.1, .55], showers: [.45, .95], showerLength: .8, heat: [160, 45], heatPeak: 300, twoGales: .35 },
  hotdry: { nights: [.04, .4], showers: [.6, 1], showerLength: .7, heat: [215, 45], heatPeak: 270, twoGales: .8 },
};

/** The rain side of a season: nights, how many showers and how long. */
const RAIN_SHAPES: Record<RainLevel, Pick<SeasonShape, 'nights' | 'showers' | 'showerLength'>> = {
  little: { nights: [.08, .45], showers: [.55, .95], showerLength: .75 },
  ordinary: { nights: [.3, .8], showers: null, showerLength: 1 },
  lots: { nights: [.5, .95], showers: [.02, .4], showerLength: 1.25 },
};
/** The heat side: the hot spell's length and timing, its strength, and the windy spells. */
const HEAT_SHAPES: Record<HeatLevel, Pick<SeasonShape, 'heat' | 'heatPeak' | 'twoGales' | 'strength'>> = {
  cool: { heat: [60, 50], heatPeak: 330, twoGales: .25, strength: .6 },
  ordinary: { heat: [150, 45], heatPeak: 320, twoGales: .35, strength: 1 },
  hot: { heat: [175, 75], heatPeak: 270, twoGales: .8, strength: 1.15 },
};
/** A summer's shape: the rolled season, with any chosen side pinned over it. */
function shapeFor(season: Season, choice: WeatherChoice): SeasonShape {
  return { ...SEASONS[season], ...(choice.rain !== 'nature' ? RAIN_SHAPES[choice.rain] : {}), ...(choice.heat !== 'nature' ? HEAT_SHAPES[choice.heat] : {}) };
}
/** The season to name a summer by, once the choice has pinned a side over the rolled one. */
export function chosenSeason(rolled: Season, choice: WeatherChoice): Season {
  if (choice.rain === 'lots') return 'wet';
  if (choice.rain === 'little') return choice.heat === 'hot' || (choice.heat === 'nature' && rolled === 'hotdry') ? 'hotdry' : 'dry';
  if (choice.heat === 'cool' && rolled === 'hotdry') return 'dry';
  if (choice.heat === 'hot' && rolled === 'dry') return 'hotdry';
  return rolled;
}
/** Where a run's ground starts: a little drier when little rain is chosen, damper with a lot. */
export function startMoisture(choice: WeatherChoice): number {
  return choice.rain === 'little' ? .35 : choice.rain === 'lots' ? .65 : .5;
}
/** Reads a choice from strings (a URL or saved settings), ignoring anything unknown. */
export function parseWeatherChoice(rain: string | null | undefined, heat: string | null | undefined): WeatherChoice {
  return {
    rain: rain === 'little' || rain === 'ordinary' || rain === 'lots' ? rain : 'nature',
    heat: heat === 'cool' || heat === 'ordinary' || heat === 'hot' ? heat : 'nature',
  };
}

/** Named weather for the "Your five summers" panel: nature first, then four combinations. */
export interface WeatherPreset { id: string; name: string; rain: RainLevel | 'nature'; heat: HeatLevel | 'nature'; line: string }
export const WEATHER_PRESETS: readonly WeatherPreset[] = [
  { id: 'nature', name: 'As nature decides', rain: 'nature', heat: 'nature', line: 'Each summer brings its own weather, and the ground remembers it.' },
  { id: 'hotdry', name: 'Hot and dry', rain: 'little', heat: 'hot', line: 'Water is scarce: find pools early, and keep to the shade.' },
  { id: 'wetcool', name: 'Wet and cool', rain: 'lots', heat: 'cool', line: 'Showers come often: shelter, and fly between them.' },
  { id: 'muggy', name: 'Muggy', rain: 'lots', heat: 'hot', line: 'Heavy showers and heat: wet wings and a thirsty hive.' },
  { id: 'milddry', name: 'Mild and dry', rain: 'little', heat: 'cool', line: 'Gentle days, but little rain: the meadow slowly dries.' },
];
/** The nine combinations in words: a name, and what the bee should expect. */
const COMBOS: Record<RainLevel, Record<HeatLevel, [string, string]>> = {
  little: { cool: ['mild and dry', 'Gentle days, but little rain: the meadow slowly dries.'], ordinary: ['dry', 'Little rain, so water will be scarce.'], hot: ['hot and dry', 'Water is scarce: find pools early, and keep to the shade.'] },
  ordinary: { cool: ['cool', 'Mild days and the usual showers: little need for shade.'], ordinary: ['ordinary', 'Showers now and then, and some heat.'], hot: ['hot', 'Long, strong heat: the hive will want water.'] },
  lots: { cool: ['wet and cool', 'Showers come often: shelter, and fly between them.'], ordinary: ['wet', 'Showers are likely: shelter, and fly between them.'], hot: ['muggy', 'Heavy showers and heat: wet wings and a thirsty hive.'] },
};
const seasonRain = (season: Season): RainLevel => season === 'wet' ? 'lots' : season === 'dry' || season === 'hotdry' ? 'little' : 'ordinary';
const seasonHeat = (season: Season): HeatLevel => season === 'wet' ? 'cool' : season === 'hotdry' ? 'hot' : 'ordinary';
export const isNatureDecides = (choice: WeatherChoice) => choice.rain === 'nature' && choice.heat === 'nature';
/** The choice in words, for the panel's forecast, the start page and the Queen. */
export function describeChoice(choice: WeatherChoice): { name: string; line: string } {
  if (isNatureDecides(choice)) return { name: 'as nature decides', line: WEATHER_PRESETS[0].line };
  const [name, line] = COMBOS[choice.rain === 'nature' ? 'ordinary' : choice.rain][choice.heat === 'nature' ? 'ordinary' : choice.heat];
  if (choice.rain === 'nature') return { name: `${name === 'ordinary' ? 'ordinary heat' : name}, with rain as nature decides`, line };
  if (choice.heat === 'nature') return { name: `${name}, with heat as nature decides`, line };
  return { name, line };
}
/** One summer's weather as a short name ("Hot and dry", "Muggy"), from the choice over the rolled season. */
export function summerWeatherName(choice: WeatherChoice, rolled: Season): string {
  const rain = choice.rain === 'nature' ? seasonRain(rolled) : choice.rain, heat = choice.heat === 'nature' ? seasonHeat(rolled) : choice.heat;
  const name = COMBOS[rain][heat][0];
  return name === 'ordinary' ? 'Mild' : name.charAt(0).toUpperCase() + name.slice(1);
}
/** The morning note for a summer with chosen weather, or null to use the season's own note. */
export function choiceNote(choice: WeatherChoice, rolled: Season): { lead: string; text: string } | null {
  if (isNatureDecides(choice)) return null;
  const rain = choice.rain === 'nature' ? seasonRain(rolled) : choice.rain, heat = choice.heat === 'nature' ? seasonHeat(rolled) : choice.heat;
  const [name, line] = COMBOS[rain][heat];
  return name === 'ordinary' ? null : { lead: `A ${name} summer.`, text: line };
}

/** Rolls a summer's season, leaning toward what the ground already is: a dry
 * meadow is likelier to get another dry summer, a wet one another wet summer. */
export function rollSeason(random: () => number, moisture: number): Season {
  const dry = MathUtils.clamp((.5 - moisture) / .4, 0, 1), wet = MathUtils.clamp((moisture - .5) / .4, 0, 1);
  const pWet = .15 + .45 * wet - .1 * dry, pDry = .15 + .35 * dry - .1 * wet, pHot = .05 + .25 * dry;
  const u = random();
  return u < pWet ? 'wet' : u < pWet + pDry ? 'dry' : u < pWet + pDry + pHot ? 'hotdry' : 'ordinary';
}

/** The season as a morning note: a short bold lead and what it means for the bee. */
export function seasonNote(season: Season): { lead: string; text: string } | null {
  if (season === 'wet') return { lead: 'A wet summer.', text: 'Showers are likely today.' };
  if (season === 'dry') return { lead: 'A dry summer.', text: 'Little rain, so water will be scarce.' };
  if (season === 'hotdry') return { lead: 'A hot, dry summer.', text: 'Long heat and wind today. Find water and shade.' };
  return null;
}

/** The original fixed day: one late-morning shower, then a hot spell. Test pages pin this plan. */
export const FIXED_WEATHER_PLAN: WeatherPlan = { night: 'dewy', showers: [{ start: 150, length: 120 }], heatStart: 270, heatEnd: 465, gales: [] };

const SHOWER_RAMP = 30; // seconds for clouds to gather at the start and clear at the end
const PLAN_START = 60, PLAN_END = 525; // a clear first minute; weather settles before dusk (540)

// Hot spells favour midday to mid-afternoon: a bell curve around this point in
// the day (seconds), with a small floor so early or late heat stays possible.
const HEAT_PEAK = 320, HEAT_SPREAD = 50, HEAT_FLOOR = .05;

/** How likely a hot spell centred at this time is to be kept (0–1). */
export function heatLikelihood(centre: number, peak = HEAT_PEAK): number {
  return Math.max(HEAT_FLOOR, Math.exp(-.5 * ((centre - peak) / HEAT_SPREAD) ** 2));
}

/** Builds a day's plan from a seeded random source: 1–2 showers and one hot
 * spell. Candidate days are drawn until one's hot spell passes the time-of-day
 * likelihood, so the plan stays reproducible for a given seed. */
export function planWeather(random: () => number, season: Season = 'ordinary', choice: WeatherChoice = NATURE_DECIDES): WeatherPlan {
  // The night first: in an ordinary summer about a third of mornings follow rain, a fifth a dry night.
  const shape = shapeFor(season, choice);
  const roll = random(), night: NightWeather = roll < shape.nights[0] ? 'wet' : roll < shape.nights[1] ? 'dewy' : 'dry';
  const plan = placeHeat(random, night, shape);
  plan.gales = planGales(random, shape.twoGales);
  plan.night = night;
  if (shape.strength !== undefined && shape.strength !== 1) plan.heatStrength = shape.strength;
  return plan;
}

/** Draws candidate days until one's hot spell passes the time-of-day likelihood. */
function placeHeat(random: () => number, night: NightWeather, shape: SeasonShape): WeatherPlan {
  let plan = arrangeWeather(random, night, shape);
  for (let attempt = 0; attempt < 24; attempt++) {
    if (random() < heatLikelihood((plan.heatStart + plan.heatEnd) / 2, shape.heatPeak)) return plan;
    plan = arrangeWeather(random, night, shape);
  }
  return plan;
}

/** One candidate day: showers and a hot spell in a random order with random gaps. */
function arrangeWeather(random: () => number, night: NightWeather, shape: SeasonShape = SEASONS.ordinary): WeatherPlan {
  // Some days stay dry, some have two showers; a dry night makes a dry day
  // likelier, and unsettled weather after a wet one. The season shifts both.
  const [none, one] = shape.showers ?? (night === 'wet' ? [.1, .55] : night === 'dry' ? [.35, .8] : [.15, .65]);
  const r = random(), count = r < none ? 0 : r < one ? 1 : 2;
  const items: { kind: 'shower' | 'heat'; length: number }[] = [];
  for (let i = 0; i < count; i++) items.push({ kind: 'shower', length: (count === 1 ? 105 + random() * 45 : 90 + random() * 30) * shape.showerLength });
  items.push({ kind: 'heat', length: shape.heat[0] + random() * shape.heat[1] });
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const scale = Math.min(1, (PLAN_END - PLAN_START) / total);
  const free = Math.max(0, PLAN_END - PLAN_START - total * scale);
  const gaps = items.map(() => random()).concat(random()); // before each event, plus after the last
  const gapTotal = gaps.reduce((sum, gap) => sum + gap, 0) || 1;
  const plan: WeatherPlan = { night, showers: [], heatStart: 0, heatEnd: 0, gales: [] };
  let t = PLAN_START;
  items.forEach((item, i) => {
    t += free * gaps[i] / gapTotal;
    const length = item.length * scale;
    if (item.kind === 'shower') plan.showers.push({ start: t, length });
    else { plan.heatStart = t; plan.heatEnd = t + length; }
    t += length;
  });
  return plan;
}

const GALE_START = 75, GALE_END = 510;

/** One windy spell a day, sometimes two, each in its own part of the day. Gales
 * may overlap a shower or the hot spell; wind and weather are independent. */
function planGales(random: () => number, twoGales = .35): Shower[] {
  const count = random() < twoGales ? 2 : 1, slot = (GALE_END - GALE_START) / count;
  return Array.from({ length: count }, (_, i) => {
    const length = 70 + random() * 40;
    return { start: GALE_START + i * slot + random() * Math.max(0, slot - length), length };
  });
}

/** The daylight clock owns the weather, so pausing freezes it and a
 * deliberate rest can pass a shower. */
export function weatherAt(daySeconds: number, out: MeadowWeather, plan: WeatherPlan = FIXED_WEATHER_PLAN): MeadowWeather {
  const t = Math.max(0, daySeconds);
  out.stage = 'clear'; out.cloudiness = 0; out.rain = 0; out.gale = 0;
  for (const { start, length } of plan.gales) out.gale = Math.max(out.gale, MathUtils.smoothstep(t, start, start + 15) * (1 - MathUtils.smoothstep(t, start + length - 20, start + length)));
  for (const { start, length } of plan.showers) {
    const end = start + length;
    if (t >= start && t < end) out.stage = t < start + SHOWER_RAMP ? 'approaching' : t < end - SHOWER_RAMP ? 'rain' : 'clearing';
    out.cloudiness = Math.max(out.cloudiness, MathUtils.smoothstep(t, start, start + SHOWER_RAMP) * (1 - MathUtils.smoothstep(t, end - SHOWER_RAMP, end)));
    out.rain = Math.max(out.rain, MathUtils.smoothstep(t, start + 30, start + 42) * (1 - MathUtils.smoothstep(t, end - 36, end - 12)));
  }
  // A gradual hot spell, then milder light. Rest advances this daylight
  // envelope; the bee's exposure still accumulates in real time.
  out.sunHeat = MathUtils.smoothstep(t, plan.heatStart, plan.heatStart + 45) * (1 - MathUtils.smoothstep(t, plan.heatEnd - 75, plan.heatEnd)) * (1 - out.cloudiness) * (plan.heatStrength ?? 1);
  return out;
}

/** How a finished day moves the meadow's ground moisture (0–1): rain and a wet night
 * raise it, heat and a dry night lower it. Each summer the ground moves nearly half the
 * way toward the level that kind of weather settles at, so a run of like summers lands
 * there (hot and dry about 0.15, wet and cool about 0.85), and the patchiness of the meadow
 * left behind adds to it. See docs/design/Seasons_Design.md and Weather_Scenarios.md. */
export function nextMoisture(moisture: number, plan: WeatherPlan, cover = 1): number {
  return MathUtils.clamp(moisture + weatherPull(moisture, plan) + coverMoisture(cover), 0, 1);
}
/** The day's weather against an ordinary day: its rain side (rain and the night) and its heat
 * side (heat above or below ordinary, weighted by strength). Positive wets, negative dries. */
function dayBalance(plan: WeatherPlan): { rain: number; heat: number } {
  const rainMinutes = plan.showers.reduce((sum, s) => sum + s.length, 0) / 60;
  const heat = Math.max(0, plan.heatEnd - plan.heatStart) / 60 * (plan.heatStrength ?? 1);
  const night = plan.night === 'wet' ? .25 : plan.night === 'dewy' ? .1 : -.15;
  const heatPull = heat > ORDINARY_HEAT ? (heat - ORDINARY_HEAT) * .2 : (heat - ORDINARY_HEAT) * .11;
  return { rain: .4 * (rainMinutes - ORDINARY_RAIN) + (night - ORDINARY_NIGHT), heat: -heatPull };
}
/** The weather's own share of a summer's change in ground moisture (the meadow's cover is
 * the other share): the ground moves nearly half the way each summer toward the level such
 * weather settles at, so a run of like summers lands there and the nine weathers stay distinct. */
export function weatherPull(moisture: number, plan: WeatherPlan): number {
  const { rain, heat } = dayBalance(plan);
  const settle = .5 + .45 * MathUtils.clamp(rain + heat, -1, 1);
  return (settle - moisture) * .45;
}
/** What mostly moved the ground this summer: heat, too little rain, rain, or a cool summer. */
export type GroundCause = 'heat' | 'dry' | 'rain' | 'cool' | '';
export function groundCause(moisture: number, plan: WeatherPlan): GroundCause {
  const pull = weatherPull(moisture, plan), { rain, heat } = dayBalance(plan);
  if (Math.abs(pull) < .04) return '';
  if (pull < 0) return heat < rain ? 'heat' : 'dry';
  return rain > heat ? 'rain' : 'cool';
}
/** One sentence on why the ground changed: the weather's share, then the meadow's (the bee's).
 * Looking ahead on the results page, or back on the next summer's start page; '' when neither mattered. */
export function groundCauseLine(cause: GroundCause, coverShift: number, ahead: boolean): string {
  const patchy = coverShift <= -.03, full = coverShift >= .02;
  if (!cause) return coverLine(coverShift, ahead);
  const weather = ahead
    ? { heat: 'This summer’s heat dried the ground', dry: 'Little rain this summer let the ground dry', rain: 'This summer’s rain soaked the ground', cool: 'The cool summer kept the ground damp' }[cause]
    : { heat: 'Last summer’s heat dried the ground', dry: 'With little rain last summer, the ground dried', rain: 'Last summer’s rain soaked the ground', cool: 'The cool summer kept the ground damp' }[cause];
  const drying = cause === 'heat' || cause === 'dry';
  const meadow = !patchy && !full ? ''
    : ahead
      ? patchy ? (drying ? ', and the patchy meadow you leave will dry it further' : ', though the patchy meadow you leave will dry it a little')
        : (drying ? ', but the full meadow you leave will keep some of it damp' : ', and the full meadow you leave will hold it')
      : patchy ? (drying ? ', and the patchy meadow dried it further' : ', though the patchy meadow dried it a little')
        : (drying ? ', but the full meadow kept some of it damp' : ', and the full meadow held it');
  return `${weather}${meadow}.`;
}
/** An ordinary day, for the balance above: rain minutes, the night's wetness, heat minutes. */
const ORDINARY_RAIN = 2, ORDINARY_NIGHT = .095, ORDINARY_HEAT = 2.87;

/** How the meadow the bee leaves behind changes the ground's water over a summer.
 * `cover` is next summer's flowers against a normal meadow (1): patchy, bare ground
 * dries faster (a meadow half as full loses about .11 more), while a full one
 * shades the soil and holds a little more. Smaller than the weather, so one poor
 * day doesn't doom the meadow, but it adds up over summers. */
export function coverMoisture(cover: number): number {
  const c = MathUtils.clamp(cover, .3, 1.2);
  return c < 1 ? -(1 - c) * .22 : (c - 1) * .2;
}
/** The meadow's cover as words, looking back (the start page) or ahead (the results), or ''. */
export function coverLine(shift: number, ahead = false): string {
  if (shift <= -.03) return ahead ? 'A patchy meadow will leave the ground drier.' : 'The meadow was patchy, so the ground dried out faster.';
  if (shift >= .02) return ahead ? 'A full meadow will keep the ground damp.' : 'A full meadow kept the ground damp.';
  return '';
}

/** One line for the summer start page, only when it isn't an ordinary summer. */
/** A hot day: a long hot spell (about one ordinary day in five, most dry-summer
 * days and every hot, dry one), when the hive needs water carried home to cool it. */
export function hiveNeedsWater(plan: WeatherPlan): boolean {
  return plan.heatEnd - plan.heatStart >= 185 && (plan.heatStrength ?? 1) >= .9;
}
/** How a dry or wet summer changes the meadow friends, or '' in an ordinary one. It
 * says what they do, not how many there are: the counts beside it also follow the
 * flowers, so a thin meadow can have fewer ladybirds even in a dry summer. */
export function moistureFriendsLine(moisture: number): string {
  if (moisture < .3) return 'In the dry, the snails stay sealed up and no mushrooms come up, while ants and aphids do well.';
  if (moisture > .7) return 'In the damp, snails come out, mushrooms come up by the pools, and the butterflies shelter more.';
  return '';
}
export function moistureLine(moisture: number): string {
  if (moisture < .3) return 'A dry summer: the grass has browned, and the pools are slow to fill.';
  if (moisture > .7) return 'A wet summer: the grass is tall and green, and the pools fill quickly.';
  return '';
}
