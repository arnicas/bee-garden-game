# Weather scenarios: choosing the weather at the start

A design for start options that set a run's weather: **how much rain** (little, as nature
decides, a lot) and **how much heat** (cool, as nature decides, hot), and later **the
meadow's flowers** (the mix of kinds, and how full it starts). Drafted 2026-10-11 (Lynn).
Nothing is built yet. It replaces the "Scenario mode" sketch in `Seasons_Design.md`
(step 5), which offered whole seasons ("Wet summers", "Hot and dry") rather than two dials.
Decisions for Lynn come first.

## Decided (Lynn, 2026-10-11)

1. **The middle options mean "as nature decides"**: rolled each summer, as now, so the
   default run is today's game.
2. **The rain choice nudges the starting ground**: little rain starts at moisture 0.35, a
   lot at 0.65 (0.5 as now otherwise).
3. **A choice before the first summer**, on its own panel that also explains the five
   summers (see "The choice on screen"): "As nature decides", a few named combinations
   ("Hot and dry", "Wet and cool", …), and a row to mix your own rain and heat. So all
   nine combinations are possible.
4. **All nine combinations**, each with a name and a short line.
5. **Trend scenarios** ("getting drier", "getting wetter"): on hold.

## What exists now

- **One season per summer** (`Season` in `weather.ts`: wet, ordinary, dry, hot and dry),
  rolled by `rollSeason()` and leaning on ground moisture, so dry ground brings more dry
  summers. Each season is one `SeasonShape`: night odds, shower count and length, hot
  spell length and timing, chance of a second windy spell.
- **Rain and heat are tied together** in that one value: "wet" also shortens the heat,
  "hot and dry" also cuts the showers. So the season can't express hot-and-wet or
  cool-and-dry.
- **Every day has one hot spell.** `sunHeat` ramps to 1 inside it (less under cloud).
  The hive asks for water when the spell lasts 185 seconds or more (`hiveNeedsWater`).
- **Ground moisture** carries over: rain and a wet night raise it, heat and a dry night
  lower it (`nextMoisture`), and a thin meadow loses more. It sets the grass, pools,
  daisy droop, friends, next summer's flowers and the season roll.
- **Dev flags**: `?season=` forces a season, `?weather=N` replays one day, `?moisture=`
  sets the ground.

## The model: two dials instead of one season

Split `SeasonShape` into a **rain shape** and a **heat shape**, and roll (or pin) each:

| Rain | Nights (wet / dewy) | Showers (none / one / two) | Shower length |
| --- | --- | --- | --- |
| Little | mostly dry nights (.08 / .45) | mostly none (.55 / .95) | short (×0.75) |
| Ordinary | as now (.3 / .8) | as now, by the night | as now |
| A lot | mostly wet nights (.5 / .95) | mostly two (.02 / .4) | long (×1.25) |

| Heat | Hot spell length | Strength | When | Second windy spell |
| --- | --- | --- | --- | --- |
| Cool | short (60–110 s) | ×0.6 (no heat stress most days) | around midday | rarer |
| Ordinary | as now (150–195 s) | ×1 | as now | as now |
| Hot | long (215–260 s) | ×1.15 | earlier, longer | likelier (.8) |

- **"As nature decides"** rolls each dial every summer, leaning on ground moisture as
  `rollSeason` does now. The four old seasons become combinations: wet = a lot of rain +
  cool-ish heat, dry = little rain, hot and dry = little rain + hot. The default run must
  give exactly the same days as today for the same seeds (a test checks this).
- **A pinned dial** uses its level every summer; the days still vary within it.
- **Heat strength** is new: `weatherAt()` scales `sunHeat` by it, so a cool summer's
  spell warms the bee less (no water request, little need for shade).
- **Ground moisture follows on its own**: `nextMoisture` already reads the rain and heat
  minutes, so little rain and heat dry the meadow over the summers (fewer daisies, more
  poppies, shrunken pools, browner land beyond the hive), and a lot of rain dampens it
  (snails, mushrooms, more daisies).
- **Words**: the season note at the start of a day and the start page take the two
  levels: "A hot, dry summer." / "A cool, wet summer." / "A muggy summer: heat and heavy
  showers." / "A mild, dry summer." Ordinary on both sides says nothing, as now.

## Making a lot of rain matter (and little rain)

Today a wet summer costs the bee mostly time spent sheltering. In a real meadow heavy
rain costs much more, so for "a lot of rain" to feel distinct, these are worth adding
(each true to real meadows, each small):

- **Rain washes out nectar.** A flower out in a shower loses part of its nectar (diluted
  or washed off), shown on its nectar bar, and refills slowly in the sun afterwards.
  Flowers sheltered by a broad leaf keep theirs. So the best time to forage is just
  before rain and a while after, not straight after.
