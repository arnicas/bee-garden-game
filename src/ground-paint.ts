import * as THREE from 'three';
import { createSeededRandom } from './utils/random';

/** A dry watercolor substrate, anchored in meadow X/Z art units (0.1 m/unit).
 * Three reads from one 256² packed, mipmapped noise texture replace the old
 * per-pixel noise. One opaque ground draw; stock light, shadow and fog remain.
 * Surface relief is shading only: terrain height and shelter rules stay owned
 * by the meadow. Nothing moves with the camera or the weather clock. */
export function createGroundPaint(): THREE.MeshStandardMaterial {
  const size = 256, random = createSeededRandom(0x5011);
  const grids = [8, 32, 128].map(width => ({ width, values: Float32Array.from({ length: width * width }, random) }));
  function noise(x: number, y: number, grid: typeof grids[number]) {
    const gx = x * grid.width / size, gy = y * grid.width / size;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = THREE.MathUtils.smoothstep(gx - ix, 0, 1), fy = THREE.MathUtils.smoothstep(gy - iy, 0, 1);
    const nextX = (ix + 1) % grid.width, nextY = (iy + 1) % grid.width;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(grid.values[iy * grid.width + ix], grid.values[iy * grid.width + nextX], fx),
      THREE.MathUtils.lerp(grid.values[nextY * grid.width + ix], grid.values[nextY * grid.width + nextX], fx), fy);
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    pixels[i] = noise(x, y, grids[0]) * 255;
    pixels[i + 1] = noise(x, y, grids[1]) * 255;
    pixels[i + 2] = noise(x, y, grids[2]) * 255;
    pixels[i + 3] = random() * 255;
  }
  const paper = new THREE.DataTexture(pixels, size, size);
  paper.name = 'ground-pigment-fields'; paper.colorSpace = THREE.NoColorSpace;
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.minFilter = THREE.LinearMipmapLinearFilter; paper.magFilter = THREE.LinearFilter;
  paper.generateMipmaps = true; paper.anisotropy = 4; paper.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ name: 'watercolor-earth-moss-stone', roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uSoilPaper = { value: paper };
    for (const [name, color] of Object.entries({
      uEarthInk: '#795d42', uEarthWash: '#aa9069', uMossInk: '#34553c',
      uMossWash: '#709153', uStoneInk: '#737d70', uStoneWash: '#b0aea0',
    })) shader.uniforms[name] = { value: new THREE.Color(color) };
    shader.vertexShader = 'varying vec2 vSoilPosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvSoilPosition = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = `
      uniform sampler2D uSoilPaper;
      uniform vec3 uEarthInk, uEarthWash, uMossInk, uMossWash, uStoneInk, uStoneWash;
      varying vec2 vSoilPosition;
      vec3 soilSeed(vec2 cell) {
        return fract(sin(vec3(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)), dot(cell, vec2(419.2, 371.9)))) * 43758.5453);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 soilP = vSoilPosition;
      float soilFootprint = length(fwidth(soilP));
      float soilDetail = 1.0 - smoothstep(0.025, 0.16, soilFootprint);
      vec4 broad = texture2D(uSoilPaper, soilP * 0.021);
      vec4 wash = texture2D(uSoilPaper, soilP * 0.078 + (broad.rg - 0.5) * 0.11);
      vec4 grain = texture2D(uSoilPaper, soilP * 0.67);
      // Soft underpainting, smaller feathered washes and a broken pigment tide.
      float mossField = wash.r * 0.63 + wash.g * 0.18 + grain.r * 0.19 + (broad.r - 0.5) * 0.12;
      float moss = max(0.72, smoothstep(0.20, 0.42, mossField));
      vec3 earth = mix(uEarthInk, uEarthWash, 0.35 + wash.r * 0.65);
      vec3 mossColor = mix(uMossInk, uMossWash, wash.r * 0.62 + grain.r * 0.38);
      vec3 pigment = mix(earth, mossColor, moss);
      float tide = (1.0 - smoothstep(0.018, 0.065, abs(mossField - 0.31))) * (0.4 + wash.g * 0.6);
      pigment *= 1.0 - tide * 0.14;
      pigment *= 0.97 + (grain.b - 0.5) * 0.12 * soilDetail + (grain.a - 0.5) * 0.045 * soilDetail;

      // Sparse, irregular pebbles: small enough to suggest scale, with softened
      // painted edges rather than a rock texture or extra collision obstacles.
      vec2 stoneP = soilP * 1.15;
      vec3 seed = soilSeed(floor(stoneP));
      vec2 pebble = fract(stoneP) - (0.34 + seed.xy * 0.32);
      float angle = seed.z * 6.2831853;
      pebble = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * pebble;
      pebble *= vec2(0.8 + seed.y * 0.35, 1.05 + seed.x * 0.45);
      float stoneRadius = 0.13 + seed.z * 0.13;
      float stoneDistance = length(pebble) / stoneRadius + (grain.g - 0.5) * 0.22;
      float softEdge = clamp(soilFootprint * 1.7 / stoneRadius, 0.065, 0.23);
      float stoneVisible = step(0.65, seed.z) * (1.0 - smoothstep(0.09, 0.4, soilFootprint));
      float stone = (1.0 - smoothstep(1.0 - softEdge, 1.0 + softEdge, stoneDistance)) * stoneVisible;
      vec3 stoneColor = mix(uStoneInk, uStoneWash, 0.45 + wash.g * 0.35 + seed.x * 0.2);
      float stoneRim = (1.0 - smoothstep(0.03, 0.22, abs(stoneDistance - 0.9))) * stoneVisible;
      stoneColor *= 1.0 - stoneRim * 0.23;
      stoneColor = mix(stoneColor, mossColor, moss * wash.g * 0.52);
      pigment = mix(pigment, stoneColor, stone);

      // Tiny pointed leaves painted into the moss. Soft pigment rims and a
      // faint central vein suggest undergrowth without adding leaf meshes.
      vec2 leafP = soilP * 1.75 + vec2(17.3, 8.1);
      vec3 leafSeed = soilSeed(floor(leafP));
      vec2 leafQ = fract(leafP) - (0.33 + leafSeed.xy * 0.34);
      float leafAngle = leafSeed.z * 6.2831853;
      leafQ = mat2(cos(leafAngle), -sin(leafAngle), sin(leafAngle), cos(leafAngle)) * leafQ;
      leafQ /= vec2(0.23, 0.30) * (0.8 + leafSeed.y * 0.2);
      float leafDistance = max(length(leafQ - vec2(0.7, 0.0)), length(leafQ + vec2(0.7, 0.0))) - 1.1;
      float leafFeather = clamp(soilFootprint * 7.0, 0.06, 0.3);
      float leaf = (1.0 - smoothstep(-leafFeather, leafFeather, leafDistance))
        * step(0.22, leafSeed.z) * moss * (1.0 - stone) * soilDetail;
      vec3 leafColor = mix(uMossInk * 0.78, uMossWash * 1.16, 0.38 + leafSeed.x * 0.5);
      float leafVein = (1.0 - smoothstep(0.018, 0.07 + leafFeather * 0.15, abs(leafQ.x)))
        * (1.0 - smoothstep(0.5, 0.86, abs(leafQ.y)));
      leafColor *= 1.0 + leafVein * 0.18 - (1.0 - smoothstep(0.0, 0.16, abs(leafDistance))) * 0.18;
      pigment = mix(pigment, leafColor, leaf * 0.85);
      diffuseColor.rgb *= pigment;
      float soilRelief = max(0.0, 1.0 - stoneDistance * stoneDistance) * stoneVisible * 0.023
        + moss * grain.g * 0.004 * soilDetail + (grain.b - 0.5) * 0.0007 * soilDetail;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= 1.0 - stone * 0.10;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 soilDX = dFdx(-vViewPosition), soilDY = dFdy(-vViewPosition);
      vec3 soilR1 = cross(soilDY, normal), soilR2 = cross(normal, soilDX);
      float soilDet = dot(soilDX, soilR1);
      vec3 soilGradient = sign(soilDet) * (dFdx(soilRelief) * soilR1 + dFdy(soilRelief) * soilR2);
      normal = normalize(max(abs(soilDet), 0.00000001) * normal - soilGradient);
    `);
  };
  material.customProgramCacheKey = () => 'bee-ground-watercolor-v2';
  material.addEventListener('dispose', () => paper.dispose());
  return material;
}
