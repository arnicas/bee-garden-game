# Playing Bee Garden on phones and tablets

A plan for touch controls: two on-screen sticks for moving and looking (Lynn's idea), and a way
to handle the ten or so keys without covering the meadow in buttons. It also covers what else
a phone needs: speed, screen layout and the browser's quirks. Drafted 2026-10-04. Nothing is
built yet. Today a phone or tablet gets the "This game isn't yet supported on mobile devices"
note (`onMobile()` in `src/ui.ts`). The decisions for Lynn are listed first.

## Decisions for Lynn

1. **Tablets first** (decided, Lynn, 2026-10-04). An iPad or Android tablet has room for two
   thumbs, the panels and the meadow, and a stronger graphics chip. Phones come later, once
   speed is measured on one (step 2 below); a phone in landscape is about 390 points tall, so
   its panels must shrink a lot, and the meadow may need a lighter look.
2. **Look: a second stick, or drag anywhere on the right?** A fixed right stick is what
   you suggested and is easy to learn. Many mobile 3D games instead let the right thumb drag
   anywhere on the right half to look, which aims more precisely and leaves the view clearer.
   Proposed: drag-to-look on the right, with a fixed right stick as an option. Worth trying
   both.
3. **Tilt to look** (the phone's gyroscope)? A nice extra for gentle aiming; on iPhone it needs
   a permission prompt. Proposed: later, as an option.
4. **Which devices to try.** At least one iPhone or iPad in Safari and one Android phone in
   Chrome, over the local network from the dev server.

## The idea: few buttons, and the right one at the right moment

The keyboard has many keys, but most are needed only now and then, and the game already knows
when. The E cue appears only when there's something to land on or shelter under, and F only
matters when nectar or water is in reach. So on touch:

| What | Keyboard | Touch |
| --- | --- | --- |
| Fly or walk | W A S D | **Left stick** (floating: it appears where the left thumb touches, anywhere on the left side) |
| Look | Arrows, mouse | **Right side drag**, or a fixed right stick (decision 2) |
| Land, shelter, rest, take off | E, Space | **One action button** by the right thumb. Its icon and label change with the moment ("Land", "Shelter", "Rest", "Fly"), just as the E cue does now |
| Sip nectar or water | F | **Sip button**, held. It appears beside the action button only while there's something to sip, glowing gold for nectar and blue for water |
| Rise / go down | Space, Ctrl | **Two small arrows** (up and down) stacked by the right thumb, held. Flying forward while looking up also rises, as W does now |
| Steady against the wind | Shift | **Not needed**: letting go of the left stick steadies |
| Bee Vision, head home, photo, sound, pause | Q, R, P, M, Esc | **The top bar's round buttons**, which already exist, made larger for fingers. "Head home" joins them |
| Pull free of a web | tap Space or W | **Tap the action button** (it shows "Pull free") |
| Wake the quiet view | any key | any touch |

So the screen holds:

- **always:** the move stick, the look area, the action button and the up and down arrows;
- **only when it matters:** a sip button.

Everything else stays in the top bar, where it is now.

```
 ┌────────────────────────────────────────────────────────────────┐
 │ Bee Garden   ··· sun ···               ◎ 📷 🔊 ⌂ ❚❚            │  top bar (bigger buttons)
 │ panel                                                  energy  │
 │                                                        nectar  │
 │                         the meadow                     pollen  │
 │                                                                │
 │                                                    ▲           │
 │     ( move )                          look area   [ Land ]     │
 │                                            (sip)   ▼           │
 └────────────────────────────────────────────────────────────────┘
```

### The sticks

- **Move stick:** a soft watercolour ring, about 120 px across, that appears under the left
  thumb wherever it lands on the left 40% of the screen, and fades when lifted.
  - It's analog: a light push drifts and a full push flies, like a controller's stick.
  - A small dead zone at the centre.
- **Look:**
  - **Drag:** the right thumb's movement turns the view, like the mouse does now, with a
    sensitivity setting. Lifting stops the turn.
  - **Fixed stick:** holding it off-centre keeps turning, like the arrow keys, faster the
    further out.
- **Multi-touch:** each thumb is tracked separately (Pointer Events, by pointer id), so moving
  and looking work together.

## What it shares with the controller plan

The controller plan (`docs/design/Game_Controller.md`) proposes one input layer,
`src/input.ts`. It gathers every device into one state each frame: `move`, `look`, `rise`,
`sink` and `sip` as analog values, plus the one-press actions. **Touch is one more source for
the same layer:**

- the sticks give analog `move` and `look`, like a controller's;
- the buttons give the actions.

Likewise, **prompts that name actions**, not keys, let the hints read "Tap **Land**" with the
button's icon instead of "E · Land on daisy". It's one `buttonLabel(action)` for key caps,
AZERTY, controller glyphs and touch icons. So the order matters: the input layer and action
prompts first, then controller and touch are both mostly mapping and art.

## What else a phone needs

### Speed (measure first)

Bee Garden draws a lot: dense grass, swaying flowers, shaders for the painted ground and
petals, weather effects. Phones vary hugely.

- **Measure on a real device first.** The game already records frame times (`frameMs` in the
  diagnostics). Load the meadow on a mid-range phone and see.
- **Settings for weaker devices:**
  - a lower render scale (the pixel ratio is capped at 1.5 now; 1 or 0.75 on phones);
  - fewer grass blades;
  - lighter effects (rain splash, wind streaks);
  - a shorter view distance in fog.

  Choose one automatically from the first seconds' frame times, with a choice in the field
  guide.
- **Heat and battery:** cap at 30 frames a second on phones if needed, and pause when the
  page is hidden (it already pauses on losing focus).

### Screen layout

- **Landscape only,** with a "Turn your phone sideways" card in portrait.
- **The HUD is sized for a laptop.** A phone needs:
  - a compact panel at top left (flower name and bars only);
  - smaller cargo meters at right;
  - shorter notes;
  - the hint line moved up, clear of the thumbs.

  A tablet mostly fits as is.
- **Safe areas:** the page already asks for `viewport-fit=cover`. Keep the HUD and buttons
  inside the notch and home-bar insets (`env(safe-area-inset-*)`).
- **No hover on touch.** The meter tooltips ("Your little meal…") and the `title` hints on
  buttons appear on hover today. They need a tap instead, or the text belongs elsewhere.
- **Finger sizes:** every button at least 44 points, with space between.
- **Menus and pages** (title, field guide, facts, results) are HTML and already work with
  taps. Check their sizes and scrolling on a phone.

### Browser quirks

- **No pointer lock** on touch, and none is needed.
- **Fullscreen:** Android and iPad can go fullscreen from a tap. iPhone Safari can't, but
  "Add to Home Screen" with a web-app manifest opens without the browser bars, so add a
  manifest.
- **Stop the page from moving:** no pinch-zoom, pull-to-refresh or double-tap zoom while
  playing. The canvas already has `touch-action: none`; the stick and button layer needs it
  too.
- **Sound** starts on the first tap, which the game already does from "Take flight".
- **Vibration:** Android Chrome has `navigator.vibrate`, which could give the same soft
  pulses as the controller rumble. iPhone Safari doesn't support it.

## Tests

- **Playwright can play a phone:** a device profile (for example an iPhone or Pixel in
  landscape) with touch turned on.
  - Taps work directly.
  - Drags and two-thumb moves can be sent as touch events (through the browser's DevTools
    protocol).
- **The tests:**
  - the move stick appears under a thumb and flies the bee;
  - dragging on the right turns the view, while the left stick moves at the same time;
  - the action button changes with the moment and lands on a flower;
  - the sip button appears only near nectar, and sips while held;
  - portrait shows the turn-sideways card;
  - nothing on the phone HUD overlaps or overflows.
- **On real devices:** `npm run dev -- --host` serves the game on the local network for a
  phone to open. Safari's Web Inspector (from a Mac) and Chrome's remote debugging show the
  console and frame times.

## Order of work

1. **The input layer** (shared with the controller plan), with no visible change.
2. **Measure speed** on a mid-range phone and a tablet; add the lighter settings and the
   automatic choice. This decides how far to go with phones (decision 1).
3. **Touch layer:** move stick, look drag (or stick), action button, up and down, sip
   button, with multi-touch.
4. **Prompts by action** (shared with the controller and French plans), so hints show the
   touch buttons.
5. **Layout:** tablet check, then the compact phone HUD, safe areas, the turn-sideways card
   and tap-for-tooltips.
6. **Polish:** manifest for home-screen play, vibration on Android, options (look
   sensitivity, fixed look stick, sip hold or toggle).
7. **Open the game to tablets:** the mobile note stays for phones only ("Best on a tablet or
   computer"); playtest on real tablets. Phones follow as a later round (compact HUD, lighter
   settings).

With the controller and French plans, steps 1 and 4 are shared work: one input layer, and one
way of naming the controls for every keyboard, controller, screen and language.
