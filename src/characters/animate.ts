import { DIRS, EMOTE_SECONDS, HOP_SECONDS, type Npc, type World } from './brain';
import { showSymbol } from './emotes';
import { HIP, SCALE, type Rig } from './rig';

/** Turns what a character is doing (brain.ts) into how they look doing it. */

export interface Motion {
  yaw: number;
  yawVel: number;
  phase: number;
  /** Smoothed pose values, eased toward the target for the current mode. */
  pose: Pose;
}

interface Pose {
  headPitch: number; headYaw: number; headRoll: number;
  lids: number; brow: number; mouthW: number; mouthH: number;
  armLx: number; armLz: number; armRx: number; armRz: number;
  legL: number; legR: number;
  lean: number; y: number;
  /** Forward bend at the waist, and extra turn on the spot (for twirls). */
  bend: number;
}

const REST: Pose = {
  headPitch: 0, headYaw: 0, headRoll: 0, lids: 0.3, brow: 0, mouthW: 1, mouthH: 1,
  armLx: 0, armLz: 0.05, armRx: 0, armRz: -0.05, legL: 0, legR: 0, lean: 0, y: 0, bend: 0,
};
const CROSSED = { armLx: -0.95, armLz: -0.75, armRx: -0.8, armRz: 0.75 };
const SEAT_Y = 1 - (HIP - 0.1) * SCALE;
const FLOOR_SEAT_Y = (0.1 - HIP) * SCALE;
const SEATED_LEGS = -1.45;

export const newMotion = (n: Npc): Motion => ({ yaw: dirYaw(n.dir), yawVel: 0, phase: 0, pose: { ...REST } });

