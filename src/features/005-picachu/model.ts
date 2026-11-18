import * as THREE from 'three';
import { box, fuse, group } from '../../characters/rig';

/**
 * Picachu: an off-brand electric critter (spelled the way the comment spelled it).
 * Deliberately not anyone's famous mascot: round stubby ears, no cheek circles, a
 * battery gauge on its belly, a little antenna with a bulb, and a power plug for a tail.
 */
const YELLOW = '#f4c534';
const YELLOW_DARK = '#d9a520';
const CREAM = '#fff1c4';
const INK = '#1d1b19';
const WHITE = '#fffdf8';

export interface CritterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  lids: THREE.Mesh[];
  /** Three bars on the belly gauge, lit as it charges. */
  bars: THREE.Mesh[];
  bulb: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  feet: THREE.Group[];
  tail: THREE.Group[];
}

export function buildCritter(): CritterRig {
  const root = new THREE.Group();
  const body = group(root);
  const torso = group(body, 0, 0.12, 0);
  box(torso, YELLOW, 0.5, 0.4, 0.42, 0, 0.2, 0);
  box(torso, YELLOW, 0.44, 0.06, 0.36, 0, 0.42, 0);
  box(torso, CREAM, 0.34, 0.26, 0.02, 0, 0.18, 0.211);
  // The battery gauge: a dark case with a nub, three bars inside.
  box(torso, INK, 0.24, 0.13, 0.025, 0, 0.19, 0.222);
  box(torso, INK, 0.03, 0.06, 0.025, 0.135, 0.19, 0.222);
  fuse(torso);
  const bars = [-0.07, 0, 0.07].map((x) => {
    const b = box(torso, '#3a3a3a', 0.055, 0.08, 0.03, x, 0.19, 0.232);
    b.material = new THREE.MeshBasicMaterial({ color: '#3a3a3a' });
    b.castShadow = false;
    return b;
  });

  const head = group(body, 0, 0.56, 0);
  box(head, YELLOW, 0.54, 0.42, 0.46, 0, 0.21, 0);
  box(head, YELLOW_DARK, 0.5, 0.05, 0.42, 0, 0.44, 0);
  // Round, stubby ears with warm insides.
  for (const s of [1, -1]) {
    box(head, YELLOW, 0.18, 0.16, 0.12, s * 0.2, 0.5, -0.02);
    box(head, '#f08a3c', 0.1, 0.09, 0.02, s * 0.2, 0.5, 0.045);
  }
  box(head, INK, 0.05, 0.03, 0.02, 0, 0.16, 0.235); // nose
  box(head, '#b35a3a', 0.12, 0.025, 0.02, 0, 0.1, 0.235); // smile
  fuse(head);
  const lids: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    box(head, INK, 0.1, 0.13, 0.02, s * 0.13, 0.24, 0.235).castShadow = false;
    box(head, WHITE, 0.04, 0.04, 0.02, s * 0.13 + 0.025, 0.27, 0.247).castShadow = false;
    const lid = box(head, YELLOW, 0.11, 0.05, 0.025, s * 0.13, 0.32, 0.25);
    lid.castShadow = false;
    lids.push(lid);
  }
  // An antenna with a bulb that lights up when it is charged.
  box(head, '#b87333', 0.03, 0.18, 0.03, 0, 0.53, 0);
  const bulb = box(head, '#bfe6ff', 0.1, 0.1, 0.1, 0, 0.66, 0);
  bulb.material = new THREE.MeshStandardMaterial({ color: '#bfe6ff', emissive: '#5ab8ff', emissiveIntensity: 0 });

  const limb = (x: number, y: number) => {
    const g = group(body, x, y, 0.05);
    box(g, YELLOW, 0.1, 0.18, 0.1, 0, -0.07, 0);
    return g;
  };
  const armL = limb(0.29, 0.44);
  const armR = limb(-0.29, 0.44);
  const feet = [1, -1].map((s) => {
    const f = group(body, s * 0.13, 0.08, 0.03);
    box(f, YELLOW_DARK, 0.14, 0.09, 0.2, 0, -0.035, 0.03);
    return f;
  });
  // The tail: a short cord ending in a plug with two prongs.
  const tail: THREE.Group[] = [];
  let at: THREE.Object3D = group(body, 0, 0.2, -0.21);
  for (let i = 0; i < 3; i++) {
    const seg = group(at, 0, 0, i === 0 ? 0 : -0.14);
    box(seg, '#2b2a2e', 0.05, 0.05, 0.16, 0, 0, -0.07);
    tail.push(seg);
    at = seg;
  }
  const plug = group(at, 0, 0, -0.15);
  box(plug, '#3d3c42', 0.14, 0.12, 0.12, 0, 0, -0.06);
  for (const s of [1, -1]) box(plug, '#c9ccd2', 0.025, 0.025, 0.1, s * 0.035, 0, -0.16);
  fuse(plug);
  return { root, body, head, lids, bars, bulb, armL, armR, feet, tail };
}
