import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { stealables, type Stealable } from '../../core/loot';
import { seededRandom } from '../../core/rng';
import { tip } from '../../core/tip';
import { everyone, type Member } from '../../characters/cast';
import { setLoot } from '../../characters/rig';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { buildOctopus, buildPool, buildToken } from './model';

/**
 * Gåmson the octopus (named by @ump.619, who asked for him). He lives in a tide pool and steals from everybody, one party after
 * another: a goth's boot, a femboy's sock (or the bow, if they have one), a soldier's
 * cap, the leader's medal and his flag, a balloon from the park, a charm off the cube.
 * It carries up to three things home and keeps them on the rock beside its pool.
 *
 * Roll into it and it drops what it is holding, squirts ink and bolts. Roll into the
 * rock and everything on it flies back to whoever it belonged to, and the octopus
 * comes up out of its pool, furious, and goes out again sooner than it would have.
 */

/** The middle of the pool. The rock with the loot is two cells along from it. */
export const POOL = { x: 3, z: 14 };
/** The flat rock beside the pool where the loot piles up. */
export const SHELF = { x: POOL.x + 2, z: POOL.z };
const SPEED = 3.4; // cells a second: quicker than anyone it robs
const CARRY = 3;
/** Cells the route search may look at per step: enough to get round a building, cheap on a phone. */
const MAX_SEARCH = 2500;
/** A full rock: it stays home to guard it until someone empties it. */
const STASH_MAX = 9;
/** His name, as the person who asked for him spelled it. */
export const NAME = 'Gåmson';
/** How long it fumes when its rock is raided, and how soon it goes out again after. */
const ANGER = 2.6;
const REVENGE = 3;
/** Seconds for a returned thing to fly home. */
const FLIGHT = 0.9;
const FIRST_OUTING = 18;
/** What it takes from someone who has nothing better on them. */
const POCKETS: Record<string, [Stealable['token'], string]> = {
  goth: ['boot', 'a goth’s boot'],
  femboy: ['sock', 'a femboy’s sock'],
  soldier: ['cap', 'a soldier’s cap'],
  leader: ['medal', 'the leader’s medal'],
};

type Mode = 'lurk' | 'hunt' | 'snatch' | 'haul' | 'stash' | 'flee';
export interface Held {
  item: Stealable;
  mesh: THREE.Group;
}

