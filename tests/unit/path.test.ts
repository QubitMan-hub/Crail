import { describe, expect, it } from 'vitest';
import { Grid, type Occupant } from '../../src/core/grid';
import { findPath } from '../../src/core/path';

const fence: Occupant = { kind: 'fence', id: 'fence' };
const me: Occupant = { kind: 'goth', id: 'me', mobile: true };
const person: Occupant = { kind: 'femboy', id: 'them', mobile: true };

/** A fence along z = 0 from x = -10 to 10, with a one-cell gate at x = 6. */
function fenced(): Grid {
  const g = new Grid();
  for (let x = -10; x <= 10; x++) if (x !== 6) g.claim(x, 0, fence);
  return g;
}

describe('findPath', () => {
  it('goes the long way round, through the gate, instead of pressing against the fence', () => {
    const path = findPath(fenced(), me, { x: 0, z: 3 }, { x: 0, z: -3 }, { onto: true })!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual({ x: 0, z: -3 });
    expect(path.some((c) => c.x === 6 && c.z === 0)).toBe(true);
    // Every step is one cell from the last, and none goes through the fence.
    let at = { x: 0, z: 3 };
    for (const c of path) {
      expect(Math.abs(c.x - at.x) + Math.abs(c.z - at.z)).toBe(1);
      expect(c.z === 0 && c.x !== 6).toBe(false);
      at = c;
    }
  });

  it('plans through people (they move), but not when told they will not', () => {
    const g = fenced();
    g.claim(6, 0, person); // someone standing in the gate
    expect(findPath(g, me, { x: 0, z: 3 }, { x: 0, z: -3 }, { onto: true })).not.toBeNull();
    expect(findPath(g, me, { x: 0, z: 3 }, { x: 0, z: -3 }, { onto: true, throughPeople: false, margin: 8 })).toBeNull();
  });

  it('is empty when already there, and null when there is no way at all', () => {
    expect(findPath(fenced(), me, { x: 2, z: 2 }, { x: 2, z: 2 }, { onto: true })).toEqual([]);
    const g = fenced();
    g.claim(6, 0, fence);
    expect(findPath(g, me, { x: 0, z: 3 }, { x: 0, z: -3 }, { onto: true, margin: 8 })).toBeNull();
  });
});
