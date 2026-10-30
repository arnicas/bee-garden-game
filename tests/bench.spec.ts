import { expect, test } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1180, height: 820 } });

test('the speed check flies the route by itself and shows frame rates at three scales', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&bench');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect(page.locator('[data-bench-readout]')).toContainText('fps', { timeout: 10000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'artifacts/bench/low.png' });
  await expect(page.locator('[data-bench-card]')).toBeVisible({ timeout: 120000 });
  const bench = await page.evaluate(() => (window as unknown as { __BEE_BENCH__: { results: { fps: number }[] } }).__BEE_BENCH__);
  expect(bench.results.length).toBeGreaterThanOrEqual(4);
  for (const r of bench.results) expect(r.fps).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/bench/card.png' });
  expect(errors).toEqual([]);
});
