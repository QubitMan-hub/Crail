import * as THREE from 'three';
import { box, fuse, fuseOwn, group, SCALE } from '../../characters/rig';

/**
 * Two original rival fighters (an homage to a certain kind of anime, not copies of
 * anyone's characters). Sonny: cheerful, red training clothes, wild black spikes.
 * Prinz: proud, a purple suit with a gold chest plate, tall swept-back flame hair.
 * Both power up: an aura flares round them and their hair glows gold.
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
}

export const SONNY: FighterLook = { name: 'Sonny', top: '#d8432f', trim: '#f6f1e6', legs: '#d8432f', boots: '#2b2a2e', skin: '#f2d2b6', hair: 'wild', aura: '#ffd84a' };
export const PRINZ: FighterLook = { name: 'Prinz', top: '#5b3f8c', trim: '#e8c75a', legs: '#5b3f8c', boots: '#f6f1e6', skin: '#ecc9aa', hair: 'flame', aura: '#7fd8ff' };

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

const INK = '#1d1b19';

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
    box(lower, look.trim, 0.24, 0.04, 0.24, 0, -0.18, 0);
    fuseOwn(lower);
    return { upper, lower };
  });

  const torso = group(body, 0, hipY, 0);
  box(torso, look.top, 0.5, 0.62, 0.3, 0, 0.31, 0);
  box(torso, look.trim, 0.52, 0.08, 0.32, 0, 0.04, 0); // belt
  if (look.name === 'Prinz') {
    // A gold chest plate with shoulder pads.
    box(torso, look.trim, 0.54, 0.34, 0.34, 0, 0.44, 0);
    for (const s of [1, -1]) box(torso, look.trim, 0.18, 0.08, 0.32, s * 0.26, 0.62, 0);
  } else {
    // A wrap-over training top, and a little circle badge.
    box(torso, look.trim, 0.06, 0.4, 0.02, -0.06, 0.38, 0.156).rotation.z = -0.5;
    box(torso, '#f6c445', 0.1, 0.1, 0.02, 0.13, 0.46, 0.158);
  }
  box(torso, look.skin, 0.18, 0.08, 0.18, 0, 0.64, 0); // neck
  fuseOwn(torso);

  const arms = [1, -1].map((s) => {
    const upper = group(torso, s * 0.32, 0.56, 0);
    box(upper, look.name === 'Prinz' ? look.top : look.skin, 0.15, 0.32, 0.16, 0, -0.14, 0);
    fuseOwn(upper);
    const fore = group(upper, 0, -0.3, 0);
    box(fore, look.skin, 0.13, 0.22, 0.14, 0, -0.1, 0);
    box(fore, look.name === 'Prinz' ? '#f6f1e6' : '#2b6fd6', 0.15, 0.08, 0.16, 0, -0.02, 0); // gloves / wristbands
    box(fore, look.name === 'Prinz' ? '#f6f1e6' : look.skin, 0.15, 0.12, 0.15, 0, -0.24, 0); // fist
    fuseOwn(fore);
    return { upper, fore };
  });

  const head = group(torso, 0, 0.68, 0);
  box(head, look.skin, 0.44, 0.44, 0.42, 0, 0.22, 0);
  box(head, INK, 0.09, 0.05, 0.02, -0.1, 0.24, 0.211);
  box(head, INK, 0.09, 0.05, 0.02, 0.1, 0.24, 0.211);
  box(head, '#b9553f', 0.1, 0.025, 0.02, 0, 0.1, 0.211);
  fuseOwn(head);
  // Brows: determined, and they angle when shouting.
  const brows = [-1, 1].map((s) => {
    const b = box(head, INK, 0.13, 0.04, 0.02, s * 0.1, 0.31, 0.215);
    b.rotation.z = s * 0.35;
    return b;
  });
  // The hair: its own material, so it can glow gold when they power up.
  const hairMat = new THREE.MeshStandardMaterial({ color: '#1d1b19', emissive: '#ffcc33', emissiveIntensity: 0, roughness: 0.7 });
  const hair = group(head, 0, 0.44, 0);
  const spike = (w: number, h: number, x: number, y: number, z: number, rz: number, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), hairMat);
    m.position.set(x, y + h / 2, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    hair.add(m);
  };
  if (look.hair === 'wild') {
    // Spikes in every direction, a fringe over the forehead.
    spike(0.46, 0.12, 0, -0.05, -0.02, 0);
    for (const [x, rz, h] of [[-0.2, 0.8, 0.28], [-0.12, 0.4, 0.34], [0, 0, 0.36], [0.12, -0.4, 0.32], [0.2, -0.8, 0.26]] as const) spike(0.11, h, x, 0, -0.04, rz);
    for (const [x, rz] of [[-0.14, 0.2], [0.14, -0.2], [0, 0]] as const) spike(0.1, 0.22, x, -0.02, -0.16, rz, -0.6);
    for (const x of [-0.12, 0, 0.12]) spike(0.08, 0.12, x, -0.16, 0.2, 0, 2.6);
  } else {
    // Tall, swept back like a flame, with a sharp widow's peak.
    spike(0.44, 0.1, 0, -0.06, -0.02, 0);
    for (const [x, h] of [[-0.12, 0.42], [0, 0.52], [0.12, 0.42]] as const) spike(0.13, h, x, 0, -0.06, x * -0.6, -0.25);
    spike(0.08, 0.14, 0, -0.14, 0.2, 0, 2.9);
  }

  // The aura: three soft, see-through shells, hidden until they power up.
  const auraMat = new THREE.MeshBasicMaterial({ color: look.aura, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const aura = group(root, 0, 0, 0);
  for (const [w, h, y] of [[1.2, 2.6, 1.15], [1.0, 2.3, 1.1], [1.4, 1.6, 0.85]] as const) {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), auraMat);
    shell.position.y = y;
    shell.rotation.y = w;
    aura.add(shell);
  }
  // The energy ball, between the hands, and the beam it becomes.
  const ball = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: look.aura, transparent: true }));
  ball.position.set(0, 1.1, 0.45);
  ball.visible = false;
  root.add(ball);
  const beamGeo = new THREE.BoxGeometry(0.36, 0.36, 1);
  beamGeo.translate(0, 0, 0.5); // grows forward from where it starts
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  beam.visible = false;
  root.add(beam);
  void fuse;
  return { root, body, torso, head, arms, legs, hairMat, aura, auraMat, ball, beam, brows };
}
