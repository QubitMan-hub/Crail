import * as THREE from 'three';
import { bake, box, buildFace, fuseOwn, group, HIP, SCALE, type Rig } from '../../characters/rig';

/**
 * Two original rival fighters (an homage to a certain kind of anime, not copies of
 * anyone's characters).
 *
 * Sonny: cheerful. A red wrap-over training top with cream trim, a knotted belt, red
 * trousers, blue wristbands, and short black hair with a side fringe.
 * Prinz: proud. A purple suit under a gold chest plate with shoulder guards, white
 * gloves and boots, and neat black hair combed back.
 *
 * Day to day they wander about like anyone else. Only in a fight do they power up:
 * an aura round them, and their hair glowing gold.
 */

export interface FighterLook {
  name: 'Sonny' | 'Prinz';
  top: string;
  trim: string;
  legs: string;
  boots: string;
  skin: string;
  hair: 'wild' | 'flame';
  aura: string;
  band: string;
}

export const SONNY: FighterLook = { name: 'Sonny', top: '#d8432f', trim: '#f6efe2', legs: '#c23a28', boots: '#2b2a2e', skin: '#f2d2b6', hair: 'wild', aura: '#ffd84a', band: '#2f6fd6' };
export const PRINZ: FighterLook = { name: 'Prinz', top: '#4f3a86', trim: '#e2bf52', legs: '#4f3a86', boots: '#f6f1e6', skin: '#ecc9aa', hair: 'flame', aura: '#7fd8ff', band: '#f6f1e6' };

const INK = '#1d1b19';
const HAIR = '#1d1b19';

/**
 * Simple hair: a neat short cut over the top, back and sides. Sonny's has a soft fringe
 * falling to one side; Prinz's is combed back, a little taller on top.
 */
function addHair(head: THREE.Group, look: FighterLook, mat: THREE.Material, top: number): THREE.Group {
  const hair = group(head, 0, top, 0);
  const block = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    hair.add(m);
  };
  // Over the top, down the back, and over the tops of the ears.
  block(0.48, 0.1, 0.46, 0, 0.0, -0.01);
  block(0.47, 0.26, 0.1, 0, -0.12, -0.19);
  for (const s of [1, -1]) block(0.05, 0.14, 0.34, s * 0.235, -0.08, -0.03);
  if (look.name === 'Sonny') {
    // A little volume, and a fringe swept to one side.
    block(0.44, 0.06, 0.4, 0, 0.07, -0.02);
    block(0.46, 0.07, 0.07, 0, -0.06, 0.2);
    block(0.2, 0.08, 0.06, -0.12, -0.12, 0.2);
  } else {
    // Combed straight back: a taller top that rises toward the back, a clean hairline.
    block(0.44, 0.08, 0.36, 0, 0.08, -0.04);
    block(0.4, 0.06, 0.24, 0, 0.14, -0.08);
    block(0.46, 0.05, 0.06, 0, -0.03, 0.2);
  }
  return hair;
}

/** The outfit on a torso group. Shared by the walking-about body and the fighting one. */
function dressTorso(torso: THREE.Group, look: FighterLook): void {
  box(torso, look.top, 0.5, 0.62, 0.3, 0, 0.31, 0);
  if (look.name === 'Sonny') {
    // A wrap-over top: cream lapels crossing into a V, and a knotted belt with tails.
    box(torso, look.trim, 0.07, 0.42, 0.02, -0.06, 0.38, 0.156).rotation.z = -0.5;
    box(torso, look.trim, 0.07, 0.42, 0.02, 0.06, 0.38, 0.157).rotation.z = 0.5;
    box(torso, look.skin, 0.12, 0.12, 0.02, 0, 0.55, 0.152);
    box(torso, look.band, 0.53, 0.07, 0.32, 0, 0.05, 0);
    box(torso, look.band, 0.06, 0.16, 0.03, 0.1, -0.05, 0.16);
    box(torso, look.band, 0.06, 0.13, 0.03, 0.17, -0.04, 0.16);
  } else {
    // A gold chest plate, shoulder guards, a dark belt.
    box(torso, look.trim, 0.54, 0.34, 0.34, 0, 0.44, 0);
    box(torso, '#c9a43c', 0.4, 0.04, 0.35, 0, 0.3, 0);
    for (const s of [1, -1]) box(torso, look.trim, 0.2, 0.08, 0.34, s * 0.27, 0.62, 0);
    box(torso, '#2b2a2e', 0.52, 0.06, 0.32, 0, 0.05, 0);
  }
  box(torso, look.skin, 0.18, 0.08, 0.18, 0, 0.64, 0); // neck
}

/** The face, with brows that can frown. Sonny grins; Prinz looks down his nose. */
function face(head: THREE.Group, look: FighterLook) {
  return buildFace(head, {
    white: '#fbf7ef', pupil: INK, lid: look.name === 'Prinz' ? '#c49a80' : '#d9a98e',
    brow: HAIR, mouth: look.name === 'Prinz' ? '#9c5a4a' : '#b9553f', mouthWidth: look.name === 'Prinz' ? 0.07 : 0.11,
  });
}

