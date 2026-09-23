import { expect, type Page } from '@playwright/test';

// Legacy flight/foraging scenarios begin at the original airborne approach,
// with no visited flowers. The actual flower-first opening is covered by
// welcome.spec.ts; keep this explicit fixture separate from the player flow.
export async function startFlyingFixture(page: Page, keyboard = false) {
  if (keyboard) await page.keyboard.press('Enter');
  else await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start'));
}

// Restart checks still exercise the real new-day state and controls. Once the
// guide is dismissed, a separate Space press is needed to leave the first daisy.
export async function leaveWelcome(page: Page) {
  await page.getByRole('button', { name: 'Explore the meadow', exact: true }).click();
  await page.keyboard.press('Space');
}
