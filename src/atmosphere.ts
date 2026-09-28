import * as THREE from 'three';

/**
 * The sky, light and air over the meadow, from dawn through the day to dusk,
 * night and the next dawn.
 *
 * Time is a single sky clock: 0–1 is the playable day (0 mid-morning, 1 the
 * last light at nightfall), and 1–2 is the night that follows, with 2 the next
 * morning (the same as 0). The sun follows it round (below the horizon at
 * night), a moon crosses the night sky, stars come out, and the colours come
 * from the sun's height, so dusk, night and dawn all fall out of one model.
 *
 * A day's look (how hazy, what kind of clouds, what kind of sunset) is a
 * separate `SkyLook`, so days can differ without touching the clock.
 */
export type SunsetStyle = 'golden' | 'rose' | 'ember' | 'pale';
export type CloudStyle = 'fair' | 'high' | 'none';
export interface SkyLook {
  /** 0 clear and deep, 1 milky and pale. */
  haze: number;
  /** Fair-weather puffs, high streaks (a mackerel sky), or none. */
  clouds: CloudStyle;
  /** How much of the sky the day's own clouds cover in fine weather (0–1). */
  cloudAmount: number;
  sunset: SunsetStyle;
}
/** The look the meadow has always had: a soft, slightly hazy sky with fair clouds and a golden evening. */
export const DEFAULT_SKY_LOOK: SkyLook = { haze: .35, clouds: 'fair', cloudAmount: .3, sunset: 'golden' };

export interface SkyOptions {
  /** The sky clock (see above); defaults to the day's progress. */
  clock?: number;
  look?: SkyLook;
  /** 0 new moon, .5 full, 1 new again. */
  moonPhase?: number;
}

const DEG = Math.PI / 180;

/** The sun's height above the horizon in degrees for a point on the sky clock. */
export function sunElevation(clock: number): number {
  const c = ((clock % 2) + 2) % 2;
  // Day: from mid-morning up to midday and down to just above the horizon at nightfall.
  if (c <= 1) return 20 - 17 * c + 45 * Math.sin(Math.PI * Math.pow(c, .8));
  // Night: down to about 34° below at midnight, then back up to mid-morning.
  const n = c - 1;
  return 3 + 17 * n - 45 * Math.sin(Math.PI * n);
}
/** Where the sun is along its east-to-west path (0 east, 1 west, 2 back east underneath). */
function sunPath(clock: number): number {
  const c = ((clock % 2) + 2) % 2;
  return c <= 1 ? .15 + .7 * c : .85 + 1.3 * (c - 1);
}
function directionFrom(path: number, elevation: number, out: THREE.Vector3): THREE.Vector3 {
  const hx = -Math.cos(Math.PI * path), hz = -Math.sin(Math.PI * path) * .6, h = Math.hypot(hx, hz) || 1;
  const e = elevation * DEG;
  return out.set(hx / h * Math.cos(e), Math.sin(e), hz / h * Math.cos(e));
}
/** The moon rises soon after dusk and sets before dawn (in the night half of the clock). */
function moonAt(clock: number, out: THREE.Vector3): number {
  const c = ((clock % 2) + 2) % 2;
  const s = (c - 1.08) / .84;
  if (s <= -.1 || s >= 1.1) { out.set(0, -1, 0); return -30; }
  const elevation = -4 + 52 * Math.sin(Math.PI * THREE.MathUtils.clamp(s, 0, 1));
  directionFrom(.05 + .9 * s, elevation, out);
  return elevation;
}

