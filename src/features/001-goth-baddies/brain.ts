import type { Grid, Occupant } from '../../core/grid';

/**
 * How a goth thinks. Pure logic on the floor grid: no graphics in here, so every
 * behaviour can be tested without a browser.
 *
 * She walks cell to cell in straight lines, stops, turns, and reacts to the cube:
 *   - The Stare:      the cube is in her way. She stops and judges it.
 *   - The Following:  she gets curious, trails the cube, then loses interest.
 *   - The Rejection:  bump her once, she glares. Twice, she turns her back.
 *                     Three times, she storms off and the cube's heart breaks.
 *   - The Seat:       leave the cube still for too long and she sits on it.
 */

export const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export type DirIndex = 0 | 1 | 2 | 3;

export type Mode =
  | 'idle' | 'walk' | 'stare'
  | 'follow' | 'lost' | 'caught'
  | 'snub' | 'huff'
  | 'toSit' | 'hop' | 'sit' | 'hang' | 'plop' | 'rise' | 'hopOff';

export type EmoteKind = 'dots' | 'q' | 'bang' | 'note' | 'anger';

export const WALK_SPEED = 1.25; // cells per second
export const HUFF_SPEED = 2.6;
export const TURN_WAIT = 0.26;
export const EMOTE_SECONDS = 1.7;
export const HOP_SECONDS = 0.45;
const LEASH = 5;

/** The parts of the cube a goth can see (and one she can set: pinned). */
export interface CubeView {
  x: number;
  z: number;
  rolls: number;
  moving: boolean;
  pinned: boolean;
  struggles: number;
  idleFor: number;
}

export interface World {
  grid: Grid;
  cube: CubeView;
  rand(): number;
  /** Id of the goth currently using (or heading for) the cube as a seat. */
  sitter: string | null;
  sitCooldown: number;
  /** True in scripted scenes: nobody starts following or sitting on her own. */
  staged: boolean;
  emit(event: 'rejected' | 'plop', npc: Npc): void;
}

export interface Npc {
  id: string;
  occ: Occupant;
  variant: number;
  /** The cell she stands on. */
  x: number;
  z: number;
  /** The cell she is walking into, and how far along (0..1). */
  nx: number | null;
  nz: number | null;
  p: number;
  dir: DirIndex;
  speed: number;
  mode: Mode;
  /** Seconds spent in the current mode. */
  t: number;
  timer: number;
  /** Pause before acting, so a turn is seen before the walk. */
  wait: number;
  steps: number;
  resume: number;
  stareKind: 'blocked' | 'bonked';
  clearFor: number;
  strikes: number;
  strikeAge: number;
  /** The cube bumped into her; handled when she next stands on a cell. */
  pending: boolean;
  followCooldown: number;
  emote: { kind: EmoteKind; t: number } | null;
  /** Seat: the cube's cell, the way she faces on it, and the roll count when she set off. */
  sx: number;
  sz: number;
  sitDir: DirIndex;
  sitRolls: number;
}

export function createNpc(id: string, variant: number, x: number, z: number, dir: DirIndex, grid: Grid): Npc | null {
  const occ: Occupant = { kind: 'goth', id };
  if (!grid.claim(x, z, occ)) return null;
  return {
    id, occ, variant, x, z, nx: null, nz: null, p: 0, dir, speed: WALK_SPEED,
    mode: 'idle', t: 0, timer: 0.4, wait: 0, steps: 0, resume: 0,
    stareKind: 'blocked', clearFor: 0, strikes: 0, strikeAge: 0, pending: false,
    followCooldown: 4, emote: null, sx: 0, sz: 0, sitDir: 1, sitRolls: 0,
  };
}

const manhattan = (n: Npc, c: { x: number; z: number }) => Math.abs(c.x - n.x) + Math.abs(c.z - n.z);

function setMode(n: Npc, mode: Mode, timer = 0): void {
  n.mode = mode;
  n.t = 0;
  n.timer = timer;
}

function say(n: Npc, kind: EmoteKind): void {
  n.emote = { kind, t: 0 };
}

