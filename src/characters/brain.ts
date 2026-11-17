import type { Grid, Occupant } from '../core/grid';

/**
 * How a character thinks. Pure logic on the floor grid: no graphics in here, so every
 * behaviour can be tested without a browser.
 *
 * Everyone walks cell to cell in straight lines, stops, turns, and reacts to the cube.
 * What they do about it depends on their persona.
 *
 * Goths (blocked: stare, bonk: reject, sits):
 *   - The Stare:      the cube is in her way. She stops and judges it.
 *   - The Following:  she gets curious, trails the cube, then loses interest.
 *   - The Rejection:  bump her once, she glares. Twice, she turns her back.
 *                     Three times, she storms off and the cube's heart breaks.
 *   - The Seat:       leave the cube still for too long and she sits on it.
 *
 * The leader (blocked: inspect, bonk: summon, builds) and his soldiers (follow in a chain):
 *   - The Build:      every so often he stops and hammers a new soldier into existence.
 *   - The Column:     each soldier walks in his footsteps, one cell further back than the last.
 *   - The Inspection: the cube is in his way. He studies it closely.
 *   - The Alarm:      bump him and he points; every soldier marches over and boxes the cube in.
 *
 * Cult members (anyone the cube has recruited, whatever they were before):
 *   - The Procession: they walk in the cube's footsteps, in the order they joined.
 *   - The Circle:     when the cube stops, they gather round it and worship.
 *   - Reverence:      bump one and they bow.
 *
 * Femboys (blocked: pat, bonk: adopt, greets):
 *   - The Pat:        the cube is in his way. He pats it on the head.
 *   - The Fan Club:   they follow the cube a lot, and wave when caught.
 *   - The Adoption:   bump him once, he giggles. Twice, more pats. Three times,
 *                     he ties a bow on the cube.
 *   - The Greeting:   he waves at anyone who is not a femboy. Sometimes they get a bow too.
 */

/** What kind of character this is and how it reacts. */
export interface Persona {
  /** Also the occupant kind on the grid. */
  kind: string;
  blocked: 'stare' | 'pat' | 'inspect';
  bonk: 'reject' | 'adopt' | 'summon' | 'salute';
  caught: 'deny' | 'wave';
  sits: boolean;
  /** Waves at characters of other kinds when they are in the way. */
  greets: boolean;
  followChance: number;
  twirls: boolean;
  /** How bouncy the walk is, and how open the eyes are at rest (for animation). */
  bounce: number;
  restLids: number;
  /** Cells per second, and how far the legs swing. */
  speed: number;
  stride: number;
  /** Turns on the spot instantly instead of taking a beat. */
  snappy: boolean;
  /** Chooses its own way around. If false it only ever follows its `lead`. */
  wanders: boolean;
  /** Stops now and then to build something (the world says when). */
  builds: boolean;
  /** How it stands when it has nothing to do. */
  rest: 'plain' | 'handsBehind' | 'attention';
}

export const GOTH: Persona = {
  kind: 'goth', blocked: 'stare', bonk: 'reject', caught: 'deny', sits: true, greets: false,
  followChance: 0.12, twirls: false, bounce: 1, restLids: 0.3,
  speed: 1.25, stride: 1, snappy: false, wanders: true, builds: false, rest: 'plain',
};
export const FEMBOY: Persona = {
  kind: 'femboy', blocked: 'pat', bonk: 'adopt', caught: 'wave', sits: false, greets: true,
  followChance: 0.3, twirls: true, bounce: 1.9, restLids: 0.04,
  speed: 1.25, stride: 1, snappy: false, wanders: true, builds: false, rest: 'plain',
};
export const LEADER: Persona = {
  kind: 'leader', blocked: 'inspect', bonk: 'summon', caught: 'deny', sits: false, greets: false,
  followChance: 0, twirls: false, bounce: 0.6, restLids: 0.4,
  speed: 0.95, stride: 0.8, snappy: false, wanders: true, builds: true, rest: 'handsBehind',
};
export const SOLDIER: Persona = {
  kind: 'soldier', blocked: 'stare', bonk: 'salute', caught: 'deny', sits: false, greets: false,
  followChance: 0, twirls: false, bounce: 0.5, restLids: 0.2,
  speed: 1.7, stride: 1.9, snappy: true, wanders: false, builds: false, rest: 'attention',
};

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
  | 'toSit' | 'hop' | 'sit' | 'hang' | 'plop' | 'rise' | 'hopOff'
  | 'pat' | 'wave' | 'giggle' | 'gift' | 'twirl'
  | 'build' | 'inspect' | 'order' | 'fume' | 'salute' | 'march' | 'swarm' | 'revere'
  | 'visit' | 'riding' | 'listen' | 'floored';

