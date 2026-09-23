import { startFlyingFixture, leaveWelcome } from './support/start';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, video: 'on' });
const state = (page: Page) => page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Promise<Record<string, any>>;
async function land(page: Page, id: number) {
  await page.evaluate(id => window.__BEE_TEST__!.approachFlower(id), id);
  await expect.poll(async () => (await state(page)).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).landed).toBe(id);
}

for (const [id, species] of [[0, 'daisy'], [2, 'cornflower']] as const) {
  test(`${species} nectar reacts at tongue contact and audio respects the interaction lifecycle`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await mkdir('artifacts/nectar-feedback-1', { recursive: true });
    // Record only the game's Web Audio output, never a microphone or system input.
    await page.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      (AudioNode.prototype as any).connect = function(destination: AudioNode, ...rest: number[]) {
        const result = (connect as any).call(this, destination, ...rest);
        if (destination instanceof AudioDestinationNode && !(window as any).__nectarCapture) {
          const stream = (this.context as AudioContext).createMediaStreamDestination();
          (connect as any).call(this, stream);
          const recorder = new MediaRecorder(stream.stream), chunks: Blob[] = [];
          recorder.ondataavailable = event => chunks.push(event.data);
          (window as any).__nectarCapture = {
            start: () => recorder.start(),
            stop: () => new Promise<string>(resolve => {
              recorder.onstop = () => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
              };
              recorder.stop();
            }),
          };
        }
        return result;
      };
    });
    await page.goto('/?test');
    expect((await state(page)).audio.context).toBe('locked');
    await startFlyingFixture(page);
    await expect(page.locator('.title-screen')).toHaveCSS('opacity', '0');
    await land(page, id);
    // Aim into the well with a real look input, leaving headroom for flower sway.
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(180);
    await page.keyboard.up('ArrowUp');
    await expect.poll(async () => (await state(page)).canDrink).toBe(true);
    const ready = await state(page);
    expect(ready.audio.context).toBe('running');
    expect(ready.audio.sipLoops).toBe(1);
    expect(ready.nectarSurface.visible).toBe(true);
    expect(ready.nectarSurface.touching).toBe(false);
    expect(ready.audio.sipping).toBe(false);
    await page.screenshot({ path: `artifacts/nectar-feedback-1/${species}-ready.png` });
    await page.evaluate(() => (window as any).__nectarCapture.start());
    await page.keyboard.down('f');
    await expect.poll(async () => (await state(page)).nectarSurface.touching, { intervals: [20] }).toBe(true);
    const entering = await state(page);
    expect(entering.nectarSurface.tipRadius).toBeLessThanOrEqual(1);
    expect(entering.audio.sipping).toBe(true);
    expect(entering.audio.touches).toBe(1);
    await page.screenshot({ path: `artifacts/nectar-feedback-1/${species}-entry.png` });
    await expect.poll(async () => (await state(page)).nectarSurface.pressure).toBeGreaterThan(.95);
    await expect.poll(async () => (await state(page)).audio.sipRms).toBeGreaterThan(.0005);
    await page.waitForTimeout(650);
    const sipping = await state(page);
    expect(sipping.drinking).toBe(true);
    expect(sipping.nectarSurface.touching).toBe(true);
    expect(sipping.nectarSurface.contactCount).toBe(1);
    expect(sipping.audio.touches).toBe(1);
    expect(sipping.nectar).toBeGreaterThan(ready.nectar);
    await page.screenshot({ path: `artifacts/nectar-feedback-1/${species}-sipping.png` });
    await page.keyboard.up('f');
    await expect.poll(async () => (await state(page)).audio.sipping).toBe(false);
    await expect.poll(async () => (await state(page)).nectarSurface.pressure).toBeLessThan(.001);
    await expect.poll(async () => (await state(page)).audio.sipRms).toBeLessThan(.0001);
    const released = await state(page);
    expect(released.nectarSurface.visible).toBe(true);
    await page.screenshot({ path: `artifacts/nectar-feedback-1/${species}-released.png` });
    const recording = await page.evaluate(() => (window as any).__nectarCapture.stop()) as string;
    await writeFile(`artifacts/nectar-feedback-1/${species}-sipping-audio.webm`, Buffer.from(recording, 'base64'));

    await page.keyboard.press('m');
    await page.keyboard.down('f');
    await expect.poll(async () => (await state(page)).audio.touches).toBe(2);
    await expect.poll(async () => (await state(page)).audio.outputRms).toBeLessThan(.00001);
    expect((await state(page)).nectarSurface.touching).toBe(true);
    await page.keyboard.press('m');
    await expect.poll(async () => (await state(page)).audio.outputRms).toBeGreaterThan(.0005);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).audio.sipping).toBe(false);
    await expect.poll(async () => (await state(page)).audio.sipRms).toBeLessThan(.0001);
    await page.keyboard.up('f');
    await page.getByRole('button', { name: 'Back to the breeze', exact: true }).click();
    await page.keyboard.down('f');
    await expect.poll(async () => (await state(page)).audio.sipping).toBe(true);
    expect((await state(page)).audio.sipLoops).toBe(1);
    // Reduced motion retains a steady dimple; no animated ripple is needed.
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setReducedMotion(true));
    await expect.poll(async () => (await state(page)).nectarSurface.pressure).toBe(1);
    await page.evaluate(() => window.__BEE_TEST__!.setCargo(100, 100, 100));
    await expect.poll(async () => (await state(page)).audio.sipping).toBe(false);
    await expect.poll(async () => (await state(page)).nectarSurface.pressure).toBe(0);
    expect((await state(page)).nectarSurface.visible).toBe(true);
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.screenshot({ path: `artifacts/nectar-feedback-1/${species}-full-small-window.png` });
    await page.keyboard.up('f');
    await page.keyboard.press('Escape');
    await page.locator('.pause-page [data-action="restart"]').click();
    await leaveWelcome(page);
    expect((await state(page)).audio.sipLoops).toBe(1);
    await expect.poll(async () => (await state(page)).audio.sipping).toBe(false);
    await expect.poll(async () => (await state(page)).nectarSurface.visible).toBe(false);
    await land(page, 1);
    await page.keyboard.down('f');
    await page.waitForTimeout(350);
    const poppy = await state(page);
    expect(poppy.nectarSurface.visible).toBe(false);
    expect(poppy.audio.sipping).toBe(false);
    expect(poppy.audio.sipRms).toBeLessThan(.0001);
    await page.keyboard.up('f');
    await writeFile(`artifacts/nectar-feedback-1/${species}-metrics.json`, JSON.stringify({ ready, entering, sipping, released, poppy, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}
