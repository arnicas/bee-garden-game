import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng } from './world';
import type { FlowerSpot } from './meadow-plan';

/**
 * Dry stalks where last summer's poppies and cornflowers stood unpollinated and nothing
 * grew back: last year's dead stems, straw-coloured, leaning and some snapped, with a
 * shrivelled head that set no seed. They show what the gaps in the meadow are, and they
 * stay the whole summer. Scenery only. Two instanced draws (stems and heads).
 */
const MAX_STALKS = 48;

export function createDryStalks(scene: THREE.Scene) {
  // A thin, tapered stem one unit tall with a slight bend; scaled per stalk.
  const stem = new THREE.CylinderGeometry(.02, .034, 1, 6, 6).translate(0, .5, 0);
  const p = stem.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + y * y * .09); }
  stem.computeVertexNormals();
  // A twig of a dead leaf part way up, so it reads as a plant and not a pole.
  const leaf = new THREE.CylinderGeometry(.007, .013, .3, 4).translate(0, .11, 0).rotateZ(-.9).translate(.004, .32, 0);
  const stemGeometry = mergeGeometries([stem, leaf])!;
  stem.dispose(); leaf.dispose();
  // The withered head: a small, puckered, drooping knob.
  const headGeometry = new THREE.SphereGeometry(1, 8, 6).scale(.075, .055, .075);
  const hp = headGeometry.attributes.position;
  for (let i = 0; i < hp.count; i++) { const a = Math.atan2(hp.getZ(i), hp.getX(i)); const k = 1 + Math.sin(a * 5) * .18; hp.setX(i, hp.getX(i) * k); hp.setZ(i, hp.getZ(i) * k); }
  headGeometry.computeVertexNormals();
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#c2ab78', roughness: 1 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: '#5f4b37', roughness: 1 });
  const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, MAX_STALKS); stems.name = 'dry stalks';
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, MAX_STALKS); heads.name = 'dry stalk heads';
  for (const mesh of [stems, heads]) { mesh.count = 0; mesh.castShadow = true; scene.add(mesh); }
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), at = new THREE.Vector3(), scale = new THREE.Vector3(), top = new THREE.Vector3();
  const positions: THREE.Vector3[] = [];

  return {
    /** Stands a dead stalk at each gap (the unpollinated annuals that didn't come back). */
    set(gaps: readonly FlowerSpot[], seed = 1): void {
      const random = rng((seed ^ 0xd57a1c) >>> 0 || 5);
      const shown = gaps.slice(0, MAX_STALKS);
      positions.length = 0;
      shown.forEach((gap, i) => {
        const snapped = random() < .3;
        // Last year's stem stands a little shorter than a living one; a snapped one is half that.
        const height = gap.height * (snapped ? .32 + random() * .12 : .55 + random() * .2);
        at.set(gap.x + (random() - .5) * .3, meadowGroundHeight(gap.x, gap.z) - .02, gap.z + (random() - .5) * .3);
        e.set((random() - .5) * .35, random() * Math.PI * 2, (random() - .5) * .35 + (snapped ? .25 : 0));
        q.setFromEuler(e);
        matrix.compose(at, q, scale.set(1, height, 1)); stems.setMatrixAt(i, matrix);
        // The head at the top of the bend, drooping; a snapped stalk has lost it.
        top.set(.09, 1, 0).multiply(scale).applyQuaternion(q).add(at);
        matrix.compose(top, q, scale.setScalar(snapped ? 0 : .8 + random() * .4)); heads.setMatrixAt(i, matrix);
        positions.push(top.clone());
      });
      stems.count = heads.count = shown.length;
      stems.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
      stems.computeBoundingSphere(); heads.computeBoundingSphere();
    },
    diagnostics() { return { count: stems.count, tops: positions.map(p => p.toArray()) }; },
    dispose(): void {
      scene.remove(stems, heads);
      stemGeometry.dispose(); headGeometry.dispose(); stemMaterial.dispose(); headMaterial.dispose(); stems.dispose(); heads.dispose();
    },
  };
}
