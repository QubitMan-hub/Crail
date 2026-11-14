import * as THREE from 'three';
import { box, buildFace, group, HIP, SCALE, type Rig } from '../../characters/rig';

/** The femboys: pastel hoodies, pleated skirts, striped thigh-highs, big sneakers. */

const PINK = '#f6a8c4';
const HOT = '#ee6fa4';
const BLUE = '#9fd0f5';
const DEEP = '#5aa7e8';
const LAV = '#c7b3f3';
const CREAM = '#fbf6ee';
const INK = '#1d1b19';

export interface Variant {
  name: string;
  skin: string;
  hair: string;
  hairStyle: 'fluffy' | 'bob' | 'ahoge';
  ears?: 'headband' | 'hood';
  hat?: 'beret' | 'clip';
  top: 'hoodie' | 'sweater';
  topColor: string;
  accent: string;
  bottom: 'skirt' | 'shorts';
  bottomColor: string;
  socks: [string, string];
  extra?: 'headphones';
}

export const VARIANTS: Variant[] = [
  {
    name: 'Mochi', skin: '#f6dfd0', hair: '#f7b6cf', hairStyle: 'fluffy', ears: 'headband',
    top: 'hoodie', topColor: CREAM, accent: PINK, bottom: 'skirt', bottomColor: PINK, socks: [CREAM, PINK],
  },
  {
    name: 'Pixel', skin: '#e9c4a8', hair: '#8fc6ee', hairStyle: 'bob', hat: 'clip',
    top: 'hoodie', topColor: BLUE, accent: CREAM, bottom: 'skirt', bottomColor: INK, socks: [CREAM, DEEP], extra: 'headphones',
  },
  {
    name: 'Sunny', skin: '#f3d6c2', hair: '#f3d98b', hairStyle: 'ahoge', hat: 'beret',
    top: 'sweater', topColor: LAV, accent: CREAM, bottom: 'skirt', bottomColor: CREAM, socks: [CREAM, LAV],
  },
  {
    name: 'Kit', skin: '#c99a78', hair: '#6f4a3a', hairStyle: 'fluffy', ears: 'hood',
    top: 'hoodie', topColor: PINK, accent: CREAM, bottom: 'shorts', bottomColor: DEEP, socks: [PINK, BLUE],
  },
];

function buildLeg(parent: THREE.Object3D, side: 1 | -1, v: Variant): THREE.Group {
  const leg = group(parent, side * 0.12, HIP, 0);
  // A little skin, then striped thigh-highs.
  box(leg, v.bottom === 'shorts' ? v.bottomColor : v.skin, v.bottom === 'shorts' ? 0.215 : 0.19, 0.14, v.bottom === 'shorts' ? 0.215 : 0.19, 0, -0.07, 0);
  for (let i = 0; i < 5; i++) box(leg, v.socks[i % 2], 0.205, 0.092, 0.205, 0, -0.184 - i * 0.088, 0);
  // Big soft sneakers.
  box(leg, CREAM, 0.25, 0.14, 0.32, 0, -0.665, 0.04);
  box(leg, v.accent === CREAM ? v.topColor : v.accent, 0.255, 0.05, 0.325, 0, -0.64, 0.04);
  box(leg, '#ffffff', 0.27, 0.06, 0.34, 0, -0.75, 0.04);
  return leg;
}

function buildArm(parent: THREE.Object3D, side: 1 | -1, v: Variant): THREE.Group {
  const arm = group(parent, side * 0.31, 1.36, 0);
  // Sleeves a size too long: only fingertips show.
  box(arm, v.topColor, 0.16, 0.54, 0.18, 0, -0.24, 0);
  box(arm, v.accent, 0.165, 0.05, 0.185, 0, -0.5, 0);
  box(arm, v.skin, 0.12, 0.05, 0.14, 0, -0.55, 0);
  return arm;
}

function buildOutfit(torso: THREE.Group, v: Variant): void {
  if (v.top === 'hoodie') {
    box(torso, v.topColor, 0.5, 0.64, 0.3, 0, 0.29, 0);
    box(torso, v.accent, 0.3, 0.15, 0.02, 0, 0.14, 0.152); // front pocket
    box(torso, v.topColor, 0.44, 0.2, 0.16, 0, 0.6, -0.15); // hood, down
    for (const s of [1, -1]) box(torso, v.accent, 0.022, 0.16, 0.014, s * 0.07, 0.46, 0.153); // drawstrings
  } else {
    box(torso, v.topColor, 0.5, 0.62, 0.29, 0, 0.3, 0);
    box(torso, v.accent, 0.3, 0.07, 0.3, 0, 0.6, 0); // collar
    box(torso, v.accent, 0.51, 0.06, 0.3, 0, 0.02, 0); // hem
    // A little heart, front and centre.
    box(torso, HOT, 0.09, 0.07, 0.012, 0, 0.36, 0.147).rotation.z = Math.PI / 4;
  }
  if (v.bottom === 'skirt') {
    box(torso, v.bottomColor, 0.58, 0.2, 0.42, 0, -0.07, 0);
    // Pleats: slim vertical ridges all the way round.
    for (let i = -2; i <= 2; i++) {
      box(torso, v.bottomColor, 0.05, 0.2, 0.44, i * 0.115, -0.07, 0);
    }
    box(torso, v.bottomColor === CREAM ? LAV : CREAM, 0.6, 0.035, 0.44, 0, -0.155, 0);
  }
  // Neck and a thin choker.
  box(torso, v.skin, 0.16, 0.1, 0.16, 0, 0.62, 0);
  box(torso, INK, 0.185, 0.03, 0.185, 0, 0.625, 0);
  if (v.extra === 'headphones') {
    for (const s of [1, -1]) box(torso, CREAM, 0.07, 0.14, 0.14, s * 0.16, 0.6, 0.02);
    box(torso, INK, 0.36, 0.04, 0.05, 0, 0.6, -0.1);
  }
}

