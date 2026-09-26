# Bee Garden — next steps

## Current slice: one summer day

- [x] Morning-to-sunset lighting, a final-minute warning and a charcoal watercolor nightfall ending when the harvest is short. A ready harvest can finish the flight home.
- [x] Meadow pullback, lightweight working bees, first-person hive approach, sunset fade and illustrated totals.
- [x] Altitude-based low detail, pause/mute/skip/restart, reduced motion and laptop layouts.
- [x] A small sun arc shows the day; E on a flower starts a brief, interruptible rest that moves the daylight forward and uses stored nectar to replenish energy.
- [x] Broad-leaf shelters, E to tuck underneath, E to rest, Space to fly out; canopy collision and dry rain coverage.
- [x] Mild-weather E lands on leaf tops for rest; rain uses the underside. Stronger wind sway carries both perches while stems stay rooted.
- [x] One signaled shower with overcast, bounded rain, leaf patter and clearing sky. Rest advances the shower.
- [x] Water beads on petals and broad-leaf tops, accumulating cold with serious energy loss in exposed rain, warming under leaves, and blue edges closing to dark on exhaustion.
- [x] Stronger side warnings: a lightweight blue watercolor wash with irregular pigment edges/grain, advancing below 40% energy or with cold and receding on recovery; preserve the clear center and exhaustion fade.
- [x] A slim illustrated daylight strip across the top: a sun moving left to right and growing toward noon; a cloud appears only once rain starts, then falls behind the emerging sun as the shower clears. It stays visible under a leaf or in sheltered ground grass after the other UI fades.

- [x] Dense grass near the soil provides rain shelter and warming; ground landing, walking, E rest and Space takeoff.
- [x] Full pollen storage still allows loose pollen pickup and repeated pollination; use container art and totals without collection checkmarks.
- [x] Replace the carried-pollen text with colored knuckle patches visible in flight: newest type prominent, other transferable types as smaller flecks.
- [x] First energy tuning pass: roughly double dry flight expenditure while preserving low perching/rest costs and nectar recovery.
- [x] Fly the loaded harvest to the hive-facing meadow edge before the ending; compass/distance/marker guide the route, heavy wingbeats weave gently, and arrival triggers automatically.

- [x] Quiet rest view: safe perching fades the HUD after eight seconds; any key/click restores it without accidental action. The six-second restorative rest ends normally, with ordinary time and costs afterward. Rain exposure, chill and low energy restore the view.
- [x] Lingering meadow view: after twenty-two quiet seconds, rise above the bee and slowly orbit the waving meadow, with reused worker bees/buzz in sunshine. Any key/click returns to the moving perch; reduced motion uses a still view and brief dissolve. Elevated detail stays low.
- [x] Optional **Small wonders** info panel in the paused field guide: seven illustrated “In nature” / “In this game” comparisons with [text and citations in source](src/bee-facts.ts), verified sources, explicit species scope and room for future additions. A dedicated **Sun & shade** topic covers overheating, shade, nectar-fueled rest and the hot-sun indicator.
- [x] Compact pollination feedback: a tiny red poppy, white daisy or blue cornflower beside +1; remove the large heading, species text and repeated totals/explanation. Keep a full screen-reader announcement.
- [x] Start perched on a daisy with a centered, readable keyboard guide: spatial WASD/arrows, E, Space and F, and two lines about nectar and pollination. Reading costs no energy or daytime; dismiss onto the petal, then Space takes off. Simplify opening-screen copy.

- [x] More weather reaction time: retain early blue/orange warnings but delay steep energy drain until half exposure, leaving roughly 7–9 seconds after the first warning in full weather; keep ordinary flight costs and dangerous full exposure.
- [x] Heat and shade: a gradual hot spell (now placed randomly each day, most often midday); exposed flight, flower heads and leaf tops build heat and spend extra energy. E chooses the underside in hot weather, dense grass also cools, and shade removes the exposure drain immediately. Reuse the watercolor wash in orange, with current hot-sun art on the strip and a heat-specific exhaustion result; no extra meter. Pause, reduced motion, quiet-view wake and restart share the existing lifecycle.