/** Face a direction. Returns true if she had to turn (and so pauses a beat). */
function turn(n: Npc, d: DirIndex): boolean {
  if (n.dir === d) return false;
  n.dir = d;
  n.wait = TURN_WAIT;
  return true;
}

/** Direction that brings her closer to a cell, keeping straight when she can. */
export function dirToward(n: Npc, c: { x: number; z: number }): DirIndex | null {
  const dx = c.x - n.x;
  const dz = c.z - n.z;
  if (dx === 0 && dz === 0) return null;
  const alongX: DirIndex = dx > 0 ? 0 : 2;
  const alongZ: DirIndex = dz > 0 ? 1 : 3;
  if (dx === 0) return alongZ;
  if (dz === 0) return alongX;
  if (n.dir === alongX || n.dir === alongZ) return n.dir;
  return Math.abs(dx) >= Math.abs(dz) ? alongX : alongZ;
}

function dirAway(n: Npc, c: { x: number; z: number }): DirIndex {
  const dx = n.x - c.x;
  const dz = n.z - c.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 2;
  return dz >= 0 ? 1 : 3;
}

type StepResult = 'ok' | 'cube' | 'blocked';

function step(n: Npc, w: World, d: DirIndex): StepResult {
  const tx = n.x + DIRS[d][0];
  const tz = n.z + DIRS[d][1];
  const occ = w.grid.at(tx, tz);
  if (occ) return occ.kind === 'cube' ? 'cube' : 'blocked';
  w.grid.claim(tx, tz, n.occ);
  n.nx = tx;
  n.nz = tz;
  n.p = 0;
  return 'ok';
}

const isFreeAhead = (n: Npc, w: World, d: DirIndex) => w.grid.isFree(n.x + DIRS[d][0], n.z + DIRS[d][1]);

/** A new heading: mostly straight on, sometimes a turn, rarely back. Stays near the cube. */
function pickDir(n: Npc, w: World): DirIndex | null {
  const far = manhattan(n, w.cube) > LEASH;
  let total = 0;
  const weights = [0, 1, 2, 3].map((i) => {
    const d = i as DirIndex;
    if (!isFreeAhead(n, w, d)) return 0;
    const rel = (d - n.dir + 4) % 4;
    let wgt = rel === 0 ? 3 : rel === 2 ? 0.4 : 2;
    if (far) {
      const after = Math.abs(w.cube.x - (n.x + DIRS[d][0])) + Math.abs(w.cube.z - (n.z + DIRS[d][1]));
      wgt *= after < manhattan(n, w.cube) ? 8 : 0.05;
    }
    total += wgt;
    return wgt;
  });
  if (total === 0) return null;
  let r = w.rand() * total;
  for (let i = 0; i < 4; i++) {
    r -= weights[i];
    if (r < 0) return i as DirIndex;
  }
  return null;
}

function wander(n: Npc, w: World): void {
  const d = pickDir(n, w);
  if (d === null) return setMode(n, 'idle', 0.6);
  n.speed = WALK_SPEED;
  setMode(n, 'walk');
  n.steps = 3 + Math.floor(w.rand() * 6);
  turn(n, d);
}

function freeSide(n: Npc, w: World): DirIndex | null {
  const sides = [((n.dir + 1) % 4) as DirIndex, ((n.dir + 3) % 4) as DirIndex];
  if (w.rand() < 0.5) sides.reverse();
  return sides.find((d) => isFreeAhead(n, w, d)) ?? null;
}

function maybeFollow(n: Npc, w: World): boolean {
  if (w.staged || n.followCooldown > 0 || w.cube.idleFor > 0.6) return false;
  const d = manhattan(n, w.cube);
  if (d < 3 || d > 6 || w.rand() > 0.12) return false;
  startFollow(n, w);
  return true;
}

export function startFollow(n: Npc, w: World): void {
  n.speed = WALK_SPEED;
  setMode(n, 'follow', 4.5 + w.rand() * 2.5);
  say(n, 'q');
}

