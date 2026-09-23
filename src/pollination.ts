import * as THREE from 'three';
import type { Flower } from './types';
import { surfaceHeight } from './wind';

/** Three reusable, flower-local effects. Pollen travels from the bee to the
 * receiving blossom; the celebration stays attached while the stem sways. */
export function createPollinationFX(scene: THREE.Scene) {
  const grainCount = 32;
  const ringGeometry = new THREE.RingGeometry(.97, 1, 64); ringGeometry.rotateX(-Math.PI / 2);
  const grainMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity: { value: 1 } },
    vertexShader: 'void main(){ vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(8./max(.25,-p.z),3.,15.); }',
    fragmentShader: 'uniform float opacity; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(1.,.78,.23,opacity*(1.-smoothstep(.1,.5,d))); }',
  });
  const slots = Array.from({ length: 3 }, () => {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const positions = new Float32Array(grainCount * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = grainMaterial.clone(), grains = new THREE.Points(geometry, material);
    grains.frustumCulled = false; group.add(grains);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffe9a6', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); group.add(ring);
    return { group, positions, geometry, material, grains, ring, ringMaterial, flower: null as Flower | null, origin: new THREE.Vector3(), age: 0 };
  });
  grainMaterial.dispose();
  const inverse = new THREE.Quaternion();
  let cursor = 0;
  return {
    emit(flower: Flower, beePosition: THREE.Vector3) {
      const slot = slots[cursor++ % slots.length]; slot.flower = flower; slot.age = 0;
      slot.origin.copy(beePosition).sub(flower.center).applyQuaternion(inverse.copy(flower.rotation).invert());
    },
    update(dt: number, enabled: boolean, reducedMotion: boolean) {
      for (const slot of slots) {
        const f = slot.flower;
        if (!f) { slot.group.visible = false; continue; }
        slot.age += dt;
        if (slot.age >= 2.6) { slot.flower = null; slot.group.visible = false; continue; }
        slot.group.visible = enabled;
        slot.group.position.copy(f.center); slot.group.quaternion.copy(f.rotation);
        const t = Math.min(1, slot.age / 1.15), ease = t * t * (3 - 2 * t);
        slot.grains.visible = !reducedMotion && t < 1;
        for (let i = 0; i < grainCount && slot.grains.visible; i++) {
          const angle = i * 2.399963, spread = .09 + (i % 5) * .024;
          const x = Math.cos(angle) * spread, z = Math.sin(angle) * spread;
          slot.positions[i * 3] = THREE.MathUtils.lerp(slot.origin.x + x, x * .6, ease);
          slot.positions[i * 3 + 1] = THREE.MathUtils.lerp(slot.origin.y + .04, .23, ease) + Math.sin(t * Math.PI) * (.12 + (i % 4) * .025);
          slot.positions[i * 3 + 2] = THREE.MathUtils.lerp(slot.origin.z + z, z * .6, ease);
        }
        slot.geometry.attributes.position.needsUpdate = true;
        slot.material.uniforms.opacity.value = Math.sin(t * Math.PI) * .95;
        const radius = f.radius * (reducedMotion ? .7 : .32 + Math.min(1, slot.age / 2.2) * .59);
        slot.ring.scale.setScalar(radius);
        slot.ring.position.y = Math.max(.19, surfaceHeight(f.species, radius, 0, f.radius) + .045);
        slot.ringMaterial.opacity = Math.sin(Math.min(1, slot.age / 2.6) * Math.PI) * .65;
      }
    },
    reset() { for (const slot of slots) { slot.flower = null; slot.group.visible = false; } cursor = 0; },
    dispose() {
      for (const slot of slots) { slot.group.removeFromParent(); slot.geometry.dispose(); slot.material.dispose(); slot.ringMaterial.dispose(); }
      ringGeometry.dispose();
    },
  };
}
