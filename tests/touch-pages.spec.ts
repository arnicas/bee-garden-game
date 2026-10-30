import { expect, test, type Page } from '@playwright/test';

// The end-of-day results and the Queen's Farewell on an iPad in Safari (bars showing): every
// part of each card can be reached, by scrolling if it doesn't fit.
test.use({ viewport: { width: 1180, height: 655 }, hasTouch: true });

async function lastSummerHome(page: Page) {
  await page.goto('/?test&touch&arc=GGGG');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start'));
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(70, 140, 100); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await page.keyboard.press('r');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as { phase: string }).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
}
/** The card's top and bottom can both be brought into view. */
async function reachable(page: Page, card: string, last: string) {
  await page.locator(`${card} ${last}`).first().scrollIntoViewIfNeeded();
  const button = (await page.locator(`${card} ${last}`).first().boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(655);
  const top = page.locator(card).first();
  await top.evaluate(el => el.scrollIntoView({ block: 'start' }));
  expect((await top.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
}

test('the results and the Queen’s Farewell fit or scroll on an iPad', async ({ page }) => {
  await lastSummerHome(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/touch/results.png' });
  await reachable(page, '.result-page', '[data-action="arc-open"]');
  await page.locator('[data-action="arc-open"]').click();
  await expect(page.locator('.arc-page')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/touch/farewell.png' });
  await reachable(page, '.arc-page', '[data-action="restart"]');
  await page.screenshot({ path: 'artifacts/touch/farewell-end.png' });
});
