import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { walkForPollen } from './support/foraging';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
const guide = (page: Page) => page.getByRole('dialog', { name: 'Your day begins on a flower.' });

test('flower-first guide is readable, safe to try keys in, and leaves the bee on its petal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('artifacts/welcome-1', { recursive: true });
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await expect(guide(page)).toBeVisible();
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await expect(page.locator('#learning-title')).toBeFocused();
  const initial = await state(page);
  expect(initial.phase).toBe('learning');
  expect(initial.landed).toBe(0);
  expect(initial.visited).toBe(1);
  expect(initial.forelegCurl).toBe(0);
  await expect(page.locator('.game-heading')).toHaveCSS('visibility', 'hidden');

  const layouts = [];
  for (const [width, height] of [[1280, 720], [1024, 600]]) {
    await page.setViewportSize({ width, height });
    const box = await guide(page).boundingBox();
    expect(box!.x).toBeGreaterThan(0); expect(box!.y).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThan(width);
    expect(box!.y + box!.height).toBeLessThan(height);
    for (const cluster of await page.locator('.learning-keys').all()) {
      const keys = await cluster.locator('kbd').all();
      const [up, left, down, right] = await Promise.all(keys.map(k => k.boundingBox()));
      expect(up!.x).toBe(down!.x); expect(up!.y).toBeLessThan(down!.y);
      expect(left!.y).toBe(down!.y); expect(right!.y).toBe(down!.y);
      expect(left!.x).toBeLessThan(down!.x); expect(right!.x).toBeGreaterThan(down!.x);
    }
    await page.screenshot({ path: `artifacts/welcome-1/guide-${width}.png` });
    layouts.push({ width, height, box });
  }
  for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space', 'e', 'f', 'q']) await page.keyboard.press(key);
  await page.waitForTimeout(700);
  const reading = await state(page);
  for (const name of ['energy', 'nectar', 'pollen', 'pollinated', 'elapsed', 'dayElapsed', 'quietAge', 'localPosition', 'yaw', 'pitch']) expect(reading[name]).toEqual(initial[name]);
  expect(reading.weather.stage).toBe('clear');
  expect(reading.windTime).toBeGreaterThan(initial.windTime); // Only scenery moves.

  // Holding a demonstrated key across a click cannot become unintended walking.
  await page.keyboard.down('w');
  await expect(page.locator('[data-learn-key="KeyW"]')).toHaveClass(/is-pressed/);
  await page.getByRole('button', { name: 'Explore the meadow' }).click();
  await page.keyboard.down('w');
  await expect(guide(page)).toBeHidden();
  await page.waitForTimeout(300);
  expect((await state(page)).localPosition).toEqual(initial.localPosition);
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.up('w');
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.screenshot({ path: 'artifacts/welcome-1/first-petal.png' });

  await page.keyboard.down('f');
  await expect.poll(async () => (await state(page)).nectar).toBeGreaterThan(2);
  await page.keyboard.up('f');
  await walkForPollen(page, s => s.pollen > 3);
  expect((await state(page)).pollinated).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  await expect.poll(async () => (await state(page)).forelegCurl).toBeGreaterThan(.95);
  await page.keyboard.press('Escape');
  await page.locator('.pause-page [data-action="restart"]').click();
  await expect(guide(page)).toBeVisible();
  const reset = await state(page);
  expect(reset.landed).toBe(0); expect(reset.energy).toBe(100);
  expect(reset.nectar).toBe(0); expect(reset.pollen).toBe(0); expect(reset.elapsed).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('artifacts/welcome-1/checks.json', JSON.stringify({ initial, reading, reset, layouts, errors }, null, 2));
});

test('keyboard-only opening contains focus, ignores held dismissal repeats and supports reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?test');
  await page.keyboard.press('Enter');
  await expect(guide(page)).toBeVisible();
  const initial = await state(page);
  await page.waitForTimeout(300);
  expect((await state(page)).cameraPosition).toEqual(initial.cameraPosition);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Explore the meadow' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Explore the meadow' })).toBeFocused();
  await page.keyboard.down('Space');
  await expect(guide(page)).toBeHidden();
  await page.keyboard.down('Space');
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  expect((await state(page)).phase).toBe('flying');
  await page.keyboard.press('Escape');
  expect((await state(page)).phase).toBe('paused');
  await page.locator('.pause-page [data-action="restart"]').click();
  await page.keyboard.down('Escape');
  await expect(guide(page)).toBeHidden();
  await page.keyboard.down('Escape');
  expect((await state(page)).phase).toBe('landed');
  await page.keyboard.up('Escape');
  await page.keyboard.press('Escape');
  expect((await state(page)).phase).toBe('paused');
});
