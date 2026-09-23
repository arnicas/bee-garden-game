import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Flower } from './types';
import { flowerSwayAt } from './wind';
import { createSeededRandom } from './utils/random';

/** A broad leaf's centre and safe underside perch, in world art units.
 * radius*.8 is wholly inside the leaf; radius+.7 clears even its pointed tip.
 * Rotation maps the leaf's XZ surface to world space, with its tip along -Z.
 */
export interface LeafShelter {
  id: number;
  center: THREE.Vector3;
  perch: THREE.Vector3;
  topPerch: THREE.Vector3;
  rotation: THREE.Quaternion;
  velocity: THREE.Vector3;
  topVelocity: THREE.Vector3;
  /** Fixed ground attachment; the shelter module never mutates this position. */
  readonly root: THREE.Vector3;
  radius: number;
}

const COUNT = 16;
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const PERCH = new THREE.Vector3(0, -.62, -.12);
const TOP_PERCH = new THREE.Vector3(0, leafSurfaceHeight(0, -.12) + .29, -.12);

function groundHeight(x: number, z: number): number {
  // The meadow's authored terrain, including the very low outer rise.
  const distance = Math.hypot(x, z);
  return -.12 + Math.sin(x * .17) * Math.cos(z * .13) * .16
    + Math.max(0, distance - 25) * .026
    + Math.max(0, distance - 39) * (.09 + .035 * Math.sin(Math.atan2(z, x) * 5));
}

function leafRadius(angle: number): number {
  // A short pointed blade, unequal shoulders and a shallow basal cleft. The
  // central 1.52-unit disk stays covered even at the narrowest edge scallop.
  const signed = Math.atan2(Math.sin(angle), Math.cos(angle));
  const rightShoulder = .43 * Math.exp(-Math.pow((signed - 1.1) / .65, 2));
  const leftShoulder = .34 * Math.exp(-Math.pow((signed + 1.25) / .6, 2));
  const tip = .59 * Math.exp(-Math.abs(signed) / .17);
  const basalLobes = .10 * Math.exp(-Math.pow((Math.abs(signed) - 2.55) / .35, 2));
  const scallop = .026 * Math.sin(angle * 11 + .7) * (.35 + .65 * Math.pow(Math.sin(angle), 2));
  return Math.min(2.175, 1.585 + rightShoulder + leftShoulder + tip + basalLobes + scallop);
}

export function leafSurfaceHeight(x: number, z: number): number {
  const angle = Math.atan2(x, -z), rho = Math.min(1, Math.hypot(x, z) / leafRadius(angle));
  const ridgeX = .06 * Math.sin(z * 1.5);
  const bow = .12 * (1 - Math.pow((z + .2) / 2.6, 2));
  const midrib = .065 * Math.exp(-8 * Math.pow(x - ridgeX, 2)) * (1 - rho * .35);
  const foldedShoulders = -.125 * Math.pow(Math.abs(x) / 2.15, 1.3);
  const curledEdge = Math.pow(rho, 5) * (.085 * Math.sin(angle * 3 + .8) + .04 * Math.sin(angle * 7 + rho * 3));
  const bowedTip = -.30 * Math.pow(rho, 3) * Math.pow(Math.max(0, Math.cos(angle)), 12);
  return bow + midrib + foldedShoulders + curledEdge + bowedTip;
}

function paintedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radius: number, color: THREE.Color, closed = false): THREE.BufferGeometry {
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 3, closed);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function canopyGeometry(): THREE.BufferGeometry {
  const sectors = 48, rings = 10, count = 1 + sectors * rings;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices: number[] = [];
  const dark = new THREE.Color('#628443'), light = new THREE.Color('#9ab263'), edge = new THREE.Color('#647e3e');
  const color = new THREE.Color();
  positions[1] = leafSurfaceHeight(0, 0); light.toArray(colors, 0); uvs.set([.5, .5]);
  for (let ring = 1; ring <= rings; ring++) for (let sector = 0; sector < sectors; sector++) {
    const angle = sector / sectors * TAU, rho = ring / rings, radius = leafRadius(angle) * rho;
    const x = Math.sin(angle) * radius, z = -Math.cos(angle) * radius;
    const i = 1 + (ring - 1) * sectors + sector;
    positions.set([x, leafSurfaceHeight(x, z), z], i * 3); uvs.set([x / 4.4 + .5, z / 4.4 + .5], i * 2);
    const pigment = .54 + .10 * Math.sin(x * 1.4 + z * .55) + .06 * Math.cos(z * 1.3 - x * .4);
    color.copy(dark).lerp(light, pigment).lerp(edge, Math.pow(rho, 8) * .38).toArray(colors, i * 3);
    const next = 1 + (ring - 1) * sectors + (sector + 1) % sectors;
    if (ring === 1) indices.push(0, next, i);
    else {
      const inner = i - sectors, innerNext = next - sectors;
      indices.push(inner, next, i, inner, innerNext, next);
    }
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sheet.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sheet.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  sheet.setIndex(indices); sheet.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [sheet];
  const vein = new THREE.Color('#526c38'), fineVein = new THREE.Color('#607c40');
  const topVein = new THREE.Color('#526e37');
  const point = (x: number, z: number, inset = .025) => new THREE.Vector3(x, leafSurfaceHeight(x, z) - inset, z);
  parts.push(paintedTube(new THREE.CatmullRomCurve3([
    point(.035, 1.57), point(.07, .85), point(.003, .05), point(-.058, -.9), point(0, -2.15),
  ]), 28, .029, vein));
  parts.push(paintedTube(new THREE.CatmullRomCurve3([
    point(.035, 1.57, -.008), point(.07, .85, -.008), point(.003, .05, -.008), point(-.058, -.9, -.008), point(0, -2.15, -.006),
  ]), 24, .013, topVein));
  // Raised underside veins remain legible overhead without a normal-map texture.
  for (let pair = 0; pair < 7; pair++) for (const sign of [-1, 1]) {
    const z = 1.13 - pair * .43 + sign * .05 * Math.sin(pair * 2.3), theta = (2.05 - pair * .25 + sign * .037) * sign;
    const boundary = leafRadius(theta) * .93;
    const tipX = Math.sin(theta) * boundary, tipZ = -Math.cos(theta) * boundary;
    const midX = tipX * .51, midZ = z + (tipZ - z) * .38 - .065;
    parts.push(paintedTube(new THREE.CatmullRomCurve3([
      point(0, z, .031), point(midX, midZ), point(tipX, tipZ, .020),
    ]), 7, .011 + (6 - pair) * .0007, fineVein));
    parts.push(paintedTube(new THREE.CatmullRomCurve3([
      point(0, z, -.007), point(midX, midZ, -.006), point(tipX, tipZ, -.004),
    ]), 6, .006, topVein));
  }
  const rim: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const angle = i / 96 * TAU, radius = leafRadius(angle);
    rim.push(point(Math.sin(angle) * radius, -Math.cos(angle) * radius, .002));
  }
  parts.push(paintedTube(new THREE.CatmullRomCurve3(rim, true), 96, .009, edge, true));
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

function leafMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .98, side: THREE.DoubleSide,
    emissive: '#6b8453', emissiveIntensity: .075,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vLeafPoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeafPoint = position;');
    shader.fragmentShader = `varying vec3 vLeafPoint;
      float leafHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float leafNoise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(leafHash(i),leafHash(i+vec2(1,0)),f.x),mix(leafHash(i+vec2(0,1)),leafHash(i+1.),f.x),f.y); }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // Low-frequency, lengthwise washes avoid isolated camouflage-like spots.
      vec2 paint = vLeafPoint.xz;
      float wash = leafNoise(paint * vec2(.85,.42) + vec2(2.7,5.1));
      float glaze = leafNoise(paint * vec2(1.6,.65) + vec2(7.3,1.8));
      float closeDetail = 1.-smoothstep(.045,.16,length(fwidth(paint)));
      vec3 green = diffuseColor.rgb;
      vec3 lightWash = mix(green, vec3(.53,.64,.26), .18);
      diffuseColor.rgb = mix(green * vec3(.88,.93,.85), lightWash, wash*.7 + glaze*.3);
      // Two long, feathered brush passes: open bands rather than closed spots.
      float sweep = paint.x + .24*sin(paint.y*1.15) + (wash-.5)*.28;
      float firstWash = smoothstep(-1.25,-.45,sweep) * (1.-smoothstep(.05,.85,sweep));
      float secondWash = smoothstep(.15,.70,sweep) * (1.-smoothstep(1.15,1.80,sweep));
      diffuseColor.rgb *= mix(vec3(1.),vec3(1.11,1.07,.98),firstWash);
      diffuseColor.rgb *= mix(vec3(1.),vec3(.87,.94,.91),secondWash);
      float tide = smoothstep(.08,.23,sweep) * (1.-smoothstep(.23,.46,sweep));
      diffuseColor.rgb *= 1.-tide*.045;
      float brush = leafNoise(paint * vec2(9.,1.1) + vec2(3.2,8.4));
      diffuseColor.rgb *= 1.0 + (brush-.5)*.055*closeDetail;
      // Thin leaves retain their painted green beneath the canopy.
      if (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.035,1.065,1.025);
      `);
  };
  material.customProgramCacheKey = () => 'bee-leaf-shelter-pigment-v4';
  return material;
}

