import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng, stalkPoint, stalkTangent } from './world';
import type { AphidCluster } from './friends';
import type { AntNestSpot, Flower } from './types';

/**
 * Ant trails: a few colonies of black garden ants, each with a small soil
 * mound in the grass and a busy trail from it to one flower stem, up to the
 * aphid cluster there (ants tend aphids for their honeydew). The ants walk the
 * trail both ways, stop briefly when they meet head-on, and a few carry a soil
 * grain. A bee walking in the grass is simply walked around. In rain the
 * trail empties as they go home into the mound, and fills again when it clears;
 * in the heat they hurry. One instanced draw for the ants, one for crumbs, one
 * for the mounds; they are only posed near the camera.
 */
export interface AntColony {
  id: number;
  flowerId: number;
  nest: THREE.Vector3;
  seen: boolean;
}
interface Ant {
  /** Distance along the trail from the nest hole (0) to the aphids (length). */
  s: number;
  dir: 1 | -1;
  lane: number;
  speed: number;
  pause: number;
  /** In the nest: hidden, until it comes out again. */
  inside: boolean;
  wait: number;
  /** Just met another ant: carries on for a moment before it can stop again. */
  cool: number;
  carry: boolean;
  random: () => number;
  position: THREE.Vector3;
  detour: boolean;
}
interface Colony extends AntColony {
  flower: Flower;
  /** Ground path from the nest hole to the stem foot, with lengths. */
  path: THREE.Vector3[];
  lengths: number[];
  groundLength: number;
  stemLength: number;
  topU: number;
  /** Which side of the stem the trail climbs. */
  angle: number;
  ants: Ant[];
}

const ANTS_PER_COLONY = 36;
/** A worker is about 4.5 mm long (black garden ants are 3.5–5 mm), true to size. */
const ANT_SCALE = 1;
const MOUND_RADIUS = .28, MOUND_HEIGHT = .08;
/** The nest hole: its radius and depth, with a low crumbly lip around it. */
const HOLE_RADIUS = .052, HOLE_DEPTH = .05;
const STEM_RADIUS = .026;
const LANE_WIDTH = .016;
const VISIBLE_RANGE = 5;
/** How close a walking bee's body comes; ants step around it. */
const BEE_CLEARANCE = .085;

/** Height of the mound above the ground at a distance r from its middle. */
const moundHeight = (r: number) => {
  if (r >= MOUND_RADIUS) return 0;
  const heap = MOUND_HEIGHT * Math.pow(1 - (r / MOUND_RADIUS) ** 2, 1.4);
  const lip = .011 * Math.exp(-(((r - HOLE_RADIUS * 1.35) / (HOLE_RADIUS * .5)) ** 2));
  const hole = HOLE_DEPTH * (1 - THREE.MathUtils.smoothstep(r, HOLE_RADIUS * .45, HOLE_RADIUS * 1.05));
  return heap + lip - hole;
};