- [x] Move the breeze cue beneath the sun as a directional arrow; vary calm spells, gusts and headings across the shared wind field, with extra flight effort in strong air and useful low-flight/drifting/perching tactics.
- [x] Raise pollen target and pouch capacity to 140, normalize cargo weight, retain walking collection speed and pollination with full storage.

- [x] Halve pollen and nectar harvest credit per visible resource, retaining lively depletion/contact, independent pollination and the existing energy recovery rate while encouraging more flower visits.
- [x] Shorten the Esc field guide to eight core controls, actual arrow-key symbols and four illustrated tips; put optional mouse/Ctrl/Shift controls behind an expandable section.

- [x] Add About bees to success/failure totals, returning from the journal to the same results; remove the unused Electric flowers topic.
- [x] Reuse two ending workers as hive visitors: landing, small figure-eights and waggling, with no added models or draw calls.
- [x] Move the wind arrow closer beneath the sun and add a small windsock that shows wind strength.
- [x] Hide the wind arrow/windsock for now; swaying vegetation remains the visual wind cue.

## Next playable slices

- [x] Replace flat green soil with a moss-dominant watercolor ground: earth washes, soft pebble shapes and tiny painted leaves, with distance filtering and no added geometry.
- [x] Add stronger coral watercolor washes to poppies, indigo-to-pale-tip washes to cornflowers, and broad feathered washes with darker veins on shelter leaves. Narrow the leaves and align collision and rain cover with their elliptical footprint.

- [ ] Reduce persistent on-screen text judiciously; favor existing graphics and show instructions when they are useful. Queen mood text, title-screen taglines, the misleading title-screen Esc prompt, decorative flower descriptions and the Way home button arrow have been removed. Keep the short collection instructions and weather warnings.
- [ ] Tune a day toward 8–12 minutes through routes, flower supplies and balanced objectives; preserve satisfying collection speed. No forced minimum duration.
- [ ] Tune rain/heat timing, exposure grace periods, recovery and dusk guidance through player feedback; verify fuel availability and shelter routes over longer outings.
- [x] Add a total flower counter: the meadow heading shows "x/72 flowers visited" under the mood label (Quiet, Waking, Happy, All three happy).
- [x] Vary the ending by how good the day was: four tiers (Fantastic, Good, Reasonable, Okay) from delivery (brimming / full / partial) × pollination (4+ of each kind / all three kinds / 3+ / fewer), each with a Queen line, a meadow line, a stats line and, on the lower tiers, one tip. `src/day-report.ts`.
- [x] Head home at any time: R (with 5 nectar for the flight) shows the marker; arriving at the edge ends the day with a partial delivery. The harvest goal is now what a good day looks like, not the gate home.
- [x] Percentages instead of raw amounts: jar and pouch on the HUD and results screen show % full (hive goal 45%). The flower panel shows small nectar/pollen bars on a shared scale (richest flower = full bar) so kinds compare at a glance; exact shares are in their labels for screen readers. Meadow points removed from the results screen.
- [ ] Tune the tier thresholds (85 nectar, 4 of each, 3 pollinated) through play, and see how often each tier comes up.
- [x] The lingering overhead meadow view reads as a rest: a curled sleeping bee with drifting z's and a small "Resting" caption in the lower left fades in and out with the camera, and also appears during the E rest (without moving the camera). Still under reduced motion.
- [x] The sleeping bee visibly breathes: its striped body swells gently while the folded wings lift a little, on a slow 3.6-second cycle (still under reduced motion).
- [x] Start each day at 60% energy (`START_ENERGY` in `src/garden.ts`), so sipping on the opening daisy is the first thing to learn. Legacy test scenarios keep a full meter.
- [x] Flower info: "Pollinated by you" shows the small colored bloom for that species (red poppy, white daisy, blue cornflower), the same art as the pollination +1 notice.
- [x] Spider webs (prototype, `src/webs.ts`): orb webs (now 28, see below), strung low in the grass away from the opening flower and the broad leaves (leaves stay the safe shelter). Faint silver threads in sun; dew beads in the morning and after rain. Flying or walking through one catches the bee: tap (or hold) Space or W to pull free, about 6 taps and a few energy points, harder with a heavy load and easier when nearly exhausted; a web never ends the day by itself. The web stays torn for the rest of the day. Off on `?test` pages unless `?webs` is added.
- [x] Webs easier to find: 28 per meadow, brighter threads visible from further away, clear water-drop beads (see-through with a bright rim and highlight) scattered irregularly along the threads, a few with morning dew and many after rain, and Bee Vision (Q) tints them pale violet and makes them somewhat brighter (still hidden behind grass and petals) (orb-web silk reflects ultraviolet; a game liberty in how strongly).
- [ ] Tune webs through play: count, heights, visibility in dry sun, escape cost. No spiders shown, only their webs (Lynn prefers not to see spiders). A Small wonders note on webs could stay text-only.
  - [x] Webs sway in the wind (done 2026-09-25, `webSway` in `src/webs.ts`; the first amount was invisible, raised 2026-09-26; tune in play). In the web line shader, billow each web along its normal, most in the middle and nothing at the anchor threads, driven by the shared wind (`windGLSL` in `wind.ts`, as the grass uses) with a per-web phase so they don't move in step. The dew beads (a separate instanced mesh) need the same offset so they stay on the threads. Catching keeps using the resting plane (sway is a few cm). Still under reduced motion.
  - It's okay for webs to catch the bee at ground level too, while walking in the grass (decided 2026-09-25). `checkWebs()` already runs for a walking bee, but web centers sit 0.72–1.47 above the ground, so a walker passes under most of them. Idea: string a few webs lower, between grass stems, where a walking bee can blunder into one.
