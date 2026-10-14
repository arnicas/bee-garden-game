import { MathUtils } from 'three';
import type { SkyLook } from './atmosphere';
import type { WeatherPlan } from './weather';

/**
 * Each day's sky, read from its own weather plan so the sky tells of the day to come:
 * a clear day is deep blue with a few puffs or none, and a pink and lilac evening; a hot
 * day is milky with heat haze and ends golden; a day with a shower has high streaks (a
 * mackerel sky) or more fair clouds, and a streaked orange sunset, or a pale one if the
 * rain came late; a showery day is busy with cloud. Wind brings high streaks.
 * The morning shows the night before: mist after a wet night that burns off, and a
 * crisp, clear start after a dry one. The rain clouds themselves come and go with each
 * shower (the weather's cloudiness); this is the look of the day around them.
 */
export interface DaySky {
  look: SkyLook;
  /** Extra haze at the start of the day, burning off over the first part of the morning. */
  mist: number;
  /** Less haze at the start (a crisp morning after a dry night). */
  crisp: number;
}

/** A steady 0–1 number from the plan itself, so a saved day comes back with the same sky. */
function planNoise(plan: WeatherPlan): number {
  const h = plan.showers.reduce((s, x) => s + x.start * 7.13 + x.length * 3.7, 0) + plan.heatStart * 1.31 + plan.heatEnd * .77 + plan.gales.reduce((s, g) => s + g.start * .53, 0);
  const x = Math.sin(h * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function daySkyFor(plan: WeatherPlan, dayLength = 600): DaySky {
  const r = planNoise(plan);
  const heat = (plan.heatEnd - plan.heatStart) * (plan.heatStrength ?? 1);
  const hot = heat > 220;
  const lastRain = plan.showers.reduce((end, s) => Math.max(end, (s.start + s.length) / dayLength), 0);
  const lateRain = lastRain > .8;
  let look: SkyLook;
  if (plan.showers.length >= 2) look = { haze: .45, clouds: 'fair', cloudAmount: .5 + r * .12, sunset: lateRain ? 'pale' : 'ember' };
  else if (plan.showers.length === 1) look = { haze: .35, clouds: r < .55 ? 'high' : 'fair', cloudAmount: .36 + r * .1, sunset: lateRain ? 'pale' : 'ember' };
  else if (hot) look = { haze: .62, clouds: r < .5 ? 'none' : 'fair', cloudAmount: .12, sunset: 'golden' };
  else look = { haze: .1 + r * .12, clouds: r < .4 ? 'none' : r < .78 ? 'fair' : 'high', cloudAmount: .18 + r * .08, sunset: 'rose' };
  // A windy spell on an otherwise settled day: high streaks drawn out across the sky.
  if (plan.gales.length && plan.showers.length < 2 && look.clouds !== 'high' && r > .35) look = { ...look, clouds: 'high' };
  return { look, mist: plan.night === 'wet' ? .45 : plan.night === 'dewy' ? .15 : 0, crisp: plan.night === 'dry' ? .12 : 0 };
}

/** The look at this point in the day: morning mist burning off (or a crisp start), and the
 * clouds building a little in the minute before each shower. */
export function skyLookAt(day: DaySky, plan: WeatherPlan, seconds: number, dayLength: number, out: SkyLook): SkyLook {
  const morning = 1 - MathUtils.smoothstep(seconds / dayLength, 0, .22);
  out.clouds = day.look.clouds; out.sunset = day.look.sunset;
  out.haze = MathUtils.clamp(day.look.haze + (day.mist - day.crisp) * morning, 0, 1);
  let build = 0;
  for (const s of plan.showers) build = Math.max(build, MathUtils.smoothstep(seconds, s.start - 75, s.start) * (1 - MathUtils.smoothstep(seconds, s.start + s.length, s.start + s.length + 40)));
  out.cloudAmount = MathUtils.clamp(day.look.cloudAmount + build * .25, 0, 1);
  return out;
}
