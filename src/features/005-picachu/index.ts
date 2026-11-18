import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { addStealable } from '../../core/loot';
import { stepToward } from '../../core/path';
import { seededRandom } from '../../core/rng';
import { tip } from '../../core/tip';
import { floor } from '../../characters/brain';
import { everyone, type Member } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { PARK } from '../003-park';
import { isWater } from '../004-octopus';
import { buildCritter } from './model';

/**
 * Picachu: an off-brand electric critter that wanders round the park gate.
 *
 * Its belly gauge fills up over time. When it is full, Picachu zaps whoever is nearest:
 * they sit down, dazed, hair on end. Zap one of the leader's men and the tank fires
 * back. With nobody about, it zaps the park instead, and every ride runs at double speed
 * for a while. Roll into it and it zaps you: you roll faster for a few seconds.
 *
 * It keeps well away from water (electricity), and from Tåhgong it gets only hugs.
 * Gåmson can steal its battery; without it Picachu cannot charge and mopes until
 * someone (you, or Tåhgong) gets it back.
 */

export const NAME = 'Picachu';
const HOME = { x: PARK.gate.x - 3, z: PARK.gate.z + 4 };
const ROAM = 5;
const SPEED = 2.8;
/** Seconds to go from empty to full. */
const CHARGE_TIME = 16;
const ZAP_REACH = 4;
const BOOST_SECONDS = 6;
const SURGE_SECONDS = 8;

type Mode = 'idle' | 'stalk' | 'zap';

