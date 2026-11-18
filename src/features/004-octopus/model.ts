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
    case 'battery':
      box(g, '#2b2a2e', 0.2, 0.3, 0.2, 0, 0.17, 0);
      box(g, '#f6c445', 0.21, 0.12, 0.21, 0, 0.26, 0);
      box(g, '#c9ccd2', 0.08, 0.05, 0.08, 0, 0.345, 0);
      break;
    case 'medal':
      box(g, '#c8452f', 0.1, 0.16, 0.03, 0, 0.26, 0);
      box(g, '#d6b24a', 0.2, 0.2, 0.04, 0, 0.1, 0);
      break;
  }
  return g;
}

/**
 * His home: an irregular tide pool, a blob of water cells with a sandy shore, stones on
 * the edge, seaweed and a couple of shells, and a flat rock beside it for the loot.
 * `cells` are relative to the den (his own spot, the deepest part); `shelf` likewise.
 */
export function buildPool(cells: [number, number][], shelf: [number, number], deep: (x: number, z: number) => boolean): { root: THREE.Group; shelf: THREE.Group } {
  const root = new THREE.Group();
  const inPool = new Set(cells.map(([x, z]) => `${x},${z}`));
  const wet = (x: number, z: number) => inPool.has(`${x},${z}`);
  // Sand: every cell touching the water, and the water's own bed.
  const sand = group(root);
  const shore = new Set<string>();
  for (const [x, z] of cells) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!wet(x + dx, z + dz)) shore.add(`${x + dx},${z + dz}`);
  }
  for (const key of shore) {
    const [x, z] = key.split(',').map(Number);
    box(sand, '#ddd3bf', 1, 0.03, 1, x, 0.015, z);
  }
  // The bed: sand in the shallows, darker and lower where it is deep.
  for (const [x, z] of cells) box(sand, deep(x, z) ? '#7f9590' : '#c9bba0', 1, 0.05, 1, x, deep(x, z) ? 0.0 : 0.025, z);
  for (const [x, z] of cells) if (!deep(x, z) && (x * 3 + z) % 4 === 0) box(sand, '#a89a83', 0.14, 0.06, 0.12, x + 0.2, 0.06, z - 0.15); // pebbles
  // Stones where the water meets the shore, on the water side, uneven on purpose.
  let n = 0;
  for (const [x, z] of cells) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (wet(x + dx, z + dz) || (n++ % 3 !== 0 && !(dx === 0 && dz === 1))) continue;
      const h = 0.14 + ((x * 7 + z * 3 + dx) % 3) * 0.05;
      const w = 0.32 + ((x + z * 5) % 3) * 0.06;
      box(sand, n % 2 ? '#a59f96' : '#8d8a96', dz ? w : 0.26, h, dx ? w : 0.26, x + dx * 0.4, h / 2, z + dz * 0.4);
    }
  }
  // Seaweed in the shallows, and two shells on the sand.
  for (const [x, z, h] of [[-3.3, 1.2, 0.7], [-3.1, 1.4, 0.5], [1.3, -1.3, 0.6], [-1.3, 2.3, 0.55]] as const) box(sand, '#4f8a5b', 0.08, h, 0.08, x, h / 2, z);
  box(sand, '#f3d8c7', 0.16, 0.06, 0.12, 2.6, 0.06, 1.3);
  box(sand, '#e9b7a3', 0.12, 0.05, 0.1, -4.6, 0.055, 0.6);
  fuse(sand);
  // The shelf: a flat rock on the shore, where he keeps what he took.
  const rock = group(root, shelf[0], 0, shelf[1]);
  box(rock, '#8d8a96', 0.92, 0.3, 0.92, 0, 0.15, 0);
  box(rock, '#a59f96', 0.7, 0.1, 0.7, 0, 0.35, 0);
  return { root, shelf: rock };
}
