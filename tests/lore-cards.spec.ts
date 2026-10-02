import { startFlyingFixture } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

async function land(page: Page, query: string) {
  await page.goto(`/?test&${query}`);
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__BEE_TEST__!.setDayProgress(.1); window.__BEE_TEST__!.setCargo(30, 5, 45); });
  await page.evaluate(() => window.__BEE_TEST__!.approachFlower(0));
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).phase).toBe('landed');
}

for (const [id, kind, words] of [['tears-of-ra', 'belief', 'Ra wept'], ['king-bee', 'thought', 'a king ruled'], ['prairie', 'verse', 'To make a prairie']] as const) {
  test(`a rest shows the ${kind} card low in the middle of the view, then lets it go`, async ({ page }) => {
    await mkdir('artifacts/lore-cards', { recursive: true });
    await land(page, `lore=${id}`);
    await expect(page.locator('.lore-card')).toBeHidden();
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).resting).toBe(true);
    const card = page.locator(`.lore-card.lore-${kind}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(words);
    await expect.poll(async () => Number(await card.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(.95);
    await page.screenshot({ path: `artifacts/lore-cards/${kind}.png` });
    await card.screenshot({ path: `artifacts/lore-cards/${kind}-card.png` });
    // Centred low over the view, above the hint line at the bottom.
    const box = (await card.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(12);
    expect(box.y).toBeGreaterThan(720 * .5);
    expect(box.y + box.height).toBeLessThan(720 - 80);
    await expect.poll(async () => (await state(page)).resting, { timeout: 12_000 }).toBe(false);
    await expect(card).toBeHidden();
  });
}

test('later rests show cards only now and then, and the menu can turn them off', async ({ page }) => {
  await land(page, 'lore');
  await page.keyboard.press('e');
  await expect(page.locator('.lore-card')).toBeVisible();
  const first = (await state(page)).lore.card;
  await expect.poll(async () => (await state(page)).resting, { timeout: 12_000 }).toBe(false);
  await expect(page.locator('.lore-card')).toBeHidden();
  await page.keyboard.press('Escape');
  const toggle = page.locator('[data-action="lore"]');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText('Off');
  expect(await page.evaluate(() => localStorage.getItem('bee-garden-lore'))).toBe('off');
  await page.getByRole('button', { name: 'Back to the breeze' }).click();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).resting).toBe(true);
    await page.waitForTimeout(2200);
    await expect(page.locator('.lore-card')).toBeHidden();
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).resting).toBe(false);
  }
  expect((await state(page)).lore.seen).toEqual([first]);
});

test('the quiet overhead view stays clear for a while before a card appears', async ({ page }) => {
  test.setTimeout(60_000);
  await land(page, 'lore=busy-bee');
  await page.evaluate(() => window.__BEE_TEST__!.setQuietTime(60));
  await expect.poll(async () => (await state(page)).restView.blend, { timeout: 15_000 }).toBe(1);
  await page.waitForTimeout(6000);
  await expect(page.locator('.lore-card')).toBeHidden();
  await expect(page.locator('.lore-card.lore-verse'), ).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.lore-card')).toContainText('busy bee');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/lore-cards/overhead.png' });
  await expect(page.locator('.lore-card')).toBeHidden({ timeout: 15_000 });
  expect((await state(page)).lore.scenicUsed).toBe(true);
});

test('the night between summers shows one card above "The night passes", gone before dawn', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?test&nightscene&lore=world-tree');
  await startFlyingFixture(page);
  await page.evaluate(() => { window.__THREE_GAME_TEST_HOOKS__!.setState('complete'); window.__BEE_TEST__!.setPollination({ poppy: 4, daisy: 3, cornflower: 3 }); });
  await page.getByRole('button', { name: 'Next summer' }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('night');
  const card = page.locator('.lore-card.lore-belief');
  await expect(card).toBeHidden();
  await expect(card).toBeVisible({ timeout: 8_000 });
  await expect(card).toContainText('great ash tree');
  await expect(page.locator('.night-caption')).toBeVisible();
  await expect.poll(async () => Number(await card.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(.95);
  const box = (await card.boundingBox())!, caption = (await page.locator('.night-caption').boundingBox())!;
  expect(box.y + box.height).toBeLessThan(caption.y);
  await page.screenshot({ path: 'artifacts/lore-cards/night.png' });
  await page.evaluate(() => window.__BEE_TEST__!.setNightAge(16.2));
  await expect(card).toBeHidden({ timeout: 4_000 });
  expect((await state(page)).phase).toBe('night');
});
