import * as THREE from 'three';
import { meadowGroundHeight } from './world';

/**
 * A speed check for tablets and phones (?bench). Once the game has started, the bee flies a
 * fixed route by herself, with no controls needed: low among the flowers, then high over the
 * meadow. It does this several times, each time with one costly thing switched off (shadows,
 * the "what the bee can see" depth pass, half the grass, distant flowers), then all of them
 * together, and then all of them at a lower resolution. A card at the end shows the frame
 * rate for each, so we can choose the lighter settings for a device. A small live readout
 * shows in the corner meanwhile. Results also go to window.__BEE_BENCH__ and the console.
 */
export interface BenchFeatures { shadows: boolean; sightEvery: number; grass: number; cover: number; flowerRange: number; simplePollen: boolean; nearHeads: number; hud: boolean; }
export interface BenchHost {
  renderer: THREE.WebGLRenderer;
  /** Puts the bee here, flying, looking this way. */
  pose(position: THREE.Vector3, yaw: number, pitch: number): void;
  /** Switches the costly parts on or off. */
  setFeatures(features: BenchFeatures): void;
  /** True once the game is under way (past the title and the opening guide). */
  ready(): boolean;
  /** Where the last frame's time went, in ms (garden.ts frameParts). */
  parts(): FrameParts;
  /** Back to the game's own settings, when the check is done. */
  restore(): void;
}
export interface FrameParts { steps: number; step: number; world: number; view: number; render: number; sight: number; diagnostics: number; }
export interface BenchResult { name: string; place: 'low' | 'high'; fps: number; slowFrameMs: number; parts: FrameParts; calls: number; triangles: number; }
const PART_KEYS: (keyof FrameParts)[] = ['steps', 'step', 'world', 'view', 'render', 'sight', 'diagnostics'];
const emptyParts = (): FrameParts => ({ steps: 0, step: 0, world: 0, view: 0, render: 0, sight: 0, diagnostics: 0 });

/** As the game was before tablets got their own settings, and the tablet settings (garden.ts light). */
const FULL: BenchFeatures = { shadows: true, sightEvery: .2, grass: 1, cover: 1, flowerRange: 48, simplePollen: false, nearHeads: 17, hud: true };
const TABLET: BenchFeatures = { shadows: true, sightEvery: .5, grass: .55, cover: .5, flowerRange: 48, simplePollen: true, nearHeads: 9, hud: true };
const VARIANTS: { name: string; scale: number; features: BenchFeatures }[] = [
  { name: 'As before (1.5×)', scale: 1.5, features: FULL },
  { name: 'As before, 1×', scale: 1, features: FULL },
  { name: 'As before, 1×, no HUD', scale: 1, features: { ...FULL, hud: false } },
  { name: 'Tablet settings', scale: 1, features: TABLET },
  { name: 'Tablet, no HUD', scale: 1, features: { ...TABLET, hud: false } },
  { name: 'Tablet, no shadows', scale: 1, features: { ...TABLET, shadows: false } },
  { name: 'Tablet, 0.75×', scale: .75, features: TABLET },
];
/** Seconds per stretch, and the first part of each left out while the view settles. */
const LOW_TIME = 9, HIGH_TIME = 5, SETTLE = 1.5;
const CENTER = new THREE.Vector3(0, 0, -4), RADIUS = 9;

function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}

/** Where a frame's time goes, among the flowers with the tablet settings. What isn't the game's own
 * work is time spent waiting for the graphics chip to finish the previous frame. */
function breakdown(r: BenchResult): string {
  const p = r.parts, frame = 1000 / r.fps, ours = p.step + p.world + p.view + p.render + p.sight + p.diagnostics;
  const row = (label: string, ms: number) => `<tr><td style="padding:1px 12px">${label}</td><td style="padding:1px 12px;text-align:right">${ms.toFixed(1)} ms</td></tr>`;
  return `<p style="margin:12px 0 4px;font-size:14px">Where a frame’s ${frame.toFixed(0)} ms go (tablet settings, among the flowers):</p>
    <table style="border-collapse:collapse;font-size:13px">
      ${row(`Simulation (${p.steps.toFixed(1)} steps a frame)`, p.step)}${row('World update', p.world)}${row('HUD', p.view)}${row('Sending the frame to the GPU', p.render)}${row('Sight pass', p.sight)}${row('Diagnostics', p.diagnostics)}
      ${row('Waiting for the GPU (the rest)', Math.max(0, frame - ours))}
      <tr><td style="padding:1px 12px;opacity:.7" colspan="2">${Math.round(r.calls)} draw calls · ${(r.triangles / 1000).toFixed(0)}k triangles</td></tr>
    </table>`;
}

