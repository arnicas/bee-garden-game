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
/** One day's weather: one or two showers and a hot spell, never overlapping. */
export interface WeatherPlan { showers: Shower[]; heatStart: number; heatEnd: number; gales: Shower[]; }

/** The original fixed day: one late-morning shower, then a hot spell. Test pages pin this plan. */
export const FIXED_WEATHER_PLAN: WeatherPlan = { showers: [{ start: 150, length: 120 }], heatStart: 270, heatEnd: 465, gales: [] };

const SHOWER_RAMP = 30; // seconds for clouds to gather at the start and clear at the end
const PLAN_START = 60, PLAN_END = 525; // a clear first minute; weather settles before dusk (540)

// Hot spells favour midday to mid-afternoon: a bell curve around this point in
// the day (seconds), with a small floor so early or late heat stays possible.
const HEAT_PEAK = 320, HEAT_SPREAD = 50, HEAT_FLOOR = .05;

/** How likely a hot spell centred at this time is to be kept (0–1). */
export function heatLikelihood(centre: number): number {
  return Math.max(HEAT_FLOOR, Math.exp(-.5 * ((centre - HEAT_PEAK) / HEAT_SPREAD) ** 2));
}

/** Builds a day's plan from a seeded random source: 1–2 showers and one hot
 * spell. Candidate days are drawn until one's hot spell passes the time-of-day
 * likelihood, so the plan stays reproducible for a given seed. */
export function planWeather(random: () => number): WeatherPlan {
  const plan = placeHeat(random);
  plan.gales = planGales(random);
  return plan;
}

/** Draws candidate days until one's hot spell passes the time-of-day likelihood. */
function placeHeat(random: () => number): WeatherPlan {
  let plan = arrangeWeather(random);
  for (let attempt = 0; attempt < 24; attempt++) {
    if (random() < heatLikelihood((plan.heatStart + plan.heatEnd) / 2)) return plan;
    plan = arrangeWeather(random);
  }
  return plan;
}

/** One candidate day: showers and a hot spell in a random order with random gaps. */
function arrangeWeather(random: () => number): WeatherPlan {
  const count = random() < .5 ? 1 : 2;
  const items: { kind: 'shower' | 'heat'; length: number }[] = [];
  for (let i = 0; i < count; i++) items.push({ kind: 'shower', length: count === 1 ? 105 + random() * 45 : 90 + random() * 30 });
  items.push({ kind: 'heat', length: 150 + random() * 45 });
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const scale = Math.min(1, (PLAN_END - PLAN_START) / total);
  const free = Math.max(0, PLAN_END - PLAN_START - total * scale);
  const gaps = items.map(() => random()).concat(random()); // before each event, plus after the last
  const gapTotal = gaps.reduce((sum, gap) => sum + gap, 0) || 1;
  const plan: WeatherPlan = { showers: [], heatStart: 0, heatEnd: 0, gales: [] };
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
function planGales(random: () => number): Shower[] {
  const count = random() < .35 ? 2 : 1, slot = (GALE_END - GALE_START) / count;
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
