import * as THREE from 'three';
import type { Flower, Species } from './types';
import { surfaceHeight } from './wind';
import { createSeededRandom } from './utils/random';
import type { LeafShelter } from './shelters';

/** Presentation-only water, driven by the caller's rain amount and clock.
 * Petal triangles own the support frame; camera LOD never owns wetness.
 * This is an authored wet appearance, not a liquid-mass/deposition simulation.
 */
const MAX_FLOWERS = 16;
const MAX_BEADS = 28;
const MAX_LEAVES = 6, LEAF_BEADS = 36;
const CAPACITY = MAX_FLOWERS * MAX_BEADS + MAX_LEAVES * LEAF_BEADS;
const NEAR = 7;
const FAR = 10.5;
const SPECIES: Species[] = ['daisy', 'poppy', 'cornflower'];

interface PetalTriangle {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  area: number;
}
interface PetalChart { triangles: PetalTriangle[]; candidates: PetalTriangle[]; cumulative: number[]; area: number; }
interface BeadAnchor {
  local: THREE.Vector3;
  normal: THREE.Vector3;
  rotation: THREE.Quaternion;
  size: number;
  stretch: number;
  across: number;
  threshold: number;
  supportError: number;
}

function petalChart(geometry: THREE.BufferGeometry): PetalChart {
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), index = geometry.getIndex();
  const triangles: PetalTriangle[] = [], candidates: PetalTriangle[] = [], cumulative: number[] = [];
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let area = 0;
  for (let i = 0, count = index?.count ?? position.count; i < count; i += 3) {
    const aId = index?.getX(i) ?? i, bId = index?.getX(i + 1) ?? i + 1, cId = index?.getX(i + 2) ?? i + 2;
    // The authored head marks its petal charts with nonnegative longitudinal
    // UVs; capsules, nectar wells and anther supports carry v=-1.
    if (!uv || uv.getY(aId) < 0 || uv.getY(bId) < 0 || uv.getY(cId) < 0) continue;
    const a = new THREE.Vector3().fromBufferAttribute(position, aId), b = new THREE.Vector3().fromBufferAttribute(position, bId), c = new THREE.Vector3().fromBufferAttribute(position, cId);
    ab.subVectors(b, a); ac.subVectors(c, a);
    const normal = new THREE.Vector3().crossVectors(ab, ac), triangleArea = normal.length() * .5;
    if (triangleArea < 1e-8) continue;
    normal.normalize(); if (normal.y < 0) normal.negate();
    if (normal.y < .25) continue;
    const triangle = { a, b, c, normal, minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x), minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z), area: triangleArea };
    triangles.push(triangle);
    const radial = Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3);
    if (radial > .36 && radial < .83 && normal.y > .6) {
      candidates.push(triangle); area += triangleArea; cumulative.push(area);
    }
  }
  return { triangles, candidates, cumulative, area };
}

/** Highest supported petal at XZ, in the flower mesh's unscaled local frame.
 * Sampling actual triangles catches gaps and the cornflower's raised florets.
 */
function projectToPetal(chart: PetalChart, x: number, z: number, out: THREE.Vector3, normal: THREE.Vector3): boolean {
  let highest = -Infinity;
  for (const triangle of chart.triangles) {
    if (x < triangle.minX - 1e-7 || x > triangle.maxX + 1e-7 || z < triangle.minZ - 1e-7 || z > triangle.maxZ + 1e-7) continue;
    const { a, b, c } = triangle;
    const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(denominator) < 1e-10) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
    const w = 1 - u - v;
    if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
    const y = a.y * u + b.y * v + c.y * w;
    if (y > highest) { highest = y; out.set(x, y, z); normal.copy(triangle.normal); }
  }
  return Number.isFinite(highest);
}

