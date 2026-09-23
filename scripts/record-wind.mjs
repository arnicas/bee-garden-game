import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'artifacts/wind-1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], stages = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto('http://127.0.0.1:4188/?test');
  await page.getByRole('button', { name: 'Take flight', exact: true }).click();
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.setState('windy'));
  const snapshot = () => page.evaluate(() => window.__BEE_TEST__.snapshot());
  await page.evaluate(() => {
    const stream = document.querySelector('canvas').captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    window.__windRecording = { recorder, chunks, stream };
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start(250);
  });
  await page.keyboard.down('Shift');
  await page.waitForTimeout(2200);
  stages.push({ label: 'holding against a strong current', state: await snapshot() });
  await page.screenshot({ path: `${out}/visible-currents.png` });
  await page.keyboard.up('Shift');
  await page.waitForTimeout(2700);
  stages.push({ label: 'riding without input', state: await snapshot() });
  await page.screenshot({ path: `${out}/riding-the-wind.png` });
  await page.keyboard.down('a'); await page.keyboard.down('w');
  await page.waitForTimeout(1600);
  await page.keyboard.up('a'); await page.keyboard.up('w');
  stages.push({ label: 'steering across the wind', state: await snapshot() });
  await page.keyboard.down('Shift');
  // Isolate the landing action; the approach position is explicit test setup.
  await page.evaluate(() => window.__BEE_TEST__.approachFlower(1));
  await expect.poll(async () => (await snapshot()).canLand).toBe(true);
  await page.keyboard.press('e'); await page.keyboard.up('Shift');
  await expect.poll(async () => (await snapshot()).phase).toBe('landed');
  await page.waitForTimeout(1400);
  stages.push({ label: 'secure on a moving flower', state: await snapshot() });
  await page.screenshot({ path: `${out}/wind-from-the-flower.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(1800);
  stages.push({ label: 'carried after takeoff', state: await snapshot() });
  const data = await page.evaluate(() => new Promise(resolve => {
    const { recorder, chunks, stream } = window.__windRecording;
    recorder.onstop = () => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      stream.getTracks().forEach(track => track.stop());
    };
    recorder.stop();
  }));
  await writeFile(`${out}/currents-and-flight.webm`, Buffer.from(data, 'base64'));
  await writeFile(`${out}/motion-metrics.json`, JSON.stringify({ stages, errors }, null, 2));
  // Equal-distance trips should benefit from a tailwind and cost more upwind.
  await page.evaluate(async () => {
    await window.__THREE_GAME_TEST_HOOKS__.setState('windy');
    window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true);
    window.__BEE_TEST__.setCargo(80, 40);
    window.__BEE_TEST__.setPose([-8, 4, 18], 0, 0);
  });
  const tailwind = await snapshot();
  await page.evaluate(() => window.__BEE_TEST__.setPose([8, 4, 26], 0, 0));
  const headwind = await snapshot();
  expect(headwind.homeCost).toBeGreaterThan(tailwind.homeCost + .5);
  expect(tailwind.homeCost).toBeGreaterThan(5);
  await page.keyboard.press('r');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false));
  await expect.poll(async () => (await snapshot()).phase).toBe('won');
  const delivered = await snapshot();
  expect(delivered.nectar).toBeCloseTo(headwind.nectar - headwind.homeCost, 4);
  await writeFile(`${out}/return-wind-metrics.json`, JSON.stringify({ tailwindCost: tailwind.homeCost, headwindCost: headwind.homeCost, deliveredNectar: delivered.nectar, acceptedNectar: headwind.nectar, errors }, null, 2));
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ recording: `${out}/currents-and-flight.webm`, stages: stages.map(s => ({ label: s.label, position: s.state.position, velocity: s.state.velocity, frameMs: s.state.frameMs, renderer: s.state.diagnostics.renderer })), errors }));
} finally { await browser.close(); }
