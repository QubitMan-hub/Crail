import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import { FEMBOY } from '../../characters/brain';
import { createCast } from '../../characters/cast';
import { buildBow } from '../../characters/rig';
import { buildFemboy, VARIANTS } from './model';

const BOW_SECONDS = 45;

/** Femboys. The goths judge the cube; these guys pat it, follow it, and put a bow on it. */
export const femboys: Feature = {
  meta: {
    id: '002-femboys',
    day: 2,
    title: 'Femboys',
    credit: { username: 'angelwingss._', text: 'femboys', method: 'top-comment' },
  },
  setup(ctx) {
    // The bow the cube ends up wearing. It rides on top and stays upright while the cube rolls.
    const bow = buildBow('#f6a8c4', '#ee6fa4');
    bow.scale.setScalar(0);
    ctx.scene.add(bow);
    let bowAge = BOW_SECONDS;
    ctx.state.cubeBow = { on: false };

    createCast(ctx, {
      key: 'femboys',
      persona: FEMBOY,
      variants: VARIANTS,
      build: buildFemboy,
      count: 4,
      seedSalt: 0xf3b0,
      onEvent(event) {
        if (event === 'bow') bowAge = -0.9; // tied on at the end of the gift animation
      },
    });

    const cubeMesh = ctx.scene.getObjectByName('cube');
    const at = new THREE.Vector3();
    ctx.onUpdate((dt) => {
      bowAge = Math.min(BOW_SECONDS, bowAge + dt);
      const on = bowAge >= 0 && bowAge < BOW_SECONDS;
      ctx.state.cubeBow.on = on;
      if (!on || !cubeMesh) return void bow.scale.setScalar(0);
      const k = Math.min(1, bowAge / 0.2) - 1;
      const pop = 1 + k * k * (2.7 * k + 1.7);
      const leaving = Math.min(1, (BOW_SECONDS - bowAge) / 0.3);
      bow.scale.setScalar(1.7 * Math.max(0.001, pop) * leaving);
      cubeMesh.getWorldPosition(at);
      bow.position.set(at.x, at.y + 0.6, at.z);
      bow.rotation.y = Math.PI / 4;
    });
  },
};
