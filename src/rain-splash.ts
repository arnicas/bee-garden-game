import * as THREE from 'three';
import { createSeededRandom } from './utils/random';

/** A raindrop hitting the bee: a watercolour splash blooms on the view, a
 * trickle runs down from it, and it fades over a couple of seconds. Up to four
 * at once, in one transparent screen draw (two triangles), only while one shows. */
export function createRainSplash(scene: THREE.Scene) {
  const size = 128, random = createSeededRandom(0x5b1a5);
  const grids = [6, 14, 40].map(width => ({ width, values: Float32Array.from({ length: width * width }, random) }));
  const sample = (x: number, y: number, grid: typeof grids[number]) => {
    const gx = x / size * grid.width, gy = y / size * grid.width;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    let fx = gx - ix, fy = gy - iy;
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    const row = iy * grid.width, nextRow = ((iy + 1) % grid.width) * grid.width, nextX = (ix + 1) % grid.width;
    const lower = THREE.MathUtils.lerp(grid.values[row + ix], grid.values[row + nextX], fx);
    const upper = THREE.MathUtils.lerp(grid.values[nextRow + ix], grid.values[nextRow + nextX], fx);
    return THREE.MathUtils.lerp(lower, upper, fy);
  };
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    pixels[i] = sample(x, y, grids[0]) * 255;
    pixels[i + 1] = sample(x, y, grids[1]) * 255;
    pixels[i + 2] = sample(x, y, grids[2]) * 255;
    pixels[i + 3] = 255;
  }
  const paper = new THREE.DataTexture(pixels, size, size);
  paper.name = 'raindrop-splash-paper';
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.minFilter = paper.magFilter = THREE.LinearFilter;
  paper.generateMipmaps = false; paper.needsUpdate = true;
  const LIFE = 2.8;
  // x, y (0–1 screen), age in seconds, size (fraction of the screen height).
  const slots = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 99, 0));
  const material = new THREE.ShaderMaterial({
    name: 'raindrop-splash', transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    uniforms: { uPaper: { value: paper }, uSlots: { value: slots }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uPaper;
      uniform vec4 uSlots[4];
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        float body = 0.0, tide = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 s = uSlots[i];
          if (s.z > ${LIFE.toFixed(1)}) continue;
          vec2 d = (vUv - s.xy) * vec2(uAspect, 1.0);
          vec4 paper = texture2D(uPaper, (vUv + s.xy * 3.7) * vec2(uAspect, 1.0) * 1.3);
          // The drop lands and spreads fast, with a ragged, bleeding edge.
          float grow = s.w * (0.5 + 0.5 * smoothstep(0.0, 0.14, s.z));
          float blob = grow + (paper.r - 0.5) * 0.45 * s.w + (paper.g - 0.5) * 0.14 * s.w - length(d);
          // Then a trickle runs down from it, narrowing as it goes.
          float run = min(s.z * 0.11, 0.38);
          float along = clamp(-d.y / max(run, 0.001), 0.0, 1.0);
          float width = s.w * 0.17 * (1.0 - along * 0.8) * (0.75 + paper.b * 0.5);
          float trickle = d.y < 0.0 && -d.y < run ? width - abs(d.x + (paper.g - 0.5) * 0.02) : -1.0;
          float shape = max(blob, trickle);
          float fade = 1.0 - smoothstep(0.9, ${LIFE.toFixed(1)}, s.z);
          float inside = smoothstep(-0.004, 0.006, shape);
          body = max(body, inside * fade);
          tide = max(tide, inside * (1.0 - smoothstep(0.0, 0.014, shape)) * fade);
        }
        float alpha = body * 0.26 + tide * 0.34;
        if (alpha < 0.002) discard;
        vec3 water = vec3(0.76, 0.85, 0.93), edge = vec3(0.40, 0.53, 0.67);
        gl_FragColor = vec4(mix(water, edge, tide / max(alpha * 3.0, 0.001)), min(0.62, alpha));
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'raindrop-splash-overlay'; mesh.renderOrder = 10001;
  mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  let hits = 0;
  return {
    /** A new splash at screen (x, y), 0–1 from the bottom left. */
    hit(x: number, y: number, size: number): void {
      let oldest = slots[0];
      for (const slot of slots) if (slot.z > oldest.z) oldest = slot;
      oldest.set(x, y, 0, size); hits++;
      mesh.visible = true;
    },
    update(dt: number, aspect: number): void {
      material.uniforms.uAspect.value = aspect;
      let live = false;
      for (const slot of slots) { slot.z += dt; if (slot.z <= LIFE) live = true; }
      mesh.visible = live;
    },
    clear(): void { for (const slot of slots) slot.z = 99; mesh.visible = false; },
    diagnostics: () => ({ visible: mesh.visible, active: slots.filter(slot => slot.z <= LIFE).length, hits, triangles: mesh.visible ? 2 : 0 }),
    dispose(): void { scene.remove(mesh); geometry.dispose(); material.dispose(); paper.dispose(); },
  };
}
