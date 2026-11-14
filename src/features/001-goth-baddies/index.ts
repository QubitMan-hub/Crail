import type { Feature } from '../../core/feature';
import { GOTH } from '../../characters/brain';
import { createCast } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { buildGoth, VARIANTS } from './model';

const HEARTBREAK_SECONDS = 1.5;

/** Goth baddies. They wander, they judge, and one of them will sit on you. */
export const gothBaddies: Feature = {
  meta: {
    id: '001-goth-baddies',
    day: 1,
    title: 'Goth baddies',
    credit: { username: 'yugi_aman_e', text: 'AWESOME! Add Goth baddies', method: 'top-comment' },
  },
  setup(ctx) {
    // The cube's heart, breaking.
    const heart = makeSymbolSprite();
    ctx.scene.add(heart);
    let heartAge = HEARTBREAK_SECONDS;

    createCast(ctx, {
      key: 'goths',
      persona: GOTH,
      variants: VARIANTS,
      build: buildGoth,
      count: 5,
      seedSalt: 0x601b,
      // If anyone gives a goth a bow, it is pink, and she keeps it.
      bow: ['#f6a8c4', '#ee6fa4'],
      onEvent(event) {
        if (event === 'rejected') heartAge = 0;
      },
    });

    ctx.onUpdate((dt) => {
      heartAge = Math.min(HEARTBREAK_SECONDS, heartAge + dt);
      const beating = heartAge < HEARTBREAK_SECONDS;
      showSymbol(heart, beating ? 'heartbreak' : null, heartAge, HEARTBREAK_SECONDS, 0.7);
      if (beating) heart.position.set(ctx.focus.x, 1.5 + heartAge * 0.7, ctx.focus.z);
    });
  },
};
