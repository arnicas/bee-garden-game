import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFlyingFixture, leaveWelcome } from './support/start';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const freeze = (page: Page, value: boolean) => page.evaluate(value => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(value), value);
const sample = (page: Page) => page.evaluate(() => {
  const sun = document.querySelector<SVGGElement>('[data-day-sun]')!.transform.baseVal.consolidate()!.matrix;
  const cloud = document.querySelector<SVGGElement>('[data-day-cloud]')!;
  const state = window.__BEE_TEST__!.snapshot() as Record<string, any>;
  return { x: sun.e, size: sun.a, cloudX: cloud.transform.baseVal.consolidate()!.matrix.e,
    cloud: Number(cloud.getAttribute('opacity')), drops: document.querySelector('.day-timeline')!.getAttribute('data-rain-drops'),
    weather: state.weather, day: state.dayProgress, renderer: state.diagnostics.renderer };
});

test('the daylight strip grows toward noon and reveals only current rain, then leaves the cloud behind', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await mkdir('artifacts/day-timeline-1', { recursive: true });
  await page.goto('/?test');
  await expect(page.locator('.day-timeline')).toBeHidden();
  await startFlyingFixture(page);
  await freeze(page, true);
  await expect(page.locator('.objective-copy')).toHaveCount(0);
  await expect(page.locator('.objective')).toBeHidden();
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 5.6, 3.5], 0, -.14));
  const samples: Record<string, Awaited<ReturnType<typeof sample>>> = {};
  for (const [name, day] of [['morning', .08], ['approaching', .29], ['first-rain', .31], ['shower', .35], ['easing', .415], ['dry-again', .432], ['noon', .5], ['late', .86]] as const) {
    await page.evaluate(day => window.__BEE_TEST__!.setDayProgress(day), day);
    await expect.poll(async () => (await sample(page)).day).toBeCloseTo(day, 4);
    samples[name] = await sample(page);
    await page.screenshot({ path: `artifacts/day-timeline-1/${name}.png` });
    await page.locator('.day-timeline').screenshot({ path: `artifacts/day-timeline-1/${name}-strip.png` });
  }
  for (const name of ['morning', 'approaching', 'noon', 'late']) {
    expect(samples[name].cloud).toBe(0);
    expect(samples[name].drops).toBe('0');
  }
  expect(samples.approaching.weather.cloudiness).toBeGreaterThan(0);
  for (const name of ['first-rain', 'shower', 'easing']) {
    expect(samples[name].weather.rain).toBeGreaterThan(0);
    expect(samples[name].cloud).toBeGreaterThan(.8);
    expect(Number(samples[name].drops)).toBeGreaterThan(0);
  }
  expect(samples.shower.cloudX).toBe(samples.shower.x);
  expect(samples.easing.cloudX).toBeLessThan(samples.easing.x - 30);
  expect(samples['dry-again'].weather.rain).toBe(0);
  expect(samples['dry-again'].weather.cloudiness).toBeGreaterThan(0);
  expect(samples['dry-again'].drops).toBe('0');
  expect(samples['dry-again'].x - samples['dry-again'].cloudX).toBeCloseTo(62);
  const values = Object.values(samples);
  for (let i = 1; i < values.length; i++) expect(values[i].x).toBeGreaterThan(values[i - 1].x);
  expect(samples.noon.size).toBeGreaterThan(samples.morning.size * 1.3);
  expect(samples.noon.size).toBeGreaterThan(samples.late.size * 1.2);
  // Daylight and weather can change scene draws; retain the existing scene
  // budget rather than claiming identical counts across different conditions.
  for (const value of values) expect(value.renderer.calls).toBeLessThan(300);

  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: width === 1024 ? 600 : 720 });
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('pollinated'));
    await freeze(page, true);
    await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
    const clock = (await page.locator('.day-timeline').boundingBox())!;
    const heading = (await page.locator('.game-heading').boundingBox())!;
    const actions = (await page.locator('.top-actions').boundingBox())!;
    const toast = (await page.locator('.pollination-toast').boundingBox())!;
    expect(clock.x).toBeGreaterThan(heading.x + heading.width);
    expect(clock.x + clock.width).toBeLessThan(actions.x);
    expect(clock.y + clock.height).toBeLessThan(toast.y);
    expect(clock.height).toBeLessThanOrEqual(116);
    await page.screenshot({ path: `artifacts/day-timeline-1/rain-and-pollination-${width}.png` });
  }
  expect(errors).toEqual([]);
  await writeFile('artifacts/day-timeline-1/stages.json', JSON.stringify({ samples, errors }, null, 2));
});

test('the shelter clock survives quiet rest, tells actual drying apart from cloud cover, and freezes with pause', async ({ page }) => {
  await mkdir('artifacts/day-timeline-1', { recursive: true });
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.35); window.__BEE_TEST__!.approachShelter(0); });
  await expect.poll(() => page.evaluate(() => (window.__BEE_TEST__!.snapshot() as any).canLand)).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => (window.__BEE_TEST__!.snapshot() as any).underLeaf)).toBe(0);
  await freeze(page, true);
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(0, 0, 95); window.__BEE_TEST__!.setQuietTime(12); });
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '0');
  await expect(page.locator('.day-timeline')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/day-timeline-1/quiet-shelter-rain.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.432));
  await expect(page.locator('[data-text="weather"]')).toHaveText('Dry again');
  await expect(page.locator('.day-timeline')).toHaveAttribute('data-rain-drops', '0');
  await page.screenshot({ path: 'artifacts/day-timeline-1/quiet-shelter-dry.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.48));
  await expect(page.locator('.day-timeline')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-day-cloud]')).toHaveAttribute('opacity', '0.000');
  await page.keyboard.press('e'); // Wake gesture, consumed before ordinary input.
  await expect(page.locator('.game-heading')).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.35));
  const drops = page.locator('[data-day-rain]');
  const still = await drops.getAttribute('stroke-dashoffset');
  await freeze(page, false);
  await expect.poll(() => drops.getAttribute('stroke-dashoffset')).not.toBe(still);
  await page.keyboard.press('Escape');
  const held = await sample(page);
  const heldDrops = await drops.getAttribute('stroke-dashoffset');
  await page.waitForTimeout(250);
  expect(await sample(page)).toEqual(held);
  expect(await drops.getAttribute('stroke-dashoffset')).toBe(heldDrops);
  await expect(page.locator('.day-timeline')).toBeHidden();
  await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));
  await expect(drops).toHaveAttribute('stroke-dashoffset', '0');
  await page.waitForTimeout(200);
  await expect(drops).toHaveAttribute('stroke-dashoffset', '0');
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await expect(page.locator('.day-timeline')).toBeHidden();
  await leaveWelcome(page);
  await expect(page.locator('[data-day-cloud]')).toHaveAttribute('opacity', '0.000');
  await expect(page.locator('.day-timeline')).toHaveAttribute('data-rain-drops', '0');
});
