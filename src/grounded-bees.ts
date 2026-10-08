import * as THREE from 'three';
import { meadowGroundHeight, rng } from './world';
import { leafSurfaceHeight, type LeafShelter } from './shelters';
import type { PuddleSpot } from './types';

/**
 * Bees in the grass: other foragers from the hive, grounded in the meadow.
 *
 * A **tired** bee stands upright on a leaf top or at a pool's rim, too chilled or worn out to
 * fly; now and then she shivers her wings (real bees warm their flight muscles that way). The
 * player can land beside her and hold F to share a little nectar: she grooms, buzzes and flies
 * home. A **fallen** bee lies still on her side, legs curled; her note says what went wrong for
 * her (cold rain, heat, or simply a long, full life), which is what the player must avoid too.
 *
 * Both use the same small body, built from a dozen meshes; there are only ever a few of them.
 */

export type GroundedKind = 'tired' | 'fallen';
/** Why a fallen bee died: caught in cold rain, the heat, or worn out by a forager's short life. */
export type FallenCause = 'cold' | 'heat' | 'worn';
export type TiredState = 'resting' | 'grooming' | 'warming' | 'leaving' | 'gone';
/** Where a bee is placed: on a broad leaf's top, or on the ground by a pool. */
export type GroundedPlace = 'leaf' | 'rim';

export interface GroundedBee {
  id: number;
  kind: GroundedKind;
  place: GroundedPlace;
  /** Tired bees: what she's doing; fallen bees stay 'resting'. */
  state: TiredState;
  position: THREE.Vector3;
  leafId: number | null;
  cause: FallenCause | null;
  /** 0–1: how much of the shared nectar she has had. */
  fed: number;
  seen: boolean;
}
export interface GroundedPlan { tired: GroundedPlace[]; fallen: { place: GroundedPlace; cause: FallenCause }[] }

/** Seconds of holding F to share, and how long she grooms and warms up before flying. */
export const SHARE_TIME = 2.4, GROOM_TIME = 1.6, WARM_TIME = 1.1, LEAVE_TIME = 5;

interface Bee extends GroundedBee {
  group: THREE.Group;
  wings: THREE.Object3D[];
  antennae: THREE.Object3D[];
  forelegs: THREE.Object3D[];
  leaf: LeafShelter | null;
  /** Leaf-local point and heading (leaf), or world point (rim). */
  local: THREE.Vector3;
  heading: number;
  age: number;
  phase: number;
  from: THREE.Vector3;
  /** Her tongue, reaching out to take the drop while she's fed, and a mark at her mouth. */
  proboscis: THREE.Object3D;
  mouth: THREE.Object3D;
  /** Seconds of sharing left (refreshed while F is held), how far her tongue is out, and where the giver is. */
  sharing: number;
  reach: number;
  giver: THREE.Vector3;
}

const GOLD = '#d9a441', DARK = '#3d2b1c', FUZZ = '#a37b45', LEG = '#2e2219', EYE = '#1f1812';

