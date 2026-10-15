/** Flower supplies as the bee left them: pollen, and nectar counting what rain has washed out
 * (rain moves nectar to `washed` and the sun moves it back, so the sum only changes when the
 * bee or a butterfly takes some). For "the bee took nothing" checks across weather. */
export const settled = (supplies: [number, Record<string, any>][]) => supplies.map(([id, s]) => [id, {
  pollen: s.pollen, visited: s.visited, pollinated: s.pollinated, nectar: Math.round((s.nectar + (s.washed ?? 0)) * 1e4) / 1e4,
}]);
