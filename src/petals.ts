import * as THREE from 'three';
import { meadowGroundHeight, rng } from './world';
import type { Flower, PetalSpot } from './types';

/**
 * Fallen petals on the ground under the flowers: broad red poppy petals, crumpled
 * a little, and the narrow white rays of daisies. A poppy flower lasts only a day
 * or so, so its petals drop soon after it is pollinated: in the game, a poppy the
 * bee pollinates drops a petal a little while later, fluttering down. Found by
 * walking or flying low under the flowers.
 */
export type PetalKind = 'poppy' | 'daisy';
export interface FallenPetal {
  id: number;
  kind: PetalKind;
  flowerId: number;
  position: THREE.Vector3;
  falling: boolean;
  /** On the ground or falling (a poppy's spare petal waits unseen until it drops). */
  shown: boolean;
  seen: boolean;
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
/** Poppy petals are 3–5 cm; daisy rays about 1.3 cm. */
const POPPY_LENGTH = .4, DAISY_LENGTH = .15;

function petalGeometry(kind: PetalKind): THREE.BufferGeometry {
  const daisy = kind === 'daisy';
  const rows = daisy ? 10 : 7, cols = daisy ? 6 : 5;
  const length = kind === 'poppy' ? POPPY_LENGTH : DAISY_LENGTH;
  const vein = new THREE.Color('#d8cfae'), base = new THREE.Color('#dcd59c');
  const positions: number[] = [], colours: number[] = [], index: number[] = [];
  const colour = new THREE.Color();
  const red = new THREE.Color('#e44739'), paleRed = new THREE.Color('#f7765e'), blotch = new THREE.Color('#502d43');
  const white = new THREE.Color('#fff9e2');
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const u = i / rows, v = j / cols * 2 - 1;
    // Poppies: a broad fan from a narrow claw; daisies: a long, narrow strap.
    // Daisies: a flat strap (a ray floret) from a narrow base, its tip ending
    // in three small teeth.
    const half = kind === 'poppy'
      ? length * .52 * Math.pow(Math.sin(Math.min(1, u * 1.08 + .06) * Math.PI * .62), .75)
      : length * .15 * Math.min(1, .35 + u * 5) * (u > .9 ? 1 - (u - .9) * 2.5 : 1);
    const teeth = daisy && i === rows ? -length * .045 * Math.abs(Math.sin(v * Math.PI * 1.5)) : 0;
    const x = v * half, z = u * length + teeth;
    // Crumpled a little: soft ripples, edges curling up, the tip lifted.
    const crumple = kind === 'poppy' ? .014 * Math.sin(v * 3.3 + u * 7) + .01 * Math.sin(u * 13 + v * 2) : .0015 * Math.sin(u * 7 + v);
    // Poppies curl at the edges; a daisy ray is a shallow gutter, lifting a little toward the tip.
    const y = Math.max(0, crumple + (kind === 'poppy' ? .028 : .005) * v * v + (kind === 'poppy' ? .02 : .008) * u * u) + .002;
    positions.push(x, y, z);
    if (kind === 'poppy') colour.copy(red).lerp(paleRed, u * .5 + Math.abs(v) * .12).lerp(blotch, Math.pow(Math.max(0, 1 - u / .2), 1.5) * .9);
    else {
      // Fine lengthwise veins, and a pale green-yellow base where it joined the flower head.
      colour.copy(white).lerp(vein, j % 2 === 1 && u > .1 && u < .95 ? .75 : 0).lerp(base, Math.max(0, 1 - u / .14) * .8);
    }
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

export function createPetals(scene: THREE.Scene, seed: number, flowers: readonly Flower[], spots: readonly PetalSpot[]) {
  const random = rng((seed ^ 0x9e7a1) >>> 0 || 17);
  const petals: Petal[] = [];
  const add = (spot: PetalSpot, wait: number) => {
    // The spots are kept clear of the low leafy cover (world.ts); a petal lies
    // just above the soil, among the grass stems.
    const petal: Petal = {
      id: petals.length, kind: spot.kind, flowerId: spot.flowerId, position: new THREE.Vector3(spot.x, meadowGroundHeight(spot.x, spot.z) + .012 + random() * .01, spot.z), falling: false, seen: false,
      yaw: random() * Math.PI * 2, tilt: [(random() - .5) * .16, (random() - .5) * .16], size: .8 + random() * .4, fall: null, wait, shown: wait === 0,
    };
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

  const poppyGeometry = petalGeometry('poppy'), daisyGeometry = petalGeometry('daisy');
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0, side: THREE.DoubleSide });
  const poppyCount = Math.max(1, petals.filter(p => p.kind === 'poppy').length), daisyCount = Math.max(1, petals.filter(p => p.kind === 'daisy').length);
  const poppyMesh = new THREE.InstancedMesh(poppyGeometry, material, poppyCount), daisyMesh = new THREE.InstancedMesh(daisyGeometry, material, daisyCount);
  poppyMesh.name = 'fallen poppy petals'; daisyMesh.name = 'fallen daisy petals';
  for (const mesh of [poppyMesh, daisyMesh]) { mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh); }
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
  const shadowSize = { poppy: [.95, .95], daisy: [.12, .26] } as const;
  const slot = new Map<number, [THREE.InstancedMesh, number]>();
  { let p = 0, d = 0; for (const petal of petals) slot.set(petal.id, petal.kind === 'poppy' ? [poppyMesh, p++] : [daisyMesh, d++]); }