- **Grasses crowd out the flowers.** Over wet summers the grass grows lush and tall and
  takes ground from the wildflowers: on very damp ground the meadow loses a few flowers
  each summer (most from the annuals, poppies and cornflowers; the daisies hold on),
  through `nextCounts()`. A wet run thins the meadow just as a dry one does, in a
  different way.
- **Flowers close up in rain.** Poppies drop a petal or two in a heavy shower, and
  flowers can't be sipped while the rain is on them (the drop beads on the petals
  instead, which the bee can sip as water, as now).
- **The colony eats its stores on rainy days.** When the foragers can't fly, the hive
  lives on what it has. In the stores model, a summer's rain minutes add a small extra
  cost (about 0.15 of a winter for a very wet day), so a run of wet summers is hard on
  the hive even when the bee does well. True to bees: wet summers are poor honey years.

And the mirror for **little rain**, mostly already there: a dry meadow has less nectar
(drought shrinks it), daisies droop and brown, pools shrink, the hive needs water on hot
days, and the land beyond the hive turns to straw. One addition: in a long drought,
**nectar per flower drops** a little (plants under water stress make less), so the bee
has to visit more flowers for the same load.

Bee Facts gets a short "Wet and dry summers" page saying what's real and what the game
simplifies.

## The ground, rebalanced (2026-10-11)

A simulation of 200 five-summer runs per combination showed the first version ran to the
ends: most wet combinations were sodden by summer 2 or 3 (all of them looking alike), rain
swamped heat (muggy as wet as wet and cool), "cool" alone flooded the meadow (0.92), and
"hot" asked for water every day. Now `nextMoisture()` compares the day with an ordinary
one (rain, the night, and heat above or below ordinary, weighted by its strength) and
moves the ground nearly half the way each summer toward the level that weather settles
at; the meadow's cover still adds or takes on top. A hot summer asks for water on about
85% of days. Ground after five summers (start → summer 5, averaged):

| Weather | Ground | Hot days |
| --- | --- | --- |
| Hot and dry | 0.25 → 0.15 | 90% |
| Dry (natural heat) | 0.28 → 0.20 | 42% |
| Mild and dry | 0.32 → 0.30 | 0% |
| Hot (natural rain) | 0.47 → 0.40 | 87% |
| As nature decides | 0.50 → 0.48 | 29% |
| Cool (natural rain) | 0.54 → 0.60 | 0% |
| Muggy | 0.68 → 0.72 | 88% |
| Wet (natural heat) | 0.71 → 0.79 | 18% |
| Wet and cool | 0.74 → 0.85 | 0% |

## Flowers (later)

Two more dials, built the same way once the weather feels right:

- **Mix**: balanced (as now), or mostly poppies, mostly daisies, mostly cornflowers. The
  first summer's meadow uses it in place of `moistureMix()`. After that pollination and
  the ground take over, as now.
- **Fullness**: sparse (about 45 flowers), ordinary (72), lush (about 95). A sparse start
  is a harder run (less forage, and the ground dries faster).

## The choice on screen

**A "Your five summers" panel** between "Take flight" and the first summer (only when
starting a new meadow; Continue goes straight on):

- **The arc, in a few lines:** five summers are one Queen's reign; each summer is one
  day; what you bring home fills the hive's stores, and what you pollinate grows next
  summer's meadow; "After five summers, the fate of the hive is decided. Work hard!" (The
  Queen's farewell stays a surprise.)
- **The weather for her reign**, as a set of cards to pick from:
  - **As nature decides** (the default, first): "Each summer brings its own weather,
    and the ground remembers it."
  - **Named combinations**, each a small card with a picture and one line:
    - **Hot and dry**: little rain, hot. "Water is scarce; find pools early and keep to
      the shade."
    - **Wet and cool**: a lot of rain, cool. "Showers come often; shelter, and fly
      between them."
    - **Muggy**: a lot of rain, hot. "Heavy showers and heat: wet wings and thirsty
      hives."
    - **Mild and dry**: little rain, cool. "Gentle days, but the meadow dries."
  - **Mix your own**: two rows of three choices, rain (little · as nature decides · a
    lot) and heat (cool · as nature decides · hot), with small pictures. Picking a named
    card sets the rows; changing a row selects "Mix your own". All nine combinations are
    reachable.
  - A one-line forecast under the choices for the current combination.
- **Flowers**: a greyed row, "Coming later".
- **"Begin the first summer"** starts the run.
- **Remembered** in the browser (its own key, like the lore switch), so the panel opens
  on last time's choice.
- **Saved with the run** (`RunSave` gets `weather: { rain, heat }`), so Continue keeps it.
- **In play**: the start page names the chosen weather when it isn't as nature decides
  ("You chose a hot, dry reign."), before the usual line.
- **The Queen's Farewell** names it in her weather paragraph, and the summer cards show
  each summer's weather as now.

