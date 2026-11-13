import type { Feature } from '../../core/feature';
import { seededRandom } from '../../core/rng';
import { animate, newMotion, type Motion } from './animate';
import { createNpc, relocate, startFollow, startSit, tick, type CubeView, type DirIndex, type Npc, type World } from './brain';
import { makeSymbolSprite, showSymbol } from './emotes';
import { buildGoth, VARIANTS, type Rig } from './model';

const COUNT = 5;
const HEARTBREAK_SECONDS = 1.5;

interface Goth {
  n: Npc;
  rig: Rig;
  motion: Motion;
}

/** Goth baddies. They wander, they judge, and one of them will sit on you. */
export const gothBaddies: Feature = {
  meta: {
    id: '001-goth-baddies',
    day: 1,
    title: 'Goth baddies',
    credit: { username: 'yugi_aman_e', text: 'AWESOME! Add Goth baddies', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x601b);
    // With the cube switched off there is nothing to react to, only somewhere to wander.
    const cube: CubeView = ctx.state.cube ?? { x: 0, z: 0, rolls: 0, moving: false, pinned: false, struggles: 0, idleFor: 0 };
    const goths: Goth[] = [];
    let nextId = 0;

    // The cube's heart, breaking.
    const heart = makeSymbolSprite();
    ctx.scene.add(heart);
    let heartAge = HEARTBREAK_SECONDS;

    const world: World = {
      grid: ctx.grid,
      cube,
      rand,
      sitter: null,
      sitCooldown: 10,
      staged: false,
      emit(event) {
        if (event === 'rejected') heartAge = 0;
        if (event === 'plop') ctx.bump(0.12);
        ctx.events.emit(`goth:${event}`);
      },
    };
    ctx.state.goths = { npcs: [] as Npc[], world };

    const spawn = (variant: number, x: number, z: number, dir: DirIndex): Goth | null => {
      const n = createNpc(`goth-${nextId++}`, variant % VARIANTS.length, x, z, dir, ctx.grid);
      if (!n) return null;
      const rig = buildGoth(VARIANTS[n.variant], makeSymbolSprite());
      ctx.scene.add(rig.root);
      const g = { n, rig, motion: newMotion(n) };
      goths.push(g);
      ctx.state.goths.npcs.push(n);
      return g;
    };

    const clear = () => {
      for (const g of goths) {
        ctx.grid.releaseAll(g.n.occ);
        ctx.scene.remove(g.rig.root);
      }
      goths.length = 0;
      ctx.state.goths.npcs.length = 0;
      world.sitter = null;
      cube.pinned = false;
    };

    // Opening cast: scattered a short walk from the cube, never on top of each other.
    for (let i = 0, tries = 0; i < COUNT && tries < 200; tries++) {
      const x = Math.round((rand() - 0.5) * 10);
      const z = Math.round((rand() - 0.5) * 10);
      const d = Math.abs(x) + Math.abs(z);
      if (d < 3 || d > 6) continue;
      if (goths.some((g) => Math.abs(g.n.x - x) + Math.abs(g.n.z - z) < 3)) continue;
      if (spawn(i, x, z, Math.floor(rand() * 4) as DirIndex)) i++;
    }

    // The cube bumped into a cell: whoever owns it hears about it.
    ctx.events.on<{ tx: number; tz: number }>('cube:bonk', ({ tx, tz }) => {
      const hit = goths.find(({ n }) => (n.x === tx && n.z === tz) || (n.nx === tx && n.nz === tz));
      if (hit) hit.n.pending = true;
    });

    // Scripted control, for tests and video shots.
    ctx.events.on('direct:goths.clear', clear);
    ctx.events.on<[boolean]>('direct:goths.staged', ([on]) => (world.staged = on));
    ctx.events.on<[number, number, number, DirIndex, { steps?: number; idle?: number }?]>(
      'direct:goths.spawn',
      ([variant, x, z, dir, opts]) => {
        const g = spawn(variant, x, z, dir);
        if (!g) return;
        if (opts?.steps) {
          g.n.mode = 'walk';
          g.n.steps = opts.steps;
        } else g.n.timer = opts?.idle ?? 0.4;
      },
    );
    ctx.events.on<[number, 'follow' | 'sit']>('direct:goths.do', ([i, what]) => {
      const n = goths[i]?.n;
      if (!n) return;
      if (what === 'follow') startFollow(n, world);
      else if (!world.sitter) startSit(n, world);
    });

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
      for (const g of goths) {
        tick(g.n, world, dt);

        // The cube wandered off: quietly move anyone left far behind to just out of view.
        if (!world.staged && Math.abs(g.n.x - cube.x) + Math.abs(g.n.z - cube.z) > 13 && offscreen(g.n.x, g.n.z)) {
          for (let tries = 0; tries < 12; tries++) {
            const a = rand() * Math.PI * 2;
            const r = 6 + rand() * 6;
            const x = cube.x + Math.round(Math.cos(a) * r);
            const z = cube.z + Math.round(Math.sin(a) * r);
            if (offscreen(x, z) && relocate(g.n, world, x, z)) break;
          }
        }
        animate(g.rig, g.n, world, g.motion, time, dt);
      }

      heartAge = Math.min(HEARTBREAK_SECONDS, heartAge + dt);
      const beating = heartAge < HEARTBREAK_SECONDS;
      showSymbol(heart, beating ? 'heartbreak' : null, heartAge, HEARTBREAK_SECONDS, 0.7);
      if (beating) heart.position.set(ctx.focus.x, 1.5 + heartAge * 0.7, ctx.focus.z);
    });
  },
};