  let lastTime = 0;
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(), at = new THREE.Vector3(), ground = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const drawn = new Map<THREE.InstancedMesh, number>();
  function place(petal: Petal, camera: THREE.Vector3, time: number): void {
    const [mesh] = slot.get(petal.id)!;
    if (!petal.shown || Math.hypot(petal.position.x - camera.x, petal.position.z - camera.z) > VISIBLE_RANGE && !petal.fall) return;
    // Only petals near the camera are drawn, packed into the first instances.
    const index = drawn.get(mesh) ?? 0; drawn.set(mesh, index + 1);
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
    mesh.setMatrixAt(index, matrix);
    // Its shadow lies just under it, and grows in as a falling petal lands.
    const landing = petal.fall ? THREE.MathUtils.smoothstep(petal.fall.t, .75, 1) : 1;
    if (landing > .01) {
      const [w, l] = shadowSize[petal.kind];
      rotation.setFromAxisAngle(up, petal.yaw);
      ground.set(at.x, meadowGroundHeight(at.x, at.z) + .006, at.z);
      matrix.compose(ground, rotation, scale.set(w * petal.size * landing, 1, l * petal.size * landing));
      shadows.setMatrixAt(shadowCount++, matrix);
    }
  }

  return {
    petals: petals as readonly FallenPetal[],
    update(time: number, camera: THREE.Vector3): void {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      drawn.clear(); shadowCount = 0;
      for (const petal of petals) {
        if (petal.wait > 0) {
          petal.wait = Math.max(0, petal.wait - dt);
          if (petal.wait === 0) {
            const f = byFlower.get(petal.flowerId)!;
            petal.shown = true; petal.falling = true;
            petal.fall = { from: f.center.clone().add(new THREE.Vector3(Math.cos(petal.yaw), 0, Math.sin(petal.yaw)).multiplyScalar(f.radius * .55)), t: 0, duration: 5 + random() * 2, spin: random() * 6 };
          }
        }
        if (petal.fall) {
          petal.fall.t = Math.min(1, petal.fall.t + dt / petal.fall.duration);
          if (petal.fall.t >= 1) { petal.fall = null; petal.falling = false; }
        }
        place(petal, camera, time);
      }
      poppyMesh.count = drawn.get(poppyMesh) ?? 0; daisyMesh.count = drawn.get(daisyMesh) ?? 0;
      poppyMesh.instanceMatrix.needsUpdate = true; daisyMesh.instanceMatrix.needsUpdate = true;
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
      return { petals: petals.filter(p => p.shown).length, poppy: petals.filter(p => p.shown && p.kind === 'poppy').length, daisy: petals.filter(p => p.shown && p.kind === 'daisy').length, falling: petals.filter(p => p.fall).length, waiting: petals.filter(p => p.wait > 0).length, seen: petals.filter(p => p.seen).length };
    },
    dispose(): void {
      scene.remove(poppyMesh, daisyMesh, shadows); shadowGeometry.dispose(); shadowMaterial.dispose(); shadowTexture.dispose(); shadows.dispose(); poppyGeometry.dispose(); daisyGeometry.dispose(); material.dispose(); poppyMesh.dispose(); daisyMesh.dispose();
    },
  };
}
