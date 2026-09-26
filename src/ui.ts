import type { GameUI, UIActions, ViewState } from './types';
import { dayReport, nextSummerLine } from './day-report';
import { cargoArt, energyWedge } from './cargo-art';
import { coveragePetals, happyMeadowArt, pollinationFlowers } from './meadow-art';
import { beeFacts, beeFactsMarkup } from './bee-facts';
import { dayArt } from './day-art';

const icons = {
  bee: '<svg viewBox="0 0 56 40" fill="none" aria-hidden="true"><path d="M23 20C5 23 6 3 17 5c7 1 9 10 11 16M32 20C50 23 49 3 38 5c-7 1-9 10-11 16" stroke="currentColor" stroke-width="1.3"/><ellipse cx="28" cy="26" rx="10" ry="8" fill="currentColor"/><path d="M24 19v14m7-14v14" stroke="var(--paper)" stroke-width="2.6"/><path d="m19 24-6-1m25 1 5-1M24 17l-3-4m10 4 3-4m-8 21 2 3 2-3" stroke="currentColor" stroke-width="1.3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 5-5 4H4v6h3l5 4V5Zm4 4c2 1.5 2 4.5 0 6m3-9c4 3 4 9 0 12" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 5-5 4H4v6h3l5 4V5Zm4 4 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6v12m8-12v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
  hive: '<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M7 21h14c3 0 3-4 0-4 3 0 3-4-1-4 2-1 1-4-2-4 1-4-9-4-8 0-3 0-4 3-2 4-4 0-4 4-1 4-3 0-3 4 0 4Zm0-4h14M8 13h12M10 9h8" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 21v-3a2 2 0 0 1 4 0v3" fill="currentColor"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8h12c5 0 5-6 1-6m-11 10h14c4 0 4 6 0 6M3 16h7c3 0 3 5 0 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  nectar: '<svg viewBox="0 0 20 24" fill="none" aria-hidden="true"><path d="M10 3C8 8 4 11 4 15a6 6 0 0 0 12 0c0-4-4-7-6-12Z" stroke="currentColor" stroke-width="1.2"/><path d="M7 14c-1 3 1 4 2 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  pollen: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="9" r="3" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="9" r="3" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="16" r="3" stroke="currentColor" stroke-width="1.2"/></svg>',
  energy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 4C7 3 2 12 8 17s12-1 11-13ZM6 21 16 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flower: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 9c-8-12-15 0-7 7-12 8 0 15 7 7 8 12 15 0 7-7 12-8 0-15-7-7Z" stroke="currentColor" stroke-width="1.3"/><path d="m11 16 3 3 7-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const key = (label: string) => `<kbd>${label}</kbd>`;
const learningKey = (label: string, code: string) => `<kbd data-learn-key="${code}">${label}</kbd>`;
const keyboardCluster = (arrows = false) => `<div class="learning-keys" aria-label="${arrows ? 'Arrow keys' : 'W A S D keys'}">
  ${learningKey(arrows ? '↑' : 'W', arrows ? 'ArrowUp' : 'KeyW')}
  ${learningKey(arrows ? '←' : 'A', arrows ? 'ArrowLeft' : 'KeyA')}
  ${learningKey(arrows ? '↓' : 'S', arrows ? 'ArrowDown' : 'KeyS')}
  ${learningKey(arrows ? '→' : 'D', arrows ? 'ArrowRight' : 'KeyD')}
</div>`;
// The result illustrations coexist with the live HUD. Give every paint server
// and fill hook its own identity so hidden HUD artwork cannot capture a clone.
// The Queen on the results screen: the usual bee with a little gold crown
// between her antennae (the viewBox grows upward to make room).
const queenBee = icons.bee
  .replace('viewBox="0 0 56 40"', 'viewBox="4 -6 48 46"')
  .replace('</svg>', '<path d="M21.6 17 20.8 8.6l4 3.4L28 5.6l3.2 6.4 4-3.4-.8 8.4Z" fill="#efc24a" stroke="#8d5d17" stroke-width="1.1" stroke-linejoin="round"/><circle cx="28" cy="5" r="1.4" fill="#efc24a" stroke="#8d5d17" stroke-width=".8"/><circle cx="20.8" cy="8.2" r="1" fill="#efc24a" stroke="#8d5d17" stroke-width=".7"/><circle cx="35.2" cy="8.2" r="1" fill="#efc24a" stroke="#8d5d17" stroke-width=".7"/></svg>');
const resultArt = (source: string, prefix: string) => {
  let artwork = source;
  for (const [, id] of source.matchAll(/\bid="([^"]+)"/g)) {
    artwork = artwork.replaceAll(`id="${id}"`, `id="${prefix}-${id}"`)
      .replaceAll(`url(#${id})`, `url(#${prefix}-${id})`)
      .replaceAll(`href="#${id}"`, `href="#${prefix}-${id}"`);
  }
  return artwork.replaceAll('data-fill=', 'data-result-fill=')
    .replaceAll('data-honey-surface', 'data-result-honey-surface')
    .replaceAll('class="reserve-mark"', 'class="result-reserve-mark"');
};
/** Whole percent of a container, never over 100. */
const share = (value: number, max: number) => Math.floor(Math.max(0, Math.min(1, value / max)) * 100 + 1e-6);
const ladybirdArt = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="10.5" r="5" fill="#2e2824"/><ellipse cx="20" cy="23" rx="12" ry="13" fill="#c9482f"/><path d="M20 10.5v25.5" stroke="#2e2824" stroke-width="1.5"/><circle cx="14" cy="19.5" r="2.4" fill="#2e2824"/><circle cx="26" cy="19.5" r="2.4" fill="#2e2824"/><circle cx="15" cy="28.5" r="2" fill="#2e2824"/><circle cx="25" cy="28.5" r="2" fill="#2e2824"/></svg>`;
const aphidArt = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6v28" stroke="#7d8f55" stroke-width="3" stroke-linecap="round"/><g fill="#8fb35a"><ellipse cx="15" cy="13" rx="3.2" ry="4.4"/><ellipse cx="25" cy="17" rx="3" ry="4.2"/><ellipse cx="15.5" cy="22.5" rx="3.3" ry="4.5"/><ellipse cx="24.5" cy="27" rx="2.8" ry="3.9"/></g></svg>`;
const butterflyArt = `<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#86a3e2" stroke="#5f77ae" stroke-width=".8"><path d="M19 19C15 9 6 6 5 12s5 9 14 8z"/><path d="M21 19c4-10 13-13 14-7s-5 9-14 8z"/><path d="M19 21c-7 1-11 5-9 9s7 1 9-7z"/><path d="M21 21c7 1 11 5 9 9s-7 1-9-7z"/></g><path d="M20 13v16" stroke="#35302b" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const snailArt = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 31c4 1 22 1 31-1 1-1 0-3-2-3-2 0-3-2-2-4l2-9" fill="none" stroke="#8a7b6b" stroke-width="2.4" stroke-linecap="round"/><circle cx="34" cy="13" r="1.4" fill="#4a3f36"/><circle cx="31" cy="14" r="1.2" fill="#4a3f36"/><circle cx="17" cy="21" r="10" fill="#e9d98c" stroke="#8a6a3c" stroke-width="1.2"/><path d="M17 21m-6.5 0a6.5 6.5 0 1 1 6.5 6.5a4 4 0 1 1 -1-8" fill="none" stroke="#6b4a2a" stroke-width="1.6"/></svg>`;
const summerKinds = [['poppy', 'Poppies'], ['daisy', 'Daisies'], ['cornflower', 'Cornflowers']] as const;
const flowerTypes = [ ['poppy', 'Poppy'], ['daisy', 'Daisy'], ['cornflower', 'Cornflower'] ] as const;
const controls = [
  [key('W A S D'), 'Fly & walk<small>W follows your view</small>'],
  [`<span class="guide-arrows" role="img" aria-label="Arrow keys: up, down, left and right">${key('↑')}${key('↓')}${key('←')}${key('→')}</span>`, 'Look around'],
  [key('Space'), 'Rise / take off'],
  [key('Ctrl'), 'Descend'],
  [key('E'), 'Land / shelter / rest'],
  [key('F / left mouse'), 'Hold to sip nectar'],
  [key('Q'), 'Bee vision'],
  [key('R'), 'Find the way home'],
  [key('M'), 'Sound on / off'],
];

/** Words that don't change what a cue says, for comparing it with the hint. */
const CUE_FILLER = new Set(['a', 'an', 'the', 'on', 'in', 'into', 'under', 'beneath', 'underneath', 'to', 'of', 'by', 'gently']);
/** Different words for the same action. */
const CUE_SYNONYMS: Record<string, string> = { tuck: 'shelter', tucking: 'shelter', sheltered: 'shelter' };
/**
 * True when the small cue label only repeats the hint line below it (e.g.
 * "E · LAND ON LEAF" over "E · Land on the broad leaf"): every meaningful word
 * and key in the cue already appears in the hint, so the cue is left out.
 */
export function redundantCue(cue: string, hint: string): boolean {
  if (!cue.trim() || !hint.trim()) return false;
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).map(w => CUE_SYNONYMS[w] ?? w);
  const hintWords = words(hint);
  return words(cue).filter(w => !CUE_FILLER.has(w)).every(w => {
    const stem = w.length > 4 ? w.slice(0, 4) : w;
    return hintWords.some(h => h === w || stem.length >= 4 && h.startsWith(stem));
  });
}

