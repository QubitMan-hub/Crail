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
  /**
   * What still shows if this character ends up in a uniform: the colour of the trim,
   * the colour of the hair that peeks out, and what kind they were.
   */
  identity: { kind: string; trim: string; hair: string };
  /**
   * The thing a thief would take (a boot, a sock, a cap, a medal), kept as its own
   * piece so it can disappear, and what shows in its place when it has gone.
   */
  loot?: { item: THREE.Object3D; bare?: THREE.Object3D };
}

/** Hand over the loot: it goes, and what was under it shows. */
export function setLoot(rig: Rig, on: boolean): void {
  if (!rig.loot) return;
  rig.loot.item.visible = on;
  if (rig.loot.bare) rig.loot.bare.visible = !on;
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

const baked = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });

/** Fuse everything still under `parent` into a single mesh (for scenery and costumes). */
export function fuse<T extends THREE.Object3D>(parent: T): T {
  mergeUnder(parent, new Set());
  return parent;
}

/** Merge every still mesh under `parent` into one, keeping colours. Stops at anything in `live`. */
function mergeUnder(parent: THREE.Object3D, live: Set<THREE.Object3D>): void {
  const parts: THREE.BufferGeometry[] = [];
  const done: THREE.Mesh[] = [];
  const walk = (node: THREE.Object3D, toParent: THREE.Matrix4) => {
    for (const child of node.children) {
      if (live.has(child) || (child as THREE.Sprite).isSprite) continue;
      child.updateMatrix();
      const m = toParent.clone().multiply(child.matrix);
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        src.applyMatrix4(m);
        const c = (mesh.material as THREE.MeshStandardMaterial).color;
        const n = src.attributes.position.count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', src.attributes.position);
        g.setAttribute('normal', src.attributes.normal);
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
        done.push(mesh);
      } else walk(child, m);
    }
  };
  walk(parent, new THREE.Matrix4());
  if (parts.length < 2) return;
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color'] as const) {
    const out = new Float32Array(total * 3);
    let at = 0;
    for (const g of parts) {
      out.set(g.attributes[name].array as Float32Array, at);
      at += g.attributes[name].count * 3;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  for (const mesh of done) mesh.removeFromParent();
  const one = new THREE.Mesh(merged, baked);
  one.castShadow = true;
  parent.add(one);
}

/**
 * A character is built from dozens of little boxes. Drawing each one separately is
 * slow, so once it is built, everything that never moves on its own is fused into one
 * mesh per limb. Only the parts that animate (eyelids, brows, swinging hair) stay loose.
 */
export function bake(rig: Rig): Rig {
  const face = [...rig.lids, ...rig.brows, ...rig.pupils, rig.mouth];
  for (const f of face) f.castShadow = false;
  const loose = rig.loot ? [rig.loot.item, ...(rig.loot.bare ? [rig.loot.bare] : [])] : [];
  const live = new Set<THREE.Object3D>([...face, ...rig.sway, ...rig.hang, rig.emote, ...loose]);
  for (const part of [rig.torso, rig.head, rig.armL, rig.armR, rig.legL, rig.legR]) mergeUnder(part, live);
  for (const s of new Set([...rig.sway, ...rig.hang])) mergeUnder(s, live);
  for (const l of loose) mergeUnder(l, new Set());
  if (rig.loot?.bare) rig.loot.bare.visible = false;
  return rig;
}
