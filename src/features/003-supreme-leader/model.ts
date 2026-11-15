import * as THREE from 'three';
import { bake, box, buildFace, group, HIP, SCALE, type Rig } from '../../characters/rig';

/**
 * The leader and his soldiers. He is a blocky parody: dark buttoned-up suit, stocky
 * build, and the unmistakable haircut. The soldiers are identical, on purpose.
 */

const SUIT = '#24242c';
const SUIT_TRIM = '#34343f';
const HAIR = '#141316';
const SKIN = '#f0d3b8';
const STUBBLE = '#c7ab92';
const OLIVE = '#6f7752';
const OLIVE_DARK = '#565d40';
const LEATHER = '#5a3b28';
const RED = '#c8452f';
const INK = '#1d1b19';
const GOLD = '#d6b24a';

export function buildLeader(_v: unknown, emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const body = group(root);

  // Suit: wide, buttoned to the neck, two chest pockets, one small red pin.
  const torso = group(body, 0, HIP, 0);
  box(torso, SUIT, 0.6, 0.62, 0.36, 0, 0.3, 0);
  box(torso, SUIT, 0.62, 0.2, 0.38, 0, 0.06, 0); // jacket hem, a little wider: he is not slim
  box(torso, SUIT_TRIM, 0.3, 0.08, 0.3, 0, 0.61, 0); // closed collar
  for (let i = 0; i < 4; i++) box(torso, SUIT_TRIM, 0.04, 0.04, 0.012, 0, 0.14 + i * 0.12, 0.183);
  for (const s of [1, -1]) box(torso, SUIT_TRIM, 0.15, 0.03, 0.012, s * 0.16, 0.42, 0.183);
  box(torso, RED, 0.045, 0.045, 0.014, 0.17, 0.49, 0.184);
  box(torso, SKIN, 0.2, 0.08, 0.2, 0, 0.63, 0);

  const makeLeg = (side: 1 | -1) => {
    const leg = group(body, side * 0.15, HIP, 0);
    box(leg, SUIT, 0.26, 0.62, 0.27, 0, -0.31, 0);
    box(leg, INK, 0.27, 0.15, 0.34, 0, -0.705, 0.035);
    return leg;
  };
  const makeArm = (side: 1 | -1) => {
    const arm = group(body, side * 0.385, 1.36, 0);
    box(arm, SUIT, 0.17, 0.5, 0.2, 0, -0.22, 0);
    box(arm, SKIN, 0.14, 0.1, 0.16, 0, -0.52, 0);
    return arm;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // Head: round and wide, full cheeks, small features.
  const head = group(body, 0, 1.4, 0);
  box(head, SKIN, 0.56, 0.5, 0.5, 0, 0.27, 0);
  box(head, SKIN, 0.6, 0.26, 0.5, 0, 0.16, 0.012); // cheeks
  for (const s of [1, -1]) box(head, SKIN, 0.05, 0.13, 0.1, s * 0.3, 0.28, -0.02); // ears
  // The haircut: sides shaved high, a tall flat slab on top, swept back.
  box(head, STUBBLE, 0.565, 0.15, 0.42, 0, 0.41, -0.045);
  box(head, STUBBLE, 0.5, 0.3, 0.06, 0, 0.36, -0.23);
  box(head, HAIR, 0.5, 0.15, 0.5, 0, 0.555, -0.01);
  box(head, HAIR, 0.46, 0.09, 0.42, 0, 0.66, -0.045);
  box(head, HAIR, 0.42, 0.05, 0.3, 0, 0.72, -0.08);
  const face = buildFace(head, {
    white: '#fbf7ef', pupil: INK, lid: '#3a2f2a', brow: HAIR, mouth: '#b7776a', mouthWidth: 0.085,
  });

  emote.position.set(0, 2.5, 0);
  root.add(emote);
  return bake({ root, body, torso, head, armL, armR, legL, legR, ...face, sway: [], hang: [], emote, stride: 1, headTop: 0.76 });
}

/** Soldiers are three-quarters his size, so the column reads as "his army", not his equals. */
export const SOLDIER_SCALE = 0.72;

export function buildSoldier(_v: unknown, emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(SOLDIER_SCALE);
  const body = group(root);

  const torso = group(body, 0, HIP, 0);
  box(torso, OLIVE, 0.46, 0.62, 0.27, 0, 0.3, 0);
  box(torso, LEATHER, 0.48, 0.06, 0.29, 0, 0.07, 0); // belt
  box(torso, GOLD, 0.07, 0.07, 0.014, 0, 0.07, 0.146);
  box(torso, LEATHER, 0.05, 0.6, 0.012, 0.1, 0.33, 0.137).rotation.z = 0.5; // cross strap
  box(torso, OLIVE_DARK, 0.3, 0.07, 0.29, 0, 0.6, 0); // collar
  for (const s of [1, -1]) box(torso, RED, 0.12, 0.035, 0.2, s * 0.19, 0.615, 0); // shoulder boards
  box(torso, SKIN, 0.16, 0.08, 0.16, 0, 0.63, 0);

  const makeLeg = (side: 1 | -1) => {
    const leg = group(body, side * 0.12, HIP, 0);
    box(leg, OLIVE, 0.21, 0.42, 0.21, 0, -0.21, 0);
    box(leg, INK, 0.22, 0.36, 0.25, 0, -0.6, 0.015); // tall boots
    return leg;
  };
  const makeArm = (side: 1 | -1) => {
    const arm = group(body, side * 0.3, 1.36, 0);
    box(arm, OLIVE, 0.14, 0.5, 0.16, 0, -0.22, 0);
    box(arm, '#f3efe6', 0.13, 0.1, 0.15, 0, -0.52, 0); // white parade gloves
    return arm;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);
  const armL = makeArm(1);
  const armR = makeArm(-1);

  const head = group(body, 0, 1.4, 0);
  box(head, SKIN, 0.5, 0.5, 0.48, 0, 0.27, 0);
  box(head, HAIR, 0.52, 0.12, 0.5, 0, 0.46, -0.01);
  // Peaked cap, far too big, as is traditional.
  box(head, OLIVE, 0.54, 0.1, 0.52, 0, 0.56, 0);
  box(head, RED, 0.55, 0.05, 0.53, 0, 0.555, 0);
  box(head, OLIVE, 0.7, 0.09, 0.66, 0, 0.66, -0.02);
  box(head, INK, 0.44, 0.035, 0.16, 0, 0.535, 0.3);
  box(head, GOLD, 0.07, 0.07, 0.014, 0, 0.61, 0.268);
  const face = buildFace(head, {
    white: '#fbf7ef', pupil: INK, lid: '#3a2f2a', brow: HAIR, mouth: '#a96c60', mouthWidth: 0.08,
  });

  emote.position.set(0, 2.5, 0);
  root.add(emote);
  return bake({ root, body, torso, head, armL, armR, legL, legR, ...face, sway: [], hang: [], emote, stride: 1, headTop: 0.72 });
}

/** The launch pad and the rocket on it. The rocket is its own group so it can go up. And come back. */
export function buildRocketSite(): { site: THREE.Group; rocket: THREE.Group; flame: THREE.Mesh } {
  const site = new THREE.Group();
  box(site, '#4a4a52', 0.92, 0.1, 0.92, 0, 0.05, 0);
  box(site, '#5d5d66', 0.6, 0.06, 0.6, 0, 0.13, 0);
  // Gantry: a thin tower with two arms.
  box(site, OLIVE_DARK, 0.09, 1.5, 0.09, -0.36, 0.85, -0.36);
  box(site, OLIVE_DARK, 0.3, 0.05, 0.06, -0.24, 1.25, -0.36);
  box(site, OLIVE_DARK, 0.3, 0.05, 0.06, -0.24, 0.7, -0.36);

  const rocket = group(site, 0, 0.16, 0);
  box(rocket, '#f3efe6', 0.3, 0.95, 0.3, 0, 0.55, 0);
  box(rocket, RED, 0.3, 0.14, 0.3, 0, 0.9, 0);
  box(rocket, RED, 0.2, 0.2, 0.2, 0, 1.1, 0);
  box(rocket, RED, 0.1, 0.14, 0.1, 0, 1.25, 0);
  box(rocket, OLIVE_DARK, 0.31, 0.08, 0.31, 0, 0.4, 0);
  for (const [x, z] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) box(rocket, OLIVE, x ? 0.14 : 0.05, 0.3, z ? 0.14 : 0.05, x, 0.22, z);
  const flame = box(rocket, '#ffb23e', 0.2, 0.5, 0.2, 0, -0.2, 0);
  (flame.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: '#ffb23e', emissive: '#ff7a1a', emissiveIntensity: 1.2 });
  flame.castShadow = false;
  flame.visible = false;
  return { site, rocket, flame };
}
