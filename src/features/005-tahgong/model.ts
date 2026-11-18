import * as THREE from 'three';
import { box, fuse, group } from '../../characters/rig';

const CORAL = '#f29a86';
const CORAL_DARK = '#d97a68';
const BELLY = '#ffd9cc';
const INK = '#1d1b19';
const WHITE = '#fffdf8';

export interface SquidRig {
  root: THREE.Group;
  body: THREE.Group;
  lids: THREE.Mesh[];
  /** Eight short arms round the bottom, each two joints. */
  arms: THREE.Group[][];
  /** Two long tentacles at the front: one of them waves, and carries things. */
  tentacles: THREE.Group[][];
  /** Where something he is carrying sits: the tip of the right tentacle. */
  hand: THREE.Group;
}

/** A blocky squid, a little taller than the cube: a pointed mantle with fins, big kind eyes. */
export function buildSquid(): SquidRig {
  const root = new THREE.Group();
  const body = group(root);
  const mantle = group(body, 0, 0.14, 0);
  box(mantle, CORAL, 0.56, 0.5, 0.52, 0, 0.25, 0);
  box(mantle, CORAL, 0.48, 0.3, 0.46, 0, 0.64, -0.01);
  box(mantle, CORAL, 0.36, 0.22, 0.34, 0, 0.9, -0.03);
  box(mantle, CORAL_DARK, 0.2, 0.16, 0.2, 0, 1.08, -0.05);
  // Fins either side of the point.
  for (const s of [1, -1]) {
    box(mantle, CORAL_DARK, 0.16, 0.26, 0.3, s * 0.27, 0.9, -0.03);
    box(mantle, CORAL_DARK, 0.1, 0.14, 0.22, s * 0.37, 0.96, -0.03);
  }
  box(mantle, BELLY, 0.4, 0.3, 0.02, 0, 0.18, 0.261);
  // Freckles.
  for (const [x, y] of [[-0.12, 0.62], [0.14, 0.7], [0.02, 0.82]] as const) box(mantle, CORAL_DARK, 0.06, 0.06, 0.02, x, y, 0.236);
  // A small, pleased smile.
  box(mantle, '#c2475f', 0.12, 0.03, 0.02, 0, 0.12, 0.272);
  box(mantle, '#c2475f', 0.03, 0.03, 0.02, -0.07, 0.14, 0.272);
  box(mantle, '#c2475f', 0.03, 0.03, 0.02, 0.07, 0.14, 0.272);
  fuse(mantle);
  // Big round-ish eyes with a shine.
  const lids: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    box(mantle, WHITE, 0.17, 0.19, 0.02, s * 0.13, 0.33, 0.27).castShadow = false;
    box(mantle, INK, 0.1, 0.12, 0.02, s * 0.13, 0.32, 0.282).castShadow = false;
    box(mantle, WHITE, 0.04, 0.04, 0.02, s * 0.13 + 0.03, 0.35, 0.294).castShadow = false;
    const lid = box(mantle, CORAL, 0.18, 0.06, 0.025, s * 0.13, 0.44, 0.296);
    lid.castShadow = false;
    lids.push(lid);
  }

  const limb = (parent: THREE.Object3D, segs: [number, number][], color = CORAL) => {
    const joints: THREE.Group[] = [];
    let at: THREE.Object3D = parent;
    segs.forEach(([thick, long], j) => {
      const joint = group(at, 0, 0, j === 0 ? 0 : segs[j - 1][1] - 0.02);
      box(joint, j === segs.length - 1 ? CORAL_DARK : color, thick, thick, long, 0, 0, long / 2);
      joints.push(joint);
      at = joint;
    });
    return joints;
  };
  const arms: THREE.Group[][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const base = group(body, Math.sin(a) * 0.24, 0.12, Math.cos(a) * 0.24);
    base.rotation.y = a;
    arms.push(limb(base, [[0.12, 0.2], [0.09, 0.18]]));
  }
  const tentacles: THREE.Group[][] = [];
  for (const s of [1, -1]) {
    const base = group(body, s * 0.12, 0.14, 0.22);
    base.rotation.y = s * 0.25;
    tentacles.push(limb(base, [[0.09, 0.26], [0.08, 0.26], [0.07, 0.22], [0.13, 0.12]]));
  }
  const hand = group(tentacles[0][3], 0, 0.08, 0.1);
  return { root, body, lids, arms, tentacles, hand };
}
