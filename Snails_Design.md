# Snails: a design

A proposal for adding snails as the next meadow friend, written 2026-09-26. Nothing here is built yet. Open questions for Lynn are at the end.

## Why snails

Snails turn the weather and the meadow's health into something you can see:

- **Rain:** out they come, bodies stretched, tentacles up, leaving shiny trails.
- **Hot sun:** they seal themselves in and wait it out, often up a stem off the hot ground.
- **A thin, patchy meadow:** the ground dries out and most of them stay sealed. A lush one keeps them busy.

They are slow, harmless and a little comic, which suits the game's gentle tone. The bee never has to avoid them.

## What real meadow snails do (checked)

- **Who lives there:** banded snails (*Cepaea*) live in hedgerows, downland turf and dunes. Their shells are yellow, pink or brown with up to five dark bands [1][2]. In dry, open grassland in France there is also a smaller off-white snail with reddish-brown bands (*Cernuella virgata*, 8–25 mm across) [3]; the game leaves it out.
- **When they're active:** mostly at night and in damp weather. On summer mornings they move up into higher, shaded vegetation to escape the heat [1].
- **Heat and dry weather:** they seal the shell opening with a dried-mucus lid (an epiphragm) and slow right down. Some climb tall plants, posts or fences to wait it out off the hot ground [4][5].
- **Diet:** they prefer dead plant material to fresh, and herbs to grasses [1]. After rain they eat mostly decaying matter; in dry spells they eat more fresh plants, to get water [6]. The game shows only the dead-matter part.
- **Role:** they are decomposers, a small part of decomposition overall, and important for calcium cycling [7].
- **Speed:** very slow. Real snails move millimetres a minute.
- **Senses:** upper tentacles carry the eyes, and the tentacles pull in when touched [1].
- **Predators:** song thrushes crack them on stones [1]. We would leave predation out of the game.

## In the game

### One kind (decided 2026-09-26)

**Banded snail:** a shell about 2 cm across (0.2 units), in yellow, pink or brown, with 0 to 5 dark bands. The colour and band variety comes from within the one species, as in real *Cepaea*. (The white-banded grassland snail was considered and left out.)

### Behaviour follows the weather

The game already knows rain, cloudiness, sun heat, morning dew, leaf wetness and the time of day, so snails need no new systems. Each snail has one of five states:

| State | When | What you see |
|---|---|---|
| **Crawling** | rain, just after rain, morning dew, dusk | Body stretched out and tentacles up, gliding over the ground, up stems, or across the tops and undersides of leaves. A shiny trail follows. |
| **Feeding** | now and then while crawling | It stops and nibbles dead plant matter only (decided 2026-09-26): fallen petals, and the dry stalks of last summer's unpollinated flowers (the `meadowGaps`). Living leaves and flowers are never eaten, so nothing in the meadow looks damaged. |
| **Tucked in** | dry and mild | Pulled into its shell in shade: under a broad leaf, at a leaf's base, or in dense grass. |
| **Sealed up high** | hot sun | Climbs 20–40 cm (2–4 units) up a stem and seals itself on, showing a white lid in the opening. Now and then two share a stem. |
| **Shy** | the bee comes within about 5 cm | The tentacles pull in, then slowly come out again. It never flees. |

Changes between states are slow and readable:
- The body slides into the shell or out of it over about 2 seconds.
- The lid fades in once the snail is fully inside.
- A snail heading up a stem to escape the heat starts climbing as the hot spell builds, so you can catch it on the way up.

### Trails

Each crawling snail leaves a thin silvery ribbon along its recent path:
- The trail glints in low sun and in Bee Vision.
- It dries and fades over a minute or two, faster in sun and slower in rain.
- In the morning after a shower, the ground near leaves is crossed with trails. That's the visible clue that snails are about, even when they're hidden.

### Meadow health across summers

- **How many:** snail numbers depend on how full the meadow is. A patchy meadow has less shade and damp at ground level. Add a `snails` count to `friendCounts()`: about 12 in a normal meadow, down to 4 in a thin one.
- **How active:** with fewer flowers, more of them start the day tucked in or sealed, and they come out less even after rain.
- **Start page:** add a Snails cell to the friends group. The sentence follows the state, for example:
  - "With the meadow patchy, the ground dried out, and most snails stayed sealed in their shells."
  - "A lush meadow kept the ground damp; the snails were out after the rain."
