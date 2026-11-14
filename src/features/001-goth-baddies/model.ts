import * as THREE from 'three';
import { box, buildFace, group, HIP, mat, SCALE, type Rig } from '../../characters/rig';

/** The goths: ink black, purple accents, chunky boots, winged eyeliner. */

const INK = '#1d1b19';
const CHARCOAL = '#2e2a36';
const PLUM = '#3b2745';
const PURPLE = '#7b52c9';
const LILAC = '#b9a1ee';
const SILVER = '#bdb8c6';
const WHITE = '#f8f3ea';
const LIPS = '#5e2a58';

export interface Variant {
  name: string;
  skin: string;
  hair: 'long' | 'tails' | 'bob' | 'buns' | 'swept';
  hat?: 'brim' | 'bow' | 'horns';
  outfit: 'dress' | 'skirt' | 'coat' | 'tee' | 'corset';
  legs: 'plain' | 'stripes' | 'thigh' | 'sheer';
  sleeves: 'long' | 'bare' | 'gloves';
  extra?: 'wings' | 'cross';
}

export const VARIANTS: Variant[] = [
  { name: 'Raven', skin: '#f1ddd0', hair: 'long', outfit: 'dress', legs: 'plain', sleeves: 'long', extra: 'cross' },
  { name: 'Vex', skin: '#eed5c6', hair: 'tails', hat: 'bow', outfit: 'skirt', legs: 'stripes', sleeves: 'gloves' },
  { name: 'Nyx', skin: '#f3e2d6', hair: 'bob', hat: 'brim', outfit: 'coat', legs: 'plain', sleeves: 'long' },
  { name: 'Hex', skin: '#ecd3c4', hair: 'buns', outfit: 'tee', legs: 'thigh', sleeves: 'bare' },
  { name: 'Lilith', skin: '#f1ddd0', hair: 'swept', hat: 'horns', outfit: 'corset', legs: 'sheer', sleeves: 'gloves', extra: 'wings' },
];

function buildLeg(parent: THREE.Object3D, side: 1 | -1, v: Variant): THREE.Group {
  const leg = group(parent, side * 0.12, HIP, 0);
  if (v.legs === 'stripes') {
    for (let i = 0; i < 5; i++) box(leg, i % 2 ? PURPLE : INK, 0.2, 0.118, 0.2, 0, -0.058 - i * 0.116, 0);
  } else if (v.legs === 'thigh') {
    box(leg, v.skin, 0.19, 0.2, 0.19, 0, -0.1, 0);
    box(leg, INK, 0.21, 0.4, 0.21, 0, -0.38, 0);
    box(leg, PURPLE, 0.22, 0.03, 0.22, 0, -0.19, 0);
  } else {
    box(leg, v.legs === 'sheer' ? '#3c3644' : INK, 0.2, 0.58, 0.2, 0, -0.29, 0);
  }
  // Chunky boots: tall sole, buckle strap.
  box(leg, INK, 0.25, 0.2, 0.31, 0, -0.64, 0.035);
  box(leg, CHARCOAL, 0.27, 0.07, 0.33, 0, -0.745, 0.035);
  box(leg, SILVER, 0.26, 0.035, 0.32, 0, -0.6, 0.035);
  return leg;
}

function buildArm(parent: THREE.Object3D, side: 1 | -1, v: Variant, sleeve: string): THREE.Group {
  const arm = group(parent, side * 0.3, 1.36, 0);
  if (v.sleeves === 'long') {
    box(arm, sleeve, 0.14, 0.5, 0.16, 0, -0.22, 0);
  } else {
    if (v.outfit === 'tee') box(arm, sleeve, 0.16, 0.2, 0.18, 0, -0.07, 0);
    box(arm, v.skin, 0.13, 0.5, 0.15, 0, -0.22, 0);
    if (v.sleeves === 'gloves') box(arm, INK, 0.145, 0.2, 0.165, 0, -0.36, 0);
    else box(arm, PURPLE, 0.15, 0.04, 0.17, 0, -0.4, 0);
  }
  box(arm, v.skin, 0.13, 0.1, 0.15, 0, -0.52, 0);
  return arm;
}

