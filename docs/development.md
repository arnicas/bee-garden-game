# Bee Garden developer guide

Everything below is for running, changing and testing the game. It's a
desktop, single-player browser game in TypeScript, Three.js and Vite. All art,
animation, textures, icons and audio are generated in code: there are no
downloaded art assets, backend, accounts or saves.

Back to the [README](../README.md); the rules and numbers are in the [player guide](player-guide.md).

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

## Technical guide

The stack is **Three.js 0.185.0 / WebGL2**, **TypeScript 6**, **Vite 8**, and
**Playwright** for browser checks. See [package.json](../package.json) and the lockfile
for versions. Rendering uses Three.js materials with GLSL shader customizations,
not a WebGPU/TSL pipeline. The HUD and journals use HTML/CSS and inline SVG.

### Source map

| Files | Responsibility |
| --- | --- |
| [main.ts](../src/main.ts), [garden.ts](../src/garden.ts), [types.ts](../src/types.ts) | Startup, simulation/state transitions, input, foraging, exposure, return rules and UI state |
| [day-report.ts](../src/day-report.ts) | Day tiers at the hive: delivery × pollination table, Queen/meadow wording, stats line, tip, and the next morning's line |
| [world.ts](../src/world.ts), [meadow-plan.ts](../src/meadow-plan.ts), [shelters.ts](../src/shelters.ts) | Seeded meadow and next-day species mix, flowers, instanced vegetation, moving leaf perches, collision/cover geometry and LOD |
| [wind.ts](../src/wind.ts), [wind-effects.ts](../src/wind-effects.ts) | Shared wind field, inward edge gusts, current trails and drifting fragments |
| [friends.ts](../src/friends.ts) | Ladybirds and aphid clusters: seeded perches on stems, leaves and ground, instanced shell art with painted spots, crawling, flutter hops |
| [butterflies.ts](../src/butterflies.ts), [snails.ts](../src/snails.ts), [ants.ts](../src/ants.ts) | Butterflies, snails (with trails), ant colonies and their mounds |
| [mushrooms.ts](../src/mushrooms.ts), [petals.ts](../src/petals.ts), [caterpillars.ts](../src/caterpillars.ts) | Small finds: mushroom clumps and the fairy ring, fallen petals with contact shadows, caterpillars and their leaf bites |
| [puddles.ts](../src/puddles.ts), [rain-splash.ts](../src/rain-splash.ts) | Rain pools with reflections and glints; raindrop strikes on the view |
| [webs.ts](../src/webs.ts) | Spider webs in the grass: seeded placement, loose/torn thread lines, dew and rain drops; catching and escape live in `garden.ts` |
| [weather.ts](../src/weather.ts), [atmosphere.ts](../src/atmosphere.ts) | Daily weather plans (showers, heat, gales), lighting, sky and haze |
| [rain.ts](../src/rain.ts), [flower-rain.ts](../src/flower-rain.ts) | Rain and water beads on moving petals/leaves |
| [ground-paint.ts](../src/ground-paint.ts), [energy-wash.ts](../src/energy-wash.ts) | Moss/earth paint and blue/orange/charcoal watercolor overlays |
| [bee.ts](../src/bee.ts), [nectar.ts](../src/nectar.ts), [pollen.ts](../src/pollen.ts), [pollination.ts](../src/pollination.ts) | Forelegs, tongue/liquid contact, carried pollen and collection/transfer effects |
| [homecoming.ts](../src/homecoming.ts), [rest-view.ts](../src/rest-view.ts) | Ending and quiet-perch camera sequences; reused worker bees |
| [audio.ts](../src/audio.ts) | Procedural Web Audio, weather, sipping, feedback and ending sound |
| [ui.ts](../src/ui.ts), [styles.css](../src/styles.css), `*-art.ts` | HUD, menus, controls, timeline and illustrated counters; `redundantCue()` hides the small cue label when the hint line below already says the same thing |
| [bee-facts.ts](../src/bee-facts.ts), [bee-facts.css](../src/bee-facts.css) | Interpretive notes, citations and journal layout |
| [tests/](../tests/), [scripts/](../scripts/) | Browser regression checks, render inspection and recording helpers |

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
| Harvest and capacities | `garden.ts`: nectar goal 45 + return fuel 5; jar capacity 100; pollen goal/capacity 140. Going home early needs only the 5 fuel |
| Day tiers | `day-report.ts` `REPORT_THRESHOLDS`: brimming 85 nectar, flourishing 4 of each kind, “some” 3 pollinated |
| Harvest yield | `garden.ts`: pollen and nectar award 0.5 usable units per raw supply unit; flower labels show usable amounts |
| Energy conversion | `garden.ts`: 3.5 energy per stored nectar; sipping/rest recovery capped at 6 energy/second |
| Rest | `garden.ts`: 6 seconds at 18× daylight; perching costs 0.065 energy/second, rest 0.025, before weather costs |
| Day boundary | `garden.ts`: sunset 540, nightfall 600 daylight seconds |
| Start energy | `garden.ts`: `START_ENERGY` 60 (legacy test scenarios start full) |
| Flower supplies | `garden.ts`: `NECTAR_SUPPLY` / `POLLEN_SUPPLY` raw units per species, halved by the yield; see [Flower_Facts.md](research/Flower_Facts.md) |
| Landing cue | `garden.ts`: `FLOWER_LANDING_REACH` 1.85 past the petals, `FLOWER_LANDING_CLEARANCE` 2.8 above |
| Weather plan | `weather.ts`: `planWeather()` rolls the night (about 30% wet, 50% dewy, 20% dry), 0–2 showers (dry days likelier after a dry night), a hot spell weighted toward 320 s (`HEAT_PEAK`) and 1–2 gales of 70–110 s; `FIXED_WEATHER_PLAN` (dewy night, shower from 150, heat 270–465, no gales) on test pages |
| Meadow edge | `wind.ts`: inward current of 11–16 units/s beyond radius 30, about a third stronger in a gale |
| Spider webs | `webs.ts`: `WEB_COUNT` 28, about 70% old/loose; `garden.ts`: each tap adds 0.16 × (1 − 0.45 × load) toward breaking free (×1.6 below 20 energy) and costs 0.8 energy; morning dew shows about a fifth of the drops |
| Low-energy notices | `garden.ts`: below 38 and below 18 energy, re-armed at 50 |
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
avoiding small spot-like patches. Leaf tops are slightly glossy: a painterly sun glint and grazing sky sheen
are added in the shader, scaled by sun strength, and `leafUniforms.uLeafWet`
makes them darker and shinier after rain. These patterns follow local surface coordinates
as the plants sway. They add fragment-shader work, but no textures, geometry or
extra rendering passes. Fine brush detail fades with pixel footprint to reduce
distant shimmer; the performance cost has not been separately benchmarked.

