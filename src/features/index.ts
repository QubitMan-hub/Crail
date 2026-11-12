import type { Feature } from '../core/feature';
import { world } from './000-world';
import { cube } from './000-cube';

/**
 * Every feature in the game, oldest first.
 * Adding a community feature = one new folder + one new line here.
 */
export const allFeatures: Feature[] = [world, cube];
