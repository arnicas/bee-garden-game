import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const URL = '/?test&arc&save&summers';
const hive = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.hive());
const saved = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.savedRun()) as Promise<{ summer: number; won: boolean } | null>;

async function freshTitle(page: Page) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}
async function homeLoaded(page: Page) {
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start'));
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(70, 140, 100); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await page.keyboard.press('r');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as { phase: string }).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
}

test('a finished summer is saved, and the title offers to continue with the next one', async ({ page }) => {
  await freshTitle(page);
  await expect(page.locator('.continue-button')).toBeHidden();
  await expect(page.locator('[data-text="start-label"]')).toHaveText('Take flight');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
  await homeLoaded(page);
  expect(await saved(page)).toMatchObject({ summer: 1, won: true });

  // Close and come back: the run picks up at summer 2, with summer 1 still counted.
  await page.reload();
  const resume = page.locator('.continue-button');
  await expect(resume).toBeVisible();
  await expect(resume).toHaveText(/Continue with Summer 2/);
  await expect(page.locator('[data-text="start-label"]')).toHaveText('A new meadow');
  await page.screenshot({ path: 'artifacts/arc/continue-title.png' });
  await resume.click();
  await expect(page.locator('#learning-title')).toHaveText('Summer 2 of 5 begins on a flower.');
  expect(await hive(page)).toMatchObject({ summers: 1, ending: null });
  // The start page compares with last summer's meadow, as after "Next summer".
  await expect(page.locator('.learning-summer')).toBeVisible();
});

test('a lost day is saved too, and "A new meadow" on the title lets the saved run go', async ({ page }) => {
  await freshTitle(page);
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('failed'));
  await expect(page.locator('.result-page')).toBeVisible();
  expect(await saved(page)).toMatchObject({ summer: 1, won: false });
  await page.reload();
  await expect(page.locator('.continue-button')).toHaveText(/Continue with Summer 2/);
  await page.locator('.title-screen [data-action="start"]').click();
  await expect(page.locator('.learning-page')).toBeVisible();
  expect(await saved(page)).toBeNull();
  await expect(page.locator('#learning-title')).toHaveText('Your summer day begins on a flower.');
});
