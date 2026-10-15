import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meadowGroundHeight, rng } from './world';
import type { Flower } from './types';

/**
 * A few moths for the night between summers. Small, soft grey-buff moths (about
 * 3 cm across) come up out of the grass as it gets dark and loop round the
 * flowers in quick, jittery circles, nothing like a butterfly's lazy glide. They
 * favour the daisies: pale flowers show up by moonlight, and many night moths
 * visit pale, open flowers. Now and then one settles on a daisy for a moment,
 * wings held flat. In rain they drop back into the grass; at dawn they go down
 * into it to rest out the day. Scenery only: they aren't counted as finds.
 * Two instanced draws: bodies and wings.
 */
export interface MothWorld {
  /** 0–1 how dark it is (from the sky). */
  night: number;
  /** 0–1 rain. */
  rain: number;
}
interface Moth {
  id: number;
  random: () => number;
  phase: number;
  /** The flower it is circling, and how: radius, height above the head, speed and direction. */
  flower: Flower | null;
  orbit: number; lift: number; speed: number; turn: number; angle: number;
  /** Seconds left on this flower, and on a rest on its face (0 when flying). */
  left: number; rest: number;
  /** Where it hides by day (down in the grass), and 0–1 how far up and out it is. */
  home: THREE.Vector3;
  out: number;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

const WING_SPAN = .15;
/** The moths come out once it is this dark, and go down again below it. */
const DARK_ENOUGH = .45;

function createMothMeshes(capacity: number) {
  // A broad, rounded-triangle forewing over a smaller hindwing, from the hinge (x outward, y forward).
  const shape = new THREE.Shape();
  const pts = [[0, .02], [.05, .045], [.11, .05], [.145, .03], [.14, .005], [.1, -.02], [.07, -.045], [.03, -.05], [0, -.03]].map(([x, y]) => new THREE.Vector2(x, y));
  shape.moveTo(pts[0].x, pts[0].y); shape.splineThru(pts.slice(1)); shape.lineTo(pts[0].x, pts[0].y);
  const wingGeometry = new THREE.ShapeGeometry(shape, 12).rotateX(-Math.PI / 2);
  // A painted wing: a buff-grey wash, a darker band and a small kidney mark, soft at the edge.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const wash = g.createLinearGradient(0, 0, 128, 0);
  wash.addColorStop(0, '#8d8371'); wash.addColorStop(.55, '#b9ae97'); wash.addColorStop(1, '#a29780');
  g.fillStyle = wash; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80,70,58,.55)'; g.lineWidth = 5; g.beginPath(); g.moveTo(70, 10); g.quadraticCurveTo(62, 64, 78, 120); g.stroke();
  g.fillStyle = 'rgba(70,62,52,.6)'; g.beginPath(); g.ellipse(92, 52, 7, 4, .4, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${i % 2 ? '60,52,44' : '225,216,196'},${.05 + (i % 7) * .012})`; g.fillRect((i * 37) % 128, (i * 59) % 128, 2, 2); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const uv = wingGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / .15, (uv.getY(i) + .05) / .1);
  uv.needsUpdate = true;
  // A faint glow of its own so it still reads against the dark grass by moonlight.
  const wingMaterial = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: .95, emissive: '#3a3528', emissiveIntensity: .55 });
  const wings = new THREE.InstancedMesh(wingGeometry, wingMaterial, Math.max(1, capacity * 2));
  wings.name = 'moth wings';
  const bodyGeometry = mergeGeometries([
    new THREE.SphereGeometry(1, 6, 4).scale(.012, .012, .045),
    new THREE.SphereGeometry(1, 5, 3).scale(.011, .011, .011).translate(0, 0, -.045),
    // Feathery antennae, swept back.
    new THREE.CylinderGeometry(.0012, .002, .05, 3).rotateX(1.1).rotateZ(.35).translate(.008, .012, -.07),
    new THREE.CylinderGeometry(.0012, .002, .05, 3).rotateX(1.1).rotateZ(-.35).translate(-.008, .012, -.07),
  ])!;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#6e6555', roughness: 1, emissive: '#2a261e', emissiveIntensity: .5 });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, Math.max(1, capacity));
  bodies.name = 'moth bodies';
  for (const mesh of [wings, bodies]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; }
  const body = new THREE.Matrix4(), part = new THREE.Matrix4(), turn = new THREE.Matrix4(), scale = new THREE.Vector3();
  return {
    wings, bodies,
    /** open: 0 wings flat out, larger raised over the back. */
    pose(i: number, at: THREE.Vector3, rotation: THREE.Quaternion, open: number, size: number) {
      body.compose(at, rotation, scale.setScalar(size));
      bodies.setMatrixAt(i, body);
      wings.setMatrixAt(i * 2, part.multiplyMatrices(body, turn.makeRotationZ(open)));
      wings.setMatrixAt(i * 2 + 1, part.multiplyMatrices(body, turn.makeRotationZ(Math.PI - open)));
    },
    commit(count: number) {
      bodies.count = count; wings.count = count * 2;
      bodies.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
    },
    dispose() { wingGeometry.dispose(); wingMaterial.dispose(); texture.dispose(); bodyGeometry.dispose(); bodyMaterial.dispose(); wings.dispose(); bodies.dispose(); },
  };
}

export function createMoths(scene: THREE.Scene, seed: number, flowers: readonly Flower[], count = 3) {
  const meshes = createMothMeshes(count);
  scene.add(meshes.wings, meshes.bodies);
  const daisies = flowers.filter(f => f.species === 'daisy'), others = flowers.filter(f => f.species === 'cornflower');
  const random = rng((seed ^ 0x6d07f1a3) >>> 0 || 29);
  const moths: Moth[] = [];
  const up = new THREE.Vector3(0, 1, 0), look = new THREE.Matrix4(), origin = new THREE.Vector3(), previous = new THREE.Vector3(), temp = new THREE.Vector3(), flat = new THREE.Quaternion();
  /** Mostly daisies (pale by moonlight), now and then a cornflower; near the moth's own patch. */
  const choose = (m: Moth): Flower | null => {
    const pool = others.length && m.random() < .2 ? others : daisies.length ? daisies : others;
    let best: Flower | null = null, bestScore = -Infinity;
    for (let i = 0; i < 6 && pool.length; i++) {
      const f = pool[Math.floor(m.random() * pool.length)];
      if (f === m.flower || moths.some(o => o !== m && o.flower === f)) continue;
      const score = -f.center.distanceTo(m.home) * .2 + m.random();
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return best;
  };
  const retarget = (m: Moth) => {
    m.flower = choose(m);
    m.orbit = .25 + m.random() * .45; m.lift = .15 + m.random() * .5;
    m.speed = 2.2 + m.random() * 1.6; m.turn = m.random() < .5 ? -1 : 1;
    m.left = 3 + m.random() * 5; m.rest = 0;
  };
  for (let id = 0; id < count && (daisies.length || others.length); id++) {
    const start = (daisies.length ? daisies : others)[Math.floor(random() * (daisies.length || others.length))];
    const home = new THREE.Vector3(start.base.x + (random() - .5) * 2, 0, start.base.z + (random() - .5) * 2);
    home.y = meadowGroundHeight(home.x, home.z) + .2;
    const m: Moth = { id, random: rng((seed + id * 4099) >>> 0 || 5), phase: random() * 10, flower: null, orbit: .4, lift: .3, speed: 2.5, turn: 1, angle: random() * Math.PI * 2, left: 0, rest: 0, home, out: 0, position: home.clone(), rotation: new THREE.Quaternion() };
    retarget(m);
    moths.push(m);
  }

  const update = (time: number, dt: number, reduced: boolean, world: MothWorld) => {
    const active = world.night > DARK_ENOUGH && world.rain < .08;
    for (const m of moths) {
      // Up out of the grass as it gets dark, back down at dawn or in rain.
      m.out = THREE.MathUtils.clamp(m.out + (active ? 1 : -1) * dt / (reduced ? .01 : 2.5), 0, 1);
      if (m.out <= 0) { meshes.pose(m.id, m.home, m.rotation, 0, 0); continue; }
      previous.copy(m.position);
      let open: number;
      if (m.flower && m.rest > 0) {
        // Settled on a daisy's face, wings flat; it twitches them now and then.
        m.rest -= dt;
        temp.set(Math.cos(m.angle) * m.flower.radius * .3, .06, Math.sin(m.angle) * m.flower.radius * .3).applyQuaternion(m.flower.rotation).add(m.flower.center);
        m.position.copy(temp);
        flat.setFromAxisAngle(up, -m.angle);
        m.rotation.copy(m.flower.rotation).multiply(flat);
        open = .12 + Math.max(0, Math.sin(time * 3 + m.phase) - .9) * 2;
        if (m.rest <= 0) retarget(m);
      } else {
        if (!reduced) { m.left -= dt; m.angle += m.turn * m.speed * dt / Math.max(.2, m.orbit); }
        if (m.left <= 0) {
          // Settle a moment on a daisy, or loop off to another flower.
          if (m.flower?.species === 'daisy' && m.random() < .35) m.rest = 1.5 + m.random() * 2.5;
          else retarget(m);
        }
        const target = m.flower ? m.flower.center : m.home;
        // Jittery loops: the orbit wobbles in and out and up and down at odd rhythms.
        const r = m.orbit * (1 + .35 * Math.sin(time * 5.3 + m.phase) + .2 * Math.sin(time * 9.1 + m.phase * 3));
        temp.set(target.x + Math.cos(m.angle) * r, target.y + m.lift + .18 * Math.sin(time * 6.7 + m.phase) + .08 * Math.sin(time * 13 + m.phase), target.z + Math.sin(m.angle) * r);
        // Rising out of the grass at dusk (or going down at dawn), it eases between home and the flower.
        temp.lerp(m.home, 1 - THREE.MathUtils.smoothstep(m.out, 0, 1));
        m.position.lerp(temp, Math.min(1, dt * 6));
        temp.subVectors(m.position, previous);
        if (temp.lengthSq() > 1e-8) { temp.y *= .4; look.lookAt(temp.normalize().negate(), origin, up); m.rotation.setFromRotationMatrix(look); }
        // Fast, shallow wingbeats.
        open = reduced ? .5 : .2 + .7 * (.5 + .5 * Math.sin(time * 46 + m.phase));
      }
      meshes.pose(m.id, m.position, m.rotation, open, Math.min(1, m.out * 1.5) * WING_SPAN / .15);
    }
    meshes.commit(moths.length);
    // By day they're all down in the grass: draw nothing.
    meshes.wings.visible = meshes.bodies.visible = moths.some(m => m.out > 0);
  };

  return {
    update,
    diagnostics() { return { count: moths.length, out: moths.filter(m => m.out > .5).length, resting: moths.filter(m => m.out > .5 && m.rest > 0).length, positions: moths.map(m => m.position.toArray()) }; },
    dispose() { scene.remove(meshes.wings, meshes.bodies); meshes.dispose(); },
  };
}
