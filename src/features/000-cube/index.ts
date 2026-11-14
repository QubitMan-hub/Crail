import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import type { Dir } from '../../core/input';
import { rollPose, snapQuat, stepToward, type Cell } from './roll';
import { Thud } from './sound';

const CRAIL_RED = '#f2542d';
const INK = '#1d1b19';
const ROLL_SECONDS = 0.17;

export interface CubeState {
  x: number;
  z: number;
  rolls: number;
  moving: boolean;
  /** Set by other features to hold the cube in place. It can only struggle. */
  pinned: boolean;
  /** How many times it has tried to move while pinned. */
  struggles: number;
  /** How many times it has bumped into something. */
  bonks: number;
  /** Seconds since it last moved or tried to. */
  idleFor: number;
}

/** roll = a real move. bonk = tried to roll into something. struggle = tried to move while pinned. */
type Anim = { kind: 'roll' | 'bonk' | 'struggle'; dir: Dir; t: number };
const SECONDS = { roll: ROLL_SECONDS, bonk: 0.24, struggle: 0.2 };
const TILT = { bonk: 0.42, struggle: 0.3 };

/** The cube. It rolls over its own edges, one cell at a time. */
export const cube: Feature = {
  meta: {
    id: '000-cube',
    day: 0,
    title: 'A cube',
    credit: { username: 'qubitman_ftw', text: 'A cube.', method: 'founder' },
  },
  setup(ctx) {
    const me: Occupant = { kind: 'cube', id: 'cube' };
    const state: CubeState = { x: 0, z: 0, rolls: 0, moving: false, pinned: false, struggles: 0, bonks: 0, idleFor: 0 };
    ctx.state.cube = state;
    ctx.grid.claim(0, 0, me);

    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 4, 0.07),
      new THREE.MeshStandardMaterial({ color: CRAIL_RED, roughness: 0.55 }),
    );
    mesh.name = 'cube';
    mesh.position.set(0, 0.5, 0);
    mesh.castShadow = true;
    // One ink dot, so you can see which way up it is.
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 32),
      new THREE.MeshStandardMaterial({ color: INK, roughness: 0.8 }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.502;
    mesh.add(dot);
    ctx.scene.add(mesh);

    // Where a tap is sending the cube.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.27, 40),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0 }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.01;
    ctx.scene.add(marker);

    // Dust ring kicked out when the cube lands.
    const dust = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.56, 48),
      new THREE.MeshBasicMaterial({ color: '#b9ae99', transparent: true, opacity: 0 }),
    );
    dust.rotation.x = -Math.PI / 2;
    dust.position.y = 0.012;
    ctx.scene.add(dust);
    let dustAge = 1;

    const thud = new Thud();
    ctx.input.onGesture(() => thud.unlock());
    ctx.events.on<boolean>('sound:set', (on) => (thud.enabled = on));

    let target: Cell | null = null;
    let anim: Anim | null = null;
    let cooldown = 0;
    const startPos = new THREE.Vector3();
    const startQuat = new THREE.Quaternion();

    ctx.input.onTap((cx, cy) => {
      const p = ctx.groundPoint(cx, cy);
      if (!p) return;
      target = { x: Math.round(p.x), z: Math.round(p.z) };
      marker.position.set(target.x, 0.01, target.z);
      (marker.material as THREE.MeshBasicMaterial).opacity = 0.5;
    });

    // Scripted placement, for tests and video shots.
    ctx.events.on<[number, number]>('direct:cube.teleport', ([x, z]) => {
      ctx.grid.releaseAll(me);
      anim = null;
      target = null;
      state.x = x;
      state.z = z;
      state.moving = false;
      state.pinned = false;
      state.idleFor = 0;
      ctx.grid.claim(x, z, me);
      mesh.position.set(x, 0.5, z);
      snapQuat(mesh.quaternion);
    });

    ctx.events.on<[boolean]>('direct:cube.pin', ([on]) => (state.pinned = on));

    const begin = (dir: Dir) => {
      startPos.copy(mesh.position);
      startQuat.copy(mesh.quaternion);
      state.idleFor = 0;
      if (state.pinned) {
        anim = { kind: 'struggle', dir, t: 0 };
        target = null;
        state.struggles += 1;
        ctx.events.emit('cube:struggle', { ...state });
        return;
      }
      const tx = state.x + dir.dx;
      const tz = state.z + dir.dz;
      if (!ctx.grid.claim(tx, tz, me)) {
        anim = { kind: 'bonk', dir, t: 0 };
        target = null;
        state.bonks += 1;
        ctx.events.emit('cube:bonk', { x: state.x, z: state.z, tx, tz, occupant: ctx.grid.at(tx, tz) });
        return;
      }
      anim = { kind: 'roll', dir, t: 0 };
      state.moving = true;
    };

    const finish = (a: Anim) => {
      if (a.kind !== 'roll') {
        // Rocked forward and fell back: nothing actually moved.
        mesh.position.copy(startPos);
        mesh.quaternion.copy(startQuat);
        thud.play(0.45, 0.7);
        cooldown = a.kind === 'bonk' ? 0.22 : 0.1;
        return;
      }
      ctx.grid.release(state.x, state.z, me);
      state.x += a.dir.dx;
      state.z += a.dir.dz;
      state.rolls += 1;
      mesh.position.set(state.x, 0.5, state.z);
      snapQuat(mesh.quaternion);
      dust.position.set(state.x, 0.012, state.z);
      dustAge = 0;
      thud.play();
      ctx.bump();
      ctx.events.emit('cube:rolled', { ...state });
    };

    ctx.onUpdate((dt) => {
      cooldown -= dt;
      let remaining = dt;
      // Loop so a long frame can finish one roll and start the next.
      while (remaining > 0) {
        if (!anim) {
          const held = ctx.input.heldDir();
          if (held) target = null;
          const dir = held ?? (target ? stepToward(state, target) : null);
          if (!dir) target = null;
          if (!dir || cooldown > 0) {
            state.moving = false;
            state.idleFor += remaining;
            break;
          }
          begin(dir);
        }
        const a: Anim = anim!;
        const left = (1 - a.t) * SECONDS[a.kind];
        if (remaining >= left) {
          remaining -= left;
          anim = null;
          finish(a);
        } else {
          a.t += remaining / SECONDS[a.kind];
          remaining = 0;
          const amount = a.kind === 'roll' ? a.t : Math.sin(Math.PI * a.t) * TILT[a.kind];
          rollPose(startPos, startQuat, a.dir, amount, mesh.position, mesh.quaternion);
        }
      }

      ctx.focus.set(mesh.position.x, 0, mesh.position.z);

      const mm = marker.material as THREE.MeshBasicMaterial;
      if (!target) mm.opacity = Math.max(0, mm.opacity - dt * 3);

      dustAge = Math.min(1, dustAge + dt / 0.35);
      dust.scale.setScalar(1 + dustAge * 0.9);
      (dust.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - dustAge);
    });
  },
};
