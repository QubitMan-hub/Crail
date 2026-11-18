import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { stepToward } from '../../core/path';
import { seededRandom } from '../../core/rng';
import { tip } from '../../core/tip';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { isWater, occupy, POOL, SHELF, swimmable, vacate, WATER, type Held } from '../004-octopus';
import { buildSquid } from './model';

/**
 * Tåhgong, Gåmson's squid friend. He is nice.
 *
 * He lives in Gåmson's pool, in the shallow end. Whenever Gåmson is out stealing, he
 * slips out to the rock, takes one thing back off the pile and carries it home to
 * whoever it belongs to. He never does it while Gåmson is in the pool watching.
 *
 * When Gåmson is furious (someone emptied his rock), Tåhgong swims over and hugs him
 * until he calms down. When they are both home with nothing to do, he visits. And when
 * Gåmson comes back to find his pile smaller, Tåhgong waves, innocently.
 *
 * He waves at the cube, hugs it if it bumps into him, and now and then gives it a charm.
 */

const NAME = 'Tåhgong';
/** His spot: the shallow end of the pool, away from Gåmson's den. */
const HOME = { x: POOL.x - 3, z: POOL.z + 1 };
const SPEED = 2.4;
/** How often he checks whether there is something to give back. */
const ERRAND_EVERY = 10;
/** How often, with nothing else to do, he swims over to see Gåmson. */
const VISIT_EVERY = 22;
/** Seconds between charms. Hugs are free. */
const GIFT_EVERY = 75;
const HUG_TIME = 1.3;
const WAVE_TIME = 1.2;

type Mode = 'idle' | 'fetch' | 'lift' | 'deliver' | 'give' | 'home' | 'comfort' | 'visit';

interface OctopusView {
  x: number;
  z: number;
  mode: string;
  stash: string[];
  angry: number;
  suspicious: number;
  handOver?: () => Held | null;
  calm?: () => boolean;
}

