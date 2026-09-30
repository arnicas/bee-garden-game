import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 780 } });
test('on a phone, Take flight shows a gentle note instead of starting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test&mobile');
  const note = page.locator('[data-mobile-note]');
  await expect(note).toBeHidden();
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(note).toBeVisible();
  await expect(note).toContainText('This game isn’t yet supported on mobile devices. Stay tuned!');
  expect(await page.evaluate(() => window.__BEE_TEST__!.snapshot().phase)).toBe('title');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/mobile-note/phone.png' });
  await page.getByRole('button', { name: 'Back to the meadow' }).click();
  await expect(note).toBeHidden();
  expect(errors).toEqual([]);
});
