import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Shared skeleton for the blocky characters: the same soft-edged matte boxes as the
 * cube, so everyone belongs in the same world. Local +z is "forward".
 */

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  lids: THREE.Mesh[];
  brows: THREE.Mesh[];
  pupils: THREE.Mesh[];
  mouth: THREE.Mesh;
  /** Hair that swings when she turns or walks. */
  sway: THREE.Object3D[];
  /** Long hair that keeps hanging straight down when the head tips. */
  hang: THREE.Object3D[];
  emote: THREE.Sprite;
  /** Long skirts hide the legs, so they swing less. */
  stride: number;
  /** Height (in head space) where something placed on the head should sit. */
  headTop: number;
}

export const HIP = 0.78;
/** Overall size. 1 would be exactly two cubes tall; this makes everyone about 1.7. */
export const SCALE = 0.85;
const materials = new Map<string, THREE.MeshStandardMaterial>();
export const mat = (color: string) => {
  let m = materials.get(color);
  if (!m) materials.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.72 })));
  return m;
};

export function box(
  parent: THREE.Object3D, color: string,
  w: number, h: number, d: number,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const thin = Math.min(w, h, d);
  const geo = thin < 0.03
    ? new THREE.BoxGeometry(w, h, d)
    : new RoundedBoxGeometry(w, h, d, 2, Math.min(0.035, thin * 0.42));
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function group(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export interface FaceStyle {
  white: string;
  pupil: string;
  lid: string;
  mouth: string;
  mouthWidth: number;
  /** Eyeshadow above the eye. */
  shadow?: string;
  /** Winged eyeliner. */
  wing?: boolean;
  /** Rosy cheeks. */
  blush?: string;
  brow: string;
}

export function buildFace(head: THREE.Group, f: FaceStyle) {
  const fz = 0.243;
  const lids: THREE.Mesh[] = [];
  const brows: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    box(head, f.white, 0.125, 0.1, 0.012, s * 0.125, 0.272, fz);
    pupils.push(box(head, f.pupil, 0.06, 0.085, 0.012, s * 0.125, 0.268, fz + 0.005));
    if (f.shadow) box(head, f.shadow, 0.145, 0.03, 0.012, s * 0.125, 0.35, fz);
    lids.push(box(head, f.lid, 0.145, 0.032, 0.02, s * 0.125, 0.323, fz + 0.004));
    if (f.wing) box(head, f.lid, 0.055, 0.024, 0.014, s * 0.205, 0.336, fz).rotation.z = s * 0.55;
    if (f.blush) box(head, f.blush, 0.1, 0.045, 0.012, s * 0.165, 0.185, fz);
    brows.push(box(head, f.brow, 0.13, 0.024, 0.014, s * 0.125, 0.392, fz));
  }
  const mouth = box(head, f.mouth, f.mouthWidth, 0.032, 0.012, 0, 0.125, fz);
  return { lids, brows, pupils, mouth };
}

/** A ribbon bow. Ends up on cubes and, occasionally, on people who did not ask for one. */
export function buildBow(color: string, knot: string): THREE.Group {
  const bow = new THREE.Group();
  for (const s of [1, -1]) box(bow, color, 0.2, 0.15, 0.07, s * 0.12, 0, 0).rotation.z = s * 0.35;
  box(bow, knot, 0.08, 0.09, 0.09, 0, 0, 0);
  return bow;
}
