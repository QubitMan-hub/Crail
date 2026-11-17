import * as THREE from 'three';
import type { Stealable } from '../../core/loot';
import { box, buildBow, fuse, group } from '../../characters/rig';

const TEAL = '#2f9c95';
const TEAL_DARK = '#237a75';
const BELLY = '#8fd6c9';
const INK = '#1d1b19';
const WHITE = '#fffdf8';

export interface OctopusRig {
  root: THREE.Group;
  /** Everything above the floor: bobs, squashes and leans. */
  body: THREE.Group;
  lids: THREE.Mesh[];
  /** Eight arms, each a chain of joints from the body outward. */
  arms: { joints: THREE.Group[]; angle: number }[];
  /** Where things it is carrying sit, one per raised arm. */
  hands: THREE.Group[];
}

/** A blocky octopus, about the size of the cube, in a bandit mask. */
export function buildOctopus(): OctopusRig {
  const root = new THREE.Group();
  const body = group(root);
  // The mantle: a big soft dome that sags backward, sitting on a skirt of webbing.
  const head = group(body, 0, 0.2, 0);
  box(head, TEAL, 1.0, 0.16, 1.0, 0, 0.04, 0); // the web between the arms
  box(head, TEAL, 0.84, 0.5, 0.8, 0, 0.33, 0);
  box(head, TEAL, 0.8, 0.3, 0.78, 0, 0.7, -0.07);
  box(head, TEAL, 0.64, 0.2, 0.64, 0, 0.93, -0.13);
  box(head, TEAL_DARK, 0.42, 0.1, 0.44, 0, 1.06, -0.18);
  box(head, BELLY, 0.5, 0.08, 0.02, 0, 0.14, 0.401);
  // Spots.
  box(head, TEAL_DARK, 0.16, 0.02, 0.16, -0.2, 1.035, 0.04);
  box(head, TEAL_DARK, 0.1, 0.1, 0.02, 0.26, 0.74, 0.322);
  box(head, TEAL_DARK, 0.12, 0.02, 0.12, 0.2, 1.035, -0.3);
  // The mask: a dark band right round, with the eyes showing through.
  box(head, INK, 0.86, 0.2, 0.82, 0, 0.42, 0);
  fuse(head);
  const lids: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    box(head, WHITE, 0.22, 0.17, 0.02, side * 0.2, 0.42, 0.416).castShadow = false;
    box(head, INK, 0.13, 0.07, 0.02, side * 0.2, 0.41, 0.428).castShadow = false; // a sideways slot of a pupil
    const lid = box(head, INK, 0.23, 0.08, 0.025, side * 0.2, 0.48, 0.43);
    lid.castShadow = false;
    lids.push(lid);
  }

  // Eight arms. Thick where they leave the body, tapering to a tip that curls, and
  // they lie along the floor instead of standing on it: tentacles, not legs.
  const SEGMENTS: [number, number][] = [[0.26, 0.26], [0.22, 0.24], [0.17, 0.22], [0.12, 0.2], [0.08, 0.16]];
  const arms: OctopusRig['arms'] = [];
  const hands: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const base = group(body, Math.sin(angle) * 0.34, 0.14, Math.cos(angle) * 0.34);
    base.rotation.y = angle;
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = base;
    SEGMENTS.forEach(([thick, long], j) => {
      const joint = group(parent, 0, 0, j === 0 ? 0 : SEGMENTS[j - 1][1] - 0.02);
      box(joint, j >= 3 ? TEAL_DARK : TEAL, thick, thick, long, 0, 0, long / 2);
      // Suckers underneath.
      box(joint, BELLY, thick * 0.55, 0.02, long * 0.7, 0, -thick / 2 - 0.004, long / 2).castShadow = false;
      joints.push(joint);
      parent = joint;
    });
    arms.push({ joints, angle });
    hands.push(group(joints[joints.length - 1], 0, 0.06, 0.16));
  }
  return { root, body, lids, arms, hands };
}

