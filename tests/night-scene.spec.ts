import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

/** Finish a summer and press Next summer, with the night scene switched on. */
async function toNight(page: Page) {
  await page.goto('/?test&nightscene');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('complete'));
  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('night');
}

test('the night passes between summers, with the moon crossing the day arc, and can be skipped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await toNight(page);
  await expect(page.locator('.night-caption')).toBeVisible();
  await expect(page.locator('.day-timeline')).toBeVisible();
  await expect(page.locator('[data-text="day-label"]')).toHaveText('NIGHT');
  await expect(page.locator('.status-sidebar')).toBeHidden();
  // A wet night: rain crosses the moon, then the pools fill and mushrooms come up.
  await page.evaluate(() => window.__BEE_TEST__!.setNight('wet'));
  for (const [name, age] of [['dusk', 1.5], ['moonrise', 4.5], ['rain', 9], ['after-rain', 14], ['dawn', 17]] as const) {
    await page.evaluate(a => window.__BEE_TEST__!.setNightAge(a), age);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `artifacts/night-scene/${name}.png` });
    // The moon is up on the arc through the middle of the night, and gone by dawn.
    const moon = Number(await page.locator('[data-day-moon]').getAttribute('opacity'));
    if (name === 'moonrise' || name === 'rain') expect(moon).toBeGreaterThan(.5);
    if (name === 'dawn') expect(moon).toBe(0);
    // Crickets through the dark, hushed in the rain; birds at dawn.
    const sound = (await state(page)).audio.night;
    if (name === 'moonrise') expect(sound.crickets).toBeGreaterThan(.8);
    if (name === 'rain') expect(sound.crickets).toBeLessThan(.4);
    if (name === 'dawn') expect(sound.dawn).toBeGreaterThan(.5);
  }
  expect((await state(page)).mushrooms.up).toBeGreaterThan(0);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('learning');
  await expect(page.locator('.night-caption')).toBeHidden();
  expect((await state(page)).night).toBe('wet');
  await page.screenshot({ path: 'artifacts/night-scene/morning.png' });
  expect(errors).toEqual([]);
});

test('the night ends by itself into the next summer', async ({ page }) => {
  await toNight(page);
  await page.evaluate(() => window.__BEE_TEST__!.setNightAge(17.9));
  await expect.poll(async () => (await state(page)).phase, { timeout: 10000 }).toBe('learning');
  await expect(page.locator('.night-caption')).toBeHidden();
});

test('by night the butterflies roost and a few moths come out round the daisies', async ({ page }) => {
  await toNight(page);
  await page.evaluate(() => window.__BEE_TEST__!.setNight('dry'));
  await page.evaluate(() => window.__BEE_TEST__!.setNightAge(4));
  // Dusk: every butterfly heads for a leaf or the grass and settles there, wings closed.
  await expect.poll(async () => { const b = (await state(page)).butterflies; return b.count > 0 && b.sheltering === b.count; }, { timeout: 12_000 }).toBe(true);
  expect((await state(page)).butterflies.feeding).toBe(0);
  await expect.poll(async () => (await state(page)).moths.out, { timeout: 6_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/night-scene/moths-overhead.png' });
});

test('close up at night: moths loop round a daisy while the butterflies sleep', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__BEE_TEST__!.setSkyClock(1.5));
  await expect.poll(async () => (await state(page)).moths.out, { timeout: 8_000 }).toBeGreaterThan(0);
  const moth = (await state(page)).moths.positions[0] as number[];
  await page.evaluate(m => window.__BEE_TEST__!.setPose([m[0] + 1.1, m[1] + .2, m[2] + 1.1], Math.atan2(1.1, 1.1), -.12), moth);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/night-scene/moths-close.png' });
  // Back to day: the moths go down into the grass, and the butterflies come out again.
  await page.evaluate(() => window.__BEE_TEST__!.setSkyClock(.4));
  await expect.poll(async () => (await state(page)).moths.out, { timeout: 8_000 }).toBe(0);
  await expect.poll(async () => (await state(page)).butterflies.sheltering, { timeout: 15_000 }).toBeLessThan((await state(page)).butterflies.count);
});
