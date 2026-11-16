import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { DIRS, LEADER, relocate, SOLDIER, type DirIndex, type Npc } from '../../characters/brain';
import { createCast, type Member } from '../../characters/cast';
import { buildCountdown, buildLeader, buildRocketSite, buildSoldier, buildStatue, buildTank, SOLDIER_SCALE } from './model';

const MAX_SOLDIERS = 6;
const BUILD_EVERY = 7;
const LAUNCH_EVERY = 26;
const ALARM_SECONDS = 7;
const DRILL_EVERY = 21;
const COUNTDOWN = 2.4;

type Outcome = 'tip' | 'fizzle' | 'success';
type Project = 'soldier' | 'pad' | 'statue' | 'tank';

/**
 * The leader builds a military, in this order: two soldiers, a rocket, two more
 * soldiers, a gold statue of himself, two more soldiers, and a tank.
 * The soldiers and the tank follow him in a column and drill on command.
 * The rocket has a countdown and, most of the time, a problem.
 */
export const supremeLeader: Feature = {
  meta: {
    id: '003-supreme-leader',
    day: 3,
    title: 'The leader builds a military',
    credit: { username: 'gyarados117', text: 'Kim Jong-un builds a military', method: 'top-comment' },
  },
  setup(ctx) {
    const soldiers = createCast<'soldier' | 'tank'>(ctx, {
      key: 'soldiers', persona: SOLDIER, variants: ['soldier', 'tank'], count: 0, seedSalt: 0x501d,
      build: (kind, emote) => (kind === 'tank' ? buildTank(emote) : buildSoldier(null, emote)),
    });
    const isTank = (m: Member) => m.n.variant === 1;
    const infantry = () => soldiers.members.filter((m) => !isTank(m)).length;
    const hasTank = () => soldiers.members.some(isTank);

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

    // ---- The rocket site -------------------------------------------------------
    const pad: Occupant = { kind: 'structure', id: 'launch-pad' };
    const { site, rocket, flame } = buildRocketSite();
    site.visible = false;
    ctx.scene.add(site);
    const countdown = buildCountdown();
    ctx.scene.add(countdown.sprite);
    // Dust kicked up when the rocket comes back down.
    const puff = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40),
      new THREE.MeshBasicMaterial({ color: '#b9ae99', transparent: true, opacity: 0 }),
    );
    puff.rotation.x = -Math.PI / 2;
    ctx.scene.add(puff);
    const rocketSite = {
      built: false, x: 0, z: 0, age: 0, sinceLaunch: 0, launches: 0, successes: 0,
      /** idle, counting down, or in flight. `t` is seconds into the current phase. */
      phase: 'idle' as 'idle' | 'countdown' | 'flight',
      t: 0,
      outcome: 'tip' as Outcome,
    };
    ctx.state.rocket = rocketSite;

    // ---- The statue ------------------------------------------------------------
    const plinth: Occupant = { kind: 'structure', id: 'statue' };
    const statue = buildStatue();
    statue.visible = false;
    ctx.scene.add(statue);
    const monument = { built: false, x: 0, z: 0, age: 0 };
    ctx.state.army = { monument, tank: false, infantry: 0 };

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
    const farAway = (x: number, z: number) => {
      const c = ctx.state.cube ?? { x: 0, z: 0 };
      return Math.abs(x - c.x) + Math.abs(z - c.z) > 18 && leaders.offscreen(x, z);
    };

    /** What he builds next. He has a plan, and the plan ends with a tank. */
    const nextProject = (): Project | null => {
      const men = infantry();
      if (men < 2) return 'soldier';
      if (!rocketSite.built || farAway(rocketSite.x, rocketSite.z)) return 'pad';
      if (men < 4) return 'soldier';
      if (!monument.built || farAway(monument.x, monument.z)) return 'statue';
      if (men < MAX_SOLDIERS) return 'soldier';
      if (!hasTank()) return 'tank';
      return null;
    };

    const place = (what: 'pad' | 'statue', x: number, z: number): boolean => {
      const who = what === 'pad' ? pad : plinth;
      const thing = what === 'pad' ? rocketSite : monument;
      if (thing.built) ctx.grid.release(thing.x, thing.z, who);
      if (!ctx.grid.claim(x, z, who)) return false;
      Object.assign(thing, { built: true, x, z, age: 0 });
      const mesh = what === 'pad' ? site : statue;
      mesh.position.set(x, 0, z);
      mesh.visible = true;
      if (what === 'pad') Object.assign(rocketSite, { phase: 'idle', t: 0, sinceLaunch: LAUNCH_EVERY - 7 });
      return true;
    };

    function build(n: Npc, forced?: Project): void {
      const spot = freeNextTo(n);
      const what = forced ?? nextProject();
      if (!spot || !what) return;
      const [x, z] = spot;
      if (what === 'pad' || what === 'statue') {
        place(what, x, z);
        if (what === 'statue') for (const m of soldiers.members) m.n.order = 'salute'; // unveiling
        return;
      }
      const recruit = soldiers.spawn(what === 'tank' ? 1 : 0, x, z, n.dir);
      if (!recruit) return;
      // Each new arrival takes the next place in the column behind him.
      recruit.n.lead = n;
      recruit.n.slot = soldiers.members.length - 1;
      recruit.n.order = 'salute';
      recruit.rig.root.scale.setScalar(0.01); // pops up to full size below
    }

    const launch = (outcome?: Outcome) => {
      if (!rocketSite.built || rocketSite.phase !== 'idle') return;
      const roll = soldiers.world.rand();
      // The first one always fails. After that it works about one time in seven.
      rocketSite.outcome = outcome ?? (rocketSite.launches === 0 ? 'tip' : roll < 0.55 ? 'tip' : roll < 0.85 ? 'fizzle' : 'success');
      rocketSite.phase = 'countdown';
      rocketSite.t = 0;
      rocketSite.sinceLaunch = 0;
      rocketSite.launches += 1;
    };

    // Drill: a salute that runs down the column, one soldier after the next.
    const pendingSalutes: { n: Npc; at: number }[] = [];
    let clock = 0;
    const drill = () => {
      soldiers.members.forEach((m, i) => pendingSalutes.push({ n: m.n, at: clock + i * 0.16 }));
    };

    // Scripted control, for tests and video shots.
    ctx.events.on('direct:leader.build', () => (leaders.world.wantBuild = true));
    ctx.events.on<[Outcome?]>('direct:leader.launch', ([outcome]) => launch(outcome));
    ctx.events.on('direct:leader.alarm', () => (soldiers.world.alarm = ALARM_SECONDS));
    ctx.events.on('direct:leader.drill', drill);
    for (const what of ['pad', 'statue', 'tank', 'soldier'] as const) {
      ctx.events.on(`direct:leader.${what === 'pad' ? 'site' : what}`, () => {
        const n = boss();
        if (n) build(n, what);
      });
    }
    ctx.events.on('direct:leader.clear', () => {
      for (const [thing, who, mesh] of [[rocketSite, pad, site], [monument, plinth, statue]] as const) {
        if (thing.built) ctx.grid.release(thing.x, thing.z, who);
        thing.built = false;
        mesh.visible = false;
      }
      rocketSite.phase = 'idle';
      countdown.show(null, 0);
    });

    const popIn = (age: number) => {
      const k = Math.min(1, age / 0.35) - 1;
      return Math.max(0.001, 1 + k * k * (2.7 * k + 1.7));
    };

    let sinceBuild = BUILD_EVERY - 3;
    let sinceDrill = 6;
    let wasRiding = false;
    ctx.onUpdate((dt) => {
      clock += dt;
      const n = boss();
      if (!n) return;
      const staged = leaders.world.staged;
      ctx.state.army.tank = hasTank();
      ctx.state.army.infantry = infantry();

      // Time to build something? (Not once the cube's cult has got to him.)
      sinceBuild += dt;
      if (!staged && !n.cult && sinceBuild > BUILD_EVERY && nextProject()) {
        sinceBuild = 0;
        leaders.world.wantBuild = true;
      }

      // Keep the column together: everyone knows their place, and anyone left far behind is brought back.
      soldiers.members.forEach((m, i) => {
        const full = isTank(m) ? 1 : SOLDIER_SCALE;
        const s = m.rig.root.scale.x;
        if (s < full) m.rig.root.scale.setScalar(Math.min(full, s + dt * 2.8));
        // A soldier who has joined the cube's cult no longer answers to him.
        if (m.n.cult) return;
        m.n.lead = n;
        m.n.slot = i;
        if (!staged && Math.abs(m.n.x - n.x) + Math.abs(m.n.z - n.z) > 14 && leaders.offscreen(m.n.x, m.n.z)) {
          for (let tries = 0; tries < 8; tries++) {
            const x = n.x + Math.round((soldiers.world.rand() - 0.5) * 6);
            const z = n.z + Math.round((soldiers.world.rand() - 0.5) * 6);
            if (relocate(m.n, soldiers.world, x, z)) break;
          }
        }
      });

      // Drill, every so often, and a salute whenever he gets on a ride.
      sinceDrill += dt;
      const riding = n.mode === 'riding';
      if ((riding && !wasRiding) || (!staged && !n.cult && sinceDrill > DRILL_EVERY && soldiers.members.length >= 2 && n.nx === null)) {
        sinceDrill = 0;
        drill();
      }
      wasRiding = riding;
      for (let i = pendingSalutes.length - 1; i >= 0; i--) {
        if (clock < pendingSalutes[i].at) continue;
        if (!pendingSalutes[i].n.cult) pendingSalutes[i].n.order = 'salute';
        pendingSalutes.splice(i, 1);
      }

      if (monument.built) {
        monument.age += dt;
        statue.scale.setScalar(popIn(monument.age));
      }

      // ---- The rocket ----
      if (!rocketSite.built) return;
      rocketSite.age += dt;
      site.scale.setScalar(popIn(rocketSite.age));
      const everyoneSalutes = () => soldiers.members.forEach((m) => !m.n.cult && (m.n.order = 'salute'));

      if (rocketSite.phase === 'idle') {
        rocketSite.sinceLaunch += dt;
        if (!staged && !n.cult && rocketSite.sinceLaunch > LAUNCH_EVERY) launch();
        rocket.position.set(0, 0.16, 0);
        rocket.rotation.set(0, 0, 0);
        rocket.scale.setScalar(Math.min(1, Math.max(0.001, (rocketSite.sinceLaunch - 0.2) / 0.3)));
        flame.visible = false;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0;
        countdown.show(null, 0);
        return;
      }

      const before = rocketSite.t;
      const t = (rocketSite.t += dt);
      rocket.scale.setScalar(1);
      countdown.sprite.position.set(rocketSite.x, 3.1, rocketSite.z);

      if (rocketSite.phase === 'countdown') {
        // 3... 2... 1...
        const step = COUNTDOWN / 3;
        countdown.show(String(3 - Math.min(2, Math.floor(t / step))), 1 - ((t % step) / step));
        rocket.position.set(Math.sin(t * 60) * 0.006 * (t / COUNTDOWN), 0.16, 0);
        if (t >= COUNTDOWN) {
          rocketSite.phase = 'flight';
          rocketSite.t = 0;
          countdown.show(null, 0);
        }
        return;
      }

      const crossed = (at: number) => before < at && t >= at;
      const dud = () => {
        ctx.bump(0.22);
        ctx.events.emit('leader:dud');
        if (!n.cult) n.order = 'fume';
        everyoneSalutes(); // they clap for everything
      };
      if (t < 0.6) {
        // Ignition: shaking on the pad.
        rocket.position.set(Math.sin(t * 90) * 0.015, 0.16, 0);
        flame.visible = true;
        flame.scale.y = 0.55 + Math.sin(t * 70) * 0.15;
        return;
      }

      if (rocketSite.outcome === 'success') {
        // It works. Nobody is more surprised than he is.
        const k = (t - 0.6) / 2.2;
        rocket.position.set(Math.sin(t * 30) * 0.02, 0.16 + 16 * k * k, 0);
        flame.visible = true;
        flame.scale.y = 1.3 + Math.sin(t * 60) * 0.2;
        rocket.visible = k < 1;
        if (crossed(2.0)) {
          rocketSite.successes += 1;
          ctx.events.emit('leader:launched');
          if (!n.cult) n.order = 'cheer';
          everyoneSalutes();
        }
        if (t > 6) {
          rocket.visible = true;
          rocketSite.phase = 'idle';
        }
      } else if (rocketSite.outcome === 'fizzle') {
        // A small hop, a cough, and it settles back at an angle.
        const k = Math.min(1, (t - 0.6) / 0.5);
        rocket.position.set(0, 0.16 + Math.sin(Math.PI * k) * 0.45, 0);
        flame.visible = k < 0.6;
        flame.scale.y = 0.5 * (1 - k);
        rocket.rotation.z = k * 0.22;
        if (crossed(1.1)) dud();
        const s = Math.min(1, Math.max(0, (t - 1.1) / 0.5));
        puff.position.set(rocketSite.x, 0.25, rocketSite.z);
        puff.scale.setScalar(0.6 + s * 1.0);
        (puff.material as THREE.MeshBasicMaterial).opacity = t > 1.1 ? 0.5 * (1 - s) : 0;
        if (t > 4.5) rocketSite.phase = 'idle';
      } else if (t < 1.7) {
        // A confident start...
        const k = (t - 0.6) / 1.1;
        rocket.position.set(Math.sin(t * 30) * 0.03 * k, 0.16 + 3.4 * (1 - (1 - k) * (1 - k)), 0);
        rocket.rotation.z = Math.sin(t * 9) * 0.12 * k;
        flame.visible = Math.sin(t * 60) > -0.2 || k < 0.6; // sputtering near the top
        flame.scale.y = 1.2 - k * 0.7;
      } else if (t < 2.5) {
        // ...then it runs out of ideas, tips over and falls.
        const k = (t - 1.7) / 0.8;
        flame.visible = false;
        rocket.rotation.z = 0.12 + k * k * 2.9;
        rocket.position.set(0.55 * k, 0.16 + 3.4 - 3.3 * k * k, 0.1 * k);
      } else {
        if (crossed(2.5)) dud();
        const k = Math.min(1, (t - 2.5) / 0.5);
        rocket.rotation.z = Math.PI / 2 + Math.exp(-(t - 2.5) * 8) * 0.3;
        rocket.position.set(0.55, 0.3, 0.1);
        puff.position.set(rocketSite.x + 0.55, 0.02, rocketSite.z + 0.1);
        puff.scale.setScalar(1 + k * 1.4);
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
        if (t > 5) rocketSite.phase = 'idle'; // a new one appears on the pad. There is always a new one.
      }
    });
  },
};