const dirYaw = (d: number) => Math.atan2(DIRS[d][0], DIRS[d][1]);
const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function targetPose(n: Npc, w: World, m: Motion, time: number, px: number, pz: number): Pose {
  const p: Pose = { ...REST, lids: n.persona.restLids };
  const happy = n.persona.restLids < 0.1;
  if (happy) {
    p.brow = -0.3;
    p.mouthW = 1.15;
  }
  const walking = n.nx !== null;
  const seed = n.id.charCodeAt(n.id.length - 1);
  const lookAtCube = (maxPitch: number) => {
    const at = n.focus ?? w.cube;
    const dx = at.x - px;
    const dz = at.z - pz;
    const dist = Math.hypot(dx, dz);
    p.headYaw = clamp(wrap(Math.atan2(dx, dz) - m.yaw), -1.1, 1.1);
    p.headPitch = clamp(Math.atan2(1.1, Math.max(dist, 0.6)), 0, maxPitch);
  };

  if (walking) {
    const swing = Math.sin(m.phase);
    const stride = n.mode === 'huff' ? 0.8 : 0.55;
    p.legL = swing * stride;
    p.legR = -swing * stride;
    p.armLx = -swing * stride * 0.75;
    p.armRx = swing * stride * 0.75;
    p.y = Math.abs(Math.cos(m.phase)) * 0.035 * n.persona.bounce;
    if (happy) p.headRoll = Math.sin(m.phase) * 0.07;
  } else if (n.mode === 'idle' || n.mode === 'walk') {
    // Standing around: slow look left and right, weight on one hip.
    p.headYaw = Math.sin(time * 0.55 + seed) * 0.55;
    p.headRoll = Math.sin(time * 0.4 + seed * 2) * 0.05;
    p.lean = Math.sin(time * 0.3 + seed) * 0.03;
  }

  switch (n.mode) {
    case 'stare':
      lookAtCube(0.36);
      Object.assign(p, CROSSED);
      p.lids = 0.55;
      p.brow = 0.42;
      p.mouthW = 0.75;
      break;
    case 'follow':
      lookAtCube(0.25);
      p.headRoll = 0.22;
      p.lids = 0;
      p.brow = -0.25;
      break;
    case 'toSit':
      lookAtCube(0.3);
      p.lids = 0.45;
      break;
    case 'lost':
      p.headYaw = 1.0;
      p.lids = 0.6;
      p.armLx = -0.25;
      break;
    case 'caught':
      // Suddenly very interested in the sky. Whistling.
      p.headYaw = -0.7;
      p.headPitch = -0.35;
      p.lids = 0.15;
      p.brow = -0.3;
      p.mouthW = 0.45;
      p.mouthH = 1.7;
      p.armLx = 0.35;
      p.armRx = 0.35;
      break;
    case 'snub':
      Object.assign(p, CROSSED);
      p.headPitch = -0.28;
      p.headYaw = 0.35;
      p.lids = 1;
      p.brow = 0.3;
      break;
    case 'huff':
      p.headPitch = -0.2;
      p.lids = 0.75;
      p.brow = 0.35;
      break;
    case 'hop':
    case 'hopOff':
      p.armLz = 0.9;
      p.armRz = -0.9;
      p.legL = p.legR = -0.5;
      break;
    case 'sit': {
      // Legs swinging, inspecting her nails. The cube is furniture now.
      p.legL = SEATED_LEGS + Math.sin(time * 3.2) * 0.22;
      p.legR = SEATED_LEGS - Math.sin(time * 3.2) * 0.22;
      p.armRx = -1.75;
      p.armRz = 0.5;
      p.armLx = 0.3;
      p.armLz = 0.3;
      p.headYaw = -0.3;
      p.headPitch = 0.12;
      p.lids = 0.55;
      break;
    }
    case 'hang':
      p.legL = p.legR = SEATED_LEGS;
      p.armLz = 1.5;
      p.armRz = -1.5;
      p.lids = 0;
      p.brow = -0.5;
      p.mouthW = 0.5;
      p.mouthH = 2.2;
      break;
    case 'plop':
      p.legL = SEATED_LEGS - 0.1;
      p.legR = SEATED_LEGS - 0.1;
      p.armLx = 0.7;
      p.armRx = 0.7;
      p.armLz = 0.35;
      p.armRz = -0.35;
      p.lids = n.t < 0.6 ? 0 : 0.5;
      p.brow = n.t < 0.6 ? -0.5 : 0.4;
      p.headPitch = n.t < 0.6 ? 0 : 0.2;
      p.mouthW = 0.5;
      p.mouthH = n.t < 0.6 ? 2.2 : 1;
      break;
    case 'rise':
      p.brow = 0.4;
      p.lids = 0.5;
      break;
    case 'pat':
      // Leaning over, one hand going pat, pat, pat.
      lookAtCube(0.3);
      p.bend = 0.32;
      p.armRx = -1.05 + Math.sin(time * 11) * 0.28;
      p.armRz = 0.2;
      p.lids = 0.9;
      p.brow = -0.3;
      p.mouthW = 1.4;
      break;
    case 'wave':
      lookAtCube(0.15);
      p.armLx = 0;
      p.armLz = 2.45 + Math.sin(time * 13) * 0.4;
      p.headRoll = 0.16;
      p.lids = 0;
      p.brow = -0.35;
      p.mouthW = 1.3;
      p.mouthH = 1.8;
      p.y = Math.abs(Math.sin(time * 7)) * 0.05;
      break;
    case 'giggle':
      // Hands to the face, eyes shut, bouncing.
      lookAtCube(0.25);
      p.armLx = p.armRx = -2.25;
      p.armLz = -0.55;
      p.armRz = 0.55;
      p.lids = 1;
      p.brow = -0.3;
      p.headRoll = Math.sin(time * 9) * 0.12;
      p.y = Math.abs(Math.sin(time * 12)) * 0.07;
      break;
    case 'gift':
      lookAtCube(0.3);
      p.bend = 0.22;
      p.armLx = p.armRx = -1.25;
      p.armLz = -0.2;
      p.armRz = 0.2;
      p.lids = 0.9;
      p.brow = -0.3;
      p.mouthW = 1.4;
      break;
    case 'twirl':
      p.armLz = 1.25;
      p.armRz = -1.25;
      p.lids = 1;
      p.brow = -0.3;
      p.y = Math.sin(Math.PI * Math.min(1, n.t / 0.9)) * 0.12;
      break;
  }
  return p;
}

