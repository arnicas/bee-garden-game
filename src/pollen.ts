import * as THREE from 'three';
import { createSeededRandom } from './utils/random';

/** A bounded pool of pollen grains attracted from the anthers to the bee. */
export function createPollenFX(scene: THREE.Scene) {
  const count = 96, rng = createSeededRandom(113);
  const position = new Float32Array(count * 3), life = new Float32Array(count), offsets = new Float32Array(count * 3);
  const from = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { position[i * 3 + 1] = -100; life[i] = -1; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aLife; varying float vLife; void main(){ vLife=aLife; vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(6./max(.2,-p.z),2.,12.); }`,
    fragmentShader: `varying float vLife; void main(){float d=length(gl_PointCoord-.5); if(d>.5||vLife<0.) discard; gl_FragColor=vec4(1.,.77,.24,(1.-smoothstep(.15,.5,d))*sin(clamp(vLife,0.,1.)*3.14159)*.8);}`,
  });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; scene.add(points);
  let cursor = 0;
  return {
    emit(center: THREE.Vector3, radius: number) {
      const id = cursor++ % count, angle = rng() * Math.PI * 2;
      from[id * 3] = center.x + Math.cos(angle) * radius * .23;
      from[id * 3 + 1] = center.y + .13;
      from[id * 3 + 2] = center.z + Math.sin(angle) * radius * .23;
      offsets[id * 3] = (rng() - .5) * .16;
      offsets[id * 3 + 1] = (rng() - .5) * .10;
      offsets[id * 3 + 2] = (rng() - .5) * .16;
      life[id] = 0;
    },
    update(dt: number, target: THREE.Vector3) {
      for (let i = 0; i < count; i++) {
        if (life[i] < 0) continue;
        life[i] += dt * 1.4;
        if (life[i] >= 1) { life[i] = -1; position[i * 3 + 1] = -100; continue; }
        const t = life[i], ease = t * t;
        position[i * 3] = THREE.MathUtils.lerp(from[i * 3], target.x + offsets[i * 3], ease);
        position[i * 3 + 1] = THREE.MathUtils.lerp(from[i * 3 + 1], target.y + offsets[i * 3 + 1], ease) + Math.sin(t * Math.PI) * .12;
        position[i * 3 + 2] = THREE.MathUtils.lerp(from[i * 3 + 2], target.z + offsets[i * 3 + 2], ease);
      }
      geometry.getAttribute('position').needsUpdate = true; geometry.getAttribute('aLife').needsUpdate = true;
    },
    reset() { life.fill(-1); for (let i = 0; i < count; i++) position[i * 3 + 1] = -100; },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