For shader tuning, see `botanicalMaterial()` in [world.ts](../src/world.ts) and
`leafMaterial()` in [shelters.ts](../src/shelters.ts). Petal UV bands identify the
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

[playwright.config.ts](../playwright.config.ts) runs one worker and starts the preview
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
  clock (`setDayProgress`, `setQuietTime`), position setup helpers, and
  `webs()` / `setWebs(enabled)`, the friends and finds (`ladybirds()`,
  `butterflies()`, `snails()`, `ants()`, `fairyRings()`, `petals()`,
  `caterpillars()`), water (`puddles()`, `setPuddleFill`, `setRaindrops`) and
  `setNight(wet|dewy|dry)`. First-meeting notes are skipped on `?test` pages
  unless `?friends` is added; raindrops, dew and pool filling need `?drops`. Spider webs are off on `?test` pages so older
  flight checks never fly into one; add `?webs` to turn them on.
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

[.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml) builds
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
[vite.config.ts](../vite.config.ts). This handles both a project URL such as
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
`package.json`, `package-lock.json`, the [README](../README.md), [TODO.md](../TODO.md)
and `docs/` (these guides, the design notes in [design/](design/), the research in
[research/](research/) and the README images in `images/`).
[.gitignore](../.gitignore) excludes dependencies, builds, local evidence (`artifacts/`),
test results, logs and OS metadata. The in-game facts and their citations are kept in
source ([src/bee-facts.ts](../src/bee-facts.ts)).

Current limits and follow-up work:

- Desktop keyboard/trackpad play; iPhone/iPad controls and validation are deferred.
- One outing per summer, no saved progress, multiple delivery trips or queen/hive
  metric. Summers are in progress (see [TODO.md](../TODO.md)).
- Pacing, weather costs, fuel availability and remaining HUD text need continued
  playtesting; open work is tracked in [TODO.md](../TODO.md).
- Gameplay shapes, pollen colors, energy costs, weather and time are stylized.
