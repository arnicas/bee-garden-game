import * as THREE from 'three';
import { flightWindAt } from './wind';
import { createSeededRandom } from './utils/random';

/** Presentation-only consumers of flightWindAt: +Y up, art units / second.
 * The field owner supplies the same simulation clock used by flight. This pool
 * never changes wind, bee motion, flower poses, or gameplay state. A fixed 60 Hz
 * CPU step is sufficient for 105 records; there are no GPU readbacks or textures.
 */
const CURRENT_COUNT = 45;
const FRAGMENT_COUNT = 60;
const CAPACITY = CURRENT_COUNT + FRAGMENT_COUNT;
const TRAIL_SAMPLES = 8;
const FIXED_STEP = 1 / 60;
const SAMPLE_INTERVAL = 0.1;
const SEED = 0xbee572;
const TAU = Math.PI * 2;
const TRAIL_VERTICES = CURRENT_COUNT * TRAIL_SAMPLES * 2;
const FRAGMENT_VERTICES = FRAGMENT_COUNT * 7;
const MAX_TRIANGLES = CURRENT_COUNT * (TRAIL_SAMPLES - 1) * 2 + FRAGMENT_COUNT * 6;

export interface WindEffects {
  update(dt: number, time: number, position: THREE.Vector3, camera: THREE.Camera, reducedMotion: boolean, enabled: boolean): void;
  reset(position: THREE.Vector3, time: number): void;
  diagnostics(): Record<string, unknown>;
  dispose(): void;
}

