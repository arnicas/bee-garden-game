import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CarriedPollen, Flower, Meadow, Species } from './types';
import { flowerFlex, flowerSwayAt, flowerSwayGLSL, windGLSL, windUniforms } from './wind';
import { createGroundPaint } from './ground-paint';
import { EVEN_MIX, type FlowerSpot, type SpeciesMix } from './meadow-plan';

/** Authored botanical geometry, in art units (one unit is about 10 cm).
 * Plant placement is immutable; head poses and a shared shader clock own wind.
 * Page bounds include wind bend (2.5 units for tall grass). Grass never casts shadows.
 */
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const SPECIES: Species[] = ['daisy', 'poppy', 'cornflower'];
const C = (hex: number) => new THREE.Color(hex);
export function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function heightAt(x: number, z: number): number {
  const distance = Math.hypot(x, z);
  return -0.12 + Math.sin(x * 0.17) * Math.cos(z * 0.13) * 0.16
    + Math.max(0, distance - 25) * 0.026 + Math.max(0, distance - 39) * (0.09 + 0.035 * Math.sin(Math.atan2(z, x) * 5));
}
export { heightAt as meadowGroundHeight };

/** Rain cover in the low grass layer; the short starting corridor has a lower roof. */
export function grassRainCover(x: number, y: number, z: number): number {
  const height = y - heightAt(x, z), shortGrass = Math.abs(x) < 1.4 && z > -3.8 && z < 5;
  return (1 - THREE.MathUtils.smoothstep(height, shortGrass ? .8 : .95, shortGrass ? 1.15 : 1.8))
    * (1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), 44, 50));
}

type PatchVertex = { x: number; y: number; z: number; color: THREE.Color; u?: number; v?: number };
/** Open petal/leaf boundaries are deliberate. Each grid keeps its own smoothing chart. */
function surface(nx: number, ny: number, point: (u: number, v: number) => PatchVertex): THREE.BufferGeometry {
  const count = (nx + 1) * (ny + 1);
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const indices = new Uint16Array(nx * ny * 6);
  let vertex = 0, cursor = 0;
  for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
    const p = point(x / nx, y / ny);
    positions.set([p.x, p.y, p.z], vertex * 3); colors.set([p.color.r, p.color.g, p.color.b], vertex * 3); uv.set([p.u ?? x / nx, p.v ?? y / ny], vertex * 2); vertex++;
  }
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const a = y * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1;
    indices.set([a, c, b, b, c, d], cursor); cursor += 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(new THREE.BufferAttribute(indices, 1)); geometry.computeVertexNormals();
  return geometry;
}
function painted(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  // Use a non-indexed merge contract for primitives and custom surfaces alike.
  const n = geometry.getAttribute('position').count, colors = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { colors.set([color.r, color.g, color.b], i * 3); uv[i * 2 + 1] = -1; }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}
function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const expanded = parts.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(expanded, false)!;
  for (let i = 0; i < parts.length; i++) { parts[i].dispose(); if (expanded[i] !== parts[i]) expanded[i].dispose(); }
  result.computeBoundingSphere(); result.computeBoundingBox(); return result;
}
function ellipsoid(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color, detail = 0): THREE.BufferGeometry {
  return painted(new THREE.IcosahedronGeometry(1, detail).scale(sx, sy, sz).translate(x, y, z), color);
}
function stemBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.Color, segments = 5): THREE.BufferGeometry {
  const difference = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(radius * 0.7, radius, difference.length(), segments, 1, true);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, difference.normalize()));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return painted(geometry, color);
}

