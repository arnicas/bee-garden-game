# The summers arc: five summers, then winter

A design for the run of five summers: what the game has to remember from summer to
summer, a small hidden model of the hive's stores, and the endings. Drafted
2026-10-09 from the TODO item (Lynn, 2026-09-30). The first piece, the stores model
with its tests, is built (`src/hive-stores.ts`, `tests/hive-stores.spec.ts`) but not
yet wired into the game. Lynn's decisions come first.

## Decided (Lynn, 2026-10-09)

1. **Her haul is what counts.** In play, a summer's honey is the bee's haul times the
   meadow (whose size her pollination builds). The text can explain why one bee stands
   for the hive: a loaded forager dances, and her sisters follow her to the same flowers
   (recruitment), which ties into the waggle dance the homecoming already shows.
2. **A lost day** (the bee doesn't get home: out of energy, cold, heat or nightfall)
   **brings the hive nothing.**
3. **Weather and harshness.** Weather already shapes the stores in three ways: hard days
   (showers, a long hot spell, wind) make a full haul harder; dry summers shrink the
   meadow (fewer flowers next summer); a hot day without water costs the hive. The
   numbers don't forgive hard weather, but the words credit it ("A hard, wet summer, and
   still you brought home…"), and leaving early needs two poor summers in a row on low
   stores, so one bad-weather day can't end a run. To be tuned in play.
4. **After an ending: "A new meadow".**
5. **Saving in the browser** (localStorage) at the end of each summer. The title screen
   offers **"Continue with Summer N"** when a saved run exists, beside a fresh start.

## What a summer is

As now: one summer is one day of play. Each finished day (home, or lost) ends that
summer; a new day restarts the same summer. So a run is five days of play, with the
nights between.

## What is tracked across summers

### Already carried from summer to summer (in `garden.ts`)

| What | Where | Used for |
| --- | --- | --- |
| Summer number | `summerNumber` | The start page, the Queen |
| Ground moisture (0 parched – 1 sodden) | `groundMoisture`, `nextMoisture()` | The season roll, grass, pools, friends, flower counts |
| The season (wet, ordinary, dry, hot and dry) | rolled each summer, leaning on moisture | The day's weather |
| The meadow's layout | `advanceSummer()` → `planNextSummer()` spots | Next summer's flowers |
| Summers with none of a kind pollinated | `badSummers` | The seed bank shrinks |
| Last summer's counts (flowers, ladybirds, butterflies, snails, pollinated) | `lastSummer…` | The start page lines |
| Where unpollinated annuals stood | `meadowGaps` | Dry stalks (to do) |
| Outcomes, last 8 | `outcomes` | The Queen's memory |
| Hot days, and those with water brought home | `hotDays`, `waterDays` | The results line |
| The night's weather | `weatherPlan.night` | The next morning (dew, wet leaves, full pools) |

Weather itself isn't carried, beyond the night: each day's weather is rolled fresh from
the season, and the season leans on ground moisture, which is the meadow's memory of
the weather. That's enough, and it stays that way.

### New for the arc

| What | Notes |
| --- | --- |
| **Hive stores** | One hidden number, counted in "winters" (1 is about one winter's need). Never shown. |
| **A record per summer** | Outcome, nectar and pollen delivered, water and the water asked for, the meadow's size, flowers pollinated, ground moisture, friends met, hive mates helped. For the summers strip, the ending summary and the Queen. |
| **The ending** | Wintered, lean winter, hungry winter (collapse) or left early (absconded). |
| **The save** | All of the above plus the meadow layout (a list of flower spots, plain data), the seed bank, the season and the meadow seed. |

## The stores model

Each summer:

```
honey  = meadow × 1.15 × haul
thirst = on a hot day with too little water: up to 0.2
stores = clamp(stores + honey − thirst − use, 0, 3)
```

- **meadow**: this summer's flowers against a normal meadow (72 flowers = 1), between
  0.3 and 1.4. This is where pollination pays off over the run: a fuller meadow feeds
  the whole colony, every summer after.
- **haul**: how loaded she came home, 0 to 1.2 (nectar against the goal, up to 1.4;
  pollen against the pouch). 0 if lost.
- **use** 1 a summer, start at 1. A good day (haul about 1.1) gains about a quarter of a
  winter; a reasonable one just holds; an okay one loses about half; a lost day loses a
  whole summer's use.

At the end of summer five: stores of 1.6 or more is a good winter, 0.9 or more a lean
winter, below that a hungry winter (collapse). **Leaving early:** stores below 0.3
after two poor summers in a row (okay or lost), from summer 3 on.

### How runs come out (first numbers)

| Run | Summers | Stores after each summer | Ending |
| --- | --- | --- | --- |
| Five good summers | GGGGG | 1.34 → 1.75 → 2.23 → 2.77 → 3.00 | good winter |
| Good, lost on the last day | GGGGL | 1.34 → 1.75 → 2.23 → 2.77 → 1.77 | good winter |
| First day lost, then good | LGGGG | 0.00 → 0.34 → 0.75 → 1.23 → 1.77 | good winter |
| Good, one storm-lost day, good | GGLGG | 1.34 → 1.75 → 0.75 → 1.09 → 1.50 | lean winter |
| Five reasonable | RRRRR | 0.99 → 0.97 → 0.96 → 0.94 → 0.93 | lean winter |
| Mixed | GRORG | 1.34 → 1.33 → 0.86 → 0.80 → 1.14 | lean winter |
| Bad start, then good | OOGGG | 0.57 → 0.08 → 0.28 → 0.62 → 1.03 | lean winter |
| Good, then neglect | GGOOL | 1.34 → 1.75 → 1.32 → 0.80 → 0.00 | hungry winter |
| Five okay | OOOOO | 0.57 → 0.08 → 0.00 | leaves in summer 3 |
| Lost, lost, okay | LLO | 0.00 → 0.00 → 0.00 | leaves in summer 3 |

G good, R reasonable, O okay, L lost, F fantastic. The meadow sizes in these runs are
guesses (fuller after good summers); in the game they come from the real flower counts.

## What the player sees (no hive meter)

- **The start page:** "Summer 3 of 5", and when stores are low, one line: "The hive's
  stores are low."
- **The Queen:** her line weighs the stores as well as the last few summers.
- **Hive stress** (0–1, `hiveStress()`): none in the first summer, more on low stores and
  after a hot day without water. It sets:
  - how many fallen bees lie in the meadow (`planGroundedBees(…, stress)`, already
    waiting for it);
  - how many bees fan and dance at the entrance in the homecoming.
- **The summers strip** on the results screen: one mark per summer (its tier, the
  meadow's size, a thin band for ground moisture, friends met), growing as you play.
- **Winter, after summer five:** a short scene and summary of the five summers (how the
  meadow, water and friends changed; flowers pollinated by kind, water carried, friends
  met, hive mates helped):
  - good stores: the colony clusters for winter, warm and humming, with a line for the
    best summer;
  - lean: "A lean winter. They will just get through.";
  - hungry: the collapse ending.
- **Leaving early:** the hive entrance quiet at dusk, then the swarm lifting away. "There
  wasn't enough in the meadow to see the colony through. They have gone to find a better
  place." and what went wrong (flowers, water, lost days).
- **The five summers** (built 2026-10-09): after the last results, a closing page sums up the run: one card per summer (weather, load, the day, flowers) and a line each for the weather, the meadow, the hive and the Queen.
- **Then a way on:** "A new meadow", a fresh run.

## Tests

- **The model** (`tests/hive-stores.spec.ts`, built): five good summers winter well; one
  lost day among good ones never ends it (a lean winter at worst); a lost day brings
  nothing; a bad start can be mended; poor summers on low
  stores leave early, never before summer 3; neglect after good summers ends in a hungry
  winter; a thin meadow gives less honey; stress is none in summer 1 and rises with low
  stores and thirst.
- **In the game** (with the wiring): a fixed run reaches each ending (a dev flag such as
  `?arc=GGOO` to start partway with chosen summers); a reload resumes the same summer;
  the start page names the summer.

## Order of work

1. **The stores model and its tests.** Done.
2. **Wire it in** (done 2026-10-09): record each finished summer (`nextMeadow()` in `garden.ts`), feed
   stress to the fallen bees, "Summer N of 5" and the low-stores line on the start page,
   the Queen. Dev flag `?arc=…`.
3. **Save and resume** (done 2026-10-09; localStorage, wrapped in try/catch), with
   "Continue with Summer N" on the title screen.
4. **The summers strip** on the results screen.
5. **The endings:** the winter scene and summary, leaving early, then "A new meadow".
6. **Tune in play:** the numbers above, with each summer's record and weather logged to
   the console on dev pages, and whether poppies are worth seeking out.
