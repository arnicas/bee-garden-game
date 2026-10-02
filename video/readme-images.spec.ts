import { expect, test, type Page } from '@playwright/test';
import { startFlyingFixture } from '../tests/support/start';

// Retakes the screenshots for the README and the player guide (docs/images/).
// Run: npm run build && npx playwright test -c video/playwright.config.ts video/readme-images.spec.ts
// Shots land in artifacts/readme-images/ at 1280x720; scale them to 800 wide for docs/images/
// (on a Mac: sips -Z 800 -s formatOptions 82 artifacts/readme-images/*.jpg --out docs/images/).
const OUT = 'artifacts/readme-images';
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
const opaque = (page: Page, selector: string) => expect.poll(async () => Number(await page.locator(selector).evaluate(el => getComputedStyle(el).opacity)), { timeout: 15_000 }).toBeGreaterThan(.97);

test('title, results and the next summer', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?test&friends&summers');
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.waitForTimeout(6000);
  await shot(page, 'title');

  // A real homecoming (as in the showcase video), so the results and next summer follow a good day.
  await startFlyingFixture(page);
  await page.evaluate(() => {
    window.__BEE_TEST__!.setDayProgress(.7);
    window.__BEE_TEST__!.setCargo(100, 140, 90);
    window.__BEE_TEST__!.setPollination({ poppy: 4, daisy: 4, cornflower: 5 });
    window.__BEE_TEST__!.setPose([0, 4, 30], Math.PI, 0);
  });
  await page.keyboard.press('r');
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as any).phase).toBe('returning');
  await page.evaluate(() => window.__BEE_TEST__!.setEndingTime(6.4));
  await expect.poll(async () => (await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as any).phase, { timeout: 60_000 }).toBe('won');
  await expect(page.locator('.result-page')).toBeVisible();
  // The homecoming is jumped to, so the play time reads 0m 00s; leave that row out of the picture.
  await page.evaluate(() => { for (const dt of document.querySelectorAll('.result-stats dt')) if (dt.textContent === 'Time in the meadow') (dt.parentElement as HTMLElement).style.display = 'none'; });
  await page.waitForTimeout(2500);
  await shot(page, 'results');

  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect(page.locator('#learning-title')).toHaveText(/^Summer 2 begins/);
  await page.waitForTimeout(2500);
  await shot(page, 'summer-start');
});

test('a bee lore card in the night between summers', async ({ page }) => {
  await page.goto('/?test&friends&summers&nightscene&lore=world-tree');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setState('complete'); window.__BEE_TEST__!.setPollination({ poppy: 4, daisy: 3, cornflower: 3 }); });
  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect(page.locator('.lore-card')).toBeVisible({ timeout: 10_000 });
  await opaque(page, '.lore-card');
  await page.waitForTimeout(400);
  await shot(page, 'lore');
});
