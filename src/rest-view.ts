import * as THREE from 'three';

export const QUIET_AFTER = 8;
export const SCENIC_AFTER = 22;

/** Camera presentation only. The bee remains attached to its real moving perch. */
export function createRestView() {
  const anchor = new THREE.Vector3(), destination = new THREE.Vector3(), look = new THREE.Vector3();
  const perchRotation = new THREE.Quaternion(), scenicRotation = new THREE.Quaternion();
  let blend = 0, age = 0, returning = false;
  const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);
  return {
    step(dt: number, requested: boolean, position: THREE.Vector3, reduced: boolean) {
      if (requested && blend === 0) { anchor.copy(position); age = 0; }
      returning = !requested && blend > 0;
      if (requested) age += dt;
      blend = THREE.MathUtils.clamp(blend + dt * (requested ? 1 / (reduced ? .8 : 6) : -1 / (reduced ? .5 : 1.15)), 0, 1);
    },
    pose(camera: THREE.PerspectiveCamera, reduced: boolean) {
      if (blend === 0) return;
      const amount = reduced ? (blend >= .5 ? 1 : 0) : smooth(blend);
      const angle = .65 + (reduced ? 0 : Math.max(0, age - 6) * .018);
      look.set(anchor.x * .35, 3, anchor.z * .35 - 3);
      destination.set(look.x + Math.sin(angle) * 17, Math.max(13, anchor.y + 7), look.z + Math.cos(angle) * 17);
      perchRotation.copy(camera.quaternion);
      camera.position.lerp(destination, amount);
      camera.lookAt(look); scenicRotation.copy(camera.quaternion);
      camera.quaternion.slerpQuaternions(perchRotation, scenicRotation, amount);
    },
    reset() { blend = 0; age = 0; returning = false; },
    get active() { return blend > 0; },
    get amount() { return smooth(blend); },
    fade(reduced: boolean) { return reduced && blend > 0 && blend < 1 ? 1 - Math.abs(blend * 2 - 1) : 0; },
    diagnostics() { return { blend, age, returning }; },
  };
}