function buildHair(head: THREE.Group, v: Variant, sway: THREE.Object3D[]): number {
  const H = v.hair;
  let top = 0.6;
  box(head, H, 0.57, 0.14, 0.55, 0, 0.5, -0.005);
  box(head, H, 0.57, v.hairStyle === 'bob' ? 0.5 : 0.36, 0.1, 0, v.hairStyle === 'bob' ? 0.29 : 0.37, -0.25);
  const sideLen = v.hairStyle === 'bob' ? 0.46 : 0.3;
  for (const s of [1, -1]) box(head, H, 0.07, sideLen, 0.4, s * 0.268, 0.54 - sideLen / 2 - 0.04, -0.04);
  // A soft, uneven fringe swept to one side.
  box(head, H, 0.3, 0.12, 0.07, -0.12, 0.45, 0.25);
  box(head, H, 0.26, 0.085, 0.07, 0.15, 0.468, 0.25);
  if (v.hairStyle !== 'bob') {
    // Fluff: a few tufts so the silhouette is not a helmet.
    box(head, H, 0.16, 0.1, 0.16, 0.2, 0.59, -0.1).rotation.z = -0.3;
    box(head, H, 0.16, 0.1, 0.16, -0.18, 0.585, 0.06).rotation.z = 0.35;
    box(head, H, 0.14, 0.12, 0.12, 0.3, 0.3, -0.16).rotation.z = -0.5;
    box(head, H, 0.14, 0.12, 0.12, -0.3, 0.3, -0.16).rotation.z = 0.5;
  }
  if (v.hairStyle === 'ahoge') {
    const ahoge = group(head, 0.02, 0.57, 0.02);
    box(ahoge, H, 0.05, 0.2, 0.05, 0.03, 0.09, 0).rotation.z = -0.5;
    sway.push(ahoge);
  }
  if (v.ears) {
    // Cat ears, on a headband or sewn onto the hood.
    const color = v.ears === 'hood' ? v.topColor : INK;
    if (v.ears === 'hood') {
      box(head, v.topColor, 0.6, 0.2, 0.5, 0, 0.5, -0.07);
      box(head, v.topColor, 0.6, 0.52, 0.14, 0, 0.3, -0.27);
      for (const s of [1, -1]) box(head, v.topColor, 0.06, 0.4, 0.34, s * 0.3, 0.33, -0.12);
    } else box(head, INK, 0.6, 0.035, 0.06, 0, 0.585, 0.04);
    for (const s of [1, -1]) {
      const ear = group(head, s * 0.18, 0.61, v.ears === 'hood' ? -0.04 : 0.04);
      box(ear, color, 0.2, 0.2, 0.08, 0, 0.03, 0).rotation.z = Math.PI / 4;
      box(ear, HOT, 0.1, 0.1, 0.085, 0, 0.03, 0.004).rotation.z = Math.PI / 4;
      sway.push(ear);
    }
    top = 0.72;
  }
  if (v.hat === 'beret') {
    box(head, HOT, 0.52, 0.11, 0.5, 0.05, 0.615, -0.02).rotation.z = -0.12;
    box(head, HOT, 0.05, 0.06, 0.05, 0.03, 0.69, -0.02);
    top = 0.72;
  }
  if (v.hat === 'clip') {
    for (const dy of [0, 0.045]) box(head, '#ffffff', 0.11, 0.024, 0.02, 0.17, 0.44 + dy, 0.288).rotation.z = 0.3;
  }
  return top;
}

export function buildFemboy(v: Variant, emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const body = group(root);
  const torso = group(body, 0, HIP, 0);
  buildOutfit(torso, v);
  const legL = buildLeg(body, 1, v);
  const legR = buildLeg(body, -1, v);
  const armL = buildArm(body, 1, v);
  const armR = buildArm(body, -1, v);

  const head = group(body, 0, 1.4, 0);
  box(head, v.skin, 0.5, 0.5, 0.48, 0, 0.27, 0);
  const sway: THREE.Object3D[] = [];
  const headTop = buildHair(head, v, sway);
  const face = buildFace(head, {
    white: '#ffffff', pupil: '#3a2a26', lid: '#8a6a5c', brow: v.hair, mouth: '#d9737f', mouthWidth: 0.1, blush: '#f7a9bd',
  });

  emote.position.set(0, 2.5, 0);
  root.add(emote);
  return { root, body, torso, head, armL, armR, legL, legR, ...face, sway, hang: [], emote, stride: 1, headTop };
}
