/**
 * Touch controls for tablets (docs/design/Mobile_Controls.md). A layer under the HUD, shown
 * only while flying or perched:
 *
 * - **Move stick** (left side): a soft ring appears where the left thumb lands and follows it
 *   like a controller stick. Analog: a light push drifts, a full push flies.
 * - **Look** (right side): drag to turn the view, as the mouse does.
 * - **Action button** by the right thumb: its label follows the moment (Land, Shelter, Rest,
 *   Wake, Pull free, Cancel); a tap is the key it stands for (E, or Space).
 * - **Up and down** arrows, held: Space and Ctrl. Up reads "Fly" when perched, and takes off.
 * - **Sip**, held, only when there's nectar or water in reach (F).
 *
 * Everything else (pause, Bee Vision, sound, photo, the way home) is already a button in the
 * HUD. The game reads the stick through `stick` and the buttons arrive as key presses, so the
 * rules in garden.ts stay the same for every kind of input.
 */
export interface TouchHost {
  /** A button pressed or let go, as the key it stands for. */
  key(code: string, down: boolean): void;
  /** The view turned by a drag, in pixels. */
  look(dx: number, dy: number): void;
}
export interface TouchAction { label: string; code: string; }
export interface TouchView {
  visible: boolean;
  action: TouchAction | null;
  /** The up button's label: "Fly" when perched, otherwise an arrow. */
  perched: boolean;
  sip: 'nectar' | 'water' | 'share' | null;
}

/** Tablets and phones, an iPad (which reports a Mac), or ?touch on any device. */
export function touchDevice(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.has('touch')) return true;
  if (params.has('test')) return false;
  return navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);
}

const STICK_REACH = 58, DEAD_ZONE = .12;

