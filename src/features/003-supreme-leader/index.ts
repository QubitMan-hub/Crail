import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { tip } from '../../core/tip';
import { DIRS, LEADER, relocate, SOLDIER, type DirIndex, type Npc } from '../../characters/brain';
import { createCast, type Member } from '../../characters/cast';
import {
  buildCountdown, buildFlag, buildLeader, buildRocketSite, buildSoldier, buildStatue, buildTank, SOLDIER_SCALE,
} from './model';

/** How many soldiers and tanks march behind him. The rest stay to guard his statue. */
const FOLLOWERS = 4;
const TANKS = 1;
const GUARDS = 2;
/** He replaces soldiers the cube's cult takes from him, but not forever. */
const MOST_EVER_BUILT = 14;
const BUILD_EVERY = 7;
const LAUNCH_EVERY = 26;
const ALARM_SECONDS = 7;
const GUARD_ALERT_SECONDS = 6;
const DRILL_EVERY = 21;
const COUNTDOWN = 2.4;
/** A cult this size outnumbers his column. His soldiers can count. */
const INTIMIDATING = 6;

type Outcome = 'tip' | 'fizzle' | 'success';
type Project = 'soldier' | 'pad' | 'statue' | 'flag' | 'guard' | 'tank';

/**
 * The leader builds a military, in this order: two soldiers, a rocket, two more
 * soldiers, one gold statue of himself with a flag beside it and two guards posted
 * at it, and a tank. Four soldiers and the tank march behind him. The guards stay.
 *
 * The cube can meddle: bump the statue or the flag and the guards come over; bump
 * the launch pad and the rocket goes early; bump him and his column surrounds you,
 * unless your cult is big enough that they think better of it.
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
    /** Still his: not recruited by the cube. */
    const loyal = () => soldiers.members.filter((m) => !m.n.cult);
    const followers = () => loyal().filter((m) => !isTank(m) && !m.n.post);
    const guards = () => loyal().filter((m) => m.n.post);
    const tanks = () => loyal().filter(isTank);
    let everBuilt = 0;

    const cultSize = (): number => ctx.state.cult?.members.length ?? 0;
    const leaders = createCast(ctx, {
      key: 'leader', persona: LEADER, variants: [null], build: buildLeader, count: 1, seedSalt: 0x1ead,
      // Femboys wave at everyone. He is not exempt.
      bow: ['#f6a8c4', '#ee6fa4'],
      onEvent(event, npc) {
        if (event === 'built') build(npc);
        if (event !== 'alarm') return;
        if (cultSize() >= INTIMIDATING) return tip('He points. His soldiers count your cult and stay where they are.');
        soldiers.world.alarm = ALARM_SECONDS;
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

    // ---- The parade ground: one statue, one flag, two guards -------------------
    const plinth: Occupant = { kind: 'structure', id: 'statue' };
    const statue = buildStatue();
    statue.visible = false;
    ctx.scene.add(statue);
    const monument = { built: false, x: 0, z: 0, age: 0, wobble: 9 };
    const flagpole: Occupant = { kind: 'structure', id: 'flag' };
    const { pole, banner, top: flagTop } = buildFlag();
    pole.visible = false;
    ctx.scene.add(pole);
    const flag = { built: false, x: 0, z: 0, age: 0, lowered: 0 };
    const army = { monument, flag, tank: false, followers: 0, guards: 0 };
    ctx.state.army = army;

    const freeNextTo = (at: { x: number; z: number }, facing: DirIndex): [number, number] | null => {
      // Behind first, then either side, then in front.
      const order = [2, 1, 3, 0].map((turn) => ((facing + turn) % 4) as DirIndex);
      for (const d of order) {
        const x = at.x + DIRS[d][0];
        const z = at.z + DIRS[d][1];
        if (ctx.grid.isFree(x, z)) return [x, z];
      }
      return null;
    };
    const farAway = (x: number, z: number) => {
      const c = ctx.state.cube ?? { x: 0, z: 0 };
      return Math.abs(x - c.x) + Math.abs(z - c.z) > 18 && leaders.offscreen(x, z);
    };

    /** What he builds next. The statue is built once and never again. */
    const nextProject = (): Project | null => {
      const canRecruit = everBuilt < MOST_EVER_BUILT;
      const men = followers().length;
      if (men < 2 && canRecruit) return 'soldier';
      if (!rocketSite.built) return 'pad';
      if (men < FOLLOWERS && canRecruit) return 'soldier';
      if (!monument.built) return 'statue';
      if (!flag.built) return 'flag';
      if (guards().length < GUARDS && canRecruit) return 'guard';
      if (tanks().length < TANKS && canRecruit) return 'tank';
      if (farAway(rocketSite.x, rocketSite.z)) return 'pad'; // the launch site moves with him
      return null;
    };

    /** The two guard posts: the camera-facing sides of the statue, looking outward. */
    const posts = (): { x: number; z: number; dir: DirIndex }[] =>
      [
        { x: monument.x + 1, z: monument.z, dir: 0 as DirIndex },
        { x: monument.x, z: monument.z + 1, dir: 1 as DirIndex },
        { x: monument.x - 1, z: monument.z, dir: 2 as DirIndex },
        { x: monument.x, z: monument.z - 1, dir: 3 as DirIndex },
      ].filter((p) => !(flag.built && p.x === flag.x && p.z === flag.z));

    function build(n: Npc, forced?: Project): void {
      const what = forced ?? nextProject();
      if (!what) return;
      if (what === 'statue') {
        if (monument.built) return; // there is only ever one
        const spot = freeNextTo(n, n.dir);
        if (!spot || !ctx.grid.claim(spot[0], spot[1], plinth)) return;
        Object.assign(monument, { built: true, x: spot[0], z: spot[1], age: 0 });
        statue.position.set(spot[0], 0, spot[1]);
        statue.visible = true;
        addLandmark(ctx, 'Statue', spot[0], spot[1]);
        for (const m of loyal()) m.n.order = 'salute'; // unveiling
        return;
      }
      if (what === 'flag') {
        if (flag.built || !monument.built) return;
        // Behind the statue as the camera sees it, so it never hides the thing it honours
        // and the two front sides stay free for the guards.
        const spot = ([[-1, 0], [0, -1], [0, 1], [1, 0]] as const)
          .map(([dx, dz]) => [monument.x + dx, monument.z + dz] as [number, number])
          .find(([x, z]) => ctx.grid.isFree(x, z));
        if (!spot || !ctx.grid.claim(spot[0], spot[1], flagpole)) return;
        Object.assign(flag, { built: true, x: spot[0], z: spot[1], age: 0, lowered: 0 });
        pole.position.set(spot[0], 0, spot[1]);
        pole.visible = true;
        return;
      }
      if (what === 'pad') {
        const spot = freeNextTo(n, n.dir);
        if (!spot) return;
        if (rocketSite.built) ctx.grid.release(rocketSite.x, rocketSite.z, pad);
        if (!ctx.grid.claim(spot[0], spot[1], pad)) return;
        Object.assign(rocketSite, { built: true, x: spot[0], z: spot[1], age: 0, phase: 'idle', t: 0, sinceLaunch: LAUNCH_EVERY - 7 });
        site.position.set(spot[0], 0, spot[1]);
        site.visible = true;
        return;
      }
      if (what === 'guard' && !monument.built) return;
      const spot = freeNextTo(n, n.dir);
      if (!spot) return;
      const recruit = soldiers.spawn(what === 'tank' ? 1 : 0, spot[0], spot[1], n.dir);
      if (!recruit) return;
      everBuilt += 1;
      recruit.n.lead = n;
      recruit.n.order = 'salute';
      recruit.rig.root.scale.setScalar(0.01); // pops up to full size below
      if (what === 'guard') {
        // Posted to the statue. He walks there himself and does not leave.
        const taken = guards().map((g) => `${g.n.post!.x},${g.n.post!.z}`);
        const open = posts().filter((p) => !taken.includes(`${p.x},${p.z}`));
        // A post nobody is standing on, for preference; failing that, he waits for one to clear.
        recruit.n.post = open.find((p) => ctx.grid.isFree(p.x, p.z, recruit.n.occ)) ?? open[0] ?? null;
      }
    }

    const launch = (outcome?: Outcome) => {
      if (!rocketSite.built || rocketSite.phase !== 'idle') return false;
      const roll = soldiers.world.rand();
      // The first one always fails. After that it works about one time in seven.
      rocketSite.outcome = outcome ?? (rocketSite.launches === 0 ? 'tip' : roll < 0.55 ? 'tip' : roll < 0.85 ? 'fizzle' : 'success');
      rocketSite.phase = 'countdown';
      rocketSite.t = 0;
      rocketSite.sinceLaunch = 0;
      rocketSite.launches += 1;
      return true;
    };

    // Drill: a salute that runs down the column, one soldier after the next.
    const pendingSalutes: { n: Npc; at: number }[] = [];
    let clock = 0;
    const drill = () => loyal().forEach((m, i) => pendingSalutes.push({ n: m.n, at: clock + i * 0.16 }));

    const alertGuards = () => {
      for (const g of guards()) {
        g.n.alert = GUARD_ALERT_SECONDS;
        g.n.emote = { kind: 'bang', t: 0 };
      }
      return guards().length;
    };

    // ---- The cube meddles --------------------------------------------------------
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant === plinth) {
        monument.wobble = 0;
        tip(alertGuards() ? 'You touched the statue. The guards saw.' : 'A gift from himself, to himself.');
      } else if (occupant === flagpole) {
        flag.lowered = 1;
        alertGuards();
        tip('Half mast. That was not on the schedule.');
      } else if (occupant === pad) {
        if (launch()) tip('You pressed the button. Unscheduled launch.');
      }
    });

    // Scripted control, for tests and video shots.
    ctx.events.on('direct:leader.build', () => (leaders.world.wantBuild = true));
    ctx.events.on<[Outcome?]>('direct:leader.launch', ([outcome]) => void launch(outcome));
    ctx.events.on('direct:leader.alarm', () => (soldiers.world.alarm = ALARM_SECONDS));
    ctx.events.on('direct:leader.drill', drill);
    for (const what of ['pad', 'statue', 'flag', 'guard', 'tank', 'soldier'] as const) {
      ctx.events.on(`direct:leader.${what === 'pad' ? 'site' : what}`, () => {
        const n = boss();
        if (n) build(n, what);
      });
    }
    ctx.events.on('direct:leader.clear', () => {
      for (const [thing, who, mesh] of [[rocketSite, pad, site], [monument, plinth, statue], [flag, flagpole, pole]] as const) {
        if (thing.built) ctx.grid.release(thing.x, thing.z, who);
        thing.built = false;
        mesh.visible = false;
      }
      rocketSite.phase = 'idle';
      everBuilt = 0;
      countdown.show(null, 0);
    });

    const popIn = (age: number) => {
      const k = Math.min(1, age / 0.35) - 1;
      return Math.max(0.001, 1 + k * k * (2.7 * k + 1.7));
    };

    let sinceBuild = BUILD_EVERY - 3;
    let sinceDrill = 6;
    let wasRiding = false;
    ctx.onUpdate((dt, time) => {
      clock += dt;
      const n = boss();
      if (!n) return;
      const staged = leaders.world.staged;
      army.tank = tanks().length > 0;
      army.followers = followers().length;
      army.guards = guards().length;

      // Time to build something?
      sinceBuild += dt;
      if (!staged && sinceBuild > BUILD_EVERY && nextProject()) {
        sinceBuild = 0;
        leaders.world.wantBuild = true;
      }

      // The column: followers and tanks take the places behind him, in order.
      // Guards are not in it, and neither is anyone the cube has recruited.
      let place = 0;
      for (const m of soldiers.members) {
        const full = isTank(m) ? 1 : SOLDIER_SCALE;
        const s = m.rig.root.scale.x;
        if (s < full) m.rig.root.scale.setScalar(Math.min(full, s + dt * 2.8));
        if (m.n.cult || m.n.post) continue;
        m.n.lead = n;
        m.n.slot = place++;
        if (!staged && Math.abs(m.n.x - n.x) + Math.abs(m.n.z - n.z) > 14 && leaders.offscreen(m.n.x, m.n.z)) {
          for (let tries = 0; tries < 8; tries++) {
            const x = n.x + Math.round((soldiers.world.rand() - 0.5) * 6);
            const z = n.z + Math.round((soldiers.world.rand() - 0.5) * 6);
            if (relocate(m.n, soldiers.world, x, z)) break;
          }
        }
      }

      // Drill, every so often, and a salute whenever he gets on a ride.
      sinceDrill += dt;
      const riding = n.mode === 'riding';
      if ((riding && !wasRiding) || (!staged && sinceDrill > DRILL_EVERY && loyal().length >= 2 && n.nx === null)) {
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
        monument.wobble += dt;
        statue.scale.setScalar(popIn(monument.age));
        // Bumped: it rocks on its plinth and settles.
        statue.rotation.z = Math.sin(monument.wobble * 22) * 0.09 * Math.exp(-monument.wobble * 4);
      }
      if (flag.built) {
        flag.age += dt;
        pole.scale.setScalar(popIn(flag.age));
        // Lowered flags creep back up on their own. Somebody is always watching the flag.
        flag.lowered = Math.max(0, flag.lowered - dt / 7);
        banner.position.y = flagTop - 0.3 - flag.lowered * 1.5;
        banner.rotation.y = -0.5 + Math.sin(time * 2.3) * 0.22 + Math.sin(time * 5.1) * 0.06;
      }

      // ---- The rocket ----
      if (!rocketSite.built) return;
      rocketSite.age += dt;
      site.scale.setScalar(popIn(rocketSite.age));
      const everyoneSalutes = () => loyal().forEach((m) => (m.n.order = 'salute'));

      if (rocketSite.phase === 'idle') {
        rocketSite.sinceLaunch += dt;
        if (!staged && rocketSite.sinceLaunch > LAUNCH_EVERY) launch();
        rocket.visible = true;
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
        n.order = 'fume';
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
          n.order = 'cheer';
          everyoneSalutes();
        }
        if (t > 6) rocketSite.phase = 'idle';
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