export function createGroundedBees(scene: THREE.Scene, seed: number, shelters: readonly LeafShelter[], pools: readonly PuddleSpot[]) {
  const root = new THREE.Group(); root.name = 'grounded bees'; scene.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T) => { geometries.push(g); return g; };
  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...extra }); materials.push(m); return m; };

  // ---- one bee's parts (shared geometry), about 1.4 cm long; she faces +z.
  const abdomen = keep(new THREE.SphereGeometry(1, 14, 10));
  {
    // Banded: dark and gold rings along the body, a dark tip.
    const gold = new THREE.Color(GOLD), dark = new THREE.Color(DARK), c = new THREE.Color(), colours: number[] = [];
    const p = abdomen.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const band = Math.sin((z + 1) * Math.PI * 2.5) > .15 || z < -.82;
      c.copy(band ? dark : gold).lerp(gold, z > .7 ? .4 : 0);
      colours.push(c.r, c.g, c.b);
    }
    abdomen.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  }
  const ball = keep(new THREE.SphereGeometry(1, 10, 8));
  const stick = keep(new THREE.CylinderGeometry(.5, .5, 1, 5).translate(0, -.5, 0));
  const wing = keep(new THREE.CircleGeometry(1, 16));
  const abdomenMat = mat('#ffffff', { vertexColors: true, roughness: .65 });
  const thoraxMat = mat(FUZZ, { roughness: 1 }), headMat = mat(DARK), eyeMat = mat(EYE, { roughness: .35 }), legMat = mat(LEG);
  const wingMat = mat('#f4f1e2', { transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false, roughness: .3 });
  const fallenThorax = mat('#8f7a5e', { roughness: 1 });
  const fallenTint = new THREE.Color('#8a7a68');
  const fallenAbdomen = mat('#ffffff', { vertexColors: true, roughness: .9, color: fallenTint.clone().lerp(new THREE.Color('#ffffff'), .3) });

  function part(geometry: THREE.BufferGeometry, material: THREE.Material, s: [number, number, number], p: [number, number, number], parent: THREE.Object3D) {
    const m = new THREE.Mesh(geometry, material); m.scale.set(...s); m.position.set(...p); parent.add(m); return m;
  }
  function limb(parent: THREE.Object3D, at: [number, number, number], yaw: number, out: number, length: number): THREE.Object3D {
    // Hip, then a thigh down and out, then a shin down to the ground.
    const hip = new THREE.Group(); hip.position.set(...at); hip.rotation.y = yaw; parent.add(hip);
    const thigh = new THREE.Group(); thigh.rotation.z = out; hip.add(thigh);
    part(stick, legMat, [.004, length * .45, .004], [0, 0, 0], thigh);
    const knee = new THREE.Group(); knee.position.y = -length * .45; knee.rotation.z = -out * 1.6; thigh.add(knee);
    part(stick, legMat, [.003, length * .55, .003], [0, 0, 0], knee);
    return hip;
  }
  function build(fallen: boolean) {
    const group = new THREE.Group();
    const body = new THREE.Group(); body.position.y = .028; group.add(body);
    part(abdomen, fallen ? fallenAbdomen : abdomenMat, [.024, .022, .042], [0, .004, -.04], body);
    part(ball, fallen ? fallenThorax : thoraxMat, [.024, .022, .026], [0, .01, .012], body);
    part(ball, headMat, [.017, .016, .014], [0, .01, .048], body);
    for (const x of [-1, 1]) part(ball, eyeMat, [.006, .011, .008], [x * .013, .013, .049], body);
    const antennae: THREE.Object3D[] = [];
    for (const x of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(x * .006, .022, .058); a.rotation.set(-1.0, 0, x * .35); body.add(a);
      part(stick, legMat, [.0025, .012, .0025], [0, 0, 0], a).rotation.x = Math.PI;
      const flag = new THREE.Group(); flag.position.y = .012; flag.rotation.x = .9; a.add(flag);
      part(stick, legMat, [.0022, .02, .0022], [0, 0, 0], flag).rotation.x = Math.PI;
      antennae.push(a);
    }
    // Wings folded back over the abdomen, a little apart.
    const wings: THREE.Object3D[] = [];
    for (const x of [-1, 1]) for (const fore of [true, false]) {
      const w = new THREE.Group(); w.position.set(x * .01, .032, .018); body.add(w);
      const m = part(wing, wingMat, fore ? [.012, .042, 1] : [.009, .03, 1], [0, 0, -(fore ? .042 : .032)], w);
      m.rotation.x = -Math.PI / 2;
      w.rotation.set(fore ? .05 : 0, x * (fore ? .16 : .24), 0);
      w.userData.rest = { y: w.rotation.y, x: w.rotation.x };
      wings.push(w);
    }
    const forelegs: THREE.Object3D[] = [];
    for (const x of [-1, 1]) {
      forelegs.push(limb(body, [x * .012, -.004, .026], x * -.4, x * -1.0, .03));
      limb(body, [x * .014, -.006, .012], 0, x * -1.05, .034);
      limb(body, [x * .013, -.006, -.002], x * .45, x * -1.0, .042);
    }
    if (fallen) {
      // Rolled most of the way onto her back, legs drawn in.
      body.rotation.z = Math.PI * .8; body.position.y = .03;
      body.traverse(o => { if (o.parent && (o.parent as THREE.Group).rotation && o instanceof THREE.Group && o.children.length === 2) o.rotation.z *= .35; });
    }
    group.visible = false; root.add(group);
    // Her tongue (folded away until she's fed) and her mouth, just under the head.
    const proboscis = new THREE.Group(); proboscis.position.set(0, -.002, .058); proboscis.rotation.x = .35; proboscis.visible = false; body.add(proboscis);
    part(stick, legMat, [.0028, .026, .0028], [0, 0, 0], proboscis).rotation.x = -Math.PI / 2;
    const mouth = new THREE.Group(); mouth.position.set(0, -.01, .078); body.add(mouth);
    return { group, wings, antennae, forelegs, proboscis, mouth };
  }

  const bees: Bee[] = [];
  const turn = new THREE.Quaternion(), yawTurn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), target = new THREE.Vector3(), home = new THREE.Vector3();
  let lastTime = 0;

  function placeBee(bee: Bee, random: () => number, usedLeaves: Set<number>, usedPools: Set<number>, near: THREE.Vector3 | null) {
    if (bee.place === 'leaf') {
      const options = shelters.filter(l => !usedLeaves.has(l.id)).map(l => ({ l, d: near ? l.center.distanceTo(near) : 10 + random() * 6 }));
      options.sort((a, b) => a.d - b.d);
      const pick = options[Math.min(options.length - 1, Math.floor(random() * Math.min(3, options.length)))];
      if (pick) {
        const leaf = pick.l; usedLeaves.add(leaf.id); bee.leaf = leaf; bee.leafId = leaf.id;
        // Just ahead of where a bee lands on the leaf top.
        turn.copy(leaf.rotation).invert();
        const perch = target.copy(leaf.topPerch).sub(leaf.center).applyQuaternion(turn);
        const angle = random() * Math.PI * 2;
        bee.local.set(perch.x + Math.sin(angle) * .4, 0, perch.z + Math.cos(angle) * .4);
        bee.local.y = leafSurfaceHeight(bee.local.x, bee.local.z);
        bee.heading = random() * Math.PI * 2;
        return;
      }
      bee.place = 'rim';
    }
    const options = pools.map((p, i) => ({ p, i, d: near ? Math.hypot(p.x - near.x, p.z - near.z) : random() })).filter(o => !usedPools.has(o.i)).sort((a, b) => a.d - b.d);
    const pick = options[Math.min(options.length - 1, Math.floor(random() * Math.min(2, options.length)))] ?? { p: { x: 2, z: 3, radius: .4 }, i: -1 };
    usedPools.add(pick.i);
    const angle = random() * Math.PI * 2, r = pick.p.radius + .12;
    bee.local.set(pick.p.x + Math.sin(angle) * r, 0, pick.p.z + Math.cos(angle) * r);
    bee.local.y = meadowGroundHeight(bee.local.x, bee.local.z) + .01;
    bee.heading = angle + Math.PI;
  }

  function pose(bee: Bee, time: number, reducedMotion: boolean) {
    const g = bee.group;
    if (bee.state === 'gone') { g.visible = false; return; }
    g.visible = true;
    if (bee.state === 'leaving') {
      // Up out of the grass, then off toward the hive.
      const t = Math.min(1, bee.age / LEAVE_TIME), rise = THREE.MathUtils.smoothstep(t, 0, .25);
      g.position.copy(bee.from).addScaledVector(up, rise * 1.4);
      target.subVectors(home, g.position).setY(0).normalize();
      g.position.addScaledVector(target, Math.max(0, t - .15) * 14);
      g.quaternion.setFromAxisAngle(up, Math.atan2(target.x, target.z));
      bee.position.copy(g.position);
      for (const w of bee.wings) w.rotation.y = w.userData.rest.y * 3 + Math.sin(time * 90) * .9;
      if (t >= 1) bee.state = 'gone';
      return;
    }
    if (bee.leaf) {
      g.position.copy(bee.local).applyQuaternion(bee.leaf.rotation).add(bee.leaf.center);
      yawTurn.setFromAxisAngle(up, bee.heading);
      g.quaternion.copy(bee.leaf.rotation).multiply(yawTurn);
    } else {
      g.position.copy(bee.local);
      g.quaternion.setFromAxisAngle(up, bee.heading);
    }
    bee.position.copy(g.position).addScaledVector(up, .03);
    if (bee.kind === 'fallen' || reducedMotion) return;
    const t = time + bee.phase;
    // Antennae sway; now and then a shiver of the wings, more while she's being fed.
    bee.antennae.forEach((a, i) => { a.rotation.x = -1.0 + Math.sin(t * 1.7 + i) * .18; });
    const shivering = bee.state === 'warming' || bee.fed > 0 && bee.state === 'resting' || (t % 6) < .7;
    const buzz = bee.state === 'warming' ? .5 : shivering ? .08 : 0;
    for (const w of bee.wings) w.rotation.y = w.userData.rest.y * (bee.state === 'warming' ? 2.5 : 1) + Math.sin(time * 70) * buzz;
    // Grooming: the forelegs rub over the head.
    bee.forelegs.forEach((leg, i) => { leg.rotation.x = bee.state === 'grooming' ? -1.1 + Math.sin(time * 9 + i * Math.PI) * .45 : 0; });
  }

  return {
    bees: bees as readonly GroundedBee[],
    /** Places the day's bees: tired ones (leaf tops, pool rims) and fallen ones. `near` biases the first toward the start. */
    startDay(plan: GroundedPlan, day: number, near: THREE.Vector3 | null, hive: THREE.Vector3) {
      home.copy(hive);
      for (const bee of bees) root.remove(bee.group);
      bees.length = 0;
      const random = rng((seed ^ (day + 1) * 0x9e37) >>> 0 || 31), usedLeaves = new Set<number>(), usedPools = new Set<number>();
      const add = (kind: GroundedKind, place: GroundedPlace, cause: FallenCause | null, first: boolean) => {
        const parts = build(kind === 'fallen');
        const bee: Bee = { id: bees.length, kind, place, state: 'resting', position: new THREE.Vector3(), leafId: null, cause, fed: 0, seen: false, ...parts, leaf: null, local: new THREE.Vector3(), heading: 0, age: 0, phase: random() * 10, from: new THREE.Vector3(), sharing: 0, reach: 0, giver: new THREE.Vector3() };
        placeBee(bee, random, usedLeaves, usedPools, first ? near : null);
        bees.push(bee); pose(bee, 0, true);
      };
      plan.tired.forEach((p, i) => add('tired', p, null, i === 0));
      plan.fallen.forEach(f => add('fallen', f.place, f.cause, false));
    },
    update(time: number, reducedMotion: boolean) {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      for (const bee of bees) {
        if (bee.kind === 'tired' && bee.state !== 'resting' && bee.state !== 'gone') {
          bee.age += dt;
          if (bee.state === 'grooming' && bee.age >= GROOM_TIME) { bee.state = 'warming'; bee.age = 0; }
          else if (bee.state === 'warming' && bee.age >= WARM_TIME) { bee.state = 'leaving'; bee.age = 0; bee.from.copy(bee.group.position); }
          if (reducedMotion && bee.state === 'leaving') bee.state = 'gone';
        }
        if (bee.kind === 'tired') {
          // Being fed: she turns her head to the giver and reaches out her tongue for the drop.
          bee.sharing = Math.max(0, bee.sharing - dt);
          const sharing = bee.sharing > 0 && bee.state === 'resting';
          bee.reach = reducedMotion ? (sharing ? 1 : 0) : THREE.MathUtils.damp(bee.reach, sharing ? 1 : 0, 6, dt);
          if (sharing) {
            target.copy(bee.giver);
            if (bee.leaf) target.sub(bee.leaf.center).applyQuaternion(turn.copy(bee.leaf.rotation).invert());
            const want = Math.atan2(target.x - bee.local.x, target.z - bee.local.z);
            const delta = Math.atan2(Math.sin(want - bee.heading), Math.cos(want - bee.heading));
            bee.heading += reducedMotion ? delta : delta * (1 - Math.exp(-5 * dt));
          }
          bee.proboscis.visible = bee.reach > .03;
          bee.proboscis.scale.set(1, 1, Math.max(.01, bee.reach));
        }
        pose(bee, time, reducedMotion);
      }
    },
    /** The nearest tired bee still waiting for help, within reach of a point. */
    waiting(point: THREE.Vector3, reach: number, leafId: number | null = null): GroundedBee | null {
      let found: Bee | null = null, best = reach;
      for (const bee of bees) {
        if (bee.kind !== 'tired' || bee.state !== 'resting') continue;
        const d = bee.position.distanceTo(point);
        if (d < best || leafId !== null && bee.leafId === leafId && d < reach * 1.6) { best = d; found = bee; }
      }
      return found;
    },
    /** Shares nectar for a moment; returns true once she has had enough and starts to recover. */
    feed(id: number, dt: number, giver?: THREE.Vector3): boolean {
      const bee = bees[id];
      if (!bee || bee.kind !== 'tired' || bee.state !== 'resting') return false;
      bee.sharing = .25; if (giver) bee.giver.copy(giver);
      bee.fed = Math.min(1, bee.fed + dt / SHARE_TIME);
      if (bee.fed < 1) return false;
      bee.state = 'grooming'; bee.age = 0;
      return true;
    },
    /** Where her mouth is now (world), for the giver's tongue to reach. */
    mouth(id: number, out: THREE.Vector3): THREE.Vector3 {
      const bee = bees[id];
      if (!bee) return out;
      bee.group.updateMatrixWorld(true);
      return bee.mouth.getWorldPosition(out);
    },
    /** How far her tongue is out (0–1). */
    reach(id: number) { return bees[id]?.reach ?? 0; },
    markSeen(id: number) { const bee = bees[id]; if (bee) bee.seen = true; },
    helpedCount() { return bees.filter(b => b.kind === 'tired' && b.fed >= 1).length; },
    diagnostics() { return bees.map(b => ({ id: b.id, kind: b.kind, place: b.place, state: b.state, cause: b.cause, fed: b.fed, seen: b.seen, leafId: b.leafId, position: b.position.toArray() })); },
    dispose() { scene.remove(root); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}

/** How many grounded bees a day has, and why the fallen ones fell. Tired foragers are more
 * likely after cold rain or in a long hot spell, when real foragers get grounded. `stress`
 * (0–1, from the hive's stores in the summers arc, 0 for now) adds fallen bees in a bad run. */
export function planGroundedBees(random: () => number, weather: { showers: number; hot: boolean }, stress = 0): GroundedPlan {
  const tired: GroundedPlace[] = ['leaf'];
  if (weather.showers > 0 || weather.hot) tired.push('rim');
  const fallen: GroundedPlan['fallen'] = [];
  if (weather.showers > 0 && random() < .45 + stress * .4) fallen.push({ place: 'rim', cause: 'cold' });
  else if (weather.hot && random() < .45 + stress * .4) fallen.push({ place: random() < .5 ? 'rim' : 'leaf', cause: 'heat' });
  else if (random() < .25 + stress * .5) fallen.push({ place: 'leaf', cause: 'worn' });
  if (stress > .5 && random() < stress) fallen.push({ place: 'leaf', cause: 'worn' });
  return { tired, fallen };
}
