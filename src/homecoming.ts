import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Flower, ViewState } from './types';
import { createButterflyMeshes } from './butterflies';

const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);
export const ENDING_DURATION = 11.8;
export const QUIET_ENDING_DURATION = 3.6;

/** One authored camera path and a tiny decorative population in the real meadow. */
export function createHomecoming(scene: THREE.Scene, flowers: Flower[], home: THREE.Vector3) {
  const root = new THREE.Group(); root.name = 'homecoming'; root.visible = false; scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const keep = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const mat = (color: string) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .9 }); materials.add(m); return m; };
  const straw = mat('#bda16b'), binding = mat('#d1b989'), wood = mat('#705240'), dark = mat('#30251f');
  const hive = new THREE.Group(); hive.position.set(home.x, home.y - 1, home.z + 1.14); root.add(hive);
  const profile = [[0, 0], [1.06, 0], [1.27, .13], [1.29, .38], [1.23, .72], [1.10, 1.1], [.87, 1.5], [.57, 1.83], [.26, 2.02], [0, 2.07]].map(([x,y]) => new THREE.Vector2(x,y));
  const shell = new THREE.Mesh(keep(new THREE.LatheGeometry(profile, 32)), straw); shell.receiveShadow = true; hive.add(shell);
  const seam = keep(new THREE.TorusGeometry(1, .036, 4, 32).rotateX(Math.PI / 2));
  for (let i = 0; i < 12; i++) {
    const y = .08 + i * .16;
    const upper = profile.findIndex(p => p.y > y), lower = profile[upper - 1];
    const radius = THREE.MathUtils.lerp(lower.x, profile[upper].x, (y - lower.y) / (profile[upper].y - lower.y));
    const ring = new THREE.Mesh(seam, i % 3 === 0 ? binding : straw);
    ring.position.y = y; ring.scale.set(radius, 1, radius); hive.add(ring);
  }
  const opening = new THREE.Mesh(keep(new THREE.CircleGeometry(.32, 24)), dark);
  opening.position.set(0, 1, -1.34); opening.rotation.y = Math.PI; opening.scale.set(1, 1.18, 1); hive.add(opening);
  const trim = new THREE.Mesh(keep(new THREE.TorusGeometry(.34, .04, 6, 24)), binding);
  trim.position.copy(opening.position); trim.position.z -= .018; trim.scale.set(1, 1.18, 1); hive.add(trim);
  const porch = new THREE.Mesh(keep(new THREE.BoxGeometry(.92, .10, .85)), wood);
  porch.position.set(0, .60, -1.415); hive.add(porch);
  const stump = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.15, 1.4, home.y - 1, 14)), wood);
  stump.position.y = -(home.y - 1) / 2; hive.add(stump);
  const bark = keep(new THREE.CylinderGeometry(.025, .042, home.y - 1, 3));
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, groove = new THREE.Mesh(bark, i % 2 ? dark : binding);
    groove.position.set(Math.cos(a) * 1.2, stump.position.y, Math.sin(a) * 1.2); hive.add(groove);
  }
  // Bodies share one colored geometry; both fluttering wings share a second draw.
  const paint = (g: THREE.BufferGeometry, color: string) => {
    const c = new THREE.Color(color), values = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) values.set([c.r,c.g,c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(values, 3)); return g;
  };
  const bodyParts = [paint(new THREE.SphereGeometry(1, 8, 6).scale(.12,.095,.20), '#d6a647'), paint(new THREE.SphereGeometry(1, 6, 4).scale(.08,.08,.08).translate(0,.015,-.20), '#493326')];
  for (const z of [-.055,.055]) bodyParts.push(paint(new THREE.TorusGeometry(.099, .024, 4, 8).translate(0,0,z), '#59422c'));
  const bodyGeo = keep(mergeGeometries(bodyParts)!); bodyParts.forEach(g => g.dispose());
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86 }); materials.add(bodyMat);
  const count = 36, bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count + 1); bodies.name = 'meadow workers'; root.add(bodies);
  const wingGeo = keep(new THREE.SphereGeometry(1, 6, 4).scale(.15,.009,.075));
  const wingMat = mat('#e6e4c6');
  const wings = new THREE.InstancedMesh(wingGeo, wingMat, (count + 1) * 2); wings.name = 'worker wings'; root.add(wings);
  for (const mesh of [bodies,wings]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The same batch also carries two workers at the hive during the approach.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,5,10), 58);
  }
  const dummy = new THREE.Object3D(), workerPosition = new THREE.Vector3(), destination = new THREE.Vector3();
  const start = new THREE.Vector3(), startRotation = new THREE.Quaternion(), look = new THREE.Vector3();
  const wide = new THREE.Vector3(15, 12, 19), wideLook = new THREE.Vector3(-1, 3, -7);
  const flightStart = home.clone().add(new THREE.Vector3(5, 2.2, -14)), flightMiddle = home.clone().add(new THREE.Vector3(2.5, 1.8, -6));
  const flightEnd = home.clone().add(new THREE.Vector3(0, .9, -2.5));
  const lookRotation = new THREE.Quaternion(), wingOffset = new THREE.Vector3();
  let stage: ViewState['endingStage'] = 'none', fade = 0, firstPerson = false, active = false;
  let visibleWorkers = 0, perchedBee = false;
  let hiveVisitors = 0, hiveLanded = 0;
  // Butterflies share the overhead views: drawn larger than life, like the
  // bees, and only on the nectar flowers (daisies and cornflowers).
  const butterflyCount = 8, flutter = createButterflyMeshes(butterflyCount, 2.2);
  root.add(flutter.wings, flutter.bodies);
  for (let j = 0; j < butterflyCount; j++) flutter.setKind(j, j);
  const nectarFlowers = flowers.filter(f => f.species !== 'poppy');
  const flutterPosition = new THREE.Vector3(), flutterHeading = new THREE.Vector3(), flutterLook = new THREE.Matrix4(), flutterRotation = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3();
  let visibleButterflies = 0;
  function animateButterflies(time: number, reduced: boolean, shown: boolean) {
    visibleButterflies = shown && nectarFlowers.length ? butterflyCount : 0;
    for (let j = 0; j < visibleButterflies; j++) {
      // Sit a while on one flower, then flutter on to the next.
      const cycle = (reduced ? 0 : time * (.045 + j * .004)) + j * .37, leg = Math.floor(cycle), phase = cycle - leg;
      const from = nectarFlowers[(j * 5 + leg * 3) % nectarFlowers.length], to = nectarFlowers[(j * 5 + (leg + 1) * 3) % nectarFlowers.length];
      const travel = smooth((phase - .45) / .55), air = Math.sin(travel * Math.PI);
      flutterPosition.copy(from.center).lerp(to.center, travel);
      flutterPosition.y += .25 + air * (1.2 + (j % 3) * .5) + (reduced ? 0 : Math.sin(time * 5 + j) * .15 * air);
      if (!reduced) { flutterPosition.x += Math.sin(time * 2.1 + j * 1.7) * .4 * air; flutterPosition.z += Math.cos(time * 1.7 + j) * .3 * air; }
      flutterHeading.subVectors(to.center, from.center).setY(0);
      if (flutterHeading.lengthSq() < 1e-6) flutterHeading.set(0, 0, 1);
      flutterLook.lookAt(flutterHeading.normalize().negate(), ORIGIN, UP); flutterRotation.setFromRotationMatrix(flutterLook);
      const open = reduced ? 1 : air < .05 ? 1.3 - Math.max(0, Math.sin(time * .5 + j)) ** 3 * 1.1 : .2 + (.5 + .5 * Math.sin(time * 30 + j));
      flutter.pose(j, flutterPosition, flutterRotation, open);
    }
    flutter.commit(visibleButterflies);
  }
  const visitorPositions = [new THREE.Vector3(), new THREE.Vector3()];
  function animateWorkers(time: number, reduced: boolean, perch?: THREE.Vector3, sunny = true, hiveAge?: number) {
    const workers = sunny ? count : 0, offset = perch ? 1 : 0;
    bodies.count = workers + offset; wings.count = bodies.count * 2;
    visibleWorkers = workers; perchedBee = !!perch;
    animateButterflies(time, reduced, sunny);
    hiveVisitors = hiveAge === undefined ? 0 : 2; hiveLanded = 0;
    if (perch) {
      dummy.position.copy(perch); dummy.position.y -= .30;
      dummy.rotation.set(0, .3, 0); dummy.scale.setScalar(.85); dummy.updateMatrix();
      bodies.setMatrixAt(0, dummy.matrix);
      for (let side = -1; side <= 1; side += 2) {
        dummy.position.copy(perch); dummy.position.x += side * .08; dummy.position.y -= .24; dummy.position.z += .01;
        dummy.rotation.set(0, .3 + side * .25, side * .12); dummy.updateMatrix();
        wings.setMatrixAt((side + 1) / 2, dummy.matrix);
      }
    }
      for (let i = 0; i < workers; i++) {
        const cycle = (reduced ? 0 : time * (.075 + (i % 5) * .003)) + i * .61803399;
        const reverse = Math.floor(cycle) % 2 !== 0;
        const from = flowers[(i * 7 + (reverse ? 11 : 0)) % flowers.length], to = flowers[(i * 7 + (reverse ? 0 : 11)) % flowers.length];
        const phase = cycle % 1;
        const travel = smooth((phase - .18) / .82);
        workerPosition.copy(from.center).lerp(to.center, travel); workerPosition.y += .35 + Math.sin(travel * Math.PI) * (1.3 + i % 3 * .4);
        destination.subVectors(to.center, from.center);
        let yaw = Math.atan2(-destination.x, -destination.z), scale = .68 + (i % 4) * .1;
        let flap = reduced || phase < .18 ? .3 : Math.sin(time * 65 + i) * .8;
        if (hiveAge !== undefined && i >= count - 2) {
          // Reassign two existing instances. No extra meshes, materials, draws,
          // physics or pathfinding; this is a small decorative figure-eight.
          const visitor = i - (count - 2), side = visitor ? 1 : -1;
          const arrivalAge = Math.max(0, hiveAge - 6.0 - visitor * .45);
          const arrival = reduced ? 1 : smooth(arrivalAge / 1.25);
          const dance = reduced ? 0 : Math.max(0, arrivalAge - 1.25) * 3.2;
          destination.set(home.x + side * .23 + Math.sin(dance) * .085, home.y - .275, home.z - .45 + Math.sin(dance * 2) * .04);
          workerPosition.set(home.x + side * 2.1, home.y + 1.1 + visitor * .3, home.z - 3.4 - visitor * .5);
          yaw = Math.atan2(workerPosition.x - destination.x, workerPosition.z - destination.z);
          workerPosition.lerp(destination, arrival); workerPosition.y += Math.sin(arrival * Math.PI) * .3;
          const waggle = reduced ? 0 : Math.sin(dance * 10) * .2 * (1 - smooth(Math.abs(Math.sin(dance)) / .45));
          const danceYaw = Math.atan2(-Math.cos(dance) * .085, -Math.cos(dance * 2) * .08) + waggle;
          yaw += Math.atan2(Math.sin(danceYaw - yaw), Math.cos(danceYaw - yaw)) * smooth((arrival - .7) / .3);
          scale = .65;
          flap = reduced || arrival >= 1 ? .12 : Math.sin(time * 65 + i) * .8;
          if (arrival >= 1) hiveLanded++;
          visitorPositions[visitor].copy(workerPosition);
        }
        dummy.position.copy(workerPosition); dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(scale); dummy.updateMatrix(); bodies.setMatrixAt(i + offset, dummy.matrix);
        for (let side = -1; side <= 1; side += 2) {
          wingOffset.set(side * .13, .06, -.035).applyQuaternion(dummy.quaternion).add(workerPosition);
          const bodyYaw = dummy.rotation.y;
          dummy.position.copy(wingOffset); dummy.rotation.z = side * (.24 + flap); dummy.updateMatrix(); wings.setMatrixAt((i + offset)*2 + (side + 1)/2, dummy.matrix);
          dummy.position.copy(workerPosition); dummy.rotation.set(0,bodyYaw,0);
        }
      }
      bodies.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
  }
  return {
    begin(camera: THREE.PerspectiveCamera) { start.copy(camera.position); startRotation.copy(camera.quaternion); active = true; },
    reset() { active = false; root.visible = false; visibleWorkers = 0; visibleButterflies = 0; hiveVisitors = 0; hiveLanded = 0; perchedBee = false; stage = 'none'; fade = 0; firstPerson = false; },
    pose(age: number, time: number, reduced: boolean, camera: THREE.PerspectiveCamera) {
      root.visible = active; hive.visible = true; if (!active) return;
      const switchAt = reduced ? 1.65 : 5.65, dissolve = reduced ? .30 : .45;
      firstPerson = age >= switchAt;
      stage = age >= (reduced ? 3 : 10.25) ? 'fade' : firstPerson ? 'home' : 'meadow';
      fade = Math.max(1 - smooth(Math.abs(age - switchAt) / dissolve), smooth((age - (reduced ? 3 : 10.25)) / (reduced ? .6 : 1.55)));
      if (!firstPerson) {
        const t = reduced ? 1 : smooth(age / 4.8);
        camera.position.lerpVectors(start, wide, t);
        // The initial gaze is retained, then gently turns toward the flower field.
        camera.lookAt(wideLook); lookRotation.copy(camera.quaternion); camera.quaternion.slerpQuaternions(startRotation, lookRotation, t);
      } else if (reduced) {
        camera.position.copy(home).add(new THREE.Vector3(2, 1.2, -4.5)); camera.lookAt(home);
      } else {
        // Settle just outside the entrance for a brief view of the greeting bees.
        const t = smooth((age - switchAt) / (9.4 - switchAt)), u = 1 - t;
        camera.position.copy(flightStart).multiplyScalar(u*u).addScaledVector(flightMiddle, 2*u*t).addScaledVector(flightEnd,t*t);
        look.copy(home); look.y += .08 * (1-t); camera.lookAt(look);
      }
      camera.fov = firstPerson ? 61 : 66; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      animateWorkers(time, reduced, undefined, true, firstPerson ? age : undefined);
    },
    scenery(time: number, reduced: boolean, visible: boolean, sunny: boolean, perch?: THREE.Vector3) {
      root.visible = visible; hive.visible = false;
      if (visible) animateWorkers(time, reduced, perch, sunny);
      else { visibleWorkers = 0; visibleButterflies = 0; hiveVisitors = 0; hiveLanded = 0; perchedBee = false; }
    },
    get stage() { return stage; }, get fade() { return fade; }, get firstPerson() { return firstPerson; },
    diagnostics() { return { stage, fade, firstPerson, workers: root.visible ? visibleWorkers : 0, butterflies: root.visible ? visibleButterflies : 0, perchedBee: root.visible && perchedBee, hiveVisitors: root.visible ? hiveVisitors : 0, hiveLanded: root.visible ? hiveLanded : 0, visitorPositions: root.visible && hiveVisitors ? visitorPositions.map(p => p.toArray()) : [], workerDraws: 2, active }; },
    dispose() { root.removeFromParent(); bodies.dispose(); wings.dispose(); flutter.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
