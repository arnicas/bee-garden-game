import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Local development evidence: record the actual animated canvas, not a replay
// or a sequence of frozen test states. HUD screenshots are saved separately.
const out = process.argv[2] || 'artifacts/final-1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4188/?test');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  // This recording exercises the original airborne approach fixture.
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.setState('flight-start'));
  await page.evaluate(() => {
    const stream = document.querySelector('canvas').captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    window.__recording = { recorder, chunks, stream };
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(250);
  });
  const snap = () => page.evaluate(() => window.__BEE_TEST__.snapshot());
  const before = await snap();
  if (process.argv.includes('--sway')) {
    // A steady overview makes rooted stem bending visible before the approach.
    await page.keyboard.down('Shift');
    await page.waitForTimeout(4000);
    await page.keyboard.up('Shift');
  }
  await page.keyboard.down('w');
  await expect.poll(async () => (await snap()).position[2], { timeout: 15_000, intervals: [100] }).toBeLessThan(-1.5);
  await page.keyboard.up('w');
  await page.keyboard.down('Shift');
  await expect.poll(async () => (await snap()).canLand).toBe(true);
  await page.keyboard.up('Shift');
  await page.keyboard.press('e');
  await expect.poll(async () => (await snap()).phase).toBe('landed');
  // Holding the first mouse press must survive pointer capture and start sipping.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snap()).nectar, { timeout: 15_000 }).toBeGreaterThan(10);
  const drinking = await snap();
  await page.screenshot({ path: `${out}/sipping.png` });
  await page.mouse.up();
  await page.keyboard.press('q');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/uv-in-motion.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const after = await snap();
  const data = await page.evaluate(() => new Promise(resolve => {
    const { recorder, chunks, stream } = window.__recording;
    recorder.onstop = async () => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      stream.getTracks().forEach(track => track.stop());
    };
    recorder.stop();
  }));
  await writeFile(`${out}/flight-and-foraging.webm`, Buffer.from(data, 'base64'));
  await writeFile(`${out}/motion-metrics.json`, JSON.stringify({ before, drinking, after, errors }, null, 2));
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__BEE_TEST__.setPose([-5, 4, 22], 0, 0));
  await expect.poll(async () => page.locator('.compass-arrow').evaluate(el => Math.sin(Number(el.style.transform.match(/rotate\((.*)rad\)/)[1])))).toBeGreaterThan(.98);
  const eastBearing = await page.locator('.compass-arrow').getAttribute('style');
  await page.evaluate(() => {
    const f = window.__BEE_TEST__.flowers()[0];
    window.__BEE_TEST__.setPose([f.center[0], f.center[1] + .9, f.center[2]], 0, -.6);
  });
  await page.keyboard.down('Control');
  await page.waitForTimeout(1000);
  const clearance = await page.evaluate(() => window.__BEE_TEST__.snapshot().position[1] - window.__BEE_TEST__.flowers()[0].center[1]);
  await page.keyboard.up('Control');
  expect(clearance).toBeGreaterThan(.15);
  expect(clearance).toBeLessThan(.5);
  await writeFile(`${out}/regressions.json`, JSON.stringify({ eastBearing, descendingBlossomClearance: clearance, firstMouseSip: drinking.nectar > 10 }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ saved: `${out}/flight-and-foraging.webm`, mouseSipNectar: drinking.nectar, simulatedSeconds: after.elapsed - before.elapsed, frameMs: after.frameMs, renderer: after.diagnostics.renderer, errors }));
} finally { await browser.close(); }
