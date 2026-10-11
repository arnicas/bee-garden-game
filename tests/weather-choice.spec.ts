import { expect, test } from '@playwright/test';
import { hiveNeedsWater, nextMoisture, planWeather, rollSeason, startMoisture, weatherAt, NATURE_DECIDES, type MeadowWeather, type Season, type WeatherChoice } from '../src/weather';

// A small seeded random source, as the game uses.
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const days = (choice: WeatherChoice, n = 300, season: Season = 'ordinary') => Array.from({ length: n }, (_, i) => planWeather(rng(i * 7919 + 13), season, choice));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('left to nature, every season plans exactly the days it did before', () => {
  for (const season of ['ordinary', 'wet', 'dry', 'hotdry'] as Season[])
    for (let s = 1; s <= 60; s++) expect(planWeather(rng(s * 104729), season, NATURE_DECIDES)).toEqual(planWeather(rng(s * 104729), season));
});

test('little rain brings far fewer showers and wet nights than a lot', () => {
  const little = days({ rain: 'little', heat: 'nature' }), lots = days({ rain: 'lots', heat: 'nature' });
  expect(mean(little.map(p => p.showers.length))).toBeLessThan(.6);
  expect(mean(lots.map(p => p.showers.length))).toBeGreaterThan(1.5);
  expect(little.filter(p => p.night === 'wet').length).toBeLessThan(lots.filter(p => p.night === 'wet').length / 3);
});

test('a cool summer never asks the hive for water, a hot one nearly always does', () => {
  expect(days({ rain: 'nature', heat: 'cool' }).filter(hiveNeedsWater)).toHaveLength(0);
  expect(days({ rain: 'nature', heat: 'hot' }).filter(hiveNeedsWater).length).toBeGreaterThan(270);
});

test('the heat side is independent of the rain: hot and wet, cool and dry', () => {
  const muggy = days({ rain: 'lots', heat: 'hot' }), mild = days({ rain: 'little', heat: 'cool' });
  expect(mean(muggy.map(p => p.showers.length))).toBeGreaterThan(1.3);
  expect(muggy.filter(hiveNeedsWater).length).toBeGreaterThan(200);
  expect(mean(mild.map(p => p.showers.length))).toBeLessThan(.6);
  expect(mild.filter(hiveNeedsWater)).toHaveLength(0);
});

test('a cool day’s hot spell is gentle; a hot day’s is stronger', () => {
  const peak = (choice: WeatherChoice) => {
    const plan = planWeather(rng(77), 'ordinary', choice), out = {} as MeadowWeather;
    let most = 0;
    for (let t = 0; t < 540; t += 2) most = Math.max(most, weatherAt(t, out, plan).sunHeat);
    return most;
  };
  expect(peak({ rain: 'little', heat: 'cool' })).toBeLessThanOrEqual(.61);
  expect(peak({ rain: 'little', heat: 'hot' })).toBeGreaterThan(1.05);
});

test('the ground follows the chosen weather over five summers, starting nudged', () => {
  expect(startMoisture({ rain: 'little', heat: 'nature' })).toBeLessThan(.5);
  expect(startMoisture({ rain: 'lots', heat: 'nature' })).toBeGreaterThan(.5);
  const run = (choice: WeatherChoice) => {
    let m = startMoisture(choice);
    for (let summer = 1; summer <= 5; summer++) m = nextMoisture(m, planWeather(rng(summer * 31337), rollSeason(rng(summer * 17), m), choice));
    return m;
  };
  expect(run({ rain: 'little', heat: 'hot' })).toBeLessThan(.2);
  expect(run({ rain: 'lots', heat: 'cool' })).toBeGreaterThan(.8);
});
