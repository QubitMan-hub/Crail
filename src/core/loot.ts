import type { GameContext } from './game';

/**
 * Something that can be taken. Each feature lists what it owns that a thief could
 * carry off (a flag, a balloon, a charm), and how to give it back. The thief does
 * not need to know what any of it is.
 */
export interface Stealable {
  /** Whose it is: 'army', 'park', 'cube'... The thief takes from each party in turn. */
  party: string;
  /** What to call it, as in "The octopus took the flag." */
  name: string;
  /** What it looks like in someone else's hands. */
  token: 'flag' | 'balloon' | 'charm' | 'bow' | 'boot' | 'sock' | 'cap' | 'medal' | 'battery';
  /** Where it is right now, or null if it is not there to take. */
  where(): { x: number; z: number } | null;
  take(): void;
  putBack(): void;
}

export function stealables(ctx: GameContext): Stealable[] {
  return (ctx.state.stealables ??= []);
}

export function addStealable(ctx: GameContext, item: Stealable): Stealable {
  stealables(ctx).push(item);
  return item;
}
