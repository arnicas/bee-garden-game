import { expect, test, type Page } from '@playwright/test';
import { coverLine, coverMoisture, groundCause, groundCauseLine, nextMoisture, moistureLine, type WeatherPlan } from '../src/weather';
import { groundShareLine, nextSummerLine, shareWords, startSplit } from '../src/day-report';
import { meadowShares } from '../src/meadow-plan';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

const plan = (night: WeatherPlan['night'], rainSeconds: number, heatSeconds: number): WeatherPlan =>
  ({ night, showers: rainSeconds ? [{ start: 100, length: rainSeconds }] : [], heatStart: 300, heatEnd: 300 + heatSeconds, gales: [] });

test('ground moisture carries over: wet days raise it, hot dry days lower it, a third of the way at most', () => {
  expect(nextMoisture(.5, plan('wet', 240, 0))).toBeGreaterThan(.65);
  expect(nextMoisture(.5, plan('dry', 0, 390))).toBeLessThan(.35);
  // An ordinary day (one shower, a midday hot spell, a dewy night) barely moves it.
  expect(Math.abs(nextMoisture(.5, plan('dewy', 120, 195)) - .5)).toBeLessThan(.05);
  // Very wet or very dry ground stays so in like weather, but one day doesn't push it to the end.
  expect(nextMoisture(.95, plan('wet', 600, 0))).toBeGreaterThan(.9);
  expect(nextMoisture(.05, plan('dry', 0, 600))).toBeLessThan(.1);
  expect(moistureLine(.2)).toContain('dry summer');
  expect(moistureLine(.8)).toContain('wet summer');
  expect(moistureLine(.5)).toBe('');
});

test('the meadow left behind holds water in the ground: a patchy one dries faster, a full one keeps it damp', () => {
  const ordinary = plan('dewy', 120, 195);
  expect(nextMoisture(.5, ordinary, 1)).toBe(nextMoisture(.5, ordinary));
  // Half a meadow (little pollinated) loses about .11 more; enough to tip ordinary summers dry within three.
  expect(nextMoisture(.5, ordinary) - nextMoisture(.5, ordinary, .5)).toBeCloseTo(.11, 2);
  expect(nextMoisture(.5, ordinary, 1.15)).toBeGreaterThan(nextMoisture(.5, ordinary));
  // Smaller than the weather: a wet day still wets a patchy meadow.
  expect(nextMoisture(.5, plan('wet', 240, 0), .5)).toBeGreaterThan(.55);
  let m = .5; for (let i = 0; i < 3; i++) m = nextMoisture(m, ordinary, .55);
  expect(m).toBeLessThan(.3);
  expect(coverLine(coverMoisture(.5))).toContain('patchy');
  expect(coverLine(coverMoisture(.5), true)).toContain('drier');
  expect(coverLine(coverMoisture(1))).toBe('');
});

