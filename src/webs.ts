import * as THREE from 'three';
import { meadowGroundHeight, rng } from './world';
import { windGLSL, windUniforms } from './wind';
import type { LeafShelter } from './shelters';
import type { Flower } from './types';

/**
 * Orb-weaver webs strung between grass stems, low in the grass. Flying or
 * walking through one catches the bee until it pulls free (see Garden). The
 * webs are faint in sunshine and sparkle with dew in the morning and with drops
 * after rain. One line draw and one instanced bead draw for the whole meadow.
 * They sway with the grass they hang from (the same bend as the waving grass)
 * and billow a little on top, on the GPU. Catching uses the resting plane.
 */
export interface SpiderWeb {
  id: number;
  center: THREE.Vector3;
  /** Unit normal of the web's plane. */
  normal: THREE.Vector3;
  radius: number;
  torn: boolean;
}

const MAX_WEBS = 32;
const WEB_COUNT = 28;
const BEADS_PER_WEB = 60;
/** Fraction of threads left hanging once a web is torn. */
const TORN_KEEP = .3;

export function createWebs(scene: THREE.Scene, seed: number, flowers: readonly Flower[], leaves: readonly LeafShelter[]) {
  const random = rng((seed ^ 0x5eb5eb5) >>> 0 || 7);
  const webs: SpiderWeb[] = [];
  const start = flowers[0]?.center ?? new THREE.Vector3(0, 0, 3.5);
  for (let attempt = 0; attempt < 900 && webs.length < WEB_COUNT; attempt++) {
    const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * 26.5;
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    // Keep the opening flower and the broad leaves clear; leaves are the safe shelter.
    if (Math.hypot(x - start.x, z - start.z) < 5) continue;
    if (leaves.some(leaf => Math.hypot(x - leaf.center.x, z - leaf.center.z) < leaf.radius + 1.8)) continue;
    if (flowers.some(f => Math.hypot(x - f.center.x, z - f.center.z) < f.radius + .55 || Math.hypot(x - f.base.x, z - f.base.z) < .7)) continue;
    if (webs.some(w => Math.hypot(x - w.center.x, z - w.center.z) < 2.2)) continue;
    const radius = .36 + random() * .2;
    const y = meadowGroundHeight(x, z) + .72 + random() * .75;
    // Webs lean a little, rarely hanging perfectly upright.
    const yaw = random() * Math.PI, tilt = (random() - .5) * .5;
    const normal = new THREE.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
    webs.push({ id: webs.length, center: new THREE.Vector3(x, y, z), normal, radius, torn: false });
  }

  // ---- threads
  const positions: number[] = [], webIds: number[] = [], keeps: number[] = [], sways: number[] = [], lifts: number[] = [];
  const planar = new THREE.Vector3();
  const heightAboveGround = (p: THREE.Vector3) => Math.max(0, p.y - meadowGroundHeight(p.x, p.z));
  /** How freely a point on the web moves: 1 at the hub, 0 at the frame and beyond. */
  const swayWeight = (web: SpiderWeb, p: THREE.Vector3) => {
    planar.subVectors(p, web.center); planar.addScaledVector(web.normal, -planar.dot(web.normal));
    return THREE.MathUtils.clamp(1 - (planar.length() / (web.radius * 1.1)) ** 2, 0, 1);
  };
  const beadPoints: { web: number; point: THREE.Vector3; keep: number; size: number; threshold: number }[] = [];
  const right = new THREE.Vector3(), up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3();
  // 0 fresh and taut, 1 old, loose and patchy. Set per web below.
  let wear = 0;
  const point = (web: SpiderWeb, r: number, theta: number, out: THREE.Vector3) => {
    out.copy(web.center).addScaledVector(right, Math.cos(theta) * r).addScaledVector(up, Math.sin(theta) * r * .92);
    // An old web settles: its lower half droops under its own weight.
    const f = r / web.radius;
    out.y -= wear * .07 * f * f * (1.2 - Math.sin(theta)) * web.radius;
    return out;
  };
  const segment = (web: SpiderWeb, p: THREE.Vector3, q: THREE.Vector3, keep: number) => {
    positions.push(p.x, p.y, p.z, q.x, q.y, q.z); webIds.push(web.id, web.id); keeps.push(keep, keep);
    const n = web.normal;
    sways.push(n.x, n.y, n.z, swayWeight(web, p), n.x, n.y, n.z, swayWeight(web, q));
    lifts.push(web.center.x, web.center.z, heightAboveGround(p), web.center.x, web.center.z, heightAboveGround(q));
  };
  /** A thread that droops in the middle: two segments with a lowered midpoint. */
  const sagging = (web: SpiderWeb, p: THREE.Vector3, q: THREE.Vector3, sag: number, keep: number) => {
    m.copy(p).lerp(q, .5); m.y -= sag * p.distanceTo(q);
    segment(web, p, m, keep); segment(web, m, q, keep);
  };
  const dangle = (web: SpiderWeb, from: THREE.Vector3, length: number, keep: number) => {
    // A loose strand hanging down, curling slightly in the breeze.
    const side = (random() - .5) * .08;
    a.copy(from);
    for (let k = 1; k <= 4; k++) {
      b.copy(from).addScaledVector(right, side * k * k * .25); b.y -= length * k / 4;
      segment(web, a, b, keep); a.copy(b);
    }
  };
  for (const web of webs) {
    right.set(web.normal.z, 0, -web.normal.x).normalize();
    up.crossVectors(web.normal, right).normalize();
    if (up.y < 0) up.negate();
    // About 70% of the webs are old: loose, droopy, gappy and uneven.
    wear = random() < .7 ? .5 + random() * .5 : .12 + random() * .2;
    const spokes = 13 + Math.floor(random() * 6);
    const offsets = Array.from({ length: spokes }, (_, i) => (i + (random() - .5) * (.35 + wear * .5)) / spokes * Math.PI * 2);
    const rim = offsets.map(() => web.radius * (.82 + random() * (.18 + wear * .12)));
    // A missing wedge (old webs), and the odd broken spoke.
    const gapStart = random() * Math.PI * 2, gapSize = wear > .45 ? .5 + random() * 1.1 * wear : 0;
    const inGap = (theta: number) => gapSize > 0 && ((theta - gapStart) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) < gapSize;
    for (let i = 0; i < spokes; i++) {
      const broken = random() < wear * .18;
      point(web, web.radius * .06, offsets[i], a);
      point(web, rim[i] * (broken ? .35 + random() * .3 : 1), offsets[i], b);
      sagging(web, a, b, wear * .04, random());
      if (broken && random() < .7) dangle(web, b.clone(), .08 + random() * .16, random());
    }
    // The capture spiral: a widening coil drawn spoke to spoke, uneven in old webs.
    const turns = 9 + Math.floor(random() * 4), steps = turns * spokes;
    let jitter = 0;
    for (let s = 0; s < steps; s++) {
      const i = s % spokes, j = (s + 1) % spokes;
      if (inGap(offsets[i]) || inGap(offsets[j])) continue;
      if (random() < wear * .12) continue; // a snapped strand here and there
      const nextJitter = (random() - .5) * .05 * wear;
      const r0 = .2 + .78 * s / steps + jitter, r1 = .2 + .78 * (s + 1) / steps + nextJitter;
      jitter = nextJitter;
      point(web, rim[i] * r0, offsets[i], a); point(web, rim[j] * r1, offsets[j], b);
      const keep = random();
      // Every web sags a touch between spokes; old ones hang looser.
      sagging(web, a, b, .03 + wear * .16 * (1 + r0), keep);
      if (random() < .45 && beadPoints.length < (web.id + 1) * BEADS_PER_WEB) {
        // Anywhere along the thread, not on a grid. Each drop has its own wetness
        // threshold, so light dew shows a scattered few and fresh rain fills in.
        const along = random() < .5 ? a.clone().lerp(m, random()) : m.clone().lerp(b, random());
        beadPoints.push({ web: web.id, point: along, keep, size: .45 + random() * .75, threshold: random() ** .7 });
      }
    }
    // Loose strands hanging from the lower rim of an old web.
    const strands = Math.floor(wear * 4 * random());
    for (let k = 0; k < strands; k++) {
      const i = Math.floor(random() * spokes);
      if (Math.sin(offsets[i]) > .2) continue;
      point(web, rim[i] * (.7 + random() * .3), offsets[i], m);
      dangle(web, m.clone(), .1 + random() * .25, random());
    }
    // Anchor threads out to the grass: up, down and sideways from the frame.
    for (let k = 0; k < 4; k++) {
      const theta = k * Math.PI / 2 + (random() - .5) * .6;
      point(web, rim[Math.floor(k * spokes / 4)], theta, a);
      b.copy(a).sub(web.center).multiplyScalar(.9 + random() * .8).add(a);
      if (k === 3) b.y = meadowGroundHeight(b.x, b.z) + .05;
      sagging(web, a.clone(), b.clone(), .02 + wear * .08, random());
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aWeb', new THREE.Float32BufferAttribute(webIds, 1));
  geometry.setAttribute('aKeep', new THREE.Float32BufferAttribute(keeps, 1));
  geometry.setAttribute('aSway', new THREE.Float32BufferAttribute(sways, 4));
  geometry.setAttribute('aLift', new THREE.Float32BufferAttribute(lifts, 3));
  const uniforms = {
    uTorn: { value: new Array<number>(MAX_WEBS).fill(0) },
    uWebAlpha: { value: .3 },
    uWebFar: { value: 20 },
    uWebTime: { value: 0 },
  };
  // A web moves with the grass it is strung from: every point takes exactly the
  // bend a grass blade rooted at the web would have at that height (the same
  // formula as the waving grass in world.ts), so the anchors travel with the
  // blades and the thread to the ground stays put. On top of that the web
  // itself billows a little along its normal, most at the hub.
  const swayGLSL = windGLSL + `
    uniform float uWebTime;
    vec3 webSway(vec4 sway, vec3 lift, float id) {
      vec2 root = lift.xy; float h = lift.z;
      vec2 gust = meadowWind(root, uWebTime);
      float wave = sin(root.x * 0.36 + root.y * 0.26 - uWebTime * 1.45);
      float flutter = sin(uWebTime * 2.7 + root.x * 1.7 + root.y * 1.3);
      vec2 bend = gust * (0.075 + wave * 0.045) + vec2(0.014, -0.009) * flutter;
      vec3 withGrass = vec3(bend.x * h * h, -min(h * 0.12, dot(bend, bend) * h * h * h * 0.45), bend.y * h * h);
      float across = dot(gust, sway.xz);
      float breath = sin(uWebTime * 1.9 + id * 2.3) * .35 + sin(uWebTime * 3.1 + id * 1.1) * .15;
      return withGrass + sway.xyz * (across * .4 + breath * (.3 + .5 * length(gust))) * .04 * sway.w;
    }\n`;
  const material = new THREE.LineBasicMaterial({ color: '#f6f2e4', transparent: true, depthWrite: false });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, windUniforms);
    shader.vertexShader = `attribute float aWeb; attribute float aKeep; attribute vec4 aSway; attribute vec3 aLift; uniform float uTorn[${MAX_WEBS}]; uniform float uWebFar;
      varying float vWebHide; varying float vWebFade;\n` + swayGLSL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += webSway(aSway, aLift, aWeb);`).replace('#include <project_vertex>', `#include <project_vertex>
      vWebHide = uTorn[int(aWeb + .5)] * step(${TORN_KEEP.toFixed(2)}, aKeep);
      // Fine threads only read up close; fading them out avoids distant shimmer.
      vWebFade = 1. - smoothstep(uWebFar * .4, uWebFar, -mvPosition.z);`);
    shader.fragmentShader = `uniform float uWebAlpha; varying float vWebHide; varying float vWebFade;\n` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vWebHide > .5 || vWebFade <= 0.) discard;
      diffuseColor.a *= uWebAlpha * vWebFade;`);
  };
  material.customProgramCacheKey = () => 'bee-spider-web-v5';
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'spider webs'; lines.frustumCulled = false; lines.renderOrder = 2;
  scene.add(lines);

  // ---- dew and rain beads
  const beadGeometry = new THREE.IcosahedronGeometry(.011, 2);
  // Clear water: nearly see-through in the middle, a bright rim, and a small
  // window-like highlight, like the drops on petals and leaves.
  const beadMaterial = new THREE.MeshStandardMaterial({ color: '#d6e8ea', roughness: .05, metalness: 0, transparent: true, depthWrite: false });
  beadMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, windUniforms, { uWebTime: uniforms.uWebTime });
    shader.vertexShader = 'attribute vec4 aSway; attribute vec3 aBeadLift; attribute float aBeadWeb;\n' + swayGLSL + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.);
      mvPosition.xyz += webSway(aSway, aBeadLift, aBeadWeb);
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float dropFacing = clamp(dot(normal, normalize(vViewPosition)), 0., 1.);
      float dropRim = pow(1. - dropFacing, 2.);
      diffuseColor.a *= .3 + .7 * dropRim;
      diffuseColor.rgb *= .7 + .3 * dropFacing;`).replace('#include <opaque_fragment>', `
      float dropGlint = pow(max(dot(normal, normalize(vec3(-.35, .6, .72))), 0.), 36.);
      outgoingLight += vec3(1.) * dropGlint * 1.2;
      diffuseColor.a = max(diffuseColor.a, dropGlint);
      #include <opaque_fragment>`);
  };
  beadMaterial.customProgramCacheKey = () => 'bee-web-dew-v4';
  const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, Math.max(1, beadPoints.length));
  beads.name = 'web dew beads'; beads.frustumCulled = false; beads.count = beadPoints.length; beads.visible = false;
  const beadSway = new Float32Array(Math.max(1, beadPoints.length) * 4), beadWeb = new Float32Array(Math.max(1, beadPoints.length)), beadLift = new Float32Array(Math.max(1, beadPoints.length) * 3);
  beadPoints.forEach((bead, i) => {
    const web = webs[bead.web];
    beadSway.set([web.normal.x, web.normal.y, web.normal.z, swayWeight(web, bead.point)], i * 4); beadWeb[i] = bead.web;
    beadLift.set([web.center.x, web.center.z, heightAboveGround(bead.point)], i * 3);
  });
  beadGeometry.setAttribute('aSway', new THREE.InstancedBufferAttribute(beadSway, 4));
  beadGeometry.setAttribute('aBeadWeb', new THREE.InstancedBufferAttribute(beadWeb, 1));
  beadGeometry.setAttribute('aBeadLift', new THREE.InstancedBufferAttribute(beadLift, 3));
  scene.add(beads);
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), identity = new THREE.Quaternion();
  let lastBeadLevel = -1, beadsDirty = true;
  const layoutBeads = (level: number) => {
    beadPoints.forEach((bead, i) => {
      const hidden = webs[bead.web].torn && bead.keep >= TORN_KEEP;
      const s = hidden || bead.threshold > level ? 0 : (.65 + .35 * level) * bead.size;
      matrix.compose(bead.point, identity, scale.setScalar(Math.max(s, 1e-4)));
      beads.setMatrixAt(i, matrix);
    });
    beads.instanceMatrix.needsUpdate = true;
  };

  return {
    webs,
    /**
     * dew: 0–1 morning dew or rain wetness; sun: 0–1 sunshine. Wet webs sparkle
     * and read clearly; dry ones stay faint silver threads. time drives the
     * sway (pass 0 for reduced motion).
     */
    update(dew: number, sun: number, beeVision = false, time = 0): void {
      uniforms.uWebTime.value = time;
      // Silk reflects ultraviolet, so Bee Vision picks the webs out a little more clearly.
      uniforms.uWebAlpha.value = beeVision ? .55 : THREE.MathUtils.clamp(.32 + sun * .1 + dew * .3, 0, .75);
      uniforms.uWebFar.value = beeVision ? 26 : 20;
      material.color.set(beeVision ? '#cdb2ff' : '#f6f2e4');
      const level = Math.round(THREE.MathUtils.clamp(dew, 0, 1) * 40) / 40;
      beads.visible = lines.visible && level > .03;
      if (beads.visible && (level !== lastBeadLevel || beadsDirty)) { layoutBeads(level); lastBeadLevel = level; beadsDirty = false; }
    },
    tear(id: number): void {
      const web = webs[id]; if (!web || web.torn) return;
      web.torn = true; uniforms.uTorn.value[id] = 1; beadsDirty = true;
    },
    reset(): void {
      for (const web of webs) web.torn = false;
      uniforms.uTorn.value.fill(0); beadsDirty = true;
    },
    setVisible(visible: boolean): void { lines.visible = visible; if (!visible) beads.visible = false; },
    diagnostics() { return { count: webs.length, torn: webs.filter(w => w.torn).length, beads: beads.visible ? beads.count : 0 }; },
    dispose(): void {
      scene.remove(lines, beads); geometry.dispose(); material.dispose(); beadGeometry.dispose(); beadMaterial.dispose(); beads.dispose();
    },
  };
}
