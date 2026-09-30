import { expect, test } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
test('landing on an emptied flower points to Bee Vision', async ({ page }) => {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setSupply(1, 0, 0); window.__BEE_TEST__!.approachFlower(1); });
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.snapshot().canLand)).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => window.__BEE_TEST__!.snapshot().landed)).toBe(1);
  await expect(page.locator('[data-text="message-lead"]')).toHaveText('This flower is empty.');
  await expect(page.locator('[data-text="message-body"]')).toHaveText('Turn on Bee Vision (Q) to see the flowers that still have pollen or nectar.');
});
