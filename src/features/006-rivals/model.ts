import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
 * Simple hair: a neat short cut, one solid piece with no gaps for skin to show through.
 * It sits a little proud of the head all round (top, back, sides, hairline), and stops
 * above the brows so the face stays clear. Sonny's has a soft fringe and a lock at one
 * temple; Prinz's is combed straight back, rising toward the crown.
 *
 * Head space: the skin block spans x ±0.22, y 0 to 0.44, z ±0.24 (front is +z).
 */
function addHair(head: THREE.Group, look: FighterLook, mat: THREE.Material): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  /** A block given by its extents rather than its centre: easier to keep gap-free. */
  const block = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts.push(g);
  };
  // The cap over the top, overhanging every side.
  block(-0.25, 0.25, 0.4, 0.5, -0.275, 0.265);
  // Down the back of the head, to the nape.
  block(-0.25, 0.25, 0.06, 0.42, -0.275, -0.205);
  // Over the sides: above the ears at the front, down behind them toward the back.
  for (const s of [1, -1]) {
    const [x0, x1] = s > 0 ? [0.212, 0.25] : [-0.25, -0.212];
    block(x0, x1, 0.27, 0.42, -0.06, 0.13);
    block(x0, x1, 0.12, 0.42, -0.25, -0.05);
  }
  if (look.name === 'Sonny') {
    // A little volume on top, a soft fringe along the hairline, a lock at the left temple.
    block(-0.22, 0.22, 0.5, 0.55, -0.24, 0.2);
    block(-0.24, 0.24, 0.415, 0.47, 0.2, 0.272);
    block(-0.07, 0.17, 0.4, 0.43, 0.24, 0.275);
    block(-0.25, -0.185, 0.33, 0.45, 0.16, 0.27);
  } else {
    // Combed straight back: a clean hairline, a small peak, and height toward the crown.
    block(-0.235, 0.235, 0.425, 0.48, 0.2, 0.262);
    block(-0.045, 0.045, 0.41, 0.44, 0.24, 0.268);
    block(-0.22, 0.22, 0.5, 0.55, -0.2, 0.16);
    block(-0.2, 0.2, 0.55, 0.6, -0.26, -0.02);
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  for (const g of parts) g.dispose();
  mesh.castShadow = true;
  mesh.name = 'hair';
  head.add(mesh);
  return mesh;
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
    // Arms hang off the body (like everyone else's), so they swing as they walk.
    const arm = group(body, side * 0.32, HIP + 0.56, 0);
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
  // The head too: the shared animation places it relative to the body.
  const head = group(body, 0, 1.4, 0);
  box(head, look.skin, 0.44, 0.44, 0.48, 0, 0.22, 0); // the standard depth: the face sits flush on it
  box(head, look.skin, 0.06, 0.1, 0.08, 0.23, 0.2, 0); // ears
  box(head, look.skin, 0.06, 0.1, 0.08, -0.23, 0.2, 0);
  const f = face(head, look);
  addHair(head, look, new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7 }));
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
  auraMat: THREE.ShaderMaterial;
  /** Flames that rise off the aura and fade. */
  flames: THREE.Mesh[];
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
  box(head, look.skin, 0.44, 0.44, 0.48, 0, 0.22, 0); // the standard depth: the face sits flush on it
  box(head, look.skin, 0.06, 0.1, 0.08, 0.23, 0.2, 0);
  box(head, look.skin, 0.06, 0.1, 0.08, -0.23, 0.2, 0);
  const f = face(head, look);
  // In a fight the hair can glow gold, so it gets a material of its own.
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, emissive: '#ffcc33', emissiveIntensity: 0, roughness: 0.7 });
  const hair = addHair(head, look, hairMat);
  // The skin, ears and eyes as one mesh. The brows stay loose (they frown), and so does
  // the hair (it glows).
  const loose = [...f.brows, hair];
  for (const o of loose) head.remove(o);
  fuseOwn(head);
  for (const o of loose) head.add(o);
  // The aura: a soft glow round the body, brightest at the edges and fading toward the
  // top, with flames licking upward. Drawn by a little shader, so it reads as light.
  const auraMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(look.aura) }, power: { value: 0 }, time: { value: 0 } },
    vertexShader: `
      varying vec3 vN;
      varying float vY;
      void main() {
        vN = normalize(normalMatrix * normal);
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float power;
      uniform float time;
      varying vec3 vN;
      varying float vY;
      void main() {
        float rim = pow(1.0 - abs(vN.z), 1.5);
        float flick = 0.8 + 0.2 * sin(time * 17.0 + vY * 8.0);
        float fade = smoothstep(1.0, -0.4, vY);
        gl_FragColor = vec4(color * 1.25, (0.12 + rim * 0.88) * power * flick * fade * 0.55);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const aura = group(root, 0, 0, 0);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), auraMat);
  shell.scale.set(0.62, 1.2, 0.62);
  shell.position.y = 1.0;
  aura.add(shell);
  const flameGeo = new THREE.SphereGeometry(1, 10, 8);
  flameGeo.scale(0.16, 0.42, 0.16);
  const flames = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(flameGeo, auraMat);
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.4, 0.4, Math.sin(a) * 0.4);
    aura.add(m);
    return m;
  });
  const ball = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: look.aura, transparent: true }));
  ball.position.set(0, 1.1, 0.45);
  ball.visible = false;
  root.add(ball);
  const beamGeo = new THREE.BoxGeometry(0.36, 0.36, 1);
  beamGeo.translate(0, 0, 0.5);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  beam.visible = false;
  root.add(beam);
  return { root, body, torso, head, arms, legs, hairMat, aura, auraMat, flames, ball, beam, brows: f.brows };
}
