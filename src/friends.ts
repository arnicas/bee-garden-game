import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng } from './world';
import { leafPlanarDistance, leafSurfaceHeight, type LeafShelter } from './shelters';
import type { Flower } from './types';

/**
 * Ladybirds, the first of the meadow friends: small, harmless, found by flying
 * low or walking in the grass. Most crawl on low flower stems, some on the broad
 * leaves (tops and undersides) and a few on the ground by a stem, heading for it.
 * They follow the swaying stems and leaves, pause and turn, now and then flutter
 * to a nearby stem, and hold still when the bee is very close.
 * Aphids cluster on some stems just below the flower head (mostly cornflowers and poppies). A ladybird on
 * such a stem walks to the cluster and eats it down; untended clusters slowly
 * grow back. One instanced draw each for bodies, flying wings and aphids.
 */
export type LadybirdPerch = 'stem' | 'leaf' | 'ground' | 'flying';
export interface AphidCluster {
  id: number;
  flowerId: number;
  /** 0–1 share of the cluster still there. */
  population: number;
  /** Middle of the cluster on the stem surface, and the direction it faces. */
  position: THREE.Vector3;
  facing: THREE.Vector3;
}
export interface Ladybird {
  id: number;
  perch: LadybirdPerch;
  position: THREE.Vector3;
  /** Away from the surface it walks on (its back faces this way). */
  up: THREE.Vector3;
  seen: boolean;
}
interface Bird extends Ladybird {
  flower: Flower | null;
  leaf: LeafShelter | null;
  underside: boolean;
  /** Stem height 0–1, or leaf-local / ground x,z. */
  u: number; x: number; z: number;
  /** Around the stem (stems), or crawling direction (leaf/ground). */
  angle: number;
  heading: number;
  direction: 1 | -1;
  speed: number;
  pause: number;
  random: () => number;
  flight: { from: THREE.Vector3; to: Flower; toU: number; t: number } | null;
  eating: boolean;
}

const COUNT = 18;
const CLUSTERS = 14;
const APHIDS_PER_CLUSTER = 14;
/** Eaten per second by one ladybird, and regrown per second when left alone. */
const APHID_EAT_RATE = .03, APHID_REGROW_RATE = .004;
const MAX_FLYING = 3;
/** Half-extents of the shell dome (about 8.5 mm long at 10 cm per unit). */
const SHELL = new THREE.Vector3(.032, .026, .042);
const STEM_RADIUS = .03;
const VISIBLE_RANGE = 14;
const SHY_DISTANCE = .6;