interface Palette { top: THREE.Color; horizon: THREE.Color; cloud: THREE.Color; fog: THREE.Color; sky: THREE.Color; ground: THREE.Color; light: THREE.Color; intensity: number; hemi: number }
const P = (top: string, horizon: string, cloud: string, fog: string, sky: string, ground: string, light: string, intensity: number, hemi: number): Palette => ({
  top: new THREE.Color(top), horizon: new THREE.Color(horizon), cloud: new THREE.Color(cloud), fog: new THREE.Color(fog),
  sky: new THREE.Color(sky), ground: new THREE.Color(ground), light: new THREE.Color(light), intensity, hemi,
});
// Keys by the sun's height. The high and mid-morning keys are the meadow's original day.
const NIGHT = P('#141b33', '#2f3858', '#39415e', '#222a3e', '#3d4c74', '#161b16', '#b3c3e3', .5, .5);
const HIGH = P('#97c9cf', '#edf0d6', '#ecf0d8', '#ccd7bb', '#ecf0d8', '#66744a', '#ffe6ae', 3, 2);
const MORNING = P('#afcbd8', '#f3dfbd', '#e7e6d6', '#d5d6ba', '#e7e6d6', '#737950', '#ffe0aa', 2.65, 2);
const GOLDEN = P('#afc7cc', '#f4dcad', '#ebdfc3', '#d5d0a6', '#ebdfc3', '#716445', '#ffd092', 2.5, 1.85);
const DAWN_LOW = P('#8fa3c0', '#f2c7a8', '#ecd2c4', '#cdbfb2', '#dcc9c3', '#5e5a4a', '#ffc79a', 1.5, 1.5);
const DAWN = P('#34406a', '#c99a9a', '#7d7690', '#5c5b72', '#6d6f90', '#262a24', '#e0b0a0', .6, .8);
// Evening keys vary with the day's sunset.
const LOW_SUN: Record<SunsetStyle, Palette> = {
  golden: P('#7a80a0', '#f0a468', '#e0b89a', '#c9a888', '#d9b8a4', '#65574e', '#ffaa66', 1.65, 1.7),
  rose: P('#7a7fa6', '#eea9a4', '#dbb6bd', '#c9aca8', '#d8b8bb', '#625756', '#ffb49a', 1.6, 1.7),
  ember: P('#6f6f92', '#f08a5a', '#e0a07e', '#c99a7a', '#d8a98e', '#655047', '#ff9a5e', 1.7, 1.65),
  pale: P('#8e98ae', '#e4cdb2', '#d9d2c8', '#c7c2b2', '#d6cfc4', '#666052', '#f4cfa8', 1.4, 1.75),
};
const TWILIGHT: Record<SunsetStyle, Palette> = {
  golden: P('#2e3a63', '#d9936a', '#8a7c96', '#5b5a70', '#6a6a8c', '#252822', '#e3a27e', .55, .75),
  rose: P('#34386a', '#d48a9a', '#8f7a9e', '#5e5874', '#6e6890', '#262622', '#e0a0b0', .55, .75),
  ember: P('#2c3360', '#d7684a', '#8a6a80', '#5c5268', '#6a6286', '#262420', '#e88a60', .55, .72),
  pale: P('#3a4568', '#b9a9b0', '#8d8a9c', '#646676', '#72748e', '#282a26', '#c8b8b8', .5, .78),
};
const OVERCAST = { top: new THREE.Color('#9baeb2'), horizon: new THREE.Color('#cbd4c4'), cloud: new THREE.Color('#d4dbce'), fog: new THREE.Color('#becbbe'), sky: new THREE.Color('#d9e3dc'), ground: new THREE.Color('#697655'), light: new THREE.Color('#e0e5d9') };
/** Warm light for the sunset bloom near the horizon, by style. */
const GLOW: Record<SunsetStyle, THREE.Color> = { golden: new THREE.Color('#f7b46e'), rose: new THREE.Color('#f2a0a6'), ember: new THREE.Color('#f5784a'), pale: new THREE.Color('#ead2b4') };

function blend(keys: [number, Palette][], elevation: number, out: Palette): Palette {
  let i = 0;
  while (i < keys.length - 2 && elevation > keys[i + 1][0]) i++;
  const [ea, a] = keys[i], [eb, b] = keys[i + 1];
  const t = THREE.MathUtils.smoothstep(elevation, ea, eb);
  for (const k of ['top', 'horizon', 'cloud', 'fog', 'sky', 'ground', 'light'] as const) out[k].copy(a[k]).lerp(b[k], t);
  out.intensity = THREE.MathUtils.lerp(a.intensity, b.intensity, t);
  out.hemi = THREE.MathUtils.lerp(a.hemi, b.hemi, t);
  return out;
}