## Fairness and the hive

- Harder weather makes the five summers harder: little rain and heat means more water
  trips and drier, thinner meadows; a lot of rain means more time sheltering. The stores
  model doesn't forgive it (the haul is the haul), but the card says so up front, and the
  Farewell credits it.
- Proposed: no difficulty score or reward for hard settings; it's a way to explore what
  weather does to a meadow, not a challenge mode.

## Tests

- **Weather plans** (unit, seeded, a few hundred days each): little rain gives far fewer
  showers than a lot; cool heat never asks the hive for water; hot asks most days; the
  "as nature decides" default gives exactly today's plans for the same seeds.
- **Ground moisture over five summers**: little rain + hot falls; a lot of rain + cool
  rises.
- **In the game**: the title card sets the choice; it's remembered after a reload; a
  saved run keeps its weather; the start page and the Farewell name it; dev flags
  `?rain=little|nature|lots&heat=cool|nature|hot` for tests and tuning.

## Order of work

1. **Split the season into rain and heat shapes** (done 2026-10-11): `RAIN_SHAPES`,
   `HEAT_SHAPES`, `WeatherChoice` and `planWeather(random, season, choice)` in `weather.ts`;
   heat strength in `weatherAt()`, `nextMoisture()` and `hiveNeedsWater()`; the starting
   ground nudged; the default unchanged; dev flags `?rain=` and `?heat=`;
   `tests/weather-choice.spec.ts`.
2. **Words** (done 2026-10-11): names and lines for the nine combinations (`COMBOS`,
   `describeChoice`, `choiceNote`, `summerWeatherName` in `weather.ts`); the morning note,
   the start page, the summer cards and the Farewell name the chosen weather.
3. **The "Your five summers" panel** (done 2026-10-11, `tests/reign-panel.spec.ts`): the
   arc in four lines, five named weathers plus "Mix your own", rain and heat rows, a
   forecast, flowers greyed; remembered in the browser; saved with the run; Enter begins,
   Esc or Back returns to the title. Off on test pages unless `?choose`.
4. **Starting ground** from the rain choice (done with step 1); the Farewell and start
   page name the choice (done with step 2).
5. **Rain and drought costs** (done 2026-10-14 except leaf-sheltered flowers and poppy petals; see TODO): nectar washed out by rain and refilling in the sun; grasses
   crowding out flowers on very damp ground; flowers closed in rain; rainy days costing the
   hive's stores; less nectar per flower in a drought; a Bee Facts page.
6. **Flowers** (mix and fullness), as a later step.
7. **Tune in play**: try each corner (little rain + hot, a lot + cool) for a full run.

## Between-summer cards name the cause (2026-10-11)

The results card ("Next summer: …") and the summer-start card now say *why* the ground changed,
weather first, then the bee's share:

- Weather cause (`groundCause` in `src/weather.ts`): the summer's pull on the ground is split into its
  rain side (rain + night dew) and heat side. Drying → "heat" or "little rain", whichever weighed more;
  wetting → "rain" or "cool". A near-ordinary summer gets no weather sentence.
- The meadow left behind (`coverMoisture`) is folded into the same sentence: a patchy meadow
  "will dry it further", a full one "will keep some of it damp".
  e.g. *This summer’s heat dried the ground, and the patchy meadow you leave will dry it further.*
- On the next summer's card, the flowers line opens with how the ground favoured them
  (dry → poppies and cornflowers; damp → daisies), before what your pollination did.

## Your share, the ground's share, the meadow's own (2026-10-11)

The two cards split the work:

- **Results card** (end of the day) is about your day: the Queen, the meadow, the stats, the tip,
  and one look-ahead line ("Next summer: more poppies, fewer daisies."). No weather reasoning.
- **Start card** (next summer) tells the meadow's story: the weather line (your choice, what
  moved the ground and how the meadow you left helped or hurt), then the before → after counts,
  each group followed by rows saying why:
  - 🐝 **Your pollinating:** next summer worked out on ordinary ground (.5), with your pollination vs with none.
  - ☀ / 🥀 / 🌧 / ☁ **The dry (or damp) ground:** the real ground vs ordinary ground. Picture follows
    last summer's cause (heat → sun, little rain → wilted flower, rain → rain cloud, cool → cloud);
    "The ground, still dry/damp" when the summer pulled the other way but the ground hasn't caught up.
  - 🌱 **The meadow on its own:** the rest (annuals falling back to their seed bank, daisy clumps
    thinning, friends' small wobbles), so the three rows add up exactly to the counts above.
  - Under the friends, one food-web sentence stays (e.g. fewer poppies → fewer aphids → fewer ladybirds).
- Split worked out when the summer turns over (`meadowShares` in `src/meadow-plan.ts`, kept as
  `lastShares` in garden.ts); rows in `startSplit` in `src/day-report.ts`.
