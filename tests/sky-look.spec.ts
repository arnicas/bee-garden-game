import { expect, test } from '@playwright/test';
import { daySkyFor, skyLookAt } from '../src/sky-look';
import type { WeatherPlan } from '../src/weather';

const plan = (over: Partial<WeatherPlan>): WeatherPlan => ({ night: 'dewy', showers: [], heatStart: 300, heatEnd: 470, gales: [], ...over });

test('the sky reads the day: clear, hot, showery, late rain', () => {
  const clear = daySkyFor(plan({}));
  expect(clear.look.sunset).toBe('rose');
  expect(clear.look.haze).toBeLessThan(.25);
  const hot = daySkyFor(plan({ heatStart: 150, heatEnd: 470, heatStrength: 1.15 }));
  expect(hot.look.sunset).toBe('golden');
  expect(hot.look.haze).toBeGreaterThan(.5);
  const showery = daySkyFor(plan({ showers: [{ start: 100, length: 90 }, { start: 300, length: 90 }] }));
  expect(showery.look.sunset).toBe('ember');
  expect(showery.look.cloudAmount).toBeGreaterThan(.45);
  expect(daySkyFor(plan({ showers: [{ start: 470, length: 80 }] })).look.sunset).toBe('pale');
  // The same plan always gives the same sky (a saved day comes back the same).
  expect(daySkyFor(plan({ showers: [{ start: 120, length: 60 }] }))).toEqual(daySkyFor(plan({ showers: [{ start: 120, length: 60 }] })));
});

test('the morning shows the night: mist burns off after a wet night; clouds build before a shower', () => {
  const p = plan({ night: 'wet', showers: [{ start: 300, length: 60 }] }), day = daySkyFor(p);
  const look = { ...day.look };
  const early = skyLookAt(day, p, 0, 600, look).haze;
  const later = skyLookAt(day, p, 200, 600, look).haze;
  expect(early).toBeGreaterThan(later + .3);
  const before = skyLookAt(day, p, 150, 600, look).cloudAmount;
  const building = skyLookAt(day, p, 295, 600, look).cloudAmount;
  expect(building).toBeGreaterThan(before + .15);
  const dry = plan({ night: 'dry' }), dryDay = daySkyFor(dry);
  expect(skyLookAt(dryDay, dry, 0, 600, { ...dryDay.look }).haze).toBeLessThanOrEqual(dryDay.look.haze);
});
