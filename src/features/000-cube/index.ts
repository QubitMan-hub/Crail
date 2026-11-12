import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Feature } from '../../core/feature';
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
}

/** The cube. It rolls over its own edges, one cell at a time. */
export const cube: Feature = {
  meta: {
    id: '000-cube',
    day: 0,
    title: 'A cube',
    credit: { username: 'qubitman_ftw', text: 'A cube.', method: 'founder' },
  },
  setup(ctx) {
    const state: CubeState = { x: 0, z: 0, rolls: 0, moving: false };
    ctx.state.cube = state;

    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 4, 0.07),
      new THREE.MeshStandardMaterial({ color: CRAIL_RED, roughness: 0.55 }),
    );
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
    let rolling: { dir: Dir; t: number } | null = null;
    const startPos = new THREE.Vector3();
    const startQuat = new THREE.Quaternion();

    ctx.input.onTap((cx, cy) => {
      const p = ctx.groundPoint(cx, cy);
      if (!p) return;
      target = { x: Math.round(p.x), z: Math.round(p.z) };
      marker.position.set(target.x, 0.01, target.z);
      (marker.material as THREE.MeshBasicMaterial).opacity = 0.5;
    });

    const begin = (dir: Dir) => {
      rolling = { dir, t: 0 };
      startPos.copy(mesh.position);
      startQuat.copy(mesh.quaternion);
      state.moving = true;
    };

    const land = (dir: Dir) => {
      state.x += dir.dx;
      state.z += dir.dz;
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
      let remaining = dt;
      // Loop so a long frame can finish one roll and start the next.
      while (remaining > 0) {
        if (!rolling) {
          const held = ctx.input.heldDir();
          if (held) target = null;
          const dir = held ?? (target ? stepToward(state, target) : null);
          if (!dir) {
            target = null;
            state.moving = false;
            break;
          }
          begin(dir);
        }
        const r = rolling!;
        const left = (1 - r.t) * ROLL_SECONDS;
        if (remaining >= left) {
          remaining -= left;
          rolling = null;
          land(r.dir);
        } else {
          r.t += remaining / ROLL_SECONDS;
          remaining = 0;
          rollPose(startPos, startQuat, r.dir, r.t, mesh.position, mesh.quaternion);
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