interface PollenGrain { position: THREE.Vector3; scale: THREE.Vector3; color: THREE.Color; }
interface FlowerHead { geometry: THREE.BufferGeometry; grains: PollenGrain[]; nectarSpots: THREE.Vector3[]; }
function flowerHead(species: Species, variant: number, simple = false, medium = false): FlowerHead {
  const random = rng(331 + variant * 477 + SPECIES.indexOf(species) * 7121), parts: THREE.BufferGeometry[] = [];
  const grains: PollenGrain[] = [], nectarSpots: THREE.Vector3[] = [];
  const grain = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color) => {
    grains.push({ position: new THREE.Vector3(x, y, z), scale: new THREE.Vector3(sx, sy, sz), color });
  };
  if (species === 'daisy') {
    const count = simple ? 15 : 27;
    for (let i = 0; i < count; i++) {
      const theta = i * TAU / count + random() * 0.065, length = 0.87 + random() * 0.13, width = 0.075 + random() * 0.025;
      parts.push(surface(simple ? 3 : medium ? 5 : 9, simple || medium ? 2 : 4, (u, v) => {
        const across = v * 2 - 1, r = 0.19 + length * 0.81 * u;
        const breadth = width * (0.10 + 0.9 * Math.pow(Math.sin(Math.PI * (u * 0.91 + 0.035)), 0.68));
        const edge = across * breadth;
        const y = -0.055 * r * r + 0.048 * Math.sin(u * Math.PI) + 0.027 * across * across + Math.pow(u, 8) * (0.025 + 0.012 * Math.sin(i));
        const shade = C(0xfff9e2).lerp(C(0xe8c8b8), Math.abs(across) * 0.10 + u * 0.04).lerp(C(0xffd36e), Math.pow(1 - u, 5) * 0.24);
        return { x: Math.cos(theta) * r - Math.sin(theta) * edge, z: Math.sin(theta) * r + Math.cos(theta) * edge, y, color: shade, u: v, v: u };
      }));
    }
    parts.push(ellipsoid(0, 0.017, 0, 0.232, 0.068, 0.232, C(0xb98227), simple || medium ? 1 : 3));
    const florets = simple ? 7 : medium ? 43 : 151;
    for (let i = 0; i < florets; i++) {
      const r = 0.219 * Math.sqrt((i + 0.5) / florets), angle = i * 2.3999632297;
      const top = 0.065 + 0.038 * (1 - (r / 0.23) ** 2);
      const color = C(0xe8ac2b).lerp(C(0xffda60), random() * 0.76);
      grain(Math.cos(angle) * r, top, Math.sin(angle) * r, simple ? 0.026 : 0.017, 0.020, simple ? 0.026 : 0.017, color);
    }
  } else if (species === 'poppy') {
    for (let i = 0; i < 6; i++) {
      const theta = i * TAU / 6 + 0.06 * Math.sin(variant + i), length = 0.94 + random() * 0.06;
      parts.push(surface(simple ? 4 : medium ? 6 : 12, simple ? 4 : medium ? 8 : 14, (u, v) => {
        const side = v * 2 - 1, angle = theta + side * 0.65;
        const r = 0.135 + 0.865 * u * length;
        const scallop = 1 - Math.pow(u, 8) * (0.025 + Math.sin(v * Math.PI * 5) ** 2 * 0.035);
        const y = 0.30 * r * r + Math.sin(v * Math.PI * 8 + u * 5 + i) * 0.018 * u + 0.027 * Math.sin(u * Math.PI) + 0.025 * side * side;
        const color = C(0xe44739).lerp(C(0xfa7660), Math.pow(u, 1.5) * 0.44 + Math.abs(side) * 0.08).lerp(C(0x502d43), Math.pow(Math.max(0, 1 - u / 0.31), 1.4) * 0.94);
        return { x: Math.cos(angle) * r * scallop, y, z: Math.sin(angle) * r * scallop, color, u: v, v: u + 2 };
      }));
    }
    parts.push(ellipsoid(0, 0.065, 0, 0.117, 0.093, 0.117, C(0x7c895c), 1));
    // Radial stigmatic rays crown the pollen-only poppy capsule.
    for (let i = 0; i < 9; i++) {
      const a = i * TAU / 9;
      parts.push(stemBetween(new THREE.Vector3(0, 0.159, 0), new THREE.Vector3(Math.cos(a) * 0.1, 0.136, Math.sin(a) * 0.1), 0.008, C(0xb9c397), 4));
    }
    const anthers = simple ? 8 : medium ? 24 : 72;
    for (let i = 0; i < anthers; i++) {
      const angle = i * 2.3999632297, r = 0.17 + 0.13 * random(), top = 0.13 + random() * 0.08;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      if (!simple) parts.push(stemBetween(new THREE.Vector3(x * 0.8, 0.015, z * 0.8), new THREE.Vector3(x, top, z), 0.0065, C(0x55503d), 3));
      grain(x, top, z, 0.014, 0.018, 0.021, C(0x493141).lerp(C(0xd5a545), random() * 0.65));
    }
  } else {
    // A cornflower head: an outer ring of big sterile florets, each a funnel that
    // flares into a toothed mouth, around a dense disc of small fertile florets.
    // Two offset rings of funnels overlap, so the head looks full from above.
    const rings: [number, number, number, number][] = simple ? [[8, 1, 0, 0]] : [[11, 1, 0, 0], [11, .86, .5, -.03]];
    for (const [count, reach, offset, drop] of rings) for (let i = 0; i < count; i++) {
      const theta = (i + offset) * TAU / count + Math.sin(i * 15 + variant + offset * 7) * 0.05;
      const length = (0.86 + random() * 0.14) * reach;
      const half = TAU / count * (simple ? 0.62 : 0.7), lobes = 5 + Math.floor(random() * 3), tilt = (random() - 0.5) * 0.04;
      parts.push(surface(simple ? 3 : medium ? 5 : 8, simple ? 6 : medium ? 10 : 16, (u, v) => {
        const across = v * 2 - 1;
        // A narrow throat near the disc, widening into the mouth.
        const open = THREE.MathUtils.smoothstep(u, 0.05, 0.72);
        const angle = theta + across * half * (0.5 + 0.5 * open);
        // Pointed lobes cut into the outer rim.
        const notch = Math.abs(((v * lobes) % 1) - 0.5) * 2;
        const rim = 1 - 0.15 * Math.pow(1 - notch, 1.4) * THREE.MathUtils.smoothstep(u, 0.8, 1);
        const radial = (0.12 + 0.83 * length * u) * rim;
        // The funnel: rising from the throat, its sides curling up into a shallow cup.
        const y = drop + 0.03 + 0.06 * u + 0.12 * Math.sin(u * Math.PI * 0.9) + 0.045 * across * across * open + tilt * across;
        const color = C(0x3a2f70).lerp(C(0x4f78dc), Math.pow(u, 0.7)).lerp(C(0xa8b8f4), Math.pow(u, 4) * 0.42);
        return { x: Math.cos(angle) * radial, y, z: Math.sin(angle) * radial, color, u: v, v: u + 4 };
      }));
    }
    // The involucre: a cup of green, dark-fringed bracts under the head.
    parts.push(ellipsoid(0, -0.055, 0, 0.21, 0.1, 0.21, C(0x5d7244), 1));
    parts.push(ellipsoid(0, 0.0, 0, 0.215, 0.03, 0.215, C(0x3f3a2c), 1));
    // The disc: fertile florets, small purple-blue tubes. They open from the
    // outside in, a ring at a time: inside the open ring are closed buds, and
    // outside it florets that have finished. Nectar is in the open ring (the
    // game draws its beads so they can be sipped dry one by one). Each head
    // variant is at its own age, so the ring sits at its own radius.
    parts.push(ellipsoid(0, 0.015, 0, 0.205, 0.065, 0.205, C(0x2c2650), 1));
    // Young (ring near the edge), middle-aged or older (ring near the centre), with a little jitter.
    const ring = [0.145, 0.11, 0.075][variant % 3] + (rng(911 + variant * 53)() - 0.5) * 0.02, ringWidth = 0.028;
    const florets = simple ? 7 : medium ? 26 : 56;
    const open: { angle: number; spot: THREE.Vector3 }[] = [];
    for (let i = 0; i < florets; i++) {
      const r = Math.sqrt((i + 0.5) / florets) * 0.18, angle = i * 2.3999632297, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      const floor = 0.015 + 0.065 * Math.sqrt(Math.max(0, 1 - (r / 0.205) ** 2));
      const bud = r < ring - ringWidth, opening = Math.abs(r - ring) <= ringWidth;
      const height = bud ? 0.03 + random() * 0.012 : 0.07 + random() * 0.04;
      const lean = new THREE.Vector3(x * 2.2, 1, z * 2.2).normalize();
      const base = new THREE.Vector3(x, floor - 0.01, z), mouth = base.clone().addScaledVector(lean, height);
      const tube = bud ? C(0x33295f).lerp(C(0x4a3f8e), random() * 0.5) : C(0x4a3f8e).lerp(C(0x6a62b8), random() * 0.6);
      parts.push(stemBetween(base, mouth, bud ? 0.015 : 0.017, tube, simple ? 4 : 6));
      let tip: THREE.Vector3;
      if (bud) {
        // A closed bud: a rounded tip, no mouth or anthers yet.
        if (!simple) parts.push(ellipsoid(mouth.x, mouth.y, mouth.z, 0.016, 0.02, 0.016, tube.clone().lerp(C(0x241a3c), 0.3), 0));
        tip = mouth.clone().addScaledVector(lean, 0.016);
      } else {
        if (!simple) {
          const flare = new THREE.CylinderGeometry(0.025, 0.014, 0.02, 8, 1, true);
          flare.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, lean)).translate(mouth.x, mouth.y, mouth.z);
          parts.push(painted(flare, tube.clone().lerp(C(0x8b86d6), 0.3)));
        }
        tip = mouth.clone().addScaledVector(lean, 0.03);
        if (!simple) parts.push(stemBetween(mouth, tip, 0.0075, C(0x241a3c), 4));
        if (opening && !simple && !medium) open.push({ angle: Math.atan2(z, x), spot: mouth.clone().addScaledVector(lean, 0.004) });
      }
      // Pollen grain at the anther tip; purple-violet like the anthers, matching the carried-pollen colour.
      const color = C(0x393268).lerp(C(0x68508b), random());
      grain(tip.x, tip.y + 0.004, tip.z, 0.011, 0.015, 0.011, color);
    }
    // Seven nectar florets spread evenly around the open ring.
    open.sort((a, b) => a.angle - b.angle);
    const holding = Math.min(7, open.length);
    for (let k = 0; k < holding; k++) nectarSpots.push(open[Math.floor(k * open.length / holding)].spot);
  }
  // A stable scattered order makes depletion leave natural gaps in every view.
  const shuffle = rng(971 + variant * 137 + SPECIES.indexOf(species) * 181);
  for (let i = grains.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [grains[i], grains[j]] = [grains[j], grains[i]];
  }
  return { geometry: combine(parts), grains, nectarSpots };
}

