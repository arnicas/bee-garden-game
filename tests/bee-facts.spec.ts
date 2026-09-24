import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 } });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
async function openFacts(page: Page): Promise<void> {
  await page.goto('/?test');
  await startFlyingFixture(page);
  await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).phase).toBe('paused');
  await page.locator('[data-action="facts-open"]').click();
  await expect(page.getByRole('dialog', { name: 'Small wonders.' })).toBeVisible();
}

test('optional facts keep the meadow paused, contain keyboard focus and close before Escape resumes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openFacts(page);
  const dialog = page.getByRole('dialog', { name: 'Small wonders.' });
  await expect(page.locator('#bee-facts-title')).toBeFocused();
  await expect(page.locator('.pause-page')).toBeHidden();
  await expect(page.locator('[data-action="facts-open"]')).toHaveAttribute('aria-expanded', 'true');
  const before = await state(page);
  // Reading keys never become queued flight, feeding, return or sound input.
  for (const key of ['w', 'f', 'Space', 'r', 'q', 'm']) await page.keyboard.press(key);
  await page.waitForTimeout(250);
  const reading = await state(page);
  expect(reading.phase).toBe('paused');
  for (const key of ['energy', 'nectar', 'pollen', 'elapsed', 'dayElapsed', 'position', 'yaw', 'pitch']) expect(reading[key]).toEqual(before[key]);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="facts-close"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('.fact-page:not([hidden]) a').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="facts-close"]')).toBeFocused();
  // Holding Escape must not close the journal and immediately resume on repeat.
  await page.keyboard.down('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.down('Escape');
  expect((await state(page)).phase).toBe('paused');
  await page.keyboard.up('Escape');
  await expect(page.locator('[data-action="facts-open"]')).toBeFocused();
  await expect(page.locator('[data-action="facts-open"]')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  expect(errors).toEqual([]);
});

test('illustrated notes have accessible topics, readable sources and a bounded laptop layout', async ({ page }) => {
  await mkdir('artifacts/bee-facts-1', { recursive: true });
  await openFacts(page);
  const dialog = page.getByRole('dialog', { name: 'Small wonders.' });
  const tabs = dialog.getByRole('tab');
  await expect(tabs).toHaveCount(8);
  await tabs.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('tab', { name: 'Two kinds of food', exact: true })).toBeFocused();
  await expect(dialog.getByRole('tabpanel')).toContainText('Honeybees & other bees');
  await page.keyboard.press('End');
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tabpanel')).toContainText('One outing stands for a whole day');
  await page.keyboard.press('Home');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  const sources = await dialog.locator('.fact-sources a').evaluateAll(links => links.map(link => ({
    label: link.textContent, href: (link as HTMLAnchorElement).href, target: link.getAttribute('target'), rel: link.getAttribute('rel'),
  })));
  for (const source of sources) {
    expect(source.href).toMatch(/^https:\/\//);
    expect(source.target).toBe('_blank');
    expect(source.rel).toContain('noopener');
    expect(source.rel).toContain('noreferrer');
  }
  const layouts: unknown[] = [];
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(size);
    for (const topic of ['A different light', 'Shelter from Rain', 'Sun & shade', 'One flower to another']) {
      await dialog.getByRole('tab', { name: topic, exact: true }).click();
      const panel = dialog.getByRole('tabpanel');
      await expect(panel.getByRole('heading', { name: 'In nature', exact: true })).toBeVisible();
      await expect(panel.getByRole('heading', { name: 'In this game', exact: true })).toBeVisible();
      if (topic === 'Shelter from Rain') {
        await expect(panel).toContainText('spends stored nectar');
        await expect(panel).toContainText('speeds daylight');
        await expect(panel).toContainText('stillness alone is not food');
      }
      const bounds = await dialog.evaluate(element => {
        const reader = element.querySelector<HTMLElement>('.facts-reader')!;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight,
          readerOverflow: reader.scrollWidth > reader.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(size.width);
      expect(bounds.bottom).toBeLessThanOrEqual(size.height);
      expect(bounds.readerOverflow).toBe(false);
      expect(bounds.documentOverflow).toBe(false);
      layouts.push({ size, topic, ...bounds });
      const slug = topic.toLowerCase().replaceAll(' & ', '-and-').replaceAll(' ', '-');
      await page.screenshot({ path: `artifacts/bee-facts-1/${slug}-${size.width}.png`, animations: 'disabled' });
      // Source links remain reachable by keyboard even when the page must scroll.
      await panel.locator('a').last().focus();
      const reachable = await panel.locator('a').last().evaluate(link => {
        const linkRect = link.getBoundingClientRect();
        const readerRect = link.closest('.facts-reader')!.getBoundingClientRect();
        return linkRect.top >= readerRect.top - 1 && linkRect.bottom <= readerRect.bottom + 1;
      });
      expect(reachable).toBe(true);
    }
  }
  await page.locator('[data-action="facts-close"]').click();
  await expect(page.locator('[data-action="facts-open"]')).toBeFocused();
  expect((await state(page)).phase).toBe('paused');
  // The concise keyboard guide fits the same two supported laptop layouts.
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(size);
    const pause = page.locator('.pause-page');
    const bounds = await pause.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path: `artifacts/bee-facts-1/pause-guide-${size.width}.png`, animations: 'disabled' });
  }
  await page.locator('.guide-extras summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.guide-extras')).toHaveAttribute('open', '');
  await page.screenshot({ path: 'artifacts/bee-facts-1/pause-extras-1024.png', animations: 'disabled' });
  await page.keyboard.press('Enter');
  await page.locator('.pause-page [data-action="restart"]').click();
  await leaveWelcome(page);
  await expect.poll(async () => (await state(page)).phase).toBe('flying');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="facts-open"]').click();
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await writeFile('artifacts/bee-facts-1/metrics-and-sources.json', JSON.stringify({ layouts, sources }, null, 2));
});