- [ ] Meadow friends: small, harmless creatures found by flying low or walking in the grass (no spiders shown).
  - Ladybirds (first): about 12–20 per meadow, placed by the meadow seed. Mostly on low flower stems and broad leaves (tops and undersides), which the game already tracks as they sway; a few on the ground near stem bases, climbing up. Tiny (about half the bee), glossy red domes with black spots and a black head with white cheek dots; one or two instanced draws, updated only near the bee. They crawl slowly, pause and turn; now and then one opens its wing cases and flutters to a nearby stem; they hold still when the bee is very close.
  - Snails: come out after rain, crawl slowly over leaves and the ground, and leave a shiny trail (ties in with the wet leaves).
  - Ant trails: a line of tiny ants between a flower base and a small nest mound on the ground.
  - Discovery: the first close encounter with each kind shows one gentle note (e.g. "A ladybird! They keep the meadow's aphids in check."), then they are just there to enjoy.
  - A "meadow friends found" line on the results screen, and a Small wonders topic for each creature (sourced, as with `Flower_Facts.md`).
  - [x] Ladybirds are in (`src/friends.ts`, `tests/friends.spec.ts`): 18 per meadow on stems, leaves and the ground; crawl, pause, turn, rare flutter hop, shy when the bee is very close; first-meeting note; "Meadow friends" count on the results screen. Tune count, size and how easy they are to find through play.
  - [x] Aphids (step 1–2 of the meadow-health plan): about 14 clusters per meadow on stems, mostly cornflowers and poppies (dark black-bean aphids on poppies, green elsewhere). Ladybirds on those stems walk to the cluster and eat it down; untended clusters slowly regrow; flying ladybirds prefer aphid stems.
  - [ ] Meadow health step 3: a heavily infested flower offers a little less nectar (shown in the flower bars); ladybirds nearby bring it back.
  - [ ] Meadow health steps 4–5: ants tend aphid clusters (the ant trail leads to them) and crowd that flower so the bee can't sip while they're on it; across days, more cornflowers → more aphids → more ladybirds, and daisies keep ladybirds around when aphids are scarce.
  - [x] Fact-check `Meadow_Health.md` and add sources (as with `Flower_Facts.md`) before any of it goes into Small wonders. Known issues: ladybirds favour open flowers like daisies for pollen/nectar but "can only feed from flat platforms" is too strong; ants usually steal nectar from the front or through holes others made, rather than chewing holes (bumblebees and carpenter bees do that); "starving colonies attack landing bees" is speculative (ants do guard sugar sources, so a gentle version is a fair game liberty). Done 2026-09-25: see `Meadow_Fact_Check.md` (mostly true; ants chewing holes is not supported, ants are nectar thieves; ladybirds use shallow flowers because of their mouthparts; snails seal their shells and climb stems when dry).
  - Original implementation plan for ladybirds:
    - New `src/friends.ts`, built like `src/webs.ts`: `createFriends(scene, seed, flowers, leaves)`, rebuilt with the meadow in `Garden.rebuildMeadow()`, reset in `begin()`, disposed in `dispose()`.
    - Perches: flower stems use the same curve as the stem collision in `Garden.fly()` (`base` to `center`, eased by `stemU²`), so a ladybird at height u follows the swaying stem; keep u low (about 0.1–0.45). Leaves use each leaf's `center`/`rotation` with `leafSurfaceHeight()` (top) or just below it (underside). Ground ones use `meadowGroundHeight()` near a stem base and climb onto that stem.
    - Art: one `InstancedMesh` for the red domed shell (spots painted in `onBeforeCompile` from the local position, like the leaf washes) and one for the black head/legs; small wing-case pieces only for the rare flutter. Scale about 0.06–0.07 units. Hide beyond about 12 units and skip updates when the bee is far.
    - Motion: each has a position along its path (stem u or leaf-local x/z) and a slow speed; pause and turn at random; about one flutter hop to a nearby stem per minute across the meadow; freeze when the bee is within about 0.6. Still under reduced motion except for the crawl.
    - Discovery: first time the bee is within about 1.2 of one, `notify()` a single gentle line (sourced fact); count distinct ladybirds seen for the results line.
    - Test hooks and tests like the webs (`friends()` list, a pinned layout on `?test`), plus a screenshot check at ground level.
