import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'artifacts/feedback-1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], stages = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto('http://127.0.0.1:4188/?test');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await page.getByRole('button', { name: 'Explore the meadow', exact: true }).click();
  const snapshot = () => page.evaluate(() => window.__BEE_TEST__.snapshot());
  await page.evaluate(() => window.__BEE_TEST__.approachFlower(1));
  await page.evaluate(() => {
    const stream = document.querySelector('canvas').captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    window.__feedbackRecording = { recorder, chunks, stream };
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start(250);
  });
  await page.keyboard.down('Shift');
  await page.waitForTimeout(600);
  stages.push({ label: 'curled flight', state: await snapshot() });
  await expect.poll(async () => (await snapshot()).canLand).toBe(true);
  await page.keyboard.up('Shift');
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot()).forelegCurl).toBeLessThan(.05);
  await expect.poll(async () => (await snapshot()).pollen).toBeGreaterThan(8);
  stages.push({ label: 'extended on donor flower', state: await snapshot() });
  await page.screenshot({ path: `${out}/carrying-pollen.png` });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot()).forelegCurl).toBeGreaterThan(.95);
  stages.push({ label: 'folded after takeoff', state: await snapshot() });
  await page.screenshot({ path: `${out}/curled-after-takeoff.png` });
  // Approach positions are fixtures; landing, collection and transfer are real inputs.
  await page.evaluate(() => window.__BEE_TEST__.approachFlower(3));
  await expect.poll(async () => (await snapshot()).canLand).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot()).pollinated).toBe(1);
  await expect(page.locator('.pollination-toast')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/pollination-event.png` });
  stages.push({ label: 'pollen deposited', state: await snapshot() });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/pollinated-flower.png` });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot()).forelegCurl).toBeGreaterThan(.95);
  await page.waitForTimeout(700);
  const data = await page.evaluate(() => new Promise(resolve => {
    const { recorder, chunks, stream } = window.__feedbackRecording;
    recorder.onstop = () => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      stream.getTracks().forEach(track => track.stop());
    };
    recorder.stop();
  }));
  await writeFile(`${out}/pollination-and-forelegs.webm`, Buffer.from(data, 'base64'));
  await writeFile(`${out}/motion-metrics.json`, JSON.stringify({ stages, after: await snapshot(), errors }, null, 2));
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ recording: `${out}/pollination-and-forelegs.webm`, stages: stages.map(s => ({ stage: s.label, curl: s.state.forelegCurl, pollinated: s.state.pollinated })), errors }));
} finally { await browser.close(); }
