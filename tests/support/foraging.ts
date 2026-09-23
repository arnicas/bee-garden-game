import { expect, type Page } from '@playwright/test';
import { Quaternion, Vector3 } from 'three';

// Walk a small loop through the anthers with real WASD input. This never moves
// the bee through test hooks or changes resources; it only chooses directions.
export async function walkForPollen(page: Page, done: (state: Record<string, any>) => boolean, timeout = 20_000) {
  const held = new Set<string>();
  const waypoints = [[.14, .14], [.14, -.14], [-.14, -.14], [-.14, .14]];
  let next = 0, complete = false;
  const deadline = Date.now() + timeout;
  try {
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => window.__BEE_TEST__!.snapshot()) as Record<string, any>;
      if (done(state)) { complete = true; break; }
      expect(state.phase).toBe('landed');
      const flower = await page.evaluate(id => window.__BEE_TEST__!.flowers().find(f => f.id === id)!, state.landed);
      const [x, , z] = state.localPosition;
      if (Math.hypot(waypoints[next][0] - x, waypoints[next][1] - z) < .055) next = (next + 1) % waypoints.length;
      const toward = new Vector3(waypoints[next][0] - x, 0, waypoints[next][1] - z).applyQuaternion(new Quaternion().fromArray(flower.rotation));
      const forward = -Math.sin(state.yaw) * toward.x - Math.cos(state.yaw) * toward.z;
      const side = Math.cos(state.yaw) * toward.x - Math.sin(state.yaw) * toward.z;
      const wanted = new Set<string>();
      if (Math.abs(forward) > .025) wanted.add(forward > 0 ? 'w' : 's');
      if (Math.abs(side) > .025) wanted.add(side > 0 ? 'd' : 'a');
      for (const key of held) if (!wanted.has(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
      await page.waitForTimeout(100);
    }
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
  expect(complete, 'walking through the pollen should meet the harvesting condition').toBe(true);
}