export const octopus: Feature = {
  meta: {
    id: '004-octopus',
    day: 4,
    title: 'Gåmson, an octopus who steals from everyone',
    credit: { username: 'ump.619', text: 'Add an octopus that steals stuff from all parties', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x0c70);
    const occ: Occupant = { kind: 'octopus', id: 'octopus' };
    const shelfOcc: Occupant = { kind: 'stash', id: 'octopus-stash' };

    const pool = buildPool();
    pool.root.position.set(POOL.x, 0, POOL.z);
    ctx.scene.add(pool.root);
    ctx.grid.claim(SHELF.x, SHELF.z, shelfOcc);
    // The stones round the pool are solid to everyone but the octopus, which climbs over them.
    const rimOcc: Occupant = { kind: 'pool', id: 'octopus-pool' };
    const isRim = (x: number, z: number) => Math.max(Math.abs(x - POOL.x), Math.abs(z - POOL.z)) === 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) ctx.grid.claim(POOL.x + dx, POOL.z + dz, rimOcc);
    addLandmark(ctx, { name: `${NAME}’s pool`, x: POOL.x - 1, z: POOL.z - 1, w: 3, d: 3, color: '#a9dbe6' });
    const mark = addLandmark(ctx, { name: NAME, x: POOL.x, z: POOL.z, color: '#2f9c95', hidden: true });

    const rig = buildOctopus();
    rig.root.scale.setScalar(1.15);
    let flattened = 9;
    // His halo, for when he is immortal: pale gold, a little crooked, never quite still.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.04, 8, 28),
      new THREE.MeshStandardMaterial({ color: '#fff1b8', emissive: '#ffd36b', emissiveIntensity: 0.9 }),
    );
    halo.rotation.x = Math.PI / 2 - 0.25;
    halo.visible = false;
    rig.root.add(halo);
    const fury = makeSymbolSprite();
    fury.position.set(0, 1.85, 0);
    rig.root.add(fury);
    let angry = 0;
    ctx.scene.add(rig.root);
    // Ink: a dark puddle where it was startled, fading.
    const ink = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ color: '#1d1b19', transparent: true, opacity: 0, depthWrite: false }),
    );
    ink.rotation.x = -Math.PI / 2;
    ctx.scene.add(ink);
    let inkAge = 99;

    const state = {
      x: POOL.x, z: POOL.z, nx: null as number | null, nz: null as number | null, p: 0,
      mode: 'lurk' as Mode, t: 0, timer: FIRST_OUTING,
      /** Names of what it is holding, and of what is on the rock. */
      carrying: [] as string[], stash: [] as string[],
      stolen: 0, returned: 0, staged: false,
      /**
       * Set by a later day: nothing hurts him. A blast flattens him for a moment and he
       * pops back up holding everything, instead of dropping it all and running.
       */
      immortal: false,
      shrugged: 0,
      /** Take the oldest thing off his rock (a friend tidying up behind his back). */
      handOver: (): Held | null => {
        const h = stashed.shift() ?? null;
        names();
        return h;
      },
    };
    ctx.state.octopus = state;
    ctx.grid.claim(state.x, state.z, occ);
    const held: Held[] = [];
    const stashed: Held[] = [];
    let target: Stealable | null = null;
    let lastParty = '';
    let stuck = 0;
    let retry = 0;
    let facing = 0;
    const names = () => {
      state.carrying = held.map((h) => h.item.name);
      state.stash = stashed.map((h) => h.item.name);
    };

    // ---- Pockets: everyone has something on them ---------------------------------
    // Characters come and go, so what they carry is listed on the fly.
    const robbed = new Set<Member>();
    // Robed cult members have nothing on show to take, and a tank has no pockets.
    const pockets = (): Stealable[] =>
      everyone(ctx)
        .filter((m) => !robbed.has(m) && !m.n.cult && POCKETS[m.n.persona.kind] && m.n.carry === null)
        .filter((m) => m.rig.loot || m.rig.head.getObjectByName('bow'))
        .map((m) => {
          const bow = m.rig.head.getObjectByName('bow');
          const [token, name] = bow ? (['bow', `a ${m.n.persona.kind}’s bow`] as const) : POCKETS[m.n.persona.kind];
          const party = m.n.persona.kind === 'leader' || m.n.persona.kind === 'soldier' ? 'army' : m.n.persona.kind;
          return {
            party, name, token,
            where: () => (everyone(ctx).includes(m) && !m.n.cult ? { x: m.n.x, z: m.n.z } : null),
            take() {
              robbed.add(m);
              // What it took is gone from them: the bow off the head, or the boot, sock, cap or medal.
              if (bow) bow.removeFromParent();
              else setLoot(m.rig, false);
              m.n.emote = { kind: 'bang', t: 0 };
              m.n.order = 'fume';
            },
            putBack() {
              robbed.delete(m);
              if (bow) m.rig.head.add(bow);
              // A robe covers everything, so only put it back on show if they are not wearing one.
              else if (!m.n.cult) setLoot(m.rig, true);
              if (everyone(ctx).includes(m)) m.n.emote = { kind: 'heart', t: 0 };
            },
          };
        });

    // ---- Getting about -------------------------------------------------------------
    const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= 1;
    /** The first step of the shortest free route to a cell next to (or onto) the goal. */
    const stepToward = (goal: { x: number; z: number }, onto: boolean): [number, number] | null => {
      // Search the box that holds both ends, with room to go round things.
      const MARGIN = 6;
      const [x0, x1] = [Math.min(state.x, goal.x) - MARGIN, Math.max(state.x, goal.x) + MARGIN];
      const [z0, z1] = [Math.min(state.z, goal.z) - MARGIN, Math.max(state.z, goal.z) + MARGIN];
      const key = (x: number, z: number) => `${x},${z}`;
      const from = new Map<string, string | null>([[key(state.x, state.z), null]]);
      const queue: [number, number][] = [[state.x, state.z]];
      const done = (x: number, z: number) => (onto ? x === goal.x && z === goal.z : near({ x, z }, goal));
      for (let i = 0; i < queue.length && i < MAX_SEARCH; i++) {
        const [x, z] = queue[i];
        if (done(x, z)) {
          let k = key(x, z);
          for (let back = from.get(k); back && from.get(back) !== null; back = from.get(k)) k = back;
          const [sx, sz] = k.split(',').map(Number);
          return sx === state.x && sz === state.z ? null : [sx, sz];
        }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const [qx, qz] = [x + dx, z + dz];
          if (from.has(key(qx, qz)) || !(isRim(qx, qz) || ctx.grid.isFree(qx, qz, occ))) continue;
          if (qx < x0 || qx > x1 || qz < z0 || qz > z1) continue;
          from.set(key(qx, qz), key(x, z));
          queue.push([qx, qz]);
        }
      }
      // No route found within the search: take any free step that gets closer, if there is one.
      const dist = (x: number, z: number) => Math.abs(goal.x - x) + Math.abs(goal.z - z);
      const steps = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        .map(([dx, dz]) => [state.x + dx, state.z + dz] as [number, number])
        .filter(([x, z]) => dist(x, z) < dist(state.x, state.z) && (isRim(x, z) || ctx.grid.isFree(x, z, occ)));
      return steps[0] ?? null;
    };
    const setMode = (mode: Mode, timer = 0) => Object.assign(state, { mode, t: 0, timer });

    /** What to take next: something from a different party than last time, nearest first. */
    const choose = (party?: string): Stealable | null => {
      // One of each thing at a time: what it already has is not there to take again.
      const has = (s: Stealable) => held.some((h) => h.item === s) || stashed.some((h) => h.item === s);
      const all = [...stealables(ctx), ...pockets()].filter((s) => !has(s) && s.where() && (!party || s.party === party));
      if (!all.length) return null;
      const fresh = all.filter((s) => s.party !== lastParty);
      const pool = fresh.length ? fresh : all;
      const far = (s: Stealable) => Math.abs(s.where()!.x - state.x) + Math.abs(s.where()!.z - state.z);
      // One party at random, then the nearest thing of theirs: so nobody is left out.
      const parties = [...new Set(pool.map((s) => s.party))];
      const pick = party ?? parties[Math.floor(rand() * parties.length)];
      return pool.filter((s) => s.party === pick).sort((a, b) => far(a) - far(b))[0] ?? null;
    };

    // Things on their way home: each flies in an arc to its owner and is handed back on landing.
    const flying: { h: Held; from: THREE.Vector3; t: number }[] = [];
    const giveBack = (list: Held[]): number => {
      const n = list.length;
      list.splice(0).forEach((h, i) => {
        const from = new THREE.Vector3();
        h.mesh.getWorldPosition(from);
        h.mesh.removeFromParent();
        h.mesh.position.copy(from);
        h.mesh.scale.setScalar(1.3);
        ctx.scene.add(h.mesh);
        flying.push({ h, from, t: -i * 0.15 }); // one after another, not all at once
      });
      names();
      return n;
    };
    const land = (f: (typeof flying)[number]) => {
      f.h.item.putBack();
      f.h.mesh.removeFromParent();
      state.returned += 1;
      ctx.events.emit('octopus:returned', { name: f.h.item.name });
    };
    /** Startled: drop everything, leave a puddle of ink, and go home fast. */
    const startle = () => {
      if (state.mode === 'flee') return;
      Object.assign(ink.position, { x: state.x, y: 0.014, z: state.z });
      inkAge = 0;
      ctx.bump(0.15);
      const dropped = giveBack(held);
      target = null;
      setMode('flee', 0);
      return dropped;
    };

    // ---- The cube gets involved ----------------------------------------------------
    ctx.events.on<{ occupant?: Occupant; tx: number; tz: number }>('cube:bonk', ({ occupant, tx, tz }) => {
      // On the stones round its pool it owns no cell of its own, so go by where it is.
      const onIt = occupant === occ || (tx === state.x && tz === state.z) || (tx === state.nx && tz === state.nz);
      if (onIt) {
        if (state.mode === 'lurk' && !held.length) return tip(`${NAME} pretends to be a rock. His loot is on the rock next door.`);
        const dropped = startle();
        tip(dropped ? `${NAME} dropped ${dropped === 1 ? 'what he took' : `all ${dropped} things`}. They are on their way home.` : `Ink. ${NAME} had nothing on him yet.`);
      } else if (occupant === rimOcc) {
        tip(stashed.length ? `${NAME}’s pool. What he stole is on the flat rock beside it.` : `A tide pool. ${NAME} is watching you from it.`);
      } else if (occupant === shelfOcc) {
        if (!stashed.length) return tip(`${NAME}’s rock is empty. For now.`);
        const n = giveBack(stashed);
        // That was its hoard. It comes up out of the water, and it is not pleased.
        angry = ANGER;
        if (state.mode === 'lurk') state.timer = ANGER + REVENGE;
        tip(`You gave back ${n === 1 ? 'the one thing' : `all ${n} things`} ${NAME} stole. He is furious.`);
        // After the tip, so a reward for it can have the last word.
        ctx.events.emit('octopus:raided', { count: n });
      }
    });
    // Anything that goes off next to it has the same effect as being bumped.
    ctx.events.on<{ x: number; z: number; radius: number }>('army:blast', ({ x, z, radius }) => {
      if (Math.max(Math.abs(state.x - x), Math.abs(state.z - z)) > radius) return;
      if (!state.immortal) return void startle();
      // Immortal: squashed flat, then back up as if nothing happened, loot and all.
      flattened = 0;
      state.shrugged += 1;
      const cube = ctx.state.cube as { x: number; z: number } | undefined;
      if (cube && Math.abs(cube.x - state.x) + Math.abs(cube.z - state.z) < 15) {
        tip(`That hit ${NAME}. He is immortal. He kept everything.`);
      }
      ctx.events.emit('octopus:shrugged', { x: state.x, z: state.z });
    });

    // ---- Scripted control, for tests and video shots -------------------------------
    ctx.events.on<[boolean]>('direct:octopus.staged', ([on]) => {
      state.staged = on;
      if (on && state.mode !== 'lurk') {
        giveBack(held);
        target = null;
        setMode('flee', 0);
      }
      // Scripted scenes start clean: anything mid-air lands now.
      if (on) flying.splice(0).forEach(land);
    });
    ctx.events.on<[string?, string?]>('direct:octopus.steal', ([party, token]) => {
      target = token ? ([...stealables(ctx), ...pockets()].find((s) => s.token === token && s.where()) ?? null) : choose(party);
      if (target) setMode('hunt');
    });
    /** Put it a few cells from something worth taking (video shots). */
    ctx.events.on<[string, number, number]>('direct:octopus.near', ([token, dx, dz]) => {
      const at = [...stealables(ctx), ...pockets()].find((s) => s.token === token && s.where())?.where();
      if (!at || state.nx !== null) return;
      for (const [ox, oz] of [[dx, dz], [dx + 1, dz], [dx, dz + 1], [dx - 1, dz], [dx, dz - 1]]) {
        if (!ctx.grid.claim(at.x + ox, at.z + oz, occ)) continue;
        ctx.grid.release(state.x, state.z, occ);
        Object.assign(state, { x: at.x + ox, z: at.z + oz });
        facing = Math.atan2(-ox, -oz);
        setMode('lurk', 99);
        return;
      }
    });
    /** Whatever it is holding goes straight onto the rock, and it is back in its pool. */
    ctx.events.on('direct:octopus.stashNow', () => {
      if (state.nx !== null) {
        ctx.grid.release(state.nx, state.nz!, occ);
        state.nx = state.nz = null;
      }
      ctx.grid.release(state.x, state.z, occ);
      Object.assign(state, { x: POOL.x, z: POOL.z, p: 0 });
      ctx.grid.claim(state.x, state.z, occ);
      target = null;
      setMode('stash');
      state.t = 1;
    });
    ctx.events.on<[number, number]>('direct:octopus.teleport', ([x, z]) => {
      if (state.nx !== null || !ctx.grid.claim(x, z, occ)) return;
      ctx.grid.release(state.x, state.z, occ);
      Object.assign(state, { x, z });
    });
    ctx.events.on('direct:octopus.home', () => setMode('haul'));

    // ---- Every frame -----------------------------------------------------------------
    const moveTo = (goal: { x: number; z: number }, onto: boolean, dt: number): boolean => {
      // True once it has arrived (next to the goal, or on it).
      if (state.nx === null) {
        const arrived = onto ? state.x === goal.x && state.z === goal.z : near(state, goal);
        if (arrived) return true;
        // No way through just now: look again a few times a second, not every frame.
        if ((retry -= dt) > 0) {
          stuck += dt;
          return false;
        }
        const step = stepToward(goal, onto);
        if (!step || !(isRim(step[0], step[1]) || ctx.grid.claim(step[0], step[1], occ))) {
          stuck += dt;
          retry = 0.25;
          return false;
        }
        stuck = 0;
        [state.nx, state.nz] = step;
        state.p = 0;
        facing = Math.atan2(step[0] - state.x, step[1] - state.z);
      }
      return false;
    };

    ctx.onUpdate((dt, time) => {
      state.t += dt;
      // A step in progress always finishes, whatever it has decided since.
      if (state.nx !== null && state.nz !== null) {
        state.p += SPEED * (state.mode === 'flee' ? 1.6 : 1) * dt;
        if (state.p >= 1) {
          ctx.grid.release(state.x, state.z, occ);
          Object.assign(state, { x: state.nx, z: state.nz, nx: null, nz: null, p: 0 });
        }
      }
      const cube = ctx.state.cube as { x: number; z: number } | undefined;
      const seen = !!cube && Math.abs(cube.x - state.x) + Math.abs(cube.z - state.z) < 15;

      if (state.mode === 'lurk') {
        state.timer -= dt;
        if (!state.staged && state.timer <= 0 && stashed.length >= STASH_MAX) state.timer = 5;
        else if (!state.staged && state.timer <= 0) {
          target = choose();
          if (target) setMode('hunt');
          else state.timer = 6;
        }
      } else if (state.mode === 'hunt') {
        const at = target?.where();
        if (!target || !at || stuck > 3) {
          // Gone, or out of reach: take home what it has.
          target = null;
          stuck = 0;
          setMode(held.length ? 'haul' : 'flee');
        } else if (moveTo(at, false, dt)) {
          facing = Math.atan2(at.x - state.x, at.z - state.z);
          setMode('snatch');
        }
      } else if (state.mode === 'snatch') {
        const at = target?.where();
        if (target && state.t >= 0.32 && !held.some((h) => h.item === target)) {
          if (at && near(state, at)) {
            target.take();
            const mesh = buildToken(target.token);
            rig.hands[[0, 2, 6][held.length % 3]].add(mesh);
            held.push({ item: target, mesh });
            state.stolen += 1;
            lastParty = target.party;
            names();
            ctx.events.emit('octopus:stole', { party: target.party, name: target.name, x: state.x, z: state.z });
            if (seen && target.party !== 'cube') tip(`${NAME} took ${target.name}. Roll into him to get it back.`);
          } else target = null; // they stepped away in time
        }
        if (state.t >= 0.7) {
          // Left to itself it goes on to the next victim. Under direction it takes one thing and goes.
          target = held.length < CARRY && target && !state.staged ? choose() : null;
          setMode(target ? 'hunt' : held.length ? 'haul' : 'flee');
        }
      } else if (state.mode === 'haul' || state.mode === 'flee') {
        if (moveTo(POOL, true, dt)) setMode(held.length ? 'stash' : 'lurk', 7 + rand() * 6);
        else if (stuck > 4 && state.nx === null) {
          // Boxed in. It waits for a gap; an octopus has time.
          stuck = 0;
        }
      } else if (state.mode === 'stash') {
        if (state.t >= 0.5) {
          for (const h of held.splice(0)) {
            const i = stashed.length;
            pool.shelf.add(h.mesh);
            h.mesh.position.set(((i % 3) - 1) * 0.26, 0.4 + Math.floor(i / 3) * 0.34, (((i * 2) % 3) - 1) * 0.22);
            h.mesh.rotation.set(0, i * 1.3, 0);
            h.mesh.scale.setScalar(1.5);
            stashed.push(h);
          }
          names();
          setMode('lurk', 7 + rand() * 6);
        }
      }

      // Returned things in flight.
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt / FLIGHT;
        const to = f.h.item.where();
        if (!to) {
          // Whoever it belonged to has gone: it lands where they were.
          flying.splice(i, 1);
          land(f);
          continue;
        }
        const k = Math.max(0, Math.min(1, f.t));
        f.h.mesh.position.set(
          f.from.x + (to.x - f.from.x) * k,
          f.from.y + (1.2 - f.from.y) * k + Math.sin(Math.PI * k) * 2.6,
          f.from.z + (to.z - f.from.z) * k,
        );
        f.h.mesh.rotation.y += dt * 9;
        if (f.t >= 1) {
          flying.splice(i, 1);
          land(f);
        }
      }
      angry = Math.max(0, angry - dt);
      showSymbol(fury, angry > 0 ? 'anger' : null, ANGER - angry, ANGER, 0.7);

      // ---- How it looks ----------------------------------------------------------
      const k = state.nx === null ? 0 : state.p;
      const px = state.x + ((state.nx ?? state.x) - state.x) * k;
      const pz = state.z + ((state.nz ?? state.z) - state.z) * k;
      const home = state.mode === 'lurk' && state.x === POOL.x && state.z === POOL.z;
      if (angry > 0 && cube) facing = Math.atan2(cube.x - state.x, cube.z - state.z); // glaring at you
      else if (home) facing = Math.PI / 4; // watching the camera from the water
      // In its pool it sinks to the eyes.
      // Angry, it rears up out of the water and shakes.
      const sink = home && angry <= 0 ? -0.24 + Math.sin(time * 0.8) * 0.03 : angry > 0 ? 0.25 + Math.abs(Math.sin(time * 9)) * 0.12 : 0;
      const moving = state.nx !== null;
      // It pulses along: a squash and a stretch with every cell.
      const pulse = moving ? Math.sin(k * Math.PI) : 0;
      const lunge = state.mode === 'snatch' ? Math.sin(Math.min(1, state.t / 0.5) * Math.PI) : 0;
      const shake = angry > 0 ? Math.sin(time * 38) * 0.05 : 0;
      rig.root.position.set(px + Math.sin(facing) * lunge * 0.3 + shake, 0, pz + Math.cos(facing) * lunge * 0.3 - shake);
      let turn = facing - rig.root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      rig.root.rotation.y += turn * Math.min(1, dt * 14);
      rig.body.position.y += (sink + pulse * 0.16 - rig.body.position.y) * Math.min(1, dt * 12);
      // Flattened by a blast (immortal): down to a pancake, then a springy pop back.
      flattened += dt;
      const squash = flattened < 0.12 ? 1 - (flattened / 0.12) * 0.82 : flattened < 1 ? 1 - 0.82 * Math.exp(-(flattened - 0.12) * 6) * Math.cos((flattened - 0.12) * 14) : 1;
      const spread = 1 + (1 - squash) * 0.5;
      rig.body.scale.set((1 + pulse * 0.08) * spread, (1 - pulse * 0.12 + Math.sin(time * 2.2) * 0.02) * squash, (1 + pulse * 0.08) * spread);
      halo.visible = state.immortal;
      if (state.immortal) {
        halo.position.set(Math.sin(time * 1.3) * 0.04, rig.body.position.y + 1.3 * squash + 0.1 + Math.sin(time * 2.1) * 0.04, -0.05);
        halo.rotation.z = time * 0.7;
      }
      rig.body.rotation.x = lunge * 0.3 + (moving ? 0.12 : 0);
      const sneaky = state.mode === 'hunt' || state.mode === 'snatch';
      // At home it watches, half-lidded, and narrows its eyes now and then.
      const peer = Math.sin(time * 0.9) > 0.86 ? 1.5 : 0.7;
      for (const lid of rig.lids) lid.scale.y = angry > 0 ? 1.7 : home ? peer : sneaky ? 1.3 : state.mode === 'flee' ? 0.2 : 0.8;
      rig.arms.forEach((arm, i) => {
        const carrying = [0, 2, 6].indexOf(i) > -1 && [0, 2, 6].indexOf(i) < held.length;
        const reach = i === 0 || i === 7 ? lunge : 0;
        const speed = angry > 0 ? 16 : moving ? 8 : 1.8;
        arm.joints.forEach((joint, j) => {
          // A ripple runs out along each arm, sideways, so it snakes across the floor.
          const ripple = Math.sin(time * speed - j * 1.1 + i * 1.7);
          joint.rotation.y = ripple * (0.1 + j * 0.09) * (carrying ? 0.3 : 1);
          if (carrying) {
            // Holding something: the arm rears up and curls over, loot at the tip.
            joint.rotation.x = [-1.0, -0.45, -0.1, 0.25, 0.35][j];
          } else if (reach) {
            joint.rotation.x = [-0.35, -0.1, 0, 0.1, 0.2][j] * reach + (1 - reach) * [0.1, 0.02, 0, -0.25, -0.6][j];
          } else {
            // At rest it lies flat, with the tip curled up; when it swims the arms trail and flick.
            // Angry, the arms thrash up and down; swimming, they trail and flick.
            const flick = angry > 0 ? Math.sin(time * 14 + i * 1.3 - j) * 0.35 - 0.25 : moving ? Math.sin(k * Math.PI * 2 - j * 0.8) * 0.18 : 0;
            joint.rotation.x = [0.1, 0.02, 0, -0.25, -0.6][j] + flick + Math.sin(time * 1.3 + i + j) * 0.05 * j;
          }
        });
      });
      for (const h of held) h.mesh.rotation.y = time * 1.5;
      // Ripples in the pool, and the puddle it left behind.
      pool.water.position.y = 0.075 + Math.sin(time * 1.6) * 0.008;
      inkAge += dt;
      ink.scale.setScalar(0.5 + Math.min(1, inkAge / 0.25) * 0.75);
      (ink.material as THREE.MeshBasicMaterial).opacity = inkAge < 9 ? 0.72 * (1 - inkAge / 9) : 0;
      // On the map it only shows while it is out.
      Object.assign(mark, { x: state.x, z: state.z, hidden: home });
    });
  },
};
