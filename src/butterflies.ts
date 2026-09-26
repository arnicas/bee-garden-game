import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng } from './world';
import { surfaceHeight } from './wind';
import { leafSurfaceHeight, type LeafShelter } from './shelters';
import type { Flower } from './types';

/**
 * Butterflies, meadow friends that only want nectar. They flutter between
 * daisies (easy landing pads) and cornflowers (their long proboscis reaches the
 * deep florets) and ignore poppies, which have none. While one sits sipping,
 * the flower's nectar drains a little, so a bee may find it emptier: a gentle
 * competition. They lift off when the bee comes close. How many live in the
 * meadow follows its daisies and cornflowers (friendCounts in meadow-plan.ts).
 *
 * Weather: in rain they stop flying (drops are heavy at their size and the air
 * too cool) and shelter under the broad leaves or down in the grass, wings
 * closed. When the rain stops they come out and bask, wings flat to the sun,
 * before feeding again. Under heavy cloud they sit longer between flights.
 * The male common blue's blue is structural (tiny scale ridges), so it has an
 * angle-dependent sheen; females are brown.
 */
export type ButterflyState = 'flying' | 'feeding' | 'sheltering';
export interface Butterfly {
  id: number;
  kind: number;
  state: ButterflyState;
  flower: Flower | null;
  position: THREE.Vector3;
  seen: boolean;
}

/** Four familiar meadow species; their wings are painted in wingAtlas(). */
export const BUTTERFLY_KINDS = ['common blue', 'meadow brown', 'small tortoiseshell', 'small white'] as const;
/** Atlas columns: the four species, plus the brown female common blue. */
const WING_KINDS = 5;
const FEMALE_BLUE = 4;
/** The wing outline's box in shape units (x from the hinge, y forward). */
const WING_BOX = { w: .21, y0: -.11, h: .24 };

/**
 * Paints every kind's upper side and underside into one atlas (a column per
 * kind, upper sides in the top half), watercolour-style: soft washes, darker
 * veins, borders and fringes, and each species' marks. Upper sides:
 * common blue, violet-blue with a dark border and white fringe; meadow brown,
 * brown with an orange forewing patch and a white-pupilled eyespot; small
 * tortoiseshell, orange with black bars, a white apex spot and a border of blue
 * crescents; small white, cream with a grey tip and a black spot. Undersides are
 * the paler, patterned faces they show at rest.
 */
