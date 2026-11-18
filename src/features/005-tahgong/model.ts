import * as THREE from 'three';
import { box, fuse, group } from '../../characters/rig';

const CORAL = '#f29a86';
const CORAL_DARK = '#d6705f';
const CORAL_LIGHT = '#ffc2b2';
const INK = '#1d1b19';
const WHITE = '#fffdf8';

export interface SquidRig {
  root: THREE.Group;
  /** Everything: bobs, jets and leans. */
  body: THREE.Group;
  /** The long mantle above the head: it squashes and stretches as he jets. */
  mantle: THREE.Group;
  /** The arrowhead fin at the top: it flaps. */
  fins: THREE.Group[];
  lids: THREE.Mesh[];
  /** Eight arms round the bottom, each three joints. */
  arms: THREE.Group[][];
  /** Two long feeding tentacles with club tips: one waves, and carries things. */
  tentacles: THREE.Group[][];
  /** Where something he is carrying sits: the club of the right tentacle. */
  hand: THREE.Group;
}

/**
 * A blocky squid. What makes it read as a squid and not an octopus: a long, narrow
 * mantle that tapers to a point, a big arrowhead fin at the top, large eyes low down
 * where the head is, eight short arms and two much longer tentacles with clubs.
 */
export function buildSquid(): SquidRig {
  const root = new THREE.Group();
  const body = group(root);

  // The head: a short, wide block with the eyes and the smile.
  const head = group(body, 0, 0.12, 0);
  box(head, CORAL, 0.5, 0.32, 0.46, 0, 0.16, 0);
  box(head, CORAL_LIGHT, 0.36, 0.08, 0.02, 0, 0.04, 0.232);
  box(head, '#c2475f', 0.12, 0.03, 0.02, 0, 0.07, 0.242); // a small, pleased smile
  box(head, '#c2475f', 0.03, 0.03, 0.02, -0.07, 0.09, 0.242);
  box(head, '#c2475f', 0.03, 0.03, 0.02, 0.07, 0.09, 0.242);
  fuse(head);
  const lids: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    // Big eyes, set wide, wrapping round the front corners.
    box(head, WHITE, 0.17, 0.2, 0.02, s * 0.15, 0.2, 0.24).castShadow = false;
    box(head, WHITE, 0.02, 0.2, 0.14, s * 0.252, 0.2, 0.15).castShadow = false;
    box(head, INK, 0.1, 0.13, 0.02, s * 0.16, 0.19, 0.252).castShadow = false;
    box(head, WHITE, 0.04, 0.04, 0.02, s * 0.16 + 0.03, 0.22, 0.264).castShadow = false;
    const lid = box(head, CORAL, 0.18, 0.06, 0.025, s * 0.15, 0.32, 0.258);
    lid.castShadow = false;
    lids.push(lid);
  }

  // The mantle: long and narrow, tapering upward, with darker spots.
  const mantle = group(body, 0, 0.44, 0);
  box(mantle, CORAL, 0.42, 0.3, 0.4, 0, 0.15, 0);
  box(mantle, CORAL, 0.36, 0.26, 0.34, 0, 0.42, 0);
  box(mantle, CORAL, 0.28, 0.22, 0.27, 0, 0.66, 0);
  box(mantle, CORAL, 0.2, 0.18, 0.19, 0, 0.86, 0);
  box(mantle, CORAL_DARK, 0.12, 0.12, 0.12, 0, 1.0, 0);
  for (const [x, y, z] of [[-0.1, 0.18, 0.201], [0.12, 0.34, 0.171], [-0.06, 0.52, 0.171], [0.07, 0.68, 0.136]] as const) {
    box(mantle, CORAL_DARK, 0.06, 0.06, 0.02, x, y, z);
  }
  fuse(mantle);
  // The fin: an arrowhead, wide in the middle and pointed at the top, one flap each side.
  const fins: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const fin = group(mantle, s * 0.1, 0.78, 0);
    for (const [w, y] of [[0.12, -0.12], [0.24, -0.02], [0.36, 0.08], [0.3, 0.18], [0.2, 0.28], [0.1, 0.37]] as const) {
      box(fin, CORAL_DARK, w, 0.1, 0.08, s * (w / 2), y, 0);
    }
    box(fin, CORAL_LIGHT, 0.2, 0.06, 0.085, s * 0.12, 0.08, 0); // a paler streak
    fuse(fin);
    fins.push(fin);
  }

  const limb = (parent: THREE.Object3D, segs: [number, number][], tip?: [number, number]) => {
    const joints: THREE.Group[] = [];
    let at: THREE.Object3D = parent;
    segs.forEach(([thick, long], j) => {
      const joint = group(at, 0, 0, j === 0 ? 0 : segs[j - 1][1] - 0.02);
      box(joint, j === segs.length - 1 && !tip ? CORAL_DARK : CORAL, thick, thick, long, 0, 0, long / 2);
      box(joint, CORAL_LIGHT, thick * 0.55, 0.02, long * 0.7, 0, -thick / 2 - 0.004, long / 2).castShadow = false;
      joints.push(joint);
      at = joint;
    });
    if (tip) {
      // The club: a wider, flattened tip.
      const [w, l] = tip;
      box(joints[joints.length - 1], CORAL_DARK, w, w * 0.6, l, 0, 0, segs[segs.length - 1][1] + l / 2 - 0.02);
    }
    return joints;
  };
  const arms: THREE.Group[][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const base = group(body, Math.sin(a) * 0.2, 0.1, Math.cos(a) * 0.2);
    base.rotation.y = a;
    arms.push(limb(base, [[0.16, 0.24], [0.13, 0.22], [0.1, 0.18]]));
  }
  const tentacles: THREE.Group[][] = [];
  for (const s of [1, -1]) {
    const base = group(body, s * 0.12, 0.12, 0.2);
    base.rotation.y = s * 0.2;
    tentacles.push(limb(base, [[0.13, 0.32], [0.12, 0.3], [0.11, 0.28], [0.1, 0.24]], [0.22, 0.22]));
  }
  const hand = group(tentacles[0][3], 0, 0.12, 0.38);
  return { root, body, mantle, fins, lids, arms, tentacles, hand };
}
