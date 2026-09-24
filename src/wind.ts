import { MathUtils, Vector3 } from 'three';

// Flowers end before this grass-only apron. The edge is a current, not a wall.
export const MEADOW_EDGE_START = 30;
export const MEADOW_EDGE_FULL = 37;
export function edgeExposureAt(x: number, z: number): number {
  return MathUtils.smoothstep(Math.hypot(x, z), MEADOW_EDGE_START, MEADOW_EDGE_FULL);
}

// One art unit is approximately ten centimetres. Both flight and rooted plants
// sample this field at simulation time. Positive Y is up; camera forward is -Z.
/** Per-day wind variation. The phase shifts when fronts and gusts arrive; the
 * heading turns where they blow from. Flight and the meadow shaders share these. */
export const windUniforms = { uWindPhase: { value: 0 }, uWindHeading: { value: 0 } };
export function setWindVariation(phase: number, heading: number): void {
  windUniforms.uWindPhase.value = phase; windUniforms.uWindHeading.value = heading;
}

export function windAt(x: number, z: number, time: number, out = new Vector3()): Vector3 {
  const t = time + windUniforms.uWindPhase.value;
  // Long calm spells give way to fronts with a gradual approach and smaller
  // travelling gusts inside them. Keep this field in sync with meadowWind.
  const front = MathUtils.smoothstep(Math.sin(t * .075 - .8), -.45, .75);
  const gust = .10 + front * (1.40 + .32 * (.5 + .5 * Math.sin(t * .53 + x * .09 + z * .07)));
  const heading = windUniforms.uWindHeading.value + .4 + 1.65 * Math.sin(t * .026) + .22 * Math.sin(t * .13 + x * .035 + z * .04);
  return out.set(gust * Math.cos(heading), .045 * front * Math.sin(t * .7 + x * .2), gust * Math.sin(heading));
}

/** Air velocity in world art-units/second (+Y up, 0.1 m/unit). The normalized
 * plant field, flight and airborne tracers share the same gusts and heading.
 * Lower air is sheltered by the meadow, so flying low is an upwind tactic.
 * The open grassy edge adds a stronger inward gust at every flight height. */
export function flightWindAt(x: number, y: number, z: number, time: number, out = new Vector3()): Vector3 {
  const exposure = .22 + .78 * MathUtils.smoothstep(y, 3, 7.5);
  windAt(x, z, time, out).multiplyScalar(3.8 * exposure);
  out.y *= 1.4;
  const edge = edgeExposureAt(x, z);
  if (edge > 0) {
    const radius = Math.hypot(x, z);
    const pulse = .5 + .5 * Math.sin(time * 1.65 + x * .035 + z * .045);
    const strength = edge * (11 + 5 * pulse); // keeps the edge inward push above ~4 at every moment
    out.x -= x / radius * strength;
    out.z -= z / radius * strength;
  }
  return out;
}

export const windGLSL = `
uniform float uWindPhase; uniform float uWindHeading;
vec2 meadowWind(vec2 p, float t) {
  t += uWindPhase;
 float front = smoothstep(-0.45, 0.75, sin(t * 0.075 - 0.8));
 float g = 0.10 + front * (1.40 + 0.32 * (0.5 + 0.5 * sin(t * 0.53 + p.x * 0.09 + p.y * 0.07)));
 float heading = uWindHeading + 0.4 + 1.65 * sin(t * 0.026) + 0.22 * sin(t * 0.13 + p.x * 0.035 + p.y * 0.04);
 return g * vec2(cos(heading), sin(heading));
}`;

export function flowerFlex(species: string): number { return species === 'poppy' ? 1.1 : species === 'cornflower' ? .82 : .62; }

/** Endpoint of a rooted quadratic bend. The GPU uses the same field below;
 * gameplay owns the moving flower head rather than a visual-only deformation. */
export function flowerSwayAt(x: number, z: number, height: number, flex: number, time: number, out: Vector3): Vector3 {
  const t = time - (.15 + flex * .25);
  windAt(x, z, t, out);
  const wave = Math.sin(x * .36 + z * .26 - t * 1.45);
  const phase = x * .73 + z * .51;
  const scale = height * height * flex;
  let dx = (out.x * (.065 + .05 * wave) + Math.sin(t * 1.7 + phase) * .012) * scale;
  let dz = (out.z * (.065 + .05 * wave) + Math.cos(t * 1.43 + phase) * .009) * scale;
  const limit = Math.min(1, height * .28 / Math.max(Math.hypot(dx, dz), .0001));
  dx *= limit; dz *= limit;
  return out.set(dx, -(dx * dx + dz * dz) * (2 / 3) / height, dz);
}

export const flowerSwayGLSL = `
vec3 flowerSway(vec2 p, float height, float flex, float time) {
 float t = time - (0.15 + flex * 0.25);
 vec2 wind = meadowWind(p, t);
 float wave = sin(p.x * 0.36 + p.y * 0.26 - t * 1.45);
 float phase = p.x * 0.73 + p.y * 0.51;
 vec2 d = (wind * (0.065 + 0.05 * wave) + vec2(sin(t * 1.7 + phase) * 0.012, cos(t * 1.43 + phase) * 0.009)) * height * height * flex;
 d *= min(1.0, height * 0.28 / max(length(d), 0.0001));
 return vec3(d.x, -dot(d,d) * (2.0 / 3.0) / height, d.y);
}`;
export function surfaceHeight(species: string, x: number, z: number, radius: number): number {
  const r = Math.min(1, Math.hypot(x, z) / radius);
  return species === 'poppy' ? 0.30 * r * r : species === 'cornflower' ? 0.07 * r : -0.05 * r * r;
}
