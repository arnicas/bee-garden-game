import { expect, test, type Page } from '@playwright/test';
import { Vector3 } from 'three';

test.use({ viewport: { width: 1280, height: 720 } });
const snapshot = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

async function fixture(page: Page, pitch: number, height = 1.4) {
  await page.evaluate(({ pitch, height }) => {
    window.__THREE_GAME_TEST_HOOKS__!.setState('windy');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    const wind = window.__BEE_TEST__!.snapshot().wind as number[];
    window.__BEE_TEST__!.setPose([0, height, 3.5], Math.atan2(wind[0], wind[2]), pitch);
    window.__BEE_TEST__!.setCargo(90, 140);
  }, { pitch, height });
  return snapshot(page);
}

async function flyFor(page: Page, keys: string[], seconds: number) {
  const start = await snapshot(page);
  for (const key of keys) await page.keyboard.down(key);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect.poll(async () => (await snapshot(page)).elapsed, { intervals: [40] }).toBeGreaterThan(start.elapsed + seconds);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
  for (const key of keys) await page.keyboard.up(key);
  return snapshot(page);
}

test('W follows the view through the air with full cargo, while strong headwinds can push ground travel back', async ({ page }, testInfo) => {
  await page.goto('/?test');
  const samples = [];
  for (const windTime of [0, 26]) for (const pitch of [-.75, .75]) {
    await fixture(page, pitch, 4.7);
    await page.evaluate(t => window.__BEE_TEST__!.setWindTime(t), windTime);
    const start = await snapshot(page);
    const end = await flyFor(page, ['w'], 2);
    const forward = new Vector3(-Math.sin(start.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(start.yaw) * Math.cos(pitch));
    const travel = new Vector3().fromArray(end.position).sub(new Vector3().fromArray(start.position));
    expect(travel.y * Math.sign(pitch)).toBeGreaterThan(1);
    // Strong headwinds still bend ground travel; thrust must follow the view.
    const airDirection = new Vector3().fromArray(end.velocity).sub(new Vector3().fromArray(end.wind)).normalize();
    expect(airDirection.dot(forward)).toBeGreaterThan(.9);
    if (windTime === 0 || pitch < 0) expect(travel.dot(forward)).toBeGreaterThan(.5);
    else expect(travel.dot(forward)).toBeLessThan(0); // Above the grass, a peak gust can exceed loaded airspeed.
    samples.push({ start, end, forwardProgress: travel.dot(forward), alignment: airDirection.dot(forward) });
  }
  await testInfo.attach('view-directed-flight', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('Space quickly lifts out of an existing dive without releasing W', async ({ page }) => {
  await page.goto('/?test');
  const start = await fixture(page, -.95, 4.7);
  await page.evaluate(start => window.__BEE_TEST__!.setPose(start.position as [number, number, number], start.yaw, start.pitch, [0, -3, 0]), start);
  const end = await flyFor(page, ['w', 'Space'], .8);
  expect(end.position[1] - start.position[1]).toBeGreaterThan(.5);
  expect(end.velocity[1]).toBeGreaterThan(1.5);
});

test('Space and Ctrl retain lift authority while steering, looking steeply, and steadying', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?test');
  const samples = [];
  for (const steady of [false, true]) {
    for (const climb of [true, false]) {
      const start = await fixture(page, climb ? -1.35 : 1.25, climb ? 1.4 : 6.2);
      const keys = ['w', climb ? 'Space' : 'Control'];
      if (steady) keys.push('Shift');
      const end = await flyFor(page, keys, 1.5);
      const altitudeChange = (end.position[1] - start.position[1]) * (climb ? 1 : -1);
      samples.push({ steady, climb, start, end, altitudeChange });
      expect(altitudeChange).toBeGreaterThan(1.2);
    }
  }
  await testInfo.attach('independent-lift', { body: JSON.stringify({ samples, errors }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