function makeAnchors(flower: Flower, chart: PetalChart): BeadAnchor[] {
  const random = createSeededRandom(0xbee5a11 + flower.id * 3271 + SPECIES.indexOf(flower.species) * 7121);
  const anchors: BeadAnchor[] = [], count = flower.species === 'poppy' ? 28 : 24;
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), tangent = new THREE.Vector3(), bitangent = new THREE.Vector3();
  const footprint = new THREE.Vector3(), supported = new THREE.Vector3(), supportNormal = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (let attempt = 0; attempt < 1800 && anchors.length < count && chart.area > 0; attempt++) {
    const area = random() * chart.area;
    let index = 0; while (index < chart.cumulative.length - 1 && chart.cumulative[index] < area) index++;
    const triangle = chart.candidates[index];
    let u = random(), v = random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    // Bias away from the edge of each support triangle, without ring patterns.
    u = u * .78 + .22 / 3; v = v * .78 + .22 / 3;
    point.copy(triangle.a).multiplyScalar(u).addScaledVector(triangle.b, v).addScaledVector(triangle.c, 1 - u - v);
    if (!projectToPetal(chart, point.x, point.z, point, normal) || normal.y < .6) continue;
    const coarse = surfaceHeight(flower.species, point.x, point.z, 1);
    if (Math.abs(point.y - coarse) > .32) continue;
    const size = flower.species === 'poppy' ? .025 + random() * .024 : flower.species === 'cornflower' ? .010 + random() * .011 : .016 + random() * .021;
    const stretch = flower.species === 'cornflower' ? 1.48 : flower.species === 'daisy' ? 1.12 : 1;
    const across = flower.species === 'cornflower' ? .72 : .94;
    let overlap = false;
    for (const other of anchors) if (point.distanceToSquared(other.local) < Math.pow((size + other.size) * 1.15, 2)) { overlap = true; break; }
    if (overlap) continue;
    tangent.set(point.x, 0, point.z).normalize();
    tangent.addScaledVector(normal, -tangent.dot(normal)).normalize();
    bitangent.crossVectors(tangent, normal).normalize();
    basis.makeBasis(tangent, normal, bitangent);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(basis);
    let error = 0, valid = true;
    // Eight contact samples reject bead footprints that hang into petal gaps.
    for (let edge = 0; edge < 8; edge++) {
      const angle = edge / 8 * Math.PI * 2;
      footprint.copy(point).addScaledVector(tangent, Math.cos(angle) * size * stretch).addScaledVector(bitangent, Math.sin(angle) * size * across);
      if (!projectToPetal(chart, footprint.x, footprint.z, supported, supportNormal)) { valid = false; break; }
      const difference = Math.abs(supported.y - footprint.y);
      error = Math.max(error, difference);
      if (difference > .016) { valid = false; break; }
    }
    if (!valid) continue;
    anchors.push({ local: point.clone(), normal: normal.clone(), rotation, size, stretch, across, threshold: random() * .64, supportError: error });
  }
  // Early rain reveals a few real drops per flower, then fills in their neighbours.
  anchors.sort((a, b) => a.threshold - b.threshold);
  if (anchors.length > 0) anchors[0].threshold = 0;
  if (anchors.length > 1) anchors[1].threshold = .025;
  return anchors;
}

