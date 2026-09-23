import * as THREE from 'three';
import { createSeededRandom } from './utils/random';
import type { CarriedPollen, Species } from './types';

export function createBeeRig(camera: THREE.PerspectiveCamera) {
  const root = new THREE.Group(); camera.add(root);
  const shell = new THREE.MeshStandardMaterial({ color: '#654323', roughness: .77 });
  const gold = new THREE.MeshStandardMaterial({ color: '#b79146', roughness: .9 });
  const claw = new THREE.MeshStandardMaterial({ color: '#2b2821', roughness: .5 });
  const hairs = new THREE.LineBasicMaterial({ color: '#d4b66c', transparent: true, opacity: .64 });
  const legs: THREE.Group[] = [];
  const curls: (THREE.Mesh | THREE.LineSegments)[] = [];
  const joints: { mesh: THREE.Mesh; extended: THREE.Vector3; folded: THREE.Vector3 }[] = [];
  const pollenGeometry = new THREE.IcosahedronGeometry(1, 0);
  const pollenMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .92 });
  // Flower colors are an intentional visual shorthand for transferable pollen.
  const pollenTints = [
    { species: 'daisy', color: new THREE.Color('#fff4dc') },
    { species: 'poppy', color: new THREE.Color('#ed514c') },
    { species: 'cornflower', color: new THREE.Color('#639df5') },
  ] as const;
  const grainColors: THREE.Color[] = [];
  const grainRandom = createSeededRandom(496);
  const pollenCoats: { mesh: THREE.InstancedMesh; anchors: { extended: THREE.Vector3; folded: THREE.Vector3; size: number }[]; curl: number; count: number; palette: number }[] = [];
  const grainTransform = new THREE.Object3D();
  const grainsPerLeg = 36;
  const rng = createSeededRandom(86);
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.027, .09, -.10), new THREE.Vector3(.052, .15, -.19), new THREE.Vector3(.072, .11, -.24)];
  const foldedPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.014, .07, -.055), new THREE.Vector3(.020, .105, -.12), new THREE.Vector3(.085, .085, -.135), new THREE.Vector3(.092, .040, -.10), new THREE.Vector3(.050, .022, -.075)];
  const morph = (extended: THREE.BufferGeometry, folded: THREE.BufferGeometry) => {
    extended.morphAttributes.position = [folded.attributes.position];
    if (folded.attributes.normal) extended.morphAttributes.normal = [folded.attributes.normal];
    extended.computeBoundingSphere(); folded.dispose(); return extended;
  };
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * .29, -.28, -.28);
    leg.scale.x = -side;
    const path = new THREE.CatmullRomCurve3(points), foldedPath = new THREE.CatmullRomCurve3(foldedPoints);
    const tube = new THREE.Mesh(morph(new THREE.TubeGeometry(path, 28, .015, 7, false), new THREE.TubeGeometry(foldedPath, 28, .015, 7, false)), shell);
    leg.add(tube); curls.push(tube);
    const hairVertices: number[] = [], foldedHairVertices: number[] = [];
    for (let i = 0; i < 420; i++) {
      const t = rng(), angle = rng() * Math.PI * 2;
      const length = .01 + rng() * .013;
      for (const [curve, vertices] of [[path, hairVertices], [foldedPath, foldedHairVertices]] as const) {
        const p = curve.getPoint(t), tangent = curve.getTangent(t);
        const n = new THREE.Vector3(Math.cos(angle), Math.sin(angle), .12).projectOnPlane(tangent).normalize();
        p.addScaledVector(n, .014);
        const end = p.clone().addScaledVector(n, length).addScaledVector(tangent, -.006);
        vertices.push(p.x, p.y, p.z, end.x, end.y, end.z);
      }
    }
    const fuzzGeometry = morph(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hairVertices, 3)), new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(foldedHairVertices, 3)));
    const fuzz = new THREE.LineSegments(fuzzGeometry, hairs);
    leg.add(fuzz); curls.push(fuzz);
    // Grains share the hairs' leg-local rest/fold frames. Curl changes only the
    // existing pose; it never rebuilds geometry or lets pollen float off the arm.
    const coat = new THREE.InstancedMesh(pollenGeometry, pollenMaterial, grainsPerLeg);
    coat.name = 'loose pollen on foreleg knuckles';
    coat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < grainsPerLeg; i++) coat.setColorAt(i, pollenTints[0].color);
    coat.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    coat.boundingSphere = new THREE.Sphere(new THREE.Vector3(.02, .075, -.12), .2);
    coat.count = 0; coat.visible = false; leg.add(coat);
    const anchors = Array.from({ length: grainsPerLeg }, (_, i) => {
      // The outer knuckle stays in view when the claws tuck underneath in flight.
      // A generous newest-color patch reads at laptop size; older types remain
      // as smaller flecks around it, rather than blending into one muddy color.
      const knuckle = i % 3 !== 2;
      const t = knuckle ? .56 + grainRandom() * .18 : .32 + grainRandom() * .48;
      const angle = grainRandom() * Math.PI * 2;
      const anchor = (curve: THREE.CatmullRomCurve3) => curve.getPoint(t).addScaledVector(
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), .12).projectOnPlane(curve.getTangent(t)).normalize(), knuckle ? .021 : .019,
      );
      return { extended: anchor(path), folded: anchor(foldedPath), size: knuckle ? .0055 + grainRandom() * .002 : .0032 + grainRandom() * .0015 };
    });
    pollenCoats.push({ mesh: coat, anchors, curl: -1, count: -1, palette: -1 });
    for (const t of [.28, .64]) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(.020, 10, 8), gold);
      joint.position.copy(path.getPoint(t)); joint.scale.set(1, .8, 1.2); leg.add(joint);
      joints.push({ mesh: joint, extended: path.getPoint(t), folded: foldedPath.getPoint(t) });
    }
    for (const offset of [-.006, .006]) {
      const hook = new THREE.CatmullRomCurve3([new THREE.Vector3(.071 + offset, .11, -.24), new THREE.Vector3(.079 + offset, .095, -.253), new THREE.Vector3(.073 + offset, .085, -.256)]);
      const foldedHook = new THREE.CatmullRomCurve3([new THREE.Vector3(.050 + offset, .022, -.075), new THREE.Vector3(.043 + offset, .023, -.068), new THREE.Vector3(.045 + offset, .032, -.066)]);
      const tip = new THREE.Mesh(morph(new THREE.TubeGeometry(hook, 8, .0025, 5, false), new THREE.TubeGeometry(foldedHook, 8, .0025, 5, false)), claw);
      leg.add(tip); curls.push(tip);
    }
    root.add(leg); legs.push(leg);
  }
  const tongueSteps = 48, tongueSides = 8;
  const tongueMat = new THREE.MeshStandardMaterial({ color: '#9c643f', roughness: .38 });
  // One continuous tapered surface avoids the exposed cylinder ends that made
  // the old proboscis read as a stack of joints pointing back at the player.
  const tongueGeo = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)), tongueSteps, .004, tongueSides, false);
  const tongue = new THREE.Mesh(tongueGeo, tongueMat); root.add(tongue);
  const tonguePositions = tongueGeo.attributes.position as THREE.BufferAttribute;
  const tongueNormals = tongueGeo.attributes.normal as THREE.BufferAttribute;
  tonguePositions.setUsage(THREE.DynamicDrawUsage); tongueNormals.setUsage(THREE.DynamicDrawUsage);
  const centers = Array.from({ length: tongueSteps + 1 }, () => new THREE.Vector3());
  const tangent = new THREE.Vector3(), previousTangent = new THREE.Vector3();
  const frameNormal = new THREE.Vector3(), frameBinormal = new THREE.Vector3(), radial = new THREE.Vector3();
  const frameTurn = new THREE.Quaternion();
  let extension = 0, curl = 1;
  // The foreground rig is presented after the meadow so close petals cannot
  // hide the bee's own legs. Its tongue tip still resolves the real nectar point.
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.renderOrder = object instanceof THREE.InstancedMesh ? 21 : 20;
      const material = object.material as THREE.Material;
      material.depthTest = false; material.depthWrite = false;
    }
  });
  return {
    tongueTipMaterial: tongueMat,
    snapPose(landed: boolean, drinking = false) { curl = landed ? 0 : 1; extension = drinking ? 1 : 0; },
    curlAmount() { return curl; },
    tonguePose() { return { extension, visible: tongue.visible }; },
    writeTongueContact(tip: THREE.Vector3, approach: THREE.Vector3) {
      tip.copy(centers[tongueSteps]).applyMatrix4(camera.matrixWorld);
      approach.copy(centers[tongueSteps - 3]).applyMatrix4(camera.matrixWorld);
    },
    pollenCount() { return pollenCoats.reduce((count, coat) => count + coat.mesh.count, 0); },
    pollenColors() {
      const counts: Record<string, number> = {}, color = new THREE.Color();
      for (const { mesh } of pollenCoats) for (let i = 0; i < mesh.count; i++) {
        mesh.getColorAt(i, color);
        const hex = `#${color.getHexString()}`;
        counts[hex] = (counts[hex] ?? 0) + 1;
      }
      return counts;
    },
    update(time: number, landed: boolean, drinking: boolean, visible: boolean, dt: number, nectarPoint?: THREE.Vector3, carriedPollen?: CarriedPollen, satiated = false, nectarBend?: THREE.Vector3, recentPollen?: Species) {
      root.visible = visible;
      extension = THREE.MathUtils.damp(extension, drinking ? 1 : 0, 10, dt);
      curl = THREE.MathUtils.damp(curl, landed ? 0 : 1, 7, dt);
      for (const mesh of curls) mesh.morphTargetInfluences![0] = curl;
      for (const joint of joints) joint.mesh.position.lerpVectors(joint.extended, joint.folded, curl);
      let looseAmount = 0, palette = 0;
      grainColors.length = 0;
      for (let i = 0; i < pollenTints.length; i++) {
        const { species, color } = pollenTints[i], amount = carriedPollen?.[species] ?? 0;
        if (amount > .01) {
          looseAmount += amount; palette |= 1 << i;
          if (species === recentPollen) { grainColors.unshift(color); palette |= (i + 1) << 3; }
          else grainColors.push(color);
        }
      }
      const grainCount = looseAmount > 0 ? Math.min(grainsPerLeg, Math.max(8, Math.ceil(looseAmount * grainsPerLeg * 2))) : 0;
      for (const coat of pollenCoats) {
        coat.mesh.count = grainCount; coat.mesh.visible = grainCount > 0;
        if (grainCount > 0 && (coat.palette !== palette || coat.count !== grainCount)) {
          // Two thirds of the grains form the newest-color knuckle patch.
          // The remaining flecks show other still-transferable pollen types.
          for (let i = 0; i < grainCount; i++) {
            const color = i % 3 === 2 && grainColors.length > 1 ? grainColors[1 + Math.floor(i / 3) % (grainColors.length - 1)] : grainColors[0];
            coat.mesh.setColorAt(i, color);
          }
          coat.mesh.instanceColor!.needsUpdate = true;
        }
        if (grainCount > 0 && (Math.abs(coat.curl - curl) > .0001 || coat.count !== grainCount)) {
          for (let i = 0; i < grainCount; i++) {
            const anchor = coat.anchors[i];
            grainTransform.position.lerpVectors(anchor.extended, anchor.folded, curl);
            grainTransform.scale.set(anchor.size, anchor.size * .85, anchor.size * 1.15);
            grainTransform.updateMatrix(); coat.mesh.setMatrixAt(i, grainTransform.matrix);
          }
          coat.mesh.instanceMatrix.needsUpdate = true;
          coat.curl = curl;
        }
        coat.count = grainCount; coat.palette = palette;
      }
      legs.forEach((leg, i) => {
        const side = i === 0 ? -1 : 1;
        leg.rotation.z = side * (THREE.MathUtils.lerp(.20, -.04, curl) + extension * .36);
        leg.rotation.x = THREE.MathUtils.lerp(-.24, .10, curl) + Math.sin(time * 3 + i) * .025 * (1 - curl) + Math.sin(time * 14 + i) * .009 * curl;
        leg.position.y = THREE.MathUtils.lerp(-.245, -.285, curl) + Math.sin(time * 2 + i) * .003;
      });
      tongue.visible = extension > .025 || (landed && satiated);
      const sample = (t: number, out: THREE.Vector3) => {
        const tx = nectarPoint?.x ?? 0, ty = nectarPoint?.y ?? -.02, tz = nectarPoint?.z ?? -.7;
        // Blend the small resting coil below the view into the drinking curve.
        const coil = Math.max(0, (t - .3) / .7), angle = coil * Math.PI * 2.5;
        const radius = .028 * (1 - coil * .65), neck = Math.min(1, t / .3);
        const restX = Math.sin(angle) * radius * neck;
        const restY = -.20 + neck * .06 + (Math.cos(angle) * radius - .028) * neck;
        const restZ = -.16 - neck * .24 - coil * .008;
        // A shallow arch approaches from above the liquid, without a high
        // hooked end that projects back toward the viewer.
        const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return out.set(THREE.MathUtils.lerp(restX, c * (nectarBend?.x ?? tx) + d * tx + Math.sin(t * 5 - time * 9) * Math.sin(t * Math.PI) * .001, extension),
          THREE.MathUtils.lerp(restY, a * -.20 + b * -.12 + c * (nectarBend?.y ?? ty + .05) + d * ty, extension),
          THREE.MathUtils.lerp(restZ, a * -.16 + b * -.28 + c * (nectarBend?.z ?? tz + .015) + d * tz, extension));
      };
      for (let i = 0; i <= tongueSteps; i++) sample(i / tongueSteps, centers[i]);
      for (let i = 0; i <= tongueSteps; i++) {
        tangent.subVectors(centers[Math.min(tongueSteps, i + 1)], centers[Math.max(0, i - 1)]).normalize();
        if (i === 0) {
          frameNormal.set(0, 1, 0).addScaledVector(tangent, -tangent.y);
          if (frameNormal.lengthSq() < .001) frameNormal.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
          frameNormal.normalize();
        } else {
          frameTurn.setFromUnitVectors(previousTangent, tangent);
          frameNormal.applyQuaternion(frameTurn).normalize();
        }
        frameBinormal.crossVectors(tangent, frameNormal).normalize();
        previousTangent.copy(tangent);
        const radius = THREE.MathUtils.lerp(.005, .0022, i / tongueSteps);
        for (let j = 0; j <= tongueSides; j++) {
          const angle = j / tongueSides * Math.PI * 2, vertex = i * (tongueSides + 1) + j;
          radial.copy(frameNormal).multiplyScalar(-Math.cos(angle)).addScaledVector(frameBinormal, Math.sin(angle));
          tongueNormals.setXYZ(vertex, radial.x, radial.y, radial.z);
          tonguePositions.setXYZ(vertex, centers[i].x + radial.x * radius, centers[i].y + radial.y * radius, centers[i].z + radial.z * radius);
        }
      }
      tonguePositions.needsUpdate = true; tongueNormals.needsUpdate = true;
      tongueGeo.computeBoundingSphere();
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      root.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) geometries.add(o.geometry);
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      geometries.forEach(geometry => geometry.dispose());
      [shell, gold, claw, hairs, tongueMat, pollenMaterial].forEach(m => m.dispose()); root.removeFromParent();
    },
  };
}
