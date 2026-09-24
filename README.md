# Bee Garden

A first-person watercolor meadow game built by me (arnicas) as critique/direction/director and GPT Astra Extra High as developer. Claude Opus 5.5 is now helping with UX fixes. (The text hasn't been scrubbed of AI twee yet, and not mobile ready.) 

Fly among poppies, daisies and
cornflowers, land on their moving petals, collect nectar and pollen, shelter
from weather, and carry a balanced harvest home before the light goes.

One outing represents one summer day. This is a desktop, single-player browser
game built with TypeScript, Three.js and Vite. Art, animation, textures, icons
and audio are generated locally in code; no Blender installation or downloaded
art assets are required. There is no backend, account, API key or save system.
Reloading starts a new session.

## Setup and local preview

Requirements:

- **Node.js 22.12 or later** and npm. Development has been checked with Node
  22.12.0 / npm 10.9.0. The installed Vite version also supports Node 20.19.x.
- A desktop browser with **WebGL2** and hardware acceleration. Chrome is the
  automated test target; other browsers have not had equivalent coverage.
- A keyboard. A mouse is optional; arrow keys support laptop play.

Run these commands from the `bee-garden` repository directory, beside
`package.json`:

```sh
npm ci
npm run dev
```

Open [the development server](http://127.0.0.1:5188/). Vite reloads source changes.
`npm ci` installs the versions recorded in `package-lock.json`; commit that file
with dependency changes.

To run the production build locally:

```sh
npm run build
npm run preview
```

Open [the production preview](http://127.0.0.1:4188/). The build runs TypeScript
checks, then writes the bundled site and source maps to `dist/`. Preview serves
that build: after editing source, **rebuild and refresh** to see changes there.

Both servers bind to `127.0.0.1` and use strict ports. If a port is occupied,
reuse or stop the server you already started; Vite will not silently choose a
different port. No `.env` file or additional service is needed.

## Playing

Choose **Take flight** to start perched on a daisy with the keyboard guide open.
Reading and trying the guide's keys costs no energy or daylight. Choose
**Explore the meadow**, Enter or Esc to begin on the flower; Space takes off.
The opening daisy is visited but its supplies are untouched. Each day starts
at 60% energy, so sipping its nectar is a good first step.

### Controls

| Action | Control |
| --- | --- |
| Fly or crawl | W moves where you look, including up/down; S reverses; A/D move sideways |
| Look | ↑ ↓ ← →; optionally click the meadow to capture the mouse, or drag if capture is unavailable |
| Rise / take off | Space; also cancels an assisted landing and overrides downward flight |
| Descend | Look down and use W; Ctrl is an optional shortcut |
| Steady / brake | Optional Shift; normal flight and landing do not require it |
| Land | E when the small E cue appears; the bee slows and settles onto the moving flower |
| Leaf perch / shelter | E lands on top in mild weather or underneath in rain/hot sun; E from an exposed top moves into shelter |
| Rest / wake | E while settled, or the left-side rest button; walking, F or Space also ends a rest |
| Sip nectar | Aim at the golden nectar and **hold F or the left mouse button** |
| Bee Vision | Q |
| Way home | R or the Way home button gives guidance; fly to the hive-facing meadow edge to finish |
| Pause / release mouse | Esc during play; losing focus or switching tabs also pauses |
| Bee facts | Esc → Small wonders, or About bees on either results screen |
| Sound | M or the speaker button |
| Skip a closing scene | Space, Enter, left-click the meadow or the skip button |
| Wake the quiet view | Any key or click; the first gesture restores the view, so press again to act |

Esc's field guide includes the core controls and short gameplay tips. Optional
mouse/Ctrl/Shift controls can be expanded there. Esc on the title screen does
not open this guide.

### Gathering and pollination

Walk through a flower's central pollen to gather it. Landing, standing still,
outer petals and flower sway do not collect pollen. The visible grains disappear
as the finite supply is used, and remain depleted on revisits.

| Flower | Usable pollen in a full flower | Usable nectar in a full flower |
| --- | ---: | ---: |
| Corn poppy | 21 | 0 |
| Oxeye daisy | 14 | 13 |
| Cornflower | 10 | 28 |

Poppies are the pollen flower, cornflowers the nectar flower, and daisies sit in
between. The balance loosely follows real meadow measurements; see
[Flower_Facts.md](Flower_Facts.md) for the research and sources.

Nectar is shared between personal energy and storage. F/left-click sips directly
from the flower: it restores energy first, then puts the remainder in the jar.
It works even when the jar is full if the bee still needs energy. With both
full, the tongue curls away and sipping stops. Poppies offer pollen only.

The HUD shows energy on a plate, nectar in a jar (capacity 100), and pollen in
a pouch (capacity 140). The left flower panel shows remaining supplies and a
short collection reminder. More cargo gradually slows flight. From about 60%
full the bee wobbles, sags and strains: quick beats dip the view and deepen the
wing hum, and a hint says to follow the hive marker home. Shift halves the
wobble.

Loose pollen on the legs is separate from stored cargo. Carry it to another
flower of the same species to pollinate that flower once. A small flower **+1**
badge, pollen effect and chime confirm the transfer. Walking can replenish loose
pollen even with a full storage pouch; harvesting stops only when both storage
and the current coating have no room, or the flower is empty.

The newest loose pollen appears on the foreleg knuckles in red, cream or blue,
with smaller flecks for other carried types. These colors are a visual game aid.
Q highlights unvisited flowers; matching flowers pulse when you carry their
pollen. Visited flowers lose their flight guide, but E still allows revisits.
The meadow tally counts unique pollinated flowers and tracks all three species.
Its heading shows the meadow's mood (Quiet, Waking, Happy, All three happy) and
how many of the 72 flowers you have visited. A flower you pollinated shows a
small bloom of its species in the flower panel. Helping all three is optional,
not a requirement for returning home.

### Energy, weather and rest

Flying spends energy. Releasing movement lets the breeze carry you at lower
cost; steering into strong wind costs more. Low air near grass is calmer. The
swaying grass and flowers show the wind; stacked wavy lines beside the sun mark
a heavy-wind spell.

Stored nectar automatically feeds a bee with low energy. A full nectar jar also
starts a meal if energy needs topping up. **Rest does not create food**: a
six-second E rest uses stored nectar to restore up to 36 energy while advancing
daylight about 108 seconds. With no nectar, it only saves energy. The left-side
label reads “Resting a while” and a small sleeping bee appears in the lower
left during this state. E cancels it; looking around
with arrow keys does not. No flower supplies are collected during rest.

Each day rolls its own weather: one or two showers, a hot spell most often
from midday into mid-afternoon, and one or two heavy-wind spells. Shelter helps
with all three:

- **Blue watercolor edges** mean low energy or accumulating cold. Flower heads
  and leaf tops are exposed to rain; leaf undersides and dense grass shelter you.
- **Orange edges** mean overheating. Use E to tuck beneath a broad leaf, or
  settle into dense grass near the ground. Cover stops the direct exposure cost
  while the bee gradually warms or cools; nectar still supplies energy recovery.
- The daylight strip shows current conditions. Its rain cloud appears only
  after rain starts; the sun moves out as it clears. Drops stop and “Dry again”
  appears when the shower is over. A warm sun and heat waves mark hot weather.
- **Heavy wind** holds the gusts up and makes them about a third stronger for a
  minute or two. Fly low, perch or shelter in the grass to save energy. Wavy
  lines and a “Heavy wind” caption appear on the strip, and short messages mark
  its rise and easing.

Warnings precede the steep weather drain, but ordinary flight keeps using
energy. E chooses a leaf's underside during rain, hot sun or lingering heat.
In mild weather it offers the top. Descending to the soil lands automatically;
E also settles the bee when already deep in grass. Space leaves either refuge.

After eight safe, quiet seconds on a perch, the HUD fades. After twenty-two,
the camera rises into a slow meadow view, with worker bees in sunshine and a
small breathing sleeping bee in the lower left. Any key
or click returns to the bee. The day strip remains visible while sheltered.
Danger and sunset restore the UI. This scenic rest does not repeat the feeding
or accelerated daylight of the six-second E rest.

### Finishing the day

Gather **at least 50 stored nectar and 140 pollen**, with energy above zero.
Of that nectar, 45 is the hive's goal and 5 pays for the final offscreen flight.
Follow the hive compass and ready-harvest marker to the meadow edge while
airborne. Arrival automatically starts the ending; R cannot skip the crossing.
Keep an eye on nectar used for energy along the way.

The ending rises above the working meadow, approaches the hive, shows two bees
landing and making small simulated waggle dances, then fades to totals. The
5 nectar is deducted once. The dance is decorative and does not encode flower
locations. Esc pauses the scene and M mutes it.

A day lasts **600 simulated daylight seconds**. Rest advances this clock faster;
pause freezes it. Sunset at 540 seconds wakes a resting bee and gives a final
minute's warning. At nightfall, a short harvest ends beneath charcoal watercolor
clouds. A harvest ready at that moment can still finish the ordinary flight home,
paying normal energy costs and meeting the same arrival requirements. Zero energy
at any time instead triggers the exhaustion ending.

Both results screens retain gathered totals and offer **About bees** and a new
day. A new day resets supplies, cargo and pollination, rolls new weather and
lays out a new meadow. There is no persistent save. Carrying one day's
pollination into the next day's flower mix is planned; the hook is
`speciesMixAfter()` in [src/meadow-plan.ts](src/meadow-plan.ts).

### Bee facts and accessibility

**Small wonders** has eight illustrated topics comparing “In nature” with “In
this game”, including rain/rest, heat/shade, the three meadow flowers and the
hive dance. The text,
species qualifications and external research links live in
[src/bee-facts.ts](src/bee-facts.ts). Sources open in a new tab. Topic buttons
and arrow keys navigate; Esc returns to the field guide or the original results.
These notes distinguish game simplifications from actual bee biology.

Menus have keyboard focus, labeled controls and resource values; pollination
also has a text announcement. The game still depends on navigating a 3D view.
System **Reduce motion** is read when the game loads: refresh after changing it.
It reduces ambient motion and particles and uses still cinematic views with
short fades. Mute is available throughout. Audio starts after a user gesture;
the game remains playable if the browser cannot start it.

## Technical guide

The stack is **Three.js 0.185.0 / WebGL2**, **TypeScript 6**, **Vite 8**, and
**Playwright** for browser checks. See [package.json](package.json) and the lockfile
for versions. Rendering uses Three.js materials with GLSL shader customizations,
not a WebGPU/TSL pipeline. The HUD and journals use HTML/CSS and inline SVG.

### Source map

| Files | Responsibility |
| --- | --- |
| [main.ts](src/main.ts), [garden.ts](src/garden.ts), [types.ts](src/types.ts) | Startup, simulation/state transitions, input, foraging, exposure, return rules and UI state |
| [world.ts](src/world.ts), [meadow-plan.ts](src/meadow-plan.ts), [shelters.ts](src/shelters.ts) | Seeded meadow and next-day species mix, flowers, instanced vegetation, moving leaf perches, collision/cover geometry and LOD |
| [wind.ts](src/wind.ts), [wind-effects.ts](src/wind-effects.ts) | Shared wind field, inward edge gusts, current trails and drifting fragments |
| [weather.ts](src/weather.ts), [atmosphere.ts](src/atmosphere.ts) | Daily weather plans (showers, heat, gales), lighting, sky and haze |
| [rain.ts](src/rain.ts), [flower-rain.ts](src/flower-rain.ts) | Rain and water beads on moving petals/leaves |
| [ground-paint.ts](src/ground-paint.ts), [energy-wash.ts](src/energy-wash.ts) | Moss/earth paint and blue/orange/charcoal watercolor overlays |
| [bee.ts](src/bee.ts), [nectar.ts](src/nectar.ts), [pollen.ts](src/pollen.ts), [pollination.ts](src/pollination.ts) | Forelegs, tongue/liquid contact, carried pollen and collection/transfer effects |
| [homecoming.ts](src/homecoming.ts), [rest-view.ts](src/rest-view.ts) | Ending and quiet-perch camera sequences; reused worker bees |
| [audio.ts](src/audio.ts) | Procedural Web Audio, weather, sipping, feedback and ending sound |
| [ui.ts](src/ui.ts), [styles.css](src/styles.css), `*-art.ts` | HUD, menus, controls, timeline and illustrated counters |
| [bee-facts.ts](src/bee-facts.ts), [bee-facts.css](src/bee-facts.css) | Interpretive notes, citations and journal layout |
| [tests/](tests/), [scripts/](scripts/) | Browser regression checks, render inspection and recording helpers |

### Simulation and tuning

`Garden` owns the game state. Motion runs at a fixed **1/60-second** step, with
frame delta capped at 0.1 seconds and up to six steps per rendered frame.
The daylight clock accelerates during deliberate rest; movement, wind, exposure
and metabolic costs remain on ordinary simulation time. Background tabs pause.

Flower-local coordinates attach a landed bee to the moving head. CPU flower
frames and GPU stem bending share the wind field; leaf perches and cover follow
their moving surfaces. Landing uses a short assisted approach and simple
collision proxies, not a general rigid-body physics engine. The first day uses
meadow seed 481; each later day draws a new layout. `?meadow=N` pins a layout
and `?weather=N` pins a weather plan. `?test` pages use seed 481 and the fixed
weather plan.

Current balance values are gameplay choices, not biological measurements:

| Setting | Value / source |
| --- | --- |
| Harvest and capacities | `garden.ts`: nectar goal 45 + return fuel 5; jar capacity 100; pollen goal/capacity 140 |
| Harvest yield | `garden.ts`: pollen and nectar award 0.5 usable units per raw supply unit; flower labels show usable amounts |
| Energy conversion | `garden.ts`: 3.5 energy per stored nectar; sipping/rest recovery capped at 6 energy/second |
| Rest | `garden.ts`: 6 seconds at 18× daylight; perching costs 0.065 energy/second, rest 0.025, before weather costs |
| Day boundary | `garden.ts`: sunset 540, nightfall 600 daylight seconds |
| Start energy | `garden.ts`: `START_ENERGY` 60 (legacy test scenarios start full) |
| Flower supplies | `garden.ts`: `NECTAR_SUPPLY` / `POLLEN_SUPPLY` raw units per species, halved by the yield; see [Flower_Facts.md](Flower_Facts.md) |
| Landing cue | `garden.ts`: `FLOWER_LANDING_REACH` 1.85 past the petals, `FLOWER_LANDING_CLEARANCE` 2.8 above |
| Weather plan | `weather.ts`: `planWeather()` rolls 1–2 showers, a hot spell weighted toward 320 s (`HEAT_PEAK`) and 1–2 gales of 70–110 s; `FIXED_WEATHER_PLAN` (shower from 150, heat 270–465, no gales) on test pages |
| Meadow edge | `wind.ts`: inward current of 11–16 units/s beyond radius 30, about a third stronger in a gale |
| Quiet/scenic view | `rest-view.ts`: begins at 8 / 22 quiet seconds; safety checks in `garden.ts` |
| Return region | `garden.ts`: z ≥ 30, x between −8 and 8, y ≥ 2 art units; ready harvest, flying, no landing assist |
| Hive position | `garden.ts`: (0, 4, 46); HUD distance scales art units by 0.1 |

The meadow's grass-only apron has an inward gust beyond radius 30, rather than
a hard horizontal position clamp. Walking outward through the grass slows to a
stop there and drifts back inward. Flower supplies and loose leg pollen are
separate: a full pouch must not prevent continued pollination. Preserve this
distinction when adjusting yield, depletion or UI counts.

### Rendering and resource use

The meadow has 72 interactive flowers and 16 broad-leaf shelters. Flower heads
share geometry; grass, ground cover and oat heads use spatially culled instance
batches. Distance detail uses hysteresis. Above nine art units, aerial detail
simplifies flowers/grass, keeps 60% of grass instances and omits small ground
plants and flower shadows; full detail returns below seven units.

Flower and shelter-leaf watercolor is applied inside the existing
`MeshStandardMaterial` shaders using `onBeforeCompile`. Poppies have coral washes
and soft pigment pooling; cornflowers fade from indigo bases to pale blue-lilac
tips. Broad leaves use long, feathered green washes and dark modeled veins,
avoiding small spot-like patches. These patterns follow local surface coordinates
as the plants sway. They add fragment-shader work, but no textures, geometry or
extra rendering passes. Fine brush detail fades with pixel footprint to reduce
distant shimmer; the performance cost has not been separately benchmarked.

For shader tuning, see `botanicalMaterial()` in [world.ts](src/world.ts) and
`leafMaterial()` in [shelters.ts](src/shelters.ts). Petal UV bands identify the
species within shared materials: daisy 0–1, poppy 2–3 and cornflower 4–5 in the
V coordinate; the vertex shader restores each to 0–1. Non-petal primitives use
V = -1. Keep that convention consistent across all flower LODs.

Shelter leaves are scaled to 85% of their original length and another 70% across
their width (59.5% of original width). `LEAF_SIZE`, `LEAF_WIDTH_RATIO`,
`leafSurfaceHeight()` and `leafPlanarDistance()` keep the mesh, landing surfaces,
collision and elliptical rain cover aligned. Stem attachments and veins follow
the same shape.

The moss ground adds one 256×256 procedural texture to the existing ground draw.
The watercolor warning uses one 256×256 texture and one overlay draw, shared by
cold, heat and nightfall. Neither requires a second full scene render. The
48 background bees use two instanced draws; two are reassigned to the hive dance.
Effects use bounded pools, and device pixel ratio is capped at 1.5.

Systems expose disposal methods; `Garden.dispose()` releases rendering/audio
resources and listeners during Vite hot replacement. Procedural art and system
fonts need no runtime asset downloads. External fact sources are opened only
when requested.

## Verification and debugging

Build before browser tests: they exercise `dist/`, not the Vite development
server. The default test configuration uses an installed **Google Chrome**.

```sh
npm run build
npm test
```

[playwright.config.ts](playwright.config.ts) runs one worker and starts the preview
server on port 4188 if needed, or reuses an existing server there. Make sure that
server belongs to this checkout and serves the current build. Tests open their
own pages; they do not attach to an existing player tab.

To use a different full Chromium executable, set `BEE_TEST_BROWSER` (POSIX shell
example):

```sh
BEE_TEST_BROWSER='/absolute/path/to/chrome-or-chromium' npm test
```

If Chrome is not installed, `npx playwright install chromium` downloads a
Playwright browser. Its executable path is available with:

```sh
node --input-type=module -e 'import { chromium } from "@playwright/test"; console.log(chromium.executablePath())'
```

Use that path with `BEE_TEST_BROWSER`. This override is for the test runner.
Use a hardware-backed browser for timed flight checks; software rendering or a
heavily loaded machine can stall frames and invalidate wall-clock assumptions.

Useful targeted commands:

```sh
npm test -- --list
npm test -- tests/welcome.spec.ts tests/bee-facts.spec.ts
npm test -- tests/day-rest.spec.ts tests/nightfall.spec.ts tests/homecoming.spec.ts
npm test -- tests/weather.spec.ts tests/heat-shade.spec.ts tests/gusts.spec.ts
npm run verify:visual
```

Coverage includes keyboard flight, assisted landing, walking collection,
nectar/energy accounting, full-pouch pollination, moving perches, weather,
rest, UI focus/layout, endings, reduced motion and disposal. Layout checks
include 1024×600, 1280×720 and 1440×900. `verify:visual` runs the gameplay/render
checks in `tests/visual.spec.ts`; it is not a complete golden-image comparison
suite. Some scenarios use setup hooks to reach a state, then exercise real
input. The welcome tests cover the actual flower-first opening.

Captures and measurements go into `artifacts/`; Playwright traces, failure
screenshots and selected test videos go into `test-results/`. Both are ignored
by Git. They are generated/local evidence, not required files in a fresh clone.

### Inspector and test hooks

With the development server running, capture a seeded scene and render report:

```sh
npm run inspect:canvas -- --url http://127.0.0.1:5188/ --state landed --seed 481
```

For the production preview, use `--url 'http://127.0.0.1:4188/?test'`.
The inspector defaults to Chrome and accepts `BEE_BROWSER_CHANNEL=chromium`
after installing Playwright's Chromium. It uses this channel variable rather
than the test runner's `BEE_TEST_BROWSER`. See `npm run inspect:canvas -- --help`
for output directories and other options. Its `--mobile` capture is diagnostic,
not a claim that mobile play is supported. The `record-*.mjs` helpers assume
installed Chrome and a running preview on 4188.

Development and production URLs with `?test` expose:

- `window.__BEE_TEST__`: detailed snapshots and flower/shelter, cargo, weather
  clock (`setDayProgress`, `setQuietTime`) and position setup helpers.
- `window.__THREE_GAME_TEST_HOOKS__`: seeded scenes, frozen captures and reduced
  motion. Named states are `title`, `flight-start`, `active-play`, `windy`,
  `landed`, `uv`, `pollinated`, `complete` and `failed`.

`window.__THREE_GAME_DIAGNOSTICS__` publishes frame, player, render and canvas
metrics on ordinary URLs too. Setup hooks are absent on ordinary production
URLs, but remain available through `?test`; they are a development interface,
not a stable public API. Frozen captures keep rendering while simulation stops.

The inspector's desktop starting budget is 300 draw calls, 750,000 triangles,
300 geometries and 60 textures. It reports excesses; selected browser tests
enforce their own bounds. These counts are checks, not frame-rate guarantees.

## Hosting and repository scope

`npm run build` produces a static site. Serve `dist/` over HTTP(S) with any static
host; do not open `index.html` directly from the filesystem. `npm run preview`
is for local inspection. There is no server-side runtime or database.

### GitHub Pages

[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) builds
and deploys the game on pushes to `main`, or when manually run on that branch.
It installs the locked dependencies with Node 22, runs the TypeScript/Vite build,
uploads only `dist/`, and publishes through GitHub's Pages actions. Browser tests
remain a separate local verification step.

One-time repository setup:

1. Push this repository's contents, including `.github/`, to GitHub. The game’s
   `package.json` and workflow must be at the repository root.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as
   the source.
3. In **Actions → Deploy Bee Garden to GitHub Pages**, choose **Run workflow**
   on `main`. If the initial push ran before Pages was enabled, rerun that job.
4. Open the published URL in the deployment summary or Settings → Pages.
   Later pushes to `main` update it automatically.

The workflow reads Pages' configured path and passes it as `BEE_BASE_PATH` to
[vite.config.ts](vite.config.ts). This handles both a project URL such as
`https://USERNAME.github.io/REPOSITORY/` and a root/custom-domain URL, without
hard-coding the repository name. Local development and ordinary builds retain
`/`. No personal access token, committed `dist/` or `gh-pages` branch is required.
If you change the deployment branch, update the workflow's trigger and branch
condition as well as any GitHub environment rules.

For other static hosts, set `BEE_BASE_PATH=/path/` when building or use
`npm run build -- --base=/path/`. Source maps are included in the output.
See [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [Vite's Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).

### Files to commit

For a source commit, include `.github/`, source, tests, scripts, configuration,
`package.json`, `package-lock.json`, this README, [TODO.md](TODO.md) and
[Flower_Facts.md](Flower_Facts.md).
[.gitignore](.gitignore) excludes dependencies, builds, local evidence, test
results, logs and OS metadata. The design/facts drafts and skill reference
repositories in the parent workspace are authoring material outside this Git
repository; they are not needed to build or play. Current game rules are
documented here, and the in-game facts and citations are kept in source.

Current limits and follow-up work:

- Desktop keyboard/trackpad play; iPhone/iPad controls and validation are deferred.
- One outing per day, no saved progress, multiple delivery trips or queen/hive
  metric. Multi-day play is next (see [TODO.md](TODO.md)).
- Pacing, weather costs, fuel availability and remaining HUD text need continued
  playtesting; open work is tracked in [TODO.md](TODO.md).
- Gameplay shapes, pollen colors, energy costs, weather and time are stylized.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Lynn Cherny.
