import type * as THREE from 'three';
import type { GameContext } from '../core/game';
import { seededRandom } from '../core/rng';
import { animate, newMotion, type Motion } from './animate';
import { createNpc, relocate, startFollow, startSit, tick, type CubeView, type DirIndex, type Npc, type Persona, type World } from './brain';
import { makeSymbolSprite } from './emotes';
import { buildBow, type Rig } from './rig';

/**
 * A cast: one kind of character living in the world. Handles the parts every kind
 * shares (spawning, ticking, animating, staying near the cube, scripted control),
 * so a feature only has to say what its characters look like and how they behave.
 */

export interface Member {
  n: Npc;
  rig: Rig;
  motion: Motion;
}

export interface CastOptions<V> {
  /** State key and scripted-control prefix, e.g. 'goths' -> ctx.state.goths, direct('goths.spawn', ...). */
  key: string;
  persona: Persona;
  variants: V[];
  build(variant: V, emote: THREE.Sprite): Rig;
  count: number;
  seedSalt: number;
  /** Things this kind does that the feature wants to show (hearts breaking, bows appearing...). */
  onEvent?(event: string, npc: Npc): void;
  /** Colours of the bow this kind is given when someone gifts them one. */
  bow?: [string, string];
}

export interface Cast {
  members: Member[];
  world: World;
}

export function createCast<V>(ctx: GameContext, opts: CastOptions<V>): Cast {
  const { key, persona } = opts;
  const rand = seededRandom(ctx.seed ^ opts.seedSalt);
  // With the cube switched off there is nothing to react to, only somewhere to wander.
  const cube: CubeView = ctx.state.cube ?? { x: 0, z: 0, rolls: 0, moving: false, pinned: false, struggles: 0, idleFor: 0 };
  const members: Member[] = [];
  let nextId = 0;

  const world: World = {
    grid: ctx.grid,
    cube,
    rand,
    sitter: null,
    sitCooldown: 10,
    staged: false,
    emit(event, npc, data) {
      if (event === 'plop') ctx.bump(0.12);
      if (event === 'greet') ctx.events.emit('npc:greet', { ...(data as object), x: npc.x, z: npc.z });
      opts.onEvent?.(event, npc);
      ctx.events.emit(`${persona.kind}:${event}`);
    },
  };
  const npcs: Npc[] = [];
  ctx.state[key] = { npcs, world };

  const spawn = (variant: number, x: number, z: number, dir: DirIndex): Member | null => {
    const n = createNpc(`${persona.kind}-${nextId++}`, variant % opts.variants.length, x, z, dir, ctx.grid, persona);
    if (!n) return null;
    const rig = opts.build(opts.variants[n.variant], makeSymbolSprite());
    ctx.scene.add(rig.root);
    const m = { n, rig, motion: newMotion(n) };
    members.push(m);
    npcs.push(n);
    return m;
  };

  const clear = () => {
    for (const m of members) {
      ctx.grid.releaseAll(m.n.occ);
      ctx.scene.remove(m.rig.root);
    }
    members.length = 0;
    npcs.length = 0;
    if (world.sitter) cube.pinned = false;
    world.sitter = null;
  };

  // Opening cast: scattered a short walk from the cube, never on top of anyone.
  for (let i = 0, tries = 0; i < opts.count && tries < 300; tries++) {
    const x = Math.round((rand() - 0.5) * 12);
    const z = Math.round((rand() - 0.5) * 12);
    const d = Math.abs(x) + Math.abs(z);
    if (d < 3 || d > 7) continue;
    const crowded = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !ctx.grid.isFree(x + dx, z + dz));
    if (crowded) continue;
    if (spawn(i, x, z, Math.floor(rand() * 4) as DirIndex)) i++;
  }

  // The cube bumped into a cell: whoever owns it hears about it.
  ctx.events.on<{ tx: number; tz: number }>('cube:bonk', ({ tx, tz }) => {
    const hit = members.find(({ n }) => (n.x === tx && n.z === tz) || (n.nx === tx && n.nz === tz));
    if (hit) hit.n.pending = true;
  });

  // Someone of another kind waved at one of ours, and may have brought a bow.
  ctx.events.on<{ id: string; gift: boolean; x: number; z: number }>('npc:greet', ({ id, gift, x, z }) => {
    const m = members.find((mm) => mm.n.id === id);
    if (!m) return;
    m.n.greeted = { x, z };
    if (gift) giveBow(m);
  });

  // Scripted control, for tests and video shots.
  ctx.events.on(`direct:${key}.clear`, clear);
  ctx.events.on<[boolean]>(`direct:${key}.staged`, ([on]) => (world.staged = on));
  ctx.events.on<[number, number, number, DirIndex, { steps?: number; idle?: number }?]>(
    `direct:${key}.spawn`,
    ([variant, x, z, dir, o]) => {
      const m = spawn(variant, x, z, dir);
      if (!m) return;
      if (o?.steps) {
        m.n.mode = 'walk';
        m.n.steps = o.steps;
      } else m.n.timer = o?.idle ?? 0.4;
    },
  );
  ctx.events.on<[number, 'follow' | 'sit' | 'gift']>(`direct:${key}.do`, ([i, what]) => {
    const n = members[i]?.n;
    if (!n) return;
    if (what === 'follow') startFollow(n, world);
    else if (what === 'gift') n.giftNext = true;
    else if (!world.sitter) startSit(n, world);
  });

  const giveBow = (m: Member) => {
    if (!opts.bow || m.rig.head.getObjectByName('bow')) return;
    const bow = buildBow(...opts.bow);
    bow.name = 'bow';
    bow.position.set(0.12, m.rig.headTop + 0.06, 0.08);
    bow.rotation.z = -0.15;
    m.rig.head.add(bow);
  };
  ctx.events.on<[number]>(`direct:${key}.bow`, ([i]) => members[i] && giveBow(members[i]));

  /** Is a floor cell outside what the camera can see (with room for a tall character)? */
  const offscreen = (x: number, z: number) => {
    const dx = x - ctx.focus.x;
    const dz = z - ctx.focus.z;
    const sx = (dx - dz) / Math.SQRT2;
    const sy = (dx + dz) * 0.408;
    const halfW = ctx.camera.right / ctx.camera.zoom;
    const halfH = ctx.camera.top / ctx.camera.zoom;
    return Math.abs(sx) > halfW + 1.2 || sy > halfH + 2.6 || sy < -halfH - 1;
  };

  ctx.onUpdate((dt, time) => {
    world.sitCooldown -= dt;
    for (const m of members) {
      tick(m.n, world, dt);

      // The cube wandered off: quietly move anyone left far behind to just out of view.
      if (!world.staged && Math.abs(m.n.x - cube.x) + Math.abs(m.n.z - cube.z) > 13 && offscreen(m.n.x, m.n.z)) {
        for (let tries = 0; tries < 12; tries++) {
          const a = rand() * Math.PI * 2;
          const r = 6 + rand() * 6;
          const x = cube.x + Math.round(Math.cos(a) * r);
          const z = cube.z + Math.round(Math.sin(a) * r);
          if (offscreen(x, z) && relocate(m.n, world, x, z)) break;
        }
      }
      animate(m.rig, m.n, world, m.motion, time, dt);
    }
  });

  return { members, world };
}