function buildOutfit(torso: THREE.Group, v: Variant): { sleeve: string; stride: number } {
  let sleeve = INK;
  let stride = 1;
  switch (v.outfit) {
    case 'dress':
      box(torso, INK, 0.44, 0.6, 0.26, 0, 0.3, 0);
      box(torso, INK, 0.52, 0.66, 0.36, 0, -0.31, 0);
      box(torso, PLUM, 0.54, 0.06, 0.38, 0, -0.62, 0);
      box(torso, PURPLE, 0.47, 0.055, 0.28, 0, 0.04, 0);
      box(torso, SILVER, 0.07, 0.07, 0.02, 0, 0.04, 0.145);
      stride = 0.35;
      break;
    case 'skirt':
      box(torso, INK, 0.44, 0.6, 0.26, 0, 0.3, 0);
      box(torso, PURPLE, 0.54, 0.24, 0.38, 0, -0.08, 0);
      box(torso, INK, 0.56, 0.045, 0.4, 0, -0.19, 0);
      box(torso, INK, 0.47, 0.05, 0.28, 0, 0.05, 0);
      box(torso, SILVER, 0.06, 0.06, 0.02, 0, 0.05, 0.145);
      break;
    case 'coat':
      sleeve = CHARCOAL;
      box(torso, INK, 0.42, 0.6, 0.24, 0, 0.3, 0);
      box(torso, CHARCOAL, 0.49, 0.56, 0.08, 0, 0.3, -0.12);
      box(torso, CHARCOAL, 0.1, 0.6, 0.3, 0.2, 0.3, 0);
      box(torso, CHARCOAL, 0.1, 0.6, 0.3, -0.2, 0.3, 0);
      box(torso, CHARCOAL, 0.49, 0.5, 0.07, 0, -0.23, -0.125);
      box(torso, CHARCOAL, 0.08, 0.5, 0.3, 0.21, -0.23, 0);
      box(torso, CHARCOAL, 0.08, 0.5, 0.3, -0.21, -0.23, 0);
      box(torso, PURPLE, 0.3, 0.11, 0.3, 0, 0.6, 0);
      box(torso, PURPLE, 0.11, 0.3, 0.05, 0.1, 0.42, 0.15);
      box(torso, LILAC, 0.11, 0.035, 0.052, 0.1, 0.3, 0.15);
      break;
    case 'tee': {
      sleeve = CHARCOAL;
      box(torso, CHARCOAL, 0.5, 0.7, 0.3, 0, 0.24, 0);
      // Crescent moon on the chest.
      const moon = new THREE.Mesh(new THREE.CircleGeometry(0.095, 32), mat(LILAC));
      moon.position.set(0, 0.36, 0.152);
      const bite = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), mat(CHARCOAL));
      bite.position.set(0.045, 0.385, 0.154);
      torso.add(moon, bite);
      break;
    }
    case 'corset':
      box(torso, INK, 0.44, 0.6, 0.26, 0, 0.3, 0);
      box(torso, PLUM, 0.36, 0.34, 0.27, 0, 0.24, 0);
      for (let i = 0; i < 3; i++) box(torso, LILAC, 0.13, 0.022, 0.012, 0, 0.15 + i * 0.09, 0.14);
      box(torso, INK, 0.54, 0.2, 0.38, 0, -0.06, 0);
      box(torso, PURPLE, 0.56, 0.045, 0.4, 0, -0.15, 0);
      break;
  }
  if (v.extra === 'cross') {
    box(torso, LILAC, 0.03, 0.11, 0.012, 0, 0.4, 0.137);
    box(torso, LILAC, 0.08, 0.03, 0.012, 0, 0.42, 0.137);
  }
  if (v.extra === 'wings') {
    for (const s of [1, -1]) {
      const wing = group(torso, s * 0.12, 0.42, -0.15);
      wing.rotation.set(0, -s * 0.55, s * 0.25);
      box(wing, PLUM, 0.26, 0.2, 0.03, s * 0.13, 0.03, 0);
      box(wing, PLUM, 0.12, 0.12, 0.03, s * 0.22, -0.1, 0);
      box(wing, PURPLE, 0.26, 0.03, 0.032, s * 0.13, 0.13, 0);
    }
  }
  // Neck and choker.
  if (v.outfit !== 'coat') {
    box(torso, v.skin, 0.16, 0.1, 0.16, 0, 0.62, 0);
    box(torso, v.outfit === 'skirt' ? PURPLE : INK, 0.185, 0.04, 0.185, 0, 0.625, 0);
    box(torso, SILVER, 0.04, 0.04, 0.012, 0, 0.615, 0.097);
  }
  return { sleeve, stride };
}

