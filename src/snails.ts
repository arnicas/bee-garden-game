import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng, stalkPoint, stalkTangent } from './world';
import { leafPlanarDistance, leafSurfaceHeight, type LeafShelter } from './shelters';
import type { Flower } from './types';

/**
 * Banded snails (Cepaea), a meadow friend that shows the weather. In rain, dew
 * and at dusk they crawl out, tentacles up, leaving silvery trails that dry and
 * fade. In dry, mild weather they tuck into their shells. In the hot spell they
 * climb a flower stem off the hot ground and seal themselves on with a white
 * lid. Their tentacles pull in when the bee comes close; they never flee. They
 * eat only dead plant matter. How many there are, and how many stay sealed,
 * follows how full the meadow is (friendCounts in meadow-plan.ts).
 * See Snails_Design.md. Four instanced draws: shells, bodies, lids, trails.
 */
export type SnailState = 'crawling' | 'feeding' | 'tucked' | 'climbing' | 'sealed';
export type SnailPerch = 'ground' | 'stem' | 'leaf';
export interface Snail {
  id: number;
  state: SnailState;
  perch: SnailPerch;
  position: THREE.Vector3;
  /** Away from the surface it is on (its shell's up). */
  up: THREE.Vector3;
  /** 0 inside the shell, 1 fully out. */
  extension: number;
  seen: boolean;
}

export interface SnailWeather {
  /** 0–1 rain, 0–1 morning dew or wet leaves, 0–1 heat of the sun. */
  rain: number;
  dew: number;
  heat: number;
  /** 0–1 how far into the evening (active snails come out at dusk). */
  dusk: number;
  /** 0–1 how dry a thin meadow keeps the ground (more snails stay sealed). */
  dryness: number;
}

const SPEED = .03;          // units (10 cm) per second on the ground: about 3 mm/s
const CLIMB_SPEED = .04;
const STEM_RADIUS = .03;
const SHY_DISTANCE = .5;
const VISIBLE_RANGE = 16;
const TRAIL_POINTS = 36;
const TRAIL_STEP = .035;
/** Shell colours: yellow, pink and brown, as in real banded snails. */
/** Life size is a shell about 2.5 cm across; the geometry is built at 1 and scaled. */
const SIZE = 1.55;
const SHELL_COLOURS = ['#e9d98c', '#e8d3c8', '#b39a80', '#efe6c0', '#ddc0ae'];

// ---------------------------------------------------------------------------
// Meshes

/** The spiral shell in snail space (+z forward, +y up), with its aperture
 * (where the body comes out) returned so the body and lid can be placed. */
