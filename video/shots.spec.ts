import { expect, test, type Page } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import { startFlyingFixture } from '../tests/support/start';

// Each shot is captured frame by frame at 30 fps: the game advances exactly
// 1/30 s per frame (captureFrame), however long each frame takes to render.
// Frames land in video/out/frames/<shot>/; video/assemble.sh makes the film.
// Pick shots with SHOTS=title,flight (default: all).

type V3 = [number, number, number];
const FPS = 30;
const OUT = 'video/out/frames';
const only = (process.env.SHOTS ?? '').split(',').filter(Boolean);
const wanted = (name: string) => !only.length || only.includes(name);

const hooks = (page: Page) => ({
  frame: (dt = 1 / FPS) => page.evaluate(d => window.__BEE_TEST__!.captureFrame(d), dt),
  hud: (on: boolean) => page.evaluate(v => window.__BEE_TEST__!.setHud(v), on),
  pose: (p: V3, yaw: number, pitch: number, v: V3 = [0, 0, 0]) => page.evaluate(([p, yaw, pitch, v]) => window.__BEE_TEST__!.setPose(p as V3, yaw as number, pitch as number, v as V3), [p, yaw, pitch, v] as const),
  state: () => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>,
});

/** Runs frames without saving them, so a cut starts settled. */
async function settle(page: Page, frames: number, each?: (i: number) => Promise<unknown>) {
  const h = hooks(page);
  for (let i = 0; i < frames; i++) { if (each) await each(i); await h.frame(); }
}

async function shoot(page: Page, name: string, frames: number, each?: (i: number, t: number) => Promise<unknown>, dt = 1 / FPS) {
  const dir = `${OUT}/${name}`;
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const h = hooks(page);
  for (let i = 0; i < frames; i++) {
    if (each) await each(i, i / Math.max(1, frames - 1));
    await h.frame(dt);
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
  }
}

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Yaw and pitch for the bee's camera to look from p at q. */
const aim = (p: V3, q: readonly number[]) => {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
/** A slow drift past a subject: from a to b while looking at it. */
const drift = (page: Page, a: V3, b: V3, at: readonly number[]) => async (_: number, t: number) => {
  const p = lerp3(a, b, ease(t)), { yaw, pitch } = aim(p, at);
  await hooks(page).pose(p, yaw, pitch);
};

async function openGame(page: Page, extra = '') {
  await page.goto(`/?test&friends&summers${extra}`);
  await expect(page.locator('.title-screen')).toBeVisible();
}

test('showcase shots', async ({ page }) => {
  const h = hooks(page);
  await openGame(page);

  if (wanted('title')) {
    await h.hud(false);
    await settle(page, 20);
    await shoot(page, 'title', 4.5 * FPS);
  }
  await h.hud(true);
  await page.evaluate(() => window.__BEE_TEST__!.endCapture());
  await startFlyingFixture(page);
  await h.hud(false);
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.14));
  const flowers = await page.evaluate(() => window.__BEE_TEST__!.flowers());
  const poppies = flowers.filter(f => f.species === 'poppy').sort((a, b) => Math.hypot(a.center[0], a.center[2] + 6) - Math.hypot(b.center[0], b.center[2] + 6));
  const poppy = poppies[0];

  if (wanted('flight')) {
    // Low over the meadow toward a poppy.
    const c = poppy.center as V3;
    const from: V3 = [c[0] + 2.2, c[1] + 1.5, c[2] + 9], to: V3 = [c[0] + .3, c[1] + 1.05, c[2] + 2.1];
    const at = (t: number): V3 => lerp3(from, to, ease(t));
    const frames = 4 * FPS;
    await settle(page, 15, async () => { const { yaw, pitch } = aim(from, c); await h.pose(from, yaw, pitch); });
    await shoot(page, 'flight', frames, async (i, t) => {
      const p = at(t), next = at(Math.min(1, t + 1 / frames));
      const { yaw, pitch } = aim(p, [c[0], c[1] + .2, c[2]]);
      await h.pose(p, yaw, pitch, [(next[0] - p[0]) * FPS, (next[1] - p[1]) * FPS, (next[2] - p[2]) * FPS]);
    });
  }

  if (wanted('poppy')) {
    // Land in the poppy and walk through its anthers, with the interface showing.
    await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), poppy.id);
    await settle(page, 30);
    await expect.poll(async () => (await h.state()).canLand).toBe(true);
    await h.hud(true);
    await page.keyboard.press('e');
    await settle(page, 25);
    await page.keyboard.down('w');
    await shoot(page, 'poppy', 4 * FPS, async i => { if (i === 30) await page.keyboard.up('w'); });
    await h.hud(false);
    await page.keyboard.press('Space');
    await settle(page, 20);
  }

  if (wanted('rain')) {
    // Under a broad leaf in the shower.
    await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.36));
    await settle(page, 30);
    for (let i = 0; i < 40 && (await h.state()).weather.rain < .6; i++) await settle(page, 15);
    const other = poppies[1].center;
    const a: V3 = [other[0] + 2.6, other[1] + .5, other[2] + 3.4], b: V3 = [other[0] + 1.3, other[1] + .35, other[2] + 2.3];
    const look = [other[0] - .6, other[1] - .1, other[2] - 1.5];
    await settle(page, 10, drift(page, a, a, look).bind(null, 0, 0));
    await shoot(page, 'rain', 4 * FPS, drift(page, a, b, look));
  }

  if (wanted('finds')) {
    // After a wet night: mushrooms up, pools full. Three quick sightings.
    await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.2); window.__BEE_TEST__!.setNight('wet'); });
    await settle(page, 30);
    const ladybird = (await page.evaluate(() => window.__BEE_TEST__!.ladybirds())).find(l => l.perch !== 'leaf') ?? (await page.evaluate(() => window.__BEE_TEST__!.ladybirds()))[0];
    const lb = ladybird.position, up = ladybird.up;
    const side = (k: number, lift: number, slide: number): V3 => [lb[0] + up[0] * k + slide, lb[1] + up[1] * k + lift, lb[2] + up[2] * k + slide * .5];
    await settle(page, 10, drift(page, side(.3, .05, .06), side(.3, .05, .06), lb).bind(null, 0, 0));
    await shoot(page, 'find-ladybird', 1.6 * FPS, drift(page, side(.3, .05, .06), side(.24, .04, -.04), lb));
    const snails = await page.evaluate(() => window.__BEE_TEST__!.snails());
    const snail = snails.find(s => s.perch === 'ground' || s.perch === 'rim') ?? snails[0];
    const sn = snail.position;
    await settle(page, 10, drift(page, [sn[0] + .5, sn[1] + .25, sn[2] + .3], [sn[0] + .5, sn[1] + .25, sn[2] + .3], sn).bind(null, 0, 0));
    await shoot(page, 'find-snail', 1.6 * FPS, drift(page, [sn[0] + .5, sn[1] + .25, sn[2] + .3], [sn[0] + .32, sn[1] + .22, sn[2] + .48], sn));
    // A caterpillar eating into a leaf edge, seen from just above the leaf.
    const cat = (await page.evaluate(() => window.__BEE_TEST__!.caterpillars()))[0].position;
    const ca: V3 = [cat[0] + .3, cat[1] + .55, cat[2] + .3], cb: V3 = [cat[0] + .18, cat[1] + .45, cat[2] + .36];
    await settle(page, 10, drift(page, ca, ca, cat).bind(null, 0, 0));
    await shoot(page, 'find-ring', 2 * FPS, drift(page, ca, cb, cat));
  }

  if (wanted('home')) {
    // The flight home, from the approach to the hive with its dancing bees.
    await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.7); window.__BEE_TEST__!.setCargo(100, 140, 90); window.__BEE_TEST__!.setPollination({ poppy: 4, daisy: 4, cornflower: 5 }); });
    await h.pose([0, 4, 30], Math.PI, 0);
    await settle(page, 5, () => h.pose([0, 4, 30], Math.PI, 0));
    await page.keyboard.press('r');
    await settle(page, 5);
    await expect.poll(async () => (await h.state()).phase).toBe('returning');
    await page.evaluate(() => window.__BEE_TEST__!.setEndingTime(6.4));
    await settle(page, 3);
    await shoot(page, 'home', 3.8 * FPS);
  }

  if (wanted('results')) {
    // The day's results, then the Bee and Meadow Facts.
    for (let i = 0; i < 80 && (await h.state()).phase !== 'won'; i++) await settle(page, 5);
    await h.hud(true);
    // The interface is sized for play; zoom it so the cards fill the frame.
    await page.evaluate(() => { document.getElementById('ui')!.style.zoom = '1.4'; });
    await settle(page, 45);
    await shoot(page, 'results', 3.5 * FPS);
    await page.getByRole('button', { name: /Bee and Meadow Facts/ }).last().click();
    // The facts dialog is taller: a little less zoom leaves room for the caption.
    await page.evaluate(() => { document.getElementById('ui')!.style.zoom = '1.2'; });
    await settle(page, 30);
    await shoot(page, 'facts', 4 * FPS, async i => { if (i === 55) await page.locator('[data-fact-index]').nth(3).click(); });
    await page.evaluate(() => { document.getElementById('ui')!.style.zoom = ''; });
  }
});