export function createTouchControls(host: TouchHost) {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.hidden = true;
  root.innerHTML = `
    <div class="touch-zone touch-move-zone" data-touch="move"></div>
    <div class="touch-zone touch-look-zone" data-touch="look"></div>
    <div class="touch-stick" aria-hidden="true"><div class="touch-knob"></div></div>
    <div class="touch-hint touch-move-hint" aria-hidden="true">Touch here to move</div>
    <div class="touch-hint touch-look-hint" aria-hidden="true">Drag here to look</div>
    <button class="touch-button touch-sip" data-touch="sip" hidden><span>Sip</span></button>
    <button class="touch-button touch-action" data-touch="action" hidden><span>Land</span></button>
    <button class="touch-button touch-up" data-touch="up" aria-label="Rise"><span>▲</span></button>
    <button class="touch-button touch-down" data-touch="down" aria-label="Go down"><span>▼</span></button>`;
  // Under the HUD, so its buttons and pages stay on top.
  const ui = document.getElementById('ui');
  if (ui) ui.before(root); else document.body.append(root);
  // The game is played sideways: a card asks for that in portrait.
  const sideways = document.createElement('div');
  sideways.className = 'turn-sideways';
  sideways.innerHTML = '<div><div class="turn-sideways-icon" aria-hidden="true">⤾</div><p>Turn your tablet sideways to play</p></div>';
  document.body.append(sideways);
  document.documentElement.classList.add('touch-device');
  // No zooming the page by pinching or double-tapping: iPad Safari mostly ignores the viewport's
  // "no zoom" for accessibility, so pinches are stopped here and double taps by touch-action
  // (manipulation on everything, none on the controls; styles.css).
  const noZoom = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', noZoom, { passive: false });
  document.addEventListener('gesturechange', noZoom, { passive: false });
  document.addEventListener('dblclick', noZoom, { passive: false });

  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const stickRing = q('.touch-stick'), knob = q('.touch-knob');
  const actionButton = q<HTMLButtonElement>('.touch-action'), sipButton = q<HTMLButtonElement>('.touch-sip'), upButton = q<HTMLButtonElement>('.touch-up');

  /** The move stick, -1..1: x to the right, y forward. */
  const stick = { x: 0, y: 0 };
  let movePointer: number | null = null, lookPointer: number | null = null, used = false;
  const center = { x: 0, y: 0 }, lastLook = { x: 0, y: 0 };
  let action: TouchAction | null = null;
  const held = new Map<number, string>();

  const showStick = (on: boolean) => { stickRing.classList.toggle('is-on', on); };
  const moveStick = (x: number, y: number) => {
    let dx = (x - center.x) / STICK_REACH, dy = (y - center.y) / STICK_REACH;
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    knob.style.transform = `translate(${dx * STICK_REACH}px, ${dy * STICK_REACH}px)`;
    const strength = Math.min(1, length), live = strength < DEAD_ZONE ? 0 : (strength - DEAD_ZONE) / (1 - DEAD_ZONE);
    const scale = length > 0 ? live / Math.min(1, length) : 0;
    stick.x = dx * scale; stick.y = -dy * scale;
  };
  const firstUse = () => { if (!used) { used = true; root.classList.add('is-used'); } };

  root.addEventListener('pointerdown', e => {
    const target = e.target as HTMLElement, kind = target.closest<HTMLElement>('[data-touch]')?.dataset.touch;
    if (!kind) return;
    e.preventDefault();
    (target.closest('[data-touch]') as HTMLElement).setPointerCapture?.(e.pointerId);
    if (kind === 'move' && movePointer === null) {
      firstUse();
      movePointer = e.pointerId; center.x = e.clientX; center.y = e.clientY;
      stickRing.style.left = `${e.clientX}px`; stickRing.style.top = `${e.clientY}px`;
      moveStick(e.clientX, e.clientY); showStick(true);
    } else if (kind === 'look' && lookPointer === null) {
      firstUse();
      lookPointer = e.pointerId; lastLook.x = e.clientX; lastLook.y = e.clientY;
    } else if (kind === 'up' || kind === 'down' || kind === 'sip') {
      const code = kind === 'up' ? 'Space' : kind === 'down' ? 'ControlLeft' : 'KeyF';
      held.set(e.pointerId, code); host.key(code, true);
      (target.closest('button') as HTMLElement).classList.add('is-pressed');
    } else if (kind === 'action' && action) {
      // A tap: pressed and let go at once, like a key.
      host.key(action.code, true); host.key(action.code, false);
      actionButton.classList.add('is-pressed');
      setTimeout(() => actionButton.classList.remove('is-pressed'), 140);
    }
  });
  root.addEventListener('pointermove', e => {
    if (e.pointerId === movePointer) { e.preventDefault(); moveStick(e.clientX, e.clientY); }
    else if (e.pointerId === lookPointer) {
      e.preventDefault();
      host.look(e.clientX - lastLook.x, e.clientY - lastLook.y);
      lastLook.x = e.clientX; lastLook.y = e.clientY;
    }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === movePointer) { movePointer = null; stick.x = 0; stick.y = 0; knob.style.transform = ''; showStick(false); }
    if (e.pointerId === lookPointer) lookPointer = null;
    const code = held.get(e.pointerId);
    if (code) {
      held.delete(e.pointerId); host.key(code, false);
      root.querySelectorAll('.touch-button.is-pressed').forEach(b => { if (b !== actionButton) b.classList.remove('is-pressed'); });
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('lostpointercapture', end);
  // No page zoom, text selection or callouts while playing.
  root.addEventListener('contextmenu', e => e.preventDefault());

  /** Lets go of everything (when the layer hides, or the game pauses). */
  const release = () => {
    for (const code of held.values()) host.key(code, false);
    held.clear(); movePointer = null; lookPointer = null; stick.x = 0; stick.y = 0;
    knob.style.transform = ''; showStick(false);
    root.querySelectorAll('.is-pressed').forEach(b => b.classList.remove('is-pressed'));
  };

  let last = '';
  return {
    stick: stick as Readonly<typeof stick>,
    /** Any thumb on the controls (keeps the quiet view away, like a held key). */
    get active() { return movePointer !== null || lookPointer !== null || held.size > 0; },
    update(view: TouchView): void {
      const key = `${view.visible}|${view.action?.label}|${view.action?.code}|${view.perched}|${view.sip}`;
      action = view.action;
      if (key === last) return;
      last = key;
      if (!view.visible && !root.hidden) release();
      root.hidden = !view.visible;
      document.documentElement.classList.toggle('touch-playing', view.visible);
      actionButton.hidden = !view.action;
      if (view.action) actionButton.querySelector('span')!.textContent = view.action.label;
      upButton.querySelector('span')!.textContent = view.perched ? 'Fly' : '▲';
      upButton.classList.toggle('is-fly', view.perched);
      upButton.setAttribute('aria-label', view.perched ? 'Fly' : 'Rise');
      sipButton.hidden = !view.sip;
      sipButton.dataset.kind = view.sip ?? '';
      sipButton.querySelector('span')!.textContent = view.sip === 'water' ? 'Sip water' : view.sip === 'share' ? 'Share' : 'Sip';
    },
    release,
    dispose(): void {
      document.removeEventListener('gesturestart', noZoom); document.removeEventListener('gesturechange', noZoom); document.removeEventListener('dblclick', noZoom);
      release(); root.remove(); sideways.remove(); document.documentElement.classList.remove('touch-playing', 'touch-device'); },
  };
}

/**
 * The swap table: on a tablet, the keys named in hints, notes and pages become little pictures
 * of the touch buttons that do the same thing. The text carries them as ⟦kind|label⟧ tokens
 * (touchWords), drawn as chips by touchChip / touchHtml (and keyText in ui.ts).
 *
 * | Key | On a tablet |
 * | --- | --- |
 * | E (in flight: land, shelter, revisit) | the big action button: Land / Shelter |
 * | E (perched: rest, wake, tuck under) | the sidebar's Rest button |
 * | Space | ▲ (reads Fly when perched); during a landing, the action button's Cancel |
 * | Ctrl | ▼ |
 * | F, left mouse | Sip (gold), or Sip water (blue) where the line is about water |
 * | W A S D | the move stick |
 * | Arrow keys | drag on the right |
 * | Space or W in a web | Pull free |
 * | Q | the eye button · R: Way home |
 */
export type TouchChipKind = 'land' | 'rest' | 'up' | 'down' | 'sip' | 'water' | 'stick' | 'eye' | 'home';
const T = (kind: TouchChipKind, label: string) => `⟦${kind}|${label}⟧`;
const WATERY = /water|pool|wet petals|drops on the petals|cool/i;
/** One line of game text with its keys swapped for touch buttons (as ⟦kind|label⟧ tokens). */
export function touchWords(text: string): string {
  if (!text) return text;
  if (text === 'Arrow keys look · W flies where you look · Space rises') return `Drag on the right to look · ${T('stick', 'Stick')} flies where you look · ${T('up', '▲')} rises`;
  // Sip or water, decided per part of the line (the parts between ·).
  const sip = (part: string, hold: string) => `${hold}${T(WATERY.test(part) ? 'water' : 'sip', WATERY.test(part) ? 'Sip water' : 'Sip')}`;
  const parts = text.split(/( · )/).map(part => part
    .replace(/\b(Hold|hold) F( or left mouse)?/g, (_, hold: string) => sip(part, `${hold} `))
    .replace(/\b(Keep|keep) F held/g, (_, keep: string) => `${keep} ${sip(part, '')} held`)
    .replace(/\bF sips/g, () => `${sip(part, '')} sips`));
  return parts.join('')
    .replace(/Keys that save a bee:/, 'Buttons that save a bee:')
    // The cues by the aim mark (ui.ts), in capitals: the button itself says what it does.
    .replace(/^E {2}· {2}/, '').replace(/^WASD {2}· {2}/, '').replace(/^HOLD F TO SIP$/, `HOLD ${T('sip', 'Sip')}`)
    .replace(/\bE · Land on/g, `${T('land', 'Land')} on`)
    .replace(/\bE · Tuck beneath/g, `${T('land', 'Shelter')} beneath`)
    .replace(/, then press E to land\./g, `, then tap ${T('land', 'Land')}.`)
    .replace(/, then press E\b/g, `, then tap ${T('land', 'Land')}`)
    .replace(/Press E to land or shelter; press E again once settled to rest/g, `Tap ${T('land', 'Land')} to land or shelter; once settled, tap ${T('rest', 'Rest')} to rest`)
    .replace(/\bE to revisit/g, `${T('land', 'Land')} to revisit`)
    .replace(/\bE near a broad leaf/g, `${T('land', 'Shelter')} near a broad leaf`)
    .replace(/Press E once settled to rest/g, `Once settled, tap ${T('rest', 'Rest')} to rest`)
    .replace(/the R \(Return Home\) control appears as “Way home” in the UI\. Press R for guidance/g, `the ${T('home', 'Way home')} button at the top wakes up. Tap it for guidance`)
    .replace(/\bE tucks you under a leaf/g, `${T('land', 'Shelter')} tucks you under a leaf`)
    .replace(/\bE tucks (beneath|into shade)/g, (_, where: string) => `${T('rest', 'Shelter beneath')} tucks ${where}`)
    .replace(/\b(rest|Rest) with E\b/g, (_, rest: string) => `${rest} with ${T('rest', 'Rest')}`)
    .replace(/, F for nectar/g, `, hold ${T('sip', 'Sip')} for nectar`)
    .replace(/ · Space$/, '')
    .replace(/\bE to (tuck underneath|tuck into shade)/g, (_, what: string) => `${T('rest', 'Shelter beneath')} to ${what}`)
    .replace(/\bE(,| to) (rest|wake)\b/g, (_, joint: string, what: string) => `${T('rest', 'Rest')}${joint === ',' ? ',' : ' to'} ${what}`)
    .replace(/Tap Space or W to pull free/g, `Tap ${T('land', 'Pull free')}`)
    .replace(/Hold Space to rise/g, `Hold ${T('up', '▲')} to rise`)
    .replace(/Space to cancel/g, `${T('land', 'Cancel')} to stop`)
    .replace(/Space to (rise|climb)/g, (_, what: string) => `${T('up', '▲')} to ${what}`)
    .replace(/(?:or )?Space (?:to )?(fly when ready|fly out|fly|take off|drop down into the grass)/g, (all: string, what: string) => `${all.startsWith('or ') ? 'or ' : ''}${T('up', 'Fly')} to ${what}`)
    .replace(/\(Ctrl\)/g, `(${T('down', '▼')})`)
    .replace(/\b(Hold|hold) Ctrl/g, (_, hold: string) => `${hold} ${T('down', '▼')}`)
    .replace(/\bCtrl drops/g, `${T('down', '▼')} drops`)
    .replace(/\bCtrl down/g, `${T('down', '▼')} down`)
    .replace(/\bPress Ctrl to drop/g, `Hold ${T('down', '▼')} to drop`)
    .replace(/Crawl with WASD/g, `Crawl with the ${T('stick', 'Stick')}`)
    .replace(/WASD to walk/g, `the ${T('stick', 'Stick')} walks`)
    .replace(/\bWASD\b/g, T('stick', 'Stick'))
    .replace(/Release Shift to drift/g, 'Let go of the stick to drift')
    .replace(/\(Q\)/g, `(${T('eye', 'Bee Vision')})`)
    .replace(/\bQ makes/g, `${T('eye', 'Bee Vision')} makes`)
    .replace(/press R to head home/g, `tap ${T('home', 'Way home')} to head home`)
    .replace(/\(R heads home from anywhere\.\)/g, `(${T('home', 'Way home')} at the top heads home from anywhere.)`);
}
/** A token's chip, as HTML. */
export function touchChip(kind: string, label: string): string {
  const art = kind === 'stick' ? '<span class="chip-ring" aria-hidden="true"></span>' : kind === 'eye' ? '<span class="chip-eye" aria-hidden="true">◉</span>' : kind === 'home' ? '<span aria-hidden="true">⌂</span>' : kind === 'rest' ? '<span class="chip-leaf" aria-hidden="true">❧</span>' : '';
  const shown = kind === 'eye' ? '' : label;
  return `<span class="touch-chip touch-chip-${kind}" role="img" aria-label="${label} button">${art}${shown ? `<span>${shown}</span>` : ''}</span>`;
}
const TOKEN = /⟦([a-z]+)\|([^⟧]+)⟧/g;
/** Text (or markup) with its tokens drawn as chips. */
export function touchHtml(markup: string): string { return markup.replace(TOKEN, (_, kind: string, label: string) => touchChip(kind, label)); }
/** Splits text with tokens into plain strings and chips, for building DOM nodes. */
export function touchParts(text: string): ({ text: string } | { kind: string; label: string })[] {
  const out: ({ text: string } | { kind: string; label: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if ((m.index ?? 0) > last) out.push({ text: text.slice(last, m.index) });
    out.push({ kind: m[1], label: m[2] });
    last = (m.index ?? 0) + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
