import * as THREE from 'three';
import { createSeededRandom } from './utils/random';

/** Screen-space pigment, baked once into a small packed noise texture. The
 * front advances with the actual warning level, never a wall-clock animation.
 * One transparent draw, two triangles, no scene copy or extra render target. */
export function createEnergyWash(scene: THREE.Scene) {
  const size = 256, random = createSeededRandom(0xb1e);
  const grids = [8, 16, 32, 128].map(width => ({ width, values: Float32Array.from({ length: width * width }, random) }));
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
    pixels[i] = (sample(x, y, grids[0]) * .72 + sample(x, y, grids[1]) * .28) * 255;
    pixels[i + 1] = sample(x, y, grids[2]) * 255;
    pixels[i + 2] = (sample(x, y, grids[3]) * .65 + random() * .35) * 255;
    pixels[i + 3] = random() * 255;
  }
  const paper = new THREE.DataTexture(pixels, size, size);
  paper.name = 'energy-watercolor-paper';
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.minFilter = paper.magFilter = THREE.LinearFilter;
  paper.generateMipmaps = false; paper.needsUpdate = true;
  const cool = ['#91bed4', '#467faa', '#293f70'].map(color => new THREE.Color(color));
  const warm = ['#f6c281', '#d57c43', '#8d3934'].map(color => new THREE.Color(color));
  const night = ['#8b786b', '#51423f', '#181316'].map(color => new THREE.Color(color));
  let warmth = 0;
  const material = new THREE.ShaderMaterial({
    name: 'energy-watercolor-wash', transparent: true, depthTest: false,
    depthWrite: false, toneMapped: false, fog: false,
    uniforms: {
      uPaper: { value: paper }, uLevel: { value: 0 }, uAspect: { value: 1 }, uNight: { value: 0 },
      uPale: { value: new THREE.Color('#91bed4') },
      uBlue: { value: new THREE.Color('#467faa') },
      uInk: { value: new THREE.Color('#293f70') },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uPaper;
      uniform float uLevel, uAspect, uNight;
      uniform vec3 uPale, uBlue, uInk;
      varying vec2 vUv;
      void main() {
        vec4 paper = texture2D(uPaper, vUv * vec2(uAspect, 1.0));
        float side = min(vUv.x, 1.0 - vUv.x);
        float end = min(vUv.y, 1.0 - vUv.y);
        float spread = pow(uLevel, 0.75);
        float corner = pow(abs(vUv.y - 0.5) * 2.0, 1.5);
        float width = mix(0.055, 0.40, spread) * mix(0.78, 1.0, corner);
        // Broad pigment blooms, smaller feathering, then a separate wet edge.
        float bleed = (paper.r - 0.5) * 0.12 + (paper.g - 0.5) * 0.025;
        float edge = min(side - width + bleed, end - spread * 0.13 + bleed * 0.45);
        float wash = 1.0 - smoothstep(-0.065, 0.025, edge);
        float underwash = 1.0 - smoothstep(-0.11, 0.04, edge + 0.025 + (paper.g - 0.5) * 0.035);
        float tide = (1.0 - smoothstep(0.005, 0.025, abs(edge + 0.025))) * wash;
        float grain = 0.83 + paper.b * 0.25 + paper.a * 0.08;
        float alpha = (wash * 0.48 + underwash * 0.20 + tide * 0.13) * grain * sqrt(uLevel);
        // Keep an open central view until the existing exhaustion close takes over.
        vec3 pigment = mix(uPale, uBlue, 0.35 + paper.r * 0.55);
        pigment = mix(pigment, uInk, min(0.75, tide * 0.42 + spread * wash * 0.32 + (1.0 - paper.g) * 0.16));
        gl_FragColor = vec4(pigment, min(0.88, alpha));
        if (uNight > 0.0) {
          // Warm charcoal clouds close from all sides, with a ragged wet edge.
          // This replaces the cold/heat warning and covers the center at night.
          float closing = smoothstep(0.0, 1.0, uNight);
          float radius = length((vUv - 0.5) * vec2(1.0, 0.85));
          float nightEdge = mix(0.78, -0.20, closing) - radius
            + (paper.r - 0.5) * 0.20 + (paper.g - 0.5) * 0.04;
          float cloud = 1.0 - smoothstep(-0.085, 0.065, nightEdge);
          float pooling = 1.0 - smoothstep(0.008, 0.055, abs(nightEdge + 0.035));
          vec3 ink = mix(uPale, uBlue, 0.3 + paper.r * 0.65);
          ink = mix(ink, uInk, min(1.0, closing * 0.78 + pooling * 0.22));
          ink *= (0.88 + paper.b * 0.16) * (1.0 - smoothstep(0.75, 1.0, uNight));
          float cover = mix(cloud * (0.88 + paper.b * 0.1), 1.0, smoothstep(0.82, 1.0, uNight));
          gl_FragColor = vec4(ink, cover);
        }
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'energy-watercolor-overlay'; mesh.renderOrder = 10000;
  mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  return {
    update(level: number, aspect: number, heat = 0, nightfall = 0): void {
      material.uniforms.uLevel.value = THREE.MathUtils.clamp(level, 0, 1);
      material.uniforms.uAspect.value = aspect;
      warmth = THREE.MathUtils.clamp(heat, 0, 1);
      material.uniforms.uNight.value = THREE.MathUtils.clamp(nightfall, 0, 1);
      // One pigment layer serves both warnings; retain the same paper and mesh.
      material.uniforms.uPale.value.lerpColors(cool[0], warm[0], warmth);
      material.uniforms.uBlue.value.lerpColors(cool[1], warm[1], warmth);
      material.uniforms.uInk.value.lerpColors(cool[2], warm[2], warmth);
      if (nightfall > 0) {
        material.uniforms.uPale.value.copy(night[0]);
        material.uniforms.uBlue.value.copy(night[1]);
        material.uniforms.uInk.value.copy(night[2]);
      }
      mesh.visible = level > .0001 || nightfall > 0;
    },
    diagnostics: () => ({ visible: mesh.visible, level: material.uniforms.uLevel.value, warmth, nightfall: material.uniforms.uNight.value, ink: material.uniforms.uInk.value.getHexString(), draws: mesh.visible ? 1 : 0, triangles: mesh.visible ? 2 : 0, textureBytes: pixels.byteLength }),
    dispose(): void { scene.remove(mesh); geometry.dispose(); material.dispose(); paper.dispose(); },
  };
}