/** The thing it took, small enough to wave about. */
export function buildToken(kind: Stealable['token']): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'bow': {
      const bow = buildBow('#f6a8c4', '#ee6fa4');
      bow.scale.setScalar(1.2);
      g.add(bow);
      break;
    }
    case 'flag':
      box(g, '#b8322a', 0.5, 0.32, 0.04, 0, 0.16, 0);
      box(g, '#d6b24a', 0.12, 0.12, 0.05, 0, 0.16, 0);
      break;
    case 'balloon':
      box(g, '#f2542d', 0.3, 0.36, 0.3, 0, 0.5, 0);
      box(g, INK, 0.015, 0.34, 0.015, 0, 0.16, 0).castShadow = false;
      break;
    case 'charm': {
      const a = box(g, '#ee6fa4', 0.26, 0.26, 0.06, 0, 0.2, 0);
      a.rotation.z = Math.PI / 4;
      box(g, '#ffd6e6', 0.1, 0.1, 0.07, 0, 0.2, 0).rotation.z = Math.PI / 4;
      break;
    }
    case 'boot':
      box(g, INK, 0.16, 0.26, 0.16, 0, 0.17, -0.04);
      box(g, INK, 0.16, 0.1, 0.3, 0, 0.05, 0.03);
      box(g, '#7b4bd6', 0.17, 0.04, 0.17, 0, 0.27, -0.04);
      break;
    case 'sock':
      ['#f6a8c4', WHITE, '#9fd0f5', WHITE].forEach((c, i) => box(g, c, 0.14, 0.075, 0.14, 0, 0.3 - i * 0.075, 0));
      box(g, '#f6a8c4', 0.14, 0.09, 0.24, 0, 0.0, 0.05);
      break;
    case 'cap':
      box(g, '#6f7752', 0.34, 0.1, 0.34, 0, 0.14, 0);
      box(g, '#c8452f', 0.3, 0.05, 0.3, 0, 0.07, 0);
      box(g, INK, 0.24, 0.03, 0.12, 0, 0.05, 0.2);
      break;
    case 'medal':
      box(g, '#c8452f', 0.1, 0.16, 0.03, 0, 0.26, 0);
      box(g, '#d6b24a', 0.2, 0.2, 0.04, 0, 0.1, 0);
      break;
  }
  return g;
}

/** Its home: a tide pool with a rim of stones, and a rock beside it where the loot piles up. */
export function buildPool(): { root: THREE.Group; water: THREE.Mesh; shelf: THREE.Group } {
  const root = new THREE.Group();
  const still = group(root);
  box(still, '#cfc6b4', 3.1, 0.06, 3.1, 0, 0.03, 0);
  // Rim stones, uneven on purpose.
  const stones: [number, number, number, number][] = [
    [-1.4, -1.4, 0.5, 0.24], [-0.7, -1.5, 0.6, 0.16], [0.2, -1.5, 0.7, 0.2], [1.4, -1.4, 0.5, 0.26],
    [1.5, -0.6, 0.5, 0.18], [1.5, 0.4, 0.6, 0.22], [-1.5, -0.5, 0.5, 0.2], [-1.5, 0.5, 0.6, 0.16],
    [-1.4, 1.4, 0.5, 0.22], [-0.5, 1.5, 0.6, 0.18], [1.4, 1.4, 0.5, 0.2],
  ];
  stones.forEach(([x, z, w, h], i) => box(still, i % 2 ? '#a59f96' : '#8d8a96', w, h, w * 0.85, x, h / 2, z));
  // Seaweed.
  for (const [x, z, h] of [[-1.15, 1.05, 0.7], [-1.0, 1.2, 0.5], [1.1, -1.1, 0.6]] as const) box(still, '#4f8a5b', 0.08, h, 0.08, x, h / 2, z);
  fuse(still);
  const water = box(root, '#6fc3d6', 2.5, 0.02, 2.5, 0, 0.075, 0);
  water.material = new THREE.MeshStandardMaterial({ color: '#6fc3d6', roughness: 0.25, transparent: true, opacity: 0.85 });
  water.castShadow = false;
  // The shelf: a flat rock, one cell to the side, where it keeps what it took.
  const shelf = group(root, 2, 0, 0);
  box(shelf, '#8d8a96', 0.92, 0.3, 0.92, 0, 0.15, 0);
  box(shelf, '#a59f96', 0.7, 0.1, 0.7, 0, 0.35, 0);
  return { root, water, shelf };
}