export type EmoteKind = 'dots' | 'q' | 'bang' | 'note' | 'anger' | 'heart' | 'sparkle';

export const WALK_SPEED = 1.25; // cells per second
export const HUFF_SPEED = 2.6;
export const TURN_WAIT = 0.26;
export const EMOTE_SECONDS = 1.7;
export const HOP_SECONDS = 0.45;
/** How far a character strays from home before turning back. */
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

/** Anything a column can follow: where it is, which way it faces, where it has been. */
export interface Lead {
  x: number;
  z: number;
  dir: DirIndex;
  trail: { x: number; z: number }[];
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
  /** Seconds left of an alarm: followers leave the column and box the cube in. */
  alarm: number;
  /** Set when it is time for a builder to build something. */
  wantBuild: boolean;
  /** rejected, plop, pat, bow (a bow for the cube), greet (data: {id, gift}). */
  emit(event: string, npc: Npc, data?: unknown): void;
}

export interface Npc {
  id: string;
  occ: Occupant;
  persona: Persona;
  /** What she is looking at when it is not the cube. */
  focus: { x: number; z: number } | null;
  /** Someone just waved at her from this cell; handled when she next stands on a cell. */
  greeted: { x: number; z: number } | null;
  /** The next greeting comes with a bow. */
  giftNext: boolean;
  /** Who this one follows, if it marches in a column, and its place in that column. */
  lead: Lead | null;
  slot: number;
  /** Recruited by the cube. Follows it from now on, whatever they were before. */
  cult: boolean;
  /** Conscripted: marches in someone's column whatever they were before. A sermon undoes it. */
  drafted: boolean;
  /** Caught by a blast in the middle of a step: goes down on arriving. */
  knocked: boolean;
  /** A cell just stepped out of while going round something, so they do not step straight back. */
  avoid: { x: number; z: number; steps: number } | null;
  /** A guard's post: where to stand and which way to face. Guards do not follow the column. */
  post: { x: number; z: number; dir: DirIndex } | null;
  /** Seconds a guard stays off its post, crowding the cube, after something sets it off. */
  alert: number;
  /** Somewhere they have decided to walk to (a ride, say). */
  goal: { x: number; z: number } | null;
  /** Set while a ride is carrying them: where they are drawn, and how they sit. */
  carry: { x: number; y: number; z: number; yaw: number; pose: 'sit' | 'bounce' | 'rest' } | null;
  /** The last few cells it stood on, newest first. Followers walk along this. */
  trail: { x: number; z: number }[];
  /** A reaction queued from outside, played when next free. */
  order: 'fume' | 'salute' | 'cheer' | null;
  variant: number;
  /** The cell she stands on. */
  x: number;
  z: number;
  /** Where she lives: the middle of the patch she wanders in and returns to. */
  home: { x: number; z: number };
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

export function createNpc(
  id: string, variant: number, x: number, z: number, dir: DirIndex, grid: Grid, persona: Persona = GOTH,
): Npc | null {
  const occ: Occupant = { kind: persona.kind, id };
  if (!grid.claim(x, z, occ)) return null;
  return {
    id, occ, persona, focus: null, greeted: null, giftNext: false, lead: null, slot: 0, cult: false, drafted: false, knocked: false, avoid: null, post: null, alert: 0, goal: null, carry: null, trail: [], order: null,
    variant, x, z, home: { x, z }, nx: null, nz: null, p: 0, dir, speed: persona.speed,
    mode: persona.wanders ? 'idle' : 'march', t: 0, timer: 0.4, wait: 0, steps: 0, resume: 0,
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
  n.wait = n.persona.snappy ? 0.05 : TURN_WAIT;
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
  // Everyone has a home patch and drifts back to it. Nobody trails after the cube
  // unless they have a reason to, so the world stays spread out.
  const far = manhattan(n, n.home) > LEASH;
  let total = 0;
  const weights = [0, 1, 2, 3].map((i) => {
    const d = i as DirIndex;
    if (!isFreeAhead(n, w, d)) return 0;
    const rel = (d - n.dir + 4) % 4;
    let wgt = rel === 0 ? 3 : rel === 2 ? 0.4 : 2;
    if (far) {
      const after = Math.abs(n.home.x - (n.x + DIRS[d][0])) + Math.abs(n.home.z - (n.z + DIRS[d][1]));
      wgt *= after < manhattan(n, n.home) ? 8 : 0.05;
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
  n.focus = null;
  if (!n.persona.wanders || n.cult || n.drafted) return setMode(n, 'march');
  const d = pickDir(n, w);
  if (d === null) return setMode(n, 'idle', 0.6);
  n.speed = n.persona.speed;
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
  if (d < 3 || d > 6 || w.rand() > n.persona.followChance) return false;
  startFollow(n, w);
  return true;
}

export function startFollow(n: Npc, w: World): void {
  n.speed = n.persona.speed;
  setMode(n, 'follow', 4.5 + w.rand() * 2.5);
  say(n, 'q');
}

function maybeSit(n: Npc, w: World): boolean {
  if (!n.persona.sits || w.staged || w.sitter || w.sitCooldown > 0) return false;
  if (w.cube.idleFor < 3.5 || w.cube.pinned) return false;
  const d = manhattan(n, w.cube);
  if (d < 1 || d > 5 || w.rand() > 0.6) return false;
  startSit(n, w);
  return true;
}

export function startSit(n: Npc, w: World): void {
  w.sitter = n.id;
  n.sitRolls = w.cube.rolls;
  n.speed = n.persona.speed;
  setMode(n, 'toSit');
}

const faceCube = (n: Npc, w: World) => void (n.dir = dirToward(n, w.cube) ?? n.dir);

/** The cube just bumped into her. Each bump within a few seconds escalates. */
function react(n: Npc, w: World): void {
  if (['hop', 'sit', 'hang', 'plop', 'rise', 'hopOff', 'riding', 'floored'].includes(n.mode)) return;
  if (n.mode === 'toSit') w.sitter = null;
  n.wait = 0;
  n.focus = null;
  if (n.cult) {
    // The cube touched them. Best day of their life.
    faceCube(n, w);
    setMode(n, 'revere', 1.4);
    return say(n, 'heart');
  }
  if (n.mode === 'follow' || n.mode === 'lost') {
    n.followCooldown = 14;
    if (n.persona.caught === 'wave') {
      // Caught following, and delighted about it.
      faceCube(n, w);
      setMode(n, 'wave', 1.3);
      return say(n, 'sparkle');
    }
    // Caught following. She was never following. Look, a cloud.
    n.dir = dirAway(n, w.cube);
    setMode(n, 'caught', 1.6);
    return say(n, 'note');
  }
  if (n.persona.bonk === 'summon') {
    // He points. That is all he has to do.
    faceCube(n, w);
    setMode(n, 'order', 1.6);
    w.emit('alarm', n);
    return say(n, 'anger');
  }
  if (n.persona.bonk === 'salute') {
    faceCube(n, w);
    setMode(n, 'salute', 1.0);
    return say(n, 'bang');
  }
  n.strikes += 1;
  n.strikeAge = 0;
  if (n.persona.bonk === 'adopt') {
    faceCube(n, w);
    if (n.strikes === 1) {
      setMode(n, 'giggle', 1.2);
      return say(n, 'sparkle');
    }
    if (n.strikes === 2) {
      n.resume = 0;
      setMode(n, 'pat', 1.7);
      w.emit('pat', n);
      return say(n, 'heart');
    }
    // Third bump: this cube clearly needs a bow.
    n.strikes = 0;
    setMode(n, 'gift', 1.6);
    w.emit('bow', n);
    return say(n, 'heart');
  }
  if (n.strikes === 1) {
    faceCube(n, w);
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

/** Someone waved at her. She looks at them the way she looks at everything. */
function acknowledge(n: Npc): boolean {
  const from = n.greeted;
  n.greeted = null;
  if (!from || !['idle', 'walk', 'stare', 'lost', 'snub'].includes(n.mode)) return false;
  n.focus = from;
  n.dir = dirToward(n, from) ?? n.dir;
  n.wait = 0;
  n.stareKind = 'bonked';
  setMode(n, 'stare');
  say(n, 'dots');
  return true;
}

const RING = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
/** Where worshippers stand, as (forward, sideways) from the cube: behind it, then the four diagonals. */
const GATHER = [[-1, 0], [-1, 1], [-1, -1], [1, 1], [1, -1]];

/** Take up a place right beside the cube and glare at it. */
function surround(n: Npc, w: World): void {
  // Everyone has their own spot around the cube: four sides first, then the corners.
  const [ox, oz] = RING[n.slot % RING.length];
  const spot = { x: w.cube.x + ox, z: w.cube.z + oz };
  if (n.x === spot.x && n.z === spot.z) return void faceCube(n, w);
  const taken = !w.grid.isFree(spot.x, spot.z, n.occ);
  const close = Math.max(Math.abs(n.x - w.cube.x), Math.abs(n.z - w.cube.z)) <= 1;
  // Someone else is standing on it: get as near as possible and glare from there.
  if (taken && (close || manhattan(n, spot) === 1)) return void faceCube(n, w);
  approach(n, w, spot);
}

/** One step toward a cell: the direct way if it is free, otherwise round whatever is in the way. */
function approach(n: Npc, w: World, to: { x: number; z: number }): void {
  const dx = to.x - n.x;
  const dz = to.z - n.z;
  const alongX: DirIndex = dx > 0 ? 0 : 2;
  const alongZ: DirIndex = dz > 0 ? 1 : 3;
  const side = (d: DirIndex): DirIndex[] => [((d + 1) % 4) as DirIndex, ((d + 3) % 4) as DirIndex];
  let ways: DirIndex[];
  if (dx === 0) ways = [alongZ, ...side(alongZ)];
  else if (dz === 0) ways = [alongX, ...side(alongX)];
  else ways = Math.abs(dx) >= Math.abs(dz) ? [alongX, alongZ] : [alongZ, alongX];
  // Keep going straight when that still gets closer: columns look better without zig-zags.
  if (ways.includes(n.dir) && dx !== 0 && dz !== 0) ways = [n.dir, ...ways.filter((d) => d !== n.dir)];
  const open = (way: DirIndex) => {
    const x = n.x + DIRS[way][0];
    const z = n.z + DIRS[way][1];
    return w.grid.isFree(x, z) && !(n.avoid && n.avoid.x === x && n.avoid.z === z);
  };
  let d = ways.find(open);
  if (d === undefined) {
    // Every direct way is taken. Step round it: whichever free cell is nearest the target,
    // and remember where we came from so the next step does not undo this one.
    const after = (way: DirIndex) => Math.abs(to.x - n.x - DIRS[way][0]) + Math.abs(to.z - n.z - DIRS[way][1]);
    d = ([0, 1, 2, 3] as DirIndex[]).filter(open).sort((p, q) => after(p) - after(q))[0];
    if (d === undefined) return;
    n.avoid = { x: n.x, z: n.z, steps: 4 };
  } else if (n.avoid && --n.avoid.steps <= 0) n.avoid = null;
  if (turn(n, d)) return;
  step(n, w, d);
}

const MODES: Record<Mode, (n: Npc, w: World) => void> = {
  idle(n, w) {
    if (n.t < n.timer) return;
    if (maybeSit(n, w) || maybeFollow(n, w)) return;
    if (n.persona.builds && w.wantBuild) {
      w.wantBuild = false;
      n.resume = 0;
      return setMode(n, 'build', 2.2);
    }
    if (n.persona.twirls && !w.staged && w.rand() < 0.2) return setMode(n, 'twirl', 0.9);
    wander(n, w);
  },

  walk(n, w) {
    if (n.steps <= 0) return setMode(n, 'idle', 0.7 + w.rand() * 1.6);
    if (maybeSit(n, w) || maybeFollow(n, w)) return;
    if (n.persona.builds && w.wantBuild) {
      w.wantBuild = false;
      n.resume = n.steps; // carry on walking afterwards
      return setMode(n, 'build', 2.2);
    }
    const r = step(n, w, n.dir);
    if (r === 'ok') n.steps -= 1;
    else if (r === 'cube') {
      n.resume = n.steps;
      if (n.persona.blocked === 'pat') {
        setMode(n, 'pat', 1.7);
        w.emit('pat', n);
        return say(n, 'heart');
      }
      if (n.persona.blocked === 'inspect') {
        setMode(n, 'inspect', 2.2);
        return say(n, 'q');
      }
      n.stareKind = 'blocked';
      n.clearFor = 0;
      setMode(n, 'stare');
      say(n, 'dots');
    } else {
      const other = w.grid.at(n.x + DIRS[n.dir][0], n.z + DIRS[n.dir][1]);
      if (n.persona.greets && other && other.kind !== n.persona.kind) {
        // Someone new! Wave. Possibly accessorise them.
        const gift = n.giftNext || (!w.staged && w.rand() < 0.3);
        n.giftNext = false;
        setMode(n, 'wave', 1.5);
        say(n, 'sparkle');
        return w.emit('greet', n, { id: other.id, gift });
      }
      setMode(n, 'idle', 0.4 + w.rand() * 0.5);
    }
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
      n.speed = n.persona.speed;
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

  /** Knocked flat by a blast. Lies there a moment, then gets up. */
  floored(n) {
    if (n.t > n.timer) setMode(n, 'rise');
  },

  rise(n, w) {
    if (n.t < 0.45) return;
    if (w.sitter === n.id) {
      w.sitter = null;
      w.sitCooldown = 25;
    }
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

  pat(n, w) {
    if (n.t < n.timer) return;
    // Patted. Now go around it.
    const side = freeSide(n, w);
    if (side === null) return wander(n, w);
    setMode(n, 'walk');
    n.steps = Math.max(n.resume, 2);
    turn(n, side);
  },

  wave(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  giggle(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  gift(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  twirl(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  build(n, w) {
    if (n.t < n.timer) return;
    w.emit('built', n);
    if (n.resume <= 0) return wander(n, w);
    setMode(n, 'walk');
    n.steps = n.resume;
    n.resume = 0;
  },

  inspect(n, w) {
    // Same as a pat, minus the affection: look it over, then go around.
    MODES.pat(n, w);
  },

  order(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  fume(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  salute(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  revere(n, w) {
    if (n.t > n.timer) wander(n, w);
  },

  /** Walking somewhere on purpose. Gives up if it takes too long or the spot is taken. */
  visit(n, w) {
    const goal = n.goal;
    if (!goal || n.t > 30) {
      n.goal = null;
      return wander(n, w);
    }
    const there = manhattan(n, goal);
    if (there === 0 || (there === 1 && !w.grid.isFree(goal.x, goal.z, n.occ))) {
      n.goal = null;
      return setMode(n, 'idle', 3);
    }
    approach(n, w, goal);
  },

  /** On a ride. The ride decides when it is over. */
  riding() {},

  /** Being preached to. Stands and listens for as long as the sermon lasts, then moves on. */
  listen(n, w) {
    faceCube(n, w);
    if (n.t > n.timer) wander(n, w);
  },

  march(n, w) {
    if (n.post && (!n.cult || !n.lead)) {
      // A guard, or a cult member with a place in the congregation: stay on the post
      // unless something has set them off.
      if (n.alert > 0) return surround(n, w);
      if (n.x === n.post.x && n.z === n.post.z) return void (n.dir = n.post.dir);
      if (!w.grid.isFree(n.post.x, n.post.z, n.occ) && manhattan(n, n.post) <= 1) return;
      return approach(n, w, n.post);
    }
    if (w.alarm > 0 && !n.cult) return setMode(n, 'swarm');
    const lead = n.lead;
    if (!lead) return;
    if (n.cult && w.cube.idleFor > 1.2 && !w.cube.pinned) {
      // The cube has stopped: gather round it, two cells back. They stand behind it and
      // on the diagonals, never straight ahead or to the side, so it can always roll off.
      const [back, across] = GATHER[n.slot % GATHER.length];
      const reach = 2 + Math.floor(n.slot / GATHER.length);
      const f = DIRS[lead.dir];
      const r = DIRS[(lead.dir + 1) % 4];
      const spot = {
        x: w.cube.x + (f[0] * back + r[0] * across) * reach,
        z: w.cube.z + (f[1] * back + r[1] * across) * reach,
      };
      if (n.x === spot.x && n.z === spot.z) return void faceCube(n, w);
      if (!w.grid.isFree(spot.x, spot.z, n.occ) && manhattan(n, spot) <= 1) return void faceCube(n, w);
      return approach(n, w, spot);
    }
    // My place is where he stood (slot + 1) steps ago. If he has not walked that far
    // yet, the column simply extends straight out behind him.
    let spot = lead.trail[n.slot];
    if (!spot) {
      const end = lead.trail.at(-1) ?? lead;
      const extra = n.slot - lead.trail.length + 1;
      spot = { x: end.x - DIRS[lead.dir][0] * extra, z: end.z - DIRS[lead.dir][1] * extra };
    }
    if (n.x === spot.x && n.z === spot.z) {
      // In place: face whoever is in front.
      const ahead = n.slot === 0 ? lead : (lead.trail[n.slot - 1] ?? lead);
      return void (n.dir = dirToward(n, ahead) ?? lead.dir);
    }
    if (!w.grid.isFree(spot.x, spot.z, n.occ) && manhattan(n, spot) <= 1) return; // someone is on it: wait
    approach(n, w, spot);
  },

  swarm(n, w) {
    if (w.alarm <= 0) return setMode(n, 'march');
    surround(n, w);
  },
};

/** Advance one goth by dt seconds. */
export function tick(n: Npc, w: World, dt: number): void {
  n.t += dt;
  n.strikeAge += dt;
  if (n.strikeAge > 7) n.strikes = 0;
  n.followCooldown -= dt;
  if (n.alert > 0) n.alert -= dt;
  if (n.emote && (n.emote.t += dt) > EMOTE_SECONDS) n.emote = null;

  if (n.nx !== null && n.nz !== null) {
    n.p += n.speed * dt;
    if (n.p < 1) return;
    w.grid.release(n.x, n.z, n.occ);
    n.trail.unshift({ x: n.x, z: n.z });
    if (n.trail.length > 10) n.trail.length = 10;
    n.x = n.nx;
    n.z = n.nz;
    n.nx = n.nz = null;
    n.p = 0;
  }
  if (n.knocked) {
    n.knocked = false;
    floor(n, w);
    return;
  }
  if (n.mode === 'stare') n.clearFor = isFreeAhead(n, w, n.dir) ? n.clearFor + dt : 0;
  if (n.pending) {
    n.pending = false;
    n.greeted = null;
    react(n, w);
    return;
  }
  if (n.greeted && acknowledge(n)) return;
  if (n.order && ['idle', 'walk', 'march'].includes(n.mode)) {
    const what = n.order;
    n.order = null;
    n.wait = 0;
    if (what === 'cheer') {
      // It worked. He spins on the spot with his arms out.
      setMode(n, 'twirl', 0.95);
      say(n, 'sparkle');
      return;
    }
    setMode(n, what, what === 'fume' ? 1.8 : 1.1);
    if (what === 'fume') say(n, 'anger');
    return;
  }
  if (n.wait > 0) {
    n.wait -= dt;
    return;
  }
  MODES[n.mode](n, w);
}

/** Knock someone off their feet. They get up again by themselves. */
export function floor(n: Npc, w: World): void {
  if (['hop', 'sit', 'hang', 'plop', 'rise', 'hopOff', 'riding', 'floored', 'toSit'].includes(n.mode)) return;
  if (n.nx !== null) {
    n.knocked = true;
    return;
  }
  if (n.mode === 'listen') n.timer = 0;
  n.wait = 0;
  n.pending = false;
  n.emote = { kind: 'bang', t: 0 };
  setMode(n, 'floored', 1.2 + w.rand() * 0.6);
}

/** Move her somewhere else entirely (used to keep the world populated as the cube travels). */
export function relocate(n: Npc, w: World, x: number, z: number): boolean {
  if (n.nx !== null || !['idle', 'walk', 'march'].includes(n.mode)) return false;
  if (!w.grid.claim(x, z, n.occ)) return false;
  w.grid.release(n.x, n.z, n.occ);
  n.x = x;
  n.z = z;
  n.trail = [];
  setMode(n, n.persona.wanders && !n.cult ? 'idle' : 'march', 0.3);
  return true;
}
