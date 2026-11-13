import type { Feature } from '../core/feature';
import { world } from './000-world';
import { cube } from './000-cube';
import { gothBaddies } from './001-goth-baddies';

/**
 * Every feature in the game, oldest first.
 * Adding a community feature = one new folder + one new line here.
 */
export const allFeatures: Feature[] = [world, cube, gothBaddies];
