# Seasons and water: design

Lynn, 2026-09-28. A design for weather that carries across summers, a meadow that
visibly shows it, water as a core part of play, and a small scenario mode.
First guesses at numbers, to be tuned through play.

## The problem

Today, what one summer passes to the next is almost only pollination: annuals set
seed and the flower counts move. Weather is rolled fresh each day and carries over
for a single night (wet, dewy or dry, into the next morning). The friends follow the
flower counts at one remove, gently. So from summer to summer the meadow mostly
changes by numbers on the start page, not by anything you see when you arrive.

## Principles

- **Legible over realistic.** Each season should look and play clearly differently.
  Where we simplify the ecology, the Bee and Meadow Facts say so, as they do now.
- **The meadow shows it first.** A player should know what kind of summer it is
  from the first look, before reading anything.
- **No new meter.** Water works through the heat and the jar the bee already has
  (see "Water and the bee").
- **Weather is credited, not blamed.** A hard summer isn't the player's fault; the
  Queen and the results screen say what the bee did in spite of it.
- **The bee still decides who comes back.** The season sets the stage; pollination
  stays the strongest influence on next summer's flowers.

## The model: the meadow remembers water

One slow value, carried from summer to summer: **ground moisture** `M`, from 0
(parched) to 1 (sodden). A new game starts at 0.5.

At the end of each day, `M` moves toward what the day was like:

```
dayWetness = clamp(rainMinutes / 4 + (night === 'wet' ? .25 : night === 'dewy' ? .1 : 0)
                   - heatMinutes / 6 - (night === 'dry' ? .15 : 0), -1, 1)
M = clamp(M + dayWetness * 0.35, 0, 1)
```

