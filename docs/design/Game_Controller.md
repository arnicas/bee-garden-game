# Playing Bee Garden with a game controller

A plan for playing with an Xbox, PlayStation or Switch Pro controller, or similar, in the
browser: flying, looking, landing, sipping, the menus and the on-screen prompts. Drafted
2026-10-04. Nothing is built yet. The decisions for Lynn are listed first.

## Decisions for Lynn

1. **Which controllers to test with.** The browser sees most controllers the same way (the
   "standard" layout below). Still, the button names and shapes differ, and each kind should
   be tried once. Which ones are at hand: Xbox, PlayStation (DualShock or DualSense), Switch
   Pro, a Steam Deck?
2. **The button scheme.** Two sensible layouts are below. **A: "A lands"** puts the most
   common action (land, shelter, rest) on the main button. **B: "Triggers fly"** puts rising
   and sinking on the triggers, like many flying games. Proposed: A, to be playtested.
3. **Rumble.** A soft pulse when a raindrop hits, when caught in a web, or on pollination.
   It's gentle and true to the moment, but some players dislike it. Proposed: on, with a
   switch in the field guide.
4. **Saying so.** Once it works, the title screen and README could say "Play with a keyboard
   or a controller".

## How the browser sees a controller

- **The Gamepad API** (`navigator.getGamepads()`) is read once per frame: the sticks as
  numbers from −1 to 1, the triggers from 0 to 1, and the buttons as pressed or not.
- **One shared layout.** Chrome, Edge, Firefox and Safari map common controllers onto one
  **"standard" layout**, so one mapping covers them all:

  | Index | Xbox | PlayStation | Switch Pro | Use |
  | --- | --- | --- | --- | --- |
  | buttons 0, 1, 2, 3 | A, B, X, Y | ✕, ○, □, △ | B, A, Y, X | face buttons, by position (bottom, right, left, top) |
  | 4, 5 | LB, RB | L1, R1 | L, R | bumpers |
  | 6, 7 | LT, RT | L2, R2 | ZL, ZR | triggers (analog) |
  | 8, 9 | View, Menu | Create, Options | −, + | |
  | 10, 11 | stick clicks | L3, R3 | | |
  | 12 to 15 | d-pad up, down, left, right | | | |
  | axes 0, 1 / 2, 3 | left stick / right stick | | | |

- **Positions, not letters.** The mapping goes by position, so "the bottom face button" is
  Xbox **A**, PlayStation **✕** and Switch **B**. The on-screen prompts must show the right
  one for the controller in hand (see below).
- **A press wakes it up.** A controller only appears after the player presses one of its
  buttons while the page is open (a privacy rule). The title screen should say so: "Press any
  button on your controller".
- **HTTPS is needed,** which GitHub Pages and the local preview already provide.

## The proposed buttons (layout A, "A lands")

| Action | Keyboard today | Controller | Notes |
| --- | --- | --- | --- |
| Fly or walk | W A S D | **Left stick** | Analog: a light tilt is a slow drift, which is better than keys for landing on a swaying flower |
| Look | Arrow keys, mouse | **Right stick** | With a gentle response curve; invert-Y option |
| Land, shelter, rest | E | **A** (bottom) | The E cue shows the button instead |
| Take off, rise | Space | **B** (right), held to keep rising | Also cancels a landing, as Space does |
| Go down into the grass | Ctrl | **LB** (left bumper), held | |
| Sip nectar or water | F, left mouse | **RT** (right trigger), held | A light press sips; it's the most-held action, so it gets a trigger |
| Steady against the wind | Shift | **LT** (left trigger) | |
| Bee Vision | Q | **Y** (top) | |
| Head home early | R | **D-pad up** | Out of the way, so it's never pressed by accident |
| Photo | P | **D-pad down** | |
| Pause, field guide, facts | Esc | **Menu / Options / +** | |
| Pull free of a web | tap Space or W | **tap B**, or wiggle the left stick | |
| Wake the quiet view | any key | any button or stick | |

**Layout B, "Triggers fly"** would differ in a few places:

- RT rises and LT sinks, both analog;
- A both sips (held) and lands, depending on the moment;
- B takes off;
- RB steadies.

It feels more like a flying game, but the sip and land overlap needs care. Worth a quick
playtest of both, side by side.

## What changes in the code

### One input layer

Today `garden.ts` reads keys directly: `this.keys.has('KeyW')` in about 30 places, plus key
events for the one-press actions (E, Q, R, P, M, Esc). The plan:

- **A new `src/input.ts`** gathers the keyboard, mouse and controller into one **input state**
  each frame:
  - `move` (x and y, −1 to 1), `look` (x and y), `rise`, `sink` and `sip` (0 to 1), and
    `steady`;
  - the one-press actions (`land`, `vision`, `home`, `photo`, `pause`, `takeoff`) as events.
