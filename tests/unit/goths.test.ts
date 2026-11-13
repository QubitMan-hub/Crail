import { describe, expect, it } from 'vitest';
import { Grid, type Occupant } from '../../src/core/grid';
import { seededRandom } from '../../src/core/rng';
import { createNpc, startSit, tick, type CubeView, type DirIndex, type Npc, type World } from '../../src/features/001-goth-baddies/brain';

const CUBE: Occupant = { kind: 'cube', id: 'cube' };

function setup(seed = 7) {
  const grid = new Grid();
  const cube: CubeView = { x: 0, z: 0, rolls: 0, moving: false, pinned: false, struggles: 0, idleFor: 0 };
  grid.claim(0, 0, CUBE);
  const events: string[] = [];
  const world: World = {
    grid, cube, rand: seededRandom(seed), sitter: null, sitCooldown: 0, staged: true,
    emit: (e) => void events.push(e),
  };
  const add = (x: number, z: number, dir: DirIndex, steps = 0): Npc => {
    const n = createNpc(`g${x}_${z}`, 0, x, z, dir, grid)!;
    if (steps) {
      n.mode = 'walk';
      n.steps = steps;
    }
    return n;
  };
  const run = (npcs: Npc[], seconds: number, each?: () => void) => {
    for (let t = 0; t < seconds; t += 1 / 30) {
      each?.();
      for (const n of npcs) tick(n, world, 1 / 30);
    }
  };
  const moveCube = (x: number, z: number) => {
    grid.releaseAll(CUBE);
    cube.x = x;
    cube.z = z;
    cube.rolls += 1;
    grid.claim(x, z, CUBE);
  };
  return { grid, cube, world, events, add, run, moveCube };
}

describe('grid', () => {
  it('gives a cell to one occupant at a time', () => {
    const g = new Grid();
    const a = { kind: 'a', id: 'a' };
    const b = { kind: 'b', id: 'b' };
    expect(g.claim(1, 2, a)).toBe(true);
    expect(g.claim(1, 2, b)).toBe(false);
    expect(g.claim(1, 2, a)).toBe(true);
    g.release(1, 2, b);
    expect(g.at(1, 2)).toBe(a);
    g.release(1, 2, a);
    expect(g.isFree(1, 2)).toBe(true);
  });
});

describe('goth behaviour', () => {
  it('the stare: stops when the cube is in her way, walks on when it leaves', () => {
    const s = setup();
    const n = s.add(-3, 0, 0, 8);
    s.run([n], 3);
    expect(n.mode).toBe('stare');
    expect([n.x, n.z]).toEqual([-1, 0]);
    expect(n.emote?.kind ?? 'dots').toBe('dots');
    s.moveCube(0, 5);
    s.run([n], 2);
    expect(n.mode).not.toBe('stare');
    expect(n.x).toBeGreaterThan(-1);
  });

  it('the stare: if the cube never moves she walks around it', () => {
    const s = setup();
    const n = s.add(-2, 0, 0, 8);
    s.run([n], 6);
    expect(n.z).not.toBe(0);
    expect(s.grid.at(0, 0)).toBe(CUBE);
  });

  it('the rejection: glare, then turn away, then storm off', () => {
    const s = setup();
    const n = s.add(1, 0, 3);
    n.timer = 99;
    const bonk = () => {
      n.pending = true;
      s.run([n], 0.5);
    };
    bonk();
    expect(n.mode).toBe('stare');
    expect(n.dir).toBe(2); // facing the cube
    bonk();
    expect(n.mode).toBe('snub');
    expect(n.dir).toBe(0); // back turned
    bonk();
    expect(n.mode).toBe('huff');
    expect(s.events).toContain('rejected');
    s.run([n], 4);
    expect(n.x).toBeGreaterThanOrEqual(6);
  });

  it('the seat: sits on an idle cube, pins it, and falls when it escapes', () => {
    const s = setup();
    const n = s.add(-3, 0, 1);
    n.timer = 99;
    startSit(n, s.world);
    s.run([n], 4);
    expect(n.mode).toBe('sit');
    expect(s.cube.pinned).toBe(true);
    s.cube.struggles = 3;
    s.run([n], 0.1);
    expect(s.cube.pinned).toBe(false);
    s.moveCube(0, 1);
    s.run([n], 0.6);
    expect(n.mode).toBe('plop');
    expect([n.x, n.z]).toEqual([0, 0]); // on the floor where the cube was
    expect(s.grid.at(-1, 0)).toBeUndefined();
    s.run([n], 3);
    expect(s.world.sitter).toBeNull();
  });

  it('caught following: pretends she was not', () => {
    const s = setup();
    const n = s.add(3, 0, 2);
    n.mode = 'follow';
    n.timer = 99;
    s.run([n], 1.5);
    expect([n.x, n.z]).toEqual([2, 0]); // keeps a polite distance
    n.pending = true;
    s.run([n], 0.2);
    expect(n.mode).toBe('caught');
    expect(n.emote?.kind).toBe('note');
  });

  it('no two things ever share a cell, however long they wander', () => {
    const s = setup(42);
    s.world.staged = false;
    const npcs = [s.add(3, 1, 0), s.add(-2, 3, 1), s.add(1, -4, 2), s.add(-3, -2, 3), s.add(4, 4, 0), s.add(-4, 1, 1)];
    const rand = seededRandom(99);
    let frame = 0;
    s.run(npcs, 240, () => {
      frame++;
      s.cube.idleFor += 1 / 30;
      // A restless cube: every so often it hops to a free neighbouring cell.
      if (frame % 20 === 0 && !s.cube.pinned && rand() < 0.7) {
        const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(rand() * 4)];
        if (s.grid.isFree(s.cube.x + dx, s.cube.z + dz)) {
          s.moveCube(s.cube.x + dx, s.cube.z + dz);
          s.cube.idleFor = 0;
        } else s.cube.struggles += 1;
      }
      const seen = new Set<string>([`${s.cube.x},${s.cube.z}`]);
      for (const n of npcs) {
        for (const [x, z] of [[n.x, n.z], ...(n.nx !== null ? [[n.nx, n.nz]] : [])]) {
          const k = `${x},${z}`;
          expect(seen.has(k), `two occupants at ${k} on frame ${frame}`).toBe(false);
          seen.add(k);
        }
      }
    });
    // They stay in the neighbourhood rather than drifting off forever.
    for (const n of npcs) expect(Math.abs(n.x - s.cube.x) + Math.abs(n.z - s.cube.z)).toBeLessThan(30);
  });
});
