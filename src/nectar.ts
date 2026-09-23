import * as THREE from 'three';

/** One small liquid surface, kept in the moving flower's frame. */
export function createNectarDrop(scene: THREE.Scene) {
  const geometry = new THREE.SphereGeometry(1, 32, 20);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  positions.setUsage(THREE.DynamicDrawUsage);
  const rest = new Float32Array(positions.array);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  const material = new THREE.MeshPhysicalMaterial({ color: '#e9b53e', roughness: .18, metalness: .05, clearcoat: 1, clearcoatRoughness: .12, emissive: '#b57516', emissiveIntensity: .12 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'nectar droplet'; scene.add(mesh);
  const localTip = new THREE.Vector3(), localApproach = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 1, 0);
  const clip = {
    uNectarInverse: { value: new THREE.Matrix4() },
    uNectarVisible: { value: 0 },
    uNectarNormal: { value: normal },
    uNectarPressure: { value: 0 },
    uNectarAge: { value: 10 },
    uNectarRipple: { value: 0 },
  };
  let pressure = 0, touching = false, age = 10, contactCount = 0, flowerId = -1;
  let tipRadius = Infinity, changed = false;
  return {
    clipTongue(material: THREE.MeshStandardMaterial) {
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, clip);
        shader.vertexShader = `varying vec3 vNectarWorld;\n${shader.vertexShader}`.replace('#include <project_vertex>', '#include <project_vertex>\nvNectarWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = `varying vec3 vNectarWorld;
          uniform mat4 uNectarInverse; uniform float uNectarVisible;
          uniform vec3 uNectarNormal; uniform float uNectarPressure;
          uniform float uNectarAge; uniform float uNectarRipple;
          ${shader.fragmentShader}`.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 nectarLocal = (uNectarInverse * vec4(vNectarWorld, 1.0)).xyz;
          float nectarRadius = length(nectarLocal);
          float r2 = max(0.0, 2.0 * (1.0 - dot(nectarLocal / max(nectarRadius, 0.0001), uNectarNormal)));
          float surfaceRadius = 1.0 - .30 * uNectarPressure * exp(-r2 / .11)
            + .065 * uNectarRipple * sin(sqrt(r2) * 15.0 - uNectarAge * 23.0) * exp(-r2 * 2.4);
          if (uNectarVisible > .5 && nectarRadius < surfaceRadius) discard;`);
      };
      material.customProgramCacheKey = () => 'tongue-in-nectar-v1';
    },
    pose(id: number, center: THREE.Vector3, rotation: THREE.Quaternion, time: number, visible: boolean, uv: boolean) {
      if (id !== flowerId) { flowerId = id; pressure = 0; touching = false; age = 10; changed = true; }
      mesh.visible = visible;
      mesh.position.copy(center); mesh.quaternion.copy(rotation);
      const radius = .046 * (.85 + Math.sin(time * 3) * .08);
      mesh.scale.set(radius, radius * .5, radius);
      material.emissiveIntensity = uv ? .45 : .12;
      mesh.updateMatrixWorld(true);
      clip.uNectarInverse.value.copy(mesh.matrixWorld).invert();
      clip.uNectarVisible.value = Number(visible);
    },
    update(dt: number, tip: THREE.Vector3, approach: THREE.Vector3, sipping: boolean, reducedMotion: boolean) {
      mesh.worldToLocal(localTip.copy(tip));
      tipRadius = localTip.length();
      const contact = mesh.visible && sipping && tipRadius <= 1;
      if (contact !== touching) {
        if (contact) {
          contactCount++;
          mesh.worldToLocal(localApproach.copy(approach));
          normal.copy(localApproach).normalize();
          if (normal.lengthSq() < .1) normal.set(0, 1, 0);
        }
        age = 0; touching = contact; changed = true;
      }
      if (contact && dt > 0) {
        mesh.worldToLocal(localApproach.copy(approach)).normalize();
        if (normal.distanceToSquared(localApproach) > .000001) {
          normal.lerp(localApproach, reducedMotion ? 1 : 1 - Math.exp(-18 * dt)).normalize();
          changed = true;
        }
      }
      age += dt;
      const previous = pressure;
      pressure = reducedMotion ? Number(contact) : THREE.MathUtils.damp(pressure, Number(contact), 14, dt);
      if (!contact && pressure < .0001) pressure = 0;
      const ripple = reducedMotion ? 0 : Math.exp(-age * 5);
      clip.uNectarPressure.value = pressure; clip.uNectarAge.value = age; clip.uNectarRipple.value = ripple;
      if (changed || Math.abs(previous - pressure) > .00001 || ripple > .001) {
        // A local depression and damped surface wave, not an outline or HUD ring.
        for (let i = 0; i < positions.count; i++) {
          const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
          const r2 = Math.max(0, 2 * (1 - (x * normal.x + y * normal.y + z * normal.z)));
          const dip = .30 * pressure * Math.exp(-r2 / .11);
          const wave = .065 * ripple * Math.sin(Math.sqrt(r2) * 15 - age * 23) * Math.exp(-r2 * 2.4);
          const radius = 1 - dip + wave;
          positions.setXYZ(i, x * radius, y * radius, z * radius);
        }
        positions.needsUpdate = true; geometry.computeVertexNormals(); changed = false;
      }
      return contact;
    },
    diagnostics() { return { visible: mesh.visible, touching, pressure, tipRadius, contactCount, flowerId }; },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