function shellGeometry() {
  const turns = 4, steps = 96, sides = 18, total = turns * Math.PI * 2;
  const grow = Math.log(2) / (Math.PI * 2), Rmax = .048, R0 = Rmax / Math.exp(grow * total);
  const radius = (a: number) => R0 * Math.exp(grow * a);
  const centre = (t: number, out: THREE.Vector3) => {
    const a = t * total, R = radius(a);
    return out.set(Math.cos(a) * R, (Rmax - R) * .85, Math.sin(a) * R);
  };
  const positions: number[] = [], phis: number[] = [], ts: number[] = [], index: number[] = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * total, r = radius(a) * .84;
    centre(t, p); centre(Math.min(1, t + .002), q); T.subVectors(q, p).normalize();
    N.set(Math.cos(a), 0, Math.sin(a)); B.crossVectors(T, N).normalize(); N.crossVectors(B, T).normalize();
    for (let j = 0; j <= sides; j++) {
      const phi = j / sides;
      const angle = phi * Math.PI * 2;
      positions.push(p.x + (N.x * Math.cos(angle) + B.x * Math.sin(angle)) * r, p.y + (N.y * Math.cos(angle) + B.y * Math.sin(angle)) * r, p.z + (N.z * Math.cos(angle) + B.z * Math.sin(angle)) * r);
      phis.push(phi); ts.push(t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aPhi', new THREE.Float32BufferAttribute(phis, 1));
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
  geometry.setIndex(index); geometry.computeVertexNormals();
  // The aperture: the end of the tube, and the way it faces.
  const aperture = centre(1, new THREE.Vector3()), facing = centre(.995, new THREE.Vector3()).sub(aperture).negate().normalize();
  const apertureRadius = radius(total) * .84;
  // Stand the shell on the snail's back, as a real snail carries it: the coil's
  // axis (its apex) points out to the snail's right and a little up and back, so
  // the spiral shows from the side and a rounded dome from above; the aperture
  // sits low at the back of the coil, opening forward and down onto the foot.
  const axis = new THREE.Vector3(1, .4, -.2).normalize();
  const toAperture = new THREE.Vector3(0, -1, -.45).addScaledVector(axis, -new THREE.Vector3(0, -1, -.45).dot(axis)).normalize();
  const orient = new THREE.Matrix4().makeBasis(toAperture, axis, new THREE.Vector3().crossVectors(toAperture, axis));
  geometry.applyMatrix4(orient); aperture.applyMatrix4(orient); facing.transformDirection(orient);
  geometry.scale(SIZE, SIZE, SIZE); aperture.multiplyScalar(SIZE);
  // The lip of the aperture rests just above the foot, a little behind its middle.
  const shift = new THREE.Vector3(0, apertureRadius * SIZE * 1.05 + .012 * SIZE, -.01 * SIZE).sub(aperture);
  geometry.translate(shift.x, shift.y, shift.z); aperture.add(shift);
  // How far the shell sits above the surface when the foot is out: pulled in,
  // it settles down by this much to rest on the leaf, stem or ground.
  geometry.computeBoundingBox();
  const rest = Math.max(0, geometry.boundingBox!.min.y - .003);
  return { geometry, aperture, facing, apertureRadius: apertureRadius * SIZE, rest };
}

/** Foot and head with four tentacles in snail space (foot on y = 0, head toward +z). */
function bodyGeometry(aperture: THREE.Vector3, apertureRadius: number) {
  const parts: THREE.BufferGeometry[] = [];
  // The foot runs forward from under the shell; the tail tucks back beneath it.
  parts.push(new THREE.CapsuleGeometry(.026, .2, 6, 14).rotateX(Math.PI / 2).scale(1, .45, 1).translate(0, .0117, .03));
  // Head and neck rising a little at the front.
  parts.push(new THREE.CapsuleGeometry(.016, .04, 4, 10).rotateX(Math.PI / 2 - .5).translate(0, .022, .15));
  const rod = (from: THREE.Vector3, dir: THREE.Vector3, length: number, r: number) => {
    const g = new THREE.CylinderGeometry(r * .75, r, length, 6).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    return g.translate(from.x, from.y, from.z);
  };
  const head = new THREE.Vector3(0, .03, .17);
  for (const side of [-1, 1]) {
    const upper = new THREE.Vector3(side * .3, .9, .55).normalize();
    parts.push(rod(head.clone().setX(side * .007), upper, .055, .0042));
    parts.push(new THREE.SphereGeometry(.0058, 6, 4).translate(side * .007 + upper.x * .055, head.y + upper.y * .055, head.z + upper.z * .055));
    const lower = new THREE.Vector3(side * .5, -.1, 1).normalize();
    parts.push(rod(head.clone().setX(side * .01).setY(head.y - .01), lower, .02, .003));
  }
  // Scale to size, then add the soft body filling the shell's aperture, joined
  // down to the foot, so the opening reads as the snail coming out of it.
  parts.forEach(g => g.scale(SIZE, SIZE, SIZE));
  parts.push(new THREE.SphereGeometry(apertureRadius * .82, 18, 12).translate(aperture.x, aperture.y, aperture.z));
  const neck = aperture.clone().lerp(new THREE.Vector3(0, .012 * SIZE, aperture.z + .03 * SIZE), .6);
  parts.push(new THREE.SphereGeometry(apertureRadius * .62, 16, 10).scale(1, .75, 1.5).translate(neck.x, neck.y, neck.z));
  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g))!;
  parts.forEach(g => g.dispose());
  // Eye dots: darker vertex colour at the tentacle tips.
  const pos = merged.attributes.position, colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), tip = y > .075 * SIZE ? .35 : 1;
    colours.set([tip, tip, tip], i * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return merged;
}