export const tahgong: Feature = {
  meta: {
    id: '005-tahgong',
    day: 5,
    title: 'Tåhgong, Gåmson’s squid friend, who is nice',
    credit: { username: 'ump.619', text: 'and give him a squid friend named Tåhgong who is nice', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x7a6);
    const occ: Occupant = { kind: 'squid', id: 'tahgong' };
    const rig = buildSquid();
    ctx.scene.add(rig.root);
    const emote = makeSymbolSprite();
    emote.position.set(0, 1.85, 0);
    rig.root.add(emote);
    let emoteKind: 'heart' | 'sparkle' | 'note' | null = null;
    let emoteAge = 9;
    const say = (kind: 'heart' | 'sparkle' | 'note') => {
      emoteKind = kind;
      emoteAge = 0;
    };

    // Somewhere in the water to start from: home, or the nearest free water.
    const start = [HOME, ...WATER.map(([x, z]) => ({ x, z }))].find((c) => occupy(ctx.grid, c.x, c.z, occ)) ?? HOME;

    const state = {
      x: start.x, z: start.z, nx: null as number | null, nz: null as number | null, p: 0,
      mode: 'idle' as Mode, t: 0, timer: 2,
      carrying: null as string | null, returned: 0, gifts: 0, hugs: 0, comforts: 0, staged: false,
    };
    ctx.state.tahgong = state;
    const mark = addLandmark(ctx, { name: NAME, x: state.x, z: state.z, color: '#f29a86' });
    let held: Held | null = null;
    let facing = Math.PI / 4;
    let stuck = 0;
    let retry = 0;
    let sinceErrand = ERRAND_EVERY - 4;
    let sinceVisit = VISIT_EVERY - 8;
    let sinceGift = GIFT_EVERY;
    let hugging = 9;
    let waving = 9;
    let wavedAt = -99;
    let clock = 0;
    let lastRipple = 0;

    const octopus = () => ctx.state.octopus as OctopusView | undefined;
    const gamsonHome = () => {
      const o = octopus();
      return !!o && o.x === POOL.x && o.z === POOL.z;
    };
    const setMode = (mode: Mode, timer = 0) => Object.assign(state, { mode, t: 0, timer });
    const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= 1;
    const open = (x: number, z: number) => swimmable(ctx.grid, x, z, occ);

    /** Take one step toward a goal; true once next to it (or on it). */
    const moveTo = (goal: { x: number; z: number }, onto: boolean, dt: number): boolean => {
      if (state.nx !== null) return false;
      if (onto ? state.x === goal.x && state.z === goal.z : near(state, goal)) return true;
      if ((retry -= dt) > 0) {
        stuck += dt;
        return false;
      }
      const step = stepToward(ctx.grid, occ, state, goal, { onto, passable: open });
      if (!step || !occupy(ctx.grid, step[0], step[1], occ)) {
        stuck += dt;
        retry = 0.3;
        return false;
      }
      stuck = 0;
      [state.nx, state.nz] = step;
      state.p = 0;
      facing = Math.atan2(step[0] - state.x, step[1] - state.z);
      return false;
    };

    /** Hand the thing over: it goes back on its owner, and he is pleased with himself. */
    const deliver = () => {
      if (!held) return;
      held.item.putBack();
      held.mesh.removeFromParent();
      const name = held.item.name;
      held = null;
      state.carrying = null;
      state.returned += 1;
      waving = 0;
      say('sparkle');
      const cube = ctx.state.cube as { x: number; z: number } | undefined;
      if (cube && Math.abs(cube.x - state.x) + Math.abs(cube.z - state.z) < 14) tip(`${NAME} gave back ${name}. He is nice.`);
      ctx.events.emit('tahgong:returned', { name });
    };

    const errand = (): boolean => {
      const o = octopus();
      if (!o?.handOver || !o.stash.length || gamsonHome() || held) return false;
      setMode('fetch');
      return true;
    };

    // ---- The cube says hello ---------------------------------------------------------
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant !== occ) return;
      hugging = 0;
      state.hugs += 1;
      say('heart');
      const cult = ctx.state.cult as { charms: number; give?: (n?: number) => void } | undefined;
      if (cult?.give && sinceGift >= GIFT_EVERY && cult.charms < 6) {
        sinceGift = 0;
        state.gifts += 1;
        cult.give(1);
        tip(`${NAME} hugs you, and gives you a charm. He is nice.`);
      } else tip(`${NAME} hugs you.`);
    });
    // Gåmson home and suspicious about his pile: Tåhgong waves, all innocence.
    ctx.events.on('octopus:suspicious', () => {
      waving = 0;
      say('note');
    });

    // ---- Scripted control, for tests and video shots -----------------------------------
    ctx.events.on<[boolean]>('direct:tahgong.staged', ([on]) => (state.staged = on));
    ctx.events.on('direct:tahgong.errand', () => void errand());
    ctx.events.on<[number, number]>('direct:tahgong.teleport', ([x, z]) => {
      if (state.nx !== null || !occupy(ctx.grid, x, z, occ)) return;
      vacate(ctx.grid, state.x, state.z, occ);
      Object.assign(state, { x, z });
    });

    // ---- Every frame -------------------------------------------------------------------
    ctx.onUpdate((dt, time) => {
      clock += dt;
      state.t += dt;
      sinceGift += dt;
      if (state.nx !== null && state.nz !== null) {
        state.p += SPEED * dt;
        if (state.p >= 1) {
          vacate(ctx.grid, state.x, state.z, occ);
          Object.assign(state, { x: state.nx, z: state.nz, nx: null, nz: null, p: 0 });
        }
      }
      const cube = ctx.state.cube as { x: number; z: number } | undefined;
      const o = octopus();

      switch (state.mode) {
        case 'idle': {
          if (state.staged) break;
          // A furious friend comes first.
          if (o && o.angry > 0.4 && gamsonHome()) {
            setMode('comfort');
            break;
          }
          sinceErrand += dt;
          sinceVisit += dt;
          if (sinceErrand >= ERRAND_EVERY) {
            sinceErrand = 0;
            if (errand()) break;
          }
          if (sinceVisit >= VISIT_EVERY && gamsonHome()) {
            sinceVisit = 0;
            setMode('visit', 4);
            break;
          }
          if ((state.timer -= dt) <= 0) {
            // A lazy paddle round the pool: water cells only.
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => isWater(state.x + dx, state.z + dz) && open(state.x + dx, state.z + dz));
            const d = dirs[Math.floor(rand() * dirs.length)];
            if (d && occupy(ctx.grid, state.x + d[0], state.z + d[1], occ)) {
              [state.nx, state.nz] = [state.x + d[0], state.z + d[1]];
              state.p = 0;
              facing = Math.atan2(d[0], d[1]);
            }
            state.timer = 2 + rand() * 3;
          }
          // Floating with nothing to do, he turns to watch the world (and the camera).
          if (state.nx === null && waving > WAVE_TIME) facing = Math.PI / 4;
          // Someone he knows: he waves.
          if (cube && Math.abs(cube.x - state.x) + Math.abs(cube.z - state.z) <= 3 && clock - wavedAt > 8) {
            wavedAt = clock;
            waving = 0;
            facing = Math.atan2(cube.x - state.x, cube.z - state.z);
          }
          break;
        }
        case 'comfort':
          // Swim over to Gåmson and hug him until he is calm.
          if (!o || o.angry <= 0 || !gamsonHome()) setMode('home');
          else if (moveTo(POOL, false, dt)) {
            facing = Math.atan2(POOL.x - state.x, POOL.z - state.z);
            hugging = 0;
            say('heart');
            if (o.calm?.()) {
              state.comforts += 1;
              const c = cube && Math.abs(cube.x - state.x) + Math.abs(cube.z - state.z) < 14;
              if (c) tip(`${NAME} hugs Gåmson until he calms down.`);
              ctx.events.emit('tahgong:comforted');
            }
            setMode('give', HUG_TIME + 0.4);
          } else if (stuck > 5) setMode('home');
          break;
        case 'visit':
          // Float beside Gåmson's den for a while, the two of them.
          if (!gamsonHome()) setMode('home');
          else if (moveTo(POOL, false, dt)) {
            facing = Math.atan2(POOL.x - state.x, POOL.z - state.z);
            if (state.t > 0.2 && state.t - dt <= 0.2) say('note');
            if (state.t > state.timer) setMode('home');
          } else if (stuck > 5) setMode('home');
          break;
        case 'fetch':
          if (gamsonHome()) setMode('home'); // Gåmson came back. Not today.
          else if (moveTo(SHELF, false, dt)) {
            facing = Math.atan2(SHELF.x - state.x, SHELF.z - state.z);
            setMode('lift');
          } else if (stuck > 6) setMode('home');
          break;
        case 'lift':
          if (state.t > 0.5) {
            held = o?.handOver?.() ?? null;
            if (!held) {
              setMode('home');
              break;
            }
            held.mesh.position.set(0, 0, 0);
            held.mesh.rotation.set(0, 0, 0);
            held.mesh.scale.setScalar(1);
            rig.hand.add(held.mesh);
            state.carrying = held.item.name;
            setMode('deliver');
          }
          break;
        case 'deliver': {
          const to = held?.item.where();
          if (!held) setMode('home');
          else if (!to) {
            // Whoever it belonged to has gone: it goes back where it came from anyway.
            deliver();
            setMode('home');
          } else if (moveTo(to, false, dt)) {
            facing = Math.atan2(to.x - state.x, to.z - state.z);
            deliver();
            setMode('give', WAVE_TIME);
          } else if (stuck > 6 && state.nx === null) {
            deliver();
            setMode('home');
          }
          break;
        }
        case 'give':
          if (state.t > state.timer) setMode('home');
          break;
        case 'home':
          if (moveTo(HOME, true, dt) || stuck > 6) setMode('idle', 1);
          break;
      }

      // ---- How he looks ------------------------------------------------------------------
      const k = state.nx === null ? 0 : state.p;
      const px = state.x + ((state.nx ?? state.x) - state.x) * k;
      const pz = state.z + ((state.nz ?? state.z) - state.z) * k;
      rig.root.position.set(px, 0, pz);
      let turn = facing - rig.root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      rig.root.rotation.y += turn * Math.min(1, dt * 10);
      const moving = state.nx !== null;
      const swimming = isWater(Math.round(px), Math.round(pz));
      // Squids jet: the mantle squeezes, then stretches, and he shoots forward.
      const jet = moving ? Math.sin(k * Math.PI) : 0;
      hugging += dt;
      waving += dt;
      const hug = hugging < HUG_TIME ? Math.sin((hugging / HUG_TIME) * Math.PI) : 0;
      // In the water he floats low, eyes just above the surface; on land, a hop each cell.
      const float = swimming ? -0.24 + Math.sin(time * 1.6) * 0.03 : jet * 0.18 + Math.sin(time * 1.8) * 0.03;
      rig.body.position.y += (float + hug * 0.05 - rig.body.position.y) * Math.min(1, dt * 10);
      rig.body.rotation.x = moving ? 0.22 : Math.sin(time * 1.1) * 0.03;
      rig.mantle.scale.set(1 - jet * 0.1 + hug * 0.05, 1 + jet * 0.18 - hug * 0.06 + Math.sin(time * 2.2) * 0.015, 1 - jet * 0.1 + hug * 0.05);
      // The fin flaps: fast when he swims, a slow ripple when he floats.
      rig.fins.forEach((fin, s) => (fin.rotation.y = (s ? -1 : 1) * Math.sin(time * (moving ? 12 : 3) + s) * (moving ? 0.5 : 0.18)));
      const blink = Math.sin(time * 0.7 + 1.3) > 0.97 ? 1.8 : 0.6;
      for (const lid of rig.lids) lid.scale.y = hug > 0 ? 2 : blink;
      rig.arms.forEach((joints, i) => {
        const ripple = Math.sin(time * (moving ? 10 : 2.4) + i * 0.8);
        // Swimming, the arms trail behind; still, they splay round him and curl up.
        joints[0].rotation.x = (moving ? -0.5 : 0.12) + ripple * 0.08 - hug * 0.3;
        joints[1].rotation.x = (moving ? 0.1 : -0.15) + ripple * 0.14;
        joints[2].rotation.x = (moving ? 0.15 : -0.45) + Math.sin(time * 2.6 + i) * 0.16;
      });
      const wave = waving < WAVE_TIME ? Math.sin(waving * 16) : 0;
      rig.tentacles.forEach((joints, s) => {
        const carrying = s === 0 && !!held;
        const waveThis = s === 0 && waving < WAVE_TIME && !held;
        joints.forEach((joint, j) => {
          if (carrying) joint.rotation.set([-1.1, -0.35, 0.1, 0.3][j], 0, 0);
          else if (hug > 0) joint.rotation.set([-0.2, 0.3, 0.5, 0.4][j] * hug, (s === 0 ? -1 : 1) * 0.5 * hug, 0);
          else if (waveThis) joint.rotation.set([-1.3, -0.4, -0.2, 0][j], 0, [0, wave * 0.5, wave * 0.6, wave * 0.4][j]);
          else if (moving) joint.rotation.set([-0.45, 0.05, 0.1, 0.1][j] + Math.sin(time * 10 + j) * 0.08, 0, 0);
          // At rest they drape forward, the clubs curling up.
          else joint.rotation.set([0.06, 0.02, -0.3, -0.45][j] + Math.sin(time * 2 + j + s * 2) * 0.06, 0, 0);
        });
      });
      if (held) held.mesh.rotation.y = time * 1.5;
      // Ripples where he swims.
      const water = ctx.state.water as { ripple: (x: number, z: number, s?: number) => void } | undefined;
      if (water && moving && swimming && time - lastRipple > 0.4) {
        lastRipple = time;
        water.ripple(px, pz, 0.8);
      }
      emoteAge += dt;
      showSymbol(emote, emoteAge < 1.6 ? emoteKind : null, emoteAge, 1.6, 0.55);
      Object.assign(mark, { x: state.x, z: state.z });
    });
  },
};
