import { expect, test } from '@playwright/test';
import type { SummerOutcome } from '../src/day-report';
import { ARC, hiveStress, newHive, recordSummer, runSummary, storesWord, type HiveState, type SummerRecord } from '../src/hive-stores';

// A day of each kind, roughly as the game delivers them.
const DAYS: Record<string, [SummerOutcome, number, number]> = {
  F: ['fantastic', 90, 140], G: ['good', 60, 140], R: ['reasonable', 45, 100], O: ['okay', 25, 60], L: ['lost', 0, 0],
};
const summer = (n: number, c: string, extra: Partial<SummerRecord> = {}): SummerRecord => {
  const [outcome, nectar, pollen] = DAYS[c];
  return { summer: n, outcome, nectar, pollen, water: 0, waterGoal: 0, meadow: 1, pollinated: 0, moisture: .5, friends: 0, helped: 0, ...extra };
};
const run = (days: string, meadow = 1): HiveState =>
  [...days].reduce((s, c, i) => recordSummer(s, summer(i + 1, c, { meadow })), newHive());

test('five good summers see the colony into a good winter', () => {
  expect(run('GGGGG').ending).toBe('wintered');
});

test('one storm-lost day among good summers never ends it (a lean winter at worst)', () => {
  for (const days of ['GGLGG', 'LGGGG', 'GGGGL']) expect(['wintered', 'lean']).toContain(run(days).ending);
});

test('a lost day brings the hive nothing', () => {
  expect(run('L').stores).toBeCloseTo(ARC.start - ARC.use);
});

test('a bad start can be mended by good summers', () => {
  expect(run('OOGGG').ending).not.toBe('collapse');
  expect(run('OOGGG').ending).not.toBe('absconded');
});

test('poor summers in a row on low stores: the colony leaves before winter, never before summer 3', () => {
  const twoLost = run('LL');
  expect(twoLost.ending).toBeNull();
  const s = run('LLO');
  expect(s.ending).toBe('absconded');
  expect(s.summers).toHaveLength(3);
  // Once it has ended, more summers change nothing.
  expect(recordSummer(s, summer(4, 'F')).summers).toHaveLength(3);
});

test('good summers, then neglect, end in a hungry winter', () => {
  expect(run('GGOOL').ending).toBe('collapse');
});

test('a thin meadow gives less honey for the same day', () => {
  expect(run('GG', .6).stores).toBeLessThan(run('GG', 1).stores);
});

test('stress: none in the first summer, more on low stores and after a thirsty hot day', () => {
  expect(hiveStress(newHive())).toBe(0);
  expect(hiveStress(run('GG'))).toBe(0);
  expect(hiveStress(run('LO'))).toBeGreaterThan(.5);
  const thirsty = recordSummer(run('G'), summer(2, 'G', { water: 3, waterGoal: 15 }));
  const watered = recordSummer(run('G'), summer(2, 'G', { water: 15, waterGoal: 15 }));
  expect(hiveStress(thirsty)).toBeGreaterThan(hiveStress(watered));
});

test('stores in words, never a number', () => {
  expect(storesWord(ARC.start)).toBe('enough');
  expect(storesWord(run('GGG').stores)).toBe('plenty');
  expect(storesWord(run('LO').stores)).toMatch(/low/);
});

test('the closing summary: one card per summer, and the weather, meadow, hive and Queen in words', () => {
  expect(runSummary(run('GGG'))).toBeNull();
  const days = ['G', 'F', 'L', 'G', 'G'];
  const state = days.reduce((s, c, i) => recordSummer(s, summer(i + 1, c, {
    meadow: 1 + i * .04, pollinated: c === 'L' ? 2 : 12, helped: i === 0 ? 1 : 0, moisture: .6 - i * .07,
    season: (['wet', 'ordinary', 'dry', 'hotdry', 'ordinary'] as const)[i], showers: i === 0 ? 2 : 0, hot: i === 3,
    waterGoal: i === 3 ? 15 : 0, water: i === 3 ? 15 : 0,
  })), newHive());
  const summary = runSummary(state)!;
  expect(summary.title).toBe('The Queen’s Farewell');
  expect(summary).toMatchObject({ outcome: 'A swarm in spring', mood: 'happy' });
  const [opening, weather, meadow, hive, farewell] = summary.speech;
  expect(opening).toContain('five summers have passed');
  expect(summary.cards.map(c => c.day)).toEqual(['Good', 'Fantastic', 'Not home', 'Good', 'Good']);
  expect(summary.cards[3].weather).toBe('Hot, dry');
  expect(weather).toContain('We had one wet summer and two dry ones');
  expect(weather).toContain('carried water home on it');
  expect(meadow).toContain('You pollinated 50 flowers');
  expect(meadow).toContain('grew from 72 flowers to 84');
  expect(meadow).toContain('drier');
  expect(hive).toContain('One day you didn’t come back to us');
  expect(hive).toContain('one tired sister');
  expect(hive).toContain('Summer 2 was your finest');
  expect(farewell).toContain('swarm');
  expect(summary.facts).toContain('supersedure');
});

test('the farewell is sad when the colony fails, and bittersweet when a new queen takes over', () => {
  const left = runSummary(run('LLO'))!;
  expect(left).toMatchObject({ outcome: 'The colony moves on', mood: 'sad' });
  expect(left.speech[0]).toContain('three summers have passed');
  expect(left.speech[4]).toContain('we leave together');
  const lean = runSummary(run('RRRRR'))!;
  expect(lean).toMatchObject({ outcome: 'A new queen', mood: 'bittersweet' });
  expect(lean.speech[4]).toContain('young queen');
  const hungry = runSummary(run('GGOOL'))!;
  expect(hungry).toMatchObject({ outcome: 'A hungry winter', mood: 'sad' });
});
