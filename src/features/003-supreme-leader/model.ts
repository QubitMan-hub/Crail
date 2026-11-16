import * as THREE from 'three';
import { bake, box, buildFace, fuse, group, HIP, SCALE, type Rig } from '../../characters/rig';

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
  return bake({ root, body, torso, head, armL, armR, legL, legR, ...face, sway: [], hang: [], emote, stride: 1, headTop: 0.76, identity: { kind: 'leader', trim: SUIT_TRIM, hair: HAIR } });
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
  return bake({ root, body, torso, head, armL, armR, legL, legR, ...face, sway: [], hang: [], emote, stride: 1, headTop: 0.72, identity: { kind: 'soldier', trim: OLIVE, hair: RED } });
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

/**
 * A tank. It joins the column like any other soldier, which is why it is built on the
 * same skeleton: the hull is its "torso" and the turret is its "head", so it turns to
 * look at things the way people do.
 */
export function buildTank(emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  const body = group(root);
  const torso = group(body, 0, HIP, 0);
  const hull = group(torso, 0, -HIP, 0);
  box(hull, OLIVE, 0.82, 0.3, 1.1, 0, 0.42, 0);
  box(hull, OLIVE_DARK, 0.86, 0.1, 0.9, 0, 0.6, -0.04);
  for (const s of [1, -1]) {
    box(hull, INK, 0.2, 0.34, 1.16, s * 0.4, 0.2, 0);
    for (let i = 0; i < 4; i++) box(hull, '#3b3b3f', 0.21, 0.2, 0.2, s * 0.4, 0.2, -0.42 + i * 0.28); // road wheels
  }
  box(hull, GOLD, 0.12, 0.12, 0.014, 0, 0.42, 0.556);
  const legL = group(body, 0.12, HIP, 0);
  const legR = group(body, -0.12, HIP, 0);
  const armL = group(body, 0.3, 1.36, 0);
  const armR = group(body, -0.3, 1.36, 0);

  // The turret hangs from the head pivot, which sits at head height on this skeleton.
  const head = group(body, 0, 1.4, 0);
  const turret = group(head, 0, -1.4, 0);
  box(turret, OLIVE, 0.56, 0.26, 0.6, 0, 0.78, -0.06);
  box(turret, OLIVE_DARK, 0.3, 0.1, 0.3, 0.06, 0.95, -0.1); // hatch
  box(turret, OLIVE_DARK, 0.11, 0.11, 0.78, 0, 0.78, 0.6); // barrel
  box(turret, INK, 0.14, 0.14, 0.1, 0, 0.78, 0.98);
  box(turret, RED, 0.03, 0.42, 0.03, -0.2, 1.1, -0.26); // aerial with a little pennant
  box(turret, RED, 0.16, 0.1, 0.02, -0.11, 1.26, -0.26);

  const dummy = new THREE.Mesh();
  dummy.visible = false;
  head.add(dummy);
  emote.position.set(0, 1.9, 0);
  root.add(emote);
  return bake({ root, body, torso, head, armL, armR, legL, legR, lids: [], brows: [], pupils: [], mouth: dummy, sway: [], hang: [], emote, stride: 1, headTop: 0.6, identity: { kind: 'tank', trim: OLIVE, hair: OLIVE_DARK } });
}

/** A gold statue of himself, pointing at nothing in particular. He built it. Nobody asked. */
export function buildStatue(): THREE.Group {
  const s = new THREE.Group();
  const GOLD_DARK = '#b8963a';
  box(s, '#a59f96', 0.94, 0.16, 0.94, 0, 0.08, 0);
  box(s, '#b3ada3', 0.76, 0.5, 0.76, 0, 0.41, 0);
  box(s, INK, 0.5, 0.16, 0.012, 0, 0.42, 0.386); // plaque
  const f = group(s, 0, 0.66, 0);
  f.scale.setScalar(0.8);
  for (const side of [1, -1]) {
    box(f, GOLD, 0.26, 0.62, 0.27, side * 0.15, 0.31, 0);
    box(f, GOLD_DARK, 0.27, 0.12, 0.34, side * 0.15, 0.06, 0.035);
  }
  box(f, GOLD, 0.6, 0.62, 0.36, 0, 0.93, 0);
  box(f, GOLD_DARK, 0.62, 0.2, 0.38, 0, 0.7, 0);
  box(f, GOLD, 0.17, 0.5, 0.2, -0.385, 0.98, 0); // one arm at his side
  const arm = box(f, GOLD, 0.17, 0.55, 0.2, 0.385, 1.36, 0.22); // the other pointing onward
  arm.rotation.x = -1.25;
  box(f, GOLD, 0.56, 0.5, 0.5, 0, 1.52, 0);
  box(f, GOLD_DARK, 0.5, 0.15, 0.5, 0, 1.82, -0.01); // the haircut, immortalised
  box(f, GOLD_DARK, 0.46, 0.09, 0.42, 0, 1.93, -0.045);
  return fuse(s);
}

/** A number that hangs over the launch pad during the countdown. */
export function buildCountdown(): { sprite: THREE.Sprite; show(text: string | null, pulse: number): void } {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 10;
  sprite.visible = false;
  let last: string | null = null;
  return {
    sprite,
    show(text, pulse) {
      sprite.visible = text !== null;
      if (text === null) return void (last = null);
      if (text !== last) {
        last = text;
        g.clearRect(0, 0, 160, 160);
        g.font = "900 130px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif";
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.strokeStyle = '#f6f1e6';
        g.lineWidth = 22;
        g.strokeText(text, 80, 86);
        g.fillStyle = RED;
        g.fillText(text, 80, 86);
        tex.needsUpdate = true;
      }
      sprite.scale.setScalar(1.1 + pulse * 0.5);
    },
  };
}

/** A flagpole for the parade ground. The banner is its own mesh so it can wave, and be lowered. */
export function buildFlag(): { pole: THREE.Group; banner: THREE.Group; top: number } {
  const pole = new THREE.Group();
  const top = 3.3;
  const still = group(pole);
  box(still, '#a59f96', 0.5, 0.14, 0.5, 0, 0.07, 0);
  box(still, '#8d8a96', 0.08, top + 0.2, 0.08, 0, (top + 0.2) / 2, 0);
  box(still, GOLD, 0.16, 0.16, 0.16, 0, top + 0.28, 0);
  fuse(still);
  // The banner hangs from the pole and swings about it.
  const banner = group(pole, 0, top - 0.3, 0);
  const cloth = group(banner);
  box(cloth, '#b8322a', 1.0, 0.62, 0.03, 0.54, 0, 0);
  // His silhouette in gold: a head and that haircut. Parody needs no caption.
  box(cloth, GOLD, 0.22, 0.2, 0.034, 0.54, -0.05, 0);
  box(cloth, GOLD, 0.2, 0.07, 0.034, 0.54, 0.1, 0);
  box(cloth, GOLD, 0.16, 0.04, 0.034, 0.54, 0.16, 0);
  fuse(cloth);
  return { pole, banner, top };
}
