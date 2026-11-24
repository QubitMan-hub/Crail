import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { landmarks } from '../../core/landmarks';
import { fuse } from '../../characters/rig';
import { buildTree, LEAF_OF, type TreeKind } from './model';

/**
 * Trees, everywhere, made up as you go. The world is cut into chunks; each chunk's trees
 * come from the game's seed and the chunk's position, so the same world always grows the
 * same way. Two slow patterns over the land decide what grows where (pine woods, mixed
 * woods of oak, birch and apple, groves of cherry blossom and autumn maples) and how
 * thickly. Trees keep clear of the start, the park, the pool, the temple and anywhere
 * already built on, and never stand right next to each other, so there is always a way
 * through. Chunks are grown ahead of the cube, out of sight, and let go far behind it.
 * Bump into one and leaves come down.
 */

/** Cells per side of a chunk. */
const CHUNK = 12;
/** Chunks within this many cells of the camera grow; beyond FORGET, they go. */
const GROW = 40;
const FORGET = 70;
/** The start stays open. */
const CLEAR_START = 9;
/**
 * Places that matter but are not claimed on the grid when empty: the temple with its
 * shrine and the pews outside (x0, z0, x1, z1), and the patches each kind of character
 * calls home, with Picachu's spot by the park gate.
 */
const CLEAR: [number, number, number, number][] = [
  [-18, -10, -4, 9],
  [-11, 5, -3, 13], [-1, -12, 7, -4], [-8, -19, 0, -11], [-7, 2, 1, 10], [3, 1, 9, 7],
];

