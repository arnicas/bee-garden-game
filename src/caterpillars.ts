import * as THREE from 'three';
import { rng } from './world';
import { leafEdge, leafSurfaceHeight, leafUniforms, type LeafShelter } from './shelters';

/**
 * Caterpillars on the broad leaves: green moth caterpillars about 2.5 cm long,
 * each lying along a leaf edge and chewing its way in, so curved bites open in
 * the leaf (the leaf shader cuts them out, see `uLeafBites` in shelters.ts).
 * A bite slowly widens while one eats; then it moves a little way along the edge
 * and starts another. Seen from under a leaf, the bites show as gaps of sky.
 * One instanced draw for the body segments.
 */
export interface Caterpillar {
  id: number;
  leafId: number;
  position: THREE.Vector3;
  seen: boolean;
}
interface Bite { angle: number; radius: number; seed: number }
interface Crawler extends Caterpillar {
  leaf: LeafShelter;
  /** Where its head is along the leaf edge, and which way its body lies. */
  angle: number;
  side: 1 | -1;
  bites: Bite[];
  state: 'eating' | 'crawling' | 'resting';
  /** Angle it is crawling to. */
  target: number;
  random: () => number;
  start: { angle: number; bites: Bite[] };
}

const SEGMENTS = 11;
const SEGMENT_SPACING = .023;
const BODY_RADIUS = .017;
const MAX_BITES = 3, BITE_START = .035, BITE_MAX = .15, EAT_RATE = .0011;
const VISIBLE_RANGE = 11;