export function createUI(actions: UIActions): GameUI {
  const root = document.querySelector<HTMLDivElement>('#ui')!;
  if (!root) throw new Error('Bee Garden requires a #ui element.');
  root.innerHTML = `
    <div class="scene-shade" aria-hidden="true"></div>
    <div class="pollen-dust" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${i % 2 === 0 ? 2 + ((i * 17) % 23) : 76 + ((i * 13) % 22)}%;--y:${7 + (i * 23) % 88}%;--size:${18 + (i * 7) % 38}px;--r:${i * 41}deg"></i>`).join('')}</div>
    <div class="vision-wash" aria-hidden="true"></div>
    <div class="scenic-veil" aria-hidden="true"></div>
    <div class="sleep-note" aria-hidden="true" hidden><svg class="sleep-bee" viewBox="0 0 72 48" fill="none" aria-hidden="true"><ellipse cx="36" cy="41" rx="24" ry="4" fill="#5b6b36" opacity=".18"/><g class="sleep-wings"><path d="M40 14c7-9 18-8 19-2 1 5-8 8-17 6" fill="#f6f3e6" stroke="#aaa487" stroke-width=".9" opacity=".92"/><path d="M36 16c4-10 13-13 16-9 2 4-5 9-14 11" fill="#fbf9f0" stroke="#aaa487" stroke-width=".9" opacity=".9"/></g><g class="sleep-body"><path d="M18 30a17 13 0 1 1 34 4c-3 6-12 8-20 6-6-1-11-4-14-10Z" fill="#e8b84e" stroke="#7a5a2c" stroke-width="1.1"/><path d="M30 18.5c3 6 3 14-1 20M39 18c3 7 3 15-2 21M47 21c2 6 1 11-3 16" stroke="#4d3b25" stroke-width="3.2" stroke-linecap="round" opacity=".85"/></g><circle cx="18" cy="31" r="8" fill="#4d3b25" stroke="#3a2c1b" stroke-width=".8"/><path d="M14.5 31q2.2 2 4.4 0" stroke="#f4e5b8" stroke-width="1.2" stroke-linecap="round"/><path d="M15 24c-3-5-8-5-9-2s3 4 4 1M19 23.5c0-5-4-8-7-7" stroke="#3a2c1b" stroke-width="1" stroke-linecap="round"/><path d="M22 38l-1 3M27 40l0 3M33 41l1 2" stroke="#3a2c1b" stroke-width="1" stroke-linecap="round"/></svg><span class="sleep-z sleep-z-1">z</span><span class="sleep-z sleep-z-2">z</span><span class="sleep-z sleep-z-3">z</span><span class="sleep-caption">Resting</span></div>
    <header class="game-heading play-only">
      <div class="little-brand">${icons.bee}<span>Bee Garden</span></div>
      <p class="objective" hidden><span class="shelter-guide" role="img" aria-label="A dry leaf nearby" hidden>${icons.energy}<span data-text="shelter-label">A dry leaf</span><span class="shelter-arrow" aria-hidden="true">↑</span><span data-text="shelter-distance"></span></span></p>
      <div class="pollination-summary" role="group" aria-label="Meadow happiness from pollination">
        <div class="meadow-heading"><span class="meadow-label" data-text="meadow-label">HAPPY MEADOW</span><span class="meadow-visits"><b data-text="visited-count">0</b>/<span data-text="flower-total">0</span> flowers visited</span></div>
        <div class="meadow-overview">${happyMeadowArt}<div class="meadow-counter"><div class="meadow-tally"><b data-text="pollination-count">0</b> <span data-text="pollination-count-label">flowers pollinated</span></div></div></div>
        <div class="meadow-coverage" role="group" aria-label="Flower types pollinated: 0 of 3">
          ${flowerTypes.map(([species, name]) => `<div class="species-petal" data-species="${species}" role="img" aria-label="${name}: 0 flowers pollinated"><span class="petal-tally">${coveragePetals[species]}<b data-text="coverage-${species}">0</b></span><span class="petal-name">${name}</span></div>`).join('')}
        </div>
      </div>
      <div class="flower-note" hidden>
        <span class="flower-number" data-text="flower-number">ON THE FLOWER</span><h2 data-text="flower-name"></h2>
        <div class="flower-resources"><span class="supply supply-nectar">${icons.nectar}<span class="supply-bar" data-supply="nectar" role="img" aria-label="Nectar here"><i></i></span><small>nectar</small></span><span class="supply supply-pollen">${icons.pollen}<span class="supply-bar" data-supply="pollen" role="img" aria-label="Pollen here"><i></i></span><small>pollen</small></span></div>
        <p class="flower-guidance" data-text="flower-guidance" hidden></p>
        <p class="flower-forage" data-text="flower-forage" hidden></p>
        <p class="flower-pollinated" hidden>${flowerTypes.map(([species]) => `<span class="flower-pollinated-mark" data-flower-pollinated="${species}" hidden>${pollinationFlowers[species]}</span>`).join('')}<span>Pollinated by you</span></p>
        <button class="flower-rest" data-action="rest" aria-label="Rest and pass time" aria-keyshortcuts="E" aria-pressed="false" title="Rest on this flower. Stored nectar restores energy while the day passes."><span class="rest-leaf" aria-hidden="true">${icons.energy}</span><span data-text="rest-label">Rest and pass time</span>${key('E')}</button>
      </div>
    </header>
    <div class="day-timeline weather-note play-only" role="img" aria-label="Morning. Fair skies." data-weather-stage="clear" data-rain-drops="0">
      ${dayArt}
      <div class="day-caption"><span class="day-label" id="day-label" data-text="day-label">MORNING</span><span class="day-weather" data-text="weather" hidden></span></div>
    </div>
    <div class="top-actions">
      <button class="icon-button vision-button play-only" data-action="uv" aria-label="Toggle bee vision" title="Bee vision · Q" aria-pressed="false">${icons.eye}<span>Q</span></button>
      <button class="icon-button" data-action="sound" aria-label="Mute sound" title="Mute sound · M" aria-pressed="false">${icons.sound}</button>
      <button class="icon-button play-only" data-action="pause" aria-label="Pause game" title="Pause · Esc">${icons.pause}</button>
    </div>
    <aside class="status-sidebar play-only" aria-label="Bee and hive status">
    <section class="home-note" aria-label="Hive status">
      <div class="home-heading"><span class="compass-arrow" aria-hidden="true">↑</span><span>THE HIVE</span>${icons.hive}</div>
      <div class="home-distance"><span data-text="home-distance">0</span><small>m to meadow edge</small></div>
      <p data-text="home-guidance">The hive lies beyond the meadow.</p>
      <div class="return-ready" hidden><span data-text="return-ready-label">YOUR HIVE IS CALLING</span><button data-action="return" class="small-button">Way home ${key('R')}</button></div>
    </section>
    <section class="cargo-bar" aria-label="Foraging progress">
      <div class="cargo-meter energy-meter" role="meter" tabindex="0" aria-label="Energy" aria-valuemin="0" aria-valuemax="100" aria-describedby="energy-detail">
        ${cargoArt.energy}
        <span class="feeding-status" data-text="feeding-status"></span>
        <div class="meter-caption"><span>Energy</span><b data-text="energy">100%</b></div>
        <div class="meter-detail" id="energy-detail" role="tooltip"><strong>Your little meal</strong><span data-text="energy-note">Your wings are rested</span><small>Full nectar storage feeds you automatically.</small></div>
      </div>
      <div class="cargo-meter nectar-meter" role="meter" tabindex="0" aria-label="Nectar stored" aria-valuemin="0" aria-describedby="nectar-detail">
        ${cargoArt.nectar}
        <div class="meter-caption"><span>Nectar</span><b data-text="nectar">0%</b></div>
        <div class="meter-detail" id="nectar-detail" role="tooltip"><strong>A little sweetness</strong><span><span data-text="nectar-goal"></span> <span data-text="home-fuel"></span></span><small>The green mark shows how much you need to bring home.</small></div>
      </div>
      <div class="cargo-meter pollen-meter" role="meter" tabindex="0" aria-label="Pollen collected" aria-valuemin="0" aria-describedby="pollen-detail">
        ${cargoArt.pollen}
        <div class="meter-caption"><span>Pollen</span><b data-text="pollen">0%</b></div>
        <div class="meter-detail" id="pollen-detail" role="tooltip"><strong>A pouch of sunshine</strong><span data-text="pollen-note">Gather as you crawl</span><small>Even with a full pouch, pollen on your legs can help more flowers.</small></div>
      </div>
    </section>
    </aside>
    <div class="home-marker" hidden aria-hidden="true"><span>${icons.hive}</span><b>WAY HOME</b><small>Fly to the meadow edge</small></div>
    <div class="target-marker" hidden aria-hidden="true"><kbd>E</kbd></div>
    <div class="aim play-only" aria-hidden="true"><i></i><span></span></div>
    <div class="center-note play-only"><span class="interaction-label" data-text="interaction"></span><p data-text="hint"></p></div>
    <div class="message-toast" role="status" aria-live="polite" hidden><span class="toast-mark">✳</span><span data-text="message"></span></div>
    <div class="pollination-toast" role="status" aria-live="polite" aria-atomic="true" hidden>
      ${flowerTypes.map(([species]) => `<span class="pollination-bloom" data-pollinated-species="${species}" hidden>${pollinationFlowers[species]}</span>`).join('')}
      <span class="pollination-plus" aria-hidden="true">+1</span>
      <span class="pollination-announcement" data-text="pollination-announcement"></span>
    </div>
    <div class="lower-right play-only"><span class="vision-label" hidden>THE WORLD THROUGH BEE EYES</span><span><kbd>Q</kbd> bee vision <i>·</i> <kbd>Esc</kbd> field guide</span></div>
    <section class="title-screen" aria-labelledby="game-title">
      <div class="title-bee">${icons.bee}</div>
      <h1 id="game-title">Bee<br><em>Garden</em><span class="title-star">✳</span></h1>
      <p class="title-subtitle">A summer in a day —<br>Feed the hive and the meadow, and shape the next summer day.</p>
      <button class="primary-button start-button" data-action="start"><span>Take flight</span><span class="button-arrow">${icons.arrow}</span></button>
    </section>
    <div class="title-footer"><span>A MEADOW STUDY <i>—</i> No. 01</span></div>
    <section class="learning-overlay" hidden>
      <div class="learning-page" role="dialog" aria-modal="true" aria-labelledby="learning-title" aria-describedby="learning-goals">
        <div class="learning-flower">${pollinationFlowers.daisy}</div>
        <h2 id="learning-title" tabindex="-1">Your summer day begins on a flower.</h2>
        <section class="learning-summer" aria-label="How the meadow changed since last summer" hidden>
          <div class="summer-group"><h3>Flowers <span>last summer → this summer</span></h3>
            <div class="learning-summer-counts">${summerKinds.map(([species, name]) => `<div data-summer-kind="${species}"><span class="summer-art">${pollinationFlowers[species]}</span><span class="summer-name">${name}</span><span class="summer-change"><span data-text="summer-was-${species}"></span><span class="summer-arrow" aria-hidden="true">→</span><b data-text="summer-count-${species}"></b></span><span class="summer-delta" data-text="summer-delta-${species}"></span></div>`).join('')}</div>
            <p class="summer-lesson" data-text="summer-flowers-line"></p></div>
          <div class="summer-group"><h3>Meadow friends</h3>
            <div class="learning-summer-counts"><div data-summer-kind="aphid"><span class="summer-art">${aphidArt}</span><span class="summer-name">Aphid clusters</span><span class="summer-change"><span data-text="summer-was-aphid"></span><span class="summer-arrow" aria-hidden="true">→</span><b data-text="summer-count-aphid"></b></span><span class="summer-delta" data-text="summer-delta-aphid"></span></div><div data-summer-kind="ladybird"><span class="summer-art">${ladybirdArt}</span><span class="summer-name">Ladybirds</span><span class="summer-change"><span data-text="summer-was-ladybird"></span><span class="summer-arrow" aria-hidden="true">→</span><b data-text="summer-count-ladybird"></b></span><span class="summer-delta" data-text="summer-delta-ladybird"></span></div><div data-summer-kind="butterfly"><span class="summer-art">${butterflyArt}</span><span class="summer-name">Butterflies</span><span class="summer-change"><span data-text="summer-was-butterfly"></span><span class="summer-arrow" aria-hidden="true">→</span><b data-text="summer-count-butterfly"></b></span><span class="summer-delta" data-text="summer-delta-butterfly"></span></div><div data-summer-kind="snail"><span class="summer-art">${snailArt}</span><span class="summer-name">Snails</span><span class="summer-change"><span data-text="summer-was-snail"></span><span class="summer-arrow" aria-hidden="true">→</span><b data-text="summer-count-snail"></b></span><span class="summer-delta" data-text="summer-delta-snail"></span></div></div>
            <p class="summer-lesson" data-text="summer-friends-line"></p></div>
        </section>
        <p id="learning-goals">Fly between flowers, gathering nectar for energy and the hive.<br>Carry pollen to matching flowers and help the meadow bloom.</p>
        <ul class="learning-cycle" aria-label="How one summer shapes the next">
          <li><span class="learning-cycle-art" aria-hidden="true">${pollinationFlowers.poppy}</span>Flowers you pollinate set seed and spread next summer.</li>
          <li><span class="learning-cycle-art" aria-hidden="true">${ladybirdArt}</span>Aphids, ladybirds and butterflies follow the flowers.</li>
          <li><span class="learning-cycle-art" aria-hidden="true">${butterflyArt}</span>Skipped flowers thin out, and meadow life with them.</li>
        </ul>
        <details class="learning-controls" open>
          <summary>Keyboard controls</summary>
        <div class="learning-movement">
          <div>${keyboardCluster()}<strong>Fly & walk</strong><p>W goes where you look</p></div>
          <div>${keyboardCluster(true)}<strong>Look around</strong><p>Up, down & turn</p></div>
        </div>
        <div class="learning-actions">
          <div>${learningKey('E', 'KeyE')}<strong>Land & rest</strong></div>
          <div>${learningKey('Space', 'Space')}<strong>Take off & rise</strong></div>
          <div>${learningKey('Ctrl', 'ControlLeft')}<strong>Go down</strong></div>
          <div>${learningKey('F / left mouse', 'KeyF')}<strong>Hold to sip nectar</strong></div>
        </div>
        </details>
        <button class="primary-button learning-start" data-action="explore"><span>Explore the meadow</span>${icons.arrow}</button>
      </div>
    </section>
    <section class="modal-overlay" hidden aria-label="Game menu">
      <div class="journal-page pause-page" hidden>
        <div class="pause-heading"><div><h2>Rest your wings.</h2></div>
          <button class="primary-button" data-action="resume" aria-label="Back to the breeze"><span>Back to the breeze</span>${key('Esc')}</button>
        </div>
        <div class="guide-heading"><span>YOUR FIELD GUIDE</span><span>✳</span></div>
        <div class="controls-grid">${controls.map(([input, label]) => `<div>${input}<span>${label}</span></div>`).join('')}</div>
        <div class="guide-tips" aria-label="Meadow essentials">
          <div>${icons.pollen}<p><strong>Gather & pollinate</strong>Walk through pollen; visit matching flowers.</p></div>
          <div>${icons.nectar}<p><strong>Refuel</strong>Nectar restores energy. Rest uses your stored nectar.</p></div>
          <div>${icons.energy}<p><strong>Find shelter</strong>Rain or hot sun? Tuck under a leaf or into dense grass.</p></div>
          <div>${icons.hive}<p><strong>Bring it home</strong>With enough supplies, follow the hive marker to the edge.</p></div>
        </div>
        <details class="guide-extras"><summary>Mouse & extra controls</summary>
          <div><span>${key('Mouse / drag')} Look</span><span>${key('Shift')} Steady</span></div>
          <p>Click the meadow to capture the mouse for looking and sipping. Esc releases it.</p>
        </details>
        <div class="pause-footer">
          <button class="facts-invitation" data-action="facts-open" aria-haspopup="dialog" aria-expanded="false" aria-controls="bee-facts"><span><strong>Bee Facts</strong><small>Bee facts, weather & life in the meadow</small></span><span aria-hidden="true">↗</span></button>
          <button class="text-button" data-action="restart">Start the day again ${icons.arrow}</button>
        </div>
      </div>
      ${beeFactsMarkup()}
      <div class="journal-page result-page" hidden>
        <span class="eyebrow" data-text="result-eyebrow"></span><div class="result-bee">${icons.bee}</div><h2 data-text="result-title"></h2><div class="result-voice result-voice-queen"><span class="result-voice-art" aria-hidden="true">${queenBee}</span><p class="menu-intro" data-text="result-description"></p></div><div class="result-voice result-voice-meadow" hidden><span class="result-voice-art" aria-hidden="true">${resultArt(happyMeadowArt, 'result-voice')}</span><p class="menu-intro result-meadow" data-text="result-meadow"></p></div><p class="result-why" data-text="result-why"></p><p class="result-tip" data-text="result-tip" hidden></p><p class="result-next" data-text="result-next" hidden></p>
        <div class="result-harvest" role="group" aria-label="The day's harvest">
          <figure class="result-jar">${resultArt(cargoArt.nectar, 'result-nectar')}<figcaption><b data-text="result-nectar"></b><span data-text="result-nectar-label">Nectar brought home</span></figcaption></figure>
          <figure class="result-pouch">${resultArt(cargoArt.pollen, 'result-pollen')}<figcaption><b data-text="result-pollen"></b><span data-text="result-pollen-label">Pollen brought home</span></figcaption></figure>
        </div>
        <section class="result-pollination" aria-label="The flowers you helped">
          <div class="result-pollination-tally">${resultArt(happyMeadowArt, 'result-meadow')}<div><b data-text="result-pollinated"></b><span data-text="result-pollinated-label">flowers pollinated</span></div></div>
          <div class="result-coverage" role="group" aria-label="Flower types pollinated: 0 of 3">
            ${flowerTypes.map(([species, name]) => `<div class="result-species-petal" data-result-species="${species}" role="img" aria-label="${name}: 0 flowers pollinated"><span class="petal-tally">${coveragePetals[species]}<b data-text="result-coverage-${species}">0</b></span><span class="petal-name">${name}</span></div>`).join('')}
          </div>
        </section>
        <div class="result-facts"><dl class="result-stats"><div><dt>Flowers visited</dt><dd data-text="result-visited"></dd></div><div><dt>Meadow friends</dt><dd data-text="result-friends"></dd></div><div><dt>Time in the meadow</dt><dd data-text="result-time"></dd></div></dl></div>
        <div class="result-actions">
          <button class="primary-button" data-action="restart"><span data-text="restart-label">Next summer</span><span class="button-arrow">${icons.arrow}</span></button>
          <button class="result-info" data-action="result-facts-open" aria-haspopup="dialog" aria-expanded="false" aria-controls="bee-facts">About bees ${icons.arrow}</button>
        </div>
      </div>
    </section>
    <div class="ending-fade" aria-hidden="true"></div>
    <div class="loss-veil" aria-hidden="true"></div>
    <section class="return-transition" hidden aria-label="The day's journey home">
      <div class="ending-caption" role="status" aria-live="polite"><span class="ending-eyebrow" data-text="ending-eyebrow"></span><p data-text="ending-caption"></p></div>
      <button class="ending-skip" data-action="skip-return" aria-label="Skip to totals" title="Skip to totals · Space"><span data-text="closing-action">Skip to totals</span>${key('Space')}${icons.arrow}</button>
    </section>
  `;

  const el = <T extends Element = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const labels = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-text]')).map(item => [item.dataset.text!, item]));
  const text = (name: string, value: string) => {
    const label = labels.get(name)!;
    if (label.textContent !== value) label.textContent = value;
  };
  // Hints and interaction labels render key names as <kbd> chips; WASD becomes W/A/S/D.
  const keyPattern = /\b(Arrow keys|WASD|Space|Shift|Ctrl|Esc|Enter|[WEFQR])\b/g;
  const keyChip = (label: string, spoken?: string) => {
    const chip = document.createElement('kbd');
    chip.textContent = label;
    if (spoken) chip.setAttribute('aria-label', spoken);
    return chip;
  };
  const keyText = (name: string, value: string) => {
    const label = labels.get(name)!;
    if (label.dataset.source === value) return;
    label.dataset.source = value;
    const nodes: Node[] = [];
    let last = 0;
    for (const match of value.matchAll(keyPattern)) {
      const start = match.index ?? 0;
      if (start > last) nodes.push(document.createTextNode(value.slice(last, start)));
      const key = match[0];
      if (key === 'WASD') {
        ['W', 'A', 'S', 'D'].forEach((letter, index) => {
          if (index) { const slash = document.createElement('span'); slash.className = 'key-slash'; slash.textContent = '/'; nodes.push(slash); }
          nodes.push(keyChip(letter));
        });
      } else if (key === 'Arrow keys') nodes.push(keyChip('↑ ↓ ← →', 'Arrow keys'));
      else nodes.push(keyChip(key));
      last = start + key.length;
    }
    if (last < value.length) nodes.push(document.createTextNode(value.slice(last)));
    label.replaceChildren(...nodes);
  };
  const show = (element: HTMLElement, visible: boolean) => { if (element.hidden === visible) element.hidden = !visible; };
  const percent = (value: number, total = 100) => Math.min(1, Math.max(0, value / Math.max(1, total)));
  const attribute = (element: Element, name: string, value: string) => {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const fills = { energy: el<SVGPathElement>('[data-fill="energy"]'), nectar: el<SVGRectElement>('[data-fill="nectar"]'), pollen: el<SVGRectElement>('[data-fill="pollen"]') };
  const honeySurface = el<SVGPathElement>('[data-honey-surface]');
  const meters = { energy: el('.energy-meter'), nectar: el('.nectar-meter'), pollen: el('.pollen-meter') };
  const target = el('.target-marker');
  const flowerNote = el('.flower-note');
  const flowerResources = el('.flower-resources');
  const nectarBar = el('[data-supply="nectar"]'), pollenBar = el('[data-supply="pollen"]');
  const supplyBar = (bar: HTMLElement, fraction: number, label: string) => {
    const f = Math.max(0, Math.min(1, fraction || 0));
    bar.style.setProperty('--supply', f.toFixed(3));
    bar.classList.toggle('is-empty', f < .005);
    if (bar.getAttribute('aria-label') !== label) bar.setAttribute('aria-label', label);
  };
  const flowerGuidance = el('.flower-guidance');
  const flowerForage = el('.flower-forage');
  const restButton = el<HTMLButtonElement>('[data-action="rest"]');
  const daySun = el<SVGGElement>('[data-day-sun]');
  const dayGlow = el<SVGCircleElement>('[data-day-glow]');
  const dayHeat = el<SVGGElement>('[data-day-heat]');
  const dayPigment = el<SVGStopElement>('[data-day-pigment]');
  const dayTrail = el<SVGPathElement>('[data-day-trail]');
  const dayCloud = el<SVGGElement>('[data-day-cloud]');
  const dayRain = el<SVGGElement>('[data-day-rain]');
  const dayGale = el<SVGGElement>('[data-day-gale]');
  const dayWeather = el('.day-weather');
  const weatherNote = el('.weather-note');
  const objective = el('.objective');
  const shelterGuide = el('.shelter-guide');
  const shelterArrow = el('.shelter-arrow');
  const homeReady = el('.return-ready');
  const homeMarker = el('.home-marker');
  const modal = el('.modal-overlay');
  const learningOverlay = el('.learning-overlay');
  const learningTitle = el('#learning-title');
  const learningSummer = el('.learning-summer');
  const learningControls = el<HTMLDetailsElement>('.learning-controls');
  const learningGoals = el('#learning-goals');
  const learningCycle = el('.learning-cycle');
  let controlsFoldedFor = -1;
  const learningButton = el<HTMLButtonElement>('[data-action="explore"]');
  const learningKeys = Array.from(root.querySelectorAll<HTMLElement>('[data-learn-key]'));
  const learningHeldKeys = new Set<string>();
  const pausePage = el('.pause-page');
  const factsPage = el('.bee-facts-page');
  const factsTitle = el('#bee-facts-title');
  const factsOpenButton = el<HTMLButtonElement>('[data-action="facts-open"]');
  const resultFactsButton = el<HTMLButtonElement>('[data-action="result-facts-open"]');
  const factTabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-fact-index]'));
  const factPanels = Array.from(root.querySelectorAll<HTMLElement>('.fact-page'));
  const factsReader = el('.facts-reader');
  const resultPage = el('.result-page');
  const transition = el('.return-transition');
  const endingFade = el('.ending-fade');
  const lossVeil = el('.loss-veil');
  const scenicVeil = el('.scenic-veil');
  const sleepNote = el('.sleep-note');
  const closingButton = el<HTMLButtonElement>('[data-action="skip-return"]');
  const resultNectarFill = el<SVGRectElement>('[data-result-fill="nectar"]');
  const resultHoneySurface = el<SVGPathElement>('[data-result-honey-surface]');
  const resultPollenFill = el<SVGRectElement>('[data-result-fill="pollen"]');
  const resultCoverage = el('.result-coverage');
  const resultSpeciesPetals = flowerTypes.map(([species, name]) => ({ species, name, element: el(`.result-species-petal[data-result-species="${species}"]`) }));
  const soundButton = el<HTMLButtonElement>('[data-action="sound"]');
  const uvButton = el<HTMLButtonElement>('[data-action="uv"]');
  const returnButton = el<HTMLButtonElement>('[data-action="return"]');
  const messageToast = el('.message-toast');
  const pollinationToast = el('.pollination-toast');
  const pollinationBlooms = flowerTypes.map(([species, name]) => ({ species, name, element: el(`[data-pollinated-species="${species}"]`) }));
  const pollinationSummary = el('.pollination-summary');
  const meadowCoverage = el('.meadow-coverage');
  const speciesPetals = flowerTypes.map(([species, name]) => ({ species, name, element: el(`.species-petal[data-species="${species}"]`) }));
  const flowerPollinated = el('.flower-pollinated');
  // The pollinated line shows the same small colored bloom as the +1 notice, for this flower's species.
  const flowerPollinatedMarks = flowerTypes.map(([species]) => ({ species, element: el(`[data-flower-pollinated="${species}"]`) }));
  const compass = el('.compass-arrow');
  const dayWind = el<SVGGElement>('[data-day-wind]');
  const windArrow = el<SVGGElement>('[data-wind-arrow]');
  const windStreaks = el<SVGGElement>('[data-wind-streaks]');
  const windSockCloth = el<SVGPathElement>('[data-windsock-cloth]');
  const windSockStripe = el<SVGPathElement>('[data-windsock-stripe]');
  const reserveMark = el<SVGGElement>('.reserve-mark');
  const dust = el('.pollen-dust');
  const visionLabel = el('.vision-label');
  const aim = el('.aim');
  let previousPhase = '';
  let previousMuted: boolean | undefined;
  let previousUV: boolean | undefined;
  let showingFailure = false;
  let factsOpen = false;
  let factsReturnPhase = 'paused';
  let factsOpener = factsOpenButton;
  let factsEscapeHeld = false;
  const cleanup = new AbortController();
  function selectFact(index: number, focus = false): void {
    const selected = (index + beeFacts.length) % beeFacts.length;
    factTabs.forEach((tab, i) => {
      tab.tabIndex = i === selected ? 0 : -1;
      attribute(tab, 'aria-selected', String(i === selected));
      show(factPanels[i], i === selected);
    });
    factsReader.scrollTop = 0;
    if (focus) factTabs[selected].focus({ preventScroll: true });
  }
  function closeFacts(restoreFocus = true): void {
    factsOpen = false;
    modal.classList.remove('is-reading-facts');
    show(factsPage, false);
    attribute(factsOpenButton, 'aria-expanded', 'false');
    attribute(resultFactsButton, 'aria-expanded', 'false');
    show(pausePage, previousPhase === 'paused');
    show(resultPage, previousPhase === 'won' || previousPhase === 'lost');
    if (restoreFocus && previousPhase === factsReturnPhase) factsOpener.focus({ preventScroll: true });
  }
  // Capture before the game's keyboard handler: Escape first returns to the
  // guide; reading, scrolling and navigating tabs cannot become flight input.
  window.addEventListener('keydown', event => {
    if (previousPhase === 'learning' || learningHeldKeys.has(event.code)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (previousPhase !== 'learning') return;
      learningHeldKeys.add(event.code);
      for (const item of learningKeys) if (item.dataset.learnKey === event.code) item.classList.add('is-pressed');
      if (event.code === 'Tab') learningButton.focus({ preventScroll: true });
      // Space demonstrates its keycap; Enter or Escape dismisses the guide.
      // Once the button is focused it also supports ordinary Space activation.
      if (!event.repeat && (event.code === 'Enter' || event.code === 'Escape' || event.code === 'Space' && document.activeElement === learningButton)) actions.explore();
      return;
    }
    if (factsEscapeHeld && event.code === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!factsOpen) return;
    event.stopImmediatePropagation();
    if (event.code === 'Escape') {
      event.preventDefault(); factsEscapeHeld = true; closeFacts(); return;
    }
    const index = factTabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index >= 0 && ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Home', 'End'].includes(event.code)) {
      event.preventDefault();
      selectFact(event.code === 'Home' ? 0 : event.code === 'End' ? beeFacts.length - 1 : index + (event.code === 'ArrowUp' || event.code === 'ArrowLeft' ? -1 : 1), true);
    } else if (event.code === 'Tab') {
      const focusable = Array.from(factsPage.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]'))
        .filter(item => item.tabIndex >= 0 && item.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !factsPage.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
  }, { capture: true, signal: cleanup.signal });
  window.addEventListener('keyup', event => {
    const learningKeyHeld = learningHeldKeys.delete(event.code);
    for (const item of learningKeys) if (item.dataset.learnKey === event.code) item.classList.remove('is-pressed');
    if (previousPhase === 'learning' || learningKeyHeld) { event.stopImmediatePropagation(); return; }
    if (event.code === 'Escape' && factsEscapeHeld) {
      factsEscapeHeld = false; event.stopImmediatePropagation();
    } else if (factsOpen) event.stopImmediatePropagation();
  }, { capture: true, signal: cleanup.signal });
  window.addEventListener('blur', () => {
    factsEscapeHeld = false; learningHeldKeys.clear();
    for (const item of learningKeys) item.classList.remove('is-pressed');
  }, { signal: cleanup.signal });
  root.addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-fact-index]');
    if (tab && factsOpen) { selectFact(Number(tab.dataset.factIndex), true); return; }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'facts-open' || button.dataset.action === 'result-facts-open') {
      if (!['paused', 'won', 'lost'].includes(previousPhase)) return;
      factsReturnPhase = previousPhase; factsOpener = button;
      factsOpen = true; selectFact(0);
      modal.classList.add('is-reading-facts');
      show(pausePage, false); show(resultPage, false); show(factsPage, true);
      attribute(button, 'aria-expanded', 'true');
      el('[data-facts-return]').textContent = previousPhase === 'paused' ? 'Field guide' : 'Day’s totals';
      el('[data-facts-status]').textContent = previousPhase === 'paused' ? 'The meadow is paused. Take your time.' : 'The day is over. Take your time.';
      factsTitle.focus({ preventScroll: true });
      return;
    }
    if (button.dataset.action === 'facts-close') { closeFacts(); return; }
    const callbacks: Record<string, () => void> = { start: actions.start, explore: actions.explore, resume: actions.resume, pause: actions.pause, restart: actions.restart, sound: actions.toggleSound, uv: actions.toggleUV, return: actions.returnHome, 'skip-return': actions.skipReturn, rest: actions.toggleRest };
    callbacks[button.dataset.action!]?.();
    button.blur();
  }, { signal: cleanup.signal });
  // Keep interacting with the field notes from also becoming a drink/look gesture.
  root.addEventListener('pointerdown', event => {
    if ((event.target as Element).closest('button, .journal-page, .cargo-meter')) event.stopPropagation();
  }, { signal: cleanup.signal });

  function update(state: ViewState) {
    const playing = state.phase === 'flying' || state.phase === 'landed';
    const quiet = percent(state.quietFade ?? 0, 1);
    root.style.setProperty('--quiet-opacity', (1 - quiet).toFixed(3));
    root.classList.toggle('is-quiet', playing && quiet > .001);
    scenicVeil.style.opacity = percent(state.scenicFade ?? 0, 1).toFixed(3);
    // Both kinds of rest show a curled, sleeping bee: the restorative E rest (fading in and
    // out with its progress) and the lingering overhead meadow view (fading with the camera).
    const restSleep = state.resting ? Math.min(1, state.restProgress / .12, (1 - state.restProgress) / .1) : 0;
    const sleeping = percent(Math.max(state.scenicAmount ?? 0, restSleep), 1);
    show(sleepNote, sleeping > .01);
    sleepNote.style.opacity = sleeping.toFixed(3);
    sleepNote.classList.toggle('is-still', state.reducedMotion);
    if (factsOpen && state.phase !== factsReturnPhase) closeFacts(false);
    const returning = state.phase === 'returning';
    const failing = state.phase === 'failing';
    if (state.phase !== 'paused') showingFailure = failing || state.phase === 'lost';
    root.classList.toggle('is-failure-scene', showingFailure);
    root.classList.toggle('is-nightfall', showingFailure && state.lossFromNight);
    // The renderer owns the blue pigment wash; this final dark iris stays below
    // the journal and follows simulation time, including a paused closing scene.
    const loss = showingFailure ? percent(state.lossProgress, 1) : 0;
    const closed = loss * loss * (3 - 2 * loss);
    const centerDarkness = percent((loss - .7) / .3, 1);
    lossVeil.style.opacity = state.lossFromNight ? '0' : Math.min(1, loss * 6).toFixed(3);
    lossVeil.style.setProperty('--loss-clear', `${(72 * (1 - closed)).toFixed(2)}%`);
    lossVeil.style.setProperty('--loss-soft', `${(100 * (1 - closed)).toFixed(2)}%`);
    lossVeil.style.setProperty('--loss-center', (centerDarkness * centerDarkness * (3 - 2 * centerDarkness)).toFixed(3));
    const day = percent(state.dayProgress, 1);
    const dayName = day < .4 ? 'MORNING' : day < .6 ? 'MIDDAY' : day < .75 ? 'AFTERNOON' : day < .9 ? 'GOLDEN HOUR' : day < 1 ? 'SUNSET' : 'LAST LIGHT';
    text('day-label', dayName);
    // One simulation clock drives daylight, the sun and the rain strokes.
    // No CSS animation can drift ahead while the game is paused.
    const noon = Math.sin(day * Math.PI);
    const sunX = 24 + day * 432;
    const sunY = 43 - 72 * day * (1 - day);
    attribute(daySun, 'transform', `translate(${sunX.toFixed(2)} ${sunY.toFixed(2)}) scale(${(.72 + noon * .48).toFixed(3)})`);
    attribute(dayGlow, 'opacity', (.35 + noon * .65).toFixed(3));
    attribute(daySun, 'opacity', (1 - state.rain * .35).toFixed(3));
    attribute(dayTrail, 'stroke-dashoffset', (1 - day).toFixed(4));
    const underLeaf = state.phase === 'landed' && state.underLeaf;
    const onLeaf = state.phase === 'landed' && state.onLeaf;
    const leafPerch = underLeaf || onLeaf;
    const shelterBeneath = onLeaf && (state.rain > .05 || state.needsShade);
    const overheated = state.heat > .18;
    const cooling = overheated && state.shaded;
    const onGround = state.phase === 'landed' && state.onGround;
    const grassSheltered = state.grassCover >= .99;
    const exposedToRain = playing && !state.underLeaf && !grassSheltered && state.rainExposure > .01;
    const exposedFlower = state.phase === 'landed' && !leafPerch && !onGround && exposedToRain;
    const weather = state.weatherStage;
    // Actual rain reveals the cloud. Approaching weather never marks a future
    // storm on the strip. As it clears, the cloud trails behind the true sun.
    const raining = state.rain > 0;
    const clearing = weather === 'clearing';
    const cloudOpacity = raining ? .85 + state.rain * .15 : clearing ? state.cloudiness : 0;
    const cloudX = sunX - (clearing ? (1 - state.rain) * 62 : 0);
    attribute(dayCloud, 'transform', `translate(${cloudX.toFixed(2)} ${sunY.toFixed(2)}) scale(.88)`);
    attribute(dayCloud, 'opacity', cloudOpacity.toFixed(3));
    attribute(dayRain, 'stroke-dashoffset', state.reducedMotion ? '0' : (-state.elapsed * 7 % 8).toFixed(2));
    // A windy spell shows as stacked wavy lines just ahead of the sun, like the rain cloud.
    const windy = state.gale > .2, hot = state.sunHeat > .18;
    const galeDrift = state.reducedMotion ? 0 : Math.sin(state.elapsed * 2.2) * 2.5 * state.gale;
    attribute(dayGale, 'transform', `translate(${(sunX + 38 + galeDrift).toFixed(2)} ${(sunY + 3).toFixed(2)})`);
    attribute(dayGale, 'opacity', Math.min(1, state.gale * 1.25).toFixed(3));
    attribute(weatherNote, 'data-gale', String(windy));
    const weatherLabel = raining ? (clearing ? 'Rain easing' : 'Raining') : clearing ? 'Dry again' : windy ? (hot ? 'Hot and windy' : 'Heavy wind') : hot ? 'Hot sun' : 'Fair skies';
    attribute(dayHeat, 'opacity', state.sunHeat.toFixed(3));
    attribute(dayPigment, 'stop-color', `hsl(${(43 - state.sunHeat * 20).toFixed(1)} 82% 65%)`);
    attribute(weatherNote, 'data-hot-sun', String(state.sunHeat > .18));
    text('weather', weatherLabel);
    show(dayWeather, raining || clearing || hot || windy);
    const windStrength = percent(state.wind, 6.3);
    const windLabel = state.edgeGust ? 'Meadow-edge gust' : state.wind > 4 ? 'Strong gust' : state.wind > 2.4 ? 'Wind rising' : state.wind > .8 ? 'Steady breeze' : 'Light air';
    const windHelp = `${windLabel}. Watch the swaying grass for wind. Fly low, perch, or ride the current to save energy.`;
    attribute(dayWind, 'transform', `translate(${sunX.toFixed(2)} ${(sunY + (raining ? 45 : 32)).toFixed(2)})`);
    attribute(windArrow, 'transform', `rotate(${(state.windBearing * 180 / Math.PI).toFixed(2)}) scale(${(.8 + windStrength * .4).toFixed(3)})`);
    attribute(windArrow, 'fill', `hsl(${(87 - windStrength * 59).toFixed(1)} ${(24 + windStrength * 38).toFixed(1)}% 55%)`);
    attribute(windArrow, 'stroke', state.wind > 4 ? '#92522f' : '#526447');
    attribute(windStreaks, 'opacity', percent((state.wind - 2.4) / 3.9, 1).toFixed(3));
    const sockLength = 9 + windStrength * 12;
    const sockDrop = (1 - windStrength) * 9 + (state.reducedMotion ? 0 : Math.sin(state.elapsed * 8) * windStrength * .8);
    attribute(windSockCloth, 'd', `M1 2L${sockLength.toFixed(2)} ${(2 + sockDrop).toFixed(2)}v4L1 10Z`);
    attribute(windSockCloth, 'fill', state.wind > 4 ? '#ce9869' : '#c6af88');
    attribute(windSockStripe, 'd', `M6 ${(2 + sockDrop * 5 / (sockLength - 1)).toFixed(2)}v${(8 - 4 * 5 / (sockLength - 1)).toFixed(2)}`);
    attribute(weatherNote, 'data-wind-strength', windStrength.toFixed(3));
    attribute(weatherNote, 'title', windHelp);
    attribute(weatherNote, 'aria-label', `${dayName.toLowerCase()}. ${weatherLabel}. ${windHelp}`);
    attribute(weatherNote, 'data-weather-stage', weather);
    attribute(weatherNote, 'data-rain-drops', String(raining ? (state.rain > .6 ? 3 : state.rain > .2 ? 2 : 1) : 0));
    // Keep this small cue visible under cover, even once the rest of the HUD
    // fades. A dry sun remains legible when it is time to leave the shelter.
    weatherNote.classList.toggle('sheltered-clock', underLeaf || onGround && grassSheltered);
    const pointToShelter = playing && !state.shaded && !state.onLeaf && (weather !== 'clear' || state.needsShade) && Number.isFinite(state.shelterDistance) && state.shelterDistance >= 0;
    const shelterName = state.needsShade && state.rain <= .05 ? 'Cool shade' : 'A dry leaf';
    text('shelter-label', shelterName);
    show(shelterGuide, pointToShelter);
    show(objective, pointToShelter);
    if (pointToShelter) {
      const distance = `${state.shelterDistance.toFixed(1)} m`;
      text('shelter-distance', distance);
      shelterArrow.style.transform = `rotate(${state.shelterBearing}rad)`;
      const bearing = Math.atan2(Math.sin(state.shelterBearing), Math.cos(state.shelterBearing));
      const direction = Math.abs(bearing) < Math.PI / 6 ? 'ahead' : Math.abs(bearing) > Math.PI * 5 / 6 ? 'behind you' : bearing > 0 ? 'to your right' : 'to your left';
      attribute(shelterGuide, 'aria-label', `${shelterName} ${distance} away, ${direction}`);
    }
    const resting = state.phase === 'landed' && state.resting;
    root.classList.toggle('is-resting', resting);
    flowerNote.classList.toggle('is-leaf-shelter', underLeaf);
    flowerNote.classList.toggle('is-leaf-perch', onLeaf);
    flowerNote.classList.toggle('is-grass-perch', onGround);
    show(restButton, state.phase === 'landed');
    restButton.disabled = state.phase !== 'landed';
    const restLabel = shelterBeneath ? 'Shelter beneath' : resting ? 'Resting · time passes' : 'Rest and pass time';
    text('rest-label', restLabel);
    attribute(restButton, 'aria-label', resting && !shelterBeneath ? `${restLabel} · Wake up` : restLabel);
    attribute(restButton, 'aria-pressed', String(resting && !shelterBeneath));
    attribute(restButton, 'title', shelterBeneath ? (state.rain > .05 ? 'Tuck beneath this leaf with E to get dry.' : 'Tuck beneath this leaf with E to cool in the shade.') : resting ? 'Wake now with E, or move, sip or take off. Arrow keys still look around.' : underLeaf ? (state.needsShade ? 'Cool beneath the leaf. Stored nectar restores energy while the day passes.' : 'Rest sheltered beneath the leaf. Stored nectar restores energy while the day passes.') : onLeaf ? 'Rest on this leaf. Stored nectar restores energy while the day passes.' : onGround ? (grassSheltered ? 'Rest sheltered among the grass. Stored nectar restores energy.' : exposedToRain ? 'Rain reaches this patch. Walk into denser grass to get dry; stored nectar restores energy.' : 'Rest among the grass. Stored nectar restores energy while the day passes.') : exposedFlower ? 'Resting here leaves you exposed to cold rain. Leaves or dense grass let your wings warm; stored nectar restores energy.' : 'Rest on this flower. Stored nectar restores energy while the day passes.');
    attribute(root, 'data-ending-stage', returning ? state.endingStage : 'none');
    const fade = String(returning || state.phase === 'won' && state.endingStage === 'fade' ? percent(state.endingFade, 1) : 0);
    endingFade.style.opacity = fade;
    transition.style.setProperty('--ending-fade', failing ? String(percent((loss - .72) / .28, 1)) : fade);
    // The flight home needs no heading; only the endings where the bee doesn't make it have one.
    text('ending-eyebrow', failing ? state.lossFromNight ? 'NIGHT FALLS ON THE MEADOW' : 'THE MEADOW FALLS QUIET' : '');
    text('ending-caption', failing ? state.lossFromNight ? 'The last light slips away…' : 'Wings growing still…' : 'Heading home…');
    text('closing-action', failing ? 'Continue' : 'Skip to totals');
    attribute(transition, 'aria-label', failing ? state.lossFromNight ? 'Nightfall in the meadow' : 'The end of a little life' : "The day's journey home");
    attribute(closingButton, 'aria-label', failing ? 'Skip to results' : 'Skip to totals');
    attribute(closingButton, 'title', failing ? 'Skip to results · Space' : 'Skip to totals · Space');
    const visitedInVision = state.uv && state.flowerVisited && !state.shelterTarget && !state.leafTopTarget && state.phase === 'flying';
    const highlightLanding = state.canLand && !visitedInVision;
    if (state.phase === 'learning') {
      // From the second summer, the start page shows how the meadow changed and
      // why; the keyboard controls fold away (still one click to open).
      const start = state.summerStart;
      show(learningSummer, !!start);
      show(learningGoals, !start);
      show(learningCycle, !start);
      const title = start ? `Summer ${start.summer} begins on a flower.` : 'Your summer day begins on a flower.';
      if (learningTitle.textContent !== title) learningTitle.textContent = title;
      const summer = start?.summer ?? 1;
      if (controlsFoldedFor !== summer) { controlsFoldedFor = summer; learningControls.open = !start; }
      if (start) {
        text('summer-flowers-line', start.flowersLine);
        text('summer-friends-line', start.friendsLine || 'The aphids and ladybirds are much as they were.');
        const rows: [string, number, number][] = [...summerKinds.map(([s]) => [s, start.before[s], start.after[s]] as [string, number, number]), ['aphid', start.aphidsBefore, start.aphidsAfter], ['ladybird', start.ladybirdsBefore, start.ladybirdsAfter], ['butterfly', start.butterfliesBefore, start.butterfliesAfter], ['snail', start.snailsBefore, start.snailsAfter]];
        for (const [kind, before, after] of rows) {
          const change = after - before;
          text(`summer-was-${kind}`, String(before));
          text(`summer-count-${kind}`, String(after));
          text(`summer-delta-${kind}`, change === 0 ? 'no change' : `${change > 0 ? '+' : '−'}${Math.abs(change)}`);
          const cell = el(`[data-summer-kind="${kind}"]`), sign = change > 0 ? 'more' : change < 0 ? 'fewer' : 'same';
          if (cell.dataset.trend !== sign) cell.dataset.trend = sign;
        }
      }
    }
    if (previousPhase !== state.phase) {
      root.dataset.phase = state.phase;
      show(learningOverlay, state.phase === 'learning');
      show(modal, state.phase === 'paused' || state.phase === 'won' || state.phase === 'lost');
      show(pausePage, state.phase === 'paused' && !factsOpen);
      show(resultPage, !factsOpen && (state.phase === 'won' || state.phase === 'lost'));
      show(transition, returning || failing);
      previousPhase = state.phase;
      if (state.phase === 'learning') learningTitle.focus({ preventScroll: true });
      if (state.phase === 'paused') el<HTMLButtonElement>('[data-action="resume"]').focus({ preventScroll: true });
      if (returning || failing) closingButton.focus({ preventScroll: true });
      if (state.phase === 'won' || state.phase === 'lost') resultPage.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }
    text('energy', `${Math.ceil(state.energy)}%`);
    text('feeding-status', resting ? 'Resting' : state.autoFeeding ? 'Eating' : state.drinking && state.energy < 99.5 ? 'Sipping' : '');
    text('energy-note', overheated ? (state.shaded ? 'Cooling in the shade · nectar restores energy' : 'Heat drains energy · rest beneath a leaf or in dense grass') : shelterBeneath ? 'Leaf tops are exposed · E tucks beneath' : state.chilled ? (underLeaf ? 'Warming under a leaf · nectar restores energy' : grassSheltered ? 'Warming in dense grass · nectar restores energy' : exposedToRain ? (onGround ? 'Rain reaches this patch · walk into denser grass' : 'Cold rain drains energy · seek a leaf or dense grass') : 'Dry air warms your wings · nectar restores energy') : exposedFlower ? 'Flowers are exposed · leaves and dense grass offer shelter' : onGround && exposedToRain ? 'Rain reaches this patch · denser grass keeps you dry' : resting ? (state.energy >= 99.5 ? 'Resting · your wings are ready' : state.nectar > 0 ? 'Resting with stored nectar · energy rising' : 'No stored nectar · rest alone cannot restore energy') : state.autoFeeding ? 'Eating stored nectar · energy rising' : state.drinking && state.energy < 99.5 ? 'Nectar is restoring your energy' : state.energy < 25 ? 'Find nectar. Rest your wings.' : state.phase === 'flying' && state.flightMode === 'steady' ? 'Working to hold against the wind' : state.phase === 'flying' && state.flightMode === 'riding' ? 'Riding the breeze saves energy' : state.energy < 55 ? 'Nectar will restore your energy' : 'Your wings are rested');
    text('nectar', `${share(state.nectar, state.nectarCapacity)}%`);
    text('nectar-goal', `Hive goal ${share(state.nectarGoal, state.nectarCapacity)}%`);
    text('pollen', `${share(state.pollen, state.pollenGoal)}%`);
    text('home-fuel', `+ ${Math.round(state.homeCost / state.nectarCapacity * 100)}% for home`);
    text('pollen-note', state.pollen >= state.pollenGoal ? 'A lovely harvest for the hive' : 'Gather as you crawl');
    text('pollination-count', String(state.pollinated));
    text('pollination-count-label', state.pollinated === 1 ? 'flower pollinated' : 'flowers pollinated');
    text('visited-count', String(state.visited));
    text('flower-total', String(state.flowerTotal));
    pollinationSummary.classList.toggle('has-pollinated', state.pollinated > 0);
    let coveredTypes = 0;
    for (const { species, name, element } of speciesPetals) {
      const count = state.pollinatedBySpecies[species];
      text(`coverage-${species}`, String(count));
      element.classList.toggle('is-pollinated', count > 0);
      attribute(element, 'aria-label', `${name}: ${count} ${count === 1 ? 'flower' : 'flowers'} pollinated`);
      if (count > 0) coveredTypes++;
    }
    attribute(meadowCoverage, 'aria-label', `Flower types pollinated: ${coveredTypes} of 3`);
    pollinationSummary.classList.toggle('all-types-pollinated', coveredTypes === 3);
    // The meadow's mood grows with pollination; all three flower types is the top tier.
    text('meadow-label', coveredTypes === 3 ? 'ALL THREE HAPPY' : state.pollinated >= 5 ? 'HAPPY MEADOW' : state.pollinated > 0 ? 'WAKING MEADOW' : 'QUIET MEADOW');
    for (const bloom of pollinationBlooms) show(bloom.element, bloom.species === state.pollinationSpecies);
    const pollinatedName = pollinationBlooms.find(bloom => bloom.species === state.pollinationSpecies)?.name;
    text('pollination-announcement', pollinatedName ? `${pollinatedName} pollinated. ${state.pollinated} ${state.pollinated === 1 ? 'flower' : 'flowers'} pollinated in the meadow.` : '');
    show(pollinationToast, playing && !!state.pollinationSpecies);
    show(flowerPollinated, state.flowerPollinated && !leafPerch && !onGround);
    for (const mark of flowerPollinatedMarks) show(mark.element, mark.species === state.flowerSpecies);
    const nectarTotal = state.nectarGoal + state.homeCost;
    attribute(fills.energy, 'd', energyWedge(percent(state.energy)));
    const honeyHeight = 52 * percent(state.nectar, state.nectarCapacity);
    const honeyTop = (80 - honeyHeight).toFixed(2);
    attribute(fills.nectar, 'height', honeyHeight.toFixed(2));
    attribute(fills.nectar, 'y', honeyTop);
    attribute(honeySurface, 'd', honeyHeight > 0 ? `M22 ${honeyTop}q15-1.8 30 0t30 0` : '');
    const pollenHeight = 42 * percent(state.pollen, state.pollenGoal);
    attribute(fills.pollen, 'height', pollenHeight.toFixed(2));
    attribute(fills.pollen, 'y', (77 - pollenHeight).toFixed(2));
    meters.energy.classList.toggle('is-low', state.energy < 25);
    meters.energy.classList.toggle('is-chilled', state.chilled);
    meters.energy.classList.toggle('is-hot', overheated);
    meters.nectar.classList.toggle('is-full', state.nectar >= nectarTotal);
    meters.pollen.classList.toggle('is-full', state.pollen >= state.pollenGoal);
    for (const [name, value, max] of [['energy', state.energy, 100], ['nectar', state.nectar, state.nectarCapacity], ['pollen', state.pollen, state.pollenGoal]] as const) {
      const meter = meters[name];
      attribute(meter, 'aria-valuenow', String(Math.round(Math.min(value, max))));
      attribute(meter, 'aria-valuemax', String(max));
      attribute(meter, 'aria-valuetext', name === 'energy' ? `${Math.ceil(value)} percent` : name === 'pollen' ? `${Math.floor(value / max * 100 + 1e-6)} percent of what the hive needs` : `${share(value, max)} percent of the jar`);
    }
    attribute(reserveMark, 'transform', `translate(0 ${(80 - 52 * percent(nectarTotal, state.nectarCapacity)).toFixed(2)})`);
    text('home-distance', state.homeDistance.toFixed(1));
    text('home-guidance', state.harvestReady ? 'Carry your harvest to the meadow edge.' : state.headingHome ? 'Heading home early with what you carry.' : 'Gather nectar and pollen for the journey.');
    text('return-ready-label', state.harvestReady ? 'YOUR HIVE IS CALLING' : 'HEADING HOME EARLY');
    compass.style.transform = `rotate(${state.homeBearing}rad)`;
    const homeward = state.harvestReady || state.headingHome;
    show(homeReady, homeward && playing);
    // R works any time there is nectar for the flight; the button appears once homeward.
    returnButton.disabled = !state.canHeadHome;
    show(homeMarker, homeward && playing && state.homeVisible);
    homeMarker.style.left = `${state.homeX * 100}%`;
    homeMarker.style.top = `${state.homeY * 100}%`;
    show(flowerNote, state.phase === 'landed' && (leafPerch || onGround || !!state.flowerName));
    show(flowerResources, !leafPerch && !onGround);
    show(flowerForage, state.phase === 'landed' && !leafPerch && !onGround && !!state.flowerName);
    text('flower-forage', state.flowerSpecies === 'poppy' ? 'Move to collect pollen.' : 'Move to collect pollen, F for nectar.');
    text('flower-number', onGround ? (grassSheltered ? 'A LITTLE SHELTER' : 'AT GROUND LEVEL') : underLeaf ? 'A LITTLE SHELTER' : onLeaf ? 'A LEAFY PERCH' : 'ON THE FLOWER');
    text('flower-name', onGround ? 'Among the grass' : underLeaf ? 'Under a leaf' : onLeaf ? 'On a leaf' : state.flowerName);
    // What this flower still offers, on one scale per resource: the richest kind
    // (cornflower nectar, poppy pollen) fills the bar, so differences show.
    supplyBar(nectarBar, state.flowerNectar / state.flowerNectarMax, `Nectar here: ${Math.ceil(state.flowerNectar / state.nectarCapacity * 100 - 1e-6)}% of a jar`);
    supplyBar(pollenBar, state.flowerPollen / state.flowerPollenMax, `Pollen here: ${Math.ceil(state.flowerPollen / state.pollenGoal * 100 - 1e-6)}% of a pouch`);
    const guidance = cooling ? 'Cooling in the shade. Nectar restores energy.' : overheated ? (shelterBeneath ? 'Hot sun falls here. E tucks into shade.' : 'Open to the hot sun. Leaves or dense grass offer shade.') : onGround ? (grassSheltered ? (state.chilled ? 'Your wings are warming. Nectar restores energy.' : 'Sheltered by the grass. Nectar restores energy.') : exposedToRain ? 'Rain reaches this patch. Denser grass offers shelter.' : 'A quiet place to rest. Stored nectar restores energy.') : underLeaf ? (state.chilled ? 'Shelter beneath a leaf. Your wings are warming.' : 'Shelter beneath a leaf. Look up with ↑: ladybirds sometimes walk the underside.') : onLeaf ? (shelterBeneath ? (state.rain > .05 ? 'Rain falls here. Tuck beneath to get dry.' : 'Hot sun falls here. E tucks into shade.') : 'A quiet perch. Stored nectar restores energy.') : exposedFlower ? 'Open to cold rain. Leaves or dense grass offer shelter.' : '';
    text('flower-guidance', guidance);
    show(flowerGuidance, !!guidance);
    keyText('hint', state.hint);
    const interaction = shelterBeneath ? 'E  ·  SHELTER BENEATH' : resting ? (state.restProgress >= .85 ? 'A LITTLE REST, NEARLY DONE' : 'RESTING · THE DAY DRIFTS BY') : state.landing ? (state.leafTopTarget ? 'SETTLING ON A LEAF' : state.shelterTarget ? 'SETTLING UNDER A LEAF' : 'LANDING GENTLY') : onGround ? 'E  ·  REST IN THE GRASS' : underLeaf ? 'E  ·  REST UNDER THE LEAF' : onLeaf ? 'E  ·  REST ON THE LEAF' : state.drinking ? (state.energy < 99.5 ? 'SIPPING · RESTORING ENERGY' : 'SIPPING NECTAR') : state.phase === 'landed' ? (state.satiated ? 'ALL TOPPED UP' : state.canDrink ? 'HOLD F TO SIP' : 'WASD  ·  EXPLORE THE FLOWER') : highlightLanding ? (state.leafTopTarget ? 'E  ·  LAND ON LEAF' : state.shelterTarget ? 'E  ·  SHELTER UNDER LEAF' : 'E  ·  LAND GENTLY') : '';
    keyText('interaction', redundantCue(interaction, state.hint) ? '' : interaction);
    aim.classList.toggle('can-land', highlightLanding);
    aim.classList.toggle('is-sipping', state.drinking);
    text('message', state.message);
    show(messageToast, playing && !!state.message && !state.pollinationSpecies);
    show(target, playing && state.phase === 'flying' && state.targetVisible && highlightLanding);
    if (state.targetVisible) {
      target.style.left = `${state.targetX * 100}%`;
      target.style.top = `${state.targetY * 100}%`;
    }
    dust.style.opacity = String(percent(state.dust, 1) * 0.65);
    if (previousMuted !== state.muted) {
      soundButton.innerHTML = state.muted ? icons.muted : icons.sound;
      soundButton.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
      soundButton.setAttribute('aria-pressed', String(state.muted));
      soundButton.title = `${state.muted ? 'Unmute' : 'Mute'} sound · M`;
      previousMuted = state.muted;
    }
    if (previousUV !== state.uv) {
      root.classList.toggle('bee-vision', state.uv);
      uvButton.setAttribute('aria-pressed', String(state.uv));
      show(visionLabel, state.uv);
      previousUV = state.uv;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      const won = state.phase === 'won';
      // The day's tier: delivery and pollination (see day-report.ts). Losses keep
      // their own words but still show what was gathered and pollinated.
      const report = dayReport({ nectar: state.nectar, pollen: state.pollen, pollinatedBySpecies: state.pollinatedBySpecies, visited: state.visited, flowerTotal: state.flowerTotal });
      resultPage.dataset.tier = won ? report.tier : 'lost';
      text('result-meadow', won ? report.meadow : '');
      show(el('.result-voice-meadow'), won);
      text('result-why', report.why);
      text('result-tip', won ? report.tip : '');
      show(el('[data-text="result-tip"]'), won && !!report.tip);
      text('result-eyebrow', won ? `SUMMER ${Math.max(1, state.summerNumber)} · ONE SMALL BEE` : state.lossFromNight ? 'DAYLIGHT RAN OUT' : state.lossFromHeat ? 'TOO MUCH SUN' : state.lossFromRain ? 'CAUGHT IN THE COLD RAIN' : 'AT THE END OF YOUR ENERGY');
      text('result-title', won ? report.title : state.lossFromNight ? 'Night in the meadow.' : 'The meadow grows quiet.');
      text('result-description', won ? report.queen : state.lossFromNight ? 'Night fell before your harvest was ready for home. The flowers you helped still count. Next time, watch the sun: resting moves the day along.' : state.lossFromHeat ? 'The hot sun exhausted your bee’s energy. Next time, cool beneath a leaf or in dense grass; rest with stored nectar to recover.' : state.lossFromRain ? 'The cold rain exhausted your bee’s energy. Next time, shelter under a leaf and rest with stored nectar to recover.' : 'Your bee ran out of energy. Sip nectar along the way, and rest with a little stored nectar before your wings tire.');
      text('result-nectar-label', won ? 'Nectar brought home' : 'Nectar gathered');
      text('result-pollen-label', won ? 'Pollen brought home' : 'Pollen gathered');
      text('result-nectar', `${share(state.nectar, state.nectarCapacity)}%`);
      text('result-pollen', `${share(state.pollen, state.pollenGoal)}%`);
      text('result-visited', String(state.visited));
      const preview = state.summerPreview;
      const living = preview ? ` of ${preview.ladybirds}` : '';
      const lastSummer = preview?.lastSummerLadybirds ? ` (${preview.lastSummerLadybirds} last summer)` : '';
      const ladybirdsMet = state.friendsFound === 0 ? `None met${preview ? ` · ${preview.ladybirds} ladybirds here` : ''}${lastSummer}` : `${state.friendsFound}${living} ladybird${state.friendsFound === 1 && !living ? '' : 's'}${lastSummer}`;
      const withButterflies = state.butterfliesFound ? `${ladybirdsMet} · ${state.butterfliesFound} butterfl${state.butterfliesFound === 1 ? 'y' : 'ies'}` : ladybirdsMet;
      text('result-friends', state.snailsFound ? `${withButterflies} · ${state.snailsFound} snail${state.snailsFound === 1 ? '' : 's'}` : withButterflies);
      text('result-next', preview ? nextSummerLine(preview) : '');
      show(el('[data-text="result-next"]'), !!preview);
      text('result-pollinated', String(state.pollinated));
      text('result-pollinated-label', state.pollinated === 1 ? 'flower pollinated' : 'flowers pollinated');
      for (const { species, name, element } of resultSpeciesPetals) {
        const count = state.pollinatedBySpecies[species];
        text(`result-coverage-${species}`, String(count));
        element.classList.toggle('is-pollinated', count > 0);
        attribute(element, 'aria-label', `${name}: ${count} ${count === 1 ? 'flower' : 'flowers'} pollinated`);
      }
      attribute(resultCoverage, 'aria-label', `Flower types pollinated: ${coveredTypes} of 3`);
      resultPage.classList.toggle('all-types-pollinated', coveredTypes === 3);
      const deliveredHoneyHeight = 52 * percent(state.nectar, state.nectarCapacity);
      const deliveredHoneyTop = (80 - deliveredHoneyHeight).toFixed(2);
      attribute(resultNectarFill, 'height', deliveredHoneyHeight.toFixed(2));
      attribute(resultNectarFill, 'y', deliveredHoneyTop);
      attribute(resultHoneySurface, 'd', deliveredHoneyHeight > 0 ? `M22 ${deliveredHoneyTop}q15-1.8 30 0t30 0` : '');
      attribute(resultPollenFill, 'height', pollenHeight.toFixed(2));
      attribute(resultPollenFill, 'y', (77 - pollenHeight).toFixed(2));
      text('result-time', `${Math.floor(state.elapsed / 60)}m ${Math.floor(state.elapsed % 60).toString().padStart(2, '0')}s`);
      text('restart-label', 'Next summer');
      resultPage.classList.toggle('is-lost', !won);
    }
  }
  return { update, dispose() { cleanup.abort(); root.replaceChildren(); } };
}
