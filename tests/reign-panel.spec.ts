import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const URL = '/?test&choose&arc&save';
const chosen = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.weatherChoice());
const preset = (page: Page, name: string) => page.locator('.reign-preset').filter({ hasText: name });

async function fresh(page: Page) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test('a new meadow opens "Your five summers": the arc, then the weather for the reign', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Your five summers' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Five summers are one queen’s reign');
  await expect(preset(page, 'As nature decides')).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: 'artifacts/arc/reign-panel.png' });

  // A named combination sets both rows.
  await preset(page, 'Hot and dry').click();
  expect(await chosen(page)).toEqual({ rain: 'little', heat: 'hot' });
  await expect(page.locator('[data-text="reign-forecast"]')).toContainText('Water is scarce');
  // The rain and heat rows stay hidden unless "Mix your own" is chosen.
  await expect(page.locator('.reign-mixer')).toBeHidden();
  await preset(page, 'Mix your own').click();
  await expect(page.locator('.reign-mixer')).toBeVisible();
  await expect(preset(page, 'Mix your own')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-action="reign-rain"][data-value="little"]')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'artifacts/arc/reign-panel-mix.png' });
  await page.locator('[data-action="reign-rain"][data-value="lots"]').click();
  await page.locator('[data-action="reign-heat"][data-value="nature"]').click();
  await expect(preset(page, 'Mix your own')).toHaveAttribute('aria-checked', 'true');
  expect(await chosen(page)).toEqual({ rain: 'lots', heat: 'nature' });
  await expect(page.locator('[data-text="reign-forecast"]')).toContainText('heat as nature decides');

  // Begin: the first summer, with the ground nudged damp for a lot of rain.
  await page.locator('[data-action="reign-begin"]').click();
  await expect(page.locator('.learning-page')).toBeVisible();
  const snap = await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as { moisture: number };
  expect(snap.moisture).toBeCloseTo(.65);
});

test('the choice is remembered, Back returns to the title, and a saved run keeps its weather', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await preset(page, 'Wet and cool').click();
  await page.locator('[data-action="reign-back"]').click();
  await expect(page.getByRole('dialog', { name: 'Your five summers' })).toBeHidden();
  await expect(page.locator('.title-screen [data-action="start"]')).toBeVisible();
  await page.reload();
  expect(await chosen(page)).toEqual({ rain: 'lots', heat: 'cool' });
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(preset(page, 'Wet and cool')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.learning-page')).toBeVisible();
  // End the first summer (lost), then change the remembered choice: Continue keeps the run's own.
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('failed'));
  await expect(page.locator('.result-page')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('bee-garden-weather', JSON.stringify({ rain: 'little', heat: 'hot' })));
  await page.reload();
  await page.locator('.continue-button').click();
  expect(await chosen(page)).toEqual({ rain: 'lots', heat: 'cool' });
});
