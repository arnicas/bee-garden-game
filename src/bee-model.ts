import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import beeUrl from './assets/bee.glb?url';

/**
 * The bee model (src/assets/bee.glb, made by tools/shrink-bee-glb.mjs from the Meshy model):
 * a worker about 1.5 cm long, true scale in metres, standing level with her origin on the
 * ground between her feet and her head toward +z. Her wings, antennae and forelegs are
 * pivot nodes at their hinges, so they can flutter, sway and groom; each wing carries a
 * folded-back rest turn. Loaded once; until it arrives (or if it fails) the grounded bees
 * keep their simple built shapes.
 */
export interface BeeModelParts {
  root: THREE.Group;
  /** Wings with their folded rest turn and side (1 left, -1 right). */
  wings: { node: THREE.Object3D; rest: THREE.Quaternion; side: number }[];
  antennae: THREE.Object3D[];
  forelegs: THREE.Object3D[];
  /** Her mouth, in the model's own (metre) frame. */
  mouth: THREE.Vector3;
}

/** Metres to game units (1 unit = 10 cm). */
export const BEE_MODEL_SCALE = 10;

let source: THREE.Group | null = null;
let loading: Promise<THREE.Group | null> | null = null;
let bodyMaterial: THREE.MeshStandardMaterial | null = null, wingMaterial: THREE.MeshStandardMaterial | null = null, fallenMaterial: THREE.MeshStandardMaterial | null = null;

/** Starts loading the model (once); resolves to it, or null if it couldn't be loaded. */
export function loadBeeModel(): Promise<THREE.Group | null> {
  loading ??= new GLTFLoader().loadAsync(beeUrl).then(gltf => {
    source = gltf.scene;
    source.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!bodyMaterial) {
        bodyMaterial = material;
        bodyMaterial.side = THREE.FrontSide;
        // Wings: the same painted texture, partly see-through.
        wingMaterial = material.clone(); wingMaterial.transparent = true; wingMaterial.opacity = .62; wingMaterial.depthWrite = false; wingMaterial.side = THREE.DoubleSide;
        // A fallen bee: dulled and greyed, her colour gone.
        fallenMaterial = material.clone(); fallenMaterial.color.set('#9a8c7c'); fallenMaterial.roughness = .95;
      }
    });
    return source;
  }).catch(error => { console.warn('[bee-garden] bee model not loaded; using the built bees', error); return null; });
  return loading;
}

/** Whether the model has arrived. */
export function beeModelReady(): boolean { return !!source; }

/** A copy of the model for one bee (geometry and textures shared), or null before it has loaded. */
export function cloneBeeModel(fallen: boolean): BeeModelParts | null {
  if (!source || !bodyMaterial || !wingMaterial || !fallenMaterial) return null;
  const root = source.clone(true) as THREE.Group;
  const parts: BeeModelParts = { root, wings: [], antennae: [], forelegs: [], mouth: new THREE.Vector3() };
  root.traverse(o => {
    const name = o.name;
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = name.startsWith('wing_') ? wingMaterial! : fallen ? fallenMaterial! : bodyMaterial!;
    if (name.endsWith('_mesh')) return;
    const side = name.endsWith('_L') ? 1 : -1;
    if (name.startsWith('wing_')) {
      const rest = new THREE.Quaternion().fromArray((o.userData.rest as number[] | undefined) ?? [0, 0, 0, 1]);
      parts.wings.push({ node: o, rest, side });
      o.quaternion.copy(rest);
    } else if (name.startsWith('antenna_')) parts.antennae.push(o);
    else if (name.startsWith('foreleg_')) parts.forelegs.push(o);
    else if (name === 'body' && Array.isArray(o.userData.mouth)) parts.mouth.fromArray(o.userData.mouth as number[]);
  });
  root.scale.setScalar(BEE_MODEL_SCALE);
  return parts;
}