function maybeSit(n: Npc, w: World): boolean {
  if (w.staged || w.sitter || w.sitCooldown > 0) return false;
  if (w.cube.idleFor < 3.5 || w.cube.pinned) return false;
  const d = manhattan(n, w.cube);
  if (d < 1 || d > 5 || w.rand() > 0.6) return false;
  startSit(n, w);
  return true;
}

export function startSit(n: Npc, w: World): void {
  w.sitter = n.id;
  n.sitRolls = w.cube.rolls;
  n.speed = WALK_SPEED;
  setMode(n, 'toSit');
}

/** The cube just bumped into her. Each bump within a few seconds escalates. */
function react(n: Npc, w: World): void {
  if (['hop', 'sit', 'hang', 'plop', 'rise', 'hopOff'].includes(n.mode)) return;
  if (n.mode === 'toSit') w.sitter = null;
  n.wait = 0;
  if (n.mode === 'follow' || n.mode === 'lost') {
    // Caught following. She was never following. Look, a cloud.
    n.dir = dirAway(n, w.cube);
    n.followCooldown = 14;
    setMode(n, 'caught', 1.6);
    return say(n, 'note');
  }
  n.strikes += 1;
  n.strikeAge = 0;
  if (n.strikes === 1) {
    n.dir = dirToward(n, w.cube) ?? n.dir;
    n.stareKind = 'bonked';
    setMode(n, 'stare');
    return say(n, 'dots');
  }
  if (n.strikes === 2) {
    n.dir = dirAway(n, w.cube);
    setMode(n, 'snub', 2.0);
    return say(n, 'anger');
  }
  n.strikes = 0;
  n.dir = dirAway(n, w.cube);
  n.speed = HUFF_SPEED;
  n.steps = 6;
  n.wait = 0.3;
  setMode(n, 'huff');
  w.emit('rejected', n);
}