function alphaMaterial(material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial, water: boolean) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float waterOpacity; varying float vWaterOpacity;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterOpacity=waterOpacity;');
    shader.fragmentShader = 'varying float vWaterOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vWaterOpacity;');
    if (water) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float wetFacing = clamp(dot(normal, normalize(vViewPosition)), 0., 1.);
      float wetRim = pow(1.-wetFacing, 2.2);
      diffuseColor.a *= .30 + .70*wetRim;
      diffuseColor.rgb *= .72 + .30*wetFacing;
    `);
  };
  material.customProgramCacheKey = () => `flower-water-v1-${water ? 'body' : 'highlight'}`;
}

function makeLeafAnchors(leaf: LeafShelter, chart: PetalChart): BeadAnchor[] {
  const random = createSeededRandom(0x1eafda7 + leaf.id * 3271);
  const anchors: BeadAnchor[] = [];
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), footprint = new THREE.Vector3();
  const supported = new THREE.Vector3(), supportNormal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let attempt = 0; attempt < 700 && anchors.length < LEAF_BEADS; attempt++) {
    // Stay inside the broad blade, sampling the actual top triangles/veins.
    const angle = random() * Math.PI * 2, radial = Math.sqrt(random()) * 1.43;
    if (!projectToPetal(chart, Math.cos(angle) * radial, Math.sin(angle) * radial, point, normal) || normal.y < .7) continue;
    const size = .035 + random() * .045, stretch = .9 + random() * .35;
    if (anchors.some(other => point.distanceToSquared(other.local) < Math.pow((size + other.size) * 1.3, 2))) continue;
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, normal);
    let error = 0;
    for (let edge = 0; edge < 8; edge++) {
      const a = edge / 8 * Math.PI * 2;
      footprint.set(Math.cos(a) * size * stretch, 0, Math.sin(a) * size).applyQuaternion(rotation).add(point);
      if (!projectToPetal(chart, footprint.x, footprint.z, supported, supportNormal)) { error = Infinity; break; }
      error = Math.max(error, Math.abs(supported.y - footprint.y));
    }
    if (error > .012) continue;
    anchors.push({ local: point.clone(), normal: normal.clone(), rotation, size, stretch, across: 1, threshold: random() * .64, supportError: error });
  }
  anchors.sort((a, b) => a.threshold - b.threshold);
  if (anchors.length) anchors[0].threshold = 0;
  return anchors;
}

export function createFlowerRain(scene: THREE.Scene, flowers: readonly Flower[], leaves: readonly LeafShelter[], leafSurface: THREE.BufferGeometry) {
  const chartCache = new Map<THREE.BufferGeometry, PetalChart>();
  const anchors = flowers.map(flower => {
    const mesh = flower.group.children[0] as THREE.Mesh;
    let chart = chartCache.get(mesh.geometry);
    if (!chart) { chart = petalChart(mesh.geometry); chartCache.set(mesh.geometry, chart); }
    return makeAnchors(flower, chart);
  });
  const anchorCount = anchors.reduce((sum, list) => sum + list.length, 0);
  const leafChart = petalChart(leafSurface);
  const leafAnchors = leaves.map(leaf => makeLeafAnchors(leaf, leafChart));
  // Only the small accepted anchors survive construction; triangle samplers
  // are temporary and must not retain a second copy of the meadow meshes.
  chartCache.clear();
  const group = new THREE.Group(); group.name = 'rain beads on petals and shelter leaves'; scene.add(group);
  const bodyGeometry = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  bodyGeometry.scale(1, .70, 1);
  const highlightGeometry = new THREE.SphereGeometry(1, 8, 4);
  highlightGeometry.scale(.17, .045, .10).translate(-.30, .65, -.21);
  const opacity = new Float32Array(CAPACITY);
  const bodyOpacity = new THREE.InstancedBufferAttribute(opacity, 1).setUsage(THREE.DynamicDrawUsage);
  const highlightOpacity = new THREE.InstancedBufferAttribute(opacity, 1).setUsage(THREE.DynamicDrawUsage);
  bodyGeometry.setAttribute('waterOpacity', bodyOpacity); highlightGeometry.setAttribute('waterOpacity', highlightOpacity);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#9ebec5', roughness: .14, metalness: 0, clearcoat: .85, clearcoatRoughness: .09,
    transparent: true, opacity: .74, depthWrite: false, depthTest: true, ior: 1.333,
  });
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: '#f5fff1', transparent: true, opacity: .80, depthWrite: false, depthTest: true });
  alphaMaterial(bodyMaterial, true); alphaMaterial(highlightMaterial, false);
  const beads = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, CAPACITY);
  const highlights = new THREE.InstancedMesh(highlightGeometry, highlightMaterial, CAPACITY);
  beads.name = 'rounded water caps'; highlights.name = 'small reflected sky glints';
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage); highlights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beads.count = 0; highlights.count = 0; group.visible = false;
  // One bounded page whose compacted instances are all near the camera.
  beads.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FAR + 2);
  highlights.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FAR + 2);
  group.add(beads, highlights);
  const nearIds = new Int16Array(MAX_FLOWERS), nearDistances = new Float64Array(MAX_FLOWERS);
  const nearLeaves = new Int16Array(MAX_LEAVES), leafDistances = new Float64Array(MAX_LEAVES);
  const leafSampleLocal = new THREE.Vector3(), leafSampleWorld = new THREE.Vector3();
  let sampleLeaf = -1, leafCount = 0, activeLeaves = 0;
  const sampleFlowers = new Int16Array(3), sampleBeads = new Int16Array(3), sampleLocal = new Float64Array(9), sampleWorld = new Float64Array(9);
  const speciesCounts = new Uint16Array(3);
  sampleFlowers.fill(-1); sampleBeads.fill(-1);
  const world = new THREE.Vector3(), normal = new THREE.Vector3(), local = new THREE.Vector3(), scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  const perBeadTriangles = (bodyGeometry.index!.count + highlightGeometry.index!.count) / 3;
  let wetness = 0, lastTime = 0, initialized = false, disposed = false, resetCount = 0;
  let count = 0, activeFlowers = 0, currentRain = 0, reduced = false, latestEnabled = false;
  function hide() {
    group.visible = false; beads.count = 0; highlights.count = 0; count = 0; activeFlowers = 0;
    speciesCounts.fill(0); sampleFlowers.fill(-1); sampleBeads.fill(-1);
    leafCount = 0; activeLeaves = 0; sampleLeaf = -1;
  }
  return {
    update(time: number, cameraPosition: THREE.Vector3, rain: number, reducedMotion: boolean, enabled: boolean) {
      if (disposed) return;
      currentRain = THREE.MathUtils.clamp(Number.isFinite(rain) ? rain : 0, 0, 1); reduced = reducedMotion;
      if (!enabled) {
        if (latestEnabled || initialized || wetness > 0) resetCount++;
        wetness = 0; initialized = false; latestEnabled = false; lastTime = time; hide(); return;
      }
      latestEnabled = true;
      if (!initialized || time < lastTime) {
        if (initialized) resetCount++;
        wetness = currentRain * .18; initialized = true; lastTime = time;
      }
      const dt = Math.max(0, time - lastTime); lastTime = time;
      // The first small beads are an immediate rain response. Only elapsed time
      // grows/clears the retained appearance, including in reduced-motion mode.
      wetness = Math.max(wetness, currentRain * .18);
      const rate = currentRain > wetness ? .85 : .22;
      wetness += (currentRain - wetness) * (1 - Math.exp(-rate * dt));
      if (wetness < .001 && currentRain === 0) wetness = 0;
      if (wetness === 0 || cameraPosition.y > 14) { hide(); return; }
      let selected = 0;
      for (let i = 0; i < flowers.length; i++) {
        const flower = flowers[i], distance = flower.center.distanceToSquared(cameraPosition);
        if (!flower.group.visible || distance >= FAR * FAR || anchors[i].length === 0) continue;
        let slot = Math.min(selected, MAX_FLOWERS - 1);
        if (selected === MAX_FLOWERS && distance >= nearDistances[slot]) continue;
        while (slot > 0 && nearDistances[slot - 1] > distance) {
          if (slot < MAX_FLOWERS) { nearIds[slot] = nearIds[slot - 1]; nearDistances[slot] = nearDistances[slot - 1]; }
          slot--;
        }
        nearIds[slot] = i; nearDistances[slot] = distance; selected = Math.min(MAX_FLOWERS, selected + 1);
      }
      count = 0; activeFlowers = 0; speciesCounts.fill(0); sampleFlowers.fill(-1); sampleBeads.fill(-1);
      for (let near = 0; near < selected; near++) {
        const id = nearIds[near], flower = flowers[id], species = SPECIES.indexOf(flower.species);
        const distanceFade = 1 - THREE.MathUtils.smoothstep(Math.sqrt(nearDistances[near]), NEAR, FAR);
        let flowerCount = 0;
        for (let j = 0; j < anchors[id].length; j++) {
          const anchor = anchors[id][j];
          const growth = THREE.MathUtils.smoothstep(wetness, anchor.threshold, anchor.threshold + .23);
          if (growth < .035 || distanceFade < .02) continue;
          normal.copy(anchor.normal).applyQuaternion(flower.rotation);
          if (normal.y < .35) continue;
          local.copy(anchor.local).multiplyScalar(flower.radius).addScaledVector(anchor.normal, .0008);
          world.copy(local).applyQuaternion(flower.rotation).add(flower.center);
          rotation.copy(flower.rotation).multiply(anchor.rotation);
          const size = anchor.size * flower.radius * (.35 + .65 * Math.sqrt(growth));
          scale.set(size * anchor.stretch, size, size * anchor.across);
          matrix.compose(world, rotation, scale); beads.setMatrixAt(count, matrix); highlights.setMatrixAt(count, matrix);
          opacity[count] = distanceFade * growth;
          if (sampleFlowers[species] < 0) {
            sampleFlowers[species] = id; sampleBeads[species] = j;
            local.toArray(sampleLocal, species * 3); world.toArray(sampleWorld, species * 3);
          }
          count++; flowerCount++; speciesCounts[species]++;
        }
        if (flowerCount > 0) activeFlowers++;
      }
      let selectedLeaves = 0;
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i], distance = leaf.center.distanceToSquared(cameraPosition);
        // Tops are opaque: skip beads when the entire leaf is above the viewer.
        normal.copy(cameraPosition).sub(leaf.center).applyQuaternion(rotation.copy(leaf.rotation).invert());
        if (normal.y < -.2 || distance >= FAR * FAR) continue;
        let slot = Math.min(selectedLeaves, MAX_LEAVES - 1);
        if (selectedLeaves === MAX_LEAVES && distance >= leafDistances[slot]) continue;
        while (slot > 0 && leafDistances[slot - 1] > distance) {
          if (slot < MAX_LEAVES) { nearLeaves[slot] = nearLeaves[slot - 1]; leafDistances[slot] = leafDistances[slot - 1]; }
          slot--;
        }
        nearLeaves[slot] = i; leafDistances[slot] = distance; selectedLeaves = Math.min(MAX_LEAVES, selectedLeaves + 1);
      }
      leafCount = 0; activeLeaves = 0; sampleLeaf = -1;
      for (let near = 0; near < selectedLeaves; near++) {
        const id = nearLeaves[near], leaf = leaves[id];
        const distanceFade = 1 - THREE.MathUtils.smoothstep(Math.sqrt(leafDistances[near]), NEAR, FAR);
        let onLeaf = 0;
        for (const anchor of leafAnchors[id]) {
          const growth = THREE.MathUtils.smoothstep(wetness, anchor.threshold, anchor.threshold + .23);
          if (growth < .035 || distanceFade < .02) continue;
          local.copy(anchor.local).addScaledVector(anchor.normal, .001);
          world.copy(local).applyQuaternion(leaf.rotation).add(leaf.center);
          rotation.copy(leaf.rotation).multiply(anchor.rotation);
          const size = anchor.size * (.35 + .65 * Math.sqrt(growth));
          scale.set(size * anchor.stretch, size, size);
          matrix.compose(world, rotation, scale); beads.setMatrixAt(count, matrix); highlights.setMatrixAt(count, matrix);
          opacity[count] = distanceFade * growth;
          if (sampleLeaf < 0) { sampleLeaf = id; leafSampleLocal.copy(local); leafSampleWorld.copy(world); }
          count++; leafCount++; onLeaf++;
        }
        if (onLeaf) activeLeaves++;
      }
      beads.count = count; highlights.count = count; group.visible = count > 0;
      beads.instanceMatrix.needsUpdate = true; highlights.instanceMatrix.needsUpdate = true;
      bodyOpacity.needsUpdate = true; highlightOpacity.needsUpdate = true;
      beads.boundingSphere!.center.copy(cameraPosition); highlights.boundingSphere!.center.copy(cameraPosition);
    },
    diagnostics(): Record<string, unknown> {
      const samples: Record<string, unknown>[] = [];
      for (let species = 0; species < 3; species++) {
        const flowerIndex = sampleFlowers[species]; if (flowerIndex < 0) continue;
        const flower = flowers[flowerIndex], anchor = anchors[flowerIndex][sampleBeads[species]], offset = species * 3;
        samples.push({
          species: flower.species, flowerId: flower.id,
          local: [sampleLocal[offset], sampleLocal[offset + 1], sampleLocal[offset + 2]],
          world: [sampleWorld[offset], sampleWorld[offset + 1], sampleWorld[offset + 2]],
          radius: anchor.size * flower.radius, supportError: anchor.supportError * flower.radius,
          coarseSurfaceHeight: surfaceHeight(flower.species, anchor.local.x, anchor.local.z, 1) * flower.radius,
        });
      }
      return {
        visible: group.visible, wetness, rain: currentRain, beads: count, count, activeFlowers,
        leafBeads: leafCount, activeLeaves,
        leafSample: sampleLeaf < 0 ? null : { leafId: leaves[sampleLeaf].id, local: leafSampleLocal.toArray(), world: leafSampleWorld.toArray() },
        speciesCounts: { daisy: speciesCounts[0], poppy: speciesCounts[1], cornflower: speciesCounts[2] },
        draws: group.visible ? 2 : 0, triangles: count * perBeadTriangles, maxTriangles: CAPACITY * perBeadTriangles,
        capacity: CAPACITY, anchorCount,
        simulationTime: lastTime, reducedMotion: reduced, resetCount, samples,
      };
    },
    dispose() {
      if (disposed) return; disposed = true; wetness = 0; initialized = false; latestEnabled = false; hide();
      scene.remove(group); beads.dispose(); highlights.dispose();
      bodyGeometry.dispose(); highlightGeometry.dispose(); bodyMaterial.dispose(); highlightMaterial.dispose();
      chartCache.clear();
    },
  };
}