export function createAnts(scene: THREE.Scene, seed: number, flowers: readonly Flower[], nests: readonly AntNestSpot[], aphids: readonly AphidCluster[]) {
  const random = rng((seed ^ 0xa27) >>> 0 || 5);
  const colonies: Colony[] = [];
  for (const spot of nests) {
    const flower = flowers.find(f => f.id === spot.flowerId);
    if (!flower) continue;
    const cluster = aphids.find(c => c.flowerId === flower.id);
    const nest = new THREE.Vector3(spot.x, meadowGroundHeight(spot.x, spot.z) + MOUND_HEIGHT * .85, spot.z);
    // A gently wandering path across the ground to the foot of the stem.
    const toStem = new THREE.Vector2(flower.base.x - spot.x, flower.base.z - spot.z);
    const span = toStem.length(); toStem.normalize();
    const side = new THREE.Vector2(-toStem.y, toStem.x);
    const bend = (random() - .5) * .5, wiggle = random() * 6.28;
    const path: THREE.Vector3[] = [], lengths: number[] = [0];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, along = t * (span - STEM_RADIUS * 1.4);
      const off = (Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3 + wiggle) * .05 * Math.sin(t * Math.PI));
      const x = spot.x + toStem.x * along + side.x * off, z = spot.z + toStem.y * along + side.y * off;
      path.push(new THREE.Vector3(x, meadowGroundHeight(x, z) + moundHeight(Math.hypot(x - spot.x, z - spot.z)) + .003, z));
      if (i > 0) lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]));
    }
    const groundLength = lengths[lengths.length - 1];
    const topU = cluster ? THREE.MathUtils.clamp(cluster.u - .03, .3, .9) : .55;
    const stemLength = Math.max(.2, flower.center.y - flower.base.y) * topU;
    const length = groundLength + stemLength;
    const colony: Colony = {
      id: colonies.length, flowerId: flower.id, nest, seen: false, flower, path, lengths, groundLength, stemLength, topU,
      angle: Math.atan2(-toStem.y, -toStem.x), ants: [],
    };
    for (let i = 0; i < ANTS_PER_COLONY; i++) {
      const antRandom = rng((seed + colony.id * 7907 + i * 131) >>> 0 || 7);
      colony.ants.push({
        s: antRandom() * length, dir: antRandom() < .5 ? 1 : -1, lane: antRandom() * 2 - 1, speed: .16 + antRandom() * .07,
        pause: 0, inside: false, wait: 0, cool: 0, carry: antRandom() < .2, random: antRandom, position: new THREE.Vector3(), detour: false,
      });
    }
    colonies.push(colony);
  }
  const total = Math.max(1, colonies.length * ANTS_PER_COLONY);

  // ---- art: head, thorax, waist and gaster, six legs and two elbowed antennae,
  // head forward along +z, in one geometry. Legs are tagged for a walking swing.
  const tag = (geometry: THREE.BufferGeometry, leg: number, hip: THREE.Vector3 | null) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    g.setAttribute('aLeg', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(leg), 1));
    const hips = new Float32Array(g.attributes.position.count * 3);
    if (hip) for (let i = 0; i < hips.length; i += 3) hips.set([hip.x, hip.y, hip.z], i);
    g.setAttribute('aHip', new THREE.Float32BufferAttribute(hips, 3));
    return g;
  };
  const rod = (from: THREE.Vector3, to: THREE.Vector3, radius: number, leg: number, hip: THREE.Vector3 | null) => {
    const length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(radius * .75, radius, length, 3, 1, true).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    return tag(g.translate(from.x, from.y, from.z), leg, hip);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const lift = .0055;
  const pieces: THREE.BufferGeometry[] = [
    tag(new THREE.SphereGeometry(1, 6, 4).scale(.0048, .0042, .0052).translate(0, lift + .001, .0165), 0, null),
    tag(new THREE.SphereGeometry(1, 5, 3).scale(.0032, .0033, .0068).translate(0, lift + .0008, .0065), 0, null),
    tag(new THREE.SphereGeometry(1, 3, 2).scale(.0017, .0022, .0018).translate(0, lift + .0006, -.0012), 0, null),
    tag(new THREE.SphereGeometry(1, 7, 4).scale(.0062, .0054, .0088).translate(0, lift + .0018, -.0105), 0, null),
  ];
  // Antennae: a long scape out to the side, then the bent tip forward and down.
  for (const s of [-1, 1]) {
    const root = v(s * .0022, lift + .0035, .0205), elbow = v(s * .0062, lift + .0082, .0255), tip = v(s * .0082, lift + .0035, .0335);
    pieces.push(rod(root, elbow, .00055, 0, null), rod(elbow, tip, .0005, 0, null));
  }
  [-1, 1].forEach((side, sideIndex) => [.0095, .0065, .0035].forEach((z, i) => {
    const splay = [.45, .05, -.55][i];
    const hip = v(side * .0022, lift - .0012, z);
    const knee = v(side * .0085, lift + .0042, z + splay * .006);
    const foot = v(side * .0145, -.0004, z + splay * .016);
    const leg = sideIndex * 3 + i + 1;
    pieces.push(rod(hip, knee, .00075, leg, hip), rod(knee, foot, .0006, leg, hip));
  }));
  const antGeometry = mergeGeometries(pieces, false)!;
  for (const piece of pieces) piece.dispose();
  antGeometry.scale(ANT_SCALE, ANT_SCALE, ANT_SCALE);
  const walking = new Float32Array(total);
  const walkAttribute = new THREE.InstancedBufferAttribute(walking, 1);
  antGeometry.setAttribute('aWalk', walkAttribute);
  const antMaterial = new THREE.MeshStandardMaterial({ color: '#241b17', roughness: .38, metalness: 0 });
  const antUniforms = { uAntTime: { value: 0 } };
  antMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, antUniforms);
    shader.vertexShader = `attribute float aLeg; attribute vec3 aHip; attribute float aWalk; uniform float uAntTime;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      if (aLeg > .5 && aWalk > .01) {
        // Tripod gait, quick little steps.
        float id = aLeg - 1., side = floor(id / 3.), along = mod(id, 3.);
        float phase = uAntTime * 34. + float(gl_InstanceID) * 1.7 + mod(side + along, 2.) * 3.14159;
        float swing = sin(phase) * .5 * aWalk * (side > .5 ? -1. : 1.);
        vec3 hip = aHip * ${ANT_SCALE.toFixed(3)};
        vec3 d = transformed - hip;
        float c = cos(swing), s = sin(swing);
        d.xz = vec2(c * d.x - s * d.z, s * d.x + c * d.z);
        d.y += max(0., cos(phase)) * .0025 * aWalk * clamp(length(d.xz) / .012, 0., 1.);
        transformed = hip + d;
      }`);
  };
  antMaterial.customProgramCacheKey = () => 'bee-ant-v1';
  const antMesh = new THREE.InstancedMesh(antGeometry, antMaterial, total);
  antMesh.name = 'ants'; antMesh.frustumCulled = false; antMesh.castShadow = false;
  scene.add(antMesh);

  const crumbGeometry = new THREE.DodecahedronGeometry(.0045 * ANT_SCALE, 0).scale(1, .8, 1.1);
  const crumbMaterial = new THREE.MeshStandardMaterial({ color: '#7a5c3e', roughness: 1 });
  const crumbs = new THREE.InstancedMesh(crumbGeometry, crumbMaterial, total);
  crumbs.name = 'ant crumbs'; crumbs.frustumCulled = false; crumbs.count = 0;
  scene.add(crumbs);

  // ---- mounds: a low heap of crumbly soil with the dark nest hole on top, and
  // loose grains scattered around it.
  const moundParts: THREE.BufferGeometry[] = [];
  const soil = new THREE.Color('#8b6c49'), darkSoil = new THREE.Color('#5a4431'), paleSoil = new THREE.Color('#a88a62'), hole = new THREE.Color('#1c140f'), colour = new THREE.Color();
  colonies.forEach(colony => {
    const moundRandom = rng((seed ^ (colony.id + 1) * 0x5bd1) >>> 0 || 9);
    // Rings bunch up toward the middle so the hole and its lip have real depth.
    const rings = 13, sides = 56;
    // Worn paths radiating down the slope, one along the trail itself.
    const furrows = [colony.angle + Math.PI, ...Array.from({ length: 5 }, () => moundRandom() * Math.PI * 2)];
    const positions: number[] = [], colours: number[] = [], index: number[] = [];
    for (let r = 0; r <= rings; r++) for (let a = 0; a < sides; a++) {
      const t = Math.pow(r / rings, 1.55), angle = a / sides * Math.PI * 2;
      const ragged = MOUND_RADIUS * (1 + .14 * Math.sin(angle * 3 + colony.id) + .08 * Math.sin(angle * 7 + colony.id * 2));
      const radius = t * ragged, rr = t * MOUND_RADIUS;
      const x = colony.nest.x + Math.cos(angle) * radius, z = colony.nest.z + Math.sin(angle) * radius;
      const bump = (moundRandom() - .5) * .009 * (1 - t) * (rr > HOLE_RADIUS ? 1 : .3);
      let groove = 0;
      if (rr > HOLE_RADIUS * 1.5) for (const f of furrows) {
        const d = Math.atan2(Math.sin(angle - f), Math.cos(angle - f)) * rr;
        groove = Math.max(groove, Math.exp(-((d / .016) ** 2)) * THREE.MathUtils.smoothstep(rr, HOLE_RADIUS * 1.5, HOLE_RADIUS * 2.4) * (1 - t * .6));
      }
      positions.push(x, meadowGroundHeight(x, z) + moundHeight(rr) + bump * (t < .98 ? 1 : 0) - groove * .006 + .003, z);
      colour.copy(soil).lerp(moundRandom() < .5 ? darkSoil : paleSoil, moundRandom() * .6);
      // Dark down the hole, a pale dry lip, darker worn paths.
      const inHole = 1 - THREE.MathUtils.smoothstep(rr, HOLE_RADIUS * .35, HOLE_RADIUS * 1.05);
      colour.lerp(paleSoil, Math.exp(-(((rr - HOLE_RADIUS * 1.35) / (HOLE_RADIUS * .45)) ** 2)) * .45);
      colour.lerp(darkSoil, groove * .55).lerp(hole, inHole);
      colours.push(colour.r, colour.g, colour.b);
    }
    for (let r = 0; r < rings; r++) for (let a = 0; a < sides; a++) {
      const i = r * sides + a, j = r * sides + (a + 1) % sides, k = i + sides, l = j + sides;
      // Wound to face up (the first version faced down and was culled from above).
      index.push(i, j, k, j, l, k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.setIndex(index); g.computeVertexNormals();
    moundParts.push(g.toNonIndexed());
    // Loose grains carried out and dropped around the mound.
    for (let i = 0; i < 34; i++) {
      const a = moundRandom() * Math.PI * 2, r = i < 8 ? HOLE_RADIUS * (1.2 + moundRandom() * .5) : MOUND_RADIUS * (.7 + moundRandom() * .9), size = .006 + moundRandom() * .007;
      const x = colony.nest.x + Math.cos(a) * r, z = colony.nest.z + Math.sin(a) * r;
      const grain = new THREE.DodecahedronGeometry(size, 0).translate(x, meadowGroundHeight(x, z) + moundHeight(r) + size * .4, z);
      const count = grain.attributes.position.count;
      colour.copy(soil).lerp(paleSoil, moundRandom());
      grain.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [colour.r, colour.g, colour.b]).flat(), 3));
      grain.deleteAttribute('uv');
      moundParts.push(grain);
    }
  });
  const moundGeometry = moundParts.length ? mergeGeometries(moundParts.map(p => { if (p.attributes.uv) p.deleteAttribute('uv'); return p; }), false)! : new THREE.BufferGeometry();
  for (const part of moundParts) part.dispose();
  const moundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mounds = new THREE.Mesh(moundGeometry, moundMaterial);
  mounds.name = 'ant mounds'; mounds.receiveShadow = true;
  scene.add(mounds);

  const matrix = new THREE.Matrix4(), crumbMatrix = new THREE.Matrix4(), crumbOffset = new THREE.Vector3();
  const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3(), tangent = new THREE.Vector3(), radial = new THREE.Vector3(), away = new THREE.Vector3();
  let lastTime = 0, recall = false, detouring = 0;

  /** Places an ant on its trail (ground path, then up the stem). */
  function place(colony: Colony, ant: Ant): void {
    if (ant.s < colony.groundLength) {
      const lengths = colony.lengths;
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < ant.s) i++;
      const a = colony.path[i - 1], b = colony.path[i], t = (ant.s - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
      ant.position.lerpVectors(a, b, t);
      tangent.subVectors(b, a).normalize();
      right.set(-tangent.z, 0, tangent.x).normalize();
      // Lanes spread out along the trail, and pinch in at the nest hole and the stem.
      const spread = Math.min(1, ant.s / .15, (colony.groundLength - ant.s) / .12 + .25);
      ant.position.addScaledVector(right, ant.lane * LANE_WIDTH * spread);
      ant.position.y = meadowGroundHeight(ant.position.x, ant.position.z) + moundHeight(Math.hypot(ant.position.x - colony.nest.x, ant.position.z - colony.nest.z)) + .005;
      up.set(0, 1, 0);
      if (ant.s < MOUND_RADIUS) {
        // On the slope of the mound: tilt with it.
        const r = Math.hypot(ant.position.x - colony.nest.x, ant.position.z - colony.nest.z), e = .01;
        const slope = (moundHeight(r + e) - moundHeight(Math.max(0, r - e))) / (2 * e);
        away.set(ant.position.x - colony.nest.x, 0, ant.position.z - colony.nest.z).normalize();
        up.set(-away.x * slope, 1, -away.z * slope).normalize();
      }
      forward.copy(tangent).multiplyScalar(ant.dir);
    } else {
      const u = Math.min(colony.topU, (ant.s - colony.groundLength) / colony.stemLength * colony.topU);
      stalkPoint(colony.flower, u, ant.position);
      stalkTangent(colony.flower, u, tangent);
      const angle = colony.angle + ant.lane * .7;
      radial.set(Math.cos(angle), 0, Math.sin(angle));
      radial.addScaledVector(tangent, -radial.dot(tangent)).normalize();
      ant.position.addScaledVector(radial, STEM_RADIUS);
      up.copy(radial); forward.copy(tangent).multiplyScalar(ant.dir);
    }
  }
  function writeMatrix(ant: Ant): void {
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    forward.normalize();
    right.crossVectors(up, forward).normalize();
    forward.crossVectors(right, up);
    matrix.makeBasis(right, up, forward).setPosition(ant.position);
  }

  return {
    colonies: colonies as readonly AntColony[],
    /** Moves the ants; the bee's body pushes walkers aside when she is down in the grass. */
    update(time: number, bee: THREE.Vector3, beeOnGround: boolean, camera: THREE.Vector3, weather: { rain: number; heat: number }, reducedMotion: boolean): void {
      const dt = reducedMotion ? 0 : Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      antUniforms.uAntTime.value = time;
      // Rain sends them home; they come out again once it has eased off.
      if (weather.rain > .3) recall = true; else if (weather.rain < .12) recall = false;
      const hurry = 1 + weather.heat * .45;
      let crumbCount = 0, drawn = 0; detouring = 0;
      for (const colony of colonies) {
        const length = colony.groundLength + colony.stemLength;
        const near = Math.hypot(colony.nest.x - camera.x, colony.nest.z - camera.z) < VISIBLE_RANGE + length;
        for (let i = 0; i < colony.ants.length; i++) {
          const ant = colony.ants[i];
          if (dt > 0) {
            if (ant.cool > 0) ant.cool -= dt;
            if (ant.inside) {
              ant.wait -= dt;
              if (!recall && ant.wait <= 0) { ant.inside = false; ant.s = 0; ant.dir = 1; ant.carry = false; ant.pause = 0; }
            } else if (ant.pause > 0) ant.pause -= dt;
            else {
              if (recall && ant.dir === 1) { ant.dir = -1; ant.pause = .15; }
              const pace = ant.speed * hurry * (recall ? 1.5 : 1) * (ant.detour ? .5 : 1);
              ant.s += ant.dir * pace * dt;
              if (ant.s >= length) {
                // At the aphids: a moment tending them, then home with honeydew.
                ant.s = length; ant.dir = -1; ant.pause = .6 + ant.random() * 1.8; ant.carry = ant.random() < .22;
              } else if (ant.s <= 0) {
                ant.s = 0; ant.inside = true; ant.carry = false;
                ant.wait = recall ? 1e9 : .4 + ant.random() * 3;
              }
            }
            if (!recall && ant.inside && ant.wait > 1e8) ant.wait = ant.random() * 18;
          }
          if (ant.inside || !near) { ant.detour = false; continue; }
          const index = drawn++;
          place(colony, ant);
          // Step around the bee's body when she is walking or resting in the grass.
          ant.detour = false;
          if (beeOnGround && ant.s < colony.groundLength) {
            const dx = ant.position.x - bee.x, dz = ant.position.z - bee.z, d = Math.hypot(dx, dz);
            if (d < BEE_CLEARANCE) {
              const k = BEE_CLEARANCE / Math.max(1e-4, d);
              ant.position.x = bee.x + dx * k; ant.position.z = bee.z + dz * k;
              ant.position.y = meadowGroundHeight(ant.position.x, ant.position.z) + moundHeight(Math.hypot(ant.position.x - colony.nest.x, ant.position.z - colony.nest.z)) + .005;
              // Turned a little along the curve around her.
              away.set(dx, 0, dz).normalize();
              forward.addScaledVector(away, .8);
              ant.detour = true; detouring++;
            }
          }
          writeMatrix(ant);
          antMesh.setMatrixAt(index, matrix);
          walking[index] = dt > 0 && ant.pause <= 0 ? 1 : 0;
          if (ant.carry) {
            crumbOffset.set(0, .006 * ANT_SCALE, .031 * ANT_SCALE);
            crumbMatrix.copy(matrix).multiply(new THREE.Matrix4().makeTranslation(crumbOffset.x, crumbOffset.y, crumbOffset.z));
            crumbs.setMatrixAt(crumbCount++, crumbMatrix);
          }
        }
        // Two ants meeting head-on stop for a moment to touch antennae.
        if (near && dt > 0) for (let i = 0; i < colony.ants.length; i++) {
          const a = colony.ants[i];
          if (a.inside || a.pause > 0 || a.cool > 0 || a.dir !== 1) continue;
          for (let j = 0; j < colony.ants.length; j++) {
            const b = colony.ants[j];
            if (b.inside || b.pause > 0 || b.cool > 0 || b.dir !== -1) continue;
            if (Math.abs(a.s - b.s) < .012 && Math.abs(a.lane - b.lane) < .5 && a.random() < .5) { a.pause = b.pause = .25 + a.random() * .3; a.cool = b.cool = a.pause + 1.2; break; }
          }
        }
      }
      antMesh.count = drawn; antMesh.instanceMatrix.needsUpdate = true; walkAttribute.needsUpdate = true;
      crumbs.count = crumbCount; if (crumbCount) crumbs.instanceMatrix.needsUpdate = true;
    },
    /** The nearest colony to a point (its mound or any ant out on the trail). */
    nearest(point: THREE.Vector3): { colony: AntColony; distance: number; at: THREE.Vector3 } | null {
      let found: Colony | null = null, distance = Infinity;
      const at = new THREE.Vector3();
      for (const colony of colonies) {
        if (colony.nest.distanceTo(point) < distance) { distance = colony.nest.distanceTo(point); found = colony; at.copy(colony.nest); }
        if (Math.hypot(colony.nest.x - point.x, colony.nest.z - point.z) < 6) for (const ant of colony.ants) {
          if (!ant.inside && ant.position.distanceTo(point) < distance) { distance = ant.position.distanceTo(point); found = colony; at.copy(ant.position); }
        }
      }
      return found ? { colony: found, distance, at } : null;
    },
    markSeen(id: number): void { const colony = colonies[id]; if (colony) colony.seen = true; },
    seenCount(): number { return colonies.filter(c => c.seen).length; },
    reset(): void { for (const colony of colonies) colony.seen = false; },
    /** After rain in the night the ants start the day indoors and come out over a while. */
    stayIn(seconds: number): void {
      for (const colony of colonies) for (const ant of colony.ants) { ant.inside = true; ant.s = 0; ant.dir = 1; ant.carry = false; ant.wait = ant.random() * seconds; }
    },
    /** Ant positions of one colony that are out on the trail (for tests). */
    antsOf(id: number): { position: number[]; onStem: boolean; detour: boolean }[] {
      const colony = colonies[id];
      return colony ? colony.ants.filter(a => !a.inside).map(a => ({ position: a.position.toArray(), onStem: a.s >= colony.groundLength, detour: a.detour })) : [];
    },
    diagnostics() {
      const ants = colonies.flatMap(c => c.ants);
      return { colonies: colonies.length, outside: ants.filter(a => !a.inside).length, inside: ants.filter(a => a.inside).length, onStems: colonies.reduce((n, c) => n + c.ants.filter(a => !a.inside && a.s >= c.groundLength).length, 0), carrying: ants.filter(a => !a.inside && a.carry).length, detouring, recall, seen: colonies.filter(c => c.seen).length };
    },
    dispose(): void {
      scene.remove(antMesh, crumbs, mounds);
      antGeometry.dispose(); antMaterial.dispose(); antMesh.dispose(); crumbGeometry.dispose(); crumbMaterial.dispose(); crumbs.dispose(); moundGeometry.dispose(); moundMaterial.dispose();
    },
  };
}
