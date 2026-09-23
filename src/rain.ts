import * as THREE from 'three';
import { LEAF_WIDTH_RATIO, type LeafShelter } from './shelters';
import { createSeededRandom } from './utils/random';

/** A small presentation pool, in world art units / seconds. The caller owns
 * time, rain intensity, and wind. It does not model water flux or wetness.
 * Existing drops retain world positions during ordinary camera travel; only
 * particles leaving the streamed volume respawn, with a short birth fade.
 */
const CAPACITY = 320;
const REDUCED_COUNT = 38;
const RADIUS = 11;
const SEED = 0x5eed7a1;

export function createRain(scene: THREE.Scene) {
  const position = new Float64Array(CAPACITY * 3), age = new Float64Array(CAPACITY);
  const widths = new Float32Array(CAPACITY), lengths = new Float32Array(CAPACITY), speeds = new Float32Array(CAPACITY);
  const vertices = new Float32Array(CAPACITY * 12), alphas = new Float32Array(CAPACITY * 4), uvs = new Float32Array(CAPACITY * 8);
  const indices = new Uint16Array(CAPACITY * 6);
  for (let i = 0; i < CAPACITY; i++) {
    uvs.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8);
    const vertex = i * 4; indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('rainAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1)); geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    color: '#8099a4', transparent: true, opacity: 1,
    depthTest: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  material.forceSinglePass = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float rainAlpha; varying float vRainAlpha; varying vec2 vRainUv;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRainAlpha = rainAlpha; vRainUv = uv;');
    shader.fragmentShader = 'varying float vRainAlpha; varying vec2 vRainUv;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float sides = 1.-pow(abs(vRainUv.x*2.-1.),1.4);
      float ends = smoothstep(0.,.18,vRainUv.y)*(1.-smoothstep(.74,1.,vRainUv.y));
      diffuseColor.a *= vRainAlpha*sides*ends;
      `);
  };
  material.customProgramCacheKey = () => 'bee-soft-world-rain-v1';
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'bounded meadow rain'; mesh.visible = false;
  // Vertices are already world-space. Recompute only this conservative bound,
  // never an expensive per-frame geometry bound or camera-relative transform.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 16);
  scene.add(mesh);

  const cameraPosition = new THREE.Vector3(), lastCameraPosition = new THREE.Vector3();
  const point = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3();
  const side = new THREE.Vector3(), view = new THREE.Vector3(), localPoint = new THREE.Vector3(), localEnd = new THREE.Vector3();
  const inverseShelter = new THREE.Quaternion(), suppliedWind = new THREE.Vector3();
  let random = createSeededRandom(SEED), initialized = false, disposed = false;
  let lastTime = 0, resetCount = 0, respawns = 0, simulationSteps = 0;
  let activeDrops = 0, shelteredDrops = 0, requestedDrops = 0, currentIntensity = 0;
  let reduced = false, currentShelter: number | null = null;

  function spawn(i: number, initial: boolean) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * RADIUS;
    const p = i * 3, lower = Math.max(.10, cameraPosition.y - 4.8), upper = cameraPosition.y + 8;
    position[p] = cameraPosition.x + Math.cos(angle) * radius;
    position[p + 2] = cameraPosition.z + Math.sin(angle) * radius;
    position[p + 1] = initial ? lower + random() * (upper - lower) : upper - random() * 1.1;
    age[i] = initial ? .25 + random() : 0;
    if (!initial) respawns++;
  }
  function reset(time: number) {
    random = createSeededRandom(SEED);
    for (let i = 0; i < CAPACITY; i++) {
      widths[i] = .0105 + random() * .0105;
      lengths[i] = .38 + random() * .38;
      speeds[i] = 9.5 + random() * 3.5;
      spawn(i, true);
    }
    initialized = true; lastTime = time; lastCameraPosition.copy(cameraPosition); resetCount++;
  }

  // Remove an entire streak if any of its segment crosses the covered cylinder.
  // This leaves the surrounding shower visible, including beyond the roof rim.
  function crossesRoof(shelter: LeafShelter): boolean {
    localPoint.copy(point).sub(shelter.center).applyQuaternion(inverseShelter);
    localEnd.copy(end).sub(shelter.center).applyQuaternion(inverseShelter);
    if (Math.min(localPoint.y, localEnd.y) > -.13) return false;
    localPoint.x /= LEAF_WIDTH_RATIO; localEnd.x /= LEAF_WIDTH_RATIO;
    const dx = localEnd.x - localPoint.x, dz = localEnd.z - localPoint.z;
    const length2 = dx * dx + dz * dz;
    const t = length2 > 1e-8 ? THREE.MathUtils.clamp(-(localPoint.x * dx + localPoint.z * dz) / length2, 0, 1) : 0;
    const x = localPoint.x + dx * t, z = localPoint.z + dz * t;
    return x * x + z * z < Math.pow(shelter.radius * .86, 2);
  }

  return {
    update(time: number, camera: THREE.Camera, intensity: number, wind: THREE.Vector3, shelter: LeafShelter | null, reducedMotion: boolean, enabled: boolean, grassCover = 0) {
      if (disposed) return;
      camera.getWorldPosition(cameraPosition);
      currentIntensity = THREE.MathUtils.clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
      currentShelter = shelter?.id ?? null;
      if (!enabled || currentIntensity <= .001) {
        mesh.visible = false; activeDrops = 0; requestedDrops = 0; shelteredDrops = 0;
        // Disabled weather owns no simulation debt. Re-enter with a fresh volume.
        initialized = false; lastTime = time; reduced = reducedMotion; geometry.setDrawRange(0, 0);
        return;
      }
      const delta = time - lastTime;
      const discontinuity = initialized && (delta < 0 || delta > .5 || cameraPosition.distanceToSquared(lastCameraPosition) > 64);
      const resetThisFrame = !initialized || discontinuity || reducedMotion !== reduced;
      if (resetThisFrame) reset(time);
      suppliedWind.set(Number.isFinite(wind.x) ? wind.x : 0, Number.isFinite(wind.y) ? wind.y : 0, Number.isFinite(wind.z) ? wind.z : 0);
      const dt = resetThisFrame ? 0 : Math.max(0, delta);
      reduced = reducedMotion;
      if (dt > 0) {
        for (let i = 0; i < CAPACITY; i++) {
          const p = i * 3;
          if (!reducedMotion) {
            position[p] += suppliedWind.x * dt;
            position[p + 1] += (suppliedWind.y - speeds[i]) * dt;
            position[p + 2] += suppliedWind.z * dt;
            age[i] += dt;
          }
          const x = position[p] - cameraPosition.x, z = position[p + 2] - cameraPosition.z;
          if (position[p + 1] < Math.max(.08, cameraPosition.y - 4.8) || position[p + 1] > cameraPosition.y + 8.6 || x * x + z * z > RADIUS * RADIUS) spawn(i, reducedMotion);
        }
        if (!reducedMotion) simulationSteps++;
      }
      lastTime = time; lastCameraPosition.copy(cameraPosition);
      if (shelter) inverseShelter.copy(shelter.rotation).invert();
      requestedDrops = Math.ceil((reducedMotion ? REDUCED_COUNT : CAPACITY) * currentIntensity);
      activeDrops = 0; shelteredDrops = 0;
      for (let i = 0; i < requestedDrops; i++) {
        const p = i * 3; point.fromArray(position, p);
        direction.set(reducedMotion ? 0 : suppliedWind.x, reducedMotion ? -1 : suppliedWind.y - speeds[i], reducedMotion ? 0 : suppliedWind.z).normalize();
        const length = reducedMotion ? .028 : lengths[i];
        end.copy(point).addScaledVector(direction, -length);
        if (shelter && crossesRoof(shelter)) { shelteredDrops++; continue; }
        if (grassCover > .99 && Math.hypot(point.x - cameraPosition.x, point.z - cameraPosition.z) < 2.5 && Math.min(point.y, end.y) < cameraPosition.y + .85) { shelteredDrops++; continue; }
        const distance = point.distanceTo(cameraPosition);
        const edge = 1 - THREE.MathUtils.smoothstep(Math.hypot(point.x - cameraPosition.x, point.z - cameraPosition.z), RADIUS - 2, RADIUS);
        const near = THREE.MathUtils.smoothstep(distance, .65, 1.7);
        const birth = THREE.MathUtils.smoothstep(age[i], 0, .18);
        const alpha = edge * near * birth * (reducedMotion ? .32 : .54) * Math.sqrt(currentIntensity);
        if (alpha <= .003) continue;
        view.copy(cameraPosition).sub(point).normalize(); side.crossVectors(direction, view);
        if (side.lengthSq() < .0001) side.setFromMatrixColumn(camera.matrixWorld, 0);
        side.normalize().multiplyScalar(widths[i] * (reducedMotion ? 1.4 : 1));
        const v = activeDrops * 12, a = activeDrops * 4;
        vertices[v] = point.x - side.x; vertices[v + 1] = point.y - side.y; vertices[v + 2] = point.z - side.z;
        vertices[v + 3] = point.x + side.x; vertices[v + 4] = point.y + side.y; vertices[v + 5] = point.z + side.z;
        vertices[v + 6] = end.x - side.x; vertices[v + 7] = end.y - side.y; vertices[v + 8] = end.z - side.z;
        vertices[v + 9] = end.x + side.x; vertices[v + 10] = end.y + side.y; vertices[v + 11] = end.z + side.z;
        alphas[a] = alpha; alphas[a + 1] = alpha; alphas[a + 2] = alpha; alphas[a + 3] = alpha;
        activeDrops++;
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.rainAlpha.needsUpdate = true;
      geometry.setDrawRange(0, activeDrops * 6); geometry.boundingSphere!.center.copy(cameraPosition);
      mesh.visible = activeDrops > 0;
    },
    diagnostics(): Record<string, unknown> {
      return {
        capacity: CAPACITY, requestedDrops, activeDrops, shelteredDrops,
        shelterId: currentShelter, intensity: currentIntensity, reducedMotion: reduced,
        visible: mesh.visible, draws: mesh.visible ? 1 : 0, triangles: activeDrops * 2,
        maxTriangles: CAPACITY * 2, simulationTime: lastTime, simulationSteps, resetCount, respawns,
        // This world-space tracer does not change on a repeated time stamp.
        tracer: initialized ? [position[0], position[1], position[2]] : null,
      };
    },
    dispose() {
      if (disposed) return; disposed = true;
      scene.remove(mesh); geometry.dispose(); material.dispose();
      mesh.visible = false; activeDrops = 0; requestedDrops = 0; shelteredDrops = 0;
    },
  };
}
