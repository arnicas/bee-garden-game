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
- [ ] Vary the ending dialog text by how good the day was, based on the stats.
- [x] The lingering overhead meadow view reads as a rest: a curled sleeping bee with drifting z's and a small "Resting" caption in the lower left fades in and out with the camera, and also appears during the E rest (without moving the camera). Still under reduced motion.
- [x] The sleeping bee visibly breathes: its striped body swells gently while the folded wings lift a little, on a slow 3.6-second cycle (still under reduced motion).
- [x] Start each day at 60% energy (`START_ENERGY` in `src/garden.ts`), so sipping on the opening daisy is the first thing to learn. Legacy test scenarios keep a full meter.
- [x] Flower info: "Pollinated by you" shows the small colored bloom for that species (red poppy, white daisy, blue cornflower), the same art as the pollination +1 notice.
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
- [ ] Allow playing multiple days in a row, with each day's flower distribution shaped by what was pollinated the day before. The hook is in place: `speciesMixAfter()` in `src/meadow-plan.ts` receives the previous day's pollination and currently returns an even mix. Open question: are poppies valuable enough to seek out?
  - Poppy notes: corn poppies (*Papaver rhoeas*) give essentially no nectar (about 0.6 µg sugar a day) but lead meadow flowers for pollen, more than twice the next species per flower in the Edinburgh meadow study (PLOS One, 2016). Bees collect it eagerly; the loads are dark grey to black. Red looks dark to bees, but the petals reflect ultraviolet, so they stand out in Bee Vision. Each flower lasts briefly and most pollen goes in the morning.
  - Game ideas: a bigger pollen payoff per poppy visit, and pollen richest in the morning, so time of day matters.
- [x] Rebalance flower nectar and pollen to match nature (see `Flower_Facts.md`): per visit, daisy 13 nectar / 14 pollen, cornflower 28 / 10, poppy 0 / 21. Meadow totals barely change, so goals stay the same.
- [x] Add flower facts from `Flower_Facts.md` to Small wonders: an eighth topic, **Three meadow flowers**, with a drawing, the daisy florets note and the game's simplifications. On-screen flower details could still borrow from it.

### Lower priority

- [ ] Tune flower landing distance further. The E cue now needs reach 1.85 past the petals and 2.8 above them (was 2.25 / 3.2); the difference felt small in play. Adjust `FLOWER_LANDING_REACH` / `FLOWER_LANDING_CLEARANCE` in `src/garden.ts`.

### Nice to have

- [ ] Poppies lose pollen as the day passes, so they're richest in the morning (real poppy pollen is mostly taken early in the day).

## Decisions held steady

- One outing per day; no multiple delivery trips or additional queen/hive happiness meter.
- Pollinating all three flower types is a richer meadow outcome, not a mandatory return gate.
- Simple laptop controls; no extra modifier-key combinations.
- Original procedural art/audio; reuse the meadow and keep elevated detail low.
- iPhone/iPad support and lupine are deferred.