function buildHair(head: THREE.Group, v: Variant, sway: THREE.Object3D[], hang: THREE.Object3D[]): void {
  const H = INK;
  box(head, H, 0.56, 0.13, 0.54, 0, 0.5, -0.005);
  box(head, H, 0.54, 0.1, 0.07, 0, 0.455, 0.25); // blunt fringe
  const sideLen = v.hair === 'bob' ? 0.5 : 0.36;
  for (const s of [1, -1]) box(head, H, 0.07, sideLen, 0.4, s * 0.265, 0.54 - sideLen / 2 - 0.04, -0.04);
  box(head, H, 0.56, 0.5, 0.1, 0, 0.29, -0.25);

  if (v.hair === 'long' || v.hair === 'swept') {
    const back = group(head, 0, 0.1, -0.26);
    box(back, H, 0.54, 0.86, 0.1, 0, -0.4, 0);
    if (v.hair === 'swept') {
      box(back, PURPLE, 0.5, 0.2, 0.09, 0, -0.84, 0.012);
      // One long lock over the shoulder, purple underneath.
      const lock = group(head, 0.265, 0.2, 0.08);
      box(lock, H, 0.075, 0.5, 0.16, 0, -0.25, 0);
      box(lock, PURPLE, 0.07, 0.12, 0.15, 0, -0.54, 0);
      sway.push(lock);
    } else {
      for (const s of [1, -1]) {
        const lock = group(head, s * 0.265, 0.2, 0.06);
        box(lock, H, 0.075, 0.42, 0.14, 0, -0.21, 0);
        sway.push(lock);
      }
    }
    sway.push(back);
    hang.push(back);
  }
  if (v.hair === 'tails') {
    for (const s of [1, -1]) {
      const tail = group(head, s * 0.34, 0.42, -0.06);
      box(tail, PURPLE, 0.1, 0.07, 0.16, 0, 0, 0);
      box(tail, H, 0.15, 0.46, 0.15, s * 0.02, -0.26, 0);
      box(tail, PURPLE, 0.15, 0.16, 0.15, s * 0.02, -0.56, 0);
      sway.push(tail);
    }
  }
  if (v.hair === 'buns') {
    for (const s of [1, -1]) box(head, H, 0.2, 0.2, 0.2, s * 0.19, 0.64, -0.04);
    box(head, PURPLE, 0.07, 0.34, 0.075, 0.2, 0.36, 0.252); // one purple streak
  }
  if (v.hat === 'brim') {
    box(head, INK, 0.8, 0.045, 0.8, 0, 0.585, -0.01);
    box(head, INK, 0.5, 0.22, 0.5, 0, 0.7, -0.01);
    box(head, PURPLE, 0.52, 0.055, 0.52, 0, 0.635, -0.01);
  }
  if (v.hat === 'bow') {
    for (const s of [1, -1]) box(head, PURPLE, 0.15, 0.12, 0.06, s * 0.09, 0.615, 0.06).rotation.z = s * 0.35;
    box(head, LILAC, 0.06, 0.07, 0.07, 0, 0.6, 0.06);
  }
  if (v.hat === 'horns') {
    for (const s of [1, -1]) {
      const horn = box(head, PURPLE, 0.07, 0.16, 0.07, s * 0.17, 0.62, 0.02);
      horn.rotation.z = -s * 0.3;
    }
  }
}

export function buildGoth(v: Variant, emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const body = group(root);
  const torso = group(body, 0, HIP, 0);
  const { sleeve, stride } = buildOutfit(torso, v);
  const legL = buildLeg(body, 1, v);
  const legR = buildLeg(body, -1, v);
  const armL = buildArm(body, 1, v, sleeve);
  const armR = buildArm(body, -1, v, sleeve);

  const head = group(body, 0, 1.4, 0);
  box(head, v.skin, 0.5, 0.5, 0.48, 0, 0.27, 0);
  const sway: THREE.Object3D[] = [];
  const hang: THREE.Object3D[] = [];
  buildHair(head, v, sway, hang);
  const face = buildFace(head, {
    white: WHITE, pupil: INK, lid: INK, brow: INK, mouth: LIPS, mouthWidth: 0.09, shadow: PURPLE, wing: true,
  });
  const headTop = v.hat === 'brim' ? 0.86 : v.hair === 'buns' ? 0.72 : 0.6;

  emote.position.set(0, 2.5, 0);
  root.add(emote);
  return { root, body, torso, head, armL, armR, legL, legR, ...face, sway, hang, emote, stride, headTop };
}
