import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
const hive = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.hive());
const title = (page: Page) => page.locator('#learning-title');
const hiveLine = (page: Page) => page.locator('[data-text="summer-hive-line"]');

async function openStart(page: Page, arc: string) {
  await page.goto(`/?test&arc${arc ? `=${arc}` : ''}`);
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
}
/** Flies home from the meadow edge with a loaded jar and pouch. */
async function homeLoaded(page: Page) {
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('flight-start'));
  await page.evaluate(() => { window.__BEE_TEST__!.setCargo(70, 140, 100); window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0); });
  await page.keyboard.press('r');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as { phase: string }).phase).toBe('returning');
  await page.keyboard.press('Space');
  await expect(page.locator('.result-page')).toBeVisible();
}

test('the first summer says nothing about the hive, and a day home is added to the run', async ({ page }) => {
  await openStart(page, '');
  await expect(title(page)).toHaveText('Your summer day begins on a flower.');
  await expect(hiveLine(page)).toBeHidden();
  await homeLoaded(page);
  const h = await hive(page);
  expect(h.summers).toBe(1);
  expect(h.outcomes[0]).not.toBe('lost');
  expect(h.stores).toBeGreaterThan(1);
  await expect(page.locator('[data-text="restart-label"]')).toHaveText('Next summer');
});

test('partway through a hard run, the start page names the summer and says the stores are very low', async ({ page }) => {
  await openStart(page, 'LO');
  await expect(title(page)).toHaveText('Summer 3 of 5 begins on a flower.');
  await expect(hiveLine(page)).toContainText('very low');
  await page.screenshot({ path: 'artifacts/arc/summer-3-start.png' });
  expect((await hive(page)).stress).toBeGreaterThan(.5);
});

test('another lost day on very low stores: the colony leaves, and the way on is a new meadow', async ({ page }) => {
  await openStart(page, 'LO');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('failed'));
  await expect(page.locator('.result-page')).toBeVisible();
  expect((await hive(page)).ending).toBe('absconded');
  await expect(page.locator('[data-text="result-next"]')).toContainText('gone to find a better place');
  // The results lead on to the summers so far, and from there to a new meadow.
  await page.locator('[data-action="arc-open"]').click();
  await expect(page.locator('.arc-page')).toBeVisible();
  await expect(page.locator('[data-text="arc-title"]')).toHaveText('The Queen’s Farewell');
  await expect(page.locator('[data-text="arc-outcome"]')).toHaveText('The colony moves on');
  await expect(page.locator('.arc-summer')).toHaveCount(3);
  await expect(page.locator('.arc-garland-sad').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/arc/farewell-sad.png' });
  await page.locator('.arc-page [data-action="restart"]').click();
  await expect(title(page)).toHaveText('Your summer day begins on a flower.');
  expect(await hive(page)).toMatchObject({ summers: 0, ending: null });
});

test('the fifth summer is the last before winter; good stores see the colony through', async ({ page }) => {
  await openStart(page, 'GGGG');
  await expect(title(page)).toHaveText('Summer 5 of 5 begins on a flower.');
  await expect(hiveLine(page)).toContainText('her last');
  await homeLoaded(page);
  expect((await hive(page)).ending).toBe('wintered');
  await expect(page.locator('[data-text="result-next"]')).toContainText('it will swarm');
  // The five summers, summed up.
  await expect(page.locator('.result-page [data-action="restart"]')).toBeHidden();
  await page.locator('[data-action="arc-open"]').click();
  const arc = page.locator('.arc-page');
  await expect(arc).toBeVisible();
  await expect(page.locator('[data-text="arc-title"]')).toHaveText('The Queen’s Farewell');
  await expect(page.locator('[data-text="arc-outcome"]')).toHaveText('A swarm in spring');
  await expect(arc).toHaveAttribute('data-mood', 'happy');
  await expect(page.locator('.arc-summer')).toHaveCount(5);
  await expect(page.locator('.arc-summer[data-tone="bright"]')).toHaveCount(4);
  expect(await page.locator('.arc-mark[data-mark="honey"]').count()).toBeGreaterThan(0);
  await expect(page.locator('.arc-garland-happy').first()).toBeVisible();
  // Her speech: who she is, the weather, the meadow, the hive, and her farewell.
  await expect(page.locator('.arc-speech p')).toHaveCount(5);
  await expect(page.locator('.arc-speech p').first()).toContainText('about six weeks');
  await expect(page.locator('.arc-speech p').last()).toContainText('we will swarm');
  await expect(page.locator('[data-text="arc-facts"]')).toContainText('two to five years');
  await page.screenshot({ path: 'artifacts/arc/five-summers.png' });
  await expect(arc.locator('[data-action="restart"]')).toHaveText(/A new meadow/);
});
