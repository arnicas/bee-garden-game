import * as THREE from 'three';
import { losePetal, meadowGroundHeight, petalPoint, rng } from './world';
import type { Flower, PetalSpot } from './types';

/**
 * Fallen petals on the ground under the poppies: broad red petals, crumpled a
 * little, and older ones withered dark and papery. (Not daisies: their rays wither on the head rather than fall.) A poppy flower lasts only a day
 * or so, so its petals drop soon after it is pollinated: in the game, a poppy the
 * bee pollinates drops a petal a little while later, fluttering down (and a heavy
 * shower can knock one off); each one that falls is gone from the head. Found by
 * walking or flying low under the flowers.
 */
export type PetalKind = 'poppy';
export interface FallenPetal {
  id: number;
  kind: PetalKind;
  flowerId: number;
  position: THREE.Vector3;
  falling: boolean;
  /** On the ground or falling (a poppy's spare petal waits unseen until it drops). */
  shown: boolean;
  seen: boolean;
  /** 0 just fallen, 1 a couple of days down: how withered it is. */
  age: number;
}
interface Petal extends FallenPetal {
  yaw: number;
  /** Tipped a little where it lies on the leaves. */
  tilt: [number, number];
  size: number;
  fall: { from: THREE.Vector3; t: number; duration: number; spin: number } | null;
  /** Waiting to drop (seconds), for a petal of a flower just pollinated. */
  wait: number;
}

const VISIBLE_RANGE = 12;
/** Poppy petals are 3–5 cm. */
const POPPY_LENGTH = .4;

/** A fallen poppy petal. Fresh: a broad, softly crumpled red fan. Withered (a day or two down):
 * shrunk, deeply crinkled, its edges rolled in and the tip curled under, the colour gone
 * dark and papery (the darkening itself comes per petal, from its age: see tint). */
function petalGeometry(withered: boolean): THREE.BufferGeometry {
  const rows = withered ? 10 : 7, cols = withered ? 7 : 5, length = POPPY_LENGTH * (withered ? .82 : 1);
  const positions: number[] = [], colours: number[] = [], index: number[] = [];
  const colour = new THREE.Color();
  const red = new THREE.Color('#e44739'), paleRed = new THREE.Color('#f7765e'), blotch = new THREE.Color('#502d43');
  const wine = new THREE.Color('#6a3438'), papery = new THREE.Color('#a8907c');
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const u = i / rows, v = j / cols * 2 - 1;
    // A broad fan from a narrow claw (narrower once it has shrivelled and rolled in).
    const half = length * (withered ? .4 : .52) * Math.pow(Math.sin(Math.min(1, u * 1.08 + .06) * Math.PI * .62), .75);
    const x = v * half;
    let z = u * length, y: number;
    if (withered) {
      // Crinkled all over, edges rolled up and in, the tip curling under.
      const crinkle = .022 * Math.sin(v * 7.3 + u * 17) + .016 * Math.sin(u * 23 + v * 5.1) + .01 * Math.sin(u * 41 + v * 11);
      const roll = .085 * Math.pow(Math.abs(v), 1.6) * (.4 + u);
      const curl = Math.max(0, u - .7) / .3;
      y = Math.max(0, crinkle + roll + .03 * u * u - .05 * curl * curl) + .003;
      z -= .04 * curl * curl * length;
    } else {
      // Crumpled a little: soft ripples, edges curling up, the tip lifted.
      const crumple = .014 * Math.sin(v * 3.3 + u * 7) + .01 * Math.sin(u * 13 + v * 2);
      y = Math.max(0, crumple + .028 * v * v + .02 * u * u) + .002;
    }
    positions.push(withered ? x * (1 - .25 * Math.abs(v) * u) : x, y, z);
    colour.copy(red).lerp(paleRed, u * .5 + Math.abs(v) * .12);
    // Withered: duller, drying paler and papery at the edges and tip first.
    if (withered) colour.lerp(wine, .85 + .15 * Math.sin(u * 9 + v * 4)).lerp(papery, Math.pow(Math.max(Math.abs(v), u), 1.8) * .8);
    colour.lerp(blotch, Math.pow(Math.max(0, 1 - u / (withered ? .3 : .2)), 1.5) * .9);
    colours.push(colour.r, colour.g, colour.b);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index); g.computeVertexNormals();
  // Centred on the petal's middle so it turns about itself as it falls.
  g.translate(0, 0, -length * .5);
  return g;
}
/** Older petals than this lie withered (the other geometry). */
const WITHERED_FROM = .4;
/** A petal's colour by age (multiplies its painted colour): fresh as it is, darkening with age
 * (the withered shape is also painted wine-brown and papery tan, as poppy petals go when they dry). */
