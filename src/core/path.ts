import type { Grid, Occupant } from './grid';

/**
 * The first step of a short free route from one cell to another (or to any cell next
 * to it). A breadth-first search over a box round both ends, capped so it stays cheap;
 * if no route turns up, any free step that gets closer. Null if there is nothing to do.
 */
export function stepToward(
  grid: Grid,
  who: Occupant,
  from: { x: number; z: number },
  goal: { x: number; z: number },
  opts: { onto?: boolean; maxSearch?: number; margin?: number; passable?: (x: number, z: number) => boolean } = {},
): [number, number] | null {
  const { onto = false, maxSearch = 1500, margin = 5 } = opts;
  /** Free to step into: empty, or somewhere only this walker may go (water, for a swimmer). */
  const open = opts.passable ?? ((x: number, z: number) => grid.isFree(x, z, who));
  const near = (x: number, z: number) => (onto ? x === goal.x && z === goal.z : Math.max(Math.abs(x - goal.x), Math.abs(z - goal.z)) <= 1);
  if (near(from.x, from.z)) return null;
  const key = (x: number, z: number) => `${x},${z}`;
  const [x0, x1] = [Math.min(from.x, goal.x) - margin, Math.max(from.x, goal.x) + margin];
  const [z0, z1] = [Math.min(from.z, goal.z) - margin, Math.max(from.z, goal.z) + margin];
  const back = new Map<string, string | null>([[key(from.x, from.z), null]]);
  const queue: [number, number][] = [[from.x, from.z]];
  for (let i = 0; i < queue.length && i < maxSearch; i++) {
    const [x, z] = queue[i];
    if (near(x, z)) {
      let k = key(x, z);
      for (let prev = back.get(k); prev && back.get(prev) !== null; prev = back.get(k)) k = prev;
      const [sx, sz] = k.split(',').map(Number);
      return [sx, sz];
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [qx, qz] = [x + dx, z + dz];
      if (qx < x0 || qx > x1 || qz < z0 || qz > z1 || back.has(key(qx, qz)) || !open(qx, qz)) continue;
      back.set(key(qx, qz), key(x, z));
      queue.push([qx, qz]);
    }
  }
  const dist = (x: number, z: number) => Math.abs(goal.x - x) + Math.abs(goal.z - z);
  const closer = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    .map(([dx, dz]) => [from.x + dx, from.z + dz] as [number, number])
    .filter(([x, z]) => dist(x, z) < dist(from.x, from.z) && open(x, z));
  return closer[0] ?? null;
}

/**
 * A whole route from one cell to another (or, with `onto` false, to beside it), as the
 * list of cells to step through, not counting the start. People can be told to count as
 * passable (`throughPeople`): they will have moved by the time anyone gets there, and
 * only scenery truly blocks the way. Null if there is no way within the search.
 */
export function findPath(
  grid: Grid,
  who: Occupant,
  from: { x: number; z: number },
  goal: { x: number; z: number },
  opts: { onto?: boolean; maxSearch?: number; margin?: number; throughPeople?: boolean } = {},
): { x: number; z: number }[] | null {
  const { onto = false, maxSearch = 6000, margin = 24, throughPeople = true } = opts;
  const open = (x: number, z: number) => {
    const o = grid.at(x, z);
    return !o || o === who || (throughPeople && !!o.mobile);
  };
  const near = (x: number, z: number) => (onto ? x === goal.x && z === goal.z : Math.max(Math.abs(x - goal.x), Math.abs(z - goal.z)) <= 1);
  if (near(from.x, from.z)) return [];
  const key = (x: number, z: number) => `${x},${z}`;
  const [x0, x1] = [Math.min(from.x, goal.x) - margin, Math.max(from.x, goal.x) + margin];
  const [z0, z1] = [Math.min(from.z, goal.z) - margin, Math.max(from.z, goal.z) + margin];
  const back = new Map<string, string | null>([[key(from.x, from.z), null]]);
  const queue: [number, number][] = [[from.x, from.z]];
  for (let i = 0; i < queue.length && i < maxSearch; i++) {
    const [x, z] = queue[i];
    if (near(x, z)) {
      const path: { x: number; z: number }[] = [];
      for (let k: string | null | undefined = key(x, z); k && back.get(k) !== null; k = back.get(k)) {
        const [px, pz] = k.split(',').map(Number);
        path.unshift({ x: px, z: pz });
      }
      return path;
    }
    // Try the direction toward the goal first, so routes look purposeful, not wiggly.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(
      (a, b) => Math.abs(goal.x - x - a[0]) + Math.abs(goal.z - z - a[1]) - (Math.abs(goal.x - x - b[0]) + Math.abs(goal.z - z - b[1])),
    );
    for (const [dx, dz] of dirs) {
      const [qx, qz] = [x + dx, z + dz];
      if (qx < x0 || qx > x1 || qz < z0 || qz > z1 || back.has(key(qx, qz))) continue;
      if (!open(qx, qz) && !(onto && qx === goal.x && qz === goal.z && grid.at(qx, qz)?.mobile)) continue;
      back.set(key(qx, qz), key(x, z));
      queue.push([qx, qz]);
    }
  }
  return null;
}
