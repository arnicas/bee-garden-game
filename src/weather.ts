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
export interface WeatherPlan { night: NightWeather; showers: Shower[]; heatStart: number; heatEnd: number; gales: Shower[]; }

/** The summer's kind of weather, which biases each day's plan (see Seasons_Design.md). */
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
}
const SEASONS: Record<Season, SeasonShape> = {
  ordinary: { nights: [.3, .8], showers: null, showerLength: 1, heat: [150, 45], heatPeak: 320, twoGales: .35 },
  wet: { nights: [.5, .95], showers: [.02, .4], showerLength: 1.25, heat: [95, 35], heatPeak: 360, twoGales: .35 },
  dry: { nights: [.1, .55], showers: [.45, .95], showerLength: .8, heat: [160, 45], heatPeak: 300, twoGales: .35 },
  hotdry: { nights: [.04, .4], showers: [.6, 1], showerLength: .7, heat: [215, 45], heatPeak: 270, twoGales: .8 },
};

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
export function planWeather(random: () => number, season: Season = 'ordinary'): WeatherPlan {
  // The night first: in an ordinary summer about a third of mornings follow rain, a fifth a dry night.
  const shape = SEASONS[season];
  const roll = random(), night: NightWeather = roll < shape.nights[0] ? 'wet' : roll < shape.nights[1] ? 'dewy' : 'dry';
  const plan = placeHeat(random, night, shape);
  plan.gales = planGales(random, shape.twoGales);
  plan.night = night;
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
  out.sunHeat = MathUtils.smoothstep(t, plan.heatStart, plan.heatStart + 45) * (1 - MathUtils.smoothstep(t, plan.heatEnd - 75, plan.heatEnd)) * (1 - out.cloudiness);
  return out;
}

/** How a finished day moves the meadow's ground moisture (0–1): rain and a wet
 * night raise it, heat and a dry night lower it, nearly half the way at most, so a
 * run of similar summers moves it a long way. See Seasons_Design.md. */
export function nextMoisture(moisture: number, plan: WeatherPlan): number {
  const rainMinutes = plan.showers.reduce((sum, s) => sum + s.length, 0) / 60;
  const heatMinutes = Math.max(0, plan.heatEnd - plan.heatStart) / 60;
  const night = plan.night === 'wet' ? .25 : plan.night === 'dewy' ? .1 : -.15;
  const day = Math.max(-1, Math.min(1, rainMinutes / 4 + night - heatMinutes / 6));
  return Math.max(0, Math.min(1, moisture + day * .45));
}

/** One line for the summer start page, only when it isn't an ordinary summer. */
export function moistureLine(moisture: number): string {
  if (moisture < .3) return 'A dry summer: the grass has browned, and the pools are slow to fill.';
  if (moisture > .7) return 'A wet summer: the grass is tall and green, and the pools fill quickly.';
  return '';
}