for (const [name, moisture] of [['dry', .1], ['wet', .9]] as const) {
  test(`a ${name} meadow looks it, and ${name === 'dry' ? 'fewer' : 'all'} pools can fill`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/?test&drops&moisture=${moisture}`);
    await startFlyingFixture(page);
    expect((await state(page)).moisture).toBeCloseTo(moisture, 5);
    // Flowers and friends: daisies droop and brown in the dry; the wet is a snail-and-mushroom summer.
    const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
    const daisies = flowers.filter(f => f.species === 'daisy' && f.id !== 0), s = await state(page);
    if (name === 'dry') {
      expect(daisies.filter(f => f.droop > .3).length).toBeGreaterThan(daisies.length / 2);
      expect(daisies.some(f => f.browned)).toBe(true);
      expect(s.mushrooms.mushrooms).toBe(0);
      expect(s.ants.colonies).toBeGreaterThanOrEqual(5);
      expect(s.snails.count).toBeLessThanOrEqual(6);
    } else {
      expect(flowers.every(f => f.droop === 0 && !f.browned)).toBe(true);
      expect(s.mushrooms.rings).toBeGreaterThanOrEqual(6);
      expect(s.ants.colonies).toBeLessThanOrEqual(3);
      expect(s.snails.count).toBeGreaterThanOrEqual(16);
      expect(s.caterpillars.count).toBeGreaterThanOrEqual(7);
    }
    const water = (await state(page)).water.puddles;
    if (name === 'dry') expect(water.canFill).toBeLessThan(water.count * .7);
    else expect(water.canFill).toBe(water.count);
    // Morning dew (the test night is dewy): a light sprinkle when dry, full when wet.
    await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.06));
    await expect.poll(async () => (await state(page)).flowerRain.dew).toBeGreaterThan(0);
    const dew = (await state(page)).flowerRain.dew;
    if (name === 'dry') expect(dew).toBeLessThan(.2); else expect(dew).toBeGreaterThan(.9);
    await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 3.2, 8], 0, -.12));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `artifacts/moisture/${name}.png` });
    expect(errors).toEqual([]);
  });
}

test('between summers, the cards say whether the weather or the meadow changed the ground', () => {
  // Hot dry days pull the ground down; the heat is named when it outweighs the missing rain.
  expect(groundCause(.5, plan('dry', 0, 600))).toBe('heat');
  expect(groundCause(.5, plan('dry', 0, 0))).toBe('dry');
  expect(groundCause(.5, plan('wet', 400, 0))).toBe('rain');
  // An ordinary day leaves the ground about where it was: no weather sentence.
  expect(groundCause(.5, plan('dewy', 120, 195))).toBe('');
  // The weather's share first, then the bee's: a patchy meadow adds to drying, a full one softens it.
  expect(groundCauseLine('heat', coverMoisture(.5), true)).toBe('This summer’s heat dried the ground, and the patchy meadow you leave will dry it further.');
  expect(groundCauseLine('heat', coverMoisture(1.4), false)).toBe('Last summer’s heat dried the ground, but the full meadow kept some of it damp.');
  expect(groundCauseLine('rain', 0, true)).toBe('This summer’s rain soaked the ground.');
  expect(groundCauseLine('', coverMoisture(.5), true)).toBe(coverLine(coverMoisture(.5), true));
  const none = { daisy: 4, poppy: 4, cornflower: 4 } as any;
  expect(nextSummerLine({ now: none, next: none, ladybirds: 2, nextLadybirds: 2, lastSummerLadybirds: 2, coverShift: 0, groundCause: 'heat' } as any))
    .toBe('Next summer, the meadow will look much the same.');
});

test('next summer is split by cause: the bee’s pollinating, then the ground', () => {
  const seeded = { daisy: 8, poppy: 8, cornflower: 8 }, fixed = { daisy: 2, poppy: 2, cornflower: 2 }, none = { daisy: 0, poppy: 0, cornflower: 0 };
  const pollinated = { daisy: 2, poppy: 5, cornflower: 3 };
  // On ordinary ground the ground's share is nothing; pollinating adds flowers.
  const ordinary = meadowShares(seeded, fixed, pollinated, none, .5);
  expect(ordinary.ground).toEqual({ daisy: 0, poppy: 0, cornflower: 0, ladybirds: 0, butterflies: 0, snails: 0 });
  expect(ordinary.bee.poppy).toBeGreaterThan(0);
  expect(ordinary.bee.cornflower).toBeGreaterThan(0);
  // Nothing pollinated: the bee's share is nothing.
  expect(meadowShares(seeded, fixed, none, none, .2).bee).toEqual({ daisy: 0, poppy: 0, cornflower: 0, ladybirds: 0, butterflies: 0, snails: 0 });
  // Dry ground: fewer daisies and snails, whatever the bee did.
  const dry = meadowShares(seeded, fixed, pollinated, none, .15);
  expect(dry.ground.daisy).toBeLessThan(0);
  expect(dry.ground.snails).toBeLessThan(0);
  const own = { daisy: 0, poppy: -5, cornflower: -1, ladybirds: 0, butterflies: 0, snails: 1 };
  const flowers = startSplit({ ...dry, own, moisture: .15, cause: 'heat', pollinatedAny: true }, 'flowers');
  expect(flowers.map(r => r.kind)).toEqual(['bee', 'ground', 'own']);
  expect(flowers[0].text).toMatch(/^Your pollinating: .*more poppies/);
  expect(flowers[1].text).toMatch(/^The dry ground: .*dais/);
  expect(flowers[1].art).toBe('heat');
  expect(flowers[2].text).toBe('The meadow on its own: 5 fewer poppies and 1 fewer cornflower.');
  // Friends only on the friends rows, and small wobbles left out.
  const friends = startSplit({ ...dry, own, moisture: .15, cause: 'heat', pollinatedAny: true }, 'friends');
  expect(friends.every(r => !/poppies|daisies|cornflowers/.test(r.text))).toBe(true);
  expect(friends.find(r => r.kind === 'ground')?.text).toMatch(/fewer snails/);
  expect(friends.find(r => r.kind === 'own')?.text).toBe('The meadow on its own: 1 more snail.');
  // Rain last summer, but the ground is still dry: the card says so.
  expect(startSplit({ ...dry, own, moisture: .3, cause: 'rain', pollinatedAny: true }, 'flowers')[1].text).toMatch(/^The ground, still dry: /);
  // The plain sentence says helped / held back, never more or fewer, and nothing when it barely mattered.
  const z = { daisy: 0, poppy: 0, cornflower: 0, ladybirds: 0, butterflies: 0, snails: 0 };
  expect(groundShareLine({ bee: z, own: z, ground: { ...z, poppy: 2, daisy: -1 }, moisture: .2, cause: 'heat', pollinatedAny: true })).toBe('The dry ground helped the poppies but held back the daisies.');
  expect(groundShareLine({ bee: z, own: z, ground: { ...z, daisy: -1 }, moisture: .2, cause: 'heat', pollinatedAny: true })).toBe('');
  // Nothing pollinated: the bee's row says so.
  const zero = { daisy: 0, poppy: 0, cornflower: 0, ladybirds: 0, butterflies: 0, snails: 0 };
  expect(startSplit({ bee: zero, ground: zero, own: zero, moisture: .5, cause: '', pollinatedAny: false }, 'flowers')[0].text).toContain('nothing was pollinated');
  expect(shareWords({ daisy: -1, poppy: 3, cornflower: 0, ladybirds: 1, butterflies: -2, snails: 0 })).toBe('1 fewer daisy, 3 more poppies, 1 more ladybird and 2 fewer butterflies');
  expect(shareWords({ daisy: 0, poppy: 0, cornflower: 0, ladybirds: 0, butterflies: -1, snails: 0 })).toBe('1 fewer butterfly');
});