export const picachu: Feature = {
  meta: {
    id: '005-picachu',
    day: 5,
    title: 'Picachu (off-brand)',
    credit: { username: 'ancientpro_gamer', text: 'Add picachu', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x9c4);
    const occ: Occupant = { kind: 'critter', id: 'picachu' };
    const rig = buildCritter();
    ctx.scene.add(rig.root);
    const emote = makeSymbolSprite();
    emote.position.set(0, 1.55, 0);
    rig.root.add(emote);
    let emoteKind: 'bang' | 'heart' | 'q' | 'sparkle' | null = null;
    let emoteAge = 9;
    const say = (k: 'bang' | 'heart' | 'q' | 'sparkle') => {
      emoteKind = k;
      emoteAge = 0;
    };
    // The bolt: a zigzag of short bright segments, rebuilt for each zap.
    const boltMat = new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0 });
    const bolt = new THREE.Group();
    ctx.scene.add(bolt);
    let boltAge = 9;
    const strike = (from: THREE.Vector3, to: THREE.Vector3) => {
      bolt.clear();
      const pts: THREE.Vector3[] = [from.clone()];
      for (let i = 1; i < 7; i++) {
        const p = from.clone().lerp(to, i / 7);
        p.x += (rand() - 0.5) * 0.4;
        p.y += (rand() - 0.5) * 0.4;
        p.z += (rand() - 0.5) * 0.4;
        pts.push(p);
      }
      pts.push(to.clone());
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, a.distanceTo(b)), boltMat);
        seg.position.copy(a).lerp(b, 0.5);
        seg.lookAt(b);
        bolt.add(seg);
      }
      boltAge = 0;
      ctx.bump(0.06);
    };

    const start = (() => {
      for (let r = 0; r < 6; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (!isWater(HOME.x + dx, HOME.z + dz) && ctx.grid.claim(HOME.x + dx, HOME.z + dz, occ)) return { x: HOME.x + dx, z: HOME.z + dz };
          }
        }
      }
      return { ...HOME };
    })();
    const state = {
      x: start.x, z: start.z, nx: null as number | null, nz: null as number | null, p: 0,
      mode: 'idle' as Mode, t: 0, timer: 1.5,
      charge: 0.3, battery: true, zaps: 0, surges: 0, boosts: 0, staged: false,
    };
    ctx.state.picachu = state;
    const mark = addLandmark(ctx, { name: NAME, x: state.x, z: state.z, color: '#f4c534' });
    let target: Member | null = null;
    let facing = Math.PI / 4;
    let stuck = 0;
    let retry = 0;
    let clock = 0;
    let lastFriend = -99;

    // Its battery can be stolen like anything else. Without it, no charging.
    addStealable(ctx, {
      party: 'picachu', name: `${NAME}’s battery`, token: 'battery',
      where: () => (state.battery ? { x: state.x, z: state.z } : null),
      take() {
        state.battery = false;
        state.charge = 0;
        say('q');
      },
      putBack() {
        state.battery = true;
        say('sparkle');
      },
    });

    const setMode = (mode: Mode, timer = 0) => Object.assign(state, { mode, t: 0, timer });
    const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    const dry = (x: number, z: number) => !isWater(x, z) && ctx.grid.isFree(x, z, occ);
    const inPark = () => state.x >= PARK.x && state.x < PARK.x + PARK.w && state.z >= PARK.z && state.z < PARK.z + PARK.d;
    const seen = () => {
      const c = ctx.state.cube as { x: number; z: number } | undefined;
      return !!c && Math.abs(c.x - state.x) + Math.abs(c.z - state.z) < 14;
    };
    const top = () => new THREE.Vector3(state.x, 1.25, state.z);

    const moveTo = (goal: { x: number; z: number }, reach: number, dt: number): boolean => {
      if (state.nx !== null) return false;
      if (dist(state, goal) <= reach) return true;
      if ((retry -= dt) > 0) {
        stuck += dt;
        return false;
      }
      const step = stepToward(ctx.grid, occ, state, goal, { passable: dry });
      if (!step || !ctx.grid.claim(step[0], step[1], occ)) {
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

    /** Zap someone: they sit down, dazed. Zap the leader's men and the army answers. */
    const zap = (m: Member) => {
      strike(top(), new THREE.Vector3(m.n.x, 1.1, m.n.z));
      floor(m.n, m.world);
      m.n.emote = { kind: 'bang', t: 0 };
      state.charge = 0;
      state.zaps += 1;
      const army = m.n.persona.kind === 'leader' || m.n.persona.kind === 'soldier';
      if (seen()) tip(`${NAME} zapped a ${m.n.persona.kind}.${army ? ' The army is not amused.' : ''}`);
      ctx.events.emit('picachu:zapped', { party: army ? 'army' : m.n.persona.kind, x: state.x, z: state.z });
    };

    // ---- The cube rolls into it: a jolt, and a burst of speed --------------------------
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant !== occ) return;
      const c = ctx.state.cube as { x: number; z: number };
      if (!state.battery) {
        say('q');
        return tip(`${NAME} has no battery. Gåmson has it.`);
      }
      strike(top(), new THREE.Vector3(c.x, 0.9, c.z));
      state.boosts += 1;
      state.charge = Math.max(0, state.charge - 0.5);
      say('bang');
      ctx.events.emit('cube:boost', { seconds: BOOST_SECONDS });
      tip(`${NAME} zapped you. You roll faster for a few seconds.`);
    });

    // ---- Scripted control, for tests and video shots -----------------------------------
    ctx.events.on<[boolean]>('direct:picachu.staged', ([on]) => (state.staged = on));
    ctx.events.on<[number?]>('direct:picachu.charge', ([c]) => (state.charge = c ?? 1));
    ctx.events.on<[number, number]>('direct:picachu.teleport', ([x, z]) => {
      if (state.nx !== null || !ctx.grid.claim(x, z, occ)) return;
      ctx.grid.release(state.x, state.z, occ);
      Object.assign(state, { x, z });
    });

    // ---- Every frame -------------------------------------------------------------------
    ctx.onUpdate((dt, time) => {
      clock += dt;
      state.t += dt;
      if (state.nx !== null && state.nz !== null) {
        state.p += (state.battery ? SPEED : SPEED * 0.6) * dt;
        if (state.p >= 1) {
          ctx.grid.release(state.x, state.z, occ);
          Object.assign(state, { x: state.nx, z: state.nz, nx: null, nz: null, p: 0 });
        }
      }
      if (state.battery && !state.staged) state.charge = Math.min(1, state.charge + dt / CHARGE_TIME);

      switch (state.mode) {
        case 'idle': {
          if (state.staged) break;
          if (state.charge >= 1) {
            // Who is nearest? Nobody on a ride, nobody in the water.
            target =
              everyone(ctx)
                .filter((m) => !m.n.carry && m.rig.root.visible && !isWater(m.n.x, m.n.z) && dist(m.n, state) <= ZAP_REACH + 2)
                .sort((a, b) => dist(a.n, state) - dist(b.n, state))[0] ?? null;
            if (target) {
              setMode('stalk');
              break;
            }
            if (inPark()) {
              // Nobody about: it zaps the park instead.
              strike(top(), new THREE.Vector3(state.x, 6, state.z));
              state.charge = 0;
              state.surges += 1;
              ctx.events.emit('park:power', { seconds: SURGE_SECONDS });
              if (seen()) tip(`${NAME} overcharged the park. Every ride runs double speed.`);
              setMode('zap', 0.6);
              break;
            }
          }
          if ((state.timer -= dt) <= 0) {
            // A little wander round home, never into water.
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(
              ([dx, dz]) => Math.abs(state.x + dx - HOME.x) <= ROAM && Math.abs(state.z + dz - HOME.z) <= ROAM && dry(state.x + dx, state.z + dz),
            );
            const d = dirs[Math.floor(rand() * dirs.length)];
            if (d && ctx.grid.claim(state.x + d[0], state.z + d[1], occ)) {
              [state.nx, state.nz] = [state.x + d[0], state.z + d[1]];
              state.p = 0;
              facing = Math.atan2(d[0], d[1]);
            }
            state.timer = 1.2 + rand() * 2.5;
            if (!state.battery && rand() < 0.4) say('q');
          }
          // Its friend in the pool gets a wave, never a zap.
          const friend = ctx.state.tahgong as { x: number; z: number } | undefined;
          if (friend && dist(friend, state) <= 4 && clock - lastFriend > 10) {
            lastFriend = clock;
            say('heart');
          }
          break;
        }
        case 'stalk': {
          const m = target;
          if (!m || !everyone(ctx).includes(m) || m.n.carry || isWater(m.n.x, m.n.z) || stuck > 4 || state.t > 12) {
            target = null;
            setMode('idle', 1);
          } else if (moveTo(m.n, 2, dt)) {
            facing = Math.atan2(m.n.x - state.x, m.n.z - state.z);
            zap(m);
            target = null;
            setMode('zap', 0.6);
          }
          break;
        }
        case 'zap':
          if (state.t > state.timer) setMode('idle', 1);
          break;
      }

      // ---- How it looks ------------------------------------------------------------------
      const k = state.nx === null ? 0 : state.p;
      const px = state.x + ((state.nx ?? state.x) - state.x) * k;
      const pz = state.z + ((state.nz ?? state.z) - state.z) * k;
      rig.root.position.set(px, 0, pz);
      let turn = facing - rig.root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      rig.root.rotation.y += turn * Math.min(1, dt * 12);
      const moving = state.nx !== null;
      // A bouncy little trot; when charged, it fizzes.
      const hop = moving ? Math.abs(Math.sin(k * Math.PI)) * 0.16 : 0;
      const fizz = state.charge >= 1 ? Math.sin(time * 40) * 0.015 : 0;
      const zapping = state.mode === 'zap' ? Math.sin(Math.min(1, state.t / 0.3) * Math.PI) : 0;
      rig.body.position.set(fizz, hop + Math.sin(time * 3) * 0.015, 0);
      rig.body.scale.set(1 + zapping * 0.08, 1 - zapping * 0.06, 1 + zapping * 0.08);
      rig.head.rotation.z = Math.sin(time * 1.4) * 0.05 + (state.battery ? 0 : 0.15);
      rig.armL.rotation.x = moving ? Math.sin(k * Math.PI * 2) * 0.6 : -zapping * 2.2;
      rig.armR.rotation.x = moving ? -Math.sin(k * Math.PI * 2) * 0.6 : -zapping * 2.2;
      rig.feet[0].rotation.x = moving ? Math.sin(k * Math.PI * 2) * 0.5 : 0;
      rig.feet[1].rotation.x = moving ? -Math.sin(k * Math.PI * 2) * 0.5 : 0;
      rig.tail.forEach((seg, i) => (seg.rotation.y = Math.sin(time * 3 + i) * 0.35));
      rig.tail[0].rotation.x = -0.5;
      const blink = Math.sin(time * 0.9) > 0.97 ? 1.8 : 0.4;
      for (const lid of rig.lids) lid.scale.y = state.battery ? blink : 1.4;
      // The gauge and the bulb show the charge.
      const lit = state.battery ? Math.floor(state.charge * 3.01) : 0;
      rig.bars.forEach((b, i) => (b.material as THREE.MeshBasicMaterial).color.set(i < lit ? (lit === 3 ? '#7dff6b' : '#ffd23a') : '#3a3a3a'));
      (rig.bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = state.battery ? state.charge * (state.charge >= 1 ? 1.4 + Math.sin(time * 12) * 0.4 : 0.8) : 0;
      boltAge += dt;
      boltMat.opacity = boltAge < 0.28 ? 1 - boltAge / 0.28 : 0;
      emoteAge += dt;
      showSymbol(emote, emoteAge < 1.6 ? emoteKind : null, emoteAge, 1.6, 0.5);
      Object.assign(mark, { x: state.x, z: state.z });
    });
  },
};