/** A 0..1 hash of a whole-number position and a salt: the same inputs, the same answer. */
function hash(x: number, z: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise: a gentle pattern over the land, about `size` cells across. */
function noise(x: number, z: number, size: number, salt: number): number {
  const gx = x / size;
  const gz = z / size;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = gx - x0;
  const fz = gz - z0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(x0, z0, salt);
  const b = hash(x0 + 1, z0, salt);
  const c = hash(x0, z0 + 1, salt);
  const d = hash(x0 + 1, z0 + 1, salt);
  return a + (b - a) * s(fx) + (c - a) * s(fz) + (a - b - c + d) * s(fx) * s(fz);
}
/** A random source that starts from a number. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** What grows in each kind of wood, and how often. */
const WOODS: [TreeKind, number][][] = [
  [['pine', 6], ['cypress', 2.5], ['bush', 1.5]],
  [['oak', 4], ['birch', 2.5], ['apple', 1.2], ['maple', 1], ['bush', 1.5]],
  [['blossom', 4.5], ['maple', 3.5], ['birch', 1.5], ['bush', 1]],
];
const choose = (wood: [TreeKind, number][], r: number): TreeKind => {
  const total = wood.reduce((s, [, w]) => s + w, 0);
  let k = r * total;
  for (const [kind, w] of wood) if ((k -= w) < 0) return kind;
  return wood[0][0];
};

interface Chunk {
  mesh: THREE.Object3D | null;
  trees: { x: number; z: number; kind: TreeKind; occ: Occupant }[];
}

export const trees: Feature = {
  meta: {
    id: '007-trees',
    day: 7,
    title: 'Trees of every kind, grown as you go',
    credit: { username: 'lonokkalani', text: 'Add trees, randomly and procedurally generated, of different types', method: 'creator-pick' },
  },
  setup(ctx) {
    const salt = ctx.seed ^ 0x7ee5;
    const chunks = new Map<string, Chunk>();
    const at = new Map<string, TreeKind>();
    const state = {
      chunks: 0, trees: 0, rustles: 0,
      /** Every tree standing now, as [x, z, kind] (tests). */
      list: () => [...at.entries()].map(([k, kind]) => [...k.split(',').map(Number), kind] as [number, number, TreeKind]),
    };
    ctx.state.trees = state;
    const key = (x: number, z: number) => `${x},${z}`;

    /** Somewhere a tree must not grow: the start, and every named place, with room round it. */
    const blocked = (x: number, z: number): boolean => {
      if (Math.abs(x) + Math.abs(z) < CLEAR_START) return true;
      if (CLEAR.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return true;
      for (const m of landmarks(ctx)) {
        if (m.cells) {
          if (m.cells.some(([cx, cz]) => Math.abs(cx - x) <= 3 && Math.abs(cz - z) <= 3)) return true;
        } else if (m.w && m.d) {
          if (x >= m.x - 3 && x <= m.x + m.w + 2 && z >= m.z - 3 && z <= m.z + m.d + 2) return true;
        } else if (!m.hidden && Math.abs(m.x - x) <= 5 && Math.abs(m.z - z) <= 5) return true;
      }
      // Something already there, or right beside it (scenery, a character): leave it be.
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!ctx.grid.isFree(x + dx, z + dz)) return true;
      return false;
    };

    const grow = (cx: number, cz: number) => {
      const chunk: Chunk = { mesh: null, trees: [] };
      chunks.set(key(cx, cz), chunk);
      const x0 = cx * CHUNK;
      const z0 = cz * CHUNK;
      const mid = { x: x0 + CHUNK / 2, z: z0 + CHUNK / 2 };
      // How thick the woods are here, and what kind of wood it is.
      const thick = Math.max(0, Math.min(1, (noise(mid.x, mid.z, 30, salt + 1) - 0.28) * 1.9));
      const r = rng(Math.floor(hash(cx, cz, salt) * 4294967296));
      const tries = Math.round(thick * 12);
      const group = new THREE.Group();
      for (let i = 0; i < tries; i++) {
        const x = x0 + Math.floor(r() * CHUNK);
        const z = z0 + Math.floor(r() * CHUNK);
        const roll = r();
        const kindRoll = r();
        if (blocked(x, z)) continue;
        // No tree right next to another: always room to walk between them.
        let crowded = false;
        for (let dx = -1; dx <= 1 && !crowded; dx++) for (let dz = -1; dz <= 1; dz++) if (at.has(key(x + dx, z + dz))) crowded = true;
        if (crowded) continue;
        const w = noise(x, z, 46, salt + 2);
        const wood = WOODS[w < 0.38 ? 0 : w < 0.64 ? 1 : 2];
        const kind = choose(wood, kindRoll);
        const occ: Occupant = { kind: 'tree', id: `tree:${x},${z}` };
        if (!ctx.grid.claim(x, z, occ)) continue;
        buildTree(group, kind, x, z, rng(Math.floor(roll * 4294967296) || 7));
        at.set(key(x, z), kind);
        chunk.trees.push({ x, z, kind, occ });
      }
      if (chunk.trees.length) {
        // A whole chunk of trees is drawn as one mesh.
        fuse(group);
        group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        ctx.scene.add(group);
        chunk.mesh = group;
      }
      state.chunks = chunks.size;
      state.trees += chunk.trees.length;
    };

    const forget = (k: string, chunk: Chunk) => {
      for (const t of chunk.trees) {
        ctx.grid.release(t.x, t.z, t.occ);
        at.delete(key(t.x, t.z));
      }
      state.trees -= chunk.trees.length;
      if (chunk.mesh) {
        chunk.mesh.removeFromParent();
        chunk.mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      chunks.delete(k);
      state.chunks = chunks.size;
    };

    // ---- Leaves that come down when the cube bumps a tree ------------------------------
    const leafGeo = new THREE.BoxGeometry(0.1, 0.02, 0.08);
    const leafMats = new Map<string, THREE.MeshStandardMaterial>();
    const leafMat = (c: string) => {
      let m = leafMats.get(c);
      if (!m) leafMats.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })));
      return m;
    };
    const leaves = Array.from({ length: 28 }, () => {
      const m = new THREE.Mesh(leafGeo, leafMat('#7fae5f'));
      m.visible = false;
      ctx.scene.add(m);
      return { m, v: new THREE.Vector3(), age: 9, life: 2, spin: 0, phase: 0 };
    });
    let nextLeaf = 0;
    ctx.events.on<{ tx: number; tz: number; occupant?: Occupant }>('cube:bonk', ({ tx, tz, occupant }) => {
      if (occupant?.kind !== 'tree') return;
      const kind = at.get(key(tx, tz));
      if (!kind) return;
      state.rustles += 1;
      ctx.events.emit('sfx', { kind: 'whoosh', dur: 0.5, pitch: 0.55, gain: 0.5 });
      for (let i = 0; i < 9; i++) {
        const l = leaves[nextLeaf++ % leaves.length];
        l.m.material = leafMat(LEAF_OF[kind][i % LEAF_OF[kind].length]);
        l.m.position.set(tx + (Math.random() - 0.5) * 1.2, kind === 'bush' ? 0.9 : 2.4 + Math.random() * 1.2, tz + (Math.random() - 0.5) * 1.2);
        l.v.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
        Object.assign(l, { age: 0, life: 1.6 + Math.random() * 0.8, spin: (Math.random() - 0.5) * 8, phase: Math.random() * 6 });
        l.m.visible = true;
      }
    });

    ctx.events.on('direct:trees.clear', () => {
      for (const [k, c] of [...chunks]) forget(k, c);
    });
    let off = false;
    // Scripted control: stop growing (tests and video shots that need open ground).
    ctx.events.on<[boolean]>('direct:trees.off', ([on]) => {
      off = on;
      if (on) for (const [k, c] of [...chunks]) forget(k, c);
    });

    let since = 1;
    let first = true;
    ctx.onUpdate((dt) => {
      for (const l of leaves) {
        if (!l.m.visible) continue;
        l.age += dt;
        // Fluttering down: side to side as they fall.
        l.m.position.x += (l.v.x + Math.sin(l.age * 5 + l.phase) * 0.5) * dt;
        l.m.position.z += l.v.z * dt;
        l.m.position.y = Math.max(0.01, l.m.position.y - dt * (0.9 + Math.sin(l.age * 5 + l.phase) * 0.3));
        l.m.rotation.set(Math.sin(l.age * 4 + l.phase) * 0.6, l.age * l.spin, 0);
        if (l.age > l.life) l.m.visible = false;
      }
      if (off || (since += dt) < 0.5) return;
      since = 0;
      // Grow the chunks round the camera, nearest first; let the far ones go. On the very
      // first frame everything in reach grows at once, so nothing pops up in view.
      const f = ctx.focus;
      const r = Math.ceil(GROW / CHUNK);
      const fcx = Math.floor(f.x / CHUNK);
      const fcz = Math.floor(f.z / CHUNK);
      const want: [number, number, number][] = [];
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const cx = fcx + dx;
          const cz = fcz + dz;
          if (chunks.has(key(cx, cz))) continue;
          const d = Math.hypot(cx * CHUNK + CHUNK / 2 - f.x, cz * CHUNK + CHUNK / 2 - f.z);
          if (d <= GROW) want.push([d, cx, cz]);
        }
      }
      want.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cz] of want.slice(0, first ? want.length : 3)) grow(cx, cz);
      first = false;
      for (const [k, c] of chunks) {
        const [cx, cz] = k.split(',').map(Number);
        if (Math.hypot(cx * CHUNK + CHUNK / 2 - f.x, cz * CHUNK + CHUNK / 2 - f.z) > FORGET) forget(k, c);
      }
    });
  },
};