/** A flower's resting stalk: a gentle curve from the base to the head. */
function stalkCurve(height: number, phase: number): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(phase) * 0.10, height * 0.32, Math.cos(phase) * 0.08),
    new THREE.Vector3(Math.sin(phase + 1) * 0.09, height * 0.69, Math.cos(phase + 1) * 0.06), new THREE.Vector3(0, height, 0),
  ]);
}
/** A point on a flower's real stalk at u (0 base, 1 head): its resting curve
 * plus the same wind bend as the stem shader (sway × (y / height)²), so small
 * creatures on a stem sit on its surface. */
export function stalkPoint(f: Flower, u: number, out: THREE.Vector3): THREE.Vector3 {
  f.stalk.getPointAt(THREE.MathUtils.clamp(u, 0, 1), out);
  const s = Math.max(0, out.y) / Math.max(.01, f.height), bend = s * s;
  return out.set(f.base.x + out.x + (f.center.x - f.base.x) * bend, f.base.y + out.y + (f.center.y - f.base.y - f.height) * bend, f.base.z + out.z + (f.center.z - f.base.z) * bend);
}
const stalkAhead = new THREE.Vector3();
/** The stalk's direction at u, pointing up toward the head. */
export function stalkTangent(f: Flower, u: number, out: THREE.Vector3): THREE.Vector3 {
  stalkPoint(f, Math.max(0, u - .02), out); stalkPoint(f, Math.min(1, u + .02), stalkAhead);
  return out.subVectors(stalkAhead, out).normalize();
}
function stalkGeometry(species: Species, height: number, phase: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const curve = stalkCurve(height, phase);
  parts.push(painted(new THREE.TubeGeometry(curve, 9, species === 'poppy' ? 0.032 : 0.026, 5, false), C(species === 'cornflower' ? 0x75926b : 0x668442)));
  const leaves = species === 'cornflower' ? 5 : 3;
  for (let i = 0; i < leaves; i++) {
    const f = 0.18 + i * 0.15, origin = curve.getPoint(f), theta = phase + i * 2.399;
    const length = species === 'poppy' ? 0.73 : species === 'cornflower' ? 0.71 : 0.56;
    parts.push(surface(8, 4, (u, v) => {
      const side = v * 2 - 1, lobes = species === 'poppy' ? 0.60 + 0.40 * Math.sin(u * Math.PI * 7) ** 2 : 1;
      const width = (species === 'cornflower' ? 0.065 : 0.16) * Math.sin(u * Math.PI) * lobes;
      const leafColor = C(0x467247).lerp(C(0x96ac69), u * 0.35 + Math.abs(side) * 0.22);
      return { x: origin.x + Math.cos(theta) * u * length - Math.sin(theta) * side * width, y: origin.y + Math.sin(u * Math.PI) * 0.18 + u * 0.23 + Math.abs(side) * 0.035, z: origin.z + Math.sin(theta) * u * length + Math.cos(theta) * side * width, color: leafColor, u: v, v: u };
    }));
  }
  parts.push(ellipsoid(0, height - 0.045, 0, species === 'cornflower' ? 0.20 : 0.15, 0.13, species === 'cornflower' ? 0.20 : 0.15, C(0x638255), 1));
  return combine(parts);
}

