import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

for (const [id, species] of [[0, 'daisy'], [1, 'poppy'], [2, 'cornflower']] as const) {
  test(`Bee Vision remembers ${species} landings while allowing revisits and fresh trips`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await mkdir('artifacts/bee-vision-1', { recursive: true });
    await page.goto('/?test');
    await startFlyingFixture(page);
    await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
    await page.evaluate(() => {
      window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
      window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    });
    const approach = async (flowerId: number) => {
      await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), flowerId);
      await expect.poll(async () => (await state(page)).target).toBe(flowerId);
      await expect.poll(async () => (await state(page)).canLand).toBe(true);
    };
    const marker = page.locator('.target-marker');
    const aim = page.locator('.aim');
    const vision = page.getByRole('button', { name: 'Toggle bee vision' });
    await approach(id);
    await page.keyboard.press('q');
    await expect(vision).toHaveAttribute('aria-pressed', 'true');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveText('E');
    await expect(aim).toHaveClass(/can-land/);
    await page.screenshot({ path: `artifacts/bee-vision-1/${species}-fresh.png` });

    // First contact counts, even without gathering anything or pollinating.
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).landed).toBe(id);
    expect((await state(page)).visited).toBe(1);
    expect((await state(page)).pollinated).toBe(0);
    expect((await state(page)).pollen).toBe(0);
    await expect(marker).toBeHidden(); // E is a flight landing cue, not a nectar ring.
    await page.screenshot({ path: `artifacts/bee-vision-1/${species}-perched.png` });
    await page.keyboard.press('Space');
    await approach(id);
    await expect(marker).toBeHidden();
    await expect(aim).not.toHaveClass(/can-land/);
    await expect(page.locator('[data-text="interaction"]')).toHaveText('');
    await expect(page.locator('[data-text="hint"]')).toHaveText('Already visited · E to revisit');
    // Let the camera's post-landing FOV settle for the matching visual capture.
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `artifacts/bee-vision-1/${species}-visited.png` });

    await page.keyboard.press('q');
    await expect(vision).toHaveAttribute('aria-pressed', 'false');
    await expect(marker).toBeVisible();
    await expect(aim).toHaveClass(/can-land/);
    await page.keyboard.press('q');
    await expect(marker).toBeHidden();
    // Another bloom must retain its own recommendation.
    await approach((id + 1) % 3);
    await expect(marker).toBeVisible();
    await expect(aim).toHaveClass(/can-land/);

    // Distance/detail changes and pause do not forget the visit.
    await page.evaluate(() => window.__BEE_TEST__!.setPose([34, 4, 0]));
    await expect.poll(async () => (await state(page)).target).toBeUndefined();
    await approach(id);
    await expect(marker).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
    await expect(marker).toBeHidden();
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).landed).toBe(id);
    expect((await state(page)).visited).toBe(1);
    await expect(marker).toBeHidden();

    await page.keyboard.press('Escape');
    await page.locator('.pause-page [data-action="restart"]').click();
    await leaveWelcome(page);
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true));
    expect((await state(page)).visited).toBe(1); // Starting daisy is already visited.
    await approach(id);
    await page.keyboard.press('q');
    await expect(vision).toHaveAttribute('aria-pressed', 'true');
    if (id === 0) {
      await expect(marker).toBeHidden();
      await expect(aim).not.toHaveClass(/can-land/);
    } else {
      await expect(marker).toBeVisible();
      await expect(aim).toHaveClass(/can-land/);
    }
    expect(errors).toEqual([]);
  });
}
