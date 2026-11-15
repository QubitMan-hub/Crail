import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { DIRS, LEADER, relocate, SOLDIER, type DirIndex, type Npc } from '../../characters/brain';
import { createCast } from '../../characters/cast';
import { buildLeader, buildRocketSite, buildSoldier, SOLDIER_SCALE as SOLDIER_FULL } from './model';

const MAX_SOLDIERS = 6;
const BUILD_EVERY = 8;
const LAUNCH_EVERY = 24;
const ALARM_SECONDS = 7;

/**
 * The leader builds a military. One soldier at a time, then a rocket.
 * The soldiers follow him in a column. The rocket has never once worked.
 */
export const supremeLeader: Feature = {
  meta: {
    id: '003-supreme-leader',
    day: 3,
    title: 'The leader builds a military',
    credit: { username: 'gyarados117', text: 'Kim Jong-un builds a military', method: 'top-comment' },
  },
  setup(ctx) {
    const soldiers = createCast(ctx, {
      key: 'soldiers', persona: SOLDIER, variants: [null], build: buildSoldier, count: 0, seedSalt: 0x501d,
    });

    const leaders = createCast(ctx, {
      key: 'leader', persona: LEADER, variants: [null], build: buildLeader, count: 1, seedSalt: 0x1ead,
      // Femboys wave at everyone. He is not exempt.
      bow: ['#f6a8c4', '#ee6fa4'],
      onEvent(event, npc) {
        if (event === 'built') build(npc);
        if (event === 'alarm') soldiers.world.alarm = ALARM_SECONDS;
      },
    });
    const boss = () => leaders.members[0]?.n;

    // ---- The rocket site ----------------------------------------------------
    const pad: Occupant = { kind: 'structure', id: 'launch-pad' };
    const { site, rocket, flame } = buildRocketSite();
    site.visible = false;
    ctx.scene.add(site);
    // Dust kicked up when the rocket comes back down.
    const puff = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40),
      new THREE.MeshBasicMaterial({ color: '#b9ae99', transparent: true, opacity: 0 }),
    );
    puff.rotation.x = -Math.PI / 2;
    ctx.scene.add(puff);
    const rocketSite = { built: false, x: 0, z: 0, age: 0, flight: -1, sinceLaunch: 0, launches: 0 };
    ctx.state.rocket = rocketSite;

    const freeNextTo = (n: Npc): [number, number] | null => {
      // Behind him first, then either side, then in front.
      const order = [2, 1, 3, 0].map((turn) => ((n.dir + turn) % 4) as DirIndex);
      for (const d of order) {
        const x = n.x + DIRS[d][0];
        const z = n.z + DIRS[d][1];
        if (ctx.grid.isFree(x, z)) return [x, z];
      }
      return null;
    };

    function build(n: Npc): void {
      const spot = freeNextTo(n);
      if (!spot) return;
      const [x, z] = spot;
      const wantsRocket = soldiers.members.length >= 2 && (!rocketSite.built || farAway(rocketSite.x, rocketSite.z));
      if (wantsRocket || soldiers.members.length >= MAX_SOLDIERS) {
        if (rocketSite.built) ctx.grid.release(rocketSite.x, rocketSite.z, pad);
        if (!ctx.grid.claim(x, z, pad)) return;
        Object.assign(rocketSite, { built: true, x, z, age: 0, flight: -1, sinceLaunch: LAUNCH_EVERY - 6 });
        site.position.set(x, 0, z);
        site.visible = true;
        return;
      }
      const recruit = soldiers.spawn(0, x, z, n.dir);
      if (!recruit) return;
      // Each new soldier takes the next place in the column behind him.
      recruit.n.lead = n;
      recruit.n.slot = soldiers.members.length - 1;
      recruit.n.order = 'salute';
      recruit.rig.root.scale.multiplyScalar(0.01); // pops up to full size below
    }

    const farAway = (x: number, z: number) => {
      const c = ctx.state.cube ?? { x: 0, z: 0 };
      return Math.abs(x - c.x) + Math.abs(z - c.z) > 16 && leaders.offscreen(x, z);
    };

    const launch = () => {
      if (!rocketSite.built || rocketSite.flight >= 0) return;
      rocketSite.flight = 0;
      rocketSite.sinceLaunch = 0;
      rocketSite.launches += 1;
    };

    // Scripted control, for tests and video shots.
    ctx.events.on('direct:leader.build', () => (leaders.world.wantBuild = true));
    ctx.events.on('direct:leader.launch', launch);
    ctx.events.on('direct:leader.alarm', () => (soldiers.world.alarm = ALARM_SECONDS));
    ctx.events.on('direct:leader.site', () => {
      const n = boss();
      if (!n) return;
      const spot = freeNextTo(n);
      if (!spot || rocketSite.built) return;
      ctx.grid.claim(spot[0], spot[1], pad);
      Object.assign(rocketSite, { built: true, x: spot[0], z: spot[1], age: 0, flight: -1, sinceLaunch: 0 });
      site.position.set(spot[0], 0, spot[1]);
      site.visible = true;
    });
    ctx.events.on('direct:soldiers.clear', () => {
      // The cast clears its own members; make sure nobody is left following a ghost.
      for (const m of soldiers.members) m.n.lead = null;
    });
    ctx.events.on('direct:leader.clear', () => {
      if (rocketSite.built) ctx.grid.release(rocketSite.x, rocketSite.z, pad);
      rocketSite.built = false;
      rocketSite.flight = -1;
      site.visible = false;
    });

    let sinceBuild = BUILD_EVERY - 3;
    ctx.onUpdate((dt) => {
      const n = boss();
      if (!n) return;
      const staged = leaders.world.staged;

      // Time to build something?
      sinceBuild += dt;
      const somethingToBuild = soldiers.members.length < MAX_SOLDIERS || !rocketSite.built || farAway(rocketSite.x, rocketSite.z);
      if (!staged && sinceBuild > BUILD_EVERY && somethingToBuild) {
        sinceBuild = 0;
        leaders.world.wantBuild = true;
      }

      // Keep the column together: everyone knows their place, and anyone left far behind is brought back.
      soldiers.members.forEach((m, i) => {
        m.n.lead = n;
        m.n.slot = i;
        const target = SOLDIER_FULL;
        const s = m.rig.root.scale.x;
        if (s < target) m.rig.root.scale.setScalar(Math.min(target, s + dt * 2.6));
        if (!staged && Math.abs(m.n.x - n.x) + Math.abs(m.n.z - n.z) > 14 && leaders.offscreen(m.n.x, m.n.z)) {
          for (let tries = 0; tries < 8; tries++) {
            const x = n.x + Math.round((soldiers.world.rand() - 0.5) * 6);
            const z = n.z + Math.round((soldiers.world.rand() - 0.5) * 6);
            if (relocate(m.n, soldiers.world, x, z)) break;
          }
        }
      });

      // The rocket.
      if (!rocketSite.built) return;
      rocketSite.age += dt;
      const grow = Math.min(1, rocketSite.age / 0.35) - 1;
      site.scale.setScalar(Math.max(0.001, 1 + grow * grow * (2.7 * grow + 1.7)));
      if (rocketSite.flight < 0) {
        rocketSite.sinceLaunch += dt;
        if (!staged && rocketSite.sinceLaunch > LAUNCH_EVERY) launch();
        rocket.position.set(0, 0.16, 0);
        rocket.rotation.set(0, 0, 0);
        rocket.scale.setScalar(Math.min(1, Math.max(0.001, (rocketSite.sinceLaunch - 0.2) / 0.3)));
        flame.visible = false;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0;
        return;
      }
      // Flight: a confident start, a wobble, and a return to sender.
      const before = rocketSite.flight;
      const t = (rocketSite.flight += dt);
      rocket.scale.setScalar(1);
      if (t < 0.6) {
        // Ignition: shaking on the pad.
        rocket.position.set(Math.sin(t * 90) * 0.015, 0.16, 0);
        flame.visible = true;
        flame.scale.y = 0.55 + Math.sin(t * 70) * 0.15;
      } else if (t < 1.7) {
        const k = (t - 0.6) / 1.1;
        rocket.position.set(Math.sin(t * 30) * 0.03 * k, 0.16 + 3.4 * (1 - (1 - k) * (1 - k)), 0);
        rocket.rotation.z = Math.sin(t * 9) * 0.12 * k;
        flame.visible = Math.sin(t * 60) > -0.2 || k < 0.6; // sputtering near the top
        flame.scale.y = 1.2 - k * 0.7;
      } else if (t < 2.5) {
        // Out of ideas. Tips over and falls.
        const k = (t - 1.7) / 0.8;
        flame.visible = false;
        rocket.rotation.z = 0.12 + k * k * 2.9;
        rocket.position.set(0.55 * k, 0.16 + 3.4 - 3.3 * k * k, 0.1 * k);
      } else {
        if (before < 2.5) {
          // It lands next to the pad, on its side.
          ctx.bump(0.22);
          ctx.events.emit('leader:dud');
          n.order = 'fume';
          for (const m of soldiers.members) m.n.order = 'salute'; // they clap for everything
        }
        const k = Math.min(1, (t - 2.5) / 0.5);
        rocket.rotation.z = Math.PI / 2 + Math.exp(-(t - 2.5) * 8) * 0.3;
        rocket.position.set(0.55, 0.3, 0.1);
        puff.position.set(rocketSite.x + 0.55, 0.02, rocketSite.z + 0.1);
        puff.scale.setScalar(1 + k * 1.4);
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
        if (t > 5) rocketSite.flight = -1; // a new one appears on the pad. There is always a new one.
      }
    });
  },
};