export function createCaterpillars(scene: THREE.Scene, seed: number, shelters: readonly LeafShelter[], count = 5) {
  const random = rng((seed ^ 0xca7e) >>> 0 || 19);
  const bites = leafUniforms.uLeafBites.value;
  const crawlers: Crawler[] = [];
  const leaves = shelters;
  // A few leaves have one each, chosen by the seed (five normally, more when the leaves are lush).
  const chosen = new Set<number>();
  while (chosen.size < Math.min(count, leaves.length)) chosen.add(Math.floor(random() * leaves.length));
  for (const index of chosen) {
    const leaf = leaves[index];
    const side: 1 | -1 = random() < .5 ? 1 : -1;
    // Along one side of the blade, clear of the tip and the stalk end.
    const angle = side * (.8 + random() * .5);
    const older: Bite[] = [];
    const earlier = random() < .6 ? 1 : 2;
    for (let i = 0; i < earlier; i++) older.push({ angle: angle - side * (i + 1) * (.3 + random() * .06), radius: .08 + random() * .06, seed: random() * 6 });
    const current: Bite = { angle, radius: BITE_START + random() * .04, seed: random() * 6 };
    const start = { angle, bites: [...older.reverse(), current].map(b => ({ ...b })) };
    crawlers.push({
      id: crawlers.length, leafId: leaf.id, leaf, position: new THREE.Vector3(), seen: false,
      angle, side, bites: start.bites.map(b => ({ ...b })), state: 'eating', target: angle, random: rng((seed + leaf.id * 613) >>> 0 || 23), start,
    });
  }

  // ---- art: a soft, slightly flattened segment with a pale line along each
  // side and a darker back; the head segment is tinted per instance.
  const segment = new THREE.SphereGeometry(1, 10, 6);
  const green = new THREE.Color('#8cb553'), back = new THREE.Color('#5e8a37'), line = new THREE.Color('#eef3cf'), belly = new THREE.Color('#a9c77a'), colour = new THREE.Color();
  const colours: number[] = [];
  for (let i = 0; i < segment.attributes.position.count; i++) {
    const x = segment.attributes.position.getX(i), y = segment.attributes.position.getY(i);
    colour.copy(green).lerp(back, THREE.MathUtils.smoothstep(y, .4, .95) * .8).lerp(belly, THREE.MathUtils.smoothstep(-y, .2, .9) * .7);
    if (Math.abs(x) > .72 && y > -.25 && y < .2) colour.lerp(line, .75);
    colours.push(colour.r, colour.g, colour.b);
  }
  segment.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  segment.deleteAttribute('uv');
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: 0 });
  const total = Math.max(1, crawlers.length * SEGMENTS);
  const mesh = new THREE.InstancedMesh(segment, material, total);
  mesh.name = 'caterpillars'; mesh.frustumCulled = false; mesh.castShadow = false;
  const white = new THREE.Color('#ffffff'), head = new THREE.Color('#7b8646');
  for (let i = 0; i < total; i++) mesh.setColorAt(i, i % SEGMENTS === 0 ? head : white);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  const edge = new THREE.Vector3(), local = new THREE.Vector3(), normal = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
  const points = Array.from({ length: SEGMENTS }, () => new THREE.Vector3());
  const leafTurn = new THREE.Matrix4(), matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  let lastTime = 0;

  /** A point inset from the leaf edge, on the upper surface (leaf-local). */
  function onLeaf(angle: number, inset: number, lift: number, out: THREE.Vector3): THREE.Vector3 {
    leafEdge(angle, edge);
    const r = Math.hypot(edge.x, edge.z), k = Math.max(0, r - inset) / r;
    out.set(edge.x * k, 0, edge.z * k);
    out.y = leafSurfaceHeight(out.x, out.z) + lift;
    return out;
  }
  function writeBites(c: Crawler): void {
    for (let k = 0; k < MAX_BITES; k++) {
      const bite = c.bites[k], slot = bites[c.leafId * MAX_BITES + k];
      if (!bite) { slot.set(0, 0, 0, 0); continue; }
      // The bite is centred just outside the edge, so it cuts a curved notch.
      onLeaf(bite.angle, -bite.radius * .35, 0, local);
      slot.set(local.x, local.z, bite.radius, bite.seed);
    }
  }
  for (const c of crawlers) writeBites(c);

  function pose(c: Crawler, time: number, slot: number): void {
    const bite = c.bites[c.bites.length - 1];
    const eating = c.state === 'eating';
    // Head at the inner edge of the bite it is working on; the body trails back
    // along the edge. A crawl sends a small hump from tail to head.
    const headInset = eating ? bite.radius * .65 + BODY_RADIUS * .6 : .06;
    leafEdge(c.angle, edge);
    const rim = Math.hypot(edge.x, edge.z);
    for (let k = 0; k < SEGMENTS; k++) {
      const along = k * SEGMENT_SPACING;
      const angle = c.angle - c.side * along / rim;
      const inset = THREE.MathUtils.lerp(headInset, .13, THREE.MathUtils.smoothstep(k, 0, 4));
      const wave = c.state === 'crawling' ? Math.max(0, Math.sin(time * 5 - k * .7)) * .006 : 0;
      const taper = k === 0 ? .9 : 1 - Math.max(0, k - 6) * .08;
      onLeaf(angle, inset, BODY_RADIUS * taper * .8 + wave, points[k]);
    }
    if (eating) {
      // Chewing: the head sweeps a little side to side across the bite.
      edge.set(-(points[1].z - points[0].z), 0, points[1].x - points[0].x).normalize();
      points[0].addScaledVector(edge, Math.sin(time * 5.5 + c.id) * .006);
    }
    leafTurn.makeRotationFromQuaternion(c.leaf.rotation);
    c.position.copy(points[0]).applyQuaternion(c.leaf.rotation).add(c.leaf.center);
    for (let k = 0; k < SEGMENTS; k++) {
      const p = points[k];
      const e = .02, y = leafSurfaceHeight(p.x, p.z);
      normal.set(-(leafSurfaceHeight(p.x + e, p.z) - y) / e, 1, -(leafSurfaceHeight(p.x, p.z + e) - y) / e).normalize();
      forward.subVectors(k === 0 ? p : points[k - 1], k === 0 ? points[1] : p).normalize();
      up.copy(normal).addScaledVector(forward, -normal.dot(forward)).normalize();
      right.crossVectors(up, forward).normalize();
      const taper = k === 0 ? .9 : 1 - Math.max(0, k - 6) * .08;
      matrix.makeBasis(right, up, forward).scale(scale.set(BODY_RADIUS * taper, BODY_RADIUS * taper * .9, BODY_RADIUS * taper * 1.3));
      local.copy(p).applyQuaternion(c.leaf.rotation).add(c.leaf.center);
      matrix.premultiply(leafTurn);
      matrix.setPosition(local);
      mesh.setMatrixAt(slot * SEGMENTS + k, matrix);
    }
  }

  return {
    caterpillars: crawlers as readonly Caterpillar[],
    update(time: number, camera: THREE.Vector3, reducedMotion: boolean): void {
      const dt = reducedMotion ? 0 : Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      let drawn = 0;
      for (const c of crawlers) {
        const bite = c.bites[c.bites.length - 1];
        if (dt > 0) {
          if (c.state === 'eating') {
            bite.radius = Math.min(BITE_MAX, bite.radius + dt * EAT_RATE);
            if (bite.radius >= BITE_MAX) {
              if (c.bites.length < MAX_BITES) { c.state = 'crawling'; c.target = c.angle + c.side * (.36 + c.random() * .12); }
              else c.state = 'resting';
            }
          } else if (c.state === 'crawling') {
            const step = dt * .018 * c.side;
            c.angle += step;
            if ((c.target - c.angle) * c.side <= 0) {
              c.angle = c.target; c.state = 'eating';
              c.bites.push({ angle: c.angle, radius: .012, seed: c.random() * 6 });
            }
          }
          writeBites(c);
        }
        const near = c.leaf.center.distanceTo(camera) < VISIBLE_RANGE;
        if (!near) continue;
        pose(c, time, drawn++);
      }
      mesh.count = drawn * SEGMENTS; mesh.instanceMatrix.needsUpdate = true;
    },
    nearest(point: THREE.Vector3): { caterpillar: Caterpillar; distance: number } | null {
      let found: Crawler | null = null, distance = Infinity;
      for (const c of crawlers) { const d = c.position.distanceTo(point); if (d < distance) { distance = d; found = c; } }
      return found ? { caterpillar: found, distance } : null;
    },
    markSeen(id: number): void { const c = crawlers[id]; if (c) c.seen = true; },
    seenCount(): number { return crawlers.filter(c => c.seen).length; },
    /** A new day: the leaves as they were in the morning. */
    reset(): void {
      for (const c of crawlers) { c.seen = false; c.angle = c.start.angle; c.target = c.angle; c.state = 'eating'; c.bites = c.start.bites.map(b => ({ ...b })); writeBites(c); }
    },
    diagnostics() {
      return { count: crawlers.length, bites: crawlers.reduce((n, c) => n + c.bites.length, 0), biteArea: crawlers.reduce((a, c) => a + c.bites.reduce((s, b) => s + b.radius * b.radius, 0), 0), eating: crawlers.filter(c => c.state === 'eating').length, seen: crawlers.filter(c => c.seen).length };
    },
    dispose(): void {
      for (const c of crawlers) for (let k = 0; k < MAX_BITES; k++) bites[c.leafId * MAX_BITES + k].set(0, 0, 0, 0);
      scene.remove(mesh); segment.dispose(); material.dispose(); mesh.dispose();
    },
  };
}
