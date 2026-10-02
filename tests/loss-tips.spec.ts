import { expect, test } from '@playwright/test';
import { leaveWelcome, startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
test('after two lost days in a row, the results name the keys that save a bee', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  const tip = page.locator('[data-text="result-tip"]');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('failed'));
  await expect(page.locator('.result-page')).toBeVisible();
  await expect(tip).toBeHidden();
  await page.locator('.result-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('failed'));
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Ctrl drops you into the grass');
  await page.screenshot({ path: 'artifacts/loss-tips/second-loss.png' });
});