- **Decomposers:** active snails slowly clear last summer's dry stalks. It's a small, visible way to show they recycle the meadow.

### Meeting one

- **Counting:** coming within about 1 unit counts it as met, like ladybirds and butterflies.
- **First meeting:** the first one brings a note, for example: "A snail! Snails come out when it's damp, and seal themselves in when it's hot."
- **Results screen:** snails are added to the "Meadow friends" row.

## How to build it

Build it the same way as `friends.ts` and `butterflies.ts`:

- **Module:** `src/snails.ts`. `createSnails(scene, seed, flowers, leaves, count)` is rebuilt with the meadow. Each frame, `update(time, dt, bee, reduced, world)` gets `{ rain, sun, heat, dew, dusk }`.
- **Where they can be:** the ground (`meadowGroundHeight`), a flower stem (the same stem curve the ladybirds use), or a leaf top or underside (`leafSurfaceHeight`, flipped underneath, as the butterflies do). They move from ground to stem to leaf only where they touch.
- **Shell:** one shared spiral mesh, a tube following a widening log-spiral with 3.5 whorls, instanced. A small painted atlas holds the colour and band patterns, like the butterfly wings. The white lid is a tiny disc in the opening.
- **Body:** a soft tapered foot plus four tentacles, the upper two tipped with dark eye dots. One instanced mesh, with a stretch value from 0 (inside the shell) to 1 (fully out) driving the foot length and tentacles.
- **Trails:** a ring buffer of recent positions per snail, drawn as one set of thin line segments. Each point stores its age, and the shader fades it with dryness.
- **Speed:** about 3 mm/s (0.03 units/s). That's faster than real, so you can see them move, but still clearly slow. Climbing a stem takes a minute or so.
- **Cost:** about four draws in total (shells, bodies, lids, trails). Snails beyond about 14 units from the camera are hidden, like the ladybirds.
- **Reduced motion:** no crawling or animation; each snail simply shows the pose that fits the weather.
- **Test hooks and tests:**
  - A `snails()` list and a `snapshot().snails` summary.
  - Tests for:
    - rain: `setDayProgress(.35)` in the fixed test weather, and most snails are crawling;
    - the hot spell: `.55`, and most are sealed, some on stems;
    - clear weather: most are tucked in;
    - shyness: the tentacles pull in when the bee is near;
    - summers: a thin meadow means fewer snails, and more of them sealed.

### Build order

1. Shell and body meshes, the painted shell atlas, and placement on the ground and under leaves. Check the look with screenshots.
2. Weather states and the slide in and out of the shell.
3. Climbing stems in heat.
4. Trails.
5. Meeting a snail, the note, and the results row.
6. Summers: `friendCounts`, the start-page cell and sentence, and snails clearing the dry stalks (once the gaps are drawn).

## Open questions for Lynn

Decided 2026-09-26: one kind (the banded snail), and snails eat dead plant matter only.

Still open:
1. **Could the bee rest on a snail's shell?** A slow ride would be a charming Small wonders moment, but it's extra work.
2. **Slugs:** leave them out? I'd say yes.

## Sources

1. [Cepaea nemoralis](https://animaldiversity.org/accounts/Cepaea_nemoralis/), Animal Diversity Web.
2. [Cepaea](https://en.wikipedia.org/wiki/Cepaea), Wikipedia.
3. [Cernuella virgata](https://carnegiemnh.org/mollusks/cernuella-virgata/), Carnegie Museum of Natural History.
4. [Aestivation](https://en.wikipedia.org/wiki/Aestivation), Wikipedia (epiphragm; climbing tall plants and posts).
5. [Tree climbing by the snail Cepaea nemoralis: a possible method for regulating temperature and hydration](https://www.researchgate.net/publication/237983222_Tree_climbing_by_the_snail_Cepaea_nemoralis_L_a_possible_method_for_regulating_temperature_and_hydration).
6. [Rain events influence short-term feeding preferences in the snail Cepaea nemoralis](https://academic.oup.com/mollus/article/77/3/241/1209039), Journal of Molluscan Studies.
7. [Land Snails Ecology](https://carnegiemnh.org/mollusks/land-snails-ecology/), Carnegie Museum of Natural History.