function softEdge(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function particleMaterial(ribbon: boolean): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: ribbon ? '#fff0c1' : '#ffffff',
    vertexColors: !ribbon,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: true,
  });
  // Transparent double-sided sheets otherwise receive a second back-face pass.
  material.forceSinglePass = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float particleAlpha; varying float vParticleAlpha; varying vec2 vParticleUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvParticleAlpha = particleAlpha; vParticleUv = uv;');
    shader.fragmentShader = 'varying float vParticleAlpha; varying vec2 vParticleUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.a *= vParticleAlpha;
      ${ribbon ? 'diffuseColor.a *= 1.0 - pow(abs(vParticleUv.x * 2.0 - 1.0), 1.5);' : ''}
    `);
  };
  material.customProgramCacheKey = () => `bee-wind-pool-v1-${ribbon ? 'current' : 'fragment'}`;
  return material;
}

export function createWindEffects(scene: THREE.Scene): WindEffects {
  const group = new THREE.Group(); group.name = 'visible meadow currents'; scene.add(group);
  const positions = new Float64Array(CAPACITY * 3);
  const ages = new Float64Array(CAPACITY), lifetimes = new Float64Array(CAPACITY);
  const sizes = new Float64Array(CAPACITY), phases = new Float64Array(CAPACITY), spin = new Float64Array(CAPACITY);
  const generations = new Uint32Array(CAPACITY);
  const pigment = new Float32Array(FRAGMENT_COUNT * 3);
  const history = new Float64Array(CURRENT_COUNT * TRAIL_SAMPLES * 3);
  const heads = new Uint8Array(CURRENT_COUNT), historyCounts = new Uint8Array(CURRENT_COUNT);

  const trailPositions = new Float32Array(TRAIL_VERTICES * 3), trailAlphas = new Float32Array(TRAIL_VERTICES), trailUv = new Float32Array(TRAIL_VERTICES * 2);
  const trailIndices = new Uint16Array(CURRENT_COUNT * (TRAIL_SAMPLES - 1) * 6);
  for (let particle = 0; particle < CURRENT_COUNT; particle++) {
    for (let sample = 0; sample < TRAIL_SAMPLES; sample++) {
      const a = (particle * TRAIL_SAMPLES + sample) * 2;
      trailUv.set([0, sample / (TRAIL_SAMPLES - 1), 1, sample / (TRAIL_SAMPLES - 1)], a * 2);
      if (sample < TRAIL_SAMPLES - 1) trailIndices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], (particle * (TRAIL_SAMPLES - 1) + sample) * 6);
    }
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('particleAlpha', new THREE.BufferAttribute(trailAlphas, 1).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('uv', new THREE.BufferAttribute(trailUv, 2));
  trailGeometry.setIndex(new THREE.BufferAttribute(trailIndices, 1));
  trailGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 23);
  const trailMaterial = particleMaterial(true), trails = new THREE.Mesh(trailGeometry, trailMaterial); trails.name = '45 advected cream ribbons'; group.add(trails);

  // A curved six-sided fragment, with a brighter central vein. Seven vertices
  // and six faces retain a petal silhouette as it tumbles; no sprite texture.
  const fragmentShape = new Float32Array([
    0, 0, 0.10,
    -0.64, 0, 0.035, -0.33, 0.38, 0, 0.25, 0.44, 0.045,
    0.64, 0, 0, 0.25, -0.33, 0.045, -0.33, -0.27, 0,
  ]);
  const fragmentPositions = new Float32Array(FRAGMENT_VERTICES * 3), fragmentColors = new Float32Array(FRAGMENT_VERTICES * 3), fragmentAlpha = new Float32Array(FRAGMENT_VERTICES), fragmentUv = new Float32Array(FRAGMENT_VERTICES * 2);
  const fragmentIndices = new Uint16Array(FRAGMENT_COUNT * 18);
  for (let particle = 0; particle < FRAGMENT_COUNT; particle++) for (let face = 0; face < 6; face++) fragmentIndices.set([particle * 7, particle * 7 + face + 1, particle * 7 + (face + 1) % 6 + 1], particle * 18 + face * 3);
  const fragmentGeometry = new THREE.BufferGeometry();
  fragmentGeometry.setAttribute('position', new THREE.BufferAttribute(fragmentPositions, 3).setUsage(THREE.DynamicDrawUsage));
  fragmentGeometry.setAttribute('color', new THREE.BufferAttribute(fragmentColors, 3).setUsage(THREE.DynamicDrawUsage));
  fragmentGeometry.setAttribute('particleAlpha', new THREE.BufferAttribute(fragmentAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  fragmentGeometry.setAttribute('uv', new THREE.BufferAttribute(fragmentUv, 2));
  fragmentGeometry.setIndex(new THREE.BufferAttribute(fragmentIndices, 1));
  fragmentGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 23);
  const fragmentMaterial = particleMaterial(false), fragments = new THREE.Mesh(fragmentGeometry, fragmentMaterial); fragments.name = '60 drifting petals and leaves'; group.add(fragments);

  const anchor = new THREE.Vector3(), previousAnchor = new THREE.Vector3(), field = new THREE.Vector3(), midpoint = new THREE.Vector3();
  const point = new THREE.Vector3(), before = new THREE.Vector3(), after = new THREE.Vector3(), tangent = new THREE.Vector3(), view = new THREE.Vector3(), side = new THREE.Vector3(), previousSide = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(), local = new THREE.Vector3(), normal = new THREE.Vector3();
  const orientation = new THREE.Quaternion(), euler = new THREE.Euler(), color = new THREE.Color();
  let random = createSeededRandom(SEED);
  let initialized = false, disposed = false, enabledLast = true, reducedLast = false;
  let simulationTime = 0, latestTime = 0, accumulator = 0, sampleAccumulator = 0;
  let resetCount = 0, historyResetCount = 0, respawnCount = 0, steps = 0;
  let activeCurrents = 0, activeFragments = 0, maxTrailSegment = 0;
  const palette = [new THREE.Color('#d78974'), new THREE.Color('#eee3bc'), new THREE.Color('#82956b')];

  function clearHistory(particle: number) {
    const p = particle * 3;
    for (let sample = 0; sample < TRAIL_SAMPLES; sample++) {
      const target = (particle * TRAIL_SAMPLES + sample) * 3;
      history[target] = positions[p]; history[target + 1] = positions[p + 1]; history[target + 2] = positions[p + 2];
    }
    heads[particle] = 0; historyCounts[particle] = 1; historyResetCount++;
  }

  function spawn(particle: number, initial: boolean) {
    const angle = random() * TAU, radius = 3.0 + Math.sqrt(random()) * 10.0;
    const p = particle * 3;
    positions[p] = anchor.x + Math.cos(angle) * radius;
    positions[p + 1] = Math.max(0.48, anchor.y - 2.2 + random() * 6.0);
    positions[p + 2] = anchor.z + Math.sin(angle) * radius;
    lifetimes[particle] = particle < CURRENT_COUNT ? 7 + random() * 5 : 10 + random() * 9;
    ages[particle] = initial ? random() * lifetimes[particle] * 0.7 : 0;
    sizes[particle] = particle < CURRENT_COUNT ? 0.018 + random() * 0.012 : 0.075 + random() * 0.085;
    phases[particle] = random() * TAU; spin[particle] = 0.36 + random() * 0.8;
    generations[particle]++;
    if (particle < CURRENT_COUNT) clearHistory(particle);
    else {
      // Stable population roles: 20 coral petals, 20 ivory petals, 20 green leaves.
      const id = particle - CURRENT_COUNT; color.copy(palette[id % palette.length]).multiplyScalar(0.9 + random() * 0.1);
      pigment[id * 3] = color.r; pigment[id * 3 + 1] = color.g; pigment[id * 3 + 2] = color.b;
    }
    if (!initial) respawnCount++;
  }

  function reset(position: THREE.Vector3, time: number) {
    if (disposed) return;
    anchor.copy(position); previousAnchor.copy(position); simulationTime = latestTime = time;
    accumulator = 0; sampleAccumulator = 0; random = createSeededRandom(SEED);
    for (let i = 0; i < CAPACITY; i++) spawn(i, true);
    trailAlphas.fill(0); fragmentAlpha.fill(0);
    trailGeometry.attributes.particleAlpha.needsUpdate = true; fragmentGeometry.attributes.particleAlpha.needsUpdate = true;
    trailGeometry.boundingSphere!.center.copy(position); fragmentGeometry.boundingSphere!.center.copy(position);
    activeCurrents = 0; activeFragments = 0; maxTrailSegment = 0; resetCount++; initialized = true;
  }

  function integrate() {
    const sampleTime = simulationTime + FIXED_STEP * 0.5;
    for (let i = 0; i < CAPACITY; i++) {
      const p = i * 3;
      flightWindAt(positions[p], positions[p + 1], positions[p + 2], simulationTime, field);
      midpoint.set(positions[p], positions[p + 1], positions[p + 2]).addScaledVector(field, FIXED_STEP * 0.5);
      flightWindAt(midpoint.x, midpoint.y, midpoint.z, sampleTime, field);
      positions[p] += field.x * FIXED_STEP;
      positions[p + 1] += field.y * FIXED_STEP;
      positions[p + 2] += field.z * FIXED_STEP;
      // Tiny debris settling is visual only. Horizontal movement remains an
      // unscaled sample of the same air velocity used by the bee.
      if (i >= CURRENT_COUNT) positions[p + 1] -= FIXED_STEP * 0.028;
      ages[i] += FIXED_STEP;
      const dx = positions[p] - anchor.x, dz = positions[p + 2] - anchor.z;
      if (ages[i] >= lifetimes[i] || dx * dx + dz * dz > 15 * 15 || positions[p + 1] < 0.25 || Math.abs(positions[p + 1] - anchor.y) > 7) spawn(i, false);
    }
    simulationTime += FIXED_STEP; sampleAccumulator += FIXED_STEP; steps++;
    if (sampleAccumulator + 1e-8 >= SAMPLE_INTERVAL) {
      sampleAccumulator -= SAMPLE_INTERVAL;
      for (let i = 0; i < CURRENT_COUNT; i++) {
        const next = (heads[i] + 1) % TRAIL_SAMPLES, p = i * 3, target = (i * TRAIL_SAMPLES + next) * 3;
        history[target] = positions[p]; history[target + 1] = positions[p + 1]; history[target + 2] = positions[p + 2];
        heads[i] = next; historyCounts[i] = Math.min(TRAIL_SAMPLES, historyCounts[i] + 1);
      }
    }
  }

  function particleOpacity(i: number): number {
    const p = i * 3, horizontal = Math.hypot(positions[p] - anchor.x, positions[p + 2] - anchor.z);
    const cameraDistance = Math.hypot(positions[p] - cameraPosition.x, positions[p + 1] - cameraPosition.y, positions[p + 2] - cameraPosition.z);
    return softEdge(ages[i] / 0.7) * softEdge((lifetimes[i] - ages[i]) / 1.1)
      * (1 - softEdge((horizontal - 11) / 4)) * softEdge((cameraDistance - 1.1) / 1.6);
  }

  function readTrailPoint(particle: number, sample: number, out: THREE.Vector3) {
    const count = historyCounts[particle];
    const chronological = Math.max(0, Math.min(count - 1, sample - (TRAIL_SAMPLES - count)));
    if (chronological === count - 1) return out.fromArray(positions, particle * 3);
    const slot = (heads[particle] - count + 1 + chronological + TRAIL_SAMPLES) % TRAIL_SAMPLES;
    return out.fromArray(history, (particle * TRAIL_SAMPLES + slot) * 3);
  }

  function publish(camera: THREE.Camera, reducedMotion: boolean) {
    camera.getWorldPosition(cameraPosition); activeCurrents = 0; activeFragments = 0; maxTrailSegment = 0;
    trails.visible = !reducedMotion;
    if (!reducedMotion) {
      for (let i = 0; i < CURRENT_COUNT; i++) {
        const p = i * 3;
        flightWindAt(positions[p], positions[p + 1], positions[p + 2], simulationTime, field);
        const strength = Math.min(1, field.length() / 2.5);
        const opacity = particleOpacity(i) * (0.22 + strength * 0.40);
        if (opacity > 0.01 && historyCounts[i] > 1) activeCurrents++;
        previousSide.set(0, 0, 0);
        for (let sample = 0; sample < TRAIL_SAMPLES; sample++) {
          readTrailPoint(i, sample, point); readTrailPoint(i, Math.max(0, sample - 1), before); readTrailPoint(i, Math.min(TRAIL_SAMPLES - 1, sample + 1), after);
          tangent.subVectors(after, before);
          const segmentLength = point.distanceTo(before); maxTrailSegment = Math.max(maxTrailSegment, segmentLength);
          const valid = tangent.lengthSq() > 1e-10 && sample >= TRAIL_SAMPLES - historyCounts[i];
          if (valid) {
            tangent.normalize(); view.subVectors(cameraPosition, point).normalize(); side.crossVectors(tangent, view);
            if (side.lengthSq() < 1e-8) side.set(-tangent.z, 0, tangent.x);
            if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
            side.normalize(); if (previousSide.lengthSq() > 0 && side.dot(previousSide) < 0) side.negate(); previousSide.copy(side);
          } else side.set(0, 1, 0);
          const normalized = sample / (TRAIL_SAMPLES - 1);
          const taper = Math.pow(Math.sin(normalized * Math.PI), 0.65);
          const width = sizes[i] * taper;
          for (let edge = 0; edge < 2; edge++) {
            const vertex = (i * TRAIL_SAMPLES + sample) * 2 + edge, sign = edge ? 1 : -1;
            trailPositions[vertex * 3] = point.x + side.x * width * sign;
            trailPositions[vertex * 3 + 1] = point.y + side.y * width * sign;
            trailPositions[vertex * 3 + 2] = point.z + side.z * width * sign;
            trailAlphas[vertex] = valid ? opacity * taper : 0;
          }
        }
      }
      trailGeometry.attributes.position.needsUpdate = true; trailGeometry.attributes.particleAlpha.needsUpdate = true;
    }
    for (let fragment = 0; fragment < FRAGMENT_COUNT; fragment++) {
      const i = fragment + CURRENT_COUNT, p = i * 3;
      const phase = phases[i], angle = ages[i] * spin[i];
      euler.set(phase + angle * 0.7, phase * 0.6 + angle * 0.43, angle * 0.84); orientation.setFromEuler(euler);
      normal.set(0, 0, 1).applyQuaternion(orientation);
      const light = 0.7 + Math.abs(normal.y * 0.83 + normal.x * 0.32) * 0.3;
      const opacity = particleOpacity(i) * (reducedMotion ? 0.22 : 0.72);
      if (opacity > 0.01) activeFragments++;
      for (let vertex = 0; vertex < 7; vertex++) {
        local.fromArray(fragmentShape, vertex * 3);
        if (fragment % 3 === 2) local.y *= 0.55;
        local.multiplyScalar(sizes[i]).applyQuaternion(orientation);
        const target = fragment * 7 + vertex;
        fragmentPositions[target * 3] = positions[p] + local.x; fragmentPositions[target * 3 + 1] = positions[p + 1] + local.y; fragmentPositions[target * 3 + 2] = positions[p + 2] + local.z;
        const shade = light * (vertex === 0 ? 1 : 0.91);
        fragmentColors[target * 3] = pigment[fragment * 3] * shade; fragmentColors[target * 3 + 1] = pigment[fragment * 3 + 1] * shade; fragmentColors[target * 3 + 2] = pigment[fragment * 3 + 2] * shade;
        fragmentAlpha[target] = opacity;
      }
    }
    fragmentGeometry.attributes.position.needsUpdate = true; fragmentGeometry.attributes.color.needsUpdate = true; fragmentGeometry.attributes.particleAlpha.needsUpdate = true;
    trailGeometry.boundingSphere!.center.copy(anchor); fragmentGeometry.boundingSphere!.center.copy(anchor);
  }

  return {
    update(dt, time, position, camera, reducedMotion, enabled) {
      if (disposed) return;
      const delta = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
      const cut = initialized && (previousAnchor.distanceToSquared(position) > 36 || time < latestTime - 0.001 || Math.abs(time - latestTime) > Math.max(0.4, delta * 2 + 0.05));
      const restarted = !initialized || cut || (enabled && !enabledLast) || (!reducedMotion && reducedLast);
      if (restarted) reset(position, time);
      anchor.copy(position); previousAnchor.copy(position); latestTime = time; group.visible = enabled; enabledLast = enabled; reducedLast = reducedMotion;
      if (!enabled) { activeCurrents = 0; activeFragments = 0; accumulator = 0; return; }
      // Reduced-motion fragments retain world positions and orientation. Changing
      // camera heading still reveals parallax; there is no screen-space motion.
      if (!reducedMotion && delta > 0 && !restarted) {
        accumulator += delta;
        while (accumulator + 1e-8 >= FIXED_STEP) { integrate(); accumulator -= FIXED_STEP; }
      }
      publish(camera, reducedMotion);
    },
    reset,
    diagnostics() {
      flightWindAt(positions[0], positions[1], positions[2], simulationTime, field);
      return {
        seed: SEED, enabled: enabledLast, reducedMotion: reducedLast,
        capacity: { currents: CURRENT_COUNT, fragments: FRAGMENT_COUNT },
        activeCurrents, activeFragments, drawCalls: !enabledLast ? 0 : reducedLast ? 1 : 2,
        maxTriangles: MAX_TRIANGLES, resetCount, historyResetCount, respawnCount, integrationSteps: steps,
        simulationTime, sampleInterval: SAMPLE_INTERVAL, trailCapacity: TRAIL_SAMPLES, maxTrailSegment,
        tracer: { position: [positions[0], positions[1], positions[2]], velocity: field.toArray(), age: ages[0], generation: generations[0], historyCount: historyCounts[0] },
        motion: 'world-space fixed-step midpoint advection from flightWindAt; visual only',
        transparency: 'depth test on, depth write off, sparse ordinary alpha; no per-particle sorting',
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; scene.remove(group); trailGeometry.dispose(); fragmentGeometry.dispose(); trailMaterial.dispose(); fragmentMaterial.dispose();
    },
  };
}
