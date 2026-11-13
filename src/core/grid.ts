/** Something that takes up a floor cell: the cube, a character, later a building. */
export interface Occupant {
  kind: string;
  id: string;
}

const key = (x: number, z: number) => `${x},${z}`;

/**
 * Who stands where. One occupant per floor cell. Anything that moves claims the
 * cell it is heading for before it sets off, so two things can never overlap.
 */
export class Grid {
  private cells = new Map<string, Occupant>();

  at(x: number, z: number): Occupant | undefined {
    return this.cells.get(key(x, z));
  }

  isFree(x: number, z: number, who?: Occupant): boolean {
    const o = this.cells.get(key(x, z));
    return !o || o === who;
  }

  /** Take a cell. False (and no change) if someone else already has it. */
  claim(x: number, z: number, who: Occupant): boolean {
    if (!this.isFree(x, z, who)) return false;
    this.cells.set(key(x, z), who);
    return true;
  }

  release(x: number, z: number, who: Occupant): void {
    if (this.cells.get(key(x, z)) === who) this.cells.delete(key(x, z));
  }

  releaseAll(who: Occupant): void {
    for (const [k, o] of this.cells) if (o === who) this.cells.delete(k);
  }

  get size(): number {
    return this.cells.size;
  }
}
