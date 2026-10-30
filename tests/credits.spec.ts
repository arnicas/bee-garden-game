import { expect, test } from '@playwright/test';
import { startFlyingFixture } from './support/start';

test.use({ viewport: { width: 1280, height: 720 } });
test('the title page and the field guide credit the maker and link to the code', async ({ page }) => {
  await page.goto('/?test');
  const title = page.locator('.title-footer .credits');
  await expect(title).toBeVisible();
  await expect(title).toContainText('Made by Lynn Cherny/@arnicas');
  await expect(title.getByRole('link', { name: 'Lynn Cherny/@arnicas' })).toHaveAttribute('href', 'https://ghostweather.com');
  await expect(title.getByRole('link', { name: 'Code on GitHub' })).toHaveAttribute('href', 'https://github.com/arnicas/bee-garden-game');
  await page.screenshot({ path: 'artifacts/credits/title.png' });
  await startFlyingFixture(page);
  await expect(title).toBeHidden();
  await page.keyboard.press('Escape');
  const guide = page.locator('.guide-credits');
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('link', { name: 'Code on GitHub' })).toHaveAttribute('href', 'https://github.com/arnicas/bee-garden-game');
  await page.screenshot({ path: 'artifacts/credits/field-guide.png' });
});