export function wingAtlas(outline: THREE.Vector2[]): THREE.CanvasTexture {
  const cell = 256, canvas = document.createElement('canvas');
  canvas.width = cell * WING_KINDS; canvas.height = cell * 2;
  const g = canvas.getContext('2d')!;
  let seed = 17;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Wing shape units to canvas pixels inside the current cell.
  let ox = 0, oy = 0;
  const X = (u: number) => ox + (u / WING_BOX.w) * cell;
  const Y = (v: number) => oy + (1 - (v - WING_BOX.y0) / WING_BOX.h) * cell;
  const outlinePath = () => { g.beginPath(); outline.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.closePath(); };
  /** A soft patch of colour (rgb as 'r,g,b'), fading to its own clear edge. */
  const blob = (u: number, v: number, r: number, rgb: string, alpha: number, soft = .6) => {
    const grad = g.createRadialGradient(X(u), Y(v), 0, X(u), Y(v), r * cell);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`); grad.addColorStop(soft, `rgba(${rgb},${alpha})`); grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad; g.beginPath(); g.arc(X(u), Y(v), r * cell, 0, Math.PI * 2); g.fill();
  };
  const dot = (u: number, v: number, r: number, color: string) => { g.fillStyle = color; g.beginPath(); g.arc(X(u), Y(v), r * cell, 0, Math.PI * 2); g.fill(); };
  const eyespot = (u: number, v: number, r: number, ring = '#e8b04c') => { dot(u, v, r * 1.45, ring); dot(u, v, r, '#1e1712'); dot(u + r * .15, v + r * .2, r * .32, '#fbf6e8'); };
  /** A wash from the hinge outward, then speckle for a watercolour grain. */
  const wash = (inner: string, outer: string) => {
    const grad = g.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), cell * 1.05);
    grad.addColorStop(0, inner); grad.addColorStop(1, outer);
    g.fillStyle = grad; g.fillRect(ox, oy, cell, cell);
  };
  const grain = (color: string, count = 220) => {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) { g.globalAlpha = .05 + rand() * .08; g.beginPath(); g.arc(ox + rand() * cell, oy + rand() * cell, 1 + rand() * 4, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  };
  const veins = (color: string, alpha = .35) => {
    g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = 1.6;
    const step = Math.max(1, Math.floor(outline.length / 10));
    for (let i = step; i < outline.length - 1; i += step) {
      const p = outline[i]; g.beginPath(); g.moveTo(X(0), Y(p.y > 0 ? .005 : -.008));
      g.quadraticCurveTo(X(p.x * .45), Y(p.y * .75), X(p.x * .96), Y(p.y * .96)); g.stroke();
    }
    // The line between forewing and hindwing.
    g.beginPath(); g.moveTo(X(0), Y(-.002)); g.quadraticCurveTo(X(.07), Y(.004), X(.125), Y(.002)); g.stroke();
    g.globalAlpha = 1;
  };
  /** Border band and fringe along the edge (drawn inside the clip). */
  const border = (band: string, bandWidth: number, fringe?: string) => {
    outlinePath(); g.strokeStyle = band; g.lineWidth = bandWidth; g.stroke();
    if (fringe) { outlinePath(); g.strokeStyle = fringe; g.lineWidth = 5; g.stroke(); }
  };
  const along = (from: number, to: number, count: number, inset: number, draw: (u: number, v: number) => void) => {
    // Points just inside the outer edge, between two outline indices.
    for (let i = 0; i < count; i++) {
      const t = from + (to - from) * (i + .5) / count, a = Math.floor(t), f = t - a;
      const p = outline[a].clone().lerp(outline[Math.min(outline.length - 1, a + 1)], f);
      const toHinge = new THREE.Vector2(-p.x, -p.y).normalize().multiplyScalar(inset);
      draw(p.x + toHinge.x, p.y + toHinge.y);
    }
  };
  const n = outline.length, fore = [Math.round(n * .12), Math.round(n * .42)], hind = [Math.round(n * .55), Math.round(n * .9)];
  const painters: [() => void, () => void][] = [
    // Common blue.
    [() => { wash('#5f7fd6', '#a6b9f2'); grain('#3e57a8'); veins('#2f3f7a', .3); border('#2c2f45', 16, '#f7f5ee'); },
     () => { wash('#c9c6bf', '#e2ddd2'); grain('#9d978c');
       for (const [u, v] of [[.07, .05], [.11, .07], [.14, .085], [.06, -.03], [.09, -.05], [.05, -.07]]) { dot(u, v, .018, '#fbf8ef'); dot(u, v, .011, '#221c19'); }
       along(hind[0], hind[1], 6, .018, (u, v) => { dot(u, v, .02, '#e9913a'); });
       veins('#8d877d', .2); border('#bdb6aa', 8, '#f7f5ee'); }],
    // Meadow brown.
    [() => { wash('#5a4130', '#8a6646'); grain('#3b2a1e'); blob(.13, .075, .19, '222,140,58', .9, .45); eyespot(.16, .09, .02); veins('#3a2a1f', .25); border('#4a3526', 14, '#d8c9ae'); },
     () => { wash('#8b6a45', '#b08a5a'); blob(.12, .07, .2, '226,150,70', .85, .5); eyespot(.16, .09, .02); blob(.08, -.06, .16, '160,138,104', .8, .4); grain('#5b4330'); veins('#5a4330', .2); border('#6d5238', 10, '#d8c9ae'); }],
    // Small tortoiseshell.
    [() => { wash('#3a2a22', '#ef8a36'); blob(.02, 0, .22, '58,40,30', .85, .3); grain('#b25a1c');
       for (const [u, v, w] of [[.07, .075, .022], [.11, .1, .02], [.15, .112, .016]]) { g.fillStyle = '#1f1916'; g.fillRect(X(u - w / 2), Y(v + .012), w * cell / WING_BOX.w, .03 * cell / WING_BOX.h); }
       dot(.185, .1, .009, '#fbf6ea'); dot(.1, .035, .012, '#1f1916'); dot(.13, .04, .01, '#1f1916');
       border('#241c18', 22);
       along(fore[0] + 1, n - 1, 11, .012, (u, v) => dot(u, v, .008, '#5c8fe0'));
       veins('#6d3a18', .2); border('#241c18', 4, '#d9c7a8'); },
     () => { wash('#2a211c', '#5b4a3a'); blob(.1, .05, .18, '196,170,120', .55, .4); blob(.07, -.05, .14, '90,72,58', .8, .5); grain('#170f0b'); veins('#15100d', .3); border('#241c18', 8, '#b3a08a'); }],
    // Small white.
    [() => { wash('#e9e5d6', '#fbf9f1'); grain('#c9c4b2', 140); blob(.185, .11, .075, '70,66,62', .85, .5); dot(.13, .075, .012, '#3b3733'); blob(.02, 0, .1, '150,146,138', .35, .3); veins('#b7b2a3', .25); border('#e3dfcf', 4, '#fbf9f1'); },
     () => { wash('#f2efdf', '#f7f3e3'); blob(.08, -.05, .2, '236,226,168', .95, .55); blob(.18, .105, .07, '236,226,168', .9, .5); dot(.12, .07, .01, '#57524b'); grain('#b9b08a', 160); veins('#cfc8ad', .25); border('#ece6c9', 4, '#fbf9f1'); }],
  ];
  // Female common blue: brown above, dusted blue near the body, orange spots
  // along the border; the same underside as the male.
  painters.push([
    () => { wash('#5b4432', '#86664a'); blob(.03, 0, .16, '98,122,196', .5, .3); grain('#3e2d20');
      along(fore[0] + 2, fore[1], 5, .018, (u, v) => dot(u, v, .012, '#e5903c'));
      along(hind[0], hind[1], 6, .02, (u, v) => dot(u, v, .016, '#e5903c'));
      veins('#3e2d20', .25); border('#3a2b20', 12, '#f3efe4'); },
    painters[0][1],
  ]);
  painters.forEach(([upper, under], kind) => {
    for (const [side, paint] of [[0, upper], [1, under]] as const) {
      ox = kind * cell; oy = side * cell; seed = 17 + kind * 31 + side * 7;
      g.save(); g.beginPath(); g.rect(ox, oy, cell, cell); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(ox, oy, cell, cell);
      outlinePath(); g.clip();
      paint();
      g.restore();
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Nectar sipped per second (flower supply units; a fresh daisy holds 26). */
const SIP_RATE = .55;
const FLIGHT_SPEED = 1.5;
const SHY_DISTANCE = .9;
/** How far below the body its feet reach (life size). */
const LEG_REACH = .024;
/** Space between butterflies sheltering under one leaf: a wing's length and a bit. */
const SHELTER_SPACING = .27;

/** One body draw and one wing draw for a whole flock. `size` scales the insect
 * (1 is life size, about 4 cm across the wings). */
export function createButterflyMeshes(capacity: number, size = 1) {
  const s = size;
  // Wing outline in (x, forward): forewing ahead of the hinge, hindwing behind.
  const outline = [[0, .012], [.05, .07], [.11, .11], [.17, .125], [.205, .105], [.2, .06], [.15, .02], [.12, 0], [.15, -.03], [.14, -.075], [.1, -.105], [.05, -.1], [0, -.05]];
  // A smooth curve through the outline points (straight segments looked rough).
  const shape = new THREE.Shape();
  const points = outline.map(([x, y]) => new THREE.Vector2(x * s, y * s));
  shape.moveTo(points[0].x, points[0].y); shape.splineThru(points.slice(1)); shape.lineTo(points[0].x, points[0].y);
  const wingGeometry = new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2);
  // Painted wings: each kind has an upper side (seen when the wings open) and an
  // underside (seen when they close over the back), from one shared atlas.
  const uv = wingGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (WING_BOX.w * s), (uv.getY(i) - WING_BOX.y0 * s) / (WING_BOX.h * s));
  uv.needsUpdate = true;
  const atlas = wingAtlas(shape.getPoints(24).map(p => new THREE.Vector2(p.x / s, p.y / s)));
  const wingMaterial = new THREE.MeshStandardMaterial({ map: atlas, side: THREE.DoubleSide, roughness: .72 });
  wingMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aKind; attribute float aMirror; varying float vKind; varying float vMirror; varying vec2 vWingUv;\n'
      + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vKind = aKind; vMirror = aMirror; vWingUv = uv;');
    shader.fragmentShader = 'varying float vKind; varying float vMirror; varying vec2 vWingUv;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      // The left wing is turned half over, so its upper side is the back face.
      bool upper = gl_FrontFacing != (vMirror > .5);
      vec2 atlasUv = vec2((clamp(vWingUv.x, .002, .998) + vKind) * ${(1 / WING_KINDS).toFixed(4)}, (clamp(vWingUv.y, .002, .998) + (upper ? 1. : 0.)) * .5);
      diffuseColor *= texture2D(map, atlasUv);
      bool blueSheen = upper && vKind < .5;`).replace('#include <opaque_fragment>', `
      // Structural blue: a sheen that brightens and shifts toward violet at
      // grazing angles, and glints when the wing tilts to the sun.
      if (blueSheen) {
        float facing = abs(dot(normal, normalize(vViewPosition)));
        float sheen = pow(1. - facing, 1.6) * .3;
        #if NUM_DIR_LIGHTS > 0
          sheen += pow(max(dot(normal, normalize(directionalLights[0].direction + normalize(vViewPosition))), 0.), 20.) * .8;
        #endif
        outgoingLight += mix(vec3(.3, .48, 1.), vec3(.55, .38, 1.), 1. - facing) * sheen;
      }
      #include <opaque_fragment>`);
  };
  wingMaterial.customProgramCacheKey = () => 'butterfly-wing-atlas-v2';
  const wings = new THREE.InstancedMesh(wingGeometry, wingMaterial, Math.max(1, capacity * 2));
  const kinds = new Float32Array(Math.max(1, capacity * 2)), mirrors = new Float32Array(Math.max(1, capacity * 2));
  for (let i = 1; i < mirrors.length; i += 2) mirrors[i] = 1;
  const kindAttribute = new THREE.InstancedBufferAttribute(kinds, 1);
  wingGeometry.setAttribute('aKind', kindAttribute);
  wingGeometry.setAttribute('aMirror', new THREE.InstancedBufferAttribute(mirrors, 1));
  wings.name = 'butterfly wings';
  // A thin rod from one point to another (legs and antennae).
  const rod = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) => {
    const from = new THREE.Vector3(ax, ay, az).multiplyScalar(s), to = new THREE.Vector3(bx, by, bz).multiplyScalar(s);
    const length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(r * s * .7, r * s, length, 4).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    return g.translate(from.x, from.y, from.z);
  };
  const bodyParts: THREE.BufferGeometry[] = [
    new THREE.SphereGeometry(1, 6, 4).scale(.011 * s, .011 * s, .06 * s),
    new THREE.SphereGeometry(1, 6, 4).scale(.012 * s, .012 * s, .012 * s).translate(0, 0, -.064 * s),
  ];
  // Six legs reaching down to what it stands on (their tips at y = -LEG_REACH),
  // and two clubbed antennae.
  for (const side of [-1, 1]) {
    for (const [z, reach] of [[-.03, -.014], [-.012, 0], [.006, .012]]) bodyParts.push(rod(side * .006, -.006, z, side * .026, -LEG_REACH, z + reach, .0016));
    bodyParts.push(rod(side * .004, .006, -.07, side * .02, .03, -.105, .001));
    bodyParts.push(new THREE.SphereGeometry(1, 5, 3).scale(.0028 * s, .0028 * s, .004 * s).translate(side * .02 * s, .03 * s, -.105 * s));
  }
  const bodyGeometry = mergeGeometries(bodyParts)!;
  bodyParts.forEach(g => g.dispose());
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#35302b', roughness: .9 });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, Math.max(1, capacity));
  bodies.name = 'butterfly bodies';
  for (const mesh of [wings, bodies]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; }
  const body = new THREE.Matrix4(), part = new THREE.Matrix4(), turn = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  return {
    wings, bodies,
    setKind(i: number, kind: number) {
      kinds[i * 2] = kinds[i * 2 + 1] = kind % WING_KINDS;
      kindAttribute.needsUpdate = true;
    },
    /** open: 0 wings flat, about 1.4 closed together above the back. */
    pose(i: number, at: THREE.Vector3, rotation: THREE.Quaternion, open: number, visible = true) {
      body.compose(at, rotation, scale.setScalar(visible ? 1 : 0));
      bodies.setMatrixAt(i, body);
      wings.setMatrixAt(i * 2, part.multiplyMatrices(body, turn.makeRotationZ(open)));
      // The left wing is the right one turned half over (a mirror would flip its lighting).
      wings.setMatrixAt(i * 2 + 1, part.multiplyMatrices(body, turn.makeRotationZ(Math.PI - open)));
    },
    commit(count: number) {
      bodies.count = count; wings.count = count * 2;
      bodies.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
    },
    dispose() { wingGeometry.dispose(); wingMaterial.dispose(); atlas.dispose(); bodyGeometry.dispose(); bodyMaterial.dispose(); wings.dispose(); bodies.dispose(); },
  };
}

