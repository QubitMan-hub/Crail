import type { Feature } from '../core/feature';
import { world } from './000-world';
import { cube } from './000-cube';
import { gothBaddies } from './001-goth-baddies';
import { femboys } from './002-femboys';
import { supremeLeader } from './003-supreme-leader';
import { park } from './003-park';
import { cubeCult } from './003-cube-cult';
import { octopus } from './004-octopus';
import { immortalGamson } from './005-immortal-gamson';
import { tahgong } from './005-tahgong';
import { picachu } from './005-picachu';

/**
 * Every feature in the game, oldest first.
 * Adding a community feature = one new folder + one new line here.
 */
export const allFeatures: Feature[] = [world, cube, gothBaddies, femboys, supremeLeader, park, cubeCult, octopus, immortalGamson, tahgong, picachu];
