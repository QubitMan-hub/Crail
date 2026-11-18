import type { Feature } from '../../core/feature';

/**
 * Gåmson is immortal. Tank shells and rockets flatten him for a moment, then he
 * springs back up holding everything he stole: the army can no longer win it back.
 * He wears a pale gold halo to show it. A bump from the cube still makes him drop
 * what he is carrying (being startled is not the same as being hurt).
 */
export const immortalGamson: Feature = {
  meta: {
    id: '005-immortal-gamson',
    day: 5,
    title: 'Gåmson is immortal',
    credit: { username: 'ump.619', text: 'Yaaaay gåmson 🐙 btw can you make him immortal', method: 'top-comment' },
  },
  setup(ctx) {
    const o = ctx.state.octopus as { immortal: boolean } | undefined;
    if (o) o.immortal = true;
  },
};