/** Bend geometry, normals, and the depth pass with one shared shader clock.
 * Root transform stays fixed; the head uses the matching CPU endpoint/tangent. */
function bendFlowerStems(material: THREE.Material, clock: { value: number }): void {
  const compile = material.onBeforeCompile.bind(material), cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.uniforms.uFlowerTime = clock; Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = 'uniform float uFlowerTime; attribute vec2 stemShape;\n' + windGLSL + '\n' + flowerSwayGLSL + '\n' + shader.vertexShader.replace(windGLSL, '');
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      vec3 stemNormalOffset = flowerSway(modelMatrix[3].xz, stemShape.x, stemShape.y, uFlowerTime);
      vec3 slope = stemNormalOffset * (2.0 * max(position.y, 0.0) / (stemShape.x * stemShape.x));
      objectNormal.y = (objectNormal.y - dot(objectNormal.xz, slope.xz)) / max(0.1, 1.0 + slope.y);
      objectNormal = normalize(objectNormal);
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 stemOffset = flowerSway(modelMatrix[3].xz, stemShape.x, stemShape.y, uFlowerTime);
      float stemU = max(position.y, 0.0) / stemShape.x;
      transformed += stemOffset * stemU * stemU;
    `);
  };
  material.customProgramCacheKey = () => `${cacheKey}-rooted-flower-v1`;
}
function botanicalMaterial(clock: { value: number }, uvMode: { value: number }, petals: boolean, bend: boolean, pollenPulse = { value: 0 }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.18 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uMeadowTime = clock; shader.uniforms.uMeadowUV = uvMode; Object.assign(shader.uniforms, windUniforms);
    shader.uniforms.uPollenPulse = pollenPulse;
    shader.vertexShader = 'uniform float uMeadowTime; varying vec2 vBotanicalUv; varying vec3 vBotanicalPosition; varying float vPoppyWash; varying float vCornflowerWash;\n' + windGLSL + '\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBotanicalUv = uv; vCornflowerWash = step(4.0, uv.y); vPoppyWash = step(2.0, uv.y) - vCornflowerWash; vBotanicalUv.y -= vPoppyWash * 2.0 + vCornflowerWash * 4.0; vBotanicalPosition = position;');
    if (bend) shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      vec3 rootPosition = vec3(0.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        rootPosition = instanceMatrix[3].xyz;
      #endif
      float h = max(mvPosition.y - rootPosition.y, 0.0);
      vec2 gust = meadowWind((modelMatrix * vec4(rootPosition,1.0)).xz, uMeadowTime);
      mvPosition.xz += gust * h * h * ${petals ? '(0.065 + 0.05 * sin(rootPosition.x * 0.36 + rootPosition.z * 0.26 - uMeadowTime * 1.45)) * 0.82' : '0.027'};
      mvPosition.x += sin(uMeadowTime * 2.1 + rootPosition.x * 1.7 + rootPosition.z * 1.3) * h * h * 0.011;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
    shader.fragmentShader = `uniform float uMeadowUV; uniform float uPollenPulse; varying vec2 vBotanicalUv; varying vec3 vBotanicalPosition; varying float vPoppyWash; varying float vCornflowerWash;
      float botanicalHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
      float botanicalNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(botanicalHash(i),botanicalHash(i+vec2(1,0)),f.x),mix(botanicalHash(i+vec2(0,1)),botanicalHash(i+vec2(1,1)),f.x),f.y);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float paper = sin(vBotanicalPosition.x * 89.0 + sin(vBotanicalPosition.z * 73.0)) * sin(vBotanicalPosition.y * 127.0 + vBotanicalPosition.z * 51.0);
      diffuseColor.rgb *= 0.985 + paper * 0.015;
      ${petals ? `
      if (vBotanicalUv.y >= 0.0) {
        // Low-frequency washes and narrow tide marks imitate pigment pooling.
        // They follow the petal chart, so the pattern stays fixed during wind.
        vec2 paintUv = vBotanicalUv * vec2(3.2,5.3);
        float wash = botanicalNoise(paintUv + botanicalNoise(paintUv * 0.71) * 1.3);
        float tide = smoothstep(0.49,0.56,wash) - smoothstep(0.58,0.69,wash);
        float edgePigment = pow(abs(vBotanicalUv.x * 2.0 - 1.0), 7.0);
        diffuseColor.rgb *= 0.87 + wash * 0.24 - tide * 0.095 - edgePigment * 0.045;
        float vein = sin((vBotanicalUv.x - 0.5) * 63.0 + sin(vBotanicalUv.y * 11.0) * 0.65);
        float filtered = 1.0 - smoothstep(0.04, 0.16, fwidth(vBotanicalUv.x));
        diffuseColor.rgb *= 0.975 + vein * 0.026 * filtered;
        // Poppy petal charts use y=2..3; other flowers and pollen keep their wash.
        if (vPoppyWash > 0.5) {
          vec2 pigmentUv = vBotanicalUv * vec2(4.0, 3.0) + vBotanicalPosition.xz * 0.65;
          float bloom = botanicalNoise(pigmentUv + wash * 0.8);
          float pool = smoothstep(0.38, 0.49, bloom) - smoothstep(0.51, 0.65, bloom);
          float dilute = smoothstep(0.25, 0.85, bloom);
          vec3 scarlet = diffuseColor.rgb;
          vec3 paleWash = mix(scarlet, vec3(1.0, 0.52, 0.36), 0.20);
          diffuseColor.rgb = mix(scarlet * vec3(0.92, 0.82, 0.86), paleWash, dilute);
          diffuseColor.rgb *= 1.0 - pool * 0.12 - edgePigment * 0.08;
          float brush = botanicalNoise(vec2(vBotanicalUv.x * 28.0, vBotanicalUv.y * 2.2));
          diffuseColor.rgb = mix(diffuseColor.rgb, paleWash, smoothstep(0.60, 0.84, brush) * 0.20 * filtered);
        }
        // Cornflower charts use y=4..5. Uneven dilution follows each floret.
        if (vCornflowerWash > 0.5) {
          float bleed = botanicalNoise(vBotanicalPosition.xz * 5.0 + vec2(3.7, 8.2));
          float reach = vBotanicalUv.y + (bleed - 0.5) * 0.16;
          float paleTip = smoothstep(0.55, 1.02, reach);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.60, 0.66, 0.94), paleTip * 0.28);
          float pool = smoothstep(0.56, 0.70, reach) - smoothstep(0.72, 0.88, reach);
          diffuseColor.rgb *= 1.0 - pool * 0.075 + (wash - 0.5) * 0.09;
        }
        float guide = (1.0 - smoothstep(0.1, 0.42, vBotanicalUv.y)) * uMeadowUV;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.39,0.10,0.64), guide * 0.82);
        // A gold wash stays readable on pale daisies as well as colored petals.
        float matchingTip = smoothstep(0.40, 0.82, vBotanicalUv.y) * uPollenPulse;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.48, 0.05), matchingTip * 0.35);
      }` : ''}
    `);
    // Thin leaves and petals retain color under backlighting, without bloom.
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * 0.075;
      ${petals ? 'totalEmissiveRadiance += vec3(0.82, 0.64, 0.22) * uPollenPulse * 0.22 * smoothstep(0.15, 0.75, vBotanicalUv.y);' : ''}
    `);
  };
  material.customProgramCacheKey = () => `bee-garden-botanical-v7-${petals}-${bend}`;
  return material;
}

