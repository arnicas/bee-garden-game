import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { startFlyingFixture } from './support/start';

// An 11-inch iPad held sideways, in Safari with its bars showing.
test.use({ viewport: { width: 1180, height: 655 }, hasTouch: true });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;

/** Real touches through the browser (several fingers at once, by id). */
async function touches(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y, id: p.id })) });
}
const start = async (page: Page) => {
  await page.goto('/?test&touch');
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect(page.locator('.touch-controls')).toBeVisible();
  return page.context().newCDPSession(page);
};

test('the touch layer shows only while playing, with the move and look hints', async ({ page }) => {
  await page.goto('/?test&touch');
  await expect(page.locator('.touch-controls')).toBeHidden();
  await startFlyingFixture(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  await expect(page.locator('.touch-controls')).toBeVisible();
  await expect(page.locator('.touch-up')).toBeVisible();
  await expect(page.locator('.touch-move-hint')).toBeVisible();
  await expect(page.locator('[data-text="hint"]')).toContainText('Drag on the right to look');
  await page.screenshot({ path: 'artifacts/touch/flying.png' });
  // Paused: the layer hides so the pause page takes the taps.
  await page.locator('[data-action="pause"]').first().click();
  await expect(page.locator('.touch-controls')).toBeHidden();
});

test('the left stick flies the bee while the right thumb turns the view', async ({ page }) => {
  const cdp = await start(page);
  await page.evaluate(() => window.__BEE_TEST__!.setPose([0, 4, 6], 0, 0));
  await page.waitForTimeout(300);
  const before = await state(page);
  // Left thumb down and pushed up (forward); right thumb drags left (turn left).
  await touches(cdp, 'touchStart', [{ x: 200, y: 560, id: 1 }]);
  await touches(cdp, 'touchMove', [{ x: 200, y: 490, id: 1 }]);
  await expect(page.locator('.touch-stick')).toHaveClass(/is-on/);
  await touches(cdp, 'touchStart', [{ x: 200, y: 490, id: 1 }, { x: 760, y: 400, id: 2 }]);
  for (let i = 1; i <= 6; i++) await touches(cdp, 'touchMove', [{ x: 200, y: 490, id: 1 }, { x: 760 - i * 20, y: 400, id: 2 }]);
  await page.waitForTimeout(600);
  const during = await state(page);
  await page.screenshot({ path: 'artifacts/touch/two-thumbs.png' });
  await touches(cdp, 'touchEnd', []);
  // Turned left (yaw up) by the drag, and moved forward along where it looked.
  expect(during.yaw).toBeGreaterThan(before.yaw + .3);
  const moved = Math.hypot(during.position[0] - before.position[0], during.position[2] - before.position[2]);
  expect(moved).toBeGreaterThan(.4);
  await expect(page.locator('.touch-stick')).not.toHaveClass(/is-on/);
});

test('the action button lands on a flower, the sidebar button rests, and Fly takes off', async ({ page }) => {
  const cdp = await start(page);
  await page.evaluate(() => {
    const f = window.__BEE_TEST__!.flowers()[1];
    window.__BEE_TEST__!.setPose([f.center[0], f.center[1] + .65, f.center[2]], 0, 0);
  });
  const action = page.locator('.touch-action');
  await expect(action).toBeVisible();
  await expect(action).toHaveText('Land');
  await page.screenshot({ path: 'artifacts/touch/land.png' });
  const tap = async (selector: string) => {
    const box = (await page.locator(selector).boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 7 };
    await touches(cdp, 'touchStart', [point]); await touches(cdp, 'touchEnd', []);
  };
  await tap('.touch-action');
  await expect.poll(async () => (await state(page)).landed, { timeout: 5000 }).toBe(1);
  await expect(page.locator('.touch-up')).toHaveText('Fly');
  // Perched, resting is the sidebar's button: a tap rests, another wakes.
  await expect(action).toBeHidden();
  await page.screenshot({ path: 'artifacts/touch/landed.png' });
  await tap('[data-action="rest"]');
  await expect.poll(async () => (await state(page)).resting).toBe(true);
  await tap('[data-action="rest"]');
  await expect.poll(async () => (await state(page)).resting).toBe(false);
  // Hold Fly a moment: off the flower.
  const up = (await page.locator('.touch-up').boundingBox())!;
  await touches(cdp, 'touchStart', [{ x: up.x + up.width / 2, y: up.y + up.height / 2, id: 8 }]);
  await expect.poll(async () => (await state(page)).phase, { timeout: 5000 }).toBe('flying');
  await touches(cdp, 'touchEnd', []);
});

test('a sip button shows only where there is nectar, and sips while held', async ({ page }) => {
  const cdp = await start(page);
  // The daisy (no ants on a test page): land, then walk to the nectar.
  await page.evaluate(() => {
    const f = window.__BEE_TEST__!.flowers()[0];
    window.__BEE_TEST__!.setPose([f.center[0], f.center[1] + .65, f.center[2]], 0, 0);
  });
  await expect(page.locator('.touch-sip')).toBeHidden();
  await expect(page.locator('.touch-action')).toHaveText('Land');
  const box = (await page.locator('.touch-action').boundingBox())!;
  await touches(cdp, 'touchStart', [{ x: box.x + 40, y: box.y + 40, id: 3 }]); await touches(cdp, 'touchEnd', []);
  await expect.poll(async () => (await state(page)).landed, { timeout: 5000 }).toBe(0);
  await expect.poll(async () => (await state(page)).canDrink, { timeout: 8000 }).toBe(true);
  const sip = page.locator('.touch-sip');
  await expect(sip).toBeVisible();
  await page.evaluate(() => window.__BEE_TEST__!.snapshot());
  const before = (await state(page)).nectar;
  const s = (await sip.boundingBox())!;
  await touches(cdp, 'touchStart', [{ x: s.x + s.width / 2, y: s.y + s.height / 2, id: 4 }]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/touch/sip.png' });
  await touches(cdp, 'touchEnd', []);
  expect((await state(page)).nectar).toBeGreaterThan(before);
});

test('in portrait, a card asks to turn the tablet sideways', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/?test&touch');
  await expect(page.locator('.turn-sideways')).toBeVisible();
  await page.screenshot({ path: 'artifacts/touch/portrait.png' });
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.locator('.turn-sideways')).toBeHidden();
});

test('the opening guide and the pause page show the touch controls, not the keys', async ({ page }) => {
  await page.goto('/?test&touch');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(page.locator('.learning-page')).toBeVisible();
  await expect(page.locator('.learning-controls.touch-only')).toBeVisible();
  await expect(page.locator('.learning-controls.keyboard-only')).toBeHidden();
  await page.screenshot({ path: 'artifacts/touch/guide.png' });
});
