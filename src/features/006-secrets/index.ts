import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import { tip } from '../../core/tip';
import { everyone } from '../../characters/cast';
import { isDeep, isWater, POOL } from '../004-octopus';

/**
 * Two easter eggs. Not in the credits, not on the how-to-play card: for players to find.
 *
 * The golden cube: type ↑ ↑ ↓ ↓ ← → ← → (or W W S S A D A D), or tap the cube seven
 * times quickly. It turns gold for a while and everyone nearby bows.
 *
 * Gåmson's wave: sit perfectly still in the shallows of his pool for twenty seconds while
 * he is at home and calm. He has never done this for anyone: he waves, and gives the
 * cube a charm. Once a visit.
 */

const GOLD_SECONDS = 45;
const CODES = [
  ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'],
  ['KeyW', 'KeyW', 'KeyS', 'KeyS', 'KeyA', 'KeyD', 'KeyA', 'KeyD'],
];
const STILL_FOR = 20;

export const secrets: Feature = {
  meta: {
    id: '006-secrets',
    day: 6,
    title: 'Easter eggs',
    credit: { username: 'qubitman_ftw', text: 'two secrets', method: 'creator-pick' },
    secret: true,
  },
  setup(ctx) {
    const state = { golden: 0, goldens: 0, waved: false };
    ctx.state.secrets = state;
    const cube = ctx.scene.getObjectByName('cube') as THREE.Mesh | undefined;
    const mat = cube?.material as THREE.MeshStandardMaterial | undefined;
    const red = mat?.color.clone();

    const goGold = () => {
      if (!mat || state.golden > 0) return;
      state.golden = GOLD_SECONDS;
      state.goldens += 1;
      mat.color.set('#e8b923');
      mat.metalness = 0.75;
      mat.roughness = 0.28;
      mat.emissive.set('#5a3d00');
      ctx.bump(0.2);
      // Everyone nearby who is free to, bows.
      const c = ctx.state.cube as { x: number; z: number };
      for (const m of everyone(ctx)) {
        const n = m.n;
        if (n.nx !== null || !['idle', 'walk', 'march'].includes(n.mode) || Math.abs(n.x - c.x) + Math.abs(n.z - c.z) > 8) continue;
        Object.assign(n, { mode: 'revere', t: 0, timer: 2.5, emote: { kind: 'sparkle', t: 0 } });
      }
      tip('✨ The golden cube. Everyone bows.', 5, { urgent: true });
      ctx.events.emit('secrets:golden');
    };

    // The code, on a keyboard.
    const typed: string[] = [];
    window.addEventListener('keydown', (e) => {
      typed.push(e.code);
      if (typed.length > 8) typed.shift();
      if (CODES.some((code) => code.every((k, i) => typed[i] === k))) {
        typed.length = 0;
        goGold();
      }
    });
    // Or seven quick taps on the cube itself.
    let taps: number[] = [];
    ctx.input.onTap((x, y) => {
      const at = ctx.groundPoint(x, y);
      const c = ctx.state.cube as { x: number; z: number } | undefined;
      if (!at || !c || Math.hypot(at.x - c.x, at.z - c.z) > 0.8) return;
      const now = performance.now();
      taps = [...taps.filter((t) => now - t < 3000), now];
      if (taps.length >= 7) {
        taps = [];
        goGold();
      }
    });
    ctx.events.on('direct:secrets.golden', goGold);

    let still = 0;
    ctx.onUpdate((dt, time) => {
      // The golden glow fades back to red at the end.
      if (state.golden > 0 && mat && red) {
        state.golden = Math.max(0, state.golden - dt);
        mat.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.3;
        if (state.golden === 0) {
          mat.color.copy(red);
          mat.metalness = 0;
          mat.roughness = 0.55;
          mat.emissive.set('#000000');
        }
      }
      // Sitting quietly in Gåmson's shallows.
      const c = ctx.state.cube as { x: number; z: number; moving: boolean } | undefined;
      const o = ctx.state.octopus as { x: number; z: number; mode: string; busy: boolean; angry: number; swat(a: number): void } | undefined;
      if (state.waved || !c || !o) return;
      const shallow = isWater(c.x, c.z) && !isDeep(c.x, c.z);
      const calmHome = o.x === POOL.x && o.z === POOL.z && o.mode === 'lurk' && !o.busy && !(o.angry > 0);
      still = shallow && calmHome && !c.moving ? still + dt : 0;
      if (still >= STILL_FOR) {
        state.waved = true;
        o.swat(Math.atan2(c.x - o.x, c.z - o.z)); // the same arm, used kindly for once
        (ctx.state.water as { splash?(x: number, z: number, s?: number): void } | undefined)?.splash?.(c.x, c.z, 0.6);
        (ctx.state.cult as { give?(n?: number): void } | undefined)?.give?.(1);
        tip('Gåmson waves at you. He has never done that for anyone. +1 ✦', 6, { urgent: true });
        ctx.events.emit('secrets:waved');
      }
    });
  },
};
