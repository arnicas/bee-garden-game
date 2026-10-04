import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
type V3 = [number, number, number];
const toast = (page: Page) => page.locator('.message-toast');
const ground = (x: number, z: number) => -0.12 + Math.sin(x * 0.17) * Math.cos(z * 0.13) * 0.16 + Math.max(0, Math.hypot(x, z) - 25) * 0.026;

/** Spots a ladybird from just above it, so its first-meeting note goes up. */
async function spotLadybird(page: Page) {
  await page.goto('/?test&friends');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.1); window.__BEE_TEST__!.setPose([0, 4, 0], 0, -.3); });
  await page.waitForTimeout(600);
  const birds = (await page.evaluate(() => window.__BEE_TEST__!.ladybirds())).filter(b => b.perch === 'stem' && Math.hypot(b.position[0], b.position[2]) < 12);
  const bird = birds.sort((a, b) => (b.position[1] - ground(b.position[0], b.position[2])) - (a.position[1] - ground(a.position[0], a.position[2])))[0];
  const q = bird.position, p: V3 = [q[0] + .8, q[1] + 2.2, q[2]];
  const yaw = Math.atan2(-(q[0] - p[0]), -(q[2] - p[2])), pitch = Math.atan2(q[1] - p[1], Math.hypot(q[0] - p[0], q[2] - p[2]));
  await page.evaluate(([p, yaw, pitch]) => window.__BEE_TEST__!.setPose(p as V3, yaw as number, pitch as number), [p, yaw, pitch] as const);
  await expect(toast(page)).toContainText('A ladybird!', { timeout: 5_000 });
}

test('a weather change waits for a first sighting to be read, then has its turn', async ({ page }) => {
  await spotLadybird(page);
  // The cloud starts gathering a moment after the sighting.
  await page.evaluate(() => window.__BEE_TEST__!.setDayProgress(.29));
  await page.waitForTimeout(1200);
  await expect(toast(page)).toContainText('A ladybird!');
  await expect(toast(page)).toContainText('little cloud', { timeout: 6_000 });
});

test('a danger cuts in at once, and the sighting it cut short comes back after', async ({ page }) => {
  await spotLadybird(page);
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, 16));
  await expect(toast(page)).toContainText('Almost out of energy', { timeout: 2_000 });
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(0, 0, 90));
  await expect(toast(page)).toContainText('A ladybird!', { timeout: 12_000 });
});
