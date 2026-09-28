import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng } from './world';
import type { FairyRingSpot, MushroomPatchSpot } from './types';

/**
 * Fairy rings: fairy ring champignons (Marasmius oreades) come up in rings in
 * the open grass after rain, in a band where the grass grows short and dark.
 * In the hot spell they dry out, shrink and brown; rain revives them. They sit
 * at a bee's scale: a cap is two or three bee-lengths across, on a stem taller
 * than she is. One instanced draw for all of them.
 */
export interface FairyRing {
  id: number;
  /** A full fairy ring, or a few together by a pool. */
  kind: 'ring' | 'patch';
  center: THREE.Vector3;
  radius: number;
  seen: boolean;
}
interface Mushroom {
  ring: number;
  position: THREE.Vector3;
  yaw: number;
  lean: THREE.Vector2;
  size: number;
  height: number;
  /** Seconds after the soak before this one starts to come up. */
  delay: number;
  grown: number;
  dry: number;
}

/** A cap about 3 cm across, on a stem about 4 cm tall (1 unit = 10 cm). */
const CAP_RADIUS = .15, STEM_HEIGHT = .38, STEM_RADIUS = .022;
const GROW_TIME = 22;
/** Only mushrooms this near the camera are drawn. */
const VISIBLE_RANGE = 13;

function capProfile(): THREE.BufferGeometry {
  // A low bell with the broad central boss (umbo) of the fairy ring champignon.
  const top: THREE.Vector2[] = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9, r = CAP_RADIUS * t;
    const dome = .42 * CAP_RADIUS * (1 - t * t) + .12 * CAP_RADIUS * Math.exp(-t * t * 18);
    top.push(new THREE.Vector2(Math.max(1e-4, r), dome - .06 * CAP_RADIUS * t ** 6));
  }
  const cap = new THREE.LatheGeometry(top.reverse(), 24);
  const tan = new THREE.Color('#c79a63'), pale = new THREE.Color('#e7d2a8'), rim = new THREE.Color('#8f6a40'), colour = new THREE.Color();
  const pos = cap.attributes.position, colours: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z) / CAP_RADIUS, angle = Math.atan2(z, x);
    // A slightly wavy, uneven margin: pushed in and out, and dipping here and there.
    const edge = THREE.MathUtils.smoothstep(r, .55, 1);
    const wave = .06 * Math.sin(angle * 3 + 1.3) + .035 * Math.sin(angle * 5 + .4) + .02 * Math.sin(angle * 8);
    pos.setX(i, x * (1 + wave * edge)); pos.setZ(i, z * (1 + wave * edge));
    pos.setY(i, pos.getY(i) - Math.max(0, wave) * edge * CAP_RADIUS * .25);
    colour.copy(tan).lerp(pale, THREE.MathUtils.smoothstep(r, .15, .7));
    // A darker margin, unevenly wide.
    colour.lerp(rim, THREE.MathUtils.smoothstep(r, .8 - wave * 1.5, .97) * .75);
    colours.push(colour.r, colour.g, colour.b);
  }
  cap.computeVertexNormals();
  cap.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  // The underside: widely spaced cream gills, as alternating pale and shaded
  // wedges on a shallow cone.
  const gills = new THREE.CylinderGeometry(CAP_RADIUS * .96, STEM_RADIUS * 1.1, CAP_RADIUS * .18, 18, 1, true).toNonIndexed();
  gills.translate(0, -CAP_RADIUS * .12, 0);
  const cream = new THREE.Color('#efe2c3'), shade = new THREE.Color('#c9b48d'), gc: number[] = [];
  for (let i = 0; i < gills.attributes.position.count; i++) {
    const face = Math.floor(i / 6);
    colour.copy(face % 2 ? cream : shade);
    gc.push(colour.r, colour.g, colour.b);
  }
  gills.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  gills.deleteAttribute('uv');
  const capFlat = cap.toNonIndexed(); capFlat.deleteAttribute('uv'); cap.dispose();
  const merged = mergeGeometries([capFlat, gills], false)!;
  capFlat.dispose(); gills.dispose();
  return merged;
}