interface Flier extends Butterfly {
  random: () => number;
  phase: number;
  /** Flight: start, a lifted bend, and progress along it. */
  from: THREE.Vector3; bend: THREE.Vector3; t: number; duration: number;
  /** Feeding: time left, where on the flower, and which way it faces. */
  feedLeft: number; perchAngle: number; perchYaw: number;
  /** The petal height under its feet, measured once per flower. */
  perchFlower: Flower | null; perchHeight: number;
  /** Where it waits out rain: under a leaf (leaf-local x, z) or down in the grass. */
  shelter: { leaf: LeafShelter | null; x: number; z: number; grass: THREE.Vector3 } | null;
  /** Seconds left basking with wings open after rain. */
  baskLeft: number; baskNext: boolean;
  rotation: THREE.Quaternion;
}

export interface ButterflyWorld {
  /** Nectar left in a flower (supply units). */
  nectar(flowerId: number): number;
  /** Takes nectar from a flower. */
  sip(flowerId: number, amount: number): void;
  /** A flower the bee is on, which butterflies leave to her (-1 for none). */
  beeFlower: number;
  /** 0–1 rain, and 0–1 sunshine (1 - cloudiness). */
  rain: number;
  sun: number;
}

export function createButterflies(scene: THREE.Scene, seed: number, flowers: readonly Flower[], count: number, leaves: readonly LeafShelter[] = []) {
  const random = rng((seed ^ 0xb077e9f1) >>> 0 || 13);
  const meshes = createButterflyMeshes(count);
  scene.add(meshes.wings, meshes.bodies);
  const nectarFlowers = flowers.filter(f => f.species !== 'poppy' && f.id !== 0);
  const fliers: Flier[] = [];
  const up = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3(), previous = new THREE.Vector3(), temp = new THREE.Vector3(), look = new THREE.Matrix4(), perchLocal = new THREE.Vector3(), yawTurn = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster(), rayOrigin = new THREE.Vector3(), rayDown = new THREE.Vector3(), inverse = new THREE.Matrix4();
  /** Height of the flower's real petal or floret surface at a local point, found
   * by a ray straight down onto its head mesh (the simple surfaceHeight model
   * doesn't follow the petals closely enough for feet). */
  const surfaceAt = (flower: Flower, x: number, z: number) => {
    const head = flower.group.children[0] as THREE.Mesh | undefined;
    if (head) {
      flower.group.updateMatrixWorld(true);
      rayOrigin.set(x, .8, z).applyMatrix4(flower.group.matrixWorld);
      rayDown.set(0, -1, 0).applyQuaternion(flower.group.quaternion);
      raycaster.set(rayOrigin, rayDown); raycaster.far = 2;
      const hit = raycaster.intersectObject(head, false)[0];
      if (hit) return hit.point.applyMatrix4(inverse.copy(flower.group.matrixWorld).invert()).y;
    }
    return surfaceHeight(flower.species, x, z, flower.radius);
  };
  const perchPoint = (f: Flier, flower: Flower, out: THREE.Vector3) => {
    // Daisies: on the open face; cornflowers: standing at the rim of the florets.
    const d = flower.radius * (flower.species === 'daisy' ? .16 : .34);
    perchLocal.set(Math.cos(f.perchAngle) * d, 0, Math.sin(f.perchAngle) * d);
    if (f.perchFlower !== flower) { f.perchFlower = flower; f.perchHeight = surfaceAt(flower, perchLocal.x, perchLocal.z); }
    perchLocal.y = f.perchHeight + LEG_REACH;
    return out.copy(perchLocal).applyQuaternion(flower.rotation).add(flower.center);
  };
  const busy = (flower: Flower, self: Flier) => fliers.some(o => o !== self && o.flower === flower);
  function chooseFlower(f: Flier, world: ButterflyWorld | null): Flower | null {
    let best: Flower | null = null, bestScore = -Infinity;
    for (let tries = 0; tries < 10 && nectarFlowers.length; tries++) {
      const flower = nectarFlowers[Math.floor(f.random() * nectarFlowers.length)];
      if (flower === f.flower || flower.id === world?.beeFlower || busy(flower, f)) continue;
      const left = world ? world.nectar(flower.id) : 1;
      if (left <= .5) continue;
      // Nearer and fuller flowers win, with some whim.
      const score = -flower.center.distanceTo(f.position) * .12 + Math.min(1, left / 20) + f.random() * .8;
      if (score > bestScore) { bestScore = score; best = flower; }
    }
    return best;
  }
  function takeOff(f: Flier, world: ButterflyWorld | null) {
    const next = chooseFlower(f, world);
    f.state = 'flying'; f.from.copy(f.position); f.t = 0;
    f.flower = next;
    f.perchAngle = f.random() * Math.PI * 2; f.perchYaw = f.random() * Math.PI * 2; f.perchFlower = null;
    const target = next ? perchPoint(f, next, temp) : temp.copy(f.position).add(new THREE.Vector3((f.random() - .5) * 8, 0, (f.random() - .5) * 8));
    f.bend.copy(f.from).lerp(target, .5);
    f.bend.x += (f.random() - .5) * 3; f.bend.z += (f.random() - .5) * 3;
    f.bend.y = Math.max(f.from.y, target.y) + 1 + f.random() * 2;
    f.duration = Math.max(2, f.from.distanceTo(target) / FLIGHT_SPEED + 1);
  }
  const shelterLocal = new THREE.Vector3(), flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  /** Hanging under a leaf (feet on its underside), or perched low in the grass. */
  const shelterPoint = (f: Flier, out: THREE.Vector3) => {
    const s = f.shelter!;
    if (!s.leaf) return out.copy(s.grass);
    shelterLocal.set(s.x, leafSurfaceHeight(s.x, s.z) - LEG_REACH - .012, s.z);
    return out.copy(shelterLocal).applyQuaternion(s.leaf.rotation).add(s.leaf.center);
  };
  /** Rain: hurry to the nearest broad leaf (or the grass if none is near). */
  function seekShelter(f: Flier) {
    // The nearest leaf with room: each butterfly keeps a wing's length from the
    // others already under it, so their wings don't touch.
    let leaf: LeafShelter | null = null, x = 0, z = 0;
    const near = leaves.map(l => ({ l, d: l.center.distanceTo(f.position) })).filter(n => n.d < 12).sort((a, b) => a.d - b.d);
    for (const { l } of near) {
      const taken = fliers.filter(o => o !== f && o.shelter?.leaf === l).map(o => o.shelter!);
      for (let attempt = 0; attempt < 16 && !leaf; attempt++) {
        const a = f.random() * Math.PI * 2, r = .1 + f.random() * .34;
        const tx = Math.cos(a) * r * .7, tz = Math.sin(a) * r;
        if (taken.every(o => Math.hypot(o.x - tx, o.z - tz) >= SHELTER_SPACING)) { leaf = l; x = tx; z = tz; }
      }
      if (leaf) break;
    }
    const grass = new THREE.Vector3(f.position.x + (f.random() - .5) * 3, 0, f.position.z + (f.random() - .5) * 3);
    grass.y = meadowGroundHeight(grass.x, grass.z) + .22 + f.random() * .12;
    f.shelter = { leaf, x, z, grass };
    f.flower = null; f.state = 'flying'; f.from.copy(f.position); f.t = 0;
    const target = shelterPoint(f, temp);
    f.bend.copy(f.from).lerp(target, .5); f.bend.y = Math.max(f.from.y, target.y) + .4;
    f.duration = Math.max(1, f.from.distanceTo(target) / (FLIGHT_SPEED * 1.6) + .5);
    f.perchYaw = f.random() * Math.PI * 2;
  }

  for (let id = 0; id < count && nectarFlowers.length; id++) {
    const f: Flier = {
      id, kind: 0, state: 'feeding', flower: null, position: new THREE.Vector3(), seen: false,
      random: rng((seed + id * 7919) >>> 0 || 3), phase: random() * 10,
      from: new THREE.Vector3(), bend: new THREE.Vector3(), t: 0, duration: 1,
      feedLeft: 0, perchAngle: random() * Math.PI * 2, perchYaw: random() * Math.PI * 2, rotation: new THREE.Quaternion(), perchFlower: null, perchHeight: 0,
      shelter: null, baskLeft: 0, baskNext: false,
    };
    // About half the common blues are brown females.
    f.kind = Math.floor(random() * BUTTERFLY_KINDS.length); if (f.kind === 0 && random() < .5) f.kind = FEMALE_BLUE;
    meshes.setKind(id, f.kind);
    fliers.push(f);
  }
  function place() {
    for (const f of fliers) {
      f.flower = null; f.seen = false; f.shelter = null; f.baskLeft = 0; f.baskNext = false;
      const flower = chooseFlower(f, null);
      if (flower && f.random() < .6) {
        f.flower = flower; f.state = 'feeding'; f.feedLeft = 4 + f.random() * 14;
        perchPoint(f, flower, f.position);
      } else {
        const a = f.random() * Math.PI * 2, r = 5 + f.random() * 16;
        f.position.set(Math.cos(a) * r, 2.5 + f.random() * 2.5, Math.sin(a) * r - 3);
        takeOff(f, null);
      }
    }
  }
  place();

  const update = (time: number, dt: number, bee: THREE.Vector3, reduced: boolean, world: ButterflyWorld) => {
    const wet = world.rain > .08, dry = world.rain < .03;
    for (const f of fliers) {
      let open: number;
      if (wet && !f.shelter) seekShelter(f);
      if (f.state === 'sheltering') {
        // Out again once the rain has passed, each in its own time; it basks first.
        if (dry && !reduced && f.random() < dt * .4) { f.shelter = null; f.baskNext = true; takeOff(f, world); }
      }
      if (f.state === 'sheltering' && f.shelter) {
        shelterPoint(f, f.position);
        yawTurn.setFromAxisAngle(up, f.perchYaw);
        if (f.shelter.leaf) f.rotation.copy(f.shelter.leaf.rotation).multiply(flip).multiply(yawTurn);
        else f.rotation.copy(yawTurn);
        // Mostly still with wings closed: a slow, tiny breathing, and now and
        // then (about every 9 s, each on its own timing) a brief parting.
        if (reduced) open = 1.42;
        else {
          const flick = Math.max(0, (Math.sin(time * .7 + f.phase * 5) - .95) / .05);
          open = 1.42 + Math.sin(time * 1.4 + f.phase) * .07 - .35 * flick * flick;
        }
      } else if (f.state === 'feeding' && f.flower) {
        const flower = f.flower;
        if (!reduced) f.feedLeft -= dt;
        const tooClose = bee.distanceTo(f.position) < SHY_DISTANCE || flower.id === world.beeFlower;
        if (world.nectar(flower.id) > 0 && dt > 0) world.sip(flower.id, Math.min(world.nectar(flower.id), SIP_RATE * dt));
        // Under heavy cloud it often sits a while longer (too cool to fly far).
        if (!reduced && f.feedLeft <= 0 && world.sun < .3 && !tooClose && f.random() < .6) f.feedLeft = 6 + f.random() * 8;
        if (f.baskLeft > 0 && !reduced) f.baskLeft -= dt;
        if (!reduced && (f.feedLeft <= 0 || tooClose || world.nectar(flower.id) <= .05)) takeOff(f, world);
        perchPoint(f, flower, f.position);
        // Sit on the flower's surface, facing its own way; wings mostly closed,
        // now and then opened flat to bask.
        yawTurn.setFromAxisAngle(up, f.perchYaw);
        f.rotation.copy(flower.rotation).multiply(yawTurn);
        const bask = f.baskLeft > 0 ? 1 : reduced ? 0 : Math.max(0, Math.sin(time * .45 + f.phase)) ** 3 * Math.min(1, world.sun * 1.5);
        open = 1.35 - 1.28 * bask + (reduced ? 0 : Math.sin(time * 2.2 + f.phase) * .06);
      } else {
        // The bee (or another butterfly) got there first: pick another flower from here.
        if (f.flower && (f.flower.id === world.beeFlower || busy(f.flower, f))) takeOff(f, world);
        // With reduced motion, a butterfly heading for shelter is simply there.
        f.t = Math.min(1, f.t + (reduced ? (f.shelter ? 1 : 0) : dt / f.duration));
        const target = f.shelter ? shelterPoint(f, temp) : f.flower ? perchPoint(f, f.flower, temp) : temp.copy(f.bend).setY(f.bend.y - 1);
        const t = f.t, u = 1 - t;
        previous.copy(f.position);
        f.position.copy(f.from).multiplyScalar(u * u).addScaledVector(f.bend, 2 * u * t).addScaledVector(target, t * t);
        // Butterfly flight bobs and wanders; it settles in the last stretch.
        const wander = Math.sin(t * Math.PI) * (reduced ? 0 : 1);
        f.position.y += Math.sin(time * 6.5 + f.phase) * .12 * wander;
        f.position.x += Math.sin(time * 2.9 + f.phase * 2) * .22 * wander;
        f.position.z += Math.cos(time * 2.3 + f.phase) * .22 * wander;
        if (f.t >= 1) {
          if (f.shelter) f.state = 'sheltering';
          else if (f.flower) {
            f.state = 'feeding'; f.feedLeft = 8 + f.random() * 12;
            // First stop after rain: open the wings to the sun and warm up.
            if (f.baskNext) { f.baskNext = false; f.baskLeft = 6 + f.random() * 6; f.feedLeft = Math.max(f.feedLeft, f.baskLeft + 4); }
          } else takeOff(f, world);
        }
        temp.subVectors(f.position, previous);
        if (temp.lengthSq() > 1e-8) {
          temp.y *= .3;
          look.lookAt(temp.normalize().negate(), origin, up);
          f.rotation.setFromRotationMatrix(look);
        }
        open = reduced ? .9 : .15 + 1.05 * (.5 + .5 * Math.sin(time * 38 + f.phase));
      }
      meshes.pose(f.id, f.position, f.rotation, open);
    }
    meshes.commit(fliers.length);
  };

  return {
    butterflies: fliers as readonly Butterfly[],
    update,
    nearest(position: THREE.Vector3) {
      let best: Flier | null = null, distance = Infinity;
      for (const f of fliers) { const d = f.position.distanceTo(position); if (d < distance) { distance = d; best = f; } }
      return best ? { butterfly: best as Butterfly, distance } : null;
    },
    markSeen(id: number) { const f = fliers[id]; if (f) f.seen = true; },
    seenCount() { return fliers.filter(f => f.seen).length; },
    reset() { place(); },
    diagnostics() { return { count: fliers.length, seen: fliers.filter(f => f.seen).length, feeding: fliers.filter(f => f.state === 'feeding').length, sheltering: fliers.filter(f => f.state === 'sheltering').length, onPoppies: fliers.filter(f => f.state === 'feeding' && f.flower?.species === 'poppy').length }; },
    dispose() { scene.remove(meshes.wings, meshes.bodies); meshes.dispose(); },
  };
}