/** Opaque pointed ribbons: five triangles per near blade, three at distance.
 * The silhouette and root chart match across levels; no alpha cards or textures. */
function grassBlade(segments: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const theta = blade * 2.39996;
    const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
    const add = (u: number, side: number) => {
      const edge = side * (0.045 * (1 - u) + 0.026 * Math.sin(Math.PI * u));
      const bend = u * u * (0.22 + blade * 0.085);
      const color = C(0x456b3e).lerp(C(0xb8c780), u * 0.72);
      positions.push(Math.cos(theta) * bend - Math.sin(theta) * edge, u * (0.8 + blade * 0.15), Math.sin(theta) * bend + Math.cos(theta) * edge);
      colors.push(color.r, color.g, color.b); uvs.push((side + 1) / 2, u);
    };
    for (let row = 0; row < segments; row++) { add(row / segments, -1); add(row / segments, 1); }
    add(1, 0);
    for (let row = 0; row < segments - 1; row++) { const a = row * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    indices.push(segments * 2 - 2, segments * 2, segments * 2 - 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); parts.push(geometry);
  }
  return combine(parts);
}

/** A single shared clock moves the entire field on the GPU. Vertex-lit opaque
 * leaves avoid PBR fragment cost and transparent overdraw on the dense layer. */
function wavingGrassMaterial(clock: { value: number }): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x17200b, emissiveIntensity: 0.14 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uMeadowTime = clock; Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = 'uniform float uMeadowTime;\n' + windGLSL + '\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
      vec3 grassRoot = instanceMatrix[3].xyz;
      float h = max(mvPosition.y - grassRoot.y, 0.0);
      vec2 gust = meadowWind(grassRoot.xz, uMeadowTime);
      // Coherent fronts roll across neighboring clumps, with a small tip flutter.
      float wave = sin(grassRoot.x * 0.36 + grassRoot.z * 0.26 - uMeadowTime * 1.45);
      float flutter = sin(uMeadowTime * 2.7 + grassRoot.x * 1.7 + grassRoot.z * 1.3);
      vec2 bend = gust * (0.075 + wave * 0.045) + vec2(0.014, -0.009) * flutter;
      mvPosition.xz += bend * h * h;
      mvPosition.y -= min(h * 0.12, dot(bend, bend) * h * h * h * 0.45);
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  material.customProgramCacheKey = () => 'bee-garden-waving-grass-v1';
  return material;
}

/** Low, broad leaves cover the soil under the fine upright grass. */
function groundCover(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let leaf = 0; leaf < 4; leaf++) {
    const angle = leaf * 2.399963, length = 0.52 + (leaf % 3) * 0.11;
    parts.push(surface(3, 2, (u, v) => {
      const across = v * 2 - 1;
      const halfWidth = (0.008 + Math.sin(u * Math.PI) * 0.13) * (1 - u * 0.24);
      const r = u * length;
      const color = C(0x4c754e).lerp(C(0x9fad72), u * 0.45 + Math.abs(across) * 0.15);
      return {
        x: Math.cos(angle) * r - Math.sin(angle) * across * halfWidth,
        y: 0.025 + Math.sin(u * Math.PI) * 0.24 + r * 0.05 + Math.abs(across) * 0.028,
        z: Math.sin(angle) * r + Math.cos(angle) * across * halfWidth,
        color, u: v, v: u,
      };
    }));
  }
  return combine(parts);
}

/** A light, open panicle: bent stalk, alternating branches and hanging seed pods. */
function oatGrass(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stemColor = C(0x84915a), seedColor = C(0xb9ad70);
  const nodes = [new THREE.Vector3(0,0,0),new THREE.Vector3(0.035,1.3,0),new THREE.Vector3(0.09,2.25,0),new THREE.Vector3(0.19,3.2,0.025)];
  for(let i=0;i<nodes.length-1;i++) parts.push(stemBetween(nodes[i],nodes[i+1],0.009,stemColor,3));
  for(let branch=0;branch<6;branch++) {
    const height = 1.9 + branch * 0.205, angle = branch * 2.399963;
    const extent = 0.39 - branch * 0.036;
    const start = new THREE.Vector3(0.065 + branch * 0.02,height,0.01);
    const elbow = new THREE.Vector3(start.x + Math.cos(angle) * extent,height + 0.17,Math.sin(angle) * extent);
    const tip = new THREE.Vector3(elbow.x + Math.cos(angle) * 0.05,height + 0.035,elbow.z + Math.sin(angle) * 0.05);
    parts.push(stemBetween(start,elbow,0.006,stemColor,3),stemBetween(elbow,tip,0.004,stemColor,3));
    const pod = ellipsoid(tip.x,tip.y-0.06,tip.z,0.035,0.091,0.025,seedColor.clone().lerp(C(0xd6c88d),branch * 0.075));
    // Smooth normals avoid a crystalline reading on the very small seed silhouettes.
    const position = pod.attributes.position, normal = pod.attributes.normal;
    for(let i=0;i<position.count;i++) {
      const nx=(position.getX(i)-tip.x)/(0.035*0.035),ny=(position.getY(i)-tip.y+0.06)/(0.091*0.091),nz=(position.getZ(i)-tip.z)/(0.025*0.025),length=Math.hypot(nx,ny,nz);
      normal.setXYZ(i,nx/length,ny/length,nz/length);
    }
    parts.push(pod);
    parts.push(stemBetween(new THREE.Vector3(tip.x,tip.y-0.13,tip.z),new THREE.Vector3(tip.x+0.025,tip.y-0.24,tip.z),0.0025,seedColor,3));
  }
  return combine(parts);
}