export function createSnailMeshes(capacity: number) {
  const n = Math.max(1, capacity);
  const shell = shellGeometry();
  const shellColour = new Float32Array(n * 3), bands = new Float32Array(n);
  shell.geometry.setAttribute('aShellColour', new THREE.InstancedBufferAttribute(shellColour, 3));
  shell.geometry.setAttribute('aBands', new THREE.InstancedBufferAttribute(bands, 1));
  const shellMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .42, side: THREE.DoubleSide });
  shellMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aPhi; attribute float aT; attribute vec3 aShellColour; attribute float aBands;\nvarying float vPhi; varying float vT; varying vec3 vShellColour; varying float vBands;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPhi = aPhi; vT = aT; vShellColour = aShellColour; vBands = aBands;');
    shader.fragmentShader = 'varying float vPhi; varying float vT; varying vec3 vShellColour; varying float vBands;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // Up to five dark bands spiral along the whorls (a bit per band), fine
      // growth lines, a paler apex and the dark brown lip of Cepaea nemoralis.
      vec3 shellColour = vShellColour * (.95 + .05 * sin(vT * 150.));
      shellColour = mix(shellColour * 1.12, shellColour, smoothstep(.05, .35, vT));
      float band = 0.;
      for (int k = 0; k < 5; k++) {
        float centre = -.17 + float(k) * .085;
        float d = abs(fract(vPhi - centre + .5) - .5);
        float on = mod(floor(floor(vBands + .5) / pow(2., float(k)) + .001), 2.);
        band = max(band, on * (1. - smoothstep(.013, .03, d)));
      }
      shellColour = mix(shellColour, vec3(.16, .11, .09), band * .92);
      shellColour = mix(shellColour, vec3(.24, .15, .11), smoothstep(.975, .99, vT));
      // Inside the shell (seen through the aperture) is dark.
      diffuseColor.rgb = gl_FrontFacing ? shellColour * .18 : shellColour;`);
  };
  shellMaterial.customProgramCacheKey = () => 'snail-shell-v1';
  const shells = new THREE.InstancedMesh(shell.geometry, shellMaterial, n); shells.name = 'snail shells';

  const bodyGeo = bodyGeometry(shell.aperture, shell.apertureRadius);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#8a7b6b', vertexColors: true, roughness: .32 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMaterial, n); bodies.name = 'snail bodies';

  // The dried-mucus lid over the aperture when sealed.
  const lidGeo = new THREE.CircleGeometry(shell.apertureRadius * .96, 16);
  lidGeo.lookAt(shell.facing); lidGeo.translate(shell.aperture.x, shell.aperture.y, shell.aperture.z);
  const lidMaterial = new THREE.MeshStandardMaterial({ color: '#efeadb', roughness: .8, side: THREE.DoubleSide });
  const lids = new THREE.InstancedMesh(lidGeo, lidMaterial, n); lids.name = 'snail lids';

  for (const mesh of [shells, bodies, lids]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; }
  const colour = new THREE.Color(), bodyMatrix = new THREE.Matrix4(), scaleMatrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const settled = new THREE.Matrix4(), sink = new THREE.Matrix4();
  // The body grows out of the aperture (its origin), foot along the snail's forward.
  // Retracting, the body shrinks into the aperture (low under the shell), so it
  // slips in under the shell's edge rather than shrinking in place.
  const toAperture = new THREE.Matrix4().makeTranslation(shell.aperture.x, shell.aperture.y, shell.aperture.z);
  const fromAperture = new THREE.Matrix4().makeTranslation(-shell.aperture.x, -shell.aperture.y, -shell.aperture.z);
  return {
    shells, bodies, lids, aperture: shell.aperture,
    setLook(i: number, colourIndex: number, bandMask: number) {
      colour.set(SHELL_COLOURS[colourIndex % SHELL_COLOURS.length]).convertSRGBToLinear();
      shellColour.set([colour.r, colour.g, colour.b], i * 3); bands[i] = bandMask;
      (shell.geometry.getAttribute('aShellColour') as THREE.InstancedBufferAttribute).needsUpdate = true;
      (shell.geometry.getAttribute('aBands') as THREE.InstancedBufferAttribute).needsUpdate = true;
    },
    /** extension 0–1 (body out), sealed shows the lid; visible false hides all. */
    pose(i: number, matrix: THREE.Matrix4, extension: number, sealed: boolean, visible: boolean) {
      if (!visible) { shells.setMatrixAt(i, hidden); bodies.setMatrixAt(i, hidden); lids.setMatrixAt(i, hidden); return; }
      const e = THREE.MathUtils.clamp(extension, 0, 1);
      // With the foot pulled in, the shell comes down onto the surface.
      matrix = settled.multiplyMatrices(matrix, sink.makeTranslation(0, -shell.rest * (1 - e), 0));
      shells.setMatrixAt(i, matrix);
      if (e < .03) bodies.setMatrixAt(i, hidden);
      else bodies.setMatrixAt(i, bodyMatrix.multiplyMatrices(matrix, toAperture).multiply(scaleMatrix.makeScale(.3 + .7 * e, .3 + .7 * e, e)).multiply(fromAperture));
      lids.setMatrixAt(i, sealed ? matrix : hidden);
    },
    commit(count: number) {
      for (const mesh of [shells, bodies, lids]) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
    },
    dispose() { shell.geometry.dispose(); shellMaterial.dispose(); bodyGeo.dispose(); bodyMaterial.dispose(); lidGeo.dispose(); lidMaterial.dispose(); shells.dispose(); bodies.dispose(); lids.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// Behaviour

interface Mollusc extends Snail {
  random: () => number;
  flower: Flower | null;
  leaf: LeafShelter | null;
  /** Ground: world x, z; leaf: leaf-local x, z (underside); stem: height 0–1 and angle. */
  x: number; z: number; u: number; angle: number;
  heading: number;
  /** On a leaf: under it (true) or on top. On a stem: 1 up, -1 down. */
  underside: boolean; dir: 1 | -1;
  /** Stem height where it will seal itself on in the heat. */
  climbTo: number;
  /** 0–1: bolder snails come out even when the meadow is dry. */
  boldness: number;
  pause: number;
  shy: number;
  sealedAmount: number;
  /** Trail points in world space for drawing, rebuilt each frame from where they
   * were laid: leaf-local on a leaf, (height, angle) on a stem, world on the ground. */
  trail: THREE.Vector3[]; trailAge: number[]; trailHead: number;
  trailLocal: THREE.Vector3[]; trailOn: (LeafShelter | Flower | null)[]; trailKind: Uint8Array;
  lastDrop: THREE.Vector3; lastLocal: THREE.Vector3; lastOn: LeafShelter | Flower | null; lastKind: number;
  matrix: THREE.Matrix4;
}

export function createSnails(scene: THREE.Scene, seed: number, flowers: readonly Flower[], leaves: readonly LeafShelter[], count: number) {
  const random = rng((seed ^ 0x5a11) >>> 0 || 5);
  const meshes = createSnailMeshes(count);
  scene.add(meshes.shells, meshes.bodies, meshes.lids);
  const stems = flowers.filter(f => f.id !== 0);
  const snails: Mollusc[] = [];

  // Trails: one line-segment draw for every snail's recent path.
  const trailPositions = new Float32Array(Math.max(1, count) * TRAIL_POINTS * 2 * 3), trailFade = new Float32Array(Math.max(1, count) * TRAIL_POINTS * 2);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aFade', new THREE.BufferAttribute(trailFade, 1).setUsage(THREE.DynamicDrawUsage));
  const trailMaterial = new THREE.LineBasicMaterial({ color: '#f4f6f2', transparent: true, depthWrite: false });
  trailMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aFade; varying float vFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFade = aFade;');
    shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vFade <= .01) discard;\n diffuseColor.a *= vFade * .7;');
  };
  trailMaterial.customProgramCacheKey = () => 'snail-trail-v1';
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.name = 'snail trails'; trails.frustumCulled = false; trails.renderOrder = 1;
  scene.add(trails);

  const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3(), tangent = new THREE.Vector3(), radial = new THREE.Vector3(), local = new THREE.Vector3(), normal = new THREE.Vector3();
  const stemPoint = stalkPoint;
  const trailTangent = new THREE.Vector3(), trailRadial = new THREE.Vector3(), inverse = new THREE.Quaternion();
  /** Where a trail point sits now: 0 ground (world), 1 leaf-local, 2 stem (height, angle). */
  function trailWorld(kind: number, on: LeafShelter | Flower | null, local: THREE.Vector3, out: THREE.Vector3) {
    if (kind === 1 && on) return out.copy(local).applyQuaternion(on.rotation).add((on as LeafShelter).center);
    if (kind === 2 && on) {
      const f = on as Flower;
      stemPoint(f, local.x, out); stalkTangent(f, local.x, trailTangent);
      trailRadial.set(Math.cos(local.y), 0, Math.sin(local.y));
      trailRadial.addScaledVector(trailTangent, -trailRadial.dot(trailTangent)).normalize();
      return out.addScaledVector(trailRadial, STEM_RADIUS + .003);
    }
    return out.copy(local);
  }
  /** The snail's current place in its perch's own frame, for its trail. */
  function perchLocal(s: Mollusc, out: THREE.Vector3): [number, LeafShelter | Flower | null] {
    if (s.perch === 'leaf' && s.leaf) {
      out.copy(s.position).addScaledVector(s.up, .003).sub(s.leaf.center).applyQuaternion(inverse.copy(s.leaf.rotation).invert());
      return [1, s.leaf];
    }
    if (s.perch === 'stem' && s.flower) { out.set(s.u, s.angle, 0); return [2, s.flower]; }
    out.copy(s.position).addScaledVector(s.up, .003);
    return [0, null];
  }
  /** Butterflies to steer around (set each update). */
  let others: readonly { position: THREE.Vector3 }[] = [];
  const otherLocal = new THREE.Vector3();
  /** True when a step from (px, pz) to the snail's new place on its leaf would take
   * it into a butterfly or another snail on the same side. Moving away is allowed,
   * so one that ends up too close (a butterfly landing beside it) can get clear. */
  function crowded(s: Mollusc, px: number, pz: number) {
    const leaf = s.leaf;
    if (!leaf) return false;
    inverse.copy(leaf.rotation).invert();
    const near = (at: THREE.Vector3, room: number) => {
      otherLocal.copy(at).sub(leaf.center).applyQuaternion(inverse);
      if (Math.abs(otherLocal.y) > .45 || (otherLocal.y < leafSurfaceHeight(otherLocal.x, otherLocal.z)) !== s.underside) return false;
      const now = Math.hypot(otherLocal.x - s.x, otherLocal.z - s.z), before = Math.hypot(otherLocal.x - px, otherLocal.z - pz);
      return now < room && now < before;
    };
    for (const o of others) if (near(o.position, .21)) return true;
    for (const o of snails) if (o !== s && o.perch === 'leaf' && o.leaf === leaf && near(o.position, .17)) return true;
    return false;
  }
  /** Keeps a leaf snail off the midrib, whose raised vein would cut through its foot. */
  function offMidrib(s: Mollusc) {
    if (Math.abs(s.x) < .08) { s.x = (Math.sign(s.x) || 1) * .08; s.heading = -s.heading; }
  }
  const nearestStem = (x: number, z: number, within: number) => {
    let best: Flower | null = null, d = within;
    for (const f of stems) { const dd = Math.hypot(f.base.x - x, f.base.z - z); if (dd < d) { d = dd; best = f; } }
    return best;
  };

  /** On the ground: crawl to the nearest stem and start up it. */
  function approachStem(s: Mollusc, dt: number) {
    const target = s.flower ?? nearestStem(s.x, s.z, 4);
    if (!target) { s.heading += (s.random() - .5) * dt; s.x += Math.sin(s.heading) * SPEED * dt; s.z += Math.cos(s.heading) * SPEED * dt; return; }
    s.flower = target;
    const dx = target.base.x - s.x, dz = target.base.z - s.z;
    if (Math.hypot(dx, dz) < STEM_RADIUS + .06) { s.perch = 'stem'; s.u = .02; s.dir = 1; s.angle = Math.atan2(-dz, -dx); return; }
    const want = Math.atan2(dx, dz);
    s.heading += Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading)) * Math.min(1, dt * 1.5);
    s.x += Math.sin(s.heading) * SPEED * dt; s.z += Math.cos(s.heading) * SPEED * dt;
  }
  /** Places a snail and writes its matrix: up is the surface normal, forward its heading. */
  function pose(s: Mollusc) {
    if (s.perch === 'stem' && s.flower) {
      const f = s.flower;
      stemPoint(f, s.u, s.position);
      stalkTangent(f, s.u, tangent);
      radial.set(Math.cos(s.angle), 0, Math.sin(s.angle));
      radial.addScaledVector(tangent, -radial.dot(tangent)).normalize();
      s.position.addScaledVector(radial, STEM_RADIUS);
      up.copy(radial); forward.copy(tangent).multiplyScalar(s.dir);
    } else if (s.perch === 'leaf' && s.leaf) {
      const leaf = s.leaf, e = .02, y = leafSurfaceHeight(s.x, s.z);
      normal.set(-(leafSurfaceHeight(s.x + e, s.z) - y) / e, 1, -(leafSurfaceHeight(s.x, s.z + e) - y) / e).normalize();
      if (s.underside) normal.negate();
      local.set(s.x, y + (s.underside ? -.042 : .008), s.z);
      s.position.copy(local).applyQuaternion(leaf.rotation).add(leaf.center);
      up.copy(normal).applyQuaternion(leaf.rotation);
      forward.set(Math.sin(s.heading), 0, Math.cos(s.heading)).applyQuaternion(leaf.rotation);
    } else {
      s.position.set(s.x, meadowGroundHeight(s.x, s.z) + .004, s.z);
      const e = .1, y = s.position.y;
      up.set(-(meadowGroundHeight(s.x + e, s.z) - y) / e, 1, -(meadowGroundHeight(s.x, s.z + e) - y) / e).normalize();
      forward.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    }
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0).addScaledVector(up, -up.x);
    forward.normalize();
    right.crossVectors(up, forward).normalize();
    forward.crossVectors(right, up);
    s.up.copy(up);
    s.matrix.makeBasis(right, up, forward).setPosition(s.position);
  }

  for (let id = 0; id < count; id++) {
    const s: Mollusc = {
      id, state: 'tucked', perch: 'ground', position: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), extension: 0, seen: false,
      random: rng((seed + id * 4099) >>> 0 || 9), flower: null, leaf: null, x: 0, z: 0, u: 0, angle: 0, heading: 0, underside: true, dir: 1,
      climbTo: .5, boldness: random(), pause: 0, shy: 0, sealedAmount: 0,
      trail: Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3()), trailAge: new Array(TRAIL_POINTS).fill(1e6), trailHead: 0,
      trailLocal: Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3()), trailOn: new Array(TRAIL_POINTS).fill(null), trailKind: new Uint8Array(TRAIL_POINTS),
      lastDrop: new THREE.Vector3(), lastLocal: new THREE.Vector3(), lastOn: null, lastKind: 0,
      matrix: new THREE.Matrix4(),
    };
    // Shells vary as in a real population: colour and 0, 1, 3 or 5 bands.
    const pattern = [0, 0b00100, 0b10101, 0b11111, 0b01110][Math.floor(random() * 5)];
    meshes.setLook(id, Math.floor(random() * SHELL_COLOURS.length), pattern);
    snails.push(s);
  }

  function place() {
    for (const s of snails) {
      const r = s.random();
      s.state = 'tucked'; s.extension = 0; s.sealedAmount = 0; s.seen = false; s.pause = 0; s.shy = 0;
      s.heading = s.random() * Math.PI * 2; s.climbTo = .45 + s.random() * .3;
      s.trailAge.fill(1e6);
      const leaf = leaves.length ? leaves[Math.floor(s.random() * leaves.length)] : null;
      const flower = stems.length ? stems[Math.floor(s.random() * stems.length)] : null;
      // Mostly up on the plants, where they can be seen above the ground cover:
      // on the broad leaves (often underneath) and on flower stems.
      if (r < .4 && leaf) {
        s.perch = 'leaf'; s.leaf = leaf; s.flower = null; s.underside = s.random() < .6;
        // Somewhere clear of the snails already placed on this side of the leaf.
        for (let attempt = 0; attempt < 10; attempt++) {
          const a = s.random() * Math.PI * 2, d = .1 + s.random() * .2;
          s.x = Math.cos(a) * d * .7; s.z = Math.sin(a) * d; offMidrib(s);
          if (!snails.some(o => o.id < s.id && o.perch === 'leaf' && o.leaf === leaf && o.underside === s.underside && Math.hypot(o.x - s.x, o.z - s.z) < .17)) break;
        }
      } else if (r < .8 && flower) {
        s.perch = 'stem'; s.flower = flower; s.leaf = null; s.u = .1 + s.random() * .3; s.angle = s.random() * Math.PI * 2; s.dir = s.random() < .5 ? 1 : -1;
      } else {
        // In the grass near a flower's base.
        s.perch = 'ground'; s.leaf = null; s.flower = null;
        const base = flower ? flower.base : new THREE.Vector3(), a = s.random() * Math.PI * 2, d = .3 + s.random() * 1.2;
        s.x = base.x + Math.cos(a) * d; s.z = base.z + Math.sin(a) * d;
      }
      pose(s); s.lastDrop.copy(s.position);
      [s.lastKind, s.lastOn] = perchLocal(s, s.lastLocal);
    }
  }
  place();

  let lastTime = 0;
  function update(time: number, bee: THREE.Vector3, camera: THREE.Vector3, reduced: boolean, weather: SnailWeather, avoid: readonly { position: THREE.Vector3 }[] = []) {
    others = avoid;
    const dt = reduced ? 0 : THREE.MathUtils.clamp(time - lastTime, 0, .1); lastTime = time;
    // What the weather asks of a snail. Wet or dusky air brings them out; heat
    // sends them up a stem to seal themselves on; otherwise they tuck in.
    const wet = Math.max(weather.rain, weather.dew * .9, weather.dusk * .8);
    const hot = weather.heat > .3 && weather.rain < .05;
    for (const s of snails) {
      // Shyness: tentacles pull in when the bee is close, then ease back out.
      if (bee.distanceTo(s.position) < SHY_DISTANCE) s.shy = 1;
      else s.shy = Math.max(0, s.shy - dt * .35);
      // In a thin, dry meadow the shyer snails stay in even when it's damp.
      const comesOut = wet > .3 && s.boldness >= weather.dryness * .6 * (1 - weather.rain);
      if (hot) {
        if (s.state !== 'sealed') s.state = 'climbing';
      } else if (comesOut) {
        if (s.state !== 'feeding') s.state = 'crawling';
      } else if (s.state !== 'sealed') s.state = 'tucked';   // a sealed snail waits for rain
      // With reduced motion there is no climbing to watch: a snail in the heat is simply sealed.
      if (reduced && s.state === 'climbing') { if (s.perch === 'stem') s.u = Math.max(s.u, s.climbTo); s.state = 'sealed'; }

      const out = s.state === 'crawling' || s.state === 'climbing' || s.state === 'feeding';
      const targetExtension = out ? (1 - .55 * s.shy) : 0;
      s.extension = reduced ? targetExtension : THREE.MathUtils.damp(s.extension, targetExtension, s.extension < targetExtension ? .7 : 1.6, dt);
      s.sealedAmount = s.state === 'sealed' ? Math.min(1, s.sealedAmount + dt * .5 + (reduced ? 1 : 0)) : 0;

      // Movement, only when well out of the shell and not startled.
      const moving = out && s.extension > .75 && s.shy < .2 && dt > 0;
      if (s.state === 'feeding' || s.pause > 0) {
        s.pause -= dt;
        if (s.pause <= 0 && s.state === 'feeding') s.state = 'crawling';
      } else if (moving && hot) {
        // Heat: up a stem, off the hot ground, and seal on. On a leaf it seals where it is.
        if (s.perch === 'leaf') s.state = 'sealed';
        else if (s.perch === 'ground') approachStem(s, dt);
        else if (s.flower) {
          const h = Math.max(.3, s.flower.center.y - s.flower.base.y);
          s.u = Math.min(s.climbTo, s.u + CLIMB_SPEED * dt / h);
          if (s.u >= s.climbTo) s.state = 'sealed';
        }
      } else if (moving) {
        // Damp: wander over the plants, stopping now and then to eat something
        // dead or fallen.
        if (s.random() < dt * .04) { s.state = 'feeding'; s.pause = 4 + s.random() * 8; }
        s.heading += (s.random() - .5) * dt * .9;
        if (s.perch === 'stem' && s.flower) {
          const h = Math.max(.3, s.flower.center.y - s.flower.base.y);
          s.u += s.dir * CLIMB_SPEED * .7 * dt / h;
          if (s.u > .55 || s.u < .06) { s.u = THREE.MathUtils.clamp(s.u, .06, .55); s.dir = s.dir === 1 ? -1 : 1; s.pause = 2 + s.random() * 5; }
        } else if (s.perch === 'leaf') {
          const px = s.x, pz = s.z;
          s.x += Math.sin(s.heading) * SPEED * .6 * dt; s.z += Math.cos(s.heading) * SPEED * .6 * dt;
          if (leafPlanarDistance(s.x, s.z) > .34) { s.heading += Math.PI * .8; s.x *= .98; s.z *= .98; }
          offMidrib(s);
          // Something in the way (a resting butterfly, another snail): turn aside.
          if (crowded(s, px, pz)) { s.x = px; s.z = pz; s.heading += Math.PI * (.4 + s.random() * .5); }
        } else approachStem(s, dt);
      }
      pose(s);

      // Trail: drop a point every few millimetres while crawling on a surface.
      for (let k = 0; k < TRAIL_POINTS; k++) s.trailAge[k] += dt * (weather.rain > .1 ? .5 : 1 + weather.heat * 2);
      // Distances are measured where the last point is now, so a swaying leaf
      // doesn't drop extra points.
      trailWorld(s.lastKind, s.lastOn, s.lastLocal, s.lastDrop);
      if (out && s.position.distanceTo(s.lastDrop) > TRAIL_STEP) {
        const k = s.trailHead = (s.trailHead + 1) % TRAIL_POINTS;
        const [kind, on] = perchLocal(s, s.trailLocal[k]);
        s.trailKind[k] = kind; s.trailOn[k] = on; s.trailAge[k] = 0;
        s.lastKind = kind; s.lastOn = on; s.lastLocal.copy(s.trailLocal[k]);
      }
    }

    // Draw what is near.
    snails.forEach((s, i) => {
      const near = s.position.distanceTo(camera) < VISIBLE_RANGE;
      meshes.pose(i, s.matrix, s.extension, s.sealedAmount > .5, near);
      // Trail points follow the leaf or stem they were laid on.
      if (near) for (let k = 0; k < TRAIL_POINTS; k++) if (s.trailAge[k] < 90) trailWorld(s.trailKind[k], s.trailOn[k], s.trailLocal[k], s.trail[k]);
      // Trail segments between consecutive points, fading with dryness.
      for (let k = 0; k < TRAIL_POINTS; k++) {
        const a = (s.trailHead - k + TRAIL_POINTS) % TRAIL_POINTS, b = (a - 1 + TRAIL_POINTS) % TRAIL_POINTS;
        const base = (i * TRAIL_POINTS + k) * 2;
        const fadeA = near && k < TRAIL_POINTS - 1 ? Math.max(0, 1 - s.trailAge[a] / 90) : 0, fadeB = near && k < TRAIL_POINTS - 1 ? Math.max(0, 1 - s.trailAge[b] / 90) : 0;
        const linked = fadeA > 0 && fadeB > 0 && s.trail[a].distanceTo(s.trail[b]) < TRAIL_STEP * 3;
        trailPositions.set([s.trail[a].x, s.trail[a].y, s.trail[a].z], base * 3);
        trailPositions.set([s.trail[b].x, s.trail[b].y, s.trail[b].z], base * 3 + 3);
        trailFade[base] = linked ? fadeA : 0; trailFade[base + 1] = linked ? fadeB : 0;
      }
    });
    meshes.commit(snails.length);
    trailGeometry.attributes.position.needsUpdate = true; trailGeometry.attributes.aFade.needsUpdate = true;
  }

  return {
    snails: snails as readonly Snail[],
    update,
    nearest(position: THREE.Vector3) {
      let best: Mollusc | null = null, distance = Infinity;
      for (const s of snails) { const d = s.position.distanceTo(position); if (d < distance) { distance = d; best = s; } }
      return best ? { snail: best as Snail, distance } : null;
    },
    markSeen(id: number) { const s = snails[id]; if (s) s.seen = true; },
    seenCount() { return snails.filter(s => s.seen).length; },
    reset() { place(); lastTime = 0; },
    diagnostics() {
      const by = (state: SnailState) => snails.filter(s => s.state === state).length;
      return { count: snails.length, seen: snails.filter(s => s.seen).length, crawling: by('crawling') + by('feeding'), tucked: by('tucked'), climbing: by('climbing'), sealed: by('sealed'), onStems: snails.filter(s => s.perch === 'stem').length };
    },
    dispose() { scene.remove(meshes.shells, meshes.bodies, meshes.lids, trails); meshes.dispose(); trailGeometry.dispose(); trailMaterial.dispose(); },
  };
}