- **The keyboard feeds it** ±1 values, so nothing changes for keyboard players. The test
  suite should pass unchanged after this step.
- **`garden.ts` reads the input state** instead of keys. This is the bulk of the work, but
  it's mechanical.

### Analog flight and look

- **Dead zones:** sticks rest slightly off centre, so values under about 0.15 count as zero.
  The rest is rescaled so a small tilt still moves gently.
- **Response curve:** the look speed follows the square of the stick (fine aim near the
  centre, a fast turn at full tilt), up to about twice today's arrow-key speed.
- **Flight:** `fly()` and `crawl()` take the left stick's amount as well as its direction. A
  half tilt flies at about half speed.
- **The idle and quiet view** count stick movement past the dead zone as activity, as they do
  key presses.

### Prompts that show the right button

Keys appear on screen in many places:

- the E cue and the hints ("E · Land on daisy");
- the learning page and field guide;
- Small wonders;
- the loss tips;
- the energy notes ("Ctrl drops you into the grass").

The plan:

- **Every prompt names an action,** not a key (`{land}`, `{sip}`, `{vision}`).
- **One function, `buttonLabel(action)`,** draws it for the device last used:
  - a key cap (as now);
  - an Xbox letter;
  - a PlayStation shape;
  - a Switch letter.
- **Which kind of controller:** read from the controller's name (`gamepad.id` contains
  "Xbox", Sony's id 054c, Nintendo's 057e), with Xbox-style as the default.
- **Prompts switch as the player switches.** Touch the keyboard and they're keys again.
- **Glyphs:** small SVGs in the same watercolour key-cap style, for example a round cap with
  "A" in Xbox green, or a cross for PlayStation.

**This is the same work as the French plan's AZERTY labels** (`docs/design/French_Version.md`):
one `buttonLabel(action)` serves AZERTY key caps, controller buttons and translated text. Doing
the two together saves doing it twice.

### Menus with a controller

The menus are HTML: the title screen, learning page, pause and field guide, Bee and Meadow
Facts, results, the night and the lore switch. They need:

- **Moving between buttons** with the d-pad or left stick: focus goes to the nearest button in
  that direction, with a clearly visible focus ring. The keyboard focus styles are already a
  good start.
- **A** presses the focused button and **B** goes back (like Esc).
- **Menu** opens and closes the pause page, as Esc does.
- In **Bee and Meadow Facts**, the right stick scrolls the page and LB/RB turn to the
  previous or next topic.
- On the title screen, **A** on "Take flight". On the night screen, **A** skips, as Space does.

### Rumble

Where supported (`gamepad.vibrationActuator`, in Chrome and Edge), short and soft pulses:

- a raindrop strike;
- caught in a web, then pulled free;
- pollination, as a tiny double tap;
- knocked down by rain.

It's off when "Reduce motion" is on, and there's a switch in the field guide.

### Small things

- **Controller unplugged or asleep mid-flight:** pause the game, as losing window focus does.
- **Two controllers:** the last one used drives.
- **Sip as a toggle:** an option to press once to sip and again to stop, instead of holding.
  This helps players who find holding tiring, on a controller or a keyboard.
- **Options** in the field guide: look speed, invert Y, rumble, sip hold or toggle. They're
  remembered in the browser, like the lore switch.
- **Steam Deck:** in desktop mode the browser sees its controls as a standard controller, and
  its 1280 × 800 screen suits the game.

## Tests

Playwright can't plug in a real controller, but a test can stand in for one:

- **A script added before the page loads** (`addInitScript`) replaces
  `navigator.getGamepads()` with a fake controller whose sticks and buttons the test sets.
- **The tests:**
  - flying forward with the left stick, and a half tilt flying at about half speed;
  - looking with the right stick, and invert Y;
  - landing with A, sipping with RT and rising with B;
  - the E cue showing the A button after a controller press, and keys again after a key
    press;
  - moving through the pause menu with the d-pad and pressing A;
  - pausing when the controller disconnects.
- **Small tests** check the dead zone and response curve on their own.
- **The existing keyboard tests stay as they are.** They check that the input layer changed
  nothing.

## Order of work

1. **The input layer,** keyboard and mouse only, with no visible change and the full suite
   passing.
2. **Controller reading and the mapping:** analog flight and look, dead zones, the one-press
   actions.
3. **Prompts by action,** with key caps and controller glyphs. Do this together with the
   French plan's AZERTY labels.
4. **Menu navigation** with d-pad, A and B.
5. **Options:** look speed, invert Y, sip toggle, rumble.
6. **Rumble.**
7. **Playtest** with the controllers at hand, in Chrome, Safari and Firefox, and settle layout
   A or B.

Steps 1 and 3 are the chore, and both pay off beyond controllers: one place for input, and one
place that names buttons for every keyboard, controller and language.