export function createMushrooms(scene: THREE.Scene, seed: number, spots: readonly FairyRingSpot[], patches: readonly MushroomPatchSpot[] = []) {
  const random = rng((seed ^ 0xf0a1) >>> 0 || 13);
  const rings: FairyRing[] = spots.map((s, id) => ({ id, kind: 'ring' as const, center: new THREE.Vector3(s.x, meadowGroundHeight(s.x, s.z), s.z), radius: s.radius, seen: false }));
  const clumps = patches.map((p, i) => ({ spot: p, group: { id: rings.length + i, kind: 'patch' as const, center: new THREE.Vector3(p.x, meadowGroundHeight(p.x, p.z), p.z), radius: .2, seen: false } }));
  rings.push(...clumps.map(c => c.group));
  const mushrooms: Mushroom[] = [];
  rings.forEach(ring => {
    if (ring.kind !== 'ring') return;
    const count = Math.round(ring.radius * Math.PI * 2 / .26);
    const turn = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      // A broken ring: some gaps, and a few that stand a little in or out.
      if (random() < .14) continue;
      const a = turn + (i + (random() - .5) * .5) / count * Math.PI * 2, r = ring.radius + (random() - .5) * .14;
      const x = ring.center.x + Math.cos(a) * r, z = ring.center.z + Math.sin(a) * r;
      mushrooms.push({
        ring: ring.id, position: new THREE.Vector3(x, meadowGroundHeight(x, z), z), yaw: random() * Math.PI * 2,
        lean: new THREE.Vector2((random() - .5) * .16, (random() - .5) * .16), size: .7 + random() * .5, height: .75 + random() * .45,
        delay: random() * 10, grown: 0, dry: 0,
      });
    }
  });

  // Clumps: a few together, leaning a little apart, one or two still small.
  clumps.forEach(({ spot, group }) => {
    for (let i = 0; i < spot.count; i++) {
      const a = random() * Math.PI * 2, r = i === 0 ? 0 : .07 + random() * .13;
      const x = group.center.x + Math.cos(a) * r, z = group.center.z + Math.sin(a) * r;
      mushrooms.push({
        ring: group.id, position: new THREE.Vector3(x, meadowGroundHeight(x, z), z), yaw: random() * Math.PI * 2,
        lean: new THREE.Vector2(Math.cos(a) * .22 * (r > 0 ? 1 : 0) + (random() - .5) * .08, Math.sin(a) * .22 * (r > 0 ? 1 : 0) + (random() - .5) * .08),
        size: (random() < .3 ? .5 : .75) + random() * .45, height: .7 + random() * .5, delay: random() * 14, grown: 0, dry: 0,
      });
    }
  });
  const capGeometry = capProfile();
  const stemGeometry = new THREE.CylinderGeometry(STEM_RADIUS * .8, STEM_RADIUS * 1.05, 1, 10, 3, true).translate(0, .5, 0).toNonIndexed();
  stemGeometry.deleteAttribute('uv');
  const stemCream = new THREE.Color('#e3d4b2'), stemBase = new THREE.Color('#bda57b'), sc: number[] = [], colour = new THREE.Color();
  const fibre = new THREE.Color('#b8a27a');
  for (let i = 0; i < stemGeometry.attributes.position.count; i++) {
    const at = stemGeometry.attributes.position, y = at.getY(i), angle = Math.atan2(at.getZ(i), at.getX(i));
    colour.copy(stemBase).lerp(stemCream, THREE.MathUtils.smoothstep(y, 0, .45));
    // Fine lengthwise fibres: faint darker streaks round the stalk.
    const streak = Math.max(0, Math.sin(angle * 5 + y * 2)) * .5 + Math.max(0, Math.sin(angle * 9 + 1.7)) * .3;
    colour.lerp(fibre, streak * .55 * THREE.MathUtils.smoothstep(y, .1, .4));
    sc.push(colour.r, colour.g, colour.b);
  }
  stemGeometry.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0, side: THREE.DoubleSide });
  const n = Math.max(1, mushrooms.length);
  const caps = new THREE.InstancedMesh(capGeometry, material, n), stems = new THREE.InstancedMesh(stemGeometry, material, n);
  caps.name = 'fairy ring caps'; stems.name = 'fairy ring stems';
  for (const mesh of [caps, stems]) { mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; scene.add(mesh); }
  const fresh = new THREE.Color('#ffffff'), dried = new THREE.Color('#9c7a55'), tint = new THREE.Color();
  for (let i = 0; i < n; i++) { caps.setColorAt(i, fresh); stems.setColorAt(i, fresh); }

  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(), top = new THREE.Vector3();
  /** 0–1: how well the ground has been soaked; the mushrooms come up after rain. */
  let soak = 0, sinceSoak = 0, lastTime = 0;

  const camera = new THREE.Vector3(1e6, 0, 0);
  function pose(): void {
    let i = 0;
    mushrooms.forEach(m => {
      const g = THREE.MathUtils.smoothstep(m.grown, 0, 1);
      if (g <= .001 || Math.hypot(m.position.x - camera.x, m.position.z - camera.z) > VISIBLE_RANGE) return;
      // Drying shrinks and cups the cap, and shortens the stem a little.
      const d = m.dry, h = STEM_HEIGHT * m.height * (.25 + .75 * g) * (1 - .12 * d);
      euler.set(m.lean.x * g, m.yaw, m.lean.y * g);
      rotation.setFromEuler(euler);
      scale.set(m.height * g * .9 + .1, h, m.height * g * .9 + .1);
      matrix.compose(m.position, rotation, scale);
      stems.setMatrixAt(i, matrix);
      top.set(0, h, 0).applyQuaternion(rotation).add(m.position);
      // Young ones are closed buttons; open caps spread flat.
      const open = THREE.MathUtils.smoothstep(g, .35, 1);
      const spread = m.size * (.45 + .55 * open) * (1 - .28 * d);
      scale.set(spread, m.size * (1.5 - .5 * open) * (1 + .25 * d), spread);
      matrix.compose(top, rotation, scale);
      caps.setMatrixAt(i, matrix);
      tint.copy(fresh).lerp(dried, d * .85);
      caps.setColorAt(i, tint); stems.setColorAt(i, tint);
      i++;
    });
    caps.count = i; stems.count = i;
    for (const mesh of [caps, stems]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
  pose();

  return {
    rings: rings as readonly FairyRing[],
    /** Rain soaks the ground and the mushrooms come up; heat dries them; rain revives them. */
    update(time: number, weather: { rain: number; heat: number; wet: number }, cameraPosition: THREE.Vector3): void {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      camera.copy(cameraPosition);
      if (dt <= 0) { pose(); return; }
      if (weather.rain > .2) soak = Math.min(1, soak + dt * .06);
      if (soak > .35) sinceSoak += dt;
      const drying = weather.rain < .05 && weather.wet < .3 ? weather.heat : 0;
      for (const m of mushrooms) {
        if (sinceSoak > m.delay) m.grown = Math.min(1, m.grown + dt / GROW_TIME);
        if (drying > .25) m.dry = Math.min(1, m.dry + dt * .03 * drying);
        else if (weather.rain > .15 || weather.wet > .5) m.dry = Math.max(0, m.dry - dt * .12);
      }
      pose();
    },
    /** The nearest ring with mushrooms up, measured to its nearest mushroom. */
    nearest(point: THREE.Vector3): { ring: FairyRing; distance: number; at: THREE.Vector3 } | null {
      let found: FairyRing | null = null, distance = Infinity;
      const at = new THREE.Vector3();
      for (const m of mushrooms) {
        if (m.grown < .3) continue;
        const d = Math.hypot(m.position.x - point.x, m.position.z - point.z, m.position.y + STEM_HEIGHT * .8 - point.y);
        if (d < distance) { distance = d; found = rings[m.ring]; at.set(m.position.x, m.position.y + STEM_HEIGHT * m.height * .9, m.position.z); }
      }
      return found ? { ring: found, distance, at } : null;
    },
    markSeen(id: number): void { const ring = rings[id]; if (ring) ring.seen = true; },
    seenCount(kind?: 'ring' | 'patch'): number { return rings.filter(r => r.seen && (!kind || r.kind === kind)).length; },
    /** For the night between summers: how far the mushrooms have come up (0–1), a little staggered. */
    setGrowth(amount: number): void {
      soak = Math.max(soak, amount > 0 ? 1 : 0); if (amount > 0) sinceSoak = 1e3;
      for (const m of mushrooms) m.grown = THREE.MathUtils.clamp(amount * 1.5 - m.delay / 28, 0, 1);
      pose();
    },
    /** After rain in the night: the ground is soaked and the mushrooms are already up. */
    presoak(): void { soak = 1; sinceSoak = 1e3; for (const m of mushrooms) { m.grown = 1; m.dry = 0; } pose(); },
    /** A new day: the ground is dry again, and the rings are still to be found. */
    reset(): void { soak = 0; sinceSoak = 0; for (const m of mushrooms) { m.grown = 0; m.dry = 0; } for (const r of rings) r.seen = false; pose(); },
    diagnostics() {
      return { rings: rings.length, mushrooms: mushrooms.length, soak, up: mushrooms.filter(m => m.grown > .5).length, dry: mushrooms.length ? mushrooms.reduce((s, m) => s + m.dry, 0) / mushrooms.length : 0, seen: rings.filter(r => r.seen).length };
    },
    dispose(): void {
      scene.remove(caps, stems); capGeometry.dispose(); stemGeometry.dispose(); material.dispose(); caps.dispose(); stems.dispose();
    },
  };
}
