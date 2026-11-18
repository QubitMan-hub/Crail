import type { GameContext } from './game';

/**
 * A named place in the world. Features register the places they build, and the map
 * (press M) draws them. A landmark is a plain object: move it or hide it by changing it.
 */
export interface Landmark {
  name: string;
  x: number;
  z: number;
  color: string;
  /** For places that cover an area: size in cells, with (x, z) as the top-left corner. */
  w?: number;
  d?: number;
  /** For places with an irregular shape: the exact cells they cover. */
  cells?: [number, number][];
  hidden?: boolean;
}

export function landmarks(ctx: GameContext): Landmark[] {
  return (ctx.state.landmarks ??= []);
}

export function addLandmark(ctx: GameContext, mark: Landmark): Landmark {
  landmarks(ctx).push(mark);
  return mark;
}