test('showcase night', async ({ page }) => {
  test.skip(!wanted('night') && !wanted('summer'), 'not requested');
  const h = hooks(page);
  await openGame(page, '&nightscene');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setState('complete'); window.__BEE_TEST__!.setPollination({ poppy: 5, daisy: 3, cornflower: 4 }); });
  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect.poll(async () => (await h.state()).phase).toBe('night');
  await page.evaluate(() => window.__BEE_TEST__!.setNight('wet'));
  await h.hud(false);
  // The whole 18 s night, played three and a half times faster.
  await shoot(page, 'night', 5 * FPS, undefined, 17.6 / (5 * FPS));
  for (let i = 0; i < 60 && (await h.state()).phase === 'night'; i++) await settle(page, 5);
  // Next morning: out over the new meadow, in the dew.
  await h.hud(true);
  await page.evaluate(() => window.__BEE_TEST__!.endCapture());
  await page.getByRole('button', { name: 'Explore the meadow', exact: true }).click();
  await h.hud(false);
  await settle(page, 20);
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(60));
  await settle(page, 30);
  await shoot(page, 'idle', 7 * FPS);
  // Space first wakes the quiet view, then takes off.
  for (let i = 0; i < 6 && (await h.state()).phase !== 'flying'; i++) { await page.keyboard.press('Space'); await settle(page, 40); }
  const look = [0, 3.4, -9];
  const ma: V3 = [-4.5, 5.6, 9], mb: V3 = [2.5, 5.1, 7];
  await settle(page, 20, drift(page, ma, ma, look).bind(null, 0, 0));
  await shoot(page, 'summer', 4 * FPS, drift(page, ma, mb, look));
});
