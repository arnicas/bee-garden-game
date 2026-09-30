import * as THREE from 'three';
import { meadowGroundHeight } from './world';
import type { PuddleSpot } from './types';

/**
 * Small pools on the ground: low spots in the meadow (little clearings in the
 * grass) fill in the rain, show ripples while it falls, and dry away in sun and
 * heat. The water reflects the sky at a glancing view, with a soft sun glint,
 * all in one cheap shader: one instanced draw, no reflection render.
 */
export function createPuddles(scene: THREE.Scene, spots: readonly PuddleSpot[]) {
  const n = Math.max(1, spots.length);
  const geometry = new THREE.CircleGeometry(1.35, 48).rotateX(-Math.PI / 2);
  const fillData = new Float32Array(n), seedData = new Float32Array(n);
  spots.forEach((_, i) => { seedData[i] = (i * 0.618034) % 1; });
  const fillAttribute = new THREE.InstancedBufferAttribute(fillData, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFill', fillAttribute);
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedData, 1));
  const material = new THREE.ShaderMaterial({
    name: 'puddle-water', transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uRain: { value: 0 },
      uSky: { value: new THREE.Color('#d4e4ec') }, uDeep: { value: new THREE.Color('#252c2a') },
      uSun: { value: new THREE.Vector3(.4, .8, .3).normalize() }, uSunStrength: { value: 1 },
    },
    vertexShader: `
      attribute float aFill; attribute float aSeed;
      varying vec2 vLocal; varying vec3 vWorld; varying float vFill; varying float vSeed;
      void main() {
        vLocal = position.xz; vFill = aFill; vSeed = aSeed;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uRain, uSunStrength;
      uniform vec3 uSky, uDeep, uSun;
      varying vec2 vLocal; varying vec3 vWorld; varying float vFill; varying float vSeed;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(vec2 x) {
        vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0;
        return mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
      }
      void main() {
        float angle = atan(vLocal.y, vLocal.x), r = length(vLocal);
        // A ragged, puddle-shaped shoreline.
        float shore = 0.82 + 0.09 * sin(angle * 3.0 + vSeed * 6.3) + 0.05 * sin(angle * 7.0 + vSeed * 17.0) + 0.03 * sin(angle * 13.0 + vSeed * 29.0);
        float water = 1.0 - smoothstep(shore - 0.05, shore + 0.01, r);
        float soil = (1.0 - smoothstep(shore, 1.33, r)) * (1.0 - water);
        vec3 view = normalize(cameraPosition - vWorld);
        // The surface wrinkles a little in the breeze (and more in rain), so what it
        // mirrors breaks up and shifts as the bee moves: glints, not a flat colour.
        vec2 p = vWorld.xz * 9.0;
        float wrinkle = 0.09 + uRain * 0.08;
        vec3 normal = normalize(vec3(
          (sin(p.x * 1.3 + uTime * 1.7) + sin(p.y * 2.1 - uTime * 1.3 + p.x * .7) * .6) * wrinkle,
          1.0,
          (sin(p.y * 1.5 + uTime * 1.5) + sin(p.x * 1.9 + uTime * 1.1 - p.y * .5) * .6) * wrinkle));
        vec3 mirrored = reflect(-view, normal);
        // Fine glitter: much smaller ripples, catching the light in tiny points.
        vec2 g = vWorld.xz * 38.0;
        vec3 fine = normalize(vec3(sin(g.x + uTime * 2.3) * sin(g.y * 1.3 - uTime * 1.9) * .22, 1.0, cos(g.y + uTime * 2.1) * sin(g.x * 1.2 + uTime * 1.7) * .22));
        vec3 glitterDir = reflect(-view, normalize(normal + fine - vec3(0.0, 1.0, 0.0)));
        // A painted sky in the reflection: pale near the horizon, with soft cloud
        // streaks that slide across the water as the view changes.
        vec2 skyUv = mirrored.xz / (abs(mirrored.y) + .35) * 2.2 + normal.xz * 7.0 + vSeed * 5.0;
        float clouds = smoothstep(.4, .8, noise(skyUv) * .65 + noise(skyUv * 2.3 + 3.1) * .35);
        vec3 sky = mix(uSky * 1.12, uSky * .86, clamp(mirrored.y, 0.0, 1.0)) + vec3(.16, .16, .15) * clouds;
        // Low in the reflection: the dark wall of grass around the pool.
        sky = mix(vec3(.16, .21, .12), sky, smoothstep(.12, .42, mirrored.y + (noise(vec2(atan(mirrored.z, mirrored.x) * 6.0, vSeed * 9.0)) - .5) * .25));
        // Glancing views mirror the sky; looking straight down shows dark, muddy depth.
        float fresnel = 0.32 + 0.68 * pow(1.0 - max(view.y, 0.0), 3.0);
        vec3 colour = mix(uDeep, sky, fresnel);
        colour = mix(colour, uDeep * 0.8, smoothstep(shore - 0.2, shore, r) * 0.3);
        // Rings from falling drops while it rains.
        float rings = 0.0;
        for (int k = 0; k < 4; k++) {
          float fk = float(k), t = uTime * 1.1 + fk * 0.29 + vSeed * 3.7, cycle = floor(t), phase = fract(t);
          vec2 centre = (vec2(hash(cycle * 12.99 + fk * 4.1 + vSeed * 7.0), hash(cycle * 78.23 + fk * 2.3 + vSeed * 3.0)) - 0.5) * shore * 1.1;
          float d = length(vLocal - centre);
          rings += (1.0 - phase) * (1.0 - smoothstep(0.0, 0.035, abs(d - phase * 0.4)));
        }
        colour += vec3(0.9, 0.95, 1.0) * rings * uRain * 0.35;
        // Glints: the bright overhead sky catches the wrinkles even under cloud,
        // and the sun adds a sharper one when it's out.
        float skyGlint = pow(max(dot(mirrored, normalize(vec3(.25, 1.0, .15))), 0.0), 28.0);
        float sparkle = pow(max(dot(mirrored, normalize(vec3(-.3, .75, .4))), 0.0), 60.0);
        float glitter = pow(max(dot(glitterDir, normalize(vec3(.2, 1.0, .1))), 0.0), 140.0);
        colour += vec3(0.95, 0.97, 1.0) * (skyGlint * .3 + sparkle * .45 + glitter * 1.3);
        colour += vec3(1.0, 0.96, 0.85) * pow(max(dot(mirrored, uSun), 0.0), 90.0) * uSunStrength * 1.1;
        // A thin bright line where the water meets the shore, on the far side.
        colour += vec3(.9, .95, 1.0) * (1.0 - smoothstep(0.0, 0.03, abs(r - shore + 0.025))) * fresnel * .25;
        float alpha = water * 0.9 + soil * 0.32;
        if (alpha < 0.01) discard;
        // Wet, dark soil around the shore.
        colour = mix(vec3(0.27, 0.23, 0.16), colour, clamp(water * 1.2, 0.0, 1.0));
        gl_FragColor = vec4(colour, alpha * smoothstep(0.02, 0.12, vFill));
        #include <colorspace_fragment>
      }`,
  });
  // Glints seen from above: a small twinkling star over each pool with water,
  // so pools can be spotted while flying. Depth-tested, so petals and leaves hide
  // them and grass blades waving across the pool make them flicker.
  const glintPositions = new Float32Array(n * 3), glintWet = new Float32Array(n), glintSeed = new Float32Array(n);
  spots.forEach((spot, i) => { glintPositions.set([spot.x, meadowGroundHeight(spot.x, spot.z) + .06, spot.z], i * 3); glintSeed[i] = seedData[i]; });
  const glintGeometry = new THREE.BufferGeometry();
  glintGeometry.setAttribute('position', new THREE.BufferAttribute(glintPositions, 3));
  const glintWetAttribute = new THREE.BufferAttribute(glintWet, 1).setUsage(THREE.DynamicDrawUsage);
  glintGeometry.setAttribute('aWet', glintWetAttribute);
  glintGeometry.setAttribute('aSeed', new THREE.BufferAttribute(glintSeed, 1));
  const glintMaterial = new THREE.ShaderMaterial({
    name: 'puddle-glints', transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: 1 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float aWet; attribute float aSeed; uniform float uTime, uSun, uScale;
      varying float vAlpha;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        // Only from above: fades in once the bee is well over the grass, twinkling.
        float height = cameraPosition.y - position.y, distance = -view.z;
        float above = smoothstep(1.4, 3.0, height) * (1.0 - smoothstep(18.0, 30.0, distance));
        float twinkle = .55 + .45 * sin(uTime * (2.3 + aSeed * 1.7) + aSeed * 40.0);
        vAlpha = aWet * above * twinkle * (.6 + .4 * uSun);
        gl_PointSize = uScale * (24.0 + 18.0 * twinkle) * aWet * clamp(8.0 / distance, .7, 2.0);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float core = exp(-dot(p, p) * 45.0);
        float rays = exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 5.0) + exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 5.0);
        float a = (core * 1.2 + rays * .75 + exp(-dot(p, p) * 18.0) * .25) * vAlpha;
        if (a < .01) discard;
        gl_FragColor = vec4(vec3(1.0, .99, .94), min(1.0, a));
      }`,
  });
  const glints = new THREE.Points(glintGeometry, glintMaterial);
  glints.name = 'puddle glints'; glints.frustumCulled = false; glints.renderOrder = 3;
  scene.add(glints);
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  mesh.name = 'rain puddles'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.count = spots.length;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const fill = new Float32Array(spots.length);
  /** Groundwater: the level a pool holds without rain. Set each morning from the
   * ground's moisture (deeper pools more), it sinks through the heat of the day. */
  const spring = new Float32Array(spots.length);
  /** Ground moisture (0–1). In a dry summer only some pools hold water at all. */
  let moisture = .5;
  /** 0–1: how bare and patchy the meadow is. Pools in open ground dry faster. */
  let bare = 0;
  /** How many dry pool beds the ground shows (for diagnostics). */
  let shownHollows = 0;
  const canFill = (i: number) => seedData[i] < .35 + moisture * 1.3;
  const matrix = new THREE.Matrix4(), turn = new THREE.Quaternion(), at = new THREE.Vector3(), size = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const clear = new THREE.Color('#d4e4ec'), grey = new THREE.Color('#c3ccd0');
  /** How far the water reaches from the centre (the shader's shoreline is about 0.82 of the scale). */
  const reach = (i: number) => spots[i].radius * (.35 + .65 * fill[i]) * .8;
  function pose() {
    let visible = 0;
    spots.forEach((spot, i) => {
      const scale = fill[i] > .01 ? spot.radius * (.35 + .65 * fill[i]) : 0;
      at.set(spot.x, meadowGroundHeight(spot.x, spot.z) + .018, spot.z);
      turn.setFromAxisAngle(up, seedData[i] * 6.28);
      matrix.compose(at, turn, size.set(scale, 1, scale));
      mesh.setMatrixAt(i, matrix); fillData[i] = fill[i]; glintWet[i] = THREE.MathUtils.smoothstep(fill[i], .15, .5);
      if (scale > 0) visible++;
    });
    mesh.instanceMatrix.needsUpdate = true; fillAttribute.needsUpdate = true; glintWetAttribute.needsUpdate = true;
    mesh.visible = visible > 0;
  }
  pose();
  return {
    spots,
    /** Rain fills the pools; sun and heat dry them. */
    update(dt: number, time: number, rain: number, heat: number, cloudiness: number, enabled: boolean) {
      for (let i = 0; i < fill.length; i++) {
        const gain = enabled && canFill(i) ? rain * .07 * (.6 + moisture * .8) : 0, loss = rain > .02 && canFill(i) ? 0 : (.003 + heat * .02 + (1 - cloudiness) * .002) * (1.5 - moisture) * (1 + bare * .5);
        spring[i] = Math.max(0, spring[i] - dt * heat * .0012 * (1.5 - moisture) * (1 + bare));
        const before = fill[i];
        fill[i] = THREE.MathUtils.clamp(fill[i] + dt * (gain - loss), 0, 1);
        // Groundwater keeps a pool from drying below its spring, and slowly seeps back after sipping.
        if (before >= spring[i]) fill[i] = Math.max(fill[i], spring[i]);
        else fill[i] = Math.min(spring[i], Math.max(fill[i], before + dt * .004));
      }
      material.uniforms.uTime.value = time; material.uniforms.uRain.value = rain;
      glintMaterial.uniforms.uTime.value = time; glintMaterial.uniforms.uSun.value = THREE.MathUtils.clamp(1 - cloudiness, 0, 1);
      glintMaterial.uniforms.uScale.value = Math.min(2, window.devicePixelRatio || 1);
      material.uniforms.uSky.value.lerpColors(clear, grey, THREE.MathUtils.clamp(cloudiness, 0, 1));
      material.uniforms.uSunStrength.value = THREE.MathUtils.clamp(1 - cloudiness * 1.2, 0, 1);
      pose();
    },
    /** The nearest pool with water, and the point on it the bee can reach. */
    nearest(position: THREE.Vector3, point: THREE.Vector3): { index: number; distance: number } | null {
      let best = -1, distance = Infinity;
      for (let i = 0; i < spots.length; i++) {
        if (fill[i] < .05) continue;
        const d = Math.max(0, Math.hypot(position.x - spots[i].x, position.z - spots[i].z) - reach(i));
        if (d < distance) { distance = d; best = i; }
      }
      if (best < 0) return null;
      const spot = spots[best], dx = position.x - spot.x, dz = position.z - spot.z, d = Math.hypot(dx, dz), edge = Math.min(d, reach(best) * .9);
      point.set(spot.x + (d > .001 ? dx / d * edge : 0), meadowGroundHeight(spot.x, spot.z) + .02, spot.z + (d > .001 ? dz / d * edge : 0));
      return { index: best, distance };
    },
    drink(index: number, amount: number) { if (fill[index] !== undefined) fill[index] = Math.max(0, fill[index] - amount); },
    setFill(value: number) { for (let i = 0; i < fill.length; i++) fill[i] = canFill(i) ? THREE.MathUtils.clamp(value, 0, 1) : 0; pose(); },
    /** The summer's ground moisture: how many pools can fill, and how fast they fill and dry. */
    setMoisture(value: number) { moisture = THREE.MathUtils.clamp(value, 0, 1); },
    setBare(value: number) { bare = THREE.MathUtils.clamp(value, 0, 1); },
    /** Pool beds with no water, for the ground to paint as dry, cracked hollows: a
     * pool that can't fill this summer always (more so the drier it is); one that
     * can, only once it has dried out in a dry summer. None in an ordinary one. */
    hollows(dry: number) {
      const beds = spots.map((spot, i) => {
        const empty = 1 - THREE.MathUtils.smoothstep(fill[i], .02, .2);
        return { x: spot.x, z: spot.z, radius: spot.radius * 1.15, amount: empty * (canFill(i) ? dry * .7 : Math.max(.6, dry)) };
      });
      shownHollows = beds.filter(b => b.amount > .01).length;
      return beds;
    },
    /** Morning groundwater from the ground's moisture: pools start part full, the
     * deeper ones more; off clears it (the pools hold only rain). */
    setSprings(on: boolean) {
      const limit = .35 + moisture * 1.3;
      for (let i = 0; i < fill.length; i++) {
        spring[i] = on && canFill(i) ? THREE.MathUtils.clamp(.18 + (limit - seedData[i]) * .7, 0, .65) : 0;
        fill[i] = Math.max(fill[i], spring[i]);
      }
      pose();
    },
    diagnostics: () => ({ canFill: spots.filter((_, i) => canFill(i)).length, count: spots.length, visible: mesh.visible, wet: Array.from(fill).filter(f => f > .05).length, hollows: shownHollows, springs: Array.from(spring, f => Math.round(f * 100) / 100), fill: Array.from(fill, f => Math.round(f * 100) / 100) }),
    dispose() { scene.remove(mesh, glints); geometry.dispose(); material.dispose(); mesh.dispose(); glintGeometry.dispose(); glintMaterial.dispose(); },
  };
}