const MODES: Record<Mode, (n: Npc, w: World) => void> = {
  idle(n, w) {
    if (n.t < n.timer) return;
    if (maybeSit(n, w) || maybeFollow(n, w)) return;
    wander(n, w);
  },

  walk(n, w) {
    if (n.steps <= 0) return setMode(n, 'idle', 0.7 + w.rand() * 1.6);
    if (maybeSit(n, w) || maybeFollow(n, w)) return;
    const r = step(n, w, n.dir);
    if (r === 'ok') n.steps -= 1;
    else if (r === 'cube') {
      n.resume = n.steps;
      n.stareKind = 'blocked';
      n.clearFor = 0;
      setMode(n, 'stare');
      say(n, 'dots');
    } else setMode(n, 'idle', 0.4 + w.rand() * 0.5);
  },

  stare(n, w) {
    if (n.stareKind === 'bonked') {
      if (n.t > 1.7) wander(n, w);
      return;
    }
    // Blocked: wait for the cube to get out of the way...
    if (isFreeAhead(n, w, n.dir)) {
      if (n.t > 0.7 && n.clearFor > 0.45) {
        setMode(n, 'walk');
        n.steps = Math.max(n.resume, 1);
        n.wait = 0.15;
      }
      return;
    }
    // ...and if it will not, walk around it.
    if (n.t > 2.8) {
      const side = freeSide(n, w);
      if (side === null) return void (n.t = 1.4);
      setMode(n, 'walk');
      n.steps = 2;
      turn(n, side);
    }
  },

  follow(n, w) {
    if (n.t > n.timer) {
      n.followCooldown = 14;
      return setMode(n, 'lost', 1.4);
    }
    if (manhattan(n, w.cube) <= 2) return;
    const d = dirToward(n, w.cube);
    if (d === null || turn(n, d)) return;
    step(n, w, d);
  },

  lost(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  caught(n, w) {
    if (n.t < n.timer) return;
    setMode(n, 'walk');
    n.steps = 4;
    n.wait = 0.1;
    if (!isFreeAhead(n, w, n.dir)) wander(n, w);
  },

  snub(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  huff(n, w) {
    if (n.steps <= 0) {
      n.speed = WALK_SPEED;
      return setMode(n, 'idle', 1.2);
    }
    if (step(n, w, n.dir) === 'ok') return void (n.steps -= 1);
    const side = freeSide(n, w);
    if (side === null) n.steps = 0;
    else turn(n, side);
  },

  toSit(n, w) {
    if (w.cube.rolls !== n.sitRolls || n.t > 9) {
      // It moved. She was not going to sit on it anyway.
      w.sitter = null;
      w.sitCooldown = 8;
      return setMode(n, 'idle', 0.8);
    }
    const d = dirToward(n, w.cube);
    if (d === null || turn(n, d)) return;
    if (manhattan(n, w.cube) > 1) return void step(n, w, d);
    n.sx = w.cube.x;
    n.sz = w.cube.z;
    // Sit facing the camera side where possible, so her face is seen.
    n.sitDir = n.z > n.sz ? 0 : 1;
    w.cube.pinned = true;
    w.cube.struggles = 0;
    setMode(n, 'hop');
  },

  hop(n) {
    if (n.t > HOP_SECONDS) {
      n.dir = n.sitDir;
      setMode(n, 'sit', 9);
    }
  },

  sit(n, w) {
    const c = w.cube;
    if (c.struggles >= 3) c.pinned = false;
    if (!c.pinned && (c.moving || c.x !== n.sx || c.z !== n.sz)) {
      // The seat left. Gravity has not noticed yet.
      setMode(n, 'hang');
      return say(n, 'bang');
    }
    if (n.t > n.timer) {
      c.pinned = false;
      setMode(n, 'hopOff');
    }
  },

  hang(n, w) {
    if (n.t < 0.32 || !w.grid.claim(n.sx, n.sz, n.occ)) return;
    w.grid.release(n.x, n.z, n.occ);
    n.x = n.sx;
    n.z = n.sz;
    setMode(n, 'plop');
    w.emit('plop', n);
  },

  plop(n) {
    if (n.t > 1.15) setMode(n, 'rise');
  },

  rise(n, w) {
    if (n.t < 0.45) return;
    w.sitter = null;
    w.sitCooldown = 25;
    n.dir = dirToward(n, w.cube) ?? n.dir;
    n.stareKind = 'bonked';
    setMode(n, 'stare');
    say(n, 'dots');
  },

  hopOff(n, w) {
    if (n.t < HOP_SECONDS) return;
    w.sitter = null;
    w.sitCooldown = 20;
    setMode(n, 'idle', 1);
  },
};

/** Advance one goth by dt seconds. */
export function tick(n: Npc, w: World, dt: number): void {
  n.t += dt;
  n.strikeAge += dt;
  if (n.strikeAge > 7) n.strikes = 0;
  n.followCooldown -= dt;
  if (n.emote && (n.emote.t += dt) > EMOTE_SECONDS) n.emote = null;

  if (n.nx !== null && n.nz !== null) {
    n.p += n.speed * dt;
    if (n.p < 1) return;
    w.grid.release(n.x, n.z, n.occ);
    n.x = n.nx;
    n.z = n.nz;
    n.nx = n.nz = null;
    n.p = 0;
  }
  if (n.mode === 'stare') n.clearFor = isFreeAhead(n, w, n.dir) ? n.clearFor + dt : 0;
  if (n.pending) {
    n.pending = false;
    react(n, w);
    return;
  }
  if (n.wait > 0) {
    n.wait -= dt;
    return;
  }
  MODES[n.mode](n, w);
}

/** Move her somewhere else entirely (used to keep the world populated as the cube travels). */
export function relocate(n: Npc, w: World, x: number, z: number): boolean {
  if (n.nx !== null || !['idle', 'walk'].includes(n.mode)) return false;
  if (!w.grid.claim(x, z, n.occ)) return false;
  w.grid.release(n.x, n.z, n.occ);
  n.x = x;
  n.z = z;
  setMode(n, 'idle', 0.3);
  return true;
}