export function createLadybirds(scene: THREE.Scene, seed: number, flowers: readonly Flower[], leaves: readonly LeafShelter[]) {
  const random = rng((seed ^ 0x1adb1d) >>> 0 || 11);
  const stems = flowers.filter(f => f.id !== 0);
  const birds: Bird[] = [];
  for (let id = 0; id < COUNT && stems.length; id++) {
    const roll = random();
    const perch: LadybirdPerch = roll < .55 || !leaves.length ? 'stem' : roll < .85 ? 'leaf' : 'ground';
    const flower = stems[Math.floor(random() * stems.length)];
    const leaf = perch === 'leaf' ? leaves[Math.floor(random() * leaves.length)] : null;
    const r = random() * .5, t = random() * Math.PI * 2;
    birds.push({
      id, perch, position: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), seen: false,
      flower: perch === 'leaf' ? null : flower, leaf, underside: perch === 'leaf' && random() < .45,
      u: .1 + random() * .32,
      x: perch === 'leaf' ? Math.cos(t) * r * .8 : Math.cos(t) * (.18 + r * .5),
      z: perch === 'leaf' ? Math.sin(t) * r : Math.sin(t) * (.18 + r * .5),
      angle: random() * Math.PI * 2, heading: random() * Math.PI * 2,
      direction: random() < .5 ? 1 : -1, speed: .035 + random() * .03, pause: random() * 3,
      random: rng((seed + id * 7919) >>> 0 || 3), flight: null, eating: false,
    });
  }

  // ---- aphids: clusters on stems, mostly cornflowers and poppies (black bean
  // aphids on poppies are dark; the others green).
  interface Cluster extends AphidCluster { flower: Flower; u: number; angle: number; aphids: { du: number; da: number; size: number; turn: number }[] }
  const clusters: Cluster[] = [];
  const hosts = stems.filter(f => f.species !== 'daisy'), daisies = stems.filter(f => f.species === 'daisy');
  const clusterOn = new Map<number, Cluster>();
  /** A point on the stem just below the flower head, clear of its petals and cup. */
  const underHead = (f: Flower, r: number) => {
    const h = Math.max(.2, f.center.y - f.base.y);
    return THREE.MathUtils.clamp(1 - (f.radius * .45 + .06 + r * .05) / h, .45, .92);
  };
  for (let id = 0; id < CLUSTERS && stems.length; id++) {
    const pool = random() < .8 && hosts.length ? hosts : daisies.length ? daisies : stems;
    const flower = pool[Math.floor(random() * pool.length)];
    if (clusterOn.has(flower.id)) continue;
    const cluster: Cluster = {
      id: clusters.length, flowerId: flower.id, flower, population: .6 + random() * .4, position: new THREE.Vector3(), facing: new THREE.Vector3(),
      u: underHead(flower, random()), angle: random() * Math.PI * 2,
      aphids: Array.from({ length: APHIDS_PER_CLUSTER }, () => ({ du: (random() - .5) * .07, da: (random() - .5) * 1.4, size: .7 + random() * .5, turn: (random() - .5) * .6 })),
    };
    clusters.push(cluster); clusterOn.set(flower.id, cluster);
  }
  // A few ladybirds start near a cluster, so they can be found at work.
  for (const cluster of clusters.slice(0, 4)) {
    const bird = birds.find(b => b.perch === 'stem' && !clusters.some(c => c.flower === b.flower));
    if (bird) { bird.flower = cluster.flower; bird.u = Math.max(.06, cluster.u - .12); bird.direction = 1; }
  }

  // ---- art: shell dome, black head and belly, six tiny legs, in one geometry.
  const part = (geometry: THREE.BufferGeometry, value: number) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(value), 1));
    return g;
  };
  const pieces: THREE.BufferGeometry[] = [
    part(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(SHELL.x, SHELL.y, SHELL.z), 0),
    part(new THREE.CircleGeometry(1, 18).rotateX(Math.PI / 2).scale(SHELL.x * .96, 1, SHELL.z * .96).translate(0, .002, 0), 1),
    part(new THREE.SphereGeometry(.0135, 10, 6).scale(1.15, .8, 1).translate(0, .007, SHELL.z * .98), 1),
  ];
  for (const side of [-1, 1]) for (const along of [-.55, 0, .55]) {
    // Short legs angled down and slightly forward/back, mostly tucked under the shell.
    const leg = new THREE.CylinderGeometry(.002, .0015, .019, 3).rotateX(along * .5).rotateZ(side * .75).translate(side * SHELL.x * .92, -.003, along * SHELL.z * .9);
    pieces.push(part(leg, 1));
  }
  const bodyGeometry = mergeGeometries(pieces, false)!;
  for (const piece of pieces) piece.dispose();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .26, metalness: 0 });
  bodyMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float aPart; varying float vPart; varying vec3 vShell;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vPart = aPart; vShell = position / vec3(${SHELL.x}, ${SHELL.y}, ${SHELL.z});`);
    shader.fragmentShader = `varying float vPart; varying vec3 vShell;
      float ladySpot(vec2 p, vec2 c, float r) { return 1. - smoothstep(r - .035, r + .01, length(p - c)); }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 black = vec3(.035, .03, .028);
      if (vPart > .5) diffuseColor.rgb = black;
      else {
        // A seven-spot ladybird: x across, y along (head at +1).
        vec2 p = vec2(vShell.x, vShell.z);
        vec2 m = vec2(abs(p.x), p.y);
        float spots = ladySpot(p, vec2(0., .58), .16);
        spots = max(spots, ladySpot(m, vec2(.42, .24), .19));
        spots = max(spots, ladySpot(m, vec2(.52, -.24), .17));
        spots = max(spots, ladySpot(m, vec2(.3, -.64), .15));
        float seam = (1. - smoothstep(.012, .03, abs(p.x))) * (1. - smoothstep(.6, .66, p.y));
        vec3 red = mix(vec3(.80, .10, .05), vec3(.93, .30, .12), smoothstep(.2, 1., vShell.y) * .45);
        vec3 shell = mix(red, black, max(spots, seam));
        // The pronotum: a black band behind the head with two white cheek patches.
        float pronotum = smoothstep(.70, .76, p.y);
        float cheeks = ladySpot(m, vec2(.5, .86), .16) * pronotum;
        shell = mix(shell, black, pronotum);
        shell = mix(shell, vec3(.93, .9, .82), cheeks);
        diffuseColor.rgb = shell;
      }`);
  };
  bodyMaterial.customProgramCacheKey = () => 'bee-ladybird-v1';
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, Math.max(1, birds.length));
  bodies.name = 'ladybirds'; bodies.frustumCulled = false; bodies.castShadow = false;
  scene.add(bodies);

  const wingGeometry = mergeGeometries([
    new THREE.CircleGeometry(1, 12).scale(.035, .07, 1).rotateX(-Math.PI / 2).translate(-.03, .03, -.01),
    new THREE.CircleGeometry(1, 12).scale(.035, .07, 1).rotateX(-Math.PI / 2).translate(.03, .03, -.01),
  ], false)!;
  const wingMaterial = new THREE.MeshBasicMaterial({ color: '#f4efe2', transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false });
  const wings = new THREE.InstancedMesh(wingGeometry, wingMaterial, MAX_FLYING);
  wings.name = 'ladybird wings'; wings.frustumCulled = false; wings.count = 0;
  scene.add(wings);

  const aphidGeometry = new THREE.SphereGeometry(1, 7, 5).scale(.0065, .0055, .0105);
  const aphidMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .45, metalness: 0 });
  const aphidMesh = new THREE.InstancedMesh(aphidGeometry, aphidMaterial, Math.max(1, clusters.length * APHIDS_PER_CLUSTER));
  aphidMesh.name = 'aphids'; aphidMesh.frustumCulled = false;
  const green = new THREE.Color('#8db24a'), paleGreen = new THREE.Color('#b5c96a'), dark = new THREE.Color('#2e2a2c'), tint = new THREE.Color();
  clusters.forEach(cluster => cluster.aphids.forEach((aphid, i) => {
    tint.copy(cluster.flower.species === 'poppy' ? dark : green).lerp(cluster.flower.species === 'poppy' ? green : paleGreen, cluster.flower.species === 'poppy' ? .08 * aphid.size : (aphid.size - .7) * .8);
    aphidMesh.setColorAt(cluster.id * APHIDS_PER_CLUSTER + i, tint);
  }));
  if (aphidMesh.instanceColor) aphidMesh.instanceColor.needsUpdate = true;
  scene.add(aphidMesh);

  const matrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3(), tangent = new THREE.Vector3(), radial = new THREE.Vector3();
  const local = new THREE.Vector3(), normal = new THREE.Vector3();
  let lastTime = 0, flutterTimer = 25;
  const aphidMatrix = new THREE.Matrix4(), aphidScale = new THREE.Vector3();

  const stemPoint = (f: Flower, u: number, out: THREE.Vector3) =>
    out.set(f.base.x + (f.center.x - f.base.x) * u * u, f.base.y + (f.center.y - f.base.y) * u, f.base.z + (f.center.z - f.base.z) * u * u);

  /** Places a bird and writes its body matrix: up is the surface normal, forward its heading. */
  function pose(bird: Bird, time: number): void {
    if (bird.perch === 'stem' && bird.flower) {
      const f = bird.flower, h = f.center.y - f.base.y;
      stemPoint(f, bird.u, bird.position);
      tangent.set((f.center.x - f.base.x) * 2 * bird.u, h, (f.center.z - f.base.z) * 2 * bird.u).normalize();
      radial.set(Math.cos(bird.angle), 0, Math.sin(bird.angle));
      radial.addScaledVector(tangent, -radial.dot(tangent)).normalize();
      bird.position.addScaledVector(radial, STEM_RADIUS);
      up.copy(radial); forward.copy(tangent).multiplyScalar(bird.direction);
    } else if (bird.perch === 'leaf' && bird.leaf) {
      const leaf = bird.leaf, e = .02;
      const y = leafSurfaceHeight(bird.x, bird.z);
      normal.set(-(leafSurfaceHeight(bird.x + e, bird.z) - y) / e, 1, -(leafSurfaceHeight(bird.x, bird.z + e) - y) / e).normalize();
      if (bird.underside) normal.negate();
      local.set(bird.x, y + (bird.underside ? -.018 : .004), bird.z);
      bird.position.copy(local).applyQuaternion(leaf.rotation).add(leaf.center);
      up.copy(normal).applyQuaternion(leaf.rotation);
      forward.set(Math.sin(bird.heading), 0, Math.cos(bird.heading)).applyQuaternion(leaf.rotation);
    } else if (bird.perch === 'ground' && bird.flower) {
      bird.position.set(bird.flower.base.x + bird.x, 0, bird.flower.base.z + bird.z);
      bird.position.y = meadowGroundHeight(bird.position.x, bird.position.z) + .006;
      up.set(0, 1, 0); forward.set(Math.sin(bird.heading), 0, Math.cos(bird.heading));
    } else if (bird.perch === 'flying' && bird.flight) {
      const { from, to, toU, t } = bird.flight;
      stemPoint(to, toU, local);
      bird.position.lerpVectors(from, local, t);
      bird.position.y += Math.sin(t * Math.PI) * .35;
      forward.subVectors(local, from).setY(0).normalize();
      up.set(0, 1, 0).addScaledVector(forward, -.5).normalize();
      void time;
    }
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1).addScaledVector(up, -up.z);
    forward.normalize();
    right.crossVectors(up, forward).normalize();
    forward.crossVectors(right, up);
    bird.up.copy(up);
    matrix.makeBasis(right, up, forward).setPosition(bird.position);
  }

  function startFlight(bird: Bird): void {
    const from = bird.position.clone();
    let target: Flower | null = null, best = Infinity;
    for (const f of stems) {
      if (f === bird.flower) continue;
      const d = Math.hypot(f.base.x - from.x, f.base.z - from.z);
      // Aphid-covered stems draw ladybirds from further away.
      const lure = (clusterOn.get(f.id)?.population ?? 0) > .2 ? 1.6 : 0;
      if (d > .8 && d < 3.2 && d - lure < best + bird.random() * .8) { best = d - lure; target = f; }
    }
    if (!target) return;
    const cluster = clusterOn.get(target.id);
    bird.flight = { from, to: target, toU: cluster ? Math.max(.06, cluster.u - .1) : .12 + bird.random() * .25, t: 0 };
    bird.perch = 'flying'; bird.leaf = null;
  }

  return {
    birds: birds as readonly Ladybird[],
    aphids: clusters as readonly AphidCluster[],
    /** Moves and places the ladybirds near the camera. */
    update(time: number, bee: THREE.Vector3, camera: THREE.Vector3, reducedMotion: boolean): void {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      flutterTimer -= dt;
      let flying = 0;
      for (const cluster of clusters) if (dt > 0 && !reducedMotion) cluster.population = Math.min(1, cluster.population + dt * APHID_REGROW_RATE);
      for (const bird of birds) {
        bird.eating = false;
        const near = bird.position.lengthSq() === 0 || bird.position.distanceTo(camera) < VISIBLE_RANGE;
        const shy = bird.position.distanceTo(bee) < SHY_DISTANCE;
        if (near && !reducedMotion && dt > 0) {
          if (bird.perch === 'flying' && bird.flight) {
            bird.flight.t += dt / 1.4;
            if (bird.flight.t >= 1) { bird.flower = bird.flight.to; bird.u = bird.flight.toU; bird.perch = 'stem'; bird.flight = null; bird.pause = 2 + bird.random() * 3; }
          } else if (shy) bird.pause = Math.max(bird.pause, .8);
          else if (bird.pause > 0) bird.pause -= dt;
          else {
            const step = bird.speed * dt;
            const cluster = bird.perch === 'stem' && bird.flower ? clusterOn.get(bird.flower.id) : undefined;
            if (cluster && cluster.population > .02 && Math.abs(cluster.u - bird.u) < .03) {
              // At the cluster: eat, slowly working around the stem to the aphids.
              bird.eating = true;
              cluster.population = Math.max(0, cluster.population - dt * APHID_EAT_RATE);
              bird.angle += Math.atan2(Math.sin(cluster.angle - bird.angle), Math.cos(cluster.angle - bird.angle)) * Math.min(1, dt * .8);
            } else if (bird.perch === 'stem' && bird.flower) {
              if (cluster && cluster.population > .02) bird.direction = cluster.u > bird.u ? 1 : -1;
              bird.u += bird.direction * step / Math.max(.3, bird.flower.center.y - bird.flower.base.y);
              const top = cluster ? Math.max(.5, cluster.u + .02) : .5;
              if (bird.u > top || bird.u < .05) { bird.u = THREE.MathUtils.clamp(bird.u, .05, top); bird.direction = bird.direction === 1 ? -1 : 1; bird.pause = .6 + bird.random() * 1.5; }
            } else if (bird.perch === 'leaf' && bird.leaf) {
              bird.x += Math.sin(bird.heading) * step; bird.z += Math.cos(bird.heading) * step;
              bird.heading += (bird.random() - .5) * dt * 1.2;
              if (leafPlanarDistance(bird.x, bird.z) > bird.leaf.radius * .62) { bird.heading += Math.PI * (.75 + bird.random() * .5); bird.x *= .98; bird.z *= .98; bird.pause = .5 + bird.random(); }
            } else if (bird.perch === 'ground' && bird.flower) {
              // Head for the stem, then climb it.
              const d = Math.hypot(bird.x, bird.z);
              bird.heading = Math.atan2(-bird.x, -bird.z) + Math.sin(time * .7 + bird.id) * .4;
              bird.x += Math.sin(bird.heading) * step; bird.z += Math.cos(bird.heading) * step;
              if (d < .045) { bird.perch = 'stem'; bird.u = .03; bird.direction = 1; bird.angle = Math.atan2(bird.z, bird.x); }
            }
            if (!bird.eating && bird.random() < dt * .08) bird.pause = 1 + bird.random() * 3;
          }
        }
        // Now and then a ladybird near the bee lifts its wing cases and flutters off.
        if (flutterTimer <= 0 && near && !shy && !reducedMotion && bird.perch === 'stem' && bird.position.distanceTo(bee) < 8) {
          startFlight(bird); flutterTimer = 40 + bird.random() * 50;
        }
        if (!near) { bodies.setMatrixAt(bird.id, hidden); continue; }
        pose(bird, time);
        bodies.setMatrixAt(bird.id, matrix);
        if (bird.perch === 'flying' && flying < MAX_FLYING) {
          const flap = .55 + .45 * Math.abs(Math.sin(time * 90));
          wings.setMatrixAt(flying++, matrix.clone().multiply(new THREE.Matrix4().makeScale(flap, 1, 1)));
        }
      }
      if (flutterTimer <= 0) flutterTimer = 10;
      bodies.instanceMatrix.needsUpdate = true;
      for (const cluster of clusters) {
        const f = cluster.flower, h = f.center.y - f.base.y;
        const near = Math.hypot(f.base.x - camera.x, f.base.z - camera.z) < VISIBLE_RANGE;
        const shown = Math.round(cluster.population * APHIDS_PER_CLUSTER);
        stemPoint(f, cluster.u, cluster.position);
        tangent.set((f.center.x - f.base.x) * 2 * cluster.u, h, (f.center.z - f.base.z) * 2 * cluster.u).normalize();
        cluster.facing.set(Math.cos(cluster.angle), 0, Math.sin(cluster.angle)).addScaledVector(tangent, -Math.cos(cluster.angle) * tangent.x - Math.sin(cluster.angle) * tangent.z).normalize();
        cluster.position.addScaledVector(cluster.facing, STEM_RADIUS);
        cluster.aphids.forEach((aphid, i) => {
          const index = cluster.id * APHIDS_PER_CLUSTER + i;
          if (!near || i >= shown) { aphidMesh.setMatrixAt(index, hidden); return; }
          const u = cluster.u + aphid.du;
          stemPoint(f, u, local);
          tangent.set((f.center.x - f.base.x) * 2 * u, h, (f.center.z - f.base.z) * 2 * u).normalize();
          radial.set(Math.cos(cluster.angle + aphid.da), 0, Math.sin(cluster.angle + aphid.da));
          radial.addScaledVector(tangent, -radial.dot(tangent)).normalize();
          local.addScaledVector(radial, STEM_RADIUS * .72);
          // Aphids sit head-down along the stem, each turned a little.
          forward.copy(tangent).multiplyScalar(-1).applyAxisAngle(radial, aphid.turn);
          right.crossVectors(radial, forward).normalize();
          aphidMatrix.makeBasis(right, radial, forward).scale(aphidScale.setScalar(aphid.size)).setPosition(local);
          aphidMesh.setMatrixAt(index, aphidMatrix);
        });
      }
      aphidMesh.instanceMatrix.needsUpdate = true;
      wings.count = flying; if (flying) wings.instanceMatrix.needsUpdate = true;
    },
    /** The nearest ladybird to a point, for discovery. */
    nearest(point: THREE.Vector3): { bird: Ladybird; distance: number } | null {
      let found: Bird | null = null, distance = Infinity;
      for (const bird of birds) { const d = bird.position.distanceTo(point); if (d < distance) { distance = d; found = bird; } }
      return found ? { bird: found, distance } : null;
    },
    markSeen(id: number): void { const bird = birds[id]; if (bird) bird.seen = true; },
    seenCount(): number { return birds.filter(b => b.seen).length; },
    reset(): void { for (const bird of birds) bird.seen = false; },
    diagnostics() { return { count: birds.length, seen: birds.filter(b => b.seen).length, flying: birds.filter(b => b.perch === 'flying').length, eating: birds.filter(b => b.eating).length, aphids: clusters.reduce((sum, c) => sum + c.population, 0) }; },
    dispose(): void {
      scene.remove(bodies, wings, aphidMesh); bodyGeometry.dispose(); bodyMaterial.dispose(); wingGeometry.dispose(); wingMaterial.dispose(); bodies.dispose(); wings.dispose();
      aphidGeometry.dispose(); aphidMaterial.dispose(); aphidMesh.dispose();
    },
  };
}