export function animate(rig: Rig, n: Npc, w: World, m: Motion, time: number, dt: number): void {
  // Where she is: on a cell, between two, or somewhere above the cube.
  let px = n.x;
  let pz = n.z;
  let py = 0;
  if (n.nx !== null && n.nz !== null) {
    px += (n.nx - n.x) * n.p;
    pz += (n.nz - n.z) * n.p;
  }
  const back = 0.1;
  const seatX = n.sx - DIRS[n.sitDir][0] * back;
  const seatZ = n.sz - DIRS[n.sitDir][1] * back;
  if (n.mode === 'hop' || n.mode === 'hopOff') {
    const raw = smooth(n.t / HOP_SECONDS);
    const k = n.mode === 'hop' ? raw : 1 - raw;
    px = n.x + (seatX - n.x) * k;
    pz = n.z + (seatZ - n.z) * k;
    py = SEAT_Y * k + Math.sin(Math.PI * k) * 0.55;
  } else if (n.mode === 'sit' || n.mode === 'hang') {
    px = seatX;
    pz = seatZ;
    py = SEAT_Y;
  } else if (n.mode === 'plop') {
    const fall = Math.min(1, n.t / 0.17);
    const bounce = n.t > 0.17 ? Math.exp(-(n.t - 0.17) * 9) * Math.abs(Math.sin((n.t - 0.17) * 16)) * 0.09 : 0;
    py = SEAT_Y + (FLOOR_SEAT_Y - SEAT_Y) * fall * fall + bounce;
  } else if (n.mode === 'rise') {
    py = FLOOR_SEAT_Y * (1 - smooth(n.t / 0.4));
  }

  // Turning takes a moment; hair lags behind.
  const before = m.yaw;
  m.yaw += wrap(dirYaw(n.dir) - m.yaw) * (1 - Math.exp(-11 * dt));
  m.yawVel += ((dt > 0 ? wrap(m.yaw - before) / dt : 0) - m.yawVel) * (1 - Math.exp(-8 * dt));
  if (n.nx !== null) m.phase += n.speed * dt * Math.PI * 1.5;
  else m.phase = 0;

  const target = targetPose(n, w, m, time, px, pz);
  const ease = 1 - Math.exp(-(n.mode === 'hang' || n.mode === 'plop' ? 22 : 12) * dt);
  const p = m.pose;
  for (const k of Object.keys(p) as (keyof Pose)[]) p[k] += (target[k] - p[k]) * ease;
  // Rising from the floor: legs fold back under her in step with the lift.
  if (n.mode === 'rise') p.legL = p.legR = SEATED_LEGS * (1 - smooth(n.t / 0.4));

  rig.root.position.set(px, py, pz);
  const spin = n.mode === 'twirl' ? smooth(n.t / 0.85) * Math.PI * 2 : 0;
  rig.root.rotation.y = m.yaw + spin;
  rig.body.position.y = p.y;
  rig.body.rotation.z = p.lean;
  rig.torso.rotation.x = p.bend;
  rig.head.position.z = Math.sin(p.bend) * 0.62;
  rig.head.position.y = 1.4 - (1 - Math.cos(p.bend)) * 0.62;
  rig.armL.position.z = rig.armR.position.z = Math.sin(p.bend) * 0.58;
  rig.torso.scale.y = 1 + Math.sin(time * 1.6 + n.id.length) * 0.008;
  rig.head.rotation.set(p.headPitch, p.headYaw, p.headRoll);
  rig.armL.rotation.set(p.armLx, 0, p.armLz);
  rig.armR.rotation.set(p.armRx, 0, p.armRz);
  rig.legL.rotation.x = p.legL * (p.legL < -1 ? 1 : rig.stride);
  rig.legR.rotation.x = p.legR * (p.legR < -1 ? 1 : rig.stride);

  // Face.
  const blink = (time * 0.31 + n.id.charCodeAt(n.id.length - 1) * 0.37) % 1 < 0.035 ? 1 : 0;
  const lid = Math.max(p.lids, blink);
  rig.lids.forEach((l) => {
    l.scale.y = 1 + lid * 2.6;
    l.position.y = 0.323 - lid * 0.026;
  });
  rig.brows.forEach((b, i) => {
    const side = i === 0 ? 1 : -1;
    b.rotation.z = side * p.brow;
    b.position.y = 0.392 - Math.max(0, p.brow) * 0.02 + Math.max(0, -p.brow) * 0.03;
  });
  rig.pupils.forEach((pu) => (pu.position.y = 0.268 - clamp(p.headPitch, 0, 0.4) * 0.05));
  rig.hang.forEach((h) => (h.rotation.x = -p.headPitch));
  rig.mouth.scale.set(p.mouthW, p.mouthH, 1);

  const walkSway = Math.sin(m.phase) * 0.06;
  rig.sway.forEach((s, i) => {
    s.rotation.z = clamp(m.yawVel * 0.07, -0.5, 0.5) + walkSway * (i % 2 ? 1 : -1);
    if (!rig.hang.includes(s)) s.rotation.x = n.nx !== null ? 0.1 + (n.mode === 'huff' ? 0.2 : 0) : 0;
  });

  showSymbol(rig.emote, n.emote?.kind ?? null, n.emote?.t ?? 0, EMOTE_SECONDS, 0.62 / SCALE);
}
