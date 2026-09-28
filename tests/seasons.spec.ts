import { expect, test } from '@playwright/test';
import { planWeather, rollSeason, type Season } from '../src/weather';

/** A small seeded random source (as in the game), kept local so the test needs no scene code. */
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

/** Averages over many seeded days of one season. */
function average(season: Season) {
  let rain = 0, heat = 0, wetNights = 0, dryNights = 0, noRain = 0;
  const n = 400;
  for (let s = 1; s <= n; s++) {
    const plan = planWeather(rng(s * 7919), season);
    const r = plan.showers.reduce((sum, x) => sum + x.length, 0);
    rain += r; heat += plan.heatEnd - plan.heatStart; if (!r) noRain++;
    if (plan.night === 'wet') wetNights++; if (plan.night === 'dry') dryNights++;
  }
  return { rain: rain / n, heat: heat / n, wetNights: wetNights / n, dryNights: dryNights / n, noRain: noRain / n };
}

test('seasons shape the days: wet summers rain more, dry ones less, hot and dry ones longest in the heat', () => {
  const wet = average('wet'), ordinary = average('ordinary'), dry = average('dry'), hot = average('hotdry');
  expect(wet.rain).toBeGreaterThan(ordinary.rain * 1.4);
  expect(dry.rain).toBeLessThan(ordinary.rain * .6);
  expect(hot.rain).toBeLessThan(dry.rain);
  expect(hot.heat).toBeGreaterThan(ordinary.heat * 1.25);
  expect(wet.heat).toBeLessThan(ordinary.heat * .75);
  expect(wet.wetNights).toBeGreaterThan(.4);
  expect(hot.dryNights).toBeGreaterThan(.5);
  // A dry summer can still see rain, just rarely much.
  expect(dry.noRain).toBeGreaterThan(.3);
  expect(dry.noRain).toBeLessThan(.7);
  // An ordinary summer plans the same day as before seasons existed.
  expect(planWeather(rng(42))).toEqual(planWeather(rng(42), 'ordinary'));
});

test('the season leans toward the ground: a parched meadow gets more dry summers, a sodden one more wet ones', () => {
  const count = (moisture: number) => {
    const tally: Record<Season, number> = { wet: 0, ordinary: 0, dry: 0, hotdry: 0 };
    for (let s = 1; s <= 1000; s++) tally[rollSeason(rng(s * 104729), moisture)]++;
    return tally;
  };
  const parched = count(.1), ordinary = count(.5), sodden = count(.9);
  expect(parched.dry + parched.hotdry).toBeGreaterThan(parched.wet * 4);
  expect(sodden.wet).toBeGreaterThan(sodden.dry * 4);
  expect(ordinary.ordinary).toBeGreaterThan(500);
});
