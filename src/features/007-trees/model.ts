import * as THREE from 'three';
import { box, group } from '../../characters/rig';

/**
 * Trees, in the same soft blocks as everything else, sized against the characters (about
 * 1.7 tall): canopies start above head height. Every builder takes a random source, so
 * no two trees of a kind come out quite the same (height, lean of the crown, colour).
 */

export type TreeKind = 'pine' | 'cypress' | 'oak' | 'birch' | 'blossom' | 'maple' | 'apple' | 'bush';

/** The main colour of each kind's leaves, for the leaves that fall when the cube bumps one. */
export const LEAF_OF: Record<TreeKind, string[]> = {
  pine: ['#3f8a4e', '#2f6e40'],
  cypress: ['#3b7d4c', '#2d673e'],
  oak: ['#5faa45', '#4e9440'],
  birch: ['#a5cf5c', '#8fbf4a'],
  blossom: ['#f6b9cb', '#fbd3df', '#ffffff'],
  maple: ['#e2763a', '#d9532f', '#f0a03c'],
  apple: ['#5ea648', '#d9473a'],
  bush: ['#5fa94a', '#4a9040'],
};

type Rand = () => number;
const pick = <T,>(r: Rand, a: T[]) => a[Math.floor(r() * a.length)];
/** A colour nudged a little lighter or darker, so a grove is not one flat green. */
const vary = (hex: string, r: Rand, amount = 0.07) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // A handful of set shades per colour (not endless ones), so materials stay few.
  const step = Math.round((r() - 0.5) * 6) / 6;
  c.setHSL(hsl.h, hsl.s, Math.min(0.92, Math.max(0.08, hsl.l + step * amount * 2)));
  return `#${c.getHexString()}`;
};

const TRUNK = '#8a6248';

function pine(t: THREE.Group, r: Rand) {
  const tiers = 4 + Math.floor(r() * 3);
  const trunk = 1.4 + r() * 0.5;
  box(t, vary(TRUNK, r), 0.24, trunk, 0.24, 0, trunk / 2, 0);
  const dark = vary('#2f6e40', r);
  const light = vary('#3f8a4e', r);
  for (let i = 0; i < tiers; i++) {
    const w = 1.55 - (i / tiers) * 1.25;
    box(t, i % 2 ? dark : light, w, 0.5, w, (r() - 0.5) * 0.06, trunk + 0.25 + i * 0.45, (r() - 0.5) * 0.06);
  }
  box(t, dark, 0.22, 0.3, 0.22, 0, trunk + 0.25 + tiers * 0.45, 0);
}

function cypress(t: THREE.Group, r: Rand) {
  const tall = 1 + r() * 0.5;
  box(t, vary(TRUNK, r), 0.2, 0.7, 0.2, 0, 0.35, 0);
  const c = [vary('#3b7d4c', r), vary('#2d673e', r)];
  box(t, c[0], 0.86, 1.4 * tall, 0.86, 0, 0.7 + 0.7 * tall, 0);
  box(t, c[1], 0.7, 1.1 * tall, 0.7, 0, 0.7 + 1.4 * tall + 0.5 * tall, 0);
  box(t, c[0], 0.42, 0.6 * tall, 0.42, 0, 0.7 + 2.5 * tall + 0.25 * tall, 0);
}

/** A round crown made of a few overlapping blocks, a little off-centre each time. */
function crown(t: THREE.Group, r: Rand, y: number, size: number, colors: string[]) {
  box(t, colors[0], 1.5 * size, 0.95 * size, 1.5 * size, 0, y, 0);
  box(t, colors[1], 1.1 * size, 0.7 * size, 1.1 * size, (r() - 0.5) * 0.3, y + 0.72 * size, (r() - 0.5) * 0.3);
  box(t, colors[0], 0.62 * size, 0.48 * size, 0.62 * size, (r() - 0.5) * 0.25, y + 1.25 * size, (r() - 0.5) * 0.25);
  // A lobe or two sticking out at the side.
  for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) {
    const a = r() * Math.PI * 2;
    box(t, pick(r, colors), 0.7 * size, 0.6 * size, 0.7 * size, Math.cos(a) * 0.62 * size, y + 0.1 * size, Math.sin(a) * 0.62 * size);
  }
}

function oak(t: THREE.Group, r: Rand) {
  const trunk = 1.7 + r() * 0.4;
  box(t, vary(TRUNK, r), 0.3, trunk, 0.3, 0, trunk / 2, 0);
  crown(t, r, trunk + 0.35, 1 + r() * 0.15, [vary('#5faa45', r), vary('#4e9440', r)]);
}

