// Shrinks the Meshy bee GLB for the game (writes src/assets/bee.glb):
//  - levels the body (the model hovers with its abdomen hanging) and puts the origin on the ground between the feet;
//  - splits the four wings, two antennae and two forelegs into pivot nodes at their hinges
//    (wing_fore_L … ; L is the bee's left, +x; head toward +z), each wing with a folded-back rest turn in extras.rest;
//  - marks her mouth in the body node's extras.mouth; keeps only the colour texture (512px WebP); quantizes.
// Run from a folder with: npm i three @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp
// then: node shrink-bee-glb.mjs input.glb output.glb 512
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import * as THREE from 'three';
const [,, input, output, sizeArg] = process.argv, size = Number(sizeArg || 512);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ sharp });
const doc = await io.read(input);
const root = doc.getRoot(), buffer = root.listBuffers()[0];
const mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0], material = prim.getMaterial();
const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
const idx = prim.getIndices().getArray(), n = pos.getCount();
// Parts: triangles joined through shared corners (by position).
const keyId = new Map(), vk = new Int32Array(n);
for (let i = 0; i < n; i++) { const k = pos.getElement(i, []).map(v => v.toFixed(6)).join(','); if (!keyId.has(k)) keyId.set(k, keyId.size); vk[i] = keyId.get(k); }
const parent = Array.from({ length: keyId.size }, (_, i) => i);
const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
for (let t = 0; t < idx.length; t += 3) { const a = find(vk[idx[t]]); parent[find(vk[idx[t + 1]])] = a; parent[find(vk[idx[t + 2]])] = a; }
const parts = new Map();
for (let t = 0; t < idx.length; t += 3) { const r = find(vk[idx[t]]); if (!parts.has(r)) parts.set(r, []); parts.get(r).push(t); }
const bounds = tris => { const min = [9, 9, 9], max = [-9, -9, -9]; for (const t of tris) for (let k = 0; k < 3; k++) { const p = pos.getElement(idx[t + k], []); for (let d = 0; d < 3; d++) { min[d] = Math.min(min[d], p[d]); max[d] = Math.max(max[d], p[d]); } } return { min, max }; };
// Wings: the four thin parts high on the back, behind the head (z < 0.001).
// Parts that move: the four wings (thin, high on the back), the two antennae (high, in front of
// the head) and the two forelegs (the pair furthest forward, for grooming). The rest is the body.
const groups = { body: [] }, wings = [], movers = [];
const sideOf = b => (b.min[0] + b.max[0]) > 0 ? 'L' : 'R';
const legs = [];
for (const tris of parts.values()) {
  const b = bounds(tris), side = sideOf(b), w = b.max[0] - b.min[0];
  if (b.min[1] > .008 && b.max[2] < .001) {
    // Hinge: the wing's inner, lower, front corner (where it meets the thorax).
    // Hinge: the wing's own root vertex, innermost and lowest (where it meets the thorax).
    let root = null, best = Infinity;
    for (const t of tris) for (let k = 0; k < 3; k++) { const p = pos.getElement(idx[t + k], []); const score = Math.abs(p[0]) + (p[1] - b.min[1]) * .7; if (score < best) { best = score; root = p; } }
    wings.push({ tris, b, name: `wing_${b.max[1] > .014 ? 'fore' : 'hind'}_${side}`, hinge: root });
  } else if (b.min[1] > .0085 && b.min[2] > .003 && tris.length < 300) {
    // Antenna: from its base (lowest, rearmost point) by the head.
    movers.push({ tris, b, name: `antenna_${side}`, hinge: [side === 'L' ? b.min[0] : b.max[0], b.min[1], b.min[2]] });
  } else if (tris.length < 300 && w < .002 && b.max[1] < .0075) legs.push({ tris, b, side });
  else groups.body.push(...tris);
}
if (wings.length !== 4) throw new Error('expected 4 wings, found ' + wings.length);
// Forelegs: the leg on each side furthest forward; hinged at the top (the hip).
for (const side of ['L', 'R']) {
  const mine = legs.filter(l => l.side === side).sort((a, b) => b.b.max[2] - a.b.max[2]);
  mine.forEach((l, i) => {
    if (i === 0) movers.push({ tris: l.tris, b: l.b, name: `foreleg_${side}`, hinge: [(l.b.min[0] + l.b.max[0]) / 2, l.b.max[1], (l.b.min[2] + l.b.max[2]) / 2] });
    else groups.body.push(...l.tris);
  });
}
wings.push(...movers);
let shift = [0, 0, 0];
// Level the body: the model hovers with its abdomen hanging down; tip it forward so the
// abdomen and head are level, as for a bee standing on a leaf. Then put the origin on the
// ground between the feet (lowest point at y = 0, centred in x and z on the legs).
const LEVEL = .45, cl = Math.cos(LEVEL), sl = Math.sin(LEVEL);
const rx = ([x, y, z]) => [x, y * cl - z * sl, y * sl + z * cl];
for (let i = 0; i < n; i++) { pos.setElement(i, rx(pos.getElement(i, []))); nor.setElement(i, rx(nor.getElement(i, []))); }
{
  let minY = Infinity; for (let i = 0; i < n; i++) minY = Math.min(minY, pos.getElement(i, [])[1]);
  // Feet: the vertices within 1.5 mm of the lowest point.
  let fz = 0, count = 0; for (let i = 0; i < n; i++) { const p = pos.getElement(i, []); if (p[1] < minY + .0015) { fz += p[2]; count++; } }
  shift = [0, -minY, -fz / count];
  for (let i = 0; i < n; i++) { const p = pos.getElement(i, []); pos.setElement(i, [p[0] + shift[0], p[1] + shift[1], p[2] + shift[2]]); }
  console.log('levelled; feet centre z', (fz / count * 1000).toFixed(1), 'mm');
}
for (const w of wings) { const h = rx(w.hinge); w.hinge = [h[0] + shift[0], h[1] + shift[1], h[2] + shift[2]]; }