/** Maps a uniform random number to a species by the mix's proportions. An even
 * mix gives the same result as SPECIES[Math.floor(u * 3)], so seeds keep their layouts. */
function pickSpecies(u: number, mix: SpeciesMix): Species {
  const total = SPECIES.reduce((sum, species) => sum + Math.max(0, mix[species]), 0) || 1;
  let edge = 0;
  for (const species of SPECIES) { edge += Math.max(0, mix[species]) / total; if (u < edge) return species; }
  return SPECIES[SPECIES.length - 1];
}

/** The hand-placed opening flowers come first in every meadow and never change. */
export const FIXED_FLOWERS = 6;

/** Builds the meadow. Without `spots` the flowers are seeded evenly (the first
 * summer); with them, each summer's planned layout is planted (see planNextSummer). */
export function createMeadow(scene: THREE.Scene, seed = 7919, spots: readonly FlowerSpot[] | null = null): Meadow {
  const root = new THREE.Group(); root.name = 'the living meadow'; scene.add(root);
  const random = rng(seed), clock = { value: 0 }, uvMode = { value: 0 };
  const petalMaterial = botanicalMaterial(clock, uvMode, true, false), plantMaterial = botanicalMaterial(clock, uvMode, false, false), grassMaterial = botanicalMaterial(clock, uvMode, false, true);
  // Visited blooms share one ordinary material; only fresh flowers reveal UV guides.
  const visitedPetalMaterial = botanicalMaterial(clock, { value: 0 }, true, false);
  const pollenPulse = { value: 0 };
  const matchingPetalMaterial = botanicalMaterial(clock, uvMode, true, false, pollenPulse);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([petalMaterial, visitedPetalMaterial, matchingPetalMaterial, plantMaterial, grassMaterial]);
  const stemDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  bendFlowerStems(plantMaterial, clock); bendFlowerStems(stemDepthMaterial, clock); materials.add(stemDepthMaterial);
  const keep = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const flowerHeads = new Map<string, FlowerHead>();
  // Mid geometry keeps every petal/finger and the same seeded outline. Only
  // tessellation and subpixel central florets simplify, outside landing range.
  for (const species of SPECIES) for (let variant = 0; variant < 3; variant++) {
    for (const medium of [false, true]) {
      const head = flowerHead(species, variant, false, medium); keep(head.geometry);
      flowerHeads.set(`${species}-${variant}${medium ? '-mid' : ''}`, head);
    }
    const far = flowerHead(species, variant, true); keep(far.geometry);
    flowerHeads.set(`${species}-${variant}-far`, far);
  }
  const grainGeometry = keep(painted(new THREE.IcosahedronGeometry(1, 0), C(0xffffff)));
  const detailedGrainGeometry = keep(painted(new THREE.IcosahedronGeometry(1, 1), C(0xffffff)));
  const grainTransform = new THREE.Object3D();
  const pollenVisuals: { fraction: number; detail: number }[] = [];
  function updatePollen(flower: Flower, detail: number) {
    const state = pollenVisuals[flower.id], fraction = THREE.MathUtils.clamp(flower.pollenFraction, 0, 1);
    if (state.fraction === fraction && state.detail === detail) return;
    const { grains } = flowerHeads.get(`${flower.species}-${flower.id % 3}${detail === 2 ? '-far' : detail === 1 ? '-mid' : ''}`)!;
    const mesh = flower.pollen;
    mesh.geometry = flower.species === 'daisy' && detail === 0 ? detailedGrainGeometry : grainGeometry;
    // Refill only on reset or LOD changes; ordinary collection updates one grain.
    if (fraction > state.fraction || state.detail !== detail) {
      for (let i = 0; i < grains.length; i++) {
        grainTransform.position.copy(grains[i].position); grainTransform.scale.copy(grains[i].scale); grainTransform.updateMatrix();
        mesh.setMatrixAt(i, grainTransform.matrix); mesh.setColorAt(i, grains[i].color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const remaining = fraction * grains.length;
    mesh.count = Math.ceil(remaining); mesh.visible = mesh.count > 0;
    if (mesh.count > 0) {
      const i = mesh.count - 1, grain = grains[i];
      const scale = THREE.MathUtils.smoothstep(remaining - i, 0, 1);
      grainTransform.position.copy(grain.position); grainTransform.scale.copy(grain.scale).multiplyScalar(scale); grainTransform.updateMatrix();
      mesh.setMatrixAt(i, grainTransform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    state.fraction = fraction; state.detail = detail;
  }
  const headDetail: number[] = [];
  const flowers: Flower[] = [], stems: THREE.Mesh[] = [], heights: number[] = [], twists: number[] = [];
  function plant(species: Species, x: number, z: number, height: number, radius: number) {
    const id = flowers.length, base = new THREE.Vector3(x, heightAt(x, z), z), center = base.clone().add(new THREE.Vector3(0, height, 0));
    const group = new THREE.Group(); group.position.copy(center); group.name = `${species} ${id}`;
    const head = flowerHeads.get(`${species}-${id % 3}`)!;
    const petals = new THREE.Mesh(head.geometry, petalMaterial); petals.scale.setScalar(radius); petals.receiveShadow = true; group.add(petals); root.add(group);
    const pollen = new THREE.InstancedMesh(grainGeometry, petalMaterial, head.grains.length);
    pollen.name = 'collectible pollen'; pollen.scale.setScalar(radius); pollen.receiveShadow = true;
    pollen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pollen.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .12, 0), .42);
    group.add(pollen); pollenVisuals.push({ fraction: -1, detail: -1 });
    const stalkShape = keep(stalkGeometry(species, height, id * 1.728));
    const shapeData = new Float32Array(stalkShape.attributes.position.count * 2);
    for (let i = 0; i < shapeData.length; i += 2) { shapeData[i] = height; shapeData[i + 1] = flowerFlex(species); }
    stalkShape.setAttribute('stemShape', new THREE.BufferAttribute(shapeData, 2));
    stalkShape.boundingSphere!.radius += height * .32;
    const stalk = new THREE.Mesh(stalkShape, plantMaterial); stalk.position.copy(base); stalk.receiveShadow = true; stalk.customDepthMaterial = stemDepthMaterial; root.add(stalk);
    const flower: Flower = { id, species, base, center, height, stalk: stalkCurve(height, id * 1.728), velocity: new THREE.Vector3(), radius, group, pollen, pollenFraction: 1, visited: false, pollenMatch: false, rotation: new THREE.Quaternion(), nectarSpots: head.nectarSpots.map(p => p.clone().multiplyScalar(radius)) };
    flowers.push(flower); updatePollen(flower, 0);
    stems.push(stalk); heights.push(height); twists.push(random() * TAU); headDetail.push(0);
  }
  plant('daisy', 0, -3.5, 3.4, 1.03); plant('poppy', 3, -7, 4.2, 1.05); plant('cornflower', -3, -6, 3.8, 0.98);
  // Deliberately composed near blooms, then seeded, spaced habitat records.
  plant('poppy', -3.7, -1.4, 3.0, 0.9); plant('daisy', 4.7, -0.8, 3.45, 0.86); plant('cornflower', 2.8, -11.5, 4.9, 0.89);
  if (spots) for (const spot of spots) plant(spot.species, spot.x, spot.z, spot.height, spot.radius);
  else for (let attempt = 0; flowers.length < 72 && attempt < 6000; attempt++) {
    const angle = random() * TAU, radius = 5.8 + Math.sqrt(random()) * 17.5, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius - 3;
    if (flowers.some(f => Math.hypot(f.base.x - x, f.base.z - z) < 2.05)) continue;
    const species = pickSpecies(random(), EVEN_MIX);
    plant(species, x, z, 2.8 + random() * 2.1, 0.68 + random() * 0.36);
  }
  const terrain = keep(new THREE.PlaneGeometry(180, 180, 96, 96)); terrain.rotateX(-Math.PI / 2);
  const positions = terrain.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setY(i, heightAt(positions.getX(i), positions.getZ(i)));
  terrain.computeVertexNormals();
  const groundMaterial = createGroundPaint();
  materials.add(groundMaterial);
  const ground = new THREE.Mesh(terrain, groundMaterial); ground.receiveShadow = true; root.add(ground);

  const bladeGeometry = keep(grassBlade(3)), distantBladeGeometry = keep(grassBlade(2)), coverGeometry = keep(groundCover()), oatGeometry = keep(oatGrass()), dummy = new THREE.Object3D(), tint = new THREE.Color();
  const wavingMaterial = wavingGrassMaterial(clock); materials.add(wavingMaterial);
  const pages: { mesh: THREE.InstancedMesh; x: number; z: number; range: number }[] = [];
  const grassPages: { mesh: THREE.InstancedMesh; x: number; z: number; detailed: boolean }[] = [];
  // Each page is culled as a draw, with conservative bounds after wind deformation.
  for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
    const px = gx * 9, pz = gz * 9;
    if (Math.hypot(px, pz) > 50) continue;
    const pageRandom = rng(seed ^ Math.imul(gx + 41, 73856093) ^ Math.imul(gz + 41, 19349663));
    const inner = Math.hypot(px, pz) < 28, count = inner ? 500 : 320;
    const mesh = new THREE.InstancedMesh(bladeGeometry, wavingMaterial, count); mesh.name = `grass page ${gx}:${gz}`;
    for (let i = 0; i < count; i++) {
      const x = px + (pageRandom() - 0.5) * 9, z = pz + (pageRandom() - 0.5) * 9, corridor = Math.abs(x) < 1.4 && z > -3.8 && z < 5;
      let h = (0.85 + pageRandom() ** 0.65 * (inner ? 2.9 : 2.05)) * (corridor ? 0.35 : 1);
      // Keep the flower heads and landing surfaces clear while filling the gaps.
      if (inner) for (let j = 0; j < flowers.length; j++) {
        const f = flowers[j], dx = x - f.base.x, dz = z - f.base.z;
        if (dx * dx + dz * dz < (f.radius + 0.6) ** 2) h = Math.min(h, (heights[j] - 0.65) / 1.1);
      }
      dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, pageRandom() * TAU, 0); dummy.scale.set(0.6 + pageRandom() * 0.8, h, 0.6 + pageRandom() * 0.8); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      tint.set(0xffffff).lerp(C(0xc9d991), pageRandom() * 0.42); mesh.setColorAt(i, tint);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.boundingSphere!.radius += 2.5; root.add(mesh); pages.push({ mesh, x: px, z: pz, range: 49 });
    grassPages.push({ mesh, x: px, z: pz, detailed: true });
    if (Math.hypot(px,pz) < 38) {
      // Separate seed lanes keep each population immutable when a neighbor is tuned.
      const coverRandom = rng(seed ^ Math.imul(gx+43,219613) ^ Math.imul(gz+43,990971));
      const coverCount = Math.hypot(px,pz) < 24 ? 76 : 42;
      const cover = new THREE.InstancedMesh(coverGeometry,grassMaterial,coverCount); cover.name = `groundcover page ${gx}:${gz}`;
      for(let i=0;i<coverCount;i++) {
        const x=px+(coverRandom()-0.5)*9,z=pz+(coverRandom()-0.5)*9,scale=0.82+coverRandom()*0.75;
        dummy.position.set(x,heightAt(x,z),z); dummy.rotation.set(0,coverRandom()*TAU,0); dummy.scale.set(scale,0.8+coverRandom()*0.7,scale);dummy.updateMatrix();cover.setMatrixAt(i,dummy.matrix);
        tint.set(0xffffff).lerp(C(0xc6c6a0),coverRandom()*0.34);cover.setColorAt(i,tint);
      }
      cover.instanceMatrix.needsUpdate=true;cover.computeBoundingSphere();cover.boundingSphere!.radius+=0.5;root.add(cover);pages.push({mesh:cover,x:px,z:pz,range:40});
      const oatCount=4, oats=new THREE.InstancedMesh(oatGeometry,grassMaterial,oatCount);oats.name=`oat panicles ${gx}:${gz}`;
      for(let i=0;i<oatCount;i++) {
        let x=px+(coverRandom()-0.5)*9;const z=pz+(coverRandom()-0.5)*9;
        if(Math.abs(x)<1.7&&z>-4.5&&z<5.5)x+=(x<0?-1:1)*2.1;
        dummy.position.set(x,heightAt(x,z),z);dummy.rotation.set(0,coverRandom()*TAU,0);dummy.scale.setScalar(0.75+coverRandom()*0.3);dummy.updateMatrix();oats.setMatrixAt(i,dummy.matrix);
      }
      oats.instanceMatrix.needsUpdate=true;oats.computeBoundingSphere();oats.boundingSphere!.radius+=1;root.add(oats);pages.push({mesh:oats,x:px,z:pz,range:44});
    }
  }
  // Keep the outer apron grass-only. Distant decorative blooms looked reachable
  // from the old boundary but could never be visited or pollinated.

  const offset = new THREE.Vector3(), previousOffset = new THREE.Vector3(), tipDirection = new THREE.Vector3(), twistRotation = new THREE.Quaternion();
  let aerial = false;
  function update(time: number, cameraPosition: THREE.Vector3, uv: boolean, carriedPollen?: CarriedPollen) {
    clock.value = time; uvMode.value = uv ? 1 : 0;
    aerial = cameraPosition.y > (aerial ? 7 : 9);
    // Shared gentle 2.9-second breath. At reduced-motion time 0 it is a steady glow.
    const pulse = .5 + .5 * Math.sin(time * 2.2);
    pollenPulse.value = .18 + .62 * pulse;
    for (let i = 0; i < flowers.length; i++) {
      const flower = flowers[i], h = heights[i];
      const flex = flowerFlex(flower.species);
      flowerSwayAt(flower.base.x, flower.base.z, h, flex, time, offset);
      flowerSwayAt(flower.base.x, flower.base.z, h, flex, time - 1 / 60, previousOffset);
      flower.velocity.subVectors(offset, previousOffset).multiplyScalar(60);
      if (time === 0) flower.velocity.set(0, 0, 0); // The reduced-motion pose is stationary.
      flower.center.copy(flower.base).add(offset); flower.center.y += h;
      tipDirection.set(offset.x * 2, h + offset.y * 2, offset.z * 2).normalize();
      twistRotation.setFromAxisAngle(UP, twists[i]);
      flower.rotation.setFromUnitVectors(UP, tipDirection).multiply(twistRotation);
      flower.group.position.copy(flower.center); flower.group.quaternion.copy(flower.rotation);
      const distance = flower.center.distanceTo(cameraPosition), visible = distance < 48;
      flower.group.visible = visible; stems[i].visible = visible;
      const flowerMesh = flower.group.children[0] as THREE.Mesh;
      flower.pollenMatch = uv && !flower.visited && (carriedPollen?.[flower.species] ?? 0) > .01;
      flowerMesh.material = flower.visited ? visitedPetalMaterial : flower.pollenMatch ? matchingPetalMaterial : petalMaterial;
      // 3.5-unit hysteresis prevents repeated toggling while hovering in gusts.
      const nextDetail = aerial ? 2 : headDetail[i] === 0 ? (distance > 17 ? 1 : 0) : (distance < 13.5 ? 0 : 1);
      if (nextDetail !== headDetail[i]) {
        headDetail[i] = nextDetail;
        flowerMesh.geometry = flowerHeads.get(`${flower.species}-${i % 3}${nextDetail === 2 ? '-far' : nextDetail === 1 ? '-mid' : ''}`)!.geometry;
      }
      updatePollen(flower, nextDetail);
      flowerMesh.castShadow = !aerial && distance < 9; flower.pollen.castShadow = !aerial && distance < 9; stems[i].castShadow = !aerial && distance < 7;
    }
    for (const page of pages) page.mesh.visible = (!aerial || page.mesh.name.startsWith('grass page')) && Math.hypot(cameraPosition.x - page.x, cameraPosition.z - page.z) < page.range;
    for (const page of grassPages) {
      const distance = Math.hypot(cameraPosition.x - page.x, cameraPosition.z - page.z);
      const detailed = !aerial && (page.detailed ? distance < 21 : distance < 17);
      if (detailed !== page.detailed) { page.detailed = detailed; page.mesh.geometry = detailed ? bladeGeometry : distantBladeGeometry; }
      // A fixed prefix of each seeded page stays spatially scattered from above.
      page.mesh.count = aerial ? Math.ceil(page.mesh.instanceMatrix.count * .6) : page.mesh.instanceMatrix.count;
    }
  }
  update(0, new THREE.Vector3(0, 4.6, 3.5), false);
  return { flowers, update, dispose() { scene.remove(root); root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); }); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); } };
}