function birch(t: THREE.Group, r: Rand) {
  const trunk = 2.1 + r() * 0.5;
  box(t, '#efeae0', 0.22, trunk, 0.22, 0, trunk / 2, 0);
  // The black marks on the bark.
  for (let i = 0; i < 4; i++) {
    const y = 0.3 + (i / 4) * (trunk - 0.4) + r() * 0.15;
    const s = i % 2 ? 1 : -1;
    box(t, '#2b2522', 0.12, 0.04, 0.012, s * 0.03, y, 0.112);
    box(t, '#2b2522', 0.012, 0.04, 0.1, 0.112, y + 0.12, s * 0.03);
  }
  const c = [vary('#a5cf5c', r), vary('#8fbf4a', r)];
  box(t, c[0], 1.0, 1.2, 1.0, 0, trunk + 0.35, 0);
  box(t, c[1], 0.72, 0.8, 0.72, (r() - 0.5) * 0.2, trunk + 1.1, (r() - 0.5) * 0.2);
}

function blossom(t: THREE.Group, r: Rand) {
  const trunk = 1.5 + r() * 0.3;
  box(t, '#6e4a3a', 0.26, trunk, 0.26, 0, trunk / 2, 0);
  // A branch that leans out.
  box(t, '#6e4a3a', 0.14, 0.7, 0.14, 0.25, trunk - 0.15, 0).rotation.z = -0.7;
  crown(t, r, trunk + 0.3, 1.05, [vary('#f6b9cb', r, 0.04), vary('#fbd3df', r, 0.03)]);
  // White flowers dotted over the crown, and petals fallen round the foot.
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    box(t, '#ffffff', 0.12, 0.12, 0.12, Math.cos(a) * 0.76, trunk + 0.3 + r() * 1.1, Math.sin(a) * 0.76);
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.45 + r() * 0.75;
    box(t, i % 3 ? '#f6b9cb' : '#ffffff', 0.12, 0.012, 0.1, Math.cos(a) * d, 0.008, Math.sin(a) * d).rotation.y = r() * 3;
  }
}

function maple(t: THREE.Group, r: Rand) {
  const trunk = 1.6 + r() * 0.4;
  box(t, vary('#7a5240', r), 0.28, trunk, 0.28, 0, trunk / 2, 0);
  const colors = r() < 0.5 ? ['#e2763a', '#f0a03c'] : ['#d9532f', '#e2763a'];
  crown(t, r, trunk + 0.35, 1 + r() * 0.12, colors.map((c) => vary(c, r, 0.04)));
  // A few leaves already on the ground.
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.5 + r() * 0.7;
    box(t, pick(r, ['#e2763a', '#d9532f', '#f0a03c']), 0.13, 0.012, 0.11, Math.cos(a) * d, 0.008, Math.sin(a) * d).rotation.y = r() * 3;
  }
}

function apple(t: THREE.Group, r: Rand) {
  const trunk = 1.5 + r() * 0.3;
  box(t, vary(TRUNK, r), 0.28, trunk, 0.28, 0, trunk / 2, 0);
  crown(t, r, trunk + 0.3, 0.95, [vary('#5ea648', r), vary('#4e9440', r)]);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    box(t, '#d9473a', 0.13, 0.13, 0.13, Math.cos(a) * 0.74, trunk + 0.15 + r() * 0.9, Math.sin(a) * 0.74);
  }
  // One that fell.
  box(t, '#d9473a', 0.13, 0.13, 0.13, 0.55, 0.065, 0.3);
}

function bush(t: THREE.Group, r: Rand) {
  const c = [vary('#5fa94a', r), vary('#4a9040', r)];
  const s = 0.8 + r() * 0.35;
  box(t, c[0], 0.95 * s, 0.6 * s, 0.95 * s, 0, 0.3 * s, 0);
  box(t, c[1], 0.65 * s, 0.4 * s, 0.65 * s, (r() - 0.5) * 0.25, 0.72 * s, (r() - 0.5) * 0.25);
  box(t, c[0], 0.5 * s, 0.4 * s, 0.5 * s, 0.32 * s, 0.25 * s, 0.28 * s);
  // Sometimes, berries.
  if (r() < 0.4) for (let i = 0; i < 4; i++) box(t, '#5b6fd6', 0.08, 0.08, 0.08, (r() - 0.5) * 0.8 * s, 0.4 * s + r() * 0.35 * s, 0.48 * s);
}

const BUILD: Record<TreeKind, (t: THREE.Group, r: Rand) => void> = { pine, cypress, oak, birch, blossom, maple, apple, bush };

/** One tree, at a spot, turned and sized a little differently every time. */
export function buildTree(parent: THREE.Object3D, kind: TreeKind, x: number, z: number, r: Rand): THREE.Group {
  const t = group(parent, x, 0, z);
  t.rotation.y = Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.3;
  t.scale.setScalar(0.85 + r() * 0.35);
  BUILD[kind](t, r);
  return t;
}