export function createShelters(scene: THREE.Scene, flowers: readonly Flower[]) {
  const group = new THREE.Group(); group.name = '16 broad leaf shelters'; scene.add(group);
  const random = createSeededRandom(0x1eafbee);
  const shelters: LeafShelter[] = [];
  const bases: THREE.Vector3[] = [], roots: THREE.Vector3[] = [], restRotations: THREE.Quaternion[] = [];
  const canopy = canopyGeometry(), material = leafMaterial();
  const leaves = new THREE.InstancedMesh(canopy, material, COUNT);
  leaves.name = 'shelter leaves and underside veins'; leaves.castShadow = true; leaves.receiveShadow = true;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(leaves);
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(.19, .24, -.10),
    new THREE.Vector3(.52, .55, .10), new THREE.Vector3(.30, .81, .075), new THREE.Vector3(0, 1, 0),
  ]);
  const stemGeometry = paintedTube(stemCurve, 18, .041, new THREE.Color('#7d9550'));
  const stems = new THREE.InstancedMesh(stemGeometry, material, COUNT);
  stems.name = 'rooted shelter petioles'; stems.receiveShadow = true;
  stems.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(stems);

  const targets: Array<[number, number]> = [[4, 2]];
  for (const z of [-18, -6, 6, 18]) for (const x of [-18, -6, 6, 18]) {
    if (x === 6 && z === 6) continue;
    targets.push([x, z]);
  }
  // Search locally around a sparse grid. Clearance uses immutable bloom bases,
  // so construction does not depend on the animation frame or meadow seed pose.
  for (let id = 0; id < COUNT; id++) {
    const [targetX, targetZ] = targets[id];
    let bestX = targetX, bestZ = targetZ, bestY = 4.27, bestScore = -Infinity;
    for (let attempt = 0; attempt < 81; attempt++) {
      const angle = attempt * 2.399963229728653, r = attempt === 0 ? 0 : .4 * Math.sqrt(attempt);
      const x = targetX + Math.cos(angle) * r, z = targetZ + Math.sin(angle) * r;
      const y = 4.27 + (id % 4) * .095 + (attempt >= 57 ? .8 : 0);
      if (Math.hypot(x, z) > 28 || Math.abs(x) > 23 || Math.abs(z) > 23) continue;
      let clearance = 3.5;
      for (const flower of flowers) {
        const horizontal = Math.hypot(flower.base.x - x, flower.base.z - z);
        const vertical = Math.abs(flower.base.y + flower.height - y);
        // Reserve a little more room for the shared wind bend and both perches.
        const leafGap = vertical > .95 ? horizontal - flower.radius - .8 : horizontal - flower.radius - 2.90;
        const perchGap = Math.hypot(horizontal, flower.base.y + flower.height - (y - .62)) - flower.radius - .9;
        clearance = Math.min(clearance, leafGap, perchGap);
      }
      for (const other of bases) clearance = Math.min(clearance, Math.hypot(other.x - x, other.z - z) - 5.3);
      const score = Math.min(.65, clearance) - r * .12 - Math.max(0, y - 4.7) * .3;
      if (score > bestScore) { bestScore = score; bestX = x; bestZ = z; bestY = y; }
      if (attempt === 0 && clearance > .14) break;
    }
    const base = new THREE.Vector3(bestX, bestY, bestZ), yaw = random() * TAU;
    bases.push(base); restRotations.push(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    const root = new THREE.Vector3(Math.sin(yaw) * 1.56, 0, Math.cos(yaw) * 1.56).add(base);
    root.y = groundHeight(root.x, root.z) - .025; roots.push(root);
    shelters.push({
      id, center: base.clone(), perch: base.clone().add(PERCH), topPerch: base.clone().add(TOP_PERCH),
      rotation: new THREE.Quaternion(), velocity: new THREE.Vector3(), topVelocity: new THREE.Vector3(),
      root: root.clone(), radius: 1.9,
    });
    leaves.setColorAt(id, new THREE.Color().setHSL(.215 + random() * .035, .16 + random() * .1, .87 + random() * .06));
  }
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(1, 1, 1), offset = new THREE.Vector3();
  const previousPerch = new THREE.Vector3(), previousTopPerch = new THREE.Vector3(), previousCenter = new THREE.Vector3(), previousRotation = new THREE.Quaternion();
  const end = new THREE.Vector3(), direction = new THREE.Vector3(), tipDirection = new THREE.Vector3(), stemRotation = new THREE.Quaternion();
  let disposed = false;
  function pose(id: number, time: number, position: THREE.Vector3, rotation: THREE.Quaternion) {
    const base = bases[id], root = roots[id], height = base.y - root.y;
    flowerSwayAt(root.x, root.z, height, .48, time, offset);
    // A broad leaf follows the flowers' delayed gust rather than another clock.
    // Smooth saturation keeps deflection below .66 without hard clipping turns.
    const horizontal = Math.hypot(offset.x, offset.z);
    if (horizontal > 1e-7) offset.multiplyScalar(.66 * Math.tanh(horizontal / .66) / horizontal);
    offset.y = -(offset.x * offset.x + offset.z * offset.z) * (2 / 3) / height;
    position.copy(base).add(offset);
    // Its short broad blade tilts less than a flower head on a flexible stalk.
    tipDirection.set(offset.x * .78, height + offset.y, offset.z * .78).normalize();
    rotation.setFromUnitVectors(UP, tipDirection).multiply(restRotations[id]);
  }
  function update(time: number, _cameraPosition: THREE.Vector3) {
    if (disposed) return;
    for (let id = 0; id < COUNT; id++) {
      const shelter = shelters[id];
      pose(id, time, shelter.center, shelter.rotation);
      shelter.perch.copy(PERCH).applyQuaternion(shelter.rotation).add(shelter.center);
      shelter.topPerch.copy(TOP_PERCH).applyQuaternion(shelter.rotation).add(shelter.center);
      pose(id, time - 1 / 60, previousCenter, previousRotation);
      previousPerch.copy(PERCH).applyQuaternion(previousRotation).add(previousCenter);
      previousTopPerch.copy(TOP_PERCH).applyQuaternion(previousRotation).add(previousCenter);
      shelter.velocity.copy(shelter.perch).sub(previousPerch).multiplyScalar(time === 0 ? 0 : 60);
      shelter.topVelocity.copy(shelter.topPerch).sub(previousTopPerch).multiplyScalar(time === 0 ? 0 : 60);
      scale.set(1, 1, 1); matrix.compose(shelter.center, shelter.rotation, scale); leaves.setMatrixAt(id, matrix);
      end.set(0, leafSurfaceHeight(0, 1.56) - .025, 1.56).applyQuaternion(shelter.rotation).add(shelter.center);
      direction.copy(end).sub(roots[id]); const length = direction.length(); direction.multiplyScalar(1 / length);
      stemRotation.setFromUnitVectors(UP, direction); scale.set(1, length, 1);
      matrix.compose(roots[id], stemRotation, scale); stems.setMatrixAt(id, matrix);
    }
    leaves.instanceMatrix.needsUpdate = true; stems.instanceMatrix.needsUpdate = true;
  }
  // Conservative fixed bounds include both the rooted stems and animated tips.
  leaves.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 33);
  stems.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 33);
  update(0, UP);
  return {
    shelters, surface: canopy, update,
    dispose() {
      if (disposed) return; disposed = true;
      scene.remove(group); canopy.dispose(); stemGeometry.dispose(); material.dispose();
      leaves.dispose(); stems.dispose();
    },
  };
}