const freshTint = new THREE.Color(1, 1, 1), oldTint = new THREE.Color(.7, .62, .66);
function tint(age: number, out: THREE.Color): THREE.Color {
  return out.copy(freshTint).lerp(oldTint, THREE.MathUtils.smoothstep(age, .15, 1));
}

export function createPetals(scene: THREE.Scene, seed: number, flowers: readonly Flower[], spots: readonly PetalSpot[]) {
  const random = rng((seed ^ 0x9e7a1) >>> 0 || 17), ageRandom = rng((seed ^ 0x3a9e5) >>> 0 || 7);
  const petals: Petal[] = [];
  const add = (spot: PetalSpot, wait: number) => {
    // The spots are kept clear of the low leafy cover (world.ts); a petal lies
    // just above the soil, among the grass stems.
    const petal: Petal = {
      id: petals.length, kind: spot.kind, flowerId: spot.flowerId, position: new THREE.Vector3(spot.x, meadowGroundHeight(spot.x, spot.z) + .012 + random() * .01, spot.z), falling: false, seen: false,
      yaw: random() * Math.PI * 2, tilt: [(random() - .5) * .16, (random() - .5) * .16], size: .8 + random() * .4, fall: null, wait, shown: wait === 0,
      // Petals down from earlier days are at all stages, most a little withered; one still to fall is fresh.
      age: wait === 0 ? Math.pow(ageRandom(), .7) : 0,
    };
    // A withered petal has shrunk.
    petal.size *= 1 - .2 * THREE.MathUtils.smoothstep(petal.age, WITHERED_FROM, 1);
    petals.push(petal);
    return petal;
  };
  // Petals already down from earlier days; each poppy also keeps one ready to
  // drop once it is pollinated.
  const spare = new Map<number, Petal>();
  for (const spot of spots) {
    const petal = add(spot, spot.spare ? -1 : 0);
    if (spot.spare) spare.set(spot.flowerId, petal);
  }
  const byFlower = new Map(flowers.map(f => [f.id, f]));

  const freshGeometry = petalGeometry(false), witheredGeometry = petalGeometry(true);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0, side: THREE.DoubleSide });
  // Dry petals are matt and papery.
  const witheredMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, side: THREE.DoubleSide });
  const freshMesh = new THREE.InstancedMesh(freshGeometry, material, Math.max(1, petals.length));
  const witheredMesh = new THREE.InstancedMesh(witheredGeometry, witheredMaterial, Math.max(1, petals.length));
  freshMesh.name = 'fallen poppy petals'; witheredMesh.name = 'withered poppy petals';
  const colour = new THREE.Color();
  for (const mesh of [freshMesh, witheredMesh]) {
    mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.setColorAt(0, colour.set(1, 1, 1)); scene.add(mesh);
  }
  const shadowTexture = (() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d')!, gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.45, 'rgba(255,255,255,.75)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, color: '#1c2212', transparent: true, opacity: .62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -1 });
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, petals.length || 1);
  shadows.name = 'fallen petal shadows'; shadows.frustumCulled = false; shadows.renderOrder = 1;
  scene.add(shadows);
  let shadowCount = 0;

  let lastTime = 0;
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(), at = new THREE.Vector3(), ground = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let drawnFresh = 0, drawnWithered = 0;
  function place(petal: Petal, camera: THREE.Vector3, time: number): void {
    if (!petal.shown || Math.hypot(petal.position.x - camera.x, petal.position.z - camera.z) > VISIBLE_RANGE && !petal.fall) return;
    // Only petals near the camera are drawn, packed into the first instances.
    const withered = petal.age >= WITHERED_FROM, mesh = withered ? witheredMesh : freshMesh;
    const index = withered ? drawnWithered++ : drawnFresh++;
    if (petal.fall) {
      // Fluttering down: drifting side to side, rocking and slowly turning.
      const { from, t, spin } = petal.fall, e = t * t * (3 - 2 * t);
      at.lerpVectors(from, petal.position, e);
      const sway = Math.sin(t * 9 + spin) * .35 * (1 - t);
      at.x += Math.cos(petal.yaw) * sway; at.z += Math.sin(petal.yaw) * sway;
      euler.set(Math.sin(t * 11 + spin) * .9 * (1 - t) + petal.tilt[0] * e, petal.yaw + (1 - t) * spin * 2, Math.cos(t * 7) * .6 * (1 - t) + petal.tilt[1] * e);
      void time;
    } else {
      at.copy(petal.position);
      euler.set(petal.tilt[0], petal.yaw, petal.tilt[1]);
    }
    rotation.setFromEuler(euler);
    matrix.compose(at, rotation, scale.setScalar(petal.size));
    mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, tint(petal.age, colour));
    // Its shadow lies just under it, and grows in as a falling petal lands.
    const landing = petal.fall ? THREE.MathUtils.smoothstep(petal.fall.t, .75, 1) : 1;
    if (landing > .01) {
      rotation.setFromAxisAngle(up, petal.yaw);
      ground.set(at.x, meadowGroundHeight(at.x, at.z) + .006, at.z);
      matrix.compose(ground, rotation, scale.set(.95 * petal.size * landing, 1, .95 * petal.size * landing));
      shadows.setMatrixAt(shadowCount++, matrix);
    }
  }

  return {
    petals: petals as readonly FallenPetal[],
    update(time: number, camera: THREE.Vector3): void {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      drawnFresh = 0; drawnWithered = 0; shadowCount = 0;
      for (const petal of petals) {
        if (petal.wait > 0) {
          petal.wait = Math.max(0, petal.wait - dt);
          if (petal.wait === 0) {
            const f = byFlower.get(petal.flowerId)!;
            petal.shown = true; petal.falling = true;
            // It comes off the head (the flower now has one petal fewer) and flutters down from there.
            const lost = losePetal(f, random);
            const from = lost >= 0 ? petalPoint(f, lost, new THREE.Vector3()) : f.center.clone().add(new THREE.Vector3(Math.cos(petal.yaw), 0, Math.sin(petal.yaw)).multiplyScalar(f.radius * .55));
            petal.fall = { from, t: 0, duration: 5 + random() * 2, spin: random() * 6 };
          }
        }
        if (petal.fall) {
          petal.fall.t = Math.min(1, petal.fall.t + dt / petal.fall.duration);
          if (petal.fall.t >= 1) { petal.fall = null; petal.falling = false; }
        }
        place(petal, camera, time);
      }
      freshMesh.count = drawnFresh; witheredMesh.count = drawnWithered;
      for (const mesh of [freshMesh, witheredMesh]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true; }
      shadows.count = shadowCount; shadows.instanceMatrix.needsUpdate = true;
    },
    /** A pollinated poppy lets a petal go a little while later. */
    drop(flowerId: number, delay = 8 + random() * 10): boolean {
      const petal = spare.get(flowerId);
      if (!petal || petal.wait !== -1) return false;
      petal.wait = Math.max(.01, delay);
      return true;
    },
    /** The nearest petal on the ground (not one still falling). */
    nearest(point: THREE.Vector3): { petal: FallenPetal; distance: number } | null {
      let found: Petal | null = null, distance = Infinity;
      for (const petal of petals) {
        if (!petal.shown || petal.fall) continue;
        // Across the ground, not counting the height of a bee sitting in the grass.
        const d = Math.hypot(petal.position.x - point.x, petal.position.z - point.z) + Math.max(0, point.y - petal.position.y - 1.2);
        if (d < distance) { distance = d; found = petal; }
      }
      return found ? { petal: found, distance } : null;
    },
    markSeen(id: number): void { const petal = petals[id]; if (petal) petal.seen = true; },
    seenCount(): number { return petals.filter(p => p.seen).length; },
    reset(): void { for (const petal of petals) petal.seen = false; },
    diagnostics() {
      return { petals: petals.filter(p => p.shown).length, falling: petals.filter(p => p.fall).length, withered: petals.filter(p => p.shown && p.age >= WITHERED_FROM).length, waiting: petals.filter(p => p.wait > 0).length, seen: petals.filter(p => p.seen).length };
    },
    dispose(): void {
      scene.remove(freshMesh, witheredMesh, shadows); shadowGeometry.dispose(); shadowMaterial.dispose(); shadowTexture.dispose(); shadows.dispose(); freshGeometry.dispose(); witheredGeometry.dispose(); material.dispose(); witheredMaterial.dispose(); freshMesh.dispose(); witheredMesh.dispose();
    },
  };
}
