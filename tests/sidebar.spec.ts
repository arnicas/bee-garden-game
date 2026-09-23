import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('stacked sidebar keeps the landing view clear and fits desktop windows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/cargo-art-1', { recursive: true });
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__THREE_GAME_TEST_HOOKS__);
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(size);
    let cargoTop: number | undefined;
    for (const scene of ['active-play', 'landed', 'home-ready']) {
      await page.evaluate(scene => {
        window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
        window.__THREE_GAME_TEST_HOOKS__!.setState(scene === 'home-ready' ? 'landed' : scene);
        window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
        if (scene === 'home-ready') window.__BEE_TEST__!.setCargo(100, 140, 70);
      }, scene);
      await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
      await expect(page.locator('.cargo-bar')).toBeVisible();
      if (scene === 'home-ready') {
        await expect(page.getByRole('button', { name: /Way home/ })).toBeVisible();
        const ready = await page.evaluate(() => window.__BEE_TEST__!.snapshot());
        expect(ready.harvestReady).toBe(true);
        expect(ready.canReturn).toBe(false);
      }
      const bounds = await page.evaluate(() => {
        const box = (selector: string) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width };
        };
        return {
          cargo: box('.cargo-bar'), home: box('.home-note'), hint: box('.center-note'),
          energy: box('.energy-meter'), nectar: box('.nectar-meter'), pollen: box('.pollen-meter'),
          textFits: [...document.querySelectorAll<HTMLElement>('.meter-caption')].every(el => el.scrollWidth <= el.clientWidth + 1),
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        };
      });
      expect(bounds.cargo.x).toBeGreaterThan(size.width * .72);
      expect(bounds.cargo.width).toBeLessThanOrEqual(104);
      expect(bounds.cargo.bottom).toBeLessThan(size.height - 75);
      expect(bounds.cargo.right).toBeLessThan(size.width);
      expect(bounds.cargo.y).toBeGreaterThan(bounds.home.bottom);
      if (cargoTop === undefined) cargoTop = bounds.cargo.y;
      else expect(bounds.cargo.y).toBe(cargoTop);
      expect(bounds.nectar.y).toBeGreaterThan(bounds.energy.bottom);
      expect(bounds.pollen.y).toBeGreaterThan(bounds.nectar.bottom);
      expect(bounds.hint.y).toBeGreaterThan(size.height - 100);
      expect(bounds.textFits).toBe(true);
      expect(bounds.overflow).toBe(false);
      await expect(page.getByRole('meter', { name: 'Nectar stored' })).toHaveAttribute('aria-valuemax', '100');
      await expect(page.locator('[data-text="nectar-goal"]')).toHaveText('Hive goal 45');
      await page.screenshot({ path: `artifacts/cargo-art-1/${scene}-${size.width}.png`, animations: 'disabled' });
    }
  }
  expect(errors).toEqual([]);
});

test('illustrated supplies show empty, low, partial and full states with keyboard-readable details', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/cargo-art-1', { recursive: true });
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__THREE_GAME_TEST_HOOKS__);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true);
    window.__THREE_GAME_TEST_HOOKS__!.setState('landed');
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
  });
  for (const { name, nectar, pollen, energy } of [
    { name: 'empty', nectar: 0, pollen: 0, energy: 0 },
    { name: 'low', nectar: 20, pollen: 5, energy: 20 },
    { name: 'partial', nectar: 50, pollen: 18, energy: 50 },
    { name: 'full', nectar: 100, pollen: 140, energy: 100 },
  ]) {
    await page.evaluate(({ nectar, pollen, energy }) => window.__BEE_TEST__!.setCargo(nectar, pollen, energy), { nectar, pollen, energy });
    await expect(page.getByRole('meter', { name: 'Energy', exact: true })).toHaveAttribute('aria-valuenow', String(energy));
    await expect(page.locator('[data-text="energy"]')).toHaveText(`${energy}%`);
    await expect(page.locator('[data-text="nectar"]')).toHaveText(`${nectar} / 100`);
    await expect(page.locator('[data-text="pollen"]')).toHaveText(`${pollen} / 140`);
    const quantities = await page.evaluate(() => ({
      honey: Number(document.querySelector('[data-fill="nectar"]')!.getAttribute('height')),
      seeds: Number(document.querySelector('[data-fill="pollen"]')!.getAttribute('height')),
      food: document.querySelector('[data-fill="energy"]')!.getAttribute('d'),
    }));
    if (name === 'empty') {
      expect(quantities.honey).toBe(0);
      expect(quantities.seeds).toBe(0);
      expect(quantities.food).toBe('');
    } else {
      expect(quantities.honey).toBeGreaterThan(0);
      expect(quantities.seeds).toBeGreaterThan(0);
      expect(quantities.food).toBeTruthy();
    }
    await page.locator('.cargo-bar').screenshot({ path: `artifacts/cargo-art-1/supplies-${name}.png`, animations: 'disabled' });
  }
  await expect(page.locator('.nectar-meter')).toHaveClass(/is-full/);
  await expect(page.locator('.pollen-meter')).toHaveClass(/is-full/);
  await expect(page.locator('#nectar-detail')).toBeHidden();
  // Reach every detail using Tab, with no pointer or extra game key combination.
  await page.getByRole('button', { name: /Way home/ }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('meter', { name: 'Energy', exact: true })).toBeFocused();
  await expect(page.locator('#energy-detail')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('meter', { name: 'Nectar stored' })).toBeFocused();
  await expect(page.locator('#nectar-detail')).toBeVisible();
  await expect(page.locator('[data-text="nectar-goal"]')).toHaveText('Hive goal 45');
  await page.screenshot({ path: 'artifacts/cargo-art-1/keyboard-detail.png', animations: 'disabled' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('meter', { name: 'Pollen collected' })).toBeFocused();
  await expect(page.locator('#pollen-detail')).toBeVisible();
  await expect(page.locator('#nectar-detail')).toBeHidden();
  // Over-goal pollen keeps the true total while the meter's range stays valid.
  await page.evaluate(() => window.__BEE_TEST__!.setCargo(100, 150, 70));
  await expect(page.getByRole('meter', { name: 'Pollen collected' })).toHaveAttribute('aria-valuenow', '140');
  await expect(page.getByRole('meter', { name: 'Pollen collected' })).toHaveAttribute('aria-valuetext', '150 of 140 needed for the hive');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('title'));
  await expect(page.locator('.cargo-bar')).toBeHidden();
  await expect(page.locator('#pollen-detail')).toBeHidden();
  expect(errors).toEqual([]);
});