/** A wing at rest: folded back over the abdomen, lying nearly flat, a little apart from its
 * partner (hind wings a bit wider). Returned as the quaternion that turns the wing from the
 * model's flying pose (as made) into that rest pose, about its hinge. */
function restTurn(name, P) {
  const side = name.endsWith('_L') ? 1 : -1, hind = name.includes('hind');
  const v = []; for (let i = 0; i < P.length; i += 3) v.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2]));
  const tip = v.reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a).clone().normalize();
  // The wing's plane: the mean of its edge cross products (it is nearly flat).
  const normal = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 1; i + 1 < v.length; i += 2) { e1.subVectors(v[i], v[0]); e2.subVectors(v[i + 1], v[0]); const c = e1.clone().cross(e2); if (normal.lengthSq() && c.dot(normal) < 0) c.negate(); normal.add(c); }
  normal.addScaledVector(tip, -normal.dot(tip)).normalize();
  const want = new THREE.Vector3(side * (hind ? .26 : .16), hind ? .16 : .2, -1).normalize();
  const up = new THREE.Vector3(0, 1, 0); const wantN = up.clone().addScaledVector(want, -up.dot(want)).normalize();
  if (normal.y < 0) normal.negate();
  const from = new THREE.Matrix4().makeBasis(tip, normal.clone().cross(tip), normal);
  const to = new THREE.Matrix4().makeBasis(want, wantN.clone().cross(want), wantN);
  const q = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
  return [q.x, q.y, q.z, q.w];
}
const scene = root.listScenes()[0];
for (const node of root.listNodes()) node.dispose();
const build = (name, tris, offset = [0, 0, 0]) => {
  const map = new Map(), P = [], N = [], U = [], I = [];
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const v = idx[t + k];
    if (!map.has(v)) { map.set(v, map.size); const p = pos.getElement(v, []); P.push(p[0] - offset[0], p[1] - offset[1], p[2] - offset[2]); N.push(...nor.getElement(v, [])); U.push(...uv.getElement(v, [])); }
    I.push(map.get(v));
  }
  const acc = (arr, type, Ctor = Float32Array) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buffer);
  const p = doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3')).setAttribute('TEXCOORD_0', acc(U, 'VEC2'))
    .setIndices(acc(I, 'SCALAR', Uint16Array));
  // A pivot node at the hinge (the one to turn), holding the mesh in a child node (which
  // quantization is free to rescale and move).
  const pivot = doc.createNode(name).setTranslation(offset);
  pivot.addChild(doc.createNode(name + '_mesh').setMesh(doc.createMesh(name).addPrimitive(p)));
  if (name.startsWith('wing_')) pivot.setExtras({ rest: restTurn(name, P) });
  if (name === 'body') {
    // Her mouth: low on the front of the face (the lowest point of the front 2 mm of the head).
    let maxZ = -Infinity; for (let i = 2; i < P.length; i += 3) maxZ = Math.max(maxZ, P[i]);
    let mouth = null; for (let i = 0; i < P.length; i += 3) if (P[i + 2] > maxZ - .002 && Math.abs(P[i]) < .0015 && (!mouth || P[i + 1] < mouth[1])) mouth = [0, P[i + 1], P[i + 2]];
    pivot.setExtras({ mouth });
    console.log('mouth', mouth.map(v => (v * 1000).toFixed(1)).join(','));
  }
  scene.addChild(pivot);
};
build('body', groups.body);
for (const w of wings) build(w.name, w.tris, w.hinge);
mesh.dispose();
// Material: colour only. The normal and roughness maps add little at a bee's size on screen.
material.setNormalTexture(null).setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(.75);
await doc.transform(weld(), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }), quantize());
await io.write(output, doc);
console.log('wrote', output, wings.map(w => w.name + ' ' + w.tris.length + ' hinge ' + w.hinge.map(v => (v * 1000).toFixed(1)).join(',')).join(' | '));