- [ ] Add creatures or objects to the undergrowth, found when flying low or walking in the grass.
  - Fallen bees: a few still bees lying in the grass, placed by the meadow seed. Approaching or landing next to one shows a short, gentle note, with a matching Small wonders topic for more. Keep the tone quiet and respectful, not grim.
  - In-game causes, each tied to a danger the player can avoid: caught in the rain (cold and soaked), too long in the hot sun, out of energy far from the hive, or still out when night fell. The note can point back to the game's own cue: blue edges, orange edges, the energy meter, the daylight strip.
  - Real-world causes, for the "In nature" side: pesticides, Varroa mites and the viruses they spread, disease, too few flowers (habitat loss), bad weather, predators, and simply old age. A summer forager lives only a few weeks, and many die out in the field with worn wings. Source these before they go in the game, as with `Flower_Facts.md`.
  - Could place a fallen bee near where the player's own day went wrong on the next day (ties into multi-day play).
  - Other life for variety: a beetle, a ladybird, a snail, an ant trail. Reuse the procedural art approach and keep draw calls low.
- [x] Heavy wind: one or two windy spells a day (`gales` in `src/weather.ts`) hold the gusts up and make them about a third stronger; stacked wavy lines beside the sun, a "Heavy wind" caption, and rising/easing messages. The meadow-edge current strengthens with them.
- [x] Randomize each day: 1–2 showers at random times, a hot spell most likely midday to mid-afternoon (`src/weather.ts`), wind fronts and direction offset per day, and a new flower layout after the first day. Test pages keep the fixed day and meadow; `?weather=N` and `?meadow=N` replay one.
- [x] Heavy wobble: from about 60% full, the bee wobbles side to side (two uneven rhythms), bobs with a slight sag, and surges a little, with quick strain beats (about 1.2 a second) that dip the camera, kick its roll and make the wing hum dip and swell, so it reads as effort, not wind. Full strength at a full load; Shift halves it; camera roll is off under reduced motion.
- [x] Glossy broad leaves: a soft sun glint broken up by the brush washes plus a pale sky sheen on the tops (strongest in bright sun, fading in cloud). In rain the leaves darken and turn shinier, drying over about half a minute; rain beads already sit on the tops. Close to or perched on a leaf top in rain, the patter gets louder with occasional drop pings (softer and lower from underneath).
- [x] Low-energy notices: as the blue edges begin (below 38 energy) a top message says to find nectar (mentioning stored nectar if there is some); below 18 a stronger "Almost out of energy" message. Once per dip, re-armed after refueling to 50; skipped while the cold/heat warnings cover it.
- [x] Remove repeated tips: when the small cue label says the same as the hint line below it (e.g. "E · LAND ON LEAF" over "E · Land on the broad leaf", or "SIPPING · RESTORING ENERGY" over "Sipping nectar · Restoring energy…"), only the hint shows. `redundantCue()` in `src/ui.ts` compares their words, with a few synonyms (tuck = shelter).
- [ ] Summers instead of days (decided 2026-09-25, see `Pollination_Impact.md`). Pollinated flowers set seed that grows into *next year's* meadow, so each round of play is one representative day of a summer, and the next round is the following summer. The daylight clock, sunset and "day" wording within a round stay as they are. Goal: the player's pollination should visibly shape the meadow, its flower mix and its friends.
  - Done (2026-09-25), the infrastructure: `planNextSummer()`, `nextCounts()` and `friendCounts()` in `src/meadow-plan.ts` (replacing `speciesMixAfter()`); `createMeadow` plants a planned layout; a finished round (won or lost) grows the next meadow, a restart keeps it; aphid clusters and ladybird numbers follow the flowers; "SUMMER N" eyebrow, "Summer N ·" morning line plus a meadow-change sentence, "Next summer" button and tips, and a "Next summer: more …, fewer …" line on both results screens; the friends row reads "3 of 14 ladybirds (18 last summer)". Tests: `tests/summers.spec.ts`; `?test&summers` lets test pages change meadow, and `__BEE_TEST__.nextSummer(ids)` ends a summer with those flowers pollinated.
  - Still to do: draw the gaps (dry stalks where unpollinated annuals stood, kept in `meadowGaps`); tune the numbers in play; a nicer results preview (flower icons with arrows); snails and ants; the run of about five summers with a summary.
  - Wording: results eyebrow "DAY N · ONE SMALL BEE" → "SUMMER N · ONE SMALL BEE"; the morning line "Day N · …" → "Summer N · …" (`morningLine()` in `src/day-report.ts`); `dayNumber` → `summerNumber` in `garden.ts`/`types.ts`/`ui.ts`; the "Play another day" button → "Next summer" after a finished round ("Try the day again" stays for a lost or restarted one). Update `tests/day-report.spec.ts` (expects `Day 2 · `), README and the Small wonders text if it mentions days.
  - Flower counts per species, with big swings (replaces `speciesMixAfter()`'s blended proportions and its pull back toward normal; the mix changes on its own because each species has its own count):
    - Poppies and cornflowers (annuals): next summer = normal × (0.3 + 0.2 × pollinated that summer), capped near 1.8×. None pollinated → about a third; 4 → normal; 8 → nearly double.
    - A small seed bank as a way back, not a cushion: each species keeps at least 3 flowers; after two bad summers in a row that minimum drops to 2, then 1.
    - Oxeye daisies (perennials, from roots): slow, about ±10–15% a summer. The meadow's steady part.
    - The six hand-placed opening flowers stay.
  - Make the change visible in the meadow, not only in numbers:
    - Keep the meadow layout from summer to summer. New annuals sprout near the flowers that were pollinated (seed falls close by), so poppies spread where the player worked.
    - Unpollinated annuals leave gaps: bare patches, maybe a dry stalk.
    - The morning line points at it: "Poppies have spread along the brook, where you worked last summer." / "The cornflowers are sparse this year."
    - Results screen: a small next-summer preview, the three flower icons with up or down arrows.
    - A thin meadow is patchier, so flights are longer and energy matters more.
  - Friends feel it, through a chain the player can follow:
    - Aphids live on poppy and cornflower stems: fewer of those flowers → fewer aphid clusters.
    - Ladybirds follow the aphids, with daisies as their backup food: fewer aphids and daisies → fewer ladybirds next summer. The results "Meadow friends" row compares with last summer ("9 ladybirds (14 last summer)").
    - Snails (not built yet): a patchy, dry meadow → snails tucked into their shells, visibly asleep; a lush one → snails out and about.
    - Ants (not built yet): in a thin meadow they crowd the few flowers and drain them first, so the player sees who emptied a flower (the "overwork spiral" from `Pollination_Impact.md`). No ants attacking the bee, to keep the tone gentle.
    - The loop back to the player: few ladybirds → aphids spread → aphid-covered flowers give less nectar (meadow-health step 3), so a careless summer makes the next one harder to forage in.
  - Recovery: a bad summer should be fixable in one or two good ones, so the pressure stays gentle.
  - The hive feels it through words, not a meter (held decision: no queen/hive meter). A run of about five summers ends with a short summary.
  - Fact-check `Pollination_Impact.md` with sources too. Known: cornflowers and corn poppies are annuals and largely self-incompatible (they need insect visits to set seed); oxeye daisies are perennials, not annuals; the seed bank is real (the game shrinks it on purpose); leave out the crab spiders and mantises (no spiders shown; mantises aren't typical of these meadows). Done 2026-09-25: see `Meadow_Fact_Check.md` (all key claims hold; poppy seed disperses about 1.1 m on average, which the game's spread matches; poppies have a longer-lived seed bank than cornflowers).
  - After the fact-checks (this doc and `Meadow_Health.md`), add a Small wonders topic on meadow impact (`src/bee-facts.ts`), "In nature" vs "In this game": annuals need pollinators to set seed (poppies, cornflowers) while daisies come back from roots; the seed bank; aphids on stems and ladybirds that eat them (daisies as their backup food); and the game's simplifications (one day stands for a summer, the numbers are stylized). With a drawing, and no spiders.
- [ ] Multi-day play (now summers, see above). Done: rounds are counted, the next meadow grows from what was pollinated, and the Queen's morning line echoes the last tier. Still to do: a short run (maybe 5 summers) ending with a summary, and possibly a save between sessions. Open question: are poppies valuable enough to seek out?
  - Poppy notes: corn poppies (*Papaver rhoeas*) give essentially no nectar (about 0.6 µg sugar a day) but lead meadow flowers for pollen, more than twice the next species per flower in the Edinburgh meadow study (PLOS One, 2016). Bees collect it eagerly; the loads are dark grey to black. Red looks dark to bees, but the petals reflect ultraviolet, so they stand out in Bee Vision. Each flower lasts briefly and most pollen goes in the morning.
  - Game ideas: a bigger pollen payoff per poppy visit, and pollen richest in the morning, so time of day matters.
- [x] Rebalance flower nectar and pollen to match nature (see `Flower_Facts.md`): per visit, daisy 13 nectar / 14 pollen, cornflower 28 / 10, poppy 0 / 21. Meadow totals barely change, so goals stay the same.
- [x] Add flower facts from `Flower_Facts.md` to Small wonders: an eighth topic, **Three meadow flowers**, with a drawing, the daisy florets note and the game's simplifications. On-screen flower details could still borrow from it.

- [ ] Teach Ctrl (descend) better (noted 2026-09-25). Dropping low matters more now: grass shelter from rain and heat, ladybirds and aphids low on stems, walking in the grass (and webs there). Today Ctrl appears only as "Descend" in the controls list (`src/ui.ts`), and the README calls it an optional shortcut ("Look down and use W"). Go through the help tips, the learning page, contextual hints (e.g. when rain or heat starts: "Ctrl drops you into the grass"), Small wonders (`src/bee-facts.ts`, whose key highlighting doesn't include Ctrl) and the README, and make the value of dropping low clear without adding much text.

- [x] Butterflies (2026-09-26, `src/butterflies.ts`, see the end of `Meadow_Health.md`): a meadow friend that only wants nectar. They flutter between daisies and cornflowers (never poppies), sit a while sipping (a little of that flower's nectar goes: gentle competition), bask with wings opening now and then, and lift off when the bee comes close or lands on their flower. Four kinds by colour (common blue, meadow brown, small tortoiseshell, small white). Numbers follow the daisies and cornflowers (`friendCounts`: 8 in a normal meadow), so a poppy-heavy meadow loses them; the summer start page and results count them. The overhead views now show 36 bees (was 48) and 8 larger-than-life butterflies. Tests: `tests/butterflies.spec.ts`.
  - Done 2026-09-26: painted wing atlas (upper sides and undersides per kind, watercolour style), legs and antennae, feet on the real petal surface; brown female common blues; a structural sheen on the male blue's upper side; in rain they shelter under the broad leaves or in the grass (wings closed) and bask when it clears; under heavy cloud they sit longer.
  - Still to do: tune sip rate and numbers in play; a Bee Vision UV pattern (whites); fact-check the butterfly section of `Meadow_Health.md` ("leaving it totally dry" is probably overstated; the game drains only a little); a line in the meadow Small wonders topic.

- [ ] Refine the flower heads (tops) for more structure and more difference between the three kinds (noted 2026-09-26). Ideas: daisy: a domed yellow disc of tiny florets with a flatter ring of white rays, a few rays turned or overlapping; poppy: four crumpled, cupped petals (two larger outer, two inner) with dark basal blotches, the seed-pod crown and a ring of dark stamens; cornflower: ragged, funnel-shaped outer florets with toothed tips around a tuft of smaller purple-blue inner ones, and scaly green bracts beneath. Also vary size, tilt and age (buds, fresh, going over) so no two look alike. Heads are built in `flowerHead()` in `src/world.ts` (mid/far LOD versions too); keep landing surfaces (`surfaceHeight` in `src/wind.ts`) and pollen placement in step.
  - Structure should drive how nectar and pollen are reached, not only looks:
    - Cornflower: the big blue outer florets are sterile, for show only (no nectar, no pollen). Nectar sits at the bottom of the narrow tubes of the small inner florets, deeper than a daisy's. Game: sip only at the centre tuft, a little slower per second but richer overall; landing on the outer florets offers nothing ("only for show"). The main point (Lynn, 2026-09-26): cornflower nectar must be harder to get at than a daisy's.
    - Daisy: hundreds of tiny, shallow disc florets in the yellow centre: nectar is easy to reach anywhere on the disc but each sip is small; pollen dusts off as the bee walks over it. The white rays are for landing only.
    - Poppy: no nectar; loose pollen on the ring of dark stamens around the seed pod. Collect by walking the stamen ring (real bees tumble in it).
    - Match the head geometry to these zones (and `surfaceHeight`), show them in Bee Vision, and have the flower panel say where the reward is. Butterflies' long proboscis reaches cornflower nectar easily (see `Meadow_Health.md`), which fits.

- [ ] Snails (design ready 2026-09-26: `Snails_Design.md`, with sources and open questions). One kind, the banded snail (decided 2026-09-26); out crawling in rain, dew and at dusk with fading silvery trails; tucked into shells in dry, mild weather; sealed and climbed up stems in the hot spell; tentacles pull in when the bee is near; fewer and more often sealed in a thin meadow (summers); they eat dead plant matter only (fallen petals, last summer's dry stalks), never living leaves.

### Lower priority

- [ ] Tune flower landing distance further. The E cue now needs reach 1.85 past the petals and 2.8 above them (was 2.25 / 3.2); the difference felt small in play. Adjust `FLOWER_LANDING_REACH` / `FLOWER_LANDING_CLEARANCE` in `src/garden.ts`.

### Nice to have

- [ ] Show stored nectar turning into energy (idea, 2026-09-25). Reorder the sidebar cargo: pollen pouch on top, nectar jar in the middle, energy plate below, and when the bee sips from the jar (resting, or auto-feeding), a small stream pours from the jar onto the plate. Not realistic, just a visual tip that stored nectar is what refills energy. Keep it brief and quiet (respect reduced motion: a simple fill instead of the pour).

- [ ] Poppies lose pollen as the day passes, so they're richest in the morning (real poppy pollen is mostly taken early in the day).

## Decisions held steady

- One outing per day; no multiple delivery trips or additional queen/hive happiness meter.
- Pollinating all three flower types is a richer meadow outcome, not a mandatory return gate.
- Simple laptop controls; no extra modifier-key combinations.
- Original procedural art/audio; reuse the meadow and keep elevated detail low.
- iPhone/iPad support and lupine are deferred.