/** The everyday body: built like everyone else's, so it walks, bumps and gets knocked over the same way. */
export function buildFighterRig(look: FighterLook, emote: THREE.Sprite): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const body = group(root);
  const torso = group(body, 0, HIP, 0);
  dressTorso(torso, look);
  const limbs = (side: 1 | -1) => {
    const leg = group(body, side * 0.12, HIP, 0);
    box(leg, look.legs, 0.21, 0.5, 0.22, 0, -0.25, 0);
    box(leg, look.boots, 0.23, 0.22, 0.3, 0, -0.64, 0.03);
    box(leg, look.name === 'Prinz' ? look.trim : look.band, 0.24, 0.04, 0.24, 0, -0.52, 0);
    const arm = group(torso, side * 0.32, 0.56, 0);
    box(arm, look.name === 'Prinz' ? look.top : look.skin, 0.15, 0.5, 0.16, 0, -0.22, 0);
    box(arm, look.name === 'Prinz' ? '#f6f1e6' : look.skin, 0.15, 0.12, 0.15, 0, -0.52, 0);
    return { leg, arm };
  };
  const L = limbs(1);
  const R = limbs(-1);
  // The wristband (or glove cuff) on the left arm: its own piece, so it can be stolen.
  const band = group(L.arm);
  band.name = 'band';
  box(band, look.band, 0.17, 0.08, 0.18, 0, -0.42, 0);
  const head = group(torso, 0, 0.68, 0);
  box(head, look.skin, 0.44, 0.44, 0.42, 0, 0.22, 0);
  box(head, look.skin, 0.06, 0.1, 0.08, 0.23, 0.2, 0); // ears
  box(head, look.skin, 0.06, 0.1, 0.08, -0.23, 0.2, 0);
  const f = face(head, look);
  addHair(head, look, new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7 }), 0.44);
  emote.position.set(0, 2.7, 0);
  root.add(emote);
  return bake({
    root, body, torso, head, armL: L.arm, armR: R.arm, legL: L.leg, legR: R.leg, ...f, sway: [], hang: [], emote,
    stride: 1.2, headTop: 0.95, identity: { kind: 'fighter', trim: look.top, hair: HAIR }, loot: { item: band },
  });
}

/** The fighting body: two joints in every limb for punches and kicks, an aura, a beam. */
export interface FighterRig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  arms: { upper: THREE.Group; fore: THREE.Group }[];
  legs: { upper: THREE.Group; lower: THREE.Group }[];
  hairMat: THREE.MeshStandardMaterial;
  aura: THREE.Group;
  auraMat: THREE.MeshBasicMaterial;
  ball: THREE.Mesh;
  beam: THREE.Mesh;
  brows: THREE.Mesh[];
}

export function buildFighter(look: FighterLook): FighterRig {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const body = group(root);
  const hipY = 0.78;
  const legs = [1, -1].map((s) => {
    const upper = group(body, s * 0.12, hipY, 0);
    box(upper, look.legs, 0.21, 0.4, 0.22, 0, -0.2, 0);
    fuseOwn(upper);
    const lower = group(upper, 0, -0.38, 0);
    box(lower, look.legs, 0.19, 0.22, 0.2, 0, -0.1, 0);
    box(lower, look.boots, 0.23, 0.2, 0.3, 0, -0.3, 0.03);
    box(lower, look.name === 'Prinz' ? look.trim : look.band, 0.24, 0.04, 0.24, 0, -0.18, 0);
    fuseOwn(lower);
    return { upper, lower };
  });
  const torso = group(body, 0, hipY, 0);
  dressTorso(torso, look);
  fuseOwn(torso);
  const arms = [1, -1].map((s) => {
    const upper = group(torso, s * 0.32, 0.56, 0);
    box(upper, look.name === 'Prinz' ? look.top : look.skin, 0.15, 0.32, 0.16, 0, -0.14, 0);
    fuseOwn(upper);
    const fore = group(upper, 0, -0.3, 0);
    box(fore, look.name === 'Prinz' ? look.top : look.skin, 0.13, 0.22, 0.14, 0, -0.1, 0);
    box(fore, look.band, 0.16, 0.08, 0.17, 0, -0.04, 0);
    box(fore, look.name === 'Prinz' ? '#f6f1e6' : look.skin, 0.15, 0.12, 0.15, 0, -0.24, 0);
    fuseOwn(fore);
    return { upper, fore };
  });
  const head = group(torso, 0, 0.68, 0);
  box(head, look.skin, 0.44, 0.44, 0.42, 0, 0.22, 0);
  box(head, look.skin, 0.06, 0.1, 0.08, 0.23, 0.2, 0);
  box(head, look.skin, 0.06, 0.1, 0.08, -0.23, 0.2, 0);
  const f = face(head, look);
  // In a fight the hair can glow gold, so it gets a material of its own.
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, emissive: '#ffcc33', emissiveIntensity: 0, roughness: 0.7 });
  addHair(head, look, hairMat, 0.44);
  const auraMat = new THREE.MeshBasicMaterial({ color: look.aura, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const aura = group(root, 0, 0, 0);
  for (const [w, h, y] of [[1.2, 2.6, 1.15], [1.0, 2.3, 1.1], [1.4, 1.6, 0.85]] as const) {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), auraMat);
    shell.position.y = y;
    shell.rotation.y = w;
    aura.add(shell);
  }
  const ball = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: look.aura, transparent: true }));
  ball.position.set(0, 1.1, 0.45);
  ball.visible = false;
  root.add(ball);
  const beamGeo = new THREE.BoxGeometry(0.36, 0.36, 1);
  beamGeo.translate(0, 0, 0.5);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  beam.visible = false;
  root.add(beam);
  return { root, body, torso, head, arms, legs, hairMat, aura, auraMat, ball, beam, brows: f.brows };
}