export function createAtmosphere(scene: THREE.Scene) {
  const sunDirection = new THREE.Vector3(-.42, .63, -.5).normalize();
  const moonDirection = new THREE.Vector3(0, -1, 0);
  scene.background = new THREE.Color('#d4e0cf');
  scene.fog = new THREE.Fog('#ccd7bb', 18, 73);
  const hemi = new THREE.HemisphereLight('#ecf0d8', '#66744a', 2.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6ae', 3.0); sun.position.set(-8, 18, -10);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0001; scene.add(sun, sun.target);
  const ambient = new THREE.AmbientLight('#d9e5e1', .28); scene.add(ambient);
  const uniforms = {
    topColor: { value: new THREE.Color('#97c9cf') }, horizonColor: { value: new THREE.Color('#edf0d6') },
    sunDirection: { value: sunDirection }, cloudColor: { value: new THREE.Color('#f5f5dc') }, cloudiness: { value: 0 },
    sunGlow: { value: 1 }, glowColor: { value: new THREE.Color('#f7b46e') }, bloom: { value: 0 },
    night: { value: 0 }, moonDirection: { value: moonDirection }, moonPhase: { value: .5 }, moonShow: { value: 0 },
    time: { value: 0 }, cloudStyle: { value: 0 }, cloudAmount: { value: .3 }, haze: { value: .35 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vSky; void main(){vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vSky;
      uniform vec3 topColor,horizonColor,sunDirection,cloudColor,glowColor,moonDirection;
      uniform float cloudiness,sunGlow,bloom,night,moonPhase,moonShow,time,cloudStyle,cloudAmount,haze;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec3 d=normalize(vSky); float h=max(d.y,0.);
        vec3 c=mix(horizonColor,topColor,pow(h,.52));
        // Paper and wash: a faint, uneven grain so the sky reads as painted.
        c*=1.+(noise(d.xz*9.+3.)-.5)*.035+(noise(d.xz*38.)-.5)*.018;
        // The evening (or dawn) bloom: a broad warm wash low around the sun,
        // broken into soft horizontal bands.
        vec2 sunH=normalize(sunDirection.xz+vec2(1e-4));
        float toward=max(dot(normalize(d.xz+vec2(1e-4)),sunH),0.);
        float bands=.75+.25*noise(vec2(atan(d.z,d.x)*3.,h*22.));
        c=mix(c,glowColor,bloom*pow(toward,5.)*pow(1.-h,3.5)*bands*(1.-cloudiness*.6));
        // Stars on a clear night, twinkling a little.
        vec3 q=d*170.; vec3 cell=floor(q); float r=hash3(cell);
        float star=step(.9965,r)*smoothstep(.55,.0,length(fract(q)-.5))*(.6+.4*sin(time*2.+r*80.));
        c+=vec3(.92,.94,1.)*star*night*(1.-cloudiness)*smoothstep(.04,.25,h)*.9;
        // The moon: a pale painted disc with its phase, a soft halo, and a
        // little mottling.
        float md=dot(d,moonDirection);
        vec3 mt=normalize(cross(moonDirection,vec3(0.,1.,0.)+vec3(1e-3)));vec3 mb=cross(mt,moonDirection);
        vec2 mp=vec2(dot(d,mt),dot(d,mb))/.036;
        float disc=(1.-smoothstep(.93,1.,length(mp)))*step(0.,md);
        float lit=1.-smoothstep(-.06,.06,length(mp-vec2((moonPhase-.5)*4.,0.))-1.);
        lit=moonPhase<.5?1.-lit:lit; lit=abs(moonPhase-.5)<.02?1.:lit;
        vec3 moonColor=vec3(.96,.93,.84)*(.88+.12*noise(mp*3.));
        float halo=exp(-max(length(mp)-1.,0.)*1.6)*.22*step(0.,md);
        c=mix(c,moonColor,disc*mix(.12,1.,lit)*moonShow);
        c+=vec3(.55,.6,.72)*halo*moonShow*(1.-disc);
        // Clouds: fair-weather puffs, or high streaks; more of them as a shower comes.
        vec2 p=d.xz/(max(d.y,.08)+.25)*2.;
        vec2 cp=cloudStyle>.5?p*vec2(.55,2.6)+vec2(noise(p*.7)*1.5,0.):p;
        float n=noise(cp)*.65+noise(cp*2.1)*.23+noise(cp*4.1)*.12;
        float ripple=cloudStyle>.5?.5+.5*sin(cp.y*7.+noise(cp*1.3)*3.):1.;
        float cover=max(cloudiness,cloudAmount*.9);
        float cloud=smoothstep(mix(.62,.20,cover),mix(.84,.68,cover),n)*smoothstep(.015,.3,h)*mix(1.,ripple,.6);
        cloud*=cloudStyle<-.5?cloudiness:1.;
        // Moonlit edges on the night clouds near the moon.
        vec3 cc=cloudColor+vec3(.35,.38,.45)*halo*moonShow*3.;
        c=mix(c,cc,cloud*mix(.52,.87,cloudiness));
        // The sun itself, dimmed by cloud and gone below the horizon.
        float s=max(dot(d,sunDirection),0.);
        c+=vec3(1.,.73,.39)*(pow(s,450.)*.7+pow(s,18.)*.16)*(1.-cloudiness*.96)*sunGlow;
        // Haze pales the whole sky a little toward the horizon colour.
        c=mix(c,horizonColor,haze*.18*(1.-night));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })); scene.add(sky);

  const palette = P('#000', '#000', '#000', '#000', '#000', '#000', '#000', 0, 0);
  const keysFor = (evening: boolean, style: SunsetStyle): [number, Palette][] => evening
    ? [[-18, NIGHT], [-6, TWILIGHT[style]], [4, LOW_SUN[style]], [16, GOLDEN], [45, HIGH]]
    : [[-18, NIGHT], [-6, DAWN], [4, DAWN_LOW], [20, MORNING], [45, HIGH]];
  const cloudStyles: Record<CloudStyle, number> = { fair: 0, high: 1, none: -1 };
  let lastState = { clock: 0, sunElevation: 0, night: 0, moonElevation: -30 };

  return {
    update(time: number, cameraPosition: THREE.Vector3, uv: boolean, day = .38, cloudiness = 0, options: SkyOptions = {}) {
      const clock = options.clock ?? THREE.MathUtils.clamp(day, 0, 1);
      const look = options.look ?? DEFAULT_SKY_LOOK;
      cloudiness = THREE.MathUtils.clamp(cloudiness, 0, 1);
      const c = ((clock % 2) + 2) % 2;
      const elevation = sunElevation(c);
      directionFrom(sunPath(c), elevation, sunDirection);
      const moonElevation = moonAt(c, moonDirection);
      // Afternoon to midnight uses the evening keys; after midnight, the dawn ones.
      const evening = c > .5 && c < 1.5;
      blend(keysFor(evening, look.sunset), elevation, palette);
      const night = 1 - THREE.MathUtils.smoothstep(elevation, -14, -2);
      const moonUp = THREE.MathUtils.smoothstep(moonElevation, -3, 6) * night;
      const phase = options.moonPhase ?? .62;
      // The warm bloom is strongest as the sun touches the horizon.
      const bloom = Math.exp(-(((elevation - 1) / 7) ** 2)) * (evening ? 1 : .6);

      uniforms.topColor.value.copy(palette.top).lerp(OVERCAST.top, cloudiness * .9 * (1 - night * .7));
      uniforms.horizonColor.value.copy(palette.horizon).lerp(OVERCAST.horizon, cloudiness * .78 * (1 - night * .7));
      uniforms.cloudColor.value.copy(palette.cloud).lerp(OVERCAST.cloud, cloudiness * (1 - night * .75));
      uniforms.cloudiness.value = cloudiness;
      uniforms.sunGlow.value = THREE.MathUtils.smoothstep(elevation, -3, 2);
      uniforms.glowColor.value.copy(evening ? GLOW[look.sunset] : GLOW.rose);
      uniforms.bloom.value = bloom * .55;
      uniforms.night.value = night;
      uniforms.moonPhase.value = phase;
      uniforms.moonShow.value = moonUp;
      uniforms.time.value = time;
      uniforms.cloudStyle.value = cloudStyles[look.clouds];
      uniforms.cloudAmount.value = look.clouds === 'none' ? 0 : look.cloudAmount;
      uniforms.haze.value = look.haze;

      const fog = scene.fog as THREE.Fog;
      fog.color.copy(palette.fog).lerp(OVERCAST.fog, cloudiness * .8 * (1 - night * .7));
      fog.near = 18 - cloudiness * 5 - night * 4;
      fog.far = 73 - cloudiness * 16 - night * 18;
      (scene.background as THREE.Color).copy(fog.color);
      hemi.color.copy(palette.sky).lerp(OVERCAST.sky, cloudiness * .85 * (1 - night * .7));
      hemi.groundColor.copy(palette.ground).lerp(OVERCAST.ground, cloudiness * .6 * (1 - night * .7));
      // One directional light: the sun by day, the moon (or a faint sky glow) by night.
      const byMoon = elevation < 0;
      const lightDirection = byMoon ? (moonUp > .05 ? moonDirection : new THREE.Vector3(-.3, 1, .2).normalize()) : sunDirection;
      sun.color.copy(palette.light).lerp(OVERCAST.light, cloudiness * .88 * (1 - night * .6));
      sun.position.copy(lightDirection).multiplyScalar(28); sun.position.x += cameraPosition.x; sun.position.z += cameraPosition.z;
      sun.target.position.set(cameraPosition.x, 0, cameraPosition.z);
      const moonlight = .2 + .35 * moonUp * (1 - Math.abs(phase - .5) * 1.4);
      const sunlight = palette.intensity * THREE.MathUtils.smoothstep(elevation, -4, 3);
      sun.intensity = (byMoon ? Math.max(sunlight, moonlight * night + sunlight) : sunlight) * (uv ? .6 : 1) * (1 - cloudiness * .66);
      hemi.intensity = (uv ? 1.3 : 2) * (palette.hemi / 2) * (1 - cloudiness * .08);
      sun.shadow.intensity = (1 - cloudiness * .5) * (1 - night * .5);
      ambient.intensity = .28 + cloudiness * .06 - night * .1;
      lastState = { clock: c, sunElevation: elevation, night, moonElevation };
    },
    /** Where the sky clock has the sun and moon now, for tests and the night scene. */
    diagnostics: () => ({ ...lastState }),
    dispose() {
      scene.remove(sky, sun, sun.target, hemi, ambient);
      sky.geometry.dispose(); sky.material.dispose(); sun.shadow.dispose();
    },
  };
}