export function createBench(host: BenchHost) {
  const stretches: { variant: typeof VARIANTS[number]; place: 'low' | 'high'; time: number }[] = [];
  for (const variant of VARIANTS) stretches.push({ variant, place: 'low', time: LOW_TIME }, { variant, place: 'high', time: HIGH_TIME });
  const results: BenchResult[] = [];
  let index = -1, age = 0, angle = 0, frames: number[] = [], done = false, readoutAge = 0, readoutFrames = 0;
  let parts = emptyParts(), calls = 0, triangles = 0;
  const at = new THREE.Vector3();

  const readout = document.createElement('div');
  readout.setAttribute('data-bench-readout', '');
  readout.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:50;padding:6px 10px;border-radius:8px;background:rgba(30,34,24,.72);color:#f6efd8;font:13px/1.3 ui-monospace,Menlo,monospace;pointer-events:none';
  readout.textContent = 'Speed check: starting…';
  document.body.append(readout);

  const setScale = (scale: number) => {
    host.renderer.setPixelRatio(scale);
    host.renderer.setSize(innerWidth, innerHeight, false);
  };
  const finish = () => {
    done = true;
    host.restore();
    const gpu = gpuName(host.renderer);
    const summary = { gpu, screen: `${innerWidth}×${innerHeight} @${devicePixelRatio}x`, userAgent: navigator.userAgent, results };
    (window as unknown as { __BEE_BENCH__: unknown }).__BEE_BENCH__ = summary;
    console.info('[bee-garden] speed check', JSON.stringify(summary));
    readout.remove();
    const card = document.createElement('div');
    card.setAttribute('data-bench-card', '');
    card.style.cssText = 'position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(30,34,24,.45);font-family:Georgia,serif;overflow:auto';
    const cell = (r: BenchResult) => `<td style="padding:3px 12px;text-align:right;white-space:nowrap">${r.fps.toFixed(0)} fps <small style="opacity:.65">· ${r.slowFrameMs.toFixed(0)} ms</small></td>`;
    const rows = VARIANTS.map(v => {
      const low = results.find(r => r.name === v.name && r.place === 'low')!, high = results.find(r => r.name === v.name && r.place === 'high')!;
      return `<tr><td style="padding:3px 12px">${v.name}</td>${cell(low)}${cell(high)}</tr>`;
    }).join('');
    card.innerHTML = `<div style="max-width:min(94vw,620px);padding:20px 24px;border-radius:14px;background:#f8f1dd;color:#2c3322;box-shadow:0 8px 30px rgba(0,0,0,.3)">
      <h2 style="margin:0 0 6px;font-weight:normal">Speed check</h2>
      <p style="margin:0 0 10px;font-size:14px;opacity:.8">Frames a second as the game was, and with the new tablet settings (30 is playable, 50–60 smooth). The ms figure is the slowest frame in twenty: high means stutters.</p>
      <table style="border-collapse:collapse;font-size:15px"><tr><th></th><th style="padding:3px 12px;text-align:right">Among the flowers</th><th style="padding:3px 12px;text-align:right">High above</th></tr>${rows}</table>
      ${breakdown(results.find(r => r.name === 'Tablet settings' && r.place === 'low')!)}
      <p style="margin:10px 0 0;font-size:12px;opacity:.7">${gpu} · ${summary.screen}</p>
      <p style="margin:4px 0 0;font-size:12px;opacity:.7">Take a screenshot of this card to send. Reload to run it again.</p></div>`;
    document.body.append(card);
  };

  return {
    update(dt: number): void {
      if (done || !host.ready()) return;
      if (index < 0 || age >= stretches[index].time) {
        if (index >= 0) {
          const kept = frames.slice().sort((a, b) => a - b);
          const mean = kept.reduce((a, b) => a + b, 0) / Math.max(1, kept.length);
          const n = Math.max(1, kept.length);
          for (const key of PART_KEYS) parts[key] /= n;
          results.push({ name: stretches[index].variant.name, place: stretches[index].place, fps: 1000 / Math.max(1, mean), slowFrameMs: kept[Math.floor(kept.length * .95)] ?? 0, parts, calls: calls / n, triangles: triangles / n });
        }
        index++; age = 0; frames = []; parts = emptyParts(); calls = 0; triangles = 0;
        if (index >= stretches.length) { finish(); return; }
        setScale(stretches[index].variant.scale);
        host.setFeatures(stretches[index].variant.features);
      }
      const stretch = stretches[index];
      age += dt;
      if (age > SETTLE && dt > 0) {
        frames.push(dt * 1000);
        const last = host.parts();
        for (const key of PART_KEYS) parts[key] += last[key];
        calls += host.renderer.info.render.calls; triangles += host.renderer.info.render.triangles;
      }
      // Low: a slow circle among the flower stems. High: a wider circle looking down.
      const low = stretch.place === 'low';
      angle += dt * (low ? .32 : .2);
      const r = low ? RADIUS : RADIUS * 1.6;
      at.set(CENTER.x + Math.cos(angle) * r, 0, CENTER.z + Math.sin(angle) * r);
      at.y = meadowGroundHeight(at.x, at.z) + (low ? 2.1 : 11);
      // Facing in across the meadow, toward the middle (forward is (-sin yaw, 0, -cos yaw)).
      const yaw = Math.atan2(at.x - CENTER.x, at.z - CENTER.z);
      host.pose(at, yaw, low ? -.12 : -.75);
      readoutAge += dt; readoutFrames++;
      if (readoutAge >= .5) {
        readout.textContent = `Speed check ${index + 1}/${stretches.length} · ${stretch.variant.name} · ${low ? 'among the flowers' : 'high above'} · ${(readoutFrames / readoutAge).toFixed(0)} fps`;
        readoutAge = 0; readoutFrames = 0;
      }
    },
    get done() { return done; },
  };
}