(Rain and heat minutes are those of the day's own plan; a day stands for a summer.)
Because it moves a third of the way at most, one odd day nudges the meadow, and a
run of similar summers moves it a long way. Scenario mode can also nudge `M`
directly each summer (see below).

Moisture is read in three bands for anything that needs a clear switch:

| Band | M | Name in text |
|---|---|---|
| Dry | < .3 | "a dry summer" |
| Ordinary | .3–.7 | (no mention) |
| Wet | > .7 | "a wet summer" |

Heat is its own thing, from the season (see scenarios), so we can have "hot and dry"
without a second slow value.

### The season shapes the days

`planWeather(random, season)` takes a season that biases the roll:

| Season | Showers | Nights (wet/dewy/dry) | Hot spell | Gales |
|---|---|---|---|---|
| Wet | 1–2, longer | 50 / 45 / 5 | short, late, or none | as now |
| Ordinary | 0–2 (today's roll) | 30 / 50 / 20 | as now | as now |
| Dry | 0–1, short | 10 / 45 / 45 | as now | as now |
| Hot and dry | 0–1, short | 5 / 35 / 60 | long and early | more wind |

In ordinary play the season is rolled each summer, leaning toward what `M` already
is (a wet meadow is likelier to get another wet summer), so runs of wet or dry
summers happen naturally. In scenario mode it is set.

## What moisture changes in the meadow

These are what make summers look different. All are read from `M` when the meadow is
built, so nothing changes during a day.

| | Dry (M low) | Wet (M high) |
|---|---|---|
| Grass | shorter, thinner, tinted straw and tan, dusty ground showing | tall, dense, deep green |
| Pools | fewer; some are dry, cracked hollows with a pale rim | more, and fuller |
| Dew | light, and burnt off by mid-morning | heavy, lasting into late morning |
| Leaves | smaller, some curled at the edges | broad and glossy |
| Daisies | droop on their stems, smaller heads, some going brown | tall and fresh |
| Poppies | many and bright (they like dry, disturbed ground) | fewer; petals spotted by rain |
| Cornflowers | hold up well | as now |
| Webs | hard to see | beaded with dew, easy to spot |

Drooping is a bend of the stem near the head plus a tilt of the head (a new
per-flower `droop` in `world.ts`, 0–1, for daisies mostly). Browning is a tint on
petal tips. Grass tint and height go through the existing grass material and
instancing. Dry hollows reuse the puddle spots with a cracked-earth decal instead of
water.

### Species (legible version)

Next summer's counts already come from pollination (`nextCounts`). Moisture then
multiplies each species, after pollination, with a small effect so the bee still
leads:

| Species | Dry | Wet |
|---|---|---|
| Poppy (annual) | × 1.25 | × 0.8 |
| Cornflower (annual) | × 1.1 | × 1.0 |
| Daisy (perennial) | × 0.8 | × 1.15 |

Simplified: real poppies and cornflowers are arable annuals of open, well-drained,
disturbed ground; oxeye daisy is a grassland perennial. The Facts page on seasons
says this.

### Friends (bolder than now)

Today the friends change gently with the flowers. With moisture they should change
enough to notice:

| Friend | Dry | Wet |
|---|---|---|
| Snails | few, and sealed on stems most of the day | many, out on leaves and stems, trails everywhere |
| Mushrooms | none | clumps at most pools; the fairy ring likelier |
| Ants | bigger mounds, more trails, busier | fewer out; nests closed after rain |
| Aphids and ladybirds | aphids boom on poppies; more ladybirds follow | fewer aphids (rain knocks them off) |
| Butterflies | more, on sunny days | fewer, sheltering |
| Caterpillars | as now | more (lusher leaves) |
| Webs | as now | dew makes them easy to find |

This is the fix for "the friends are subtle": a wet summer is a snail-and-mushroom
summer, a dry one an ant-and-ladybird summer, and you can see it within a minute.

## Water and the bee

The heat already exists (the orange edges, `heat` in `garden.ts`), and sipping water
already cools the bee. The in-game note already says bees carry water home to cool
the hive. So water becomes core play without a new meter:

1. **In dry seasons, shade isn't enough.** Grass shelter cools you only as much as
   the grass is dense: thin, straw-coloured grass (low `M`) gives little shade, so
   hiding in the grass stops being the answer. Leaves still shade, but they are
   smaller. Drinking cools much faster than shade.
2. **Water is scarce, and you can see where it is.** Dew is gone by mid-morning in a
   dry summer; some pools are dry hollows; the rest shrink through the day (a pool's
   fill drops with heat). Flowers hold a drop only after rain. Finding water becomes
   route-planning: where the nearest pool is before the heat comes.
3. **On hot days the hive asks for water.** When the hive is hot (a hot spell, and
   more often in hot, dry summers), the hive's goal includes water as well as nectar
   and pollen. The bee carries water in the same crop as nectar, so it goes in the
   jar: sipping water with the jar open fills it with a blue wash instead of gold. A
   day's goal might be "nectar 45%, pollen full, and a little water (15%)". This is
   real: water foragers cool the hive by evaporation. It is gentle (a small amount),
   uses the jar you already watch, and makes the pools a destination, not just a cure.
   Carrying water leaves less room for nectar, which is the real trade-off bees face.
4. **In wet seasons the pressure flips.** Water is everywhere and the problem is
   time: more showers, wet wings, and choosing when to fly between them.

The results screen then says why: "A hot, dry summer. You found water for the hive
twice."

## Scenario mode

A small text button on the start screen, under the main one: **"Set up a climate
scenario"**. It opens a short card:

- **Let the weather decide** (the default; the season is rolled each summer)
- **Wet summers**
- **Dry summers**
- **Hot and dry**
- **Getting drier** (starts ordinary; each summer `M` falls by .1 and the season
  leans dry, then hot and dry)
- **Getting wetter** (the reverse)

The chosen scenario shows as a small line on the summer start page ("Scenario:
getting drier · summer 3"), and the results screen gets a small chart of the summers
so far: flowers of each kind, friends seen, and ground moisture as a thin band behind
them. This is where the long arc shows, not just the last change.

No saves, as now: a scenario lasts until the page is reloaded.

## Words

- Summer start page: one line for the season, only when it isn't ordinary.
  "A dry summer. The pools have shrunk, and the daisies are struggling." /
  "A wet summer. Snails everywhere, and mushrooms by the water."
- Results: credit the weather. "A hard, dry summer. You kept the cornflowers going."
- The Queen's memory (`queenLine`) can take the season into account, so a poor day
  in a drought is forgiven.
- Bee and Meadow Facts: a "Seasons" page (drought and nectar, water foragers cooling
  the hive, which flowers like dry or damp ground, snails and moisture), with what the
  game simplifies.

## Build order

Each step is playable on its own.

1. **Moisture, carried over, and the meadow's look.** `M` in `garden.ts` (with the
   summer state), updated at the end of a day; grass tint, height and density; pools
   and dry hollows; dew. Dev URL `?moisture=0.1` to try it. Test: a dry and a wet
   meadow render differently (grass colour, pool count), and `M` moves as expected
   across summers.
2. **Season shapes the day.** `planWeather(random, season)`; season rolled from `M`;
   the start-page line.
3. **Flowers and friends respond.** Daisy droop and browning; species multipliers in
   `meadow-plan.ts`; bolder friend counts by moisture. Update the summers tests.
   (Done 2026-09-30; see TODO.md.)
4. **Water in play.** Shade from grass scales with density; pools shrink in heat;
   the hive's water request on hot days, filling the jar blue; results lines.
5. **Scenario mode.** Start-screen button and card; scenario line; the summers chart
   on the results screen.
6. **Facts page and tuning.**

## Open questions

- Should the hive's water request come only on hot days, or be a regular small part
  of every day's goal (bigger in heat)?
- Should dry summers shorten the day's nectar (flowers make less), or is the water
  pressure enough on its own?
- How strong can the species multipliers be before the season, not the bee, decides
  the meadow?
- For "Getting drier": should it end somewhere (a recovery summer), or keep going?
