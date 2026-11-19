import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import { addLandmark } from '../../core/landmarks';
import { seededRandom } from '../../core/rng';
import { tip } from '../../core/tip';
import type { SfxEvent, SfxKind } from '../../core/sound';
import { FIGHTER, floor, PRINZ_TEMPER, relocate, SONNY_TEMPER, type DirIndex } from '../../characters/brain';
import { createCast, everyone, type Member } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { box } from '../../characters/rig';
import { isWater, POOL, SHELF } from '../004-octopus';
import { buildFighter, buildFighterRig, PRINZ, SONNY, type FighterLook, type FighterRig } from './model';

/**
 * Two rival fighters, Sonny and Prinz. Most of the time they just live here: they wander
 * about, wave at people, and now and then run into each other (a glare, nothing more),
 * spar with a soldier, or trade looks with the leader. Very rarely, they fly off to the
 * pool and pick a fight with Gåmson: the first time after seven minutes or so, then
 * every ten to fifteen, and only when the cube is close enough to see it.
 *
 * A fight is shot like a film. Bars slide in top and bottom, a title card names the
 * fighters, and the camera leans in and follows the action. Every hit lands with a
 * jolt: the world freezes for a heartbeat on a punch, and big moments (a beam hitting
 * home, a stray beam smashing Gåmson's rock, Tåhgong's hug) play in slow motion.
 *
 * The show: they land, trade insults and power up; Gåmson rises from the pool, furious;
 * then a run of moves in a different order every time (dashing combos, his swats and
 * ink, charged beams, both of them rushing him at once, and the two of them forgetting
 * him to fight each other). A stray beam smashes his rock, sending everything he stole
 * home, and Tåhgong comes to the rescue with a hug so big it blows them back. They bow,
 * and fly off. The tank takes a shot at them, and anyone standing too close gets knocked
 * flat. The cube can join in: bump a fighter on the ground twice and they leave early,
 * impressed, and the cube earns a charm.
 */

type Pose =
  | 'stand' | 'guard' | 'fly' | 'dash' | 'windup' | 'punch' | 'punch2' | 'kick' | 'charge' | 'fire'
  | 'hurt' | 'tumble' | 'cross' | 'power' | 'bow' | 'point' | 'land';

/** A flight from one spot to another, timed on the fight's clock. */
interface Leg {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number;
  dur: number;
  arc: number;
  ease: (k: number) => number;
}

interface Fighter {
  rig: FighterRig;
  look: FighterLook;
  name: string;
  index: number;
  pos: THREE.Vector3;
  face: number;
  pose: Pose;
  poseT: number;
  /** 0 to 1: aura and glowing hair. */
  power: number;
  /** Seconds of being dazed after a bump from the cube. */
  stun: number;
  /** Seconds left crouched after landing. */
  landT: number;
  /** Where they are flying to, if anywhere. */
  leg: Leg | null;
  /** Head-over-heels rotation while tumbling; settles on a whole turn after. */
  spin: number;
  /** The whole turn the current tumble started from. */
  spin0: number;
  /** Home spots: on the shore, in the air above the pool, and right beside Gåmson. */
  shore: THREE.Vector3;
  air: THREE.Vector3;
  close: THREE.Vector3;
  emote: THREE.Sprite;
  emoteKind: 'bang' | 'heart' | 'sparkle' | 'q' | 'anger' | null;
  emoteAge: number;
  /** For afterimages: where they were last frame, and when the last one was left. */
  last: THREE.Vector3;
  ghostIn: number;
}

interface Beat {
  name: string;
  dur: number;
  start?(): void;
  tick(t: number, prev: number): void;
  /** Where the camera should look during this beat, if not at the fighters. */
  focus?(): { x: number; z: number } | null;
}

interface OctopusAPI {
  x: number;
  z: number;
  mode: string;
  carrying: string[];
  busy: boolean;
  provoke(s: number): void;
  hit(): void;
  swat(angle: number): void;
  inkAt(x: number, z: number): void;
  face(angle: number): void;
  scatter(): number;
  calm?: () => boolean;
}

/** Rare: the first fight after seven minutes or so, then one every ten to fifteen. */
const FIRST_FIGHT = 420;
const NEXT_FIGHT = [600, 900] as const;
/** The cube has to be this close (in cells) to the pool for a fight to start. */
const WITNESS = 26;
/** Gåmson, as a target: his head, just above the water. */
const G = new THREE.Vector3(POOL.x, 0.7, POOL.z);
/** The middle of the action, for the camera. */
const FIGHT = { x: POOL.x + 0.5, z: POOL.z + 1.8 };
/** Within this many cells of the fight, the cube is watching: the bars come in. */
const WATCH = 16;
/** How much closer the camera gets for a fight seen up close. */
const CLOSE_UP = 1.22;
const TAU = Math.PI * 2;

// Easing.
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const inOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const outQuart = (k: number) => 1 - (1 - k) ** 4;
const inQuad = (k: number) => k * k;
const outQuad = (k: number) => 1 - (1 - k) * (1 - k);
const smooth = (k: number) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};

export const rivals: Feature = {
  meta: {
    id: '006-rivals',
    day: 6,
    title: 'Two rival fighters pick fights with Gåmson',
    credit: { username: 'ancientpro_gamer', text: 'Add goku and Vegeta fighting with octopus', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x6ff);
    // Day to day: two ordinary residents who wander about between the park and the pool.
    const residents = createCast(ctx, {
      key: 'fighters', persona: FIGHTER, personaOf: (look) => (look.name === 'Prinz' ? PRINZ_TEMPER : SONNY_TEMPER),
      variants: [SONNY, PRINZ], build: buildFighterRig, count: 2, seedSalt: 0x5a1,
      onEvent(event, n) {
        const c = ctx.state.cube as { x: number; z: number } | undefined;
        if (!c || Math.abs(c.x - n.x) + Math.abs(c.z - n.z) > 14) return;
        if (event === 'respect') tip('Sonny respects the cube now. Worthy opponent.');
        if (event === 'stormed') tip('Prinz stormed off. He will remember this.');
      },
      home: { x: POOL.x - 6, z: POOL.z - 8 },
      bow: ['#f6a8c4', '#ee6fa4'],
    });
    const resident = (name: string): Member | undefined => residents.members.find((m) => m.rig.identity.trim === (name === 'Sonny' ? SONNY.top : PRINZ.top));
    /** Off to the fight: up into the sky from wherever they are, and out of the way meanwhile. */
    const away = new Set<Member>();
    const goAway = (m: Member, i: number) => {
      const from = new THREE.Vector3(m.n.x, 0.5, m.n.z);
      streak(i, from, from.clone().add(new THREE.Vector3(0, 14, -4)));
      dust(m.n.x, m.n.z, 0.9, i ? PRINZ.aura : SONNY.aura);
      // Halfway through a step: finish it on the spot first.
      if (m.n.nx !== null && m.n.nz !== null) {
        ctx.grid.release(m.n.x, m.n.z, m.n.occ);
        Object.assign(m.n, { x: m.n.nx, z: m.n.nz, nx: null, nz: null, p: 0 });
      }
      m.n.mode = 'idle';
      for (let k = 0; k < 40; k++) {
        if (relocate(m.n, m.world, -60 + i * 3, -200 - k)) break;
      }
      // And they stay put out there: nobody wanders while they are away.
      m.n.timer = 1e9;
      m.rig.root.visible = false;
      m.world.staged = true;
      away.add(m);
    };
    /** Back from the fight: down where they left the fight, and on with their day. */
    const comeBack = (m: Member, at: THREE.Vector3) => {
      if (m.n.nx !== null && m.n.nz !== null) {
        ctx.grid.release(m.n.x, m.n.z, m.n.occ);
        Object.assign(m.n, { x: m.n.nx, z: m.n.nz, nx: null, nz: null, p: 0 });
      }
      for (let r = 0; r < 6 && away.has(m); r++) {
        for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
          if (isWater(Math.round(at.x) + dx, Math.round(at.z) + dz)) continue;
          m.n.mode = 'idle';
          if (relocate(m.n, m.world, Math.round(at.x) + dx, Math.round(at.z) + dz)) {
            away.delete(m);
            break;
          }
        }
      }
      m.rig.root.visible = true;
      m.world.staged = false;
      Object.assign(m.n, { timer: 2, emote: { kind: 'sparkle', t: 0 } });
    };
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // ---- The fighters' fight bodies, and their afterimages --------------------------------
    const GHOSTS = 4;
    const ghostsOf = (rig: FighterRig, color: string) =>
      Array.from({ length: GHOSTS }, () => {
        const wrap = new THREE.Group();
        wrap.scale.copy(rig.root.scale);
        const body = rig.body.clone(true);
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
        body.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.material = m;
            mesh.castShadow = false;
          }
        });
        wrap.add(body);
        wrap.visible = false;
        ctx.scene.add(wrap);
        const src: THREE.Object3D[] = [];
        const dst: THREE.Object3D[] = [];
        rig.body.traverse((o) => src.push(o));
        body.traverse((o) => dst.push(o));
        return { wrap, m, src, dst, age: 9 };
      });
    const ghosts = new Map<Fighter, ReturnType<typeof ghostsOf>>();
    const leaveGhost = (f: Fighter) => {
      const list = ghosts.get(f)!;
      const g = list.reduce((a, b) => (a.age > b.age ? a : b));
      g.wrap.position.copy(f.rig.root.position);
      g.wrap.rotation.copy(f.rig.root.rotation);
      for (let i = 0; i < g.src.length; i++) {
        g.dst[i].position.copy(g.src[i].position);
        g.dst[i].quaternion.copy(g.src[i].quaternion);
        g.dst[i].scale.copy(g.src[i].scale);
      }
      g.age = 0;
      g.wrap.visible = true;
    };

    const makeFighter = (look: FighterLook, index: number, shore: THREE.Vector3, air: THREE.Vector3, close: THREE.Vector3): Fighter => {
      const rig = buildFighter(look);
      rig.root.visible = false;
      ctx.scene.add(rig.root);
      const emote = makeSymbolSprite();
      emote.position.set(0, 2.6, 0);
      rig.root.add(emote);
      const f: Fighter = {
        rig, look, name: look.name, index, pos: shore.clone(), face: 0, pose: 'stand', poseT: 0, power: 0, stun: 0, landT: 0,
        leg: null, spin: 0, spin0: 0, shore, air, close, emote, emoteKind: null, emoteAge: 9, last: shore.clone(), ghostIn: 0,
      };
      ghosts.set(f, ghostsOf(rig, look.aura));
      // An army helmet, worn into the fight if the leader has drafted them.
      const helmet = new THREE.Group();
      helmet.name = 'helmet';
      box(helmet, '#6f7752', 0.62, 0.2, 0.6, 0, 0.57, -0.01);
      box(helmet, '#565d40', 0.68, 0.05, 0.66, 0, 0.47, -0.01);
      box(helmet, '#d6b24a', 0.08, 0.08, 0.014, 0, 0.57, 0.3);
      helmet.visible = false;
      rig.head.add(helmet);
      return f;
    };
    // Both on the near side of the pool, so the whole fight fits on screen: Sonny on the
    // west sand, Prinz on the east, hovering over the shallows, striking beside the den.
    const sonny = makeFighter(SONNY, 0, v(POOL.x - 4.5, 0, POOL.z + 2.5), v(POOL.x - 2.5, 2.0, POOL.z + 1.5), v(POOL.x - 1.1, 0.7, POOL.z + 0.8));
    const prinz = makeFighter(PRINZ, 1, v(POOL.x + 3, 0, POOL.z + 2.5), v(POOL.x + 2, 2.2, POOL.z + 1.2), v(POOL.x + 1.1, 0.7, POOL.z + 0.8));
    const both = [sonny, prinz];
    const say = (f: Fighter, kind: Fighter['emoteKind']) => Object.assign(f, { emoteKind: kind, emoteAge: 0 });

    const state = { fighting: false, fights: 0, cubeHits: 0, beat: '', staged: false, nextIn: FIRST_FIGHT, sounds: 0, music: false, beatT: 0, hugged: false };
    ctx.state.rivals = state;
    const mark = addLandmark(ctx, { name: 'Fight!', x: POOL.x, z: POOL.z - 3, color: '#f2542d', hidden: true });
    const octopus = () => ctx.state.octopus as OctopusAPI | undefined;
    const water = () => ctx.state.water as { splash(x: number, z: number, s?: number): void; ripple(x: number, z: number, s?: number): void } | undefined;
    const cubeAt = () => ctx.state.cube as { x: number; z: number } | undefined;
    const cubeNear = (cells = WITNESS) => {
      const c = cubeAt();
      return !!c && Math.abs(c.x - POOL.x) + Math.abs(c.z - POOL.z) <= cells;
    };
    /** The cube is close enough to be watching: the film treatment is on. */
    const watching = () => {
      const c = cubeAt();
      return state.fighting && !!c && Math.hypot(c.x - FIGHT.x, c.z - FIGHT.z) < WATCH;
    };
    const say2 = (text: string, urgent = false) => cubeNear() && tip(text, 4, { urgent });

    // ---- The film treatment: bars, a title card, slow motion, a camera that moves --------
    let speed = 1;
    const cinema = document.createElement('div');
    cinema.className = 'cinema';
    cinema.setAttribute('aria-hidden', 'true');
    cinema.innerHTML =
      '<div class="bar top"></div><div class="bar bottom"></div>' +
      '<div class="vs"><span class="a">Sonny</span><span class="amp">&amp;</span><span class="b">Prinz</span>' +
      '<i>vs</i><span class="c">Gåmson</span></div>';
    document.body.appendChild(cinema);
    const vsCard = cinema.querySelector('.vs') as HTMLElement;
    let cinemaOn = false;
    const setCinema = (on: boolean) => {
      if (on === cinemaOn) return;
      cinemaOn = on;
      document.body.classList.toggle('cinema-on', on);
      if (on) sfx('bars');
      if (!on) vsCard.classList.remove('show');
    };
    const showTitle = () => {
      vsCard.classList.remove('show');
      void vsCard.offsetWidth; // restart the animation
      vsCard.classList.add('show');
      sfx('stinger');
    };
    /** Slow the world (only for a real fight being watched, never in a sped-up test). */
    const slow = (scale: number, seconds: number) => {
      if (speed !== 1 || !watching()) return;
      ctx.slowmo(scale, seconds);
      if (seconds >= 0.4) sfx('slowmo', null, { gain: 0.8 });
    };
    /** A punch landing: the world all but stops for a heartbeat. */
    const freeze = (seconds = 0.07) => slow(0.05, seconds);
    let kick = 0;
    /** The camera leans in a little more, for a moment. */
    const punchIn = (amount: number) => (kick = Math.max(kick, amount));
    const shake = (strength: number) => watching() && ctx.shake(strength);
    /**
     * A sound, panned to where it happens on screen. Full volume when the cube is watching,
     * quieter from further off, and nothing at all from across the map.
     */
    const sfx = (kind: SfxKind, at?: THREE.Vector3 | null, o: Partial<SfxEvent> = {}) => {
      const near = watching() ? 1 : cubeNear() ? 0.35 : 0;
      if (!near) return;
      let pan = 0;
      if (at) pan = Math.max(-0.8, Math.min(0.8, at.clone().project(ctx.camera).x * 0.8));
      ctx.events.emit('sfx', { kind, pan, ...o, gain: (o.gain ?? 1) * near });
      state.sounds += 1;
    };
    let musicOn = false;
    const music = (on: boolean) => {
      if (on === musicOn) return;
      musicOn = on;
      state.music = on;
      ctx.events.emit('sfx:music', on);
    };

    // ---- Effects: dust rings, shock rings, flashes, sparks, hearts, streaks, beams --------
    const rings = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32), new THREE.MeshBasicMaterial({ color: '#e7dccb', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      ctx.scene.add(m);
      return { m, age: 9, size: 1 };
    });
    let nextRing = 0;
    const dust = (x: number, z: number, size = 1, color = '#e7dccb', y = 0.03) => {
      const r = rings[nextRing++ % rings.length];
      (r.m.material as THREE.MeshBasicMaterial).color.set(color);
      r.m.position.set(x, y, z);
      Object.assign(r, { age: 0, size });
    };
    // A ring facing the camera: the shock of two fists meeting.
    const shocks = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1, 40),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      m.visible = false;
      ctx.scene.add(m);
      return { m, age: 9, size: 1 };
    });
    let nextShock = 0;
    const shock = (p: THREE.Vector3, size = 1, color = '#ffffff') => {
      const s = shocks[nextShock++ % shocks.length];
      (s.m.material as THREE.MeshBasicMaterial).color.set(color);
      s.m.position.copy(p);
      Object.assign(s, { age: 0, size });
    };
    const flashes = Array.from({ length: 5 }, () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.visible = false;
      ctx.scene.add(m);
      return { m, age: 9, size: 1 };
    });
    let nextFlash = 0;
    const flash = (p: THREE.Vector3, size = 1) => {
      const f = flashes[nextFlash++ % flashes.length];
      f.m.position.copy(p);
      Object.assign(f, { age: 0, size });
    };
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const sparkMats = new Map<string, THREE.MeshBasicMaterial>();
    const sparkMat = (color: string) => {
      let m = sparkMats.get(color);
      if (!m) sparkMats.set(color, (m = new THREE.MeshBasicMaterial({ color })));
      return m;
    };
    const sparks = Array.from({ length: 80 }, () => {
      const m = new THREE.Mesh(sparkGeo, sparkMat('#ffffff'));
      m.visible = false;
      ctx.scene.add(m);
      return { m, v: new THREE.Vector3(), age: 9, life: 0.5, g: 9, size: 1 };
    });
    let nextSpark = 0;
    const spawnSpark = (p: THREE.Vector3, vel: THREE.Vector3, color: string, life: number, g: number, size: number) => {
      const s = sparks[nextSpark++ % sparks.length];
      s.m.material = sparkMat(color);
      s.m.position.copy(p);
      s.m.visible = true;
      s.v.copy(vel);
      Object.assign(s, { age: 0, life, g, size });
    };
    /** A burst of sparks flying out from a hit. */
    const burst = (p: THREE.Vector3, color: string, n = 12, speedK = 3.2) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU;
        const up = rand() * 1.4 - 0.2;
        const sp = speedK * (0.5 + rand() * 0.8);
        spawnSpark(p, v(Math.cos(a) * sp, up * sp + 1.2, Math.sin(a) * sp), i % 3 ? color : '#ffffff', 0.35 + rand() * 0.3, 9, 0.8 + rand() * 0.8);
      }
    };
    /** Energy being drawn in to a point (a beam charging). */
    const drawIn = (p: THREE.Vector3, color: string, n = 2, radius = 0.9) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU;
        const b = (rand() - 0.5) * Math.PI;
        const from = p.clone().add(v(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).multiplyScalar(radius));
        const life = 0.28 + rand() * 0.1;
        spawnSpark(from, p.clone().sub(from).divideScalar(life), color, life, 0, 0.7);
      }
    };
    /** Energy rising off someone powering up. */
    const riseOff = (f: Fighter, n = 2) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU;
        const r = 0.35 + rand() * 0.25;
        spawnSpark(f.pos.clone().add(v(Math.cos(a) * r, 0.1 + rand() * 0.6, Math.sin(a) * r)), v(0, 1.8 + rand() * 1.6, 0), rand() < 0.3 ? '#ffffff' : f.look.aura, 0.6, -1, 0.7);
      }
    };
    const hearts = Array.from({ length: 12 }, () => {
      const s = makeSymbolSprite();
      s.visible = false;
      ctx.scene.add(s);
      return { s, age: 9, dir: new THREE.Vector3() };
    });
    const heartBurst = (p: THREE.Vector3) => {
      hearts.forEach((h, i) => {
        const a = (i / hearts.length) * TAU;
        h.dir.set(Math.cos(a) * 3, 1.2 + (i % 3) * 0.6, Math.sin(a) * 3);
        h.s.position.copy(p);
        h.s.visible = true;
        h.age = 0;
      });
    };
    const streaks = both.map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false;
      ctx.scene.add(m);
      return { m, age: 9 };
    });
    const streak = (i: number, from: THREE.Vector3, to: THREE.Vector3) => {
      const s = streaks[i];
      s.m.position.copy(from).lerp(to, 0.5);
      s.m.scale.set(1, 1, from.distanceTo(to));
      s.m.lookAt(to);
      (s.m.material as THREE.MeshBasicMaterial).color.set(i ? PRINZ.aura : SONNY.aura);
      s.age = 0;
    };
    // Beams, in the world: a white-hot core in a coloured glow, shooting out from the hands,
    // and a flare where they hit.
    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    beamGeo.translate(0, 0, 0.5);
    const makeBeam = () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      const glow = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(core, glow);
      g.visible = false;
      ctx.scene.add(g);
      const flare = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      flare.visible = false;
      ctx.scene.add(flare);
      return { g, core, glow, flare, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, off: -1, width: 1, on: false };
    };
    type BeamFX = ReturnType<typeof makeBeam>;
    const beams = [makeBeam(), makeBeam(), makeBeam()];
    const fire = (b: BeamFX, from: THREE.Vector3, to: THREE.Vector3, color: string, width = 1) => {
      b.from.copy(from);
      b.to.copy(to);
      (b.glow.material as THREE.MeshBasicMaterial).color.set(color);
      (b.flare.material as THREE.MeshBasicMaterial).color.set(color);
      Object.assign(b, { age: 0, off: -1, width, on: true });
      b.g.visible = true;
    };
    const cease = (b: BeamFX) => b.on && b.off < 0 && (b.off = 0);
    /** Where a fighter's hands are when they fire: out in front, at shoulder height. */
    const hands = (f: Fighter) => f.pos.clone().add(v(Math.sin(f.face) * 0.5, 1.12, Math.cos(f.face) * 0.5));
    const chest = (f: Fighter) => f.pos.clone().setY(f.pos.y + 1.0);
    /** A punch (or kick) landing on something: flash, sparks, a jolt, and a freeze. */
    const landHit = (p: THREE.Vector3, color: string, big = false) => {
      sfx(big ? 'heavy' : 'punch', p, { pitch: 0.9 + rand() * 0.25 });
      flash(p, big ? 0.9 : 0.5);
      burst(p, color, big ? 16 : 7, big ? 3.6 : 2.4);
      if (big) shock(p, 0.9, color);
      ctx.bump(big ? 0.16 : 0.07);
      shake(big ? 0.12 : 0.04);
      freeze(big ? 0.09 : 0.045);
      if (big) punchIn(0.1);
    };

    /** Something heavy lands: a dust ring (or a splash), a jolt, and anyone close is knocked flat. */
    const impact = (x: number, z: number, strength = 1) => {
      const at = v(x, 0.3, z);
      if (isWater(Math.round(x), Math.round(z))) sfx('splash', at, { gain: 0.6 + 0.4 * strength });
      else sfx(strength >= 1 ? 'boom' : 'land', at, { gain: 0.5 + 0.5 * Math.min(1, strength) });
      if (isWater(Math.round(x), Math.round(z))) water()?.splash(x, z, strength);
      else {
        dust(x, z, 1.2 * strength);
        dust(x, z, 0.7 * strength);
      }
      ctx.bump(0.18 * strength);
      shake(0.06 * strength);
      for (const m of everyone(ctx)) {
        if (Math.hypot(m.n.x - x, m.n.z - z) <= 1.6 * strength) floor(m.n, m.world);
      }
    };

    // ---- Moving them about ---------------------------------------------------------------
    let clockT = 0;
    /** Fly from wherever they are to a spot, over some seconds, maybe in an arc. */
    const moveTo = (f: Fighter, to: THREE.Vector3, dur: number, arc = 0, ease = inOut) => {
      f.leg = { from: f.pos.clone(), to: to.clone(), t0: clockT, dur, arc, ease };
      f.spin0 = Math.round(f.spin / TAU) * TAU;
    };
    const onLand = (f: Fighter, fall: number) => {
      f.landT = fall > 2 ? 0.38 : 0.24;
      impact(f.pos.x, f.pos.z, fall > 4 ? 1.1 : fall > 1 ? 0.8 : 0.45);
    };
    const runLeg = (f: Fighter) => {
      const l = f.leg;
      if (!l) return;
      const k = clamp01((clockT - l.t0) / l.dur);
      f.pos.copy(l.from).lerp(l.to, l.ease(k));
      f.pos.y += Math.sin(Math.PI * k) * l.arc;
      if (k >= 1) {
        f.leg = null;
        if (l.to.y < 0.05 && l.from.y + l.arc > 0.4) onLand(f, l.from.y + l.arc);
      }
    };
    const faceTo = (f: Fighter, p: { x: number; z: number }) => (f.face = Math.atan2(p.x - f.pos.x, p.z - f.pos.z));
    const pose = (f: Fighter, p: Pose) => {
      if (f.pose !== p) Object.assign(f, { pose: p, poseT: 0 });
    };
    const at = (t: number, prev: number, x: number) => prev < x && t >= x;
    const sky = (f: Fighter) => f.shore.clone().add(v(f.index ? 4 : -4, 14, -6));
    const toG = (f: Fighter) => Math.atan2(f.pos.x - POOL.x, f.pos.z - POOL.z);

    // ---- The beats ------------------------------------------------------------------------
    const arrive: Beat = {
      name: 'arrive', dur: 3.6,
      start() {
        both.forEach((f) => {
          f.rig.root.visible = true;
          f.power = 0;
          f.leg = null;
          f.pos.copy(sky(f));
          f.last.copy(f.pos);
          f.rig.root.position.copy(f.pos);
          faceTo(f, G);
        });
        if (watching()) showTitle();
        say2('Two fighters just dropped out of the sky next to Gåmson’s pool.', true);
        const awol = both.filter((f) => resident(f.name)?.n.drafted).map((f) => f.name);
        if (awol.length) say2(`${awol.join(' and ')} ${awol.length > 1 ? 'are' : 'is'} supposed to be on army duty right now.`);
      },
      tick(t, prev) {
        both.forEach((f, i) => {
          const t0 = 0.3 + i * 0.6;
          if (t < t0 + 0.8) pose(f, 'fly');
          else pose(f, 'stand');
          if (at(t, prev, t0)) {
            moveTo(f, f.shore, 0.8, 0, inQuad);
            streak(i, f.pos.clone(), f.shore);
            sfx('whoosh', f.shore, { dur: 0.8, pitch: 0.7 });
          }
          faceTo(f, G);
        });
        // Prinz's landing, in slow motion.
        if (at(t, prev, 0.3 + 0.6 + 0.66)) slow(0.3, 0.45);
      },
      focus: () => ({ x: (sonny.shore.x + prinz.shore.x) / 2, z: sonny.shore.z }),
    };
    const taunt: Beat = {
      name: 'taunt', dur: 2.8,
      start() {
        const o = octopus();
        o?.provoke(60);
        o?.face(toG(sonny));
        say(sonny, 'bang');
      },
      tick(t, prev) {
        pose(sonny, t < 1.4 ? 'point' : 'guard');
        pose(prinz, 'cross');
        faceTo(sonny, G);
        faceTo(prinz, t < 1.4 ? sonny.pos : G);
        if (at(t, prev, 1.4)) {
          say(prinz, 'anger');
          octopus()?.face(toG(prinz));
        }
      },
    };
    const powerUp: Beat = {
      name: 'power', dur: 3.4,
      start() {
        say2('They are powering up…');
        punchIn(0.06);
        sfx('power', null, { dur: 2.4 });
        sfx('rumble', null, { dur: 2.6 });
      },
      tick(t, prev) {
        both.forEach((f) => {
          pose(f, 'power');
          f.power = smooth(t / 2.4);
          if (t < 2.4 && Math.floor(t / 0.06) !== Math.floor(prev / 0.06)) riseOff(f, 1 + Math.floor(t));
        });
        for (const k of [0.6, 1.2, 1.8]) if (at(t, prev, k)) {
          ctx.bump(0.06 + k * 0.03);
          shake(0.02 + k * 0.02);
        }
        if (at(t, prev, 2.4)) {
          both.forEach((f) => {
            dust(f.pos.x, f.pos.z, 1.8, f.look.aura);
            dust(f.pos.x, f.pos.z, 1.1, '#ffffff');
            shock(chest(f), 1.3, f.look.aura);
            burst(chest(f), f.look.aura, 12, 3);
          });
          shake(0.16);
          punchIn(0.14);
          sfx('boom', null);
          sfx('crack', null, { gain: 0.8 });
          slow(0.35, 0.4);
        }
      },
    };
    /** Dash in, jab and cross, hop back up. */
    const combo = (f: Fighter): Beat => ({
      name: `punch:${f.name}`, dur: 2.5,
      tick(t, prev) {
        faceTo(f, G);
        if (t < 0.3) pose(f, 'windup');
        if (at(t, prev, 0.3)) {
          streak(f.index, f.pos.clone(), f.close);
          moveTo(f, f.close, 0.16, 0, outQuart);
          sfx('dash', f.pos);
        }
        if (t >= 0.3 && t < 0.48) pose(f, 'dash');
        if (at(t, prev, 0.48)) landHit(G.clone().setY(0.95), f.look.aura);
        if (t >= 0.48 && t < 0.72) pose(f, 'punch');
        if (at(t, prev, 0.72)) {
          octopus()?.hit();
          landHit(G.clone().setY(0.9), f.look.aura, true);
        }
        if (t >= 0.72 && t < 1.25) pose(f, 'punch2');
        if (t >= 1.25 && t < 1.45) pose(f, 'guard');
        if (at(t, prev, 1.45)) moveTo(f, f.air, 0.8, 0.5);
        if (t >= 1.45) pose(f, f.leg ? 'fly' : 'guard');
      },
      focus: () => ({ x: (f.pos.x + POOL.x) / 2, z: (f.pos.z + POOL.z) / 2 + 0.6 }),
    });
    /** Both of them at once: a flurry of punches and kicks, until he swats them away. */
    const flurry: Beat = {
      name: 'flurry', dur: 3.8,
      start() {
        say2('Both of them at once!');
        both.forEach((f) => {
          streak(f.index, f.pos.clone(), f.close);
          moveTo(f, f.close, 0.32, 0, outQuart);
          sfx('dash', f.pos, { pitch: f.index ? 1.1 : 0.9 });
        });
      },
      tick(t, prev) {
        const hits: [number, Fighter, Pose][] = [
          [0.45, sonny, 'punch'], [0.62, prinz, 'punch'], [0.79, sonny, 'punch2'], [0.96, prinz, 'kick'],
          [1.13, sonny, 'kick'], [1.3, prinz, 'punch2'], [1.5, sonny, 'punch'],
        ];
        both.forEach((f) => faceTo(f, G));
        if (t < 0.42) both.forEach((f) => pose(f, 'dash'));
        else if (t < 1.75) {
          both.forEach((f) => {
            const mine = hits.filter(([h, who]) => who === f && t >= h && t < h + 0.16);
            pose(f, mine.length ? mine[0][2] : 'guard');
          });
        }
        hits.forEach(([h, who], i) => {
          if (at(t, prev, h)) {
            landHit(G.clone().setY(0.85 + (i % 2) * 0.15).add(v(who === sonny ? -0.2 : 0.2, 0, 0.2)), who.look.aura, i === hits.length - 1);
            if (i === 3 || i === hits.length - 1) octopus()?.hit();
          }
        });
        if (at(t, prev, 1.68)) {
          octopus()?.swat(toG(sonny));
          sfx('swat', G, { gain: 1.2 });
        }
        if (at(t, prev, 1.75)) {
          both.forEach((f) => {
            landHit(chest(f), '#ffffff');
            say(f, 'bang');
            moveTo(f, f.shore, 0.95, 1.8, outQuad);
          });
          sfx('whoosh', G, { dur: 0.9, pitch: 0.6 });
          slow(0.3, 0.5);
          shake(0.16);
          punchIn(0.12);
        }
        if (t >= 1.75 && t < 2.7) both.forEach((f) => pose(f, 'tumble'));
        if (t >= 2.7) both.forEach((f) => pose(f, t < 3.1 ? 'hurt' : 'guard'));
      },
      focus: () => ({ x: POOL.x, z: POOL.z + 1.2 }),
    };
    const swat = (f: Fighter): Beat => ({
      name: `swat:${f.name}`, dur: 2.9,
      tick(t, prev) {
        if (at(t, prev, 0.01)) {
          moveTo(f, f.close, 0.55, 0.3, inQuad);
          sfx('whoosh', f.pos, { dur: 0.55 });
        }
        if (t < 0.68) {
          pose(f, t < 0.15 ? 'windup' : 'dash');
          faceTo(f, G);
        }
        if (at(t, prev, 0.58)) {
          octopus()?.swat(toG(f));
          sfx('swat', G);
        }
        if (at(t, prev, 0.68)) {
          landHit(chest(f), '#ffffff', true);
          say(f, 'bang');
          moveTo(f, f.shore, 1.0, 2.2, outQuad);
          sfx('whoosh', f.pos, { dur: 1.0, pitch: 0.6 });
        }
        if (t >= 0.68 && t < 1.7) pose(f, 'tumble');
        if (t >= 1.7) {
          pose(f, t < 2.3 ? 'hurt' : 'guard');
          faceTo(f, G);
        }
      },
    });
    const inked = (f: Fighter): Beat => {
      let anchor = f.shore.clone();
      return {
        name: `ink:${f.name}`, dur: 2.9,
        start() {
          if (f.pos.distanceTo(f.shore) > 0.1) moveTo(f, f.shore, 0.45, f.pos.y > 0.3 ? 0.2 : 0.3);
          octopus()?.face(Math.atan2(f.shore.x - POOL.x, f.shore.z - POOL.z));
        },
        tick(t, prev) {
          if (t < 0.5) {
            pose(f, f.leg ? 'fly' : 'guard');
            faceTo(f, G);
          }
          if (at(t, prev, 0.5)) {
            f.leg = null;
            anchor = f.pos.clone();
            octopus()?.inkAt(f.pos.x, f.pos.z);
            sfx('ink', f.pos);
            say(f, 'q');
            dust(f.pos.x, f.pos.z, 0.9, '#1d1b19');
            burst(chest(f), '#1d1b19', 10, 2);
          }
          if (t > 0.5 && t < 2.2) {
            // Blinded: staggering round in a little circle, arms out.
            pose(f, 'hurt');
            const a = (t - 0.5) * 3.4;
            const fade = smooth((2.2 - t) / 0.3);
            f.pos.set(anchor.x + Math.sin(a) * 0.5 * fade, 0, anchor.z + (1 - Math.cos(a)) * 0.3 * fade);
            const want = Math.atan2(Math.cos(a), Math.sin(a)) - f.face;
            f.face += Math.atan2(Math.sin(want), Math.cos(want)) * 0.25;
          }
          if (at(t, prev, 2.2)) moveTo(f, f.shore, 0.4);
          if (t >= 2.2) {
            pose(f, 'guard');
            faceTo(f, G);
          }
        },
      };
    };
    const beam = (f: Fighter, size = 1): Beat => ({
      name: `beam:${f.name}`, dur: 3.7,
      start() {
        moveTo(f, f.air, 0.5, 0.2);
      },
      tick(t, prev) {
        faceTo(f, G);
        const ball = f.rig.ball;
        if (t < 0.5) pose(f, 'fly');
        if (at(t, prev, 0.5)) sfx('charge', f.pos, { dur: 1.3 });
        if (t >= 0.5 && t < 1.8) {
          pose(f, 'charge');
          const k = (t - 0.5) / 1.3;
          ball.visible = true;
          ball.scale.setScalar((0.4 + k * 1.4 * size) * (1 + Math.sin(t * 40) * 0.08));
          ball.position.set(0.35, 1.15, 0.1);
          if (Math.floor(t / 0.05) !== Math.floor(prev / 0.05)) {
            drawIn(ball.getWorldPosition(new THREE.Vector3()), f.look.aura, 1 + Math.floor(k * 2));
            f.power = Math.max(f.power, 0.8 + k * 0.2);
          }
          if (Math.floor(t / 0.3) !== Math.floor(prev / 0.3)) shake(0.015 + k * 0.03);
        }
        if (at(t, prev, 1.8)) {
          ball.visible = false;
          fire(beams[f.index], hands(f), G, f.look.aura, size);
          sfx('beam', f.pos, { dur: 0.85, pitch: f.index ? 1.12 : 1 });
          // The kick of it pushes them back a little.
          moveTo(f, f.air.clone().add(v(Math.sin(f.face) * -0.35, 0.05, Math.cos(f.face) * -0.35)), 0.3, 0, outQuad);
        }
        if (at(t, prev, 1.88)) {
          octopus()?.hit();
          water()?.splash(G.x, G.z, 2);
          sfx('boom', G);
          sfx('splash', G);
          flash(G.clone().setY(0.9), 1.4 * size);
          burst(G.clone().setY(0.9), f.look.aura, 20, 4);
          shock(G.clone().setY(0.9), 1.4 * size, f.look.aura);
          ctx.bump(0.4 * size);
          shake(0.22 * size);
          punchIn(0.16);
          slow(0.3, 0.55);
        }
        if (t >= 1.8 && t < 2.65) {
          pose(f, 'fire');
          beams[f.index].from.copy(hands(f));
        }
        if (at(t, prev, 2.65)) cease(beams[f.index]);
        if (t >= 2.65) pose(f, 'guard');
      },
      focus: () => ({ x: (f.pos.x + POOL.x) / 2, z: (f.pos.z + POOL.z) / 2 + 0.5 }),
    });
    const clash: Beat = {
      name: 'clash', dur: 3.6,
      start() {
        say2('They’ve forgotten Gåmson and started fighting each other.');
        both.forEach((f, i) => moveTo(f, meet(i ? 1 : -1), 0.6, 0.4, inOut));
        both.forEach((f) => sfx('whoosh', f.pos, { dur: 0.62 }));
      },
      tick(t, prev) {
        const mid = MID;
        if (t < 0.62) both.forEach((f, i) => {
          pose(f, t < 0.4 ? 'fly' : 'dash');
          faceTo(f, both[1 - i].pos);
        });
        if (at(t, prev, 0.62)) {
          sfx('crack', mid);
          sfx('heavy', mid);
          flash(mid, 1.2);
          shock(mid, 1.3);
          burst(mid, '#ffffff', 14, 3.4);
          ctx.bump(0.25);
          shake(0.18);
          punchIn(0.12);
          freeze(0.14);
          both.forEach((f) => {
            say(f, 'anger');
            f.leg = null;
          });
        }
        if (t >= 0.62 && t < 2.45) {
          // Trading blows, circling each other in mid-air.
          const a = (t - 0.62) * 2.4;
          const n = Math.floor((t - 0.62) / 0.22);
          both.forEach((f, i) => {
            const side = i ? 1 : -1;
            f.pos.set(mid.x + Math.cos(a) * 0.55 * side, mid.y + Math.sin(t * 7 + i) * 0.1, mid.z + Math.sin(a) * 0.4 * side);
            faceTo(f, both[1 - i].pos);
            const hitting = n % 2 === i;
            pose(f, hitting ? (['punch', 'punch2', 'kick'] as Pose[])[n % 3] : 'guard');
          });
          if (n !== Math.floor((prev - 0.62) / 0.22) && prev >= 0.62) {
            const p = sonny.pos.clone().lerp(prinz.pos, 0.5).setY(mid.y + 0.95);
            landHit(p, n % 2 ? PRINZ.aura : SONNY.aura);
          }
        }
        if (at(t, prev, 2.45)) {
          // Fist to fist, everything they have.
          both.forEach((f) => pose(f, 'punch'));
          const p = sonny.pos.clone().lerp(prinz.pos, 0.5).setY(mid.y + 0.95);
          sfx('boom', p);
          sfx('crack', p);
          flash(p, 1.6);
          shock(p, 1.8);
          shock(p, 1.1, '#ffd84a');
          burst(p, '#ffffff', 20, 4.4);
          ctx.bump(0.35);
          shake(0.26);
          punchIn(0.16);
          slow(0.25, 0.5);
        }
        if (at(t, prev, 2.6)) {
          both.forEach((f) => moveTo(f, f.air, 0.8, 0.3, outQuart));
          sfx('whoosh', MID, { dur: 0.8, pitch: 0.8 });
        }
        if (t >= 2.6) both.forEach((f, i) => {
          pose(f, t < 3.0 ? 'hurt' : 'guard');
          faceTo(f, both[1 - i].pos);
        });
      },
      focus: () => ({ x: MID.x, z: MID.z }),
    };
    const MID = v(POOL.x - 0.5, 2.4, POOL.z + 2.5);
    const meet = (side: number) => MID.clone().add(v(side * 0.55, 0, 0));
    const stray: Beat = {
      name: 'stray', dur: 3.9,
      start() {
        say2('Prinz is charging something big…', true);
        moveTo(prinz, prinz.air, 0.4);
        sfx('charge', prinz.air, { dur: 1.6, pitch: 0.8, gain: 1.2 });
      },
      tick(t, prev) {
        const f = prinz;
        const rock = v(SHELF.x, 0.5, SHELF.z);
        faceTo(f, G);
        const ball = f.rig.ball;
        if (t < 1.6) {
          pose(f, 'charge');
          ball.visible = true;
          ball.scale.setScalar((0.5 + (t / 1.6) * 2.2) * (1 + Math.sin(t * 40) * 0.08));
          ball.position.set(0.35, 1.15, 0.1);
          if (Math.floor(t / 0.04) !== Math.floor(prev / 0.04)) drawIn(ball.getWorldPosition(new THREE.Vector3()), f.look.aura, 2, 1.1);
          if (Math.floor(t / 0.25) !== Math.floor(prev / 0.25)) shake(0.02 + t * 0.03);
        }
        if (at(t, prev, 1.45)) {
          octopus()?.swat(toG(f));
          sfx('swat', G);
        }
        if (at(t, prev, 1.6)) {
          ball.visible = false;
          fire(beams[1], hands(f), G, f.look.aura, 1.8);
          sfx('beam', f.pos, { dur: 0.75, pitch: 0.85, gain: 1.2 });
          punchIn(0.1);
        }
        if (at(t, prev, 1.7)) {
          // Gåmson swats it aside, straight into his own rock.
          fire(beams[2], G, rock, f.look.aura, 1.6);
          sfx('crack', G);
          flash(G.clone().setY(0.9), 0.9);
          burst(G.clone().setY(0.9), f.look.aura, 10, 3);
        }
        if (at(t, prev, 1.85)) {
          flash(rock.clone().setY(0.8), 1.2);
          shock(rock.clone().setY(0.8), 1.3, f.look.aura);
          burst(rock.clone().setY(0.6), '#8b8478', 18, 4);
          burst(rock.clone().setY(0.6), f.look.aura, 12, 3.4);
          impact(SHELF.x, SHELF.z, 1.2);
          sfx('rumble', rock, { dur: 1.6 });
          shake(0.3);
          punchIn(0.18);
          slow(0.25, 0.7);
          const n = octopus()?.scatter() ?? 0;
          say2(n ? `Gåmson swatted the beam into his own rock. Everything he stole is flying home.` : 'Gåmson swatted the beam into his own rock.', true);
        }
        if (t >= 1.6 && t < 2.35) {
          pose(f, 'fire');
          beams[1].from.copy(hands(f));
        }
        if (at(t, prev, 2.35)) {
          cease(beams[1]);
          cease(beams[2]);
        }
        if (t >= 2.35) {
          pose(f, 'cross');
          if (at(t, prev, 2.5)) say(f, 'q');
        }
      },
      focus: () => ({ x: (POOL.x + SHELF.x) / 2 + 0.5, z: (POOL.z + SHELF.z) / 2 + 1 }),
    };
    // The rescue waits for Tåhgong: the hearts burst when he actually reaches Gåmson.
    let hugAt = -1;
    let hugged = false;
    ctx.events.on('tahgong:comforted', () => {
      if (state.fighting && beats[current] === rescue && hugAt < 0) hugAt = beatT;
    });
    const rescue: Beat = {
      name: 'rescue', dur: 9,
      start() {
        hugAt = -1;
        hugged = false;
        rescue.dur = 9;
        ctx.events.emit('rivals:rescue');
        say2('Tåhgong to the rescue!', true);
        both.forEach((f) => f.pos.distanceTo(f.shore) > 0.1 && moveTo(f, f.shore, 0.7, 0.3));
      },
      tick(t, prev) {
        // If he cannot get there in time, the hug happens anyway.
        if (hugAt < 0 && t > 6) {
          hugAt = t;
          octopus()?.calm?.();
        }
        const h = hugAt < 0 ? Infinity : hugAt;
        state.hugged = hugAt >= 0;
        if (hugAt >= 0 && !hugged) {
          hugged = true;
          // A hug so big it blows them back.
          heartBurst(G.clone().setY(1.2));
          sfx('chime', G);
          sfx('splash', G, { gain: 0.8 });
          sfx('whoosh', G, { dur: 1.0, pitch: 0.6 });
          shock(G.clone().setY(1), 1.8, '#ff8fb3');
          ctx.bump(0.2);
          shake(0.1);
          slow(0.4, 0.6);
          water()?.splash(G.x, G.z, 1.2);
          rescue.dur = h + 2.4;
          both.forEach((f) => {
            const out = f.pos.clone().sub(G).setY(0).normalize();
            moveTo(f, f.shore.clone().add(out.multiplyScalar(1.5)), 1.0, 1.2, outQuad);
          });
        }
        both.forEach((f) => {
          pose(f, t < h ? (f.leg ? 'fly' : 'guard') : t < h + 1 ? 'tumble' : 'stand');
          if (t < h) faceTo(f, G);
        });
        if (at(t, prev, h + 1)) both.forEach((f) => say(f, 'q'));
      },
      focus: () => ({ x: POOL.x, z: POOL.z + 1 }),
    };
    let fadeFrom = [1, 1];
    const bow: Beat = {
      name: 'bow', dur: 2.8,
      start() {
        fadeFrom = both.map((f) => f.power);
        both.forEach((f) => {
          f.rig.ball.visible = false;
          if (f.pos.distanceTo(f.shore) > 0.3) moveTo(f, f.shore, 0.5, f.pos.y > 0.3 ? 0.2 : 0.15);
        });
        beams.forEach(cease);
      },
      tick(t, prev) {
        both.forEach((f, i) => {
          f.power = fadeFrom[i] * (1 - smooth(t / 1.6));
          faceTo(f, G);
          pose(f, t > 0.6 && t < 2.0 ? 'bow' : 'stand');
        });
        if (at(t, prev, 0.7)) {
          sfx('chime', null, { gain: 0.45, pitch: 0.75 });
          say(sonny, 'heart');
          say(prinz, 'sparkle');
        }
      },
    };
    const leave: Beat = {
      name: 'leave', dur: 2.4,
      tick(t, prev) {
        both.forEach((f, i) => {
          const t0 = 0.25 + i * 0.35;
          if (t < t0) pose(f, 'windup');
          if (at(t, prev, t0)) {
            const to = f.shore.clone().add(v(i ? 6 : -6, 16, -8));
            f.power = 0.6;
            streak(i, f.pos.clone(), to);
            dust(f.pos.x, f.pos.z, 1, f.look.aura);
            shock(chest(f), 0.8, f.look.aura);
            moveTo(f, to, 1.0, 0, inQuad);
            sfx('dash', f.pos, { dur: 0.5, pitch: 0.7 });
            sfx('whoosh', f.pos, { dur: 1.0 });
          }
          if (t >= t0) pose(f, 'fly');
        });
      },
    };

    // ---- Running a fight -------------------------------------------------------------------
    let beats: Beat[] = [];
    let tankAt = -1;
    let current = -1;
    let beatT = 0;
    const shuffle = <T,>(a: T[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    /** The moves by name, for a fight with its moves chosen (video shots). */
    const byName = (name: string): Beat | null => {
      const [move, who] = name.split(':');
      const f = who === 'Prinz' ? prinz : sonny;
      if (move === 'punch') return combo(f);
      if (move === 'swat') return swat(f);
      if (move === 'beam') return beam(f);
      if (move === 'ink') return inked(f);
      if (move === 'flurry') return flurry;
      if (move === 'clash') return clash;
      return null;
    };
    const startFight = (plan?: string[]) => {
      if (state.fighting) return;
      const o = octopus();
      if (o) o.busy = true;
      // Drafted? They go anyway, helmet and all.
      both.forEach((f) => {
        const helmet = f.rig.head.getObjectByName('helmet');
        if (helmet) helmet.visible = !!resident(f.name)?.n.drafted;
      });
      [resident('Sonny'), resident('Prinz')].forEach((m, i) => m && goAway(m, i));
      state.fighting = true;
      state.fights += 1;
      state.cubeHits = 0;
      clockT = 0;
      mark.hidden = false;
      // A different show every time: one swat, one beam, one of the big set pieces (both
      // rushing him, or the two of them going at each other), and two more at random.
      const big = rand() < 0.5 ? [flurry, clash] : [clash, flurry];
      const extras = shuffle([combo(sonny), combo(prinz), inked(sonny), inked(prinz), beam(prinz), swat(prinz), big[1]]).slice(0, 2);
      const chosen = plan?.map(byName).filter((b): b is Beat => !!b);
      const moves = chosen?.length ? chosen : shuffle([swat(sonny), beam(sonny), big[0], ...extras]);
      beats = [arrive, taunt, powerUp, ...moves, stray, rescue, bow, leave];
      // The tank takes its shot at the start of the brawl.
      tankAt = 3;
      current = -1;
      next();
      ctx.events.emit('rivals:started');
    };
    const next = () => {
      current += 1;
      beatT = 0;
      if (current >= beats.length) return endFight();
      state.beat = beats[current].name;
      beats[current].start?.();
      if (current === tankAt) ctx.events.emit('rivals:intruders', { x: prinz.shore.x, z: prinz.shore.z });
    };
    const endFight = () => {
      state.fighting = false;
      state.beat = '';
      mark.hidden = true;
      both.forEach((f) => {
        f.rig.root.visible = false;
        f.rig.ball.visible = false;
        f.power = 0;
        f.leg = null;
        f.spin = 0;
      });
      beams.forEach((b) => {
        b.on = false;
        b.g.visible = false;
        b.flare.visible = false;
      });
      setCinema(false);
      music(false);
      const o = octopus();
      if (o) o.busy = false;
      const s = resident('Sonny');
      const p = resident('Prinz');
      if (s) comeBack(s, sonny.shore);
      if (p) comeBack(p, prinz.shore);
      state.nextIn = NEXT_FIGHT[0] + rand() * (NEXT_FIGHT[1] - NEXT_FIGHT[0]);
      ctx.events.emit('rivals:ended');
    };
    /** Jump straight to the bow (the cube impressed them). They come down to it smoothly. */
    const skipToBow = () => {
      const i = beats.indexOf(bow);
      if (i < 0 || current >= i) return;
      current = i - 1;
      next();
    };

    // The cube joins in: roll right up to a fighter on the ground.
    ctx.events.on<{ x: number; z: number }>('cube:rolled', ({ x, z }) => {
      if (!state.fighting || current < 1 || beats[current] === leave || beats[current] === bow) return;
      for (const f of both) {
        if (f.pos.y > 0.3 || f.stun > 0 || Math.hypot(f.pos.x - x, f.pos.z - z) > 1.4) continue;
        f.stun = 1;
        sfx('punch', f.pos, { pitch: 0.8 });
        say(f, 'bang');
        dust(f.pos.x, f.pos.z, 0.7);
        burst(chest(f), '#ffffff', 8, 2.4);
        ctx.bump(0.1);
        state.cubeHits += 1;
        if (state.cubeHits >= 2) {
          const cult = ctx.state.cult as { give?: (n?: number) => void } | undefined;
          cult?.give?.(1);
          tip('A cube?! They are so impressed they bow and leave. +1 ✦', 5, { urgent: true });
          skipToBow();
        } else tip(`You bumped ${f.name}. Once more and they might take you seriously.`);
        return;
      }
    });

    // ---- Scripted control, for tests and video shots ---------------------------------------
    // Tests can run a fight faster than real time; the game never does.
    ctx.events.on<[number?, string[]?]>('direct:rivals.fight', ([s, plan]) => {
      speed = s ?? 1;
      startFight(plan);
    });
    ctx.events.on<[boolean]>('direct:rivals.staged', ([on]) => (state.staged = on));
    ctx.events.on('direct:rivals.end', () => state.fighting && endFight());

    // ---- Poses ---------------------------------------------------------------------------------
    const TARGET = {
      lean: 0, twist: 0, headX: 0, drop: 0, armX: [0, 0], armZ: [0.15, -0.15], foreX: [-0.3, -0.3], legX: [0, 0], legZ: [0.1, -0.1], kneeX: [0, 0],
    };
    type P = typeof TARGET;
    const copyP = (p: P): P => ({ ...p, armX: [...p.armX], armZ: [...p.armZ], foreX: [...p.foreX], legX: [...p.legX], legZ: [...p.legZ], kneeX: [...p.kneeX] });
    const GUARD: Partial<P> = { twist: -0.15, drop: -0.03, armX: [-0.95, -1.05], armZ: [0.25, -0.25], foreX: [-1.65, -1.55], legX: [-0.25, 0.2], legZ: [0.18, -0.18], kneeX: [0.3, 0.25] };
    /** How quickly each pose is reached: strikes snap, everything else flows. */
    const RATE: Partial<Record<Pose, number>> = { punch: 34, punch2: 34, kick: 30, fire: 26, dash: 22, windup: 18, land: 26, tumble: 20 };
    const posed = new Map<Fighter, P>();
    const target = (f: Fighter, time: number): [P, Pose] => {
      const p = copyP(TARGET);
      const w = Math.sin(time * 20);
      const now: Pose = f.stun > 0 ? 'hurt' : f.landT > 0 ? 'land' : f.pose;
      switch (now) {
        case 'stand':
          if (f.power > 0.3) Object.assign(p, GUARD);
          break;
        case 'guard':
          Object.assign(p, GUARD);
          break;
        case 'fly':
          Object.assign(p, { lean: 0.7, armX: [0.55, 0.55], armZ: [0.3, -0.3], foreX: [-0.2, -0.2], legX: [0.35, 0.55], kneeX: [0.7, 0.45] });
          break;
        case 'dash':
          Object.assign(p, { lean: 0.8, armX: [0.6, -1.2], armZ: [0.25, -0.05], foreX: [-0.2, -0.3], legX: [0.5, 0.75], kneeX: [0.8, 0.5] });
          break;
        case 'windup':
          Object.assign(p, { twist: 0.55, lean: 0.15, drop: -0.09, armX: [-0.6, 0.5], armZ: [0.2, -0.2], foreX: [-1.5, -1.8], legX: [-0.5, 0.45], legZ: [0.2, -0.2], kneeX: [0.75, 0.35] });
          break;
        case 'punch':
          Object.assign(p, { twist: -0.5, lean: 0.12, armX: [-0.9, -1.6], armZ: [0.25, 0], foreX: [-1.6, 0], legX: [-0.45, 0.35], kneeX: [0.35, 0] });
          break;
        case 'punch2':
          Object.assign(p, { twist: 0.5, lean: 0.12, armX: [-1.6, -0.9], armZ: [0, -0.25], foreX: [0, -1.6], legX: [0.35, -0.45], kneeX: [0, 0.35] });
          break;
        case 'kick':
          Object.assign(p, { lean: -0.3, twist: -0.25, armX: [-0.9, -0.5], armZ: [0.6, -0.6], foreX: [-1.3, -1.0], legX: [-1.55, 0.15], legZ: [0.05, -0.12], kneeX: [0.05, 0.35] });
          break;
        case 'point':
          Object.assign(p, { headX: -0.15, armX: [0, -1.5], foreX: [-0.2, 0] });
          break;
        case 'charge':
          Object.assign(p, { twist: 0.7, lean: 0.1, armX: [0.4, 0.4], armZ: [0.7, -0.2], foreX: [-1.3, -1.6], legX: [-0.5, 0.4], legZ: [0.25, -0.25], kneeX: [0.6, 0.2] });
          break;
        case 'fire':
          Object.assign(p, { lean: 0.15, armX: [-1.55, -1.55], armZ: [0.12, -0.12], foreX: [0, 0], legX: [-0.5, 0.4], legZ: [0.25, -0.25], kneeX: [0.5, 0.2] });
          break;
        case 'hurt':
          Object.assign(p, { lean: -0.35, headX: 0.3, armX: [-2.2 + w * 0.3, -2.2 - w * 0.3], armZ: [0.9, -0.9], foreX: [-0.4, -0.4], legX: [0.2, -0.3] });
          break;
        case 'tumble':
          Object.assign(p, { armZ: [1.2, -1.2], foreX: [-0.6, -0.6], legX: [-0.9, -0.7], kneeX: [1.4, 1.3] });
          break;
        case 'land':
          Object.assign(p, { lean: 0.3, drop: -0.17, armX: [0.35, 0.35], armZ: [0.55, -0.55], foreX: [-0.6, -0.6], legX: [-0.75, -0.6], legZ: [0.22, -0.22], kneeX: [1.25, 1.1] });
          break;
        case 'cross':
          Object.assign(p, { headX: -0.12, armX: [-0.9, -0.9], armZ: [-0.55, 0.55], foreX: [-1.7, -1.7] });
          break;
        case 'power':
          Object.assign(p, { headX: -0.35, lean: -0.08, drop: -0.05, armX: [0.15, 0.15], armZ: [0.45, -0.45], foreX: [-0.5, -0.5], legZ: [0.3, -0.3], kneeX: [0.3, 0.3] });
          break;
        case 'bow':
          Object.assign(p, { lean: 0.75, headX: 0.3, armX: [0, 0], armZ: [0.05, -0.05], foreX: [0, 0] });
          break;
      }
      return [p, now];
    };

    // ---- Rare encounters, on an ordinary day ------------------------------------------------
    let sinceLook = 0;
    let lastStandoff = -99;
    let lastMoment = -99;
    let clock = 0;
    const faceEach = (a: Member['n'], b: { x: number; z: number }) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      a.dir = (Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 0 : 2) : dz >= 0 ? 1 : 3) as DirIndex;
    };
    const free = (n: Member['n']) => n.nx === null && ['idle', 'walk'].includes(n.mode) && !n.cult;
    const encounters = () => {
      const s = resident('Sonny');
      const p = resident('Prinz');
      if (!s || !p || away.size) return;
      const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
      // The two of them, face to face: a glare, an angry mark each, and they walk on.
      if (d(s.n, p.n) <= 2 && free(s.n) && free(p.n) && clock - lastStandoff > 90 && rand() < 0.5) {
        lastStandoff = clock;
        faceEach(s.n, p.n);
        faceEach(p.n, s.n);
        for (const [m, o] of [[s, p], [p, s]]) Object.assign(m.n, { mode: 'stare', stareKind: 'bonked', t: 0, timer: 2.2, focus: { x: o.n.x, z: o.n.z }, emote: { kind: 'anger', t: 0 } });
        if (cubeNear(14)) tip('Sonny and Prinz just glared at each other. Not today.');
        return;
      }
      // Everything else is rarer still: at most one little moment every 25 seconds or so.
      if (clock - lastMoment < 25) return;
      const near = cubeNear(14);
      const moment = (text?: string) => {
        lastMoment = clock;
        if (text && near) tip(text);
      };
      const pz = ctx.state.picachu as { x: number; z: number; present: boolean } | undefined;
      // Picachu wanders past: Sonny is delighted; Prinz gets zapped for staring.
      if (pz?.present && rand() < 0.3) {
        if (d(pz, s.n) <= 2 && free(s.n)) {
          faceEach(s.n, pz);
          Object.assign(s.n, { mode: 'stare', stareKind: 'bonked', t: 0, focus: { x: pz.x, z: pz.z }, emote: { kind: 'heart', t: 0 } });
          return moment('Sonny met Picachu. Best day of his life.');
        }
        if (d(pz, p.n) <= 2 && free(p.n)) {
          floor(p.n, p.world);
          sfx('crack', v(p.n.x, 1, p.n.z), { gain: 0.6, pitch: 1.4 });
          return moment('Prinz looked at Picachu the wrong way. Zap.');
        }
      }
      // Drafted, and the leader walks past: a salute, through gritted teeth (Prinz), or a big
      // cheerful one (Sonny).
      for (const f of [s, p]) {
        if (!f.n.drafted || f.n.nx !== null) continue;
        const boss = everyone(ctx).find((m) => m.n.persona.kind === 'leader');
        if (boss && d(boss.n, f.n) <= 3 && rand() < 0.25) {
          faceEach(f.n, boss.n);
          f.n.order = 'salute';
          f.n.emote = { kind: f === p ? 'anger' : 'note', t: 0 };
          return moment(f === p ? 'Prinz saluted the leader. Through gritted teeth.' : 'Sonny saluted the leader. Way too enthusiastically.');
        }
      }
      for (const m of everyone(ctx)) {
        if (m === s || m === p) continue;
        const kind = m.n.persona.kind;
        // A cultist tries to recruit Prinz. Prinz is not interested.
        if (m.n.cult && m.n.nx === null && d(m.n, p.n) <= 2 && free(p.n) && rand() < 0.2) {
          faceEach(p.n, m.n);
          p.n.order = 'fume';
          m.n.emote = { kind: 'q', t: 0 };
          return moment('A cultist tried to recruit Prinz. Bad idea.');
        }
        if (!free(m.n)) continue;
        // Sonny spars with a soldier, who salutes him for it.
        if (kind === 'soldier' && d(m.n, s.n) <= 2 && free(s.n) && rand() < 0.2) {
          faceEach(s.n, m.n);
          faceEach(m.n, s.n);
          Object.assign(s.n, { emote: { kind: 'note', t: 0 } });
          m.n.order = 'salute';
          return moment();
        }
        // Prinz and the leader: neither has anything nice to say.
        if (kind === 'leader' && d(m.n, p.n) <= 3 && free(p.n) && !p.n.drafted && rand() < 0.25) {
          faceEach(p.n, m.n);
          faceEach(m.n, p.n);
          p.n.order = 'fume';
          m.n.order = 'fume';
          return moment('Prinz and the leader have nothing nice to say to each other.');
        }
        // A femboy offers Sonny a bow. He wears it with pride.
        if (kind === 'femboy' && d(m.n, s.n) <= 2 && free(s.n) && rand() < 0.15) {
          faceEach(m.n, s.n);
          faceEach(s.n, m.n);
          m.n.emote = { kind: 'heart', t: 0 };
          s.n.emote = { kind: 'sparkle', t: 0 };
          ctx.events.emit('direct:fighters.bow', [residents.members.indexOf(s)]);
          return moment('A femboy gave Sonny a bow. He is never taking it off.');
        }
        // A femboy offers Prinz a bow. He refuses. The femboy is crushed.
        if (kind === 'femboy' && d(m.n, p.n) <= 2 && free(p.n) && rand() < 0.15) {
          faceEach(m.n, p.n);
          faceEach(p.n, m.n);
          m.n.emote = { kind: 'q', t: 0 };
          p.n.order = 'fume';
          return moment('Prinz refused a bow. The femboy will never recover.');
        }
        // A goth, very occasionally, quite taken with Prinz. He pretends not to notice.
        if (kind === 'goth' && d(m.n, p.n) <= 2 && rand() < 0.15) {
          faceEach(m.n, p.n);
          m.n.emote = { kind: 'heart', t: 0 };
          if (free(p.n)) p.n.emote = { kind: 'dots', t: 0 };
          return moment();
        }
        // Sonny waves at a goth. The goth stares back, unimpressed.
        if (kind === 'goth' && d(m.n, s.n) <= 2 && free(s.n) && rand() < 0.15) {
          faceEach(s.n, m.n);
          s.n.emote = { kind: 'note', t: 0 };
          m.n.greeted = { x: s.n.x, z: s.n.z };
          return moment();
        }
      }
    };

    // Bumped by the cube: Sonny, after a jab, a spin kick and a thumbs-up, respects it;
    // Prinz, after crossed arms and stamping, storms off.
    // (Said by the cast's onEvent, above, where we know who it was and how close.)

    // Drafted into the army. They will still skip duty for a good fight.
    ctx.events.on<{ id: string }>('army:conscripted', ({ id }) => {
      const m = residents.members.find((r) => r.n.id === id);
      const c = cubeAt();
      if (!m || !c || Math.abs(c.x - m.n.x) + Math.abs(c.z - m.n.z) > 16) return;
      const sonnyDrafted = m === resident('Sonny');
      tip(sonnyDrafted
        ? 'The leader drafted Sonny. Sonny thinks it is a training montage.'
        : 'The leader drafted Prinz. Prinz is furious. Prinz is also going.');
    });

    // A glare on demand (video shots): wherever the two of them are.
    ctx.events.on<[number?]>('direct:rivals.standoff', ([seconds]) => {
      const s = resident('Sonny');
      const p = resident('Prinz');
      if (!s || !p) return;
      faceEach(s.n, p.n);
      faceEach(p.n, s.n);
      for (const [m, o] of [[s, p], [p, s]]) Object.assign(m.n, { mode: 'stare', stareKind: 'bonked', t: 0, timer: seconds ?? 2.6, focus: { x: o.n.x, z: o.n.z }, emote: { kind: 'anger', t: 0 } });
    });

    // ---- Every frame -----------------------------------------------------------------------
    let lean: THREE.Vector3 | null = null;
    let lensOwned = false;
    const DARK = new THREE.Color('#2b2522');
    const GOLD = new THREE.Color('#e3ad2a');
    const tmp = new THREE.Vector3();
    /** How the fight is framed. Video shots can frame tighter, and without the cube. */
    const framing = { margin: 1.2, cube: true, closest: CLOSE_UP };
    ctx.events.on<[number, boolean, number?]>('direct:rivals.framing', ([margin, cube, closest]) =>
      Object.assign(framing, { margin, cube, closest: closest ?? CLOSE_UP }));
    // Screen space for the isometric camera: right is (1, 0, -1)/√2, up is (-1, 2, -1)/√6.
    const R2 = Math.SQRT2;
    const R6 = Math.sqrt(6);
    const sxOf = (x: number, _y: number, z: number) => (x - z) / R2;
    const syOf = (x: number, y: number, z: number) => (-x + 2 * y - z) / R6;
    /**
     * Frame the fight: everything that matters (the fighters, Gåmson, wherever this beat's
     * action is) and the cube, all on screen at once, as close as that allows. The camera
     * eases toward the framing, so it glides rather than jumps.
     */
    const frame = (c: { x: number; z: number }, dt: number) => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      const add = (x: number, y: number, z: number, pad: number, padUp = pad) => {
        const sx = sxOf(x, y, z);
        const sy = syOf(x, y, z);
        x0 = Math.min(x0, sx - pad);
        x1 = Math.max(x1, sx + pad);
        y0 = Math.min(y0, sy - pad);
        y1 = Math.max(y1, sy + padUp);
      };
      // Gåmson and the fighters, from their feet to the tops of their heads.
      add(G.x, 0, G.z, 1.1, 1.7);
      for (const f of both) if (f.rig.root.visible && f.pos.y < 6) add(f.pos.x, f.pos.y, f.pos.z, 0.6, 1.9);
      const hint = beats[current]?.focus?.() ?? null;
      if (hint) add(hint.x, 0, hint.z, 1.2);
      // And the cube, which must never leave the screen (a video shot may leave it out).
      if (framing.cube) add(c.x, 0.5, c.z, 0.9);
      const cam = ctx.camera;
      const zoom = cam.zoom || 1;
      const barPx = Math.min(72, Math.max(44, window.innerHeight * 0.08));
      const usable = 1 - (2 * barPx) / Math.max(1, window.innerHeight);
      const hw = cam.right / zoom;
      const hh = (cam.top / zoom) * usable;
      const fit = Math.min(hw / Math.max(0.01, (x1 - x0) / 2), hh / Math.max(0.01, (y1 - y0) / 2));
      kick *= Math.exp(-3.2 * dt);
      // On a narrow (portrait) screen it may pull back further to fit everyone in.
      // Some room to spare all round: the screen's edges fade into the vignette, and a
      // hit leans the camera in a little further still.
      const widest = hw < hh ? 0.55 : 0.78;
      const base = Math.max(widest, Math.min(framing.closest, fit / framing.margin));
      ctx.lens = base * (1 + kick * 0.7);
      lensOwned = true;
      // The middle of that box. If it all cannot fit, the cube wins: slide over until it is
      // back inside the frame.
      let cx = (x0 + x1) / 2;
      let cy = (y0 + y1) / 2;
      const cubeX = sxOf(c.x, 0.5, c.z);
      const cubeY = syOf(c.x, 0.5, c.z);
      const roomX = Math.max(0, hw / ctx.lens - 1.1);
      const roomY = Math.max(0, hh / ctx.lens - 1.1);
      if (framing.cube) {
        cx = cubeX - Math.max(-roomX, Math.min(roomX, cubeX - cx));
        cy = cubeY - Math.max(-roomY, Math.min(roomY, cubeY - cy));
      }
      const fx = (cx * R2 - cy * R6) / 2;
      const fz = (-cx * R2 - cy * R6) / 2;
      lean = lean ?? new THREE.Vector3(c.x, 0, c.z);
      lean.lerp(tmp.set(fx, 0, fz), 1 - Math.exp(-2.2 * dt));
      ctx.focusOverride = lean;
    };
    ctx.onUpdate((dt, time) => {
      clock += dt;
      if (!state.fighting && (sinceLook += dt) > 1) {
        sinceLook = 0;
        encounters();
      }
      // Now and then, a fight. Not when the octopus is busy elsewhere, and not unseen.
      if (!state.fighting && !state.staged) {
        state.nextIn -= dt;
        if (state.nextIn <= 0) {
          const o = octopus();
          const ready = o && o.x === POOL.x && o.z === POOL.z && o.mode === 'lurk' && !o.carrying.length && cubeNear();
          if (ready) {
            speed = 1;
            startFight();
          } else state.nextIn = 15;
        }
      }
      if (state.fighting && current >= 0 && current < beats.length) {
        const prev = beatT;
        beatT += dt * speed;
        clockT += dt * speed;
        state.beatT = beatT;
        both.forEach(runLeg);
        beats[current].tick(beatT, prev);
        if (beatT >= beats[current].dur) next();
      }

      // Effects.
      for (const r of rings) {
        r.age += dt;
        const k = Math.min(1, r.age / 0.7);
        r.m.visible = r.age < 0.7;
        r.m.scale.setScalar((0.2 + outQuad(k) * 1.3) * r.size);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
      for (const s of shocks) {
        s.age += dt;
        const k = Math.min(1, s.age / 0.45);
        s.m.visible = s.age < 0.45;
        if (!s.m.visible) continue;
        s.m.quaternion.copy(ctx.camera.quaternion);
        s.m.scale.setScalar((0.15 + outQuart(k) * 1.6) * s.size);
        (s.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      }
      for (const f of flashes) {
        f.age += dt;
        const k = Math.min(1, f.age / 0.22);
        f.m.visible = f.age < 0.22;
        f.m.scale.setScalar(f.size * (0.6 + outQuad(k) * 0.7));
        (f.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        f.m.rotation.y += dt * 8;
        f.m.rotation.x += dt * 5;
      }
      for (const s of sparks) {
        if (!s.m.visible) continue;
        s.age += dt;
        if (s.age >= s.life) {
          s.m.visible = false;
          continue;
        }
        s.v.y -= s.g * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(s.size * (1 - s.age / s.life));
        s.m.rotation.x += dt * 9;
        s.m.rotation.z += dt * 7;
      }
      for (const h of hearts) {
        if (!h.s.visible) continue;
        h.age += dt;
        h.s.position.addScaledVector(h.dir, dt);
        showSymbol(h.s, 'heart', h.age, 1.4, 0.7);
        if (h.age > 1.4) h.s.visible = false;
      }
      streaks.forEach((s) => {
        s.age += dt;
        s.m.visible = s.age < 0.5;
        (s.m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - s.age / 0.5);
      });
      for (const b of beams) {
        if (!b.on) continue;
        b.age += dt;
        if (b.off >= 0) b.off += dt;
        const grow = outQuart(Math.min(1, b.age / 0.1));
        const thin = b.off >= 0 ? 1 - Math.min(1, b.off / 0.14) : 1;
        if (thin <= 0) {
          b.on = false;
          b.g.visible = false;
          b.flare.visible = false;
          continue;
        }
        const len = b.from.distanceTo(b.to);
        b.g.position.copy(b.from);
        b.g.lookAt(b.to);
        const wob = 1 + Math.sin(time * 70) * 0.1;
        const w = b.width * thin;
        b.core.scale.set(0.16 * w * wob, 0.16 * w * wob, len * grow);
        b.glow.scale.set(0.42 * w / wob, 0.42 * w / wob, len * grow);
        b.flare.visible = grow >= 1;
        b.flare.position.copy(b.to);
        b.flare.scale.setScalar(w * (0.5 + Math.sin(time * 50) * 0.12));
        b.flare.rotation.y += dt * 9;
      }
      for (const list of ghosts.values()) {
        for (const g of list) {
          if (!g.wrap.visible) continue;
          g.age += dt;
          g.m.opacity = 0.32 * (1 - g.age / 0.28);
          if (g.age >= 0.28) g.wrap.visible = false;
        }
      }

      // The film treatment, and a camera that follows the action. The view leans toward
      // the fight (never so far that the cube leaves the screen) and moves in closer.
      // Scripted shots (staged) do their own camera work, but keep the bars.
      const c = cubeAt();
      const watch = watching();
      setCinema(watch);
      // The fight has its own music, for as long as the cube is watching it.
      music(watch && state.fighting && beats[current] !== leave);
      const film = watch && !state.staged && c;
      if (film && c) {
        frame(c, dt);
      } else {
        if (lean) {
          if (ctx.focusOverride === lean) ctx.focusOverride = null;
          lean = null;
        }
        if (lensOwned) {
          ctx.lens = 1;
          lensOwned = false;
          kick = 0;
        }
      }

      // The fighters.
      if (!state.fighting) return;
      for (const f of both) {
        f.poseT += dt;
        f.stun = Math.max(0, f.stun - dt);
        f.landT = Math.max(0, f.landT - dt);
        const r = f.rig;
        r.root.position.copy(f.pos);
        let turn = f.face - r.root.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        r.root.rotation.y += turn * (1 - Math.exp(-14 * dt));
        const [p, now] = target(f, time);
        const cur = posed.get(f) ?? copyP(TARGET);
        const k = 1 - Math.exp(-(RATE[now] ?? 12) * dt);
        const mix = (a: number, b: number) => a + (b - a) * k;
        cur.lean = mix(cur.lean, p.lean);
        cur.twist = mix(cur.twist, p.twist);
        cur.headX = mix(cur.headX, p.headX);
        cur.drop = mix(cur.drop, p.drop);
        for (const key of ['armX', 'armZ', 'foreX', 'legX', 'legZ', 'kneeX'] as const) for (const i of [0, 1]) cur[key][i] = mix(cur[key][i], p[key][i]);
        posed.set(f, cur);
        // Tumbling head over heels (backwards, blown away), then settling on a whole turn.
        // A tumble through the air turns a whole number of times, ending as they land.
        if (now === 'tumble' && f.leg) {
          const k = clamp01((clockT - f.leg.t0) / f.leg.dur);
          f.spin = f.spin0 - TAU * Math.max(1, Math.round(f.leg.dur * 1.6)) * outQuad(k);
        } else {
          const goal = Math.round(f.spin / TAU) * TAU;
          f.spin += (goal - f.spin) * (1 - Math.exp(-12 * dt));
          if (Math.abs(goal - f.spin) < 0.002) f.spin = goal;
        }
        // Hovering in the air, a slow bob; on the ground in a fighting stance, a bounce.
        const air = f.pos.y > 0.2;
        const ready = now === 'guard' || (now === 'stand' && f.power > 0.3);
        const bob = air ? Math.sin(time * 3 + f.index * 2) * 0.06 : ready ? Math.abs(Math.sin(time * 5.5 + f.index)) * 0.035 : 0;
        // Spin about the middle of the body, not the feet.
        const C = 0.85;
        r.body.position.set(0, bob + cur.drop + C - C * Math.cos(f.spin), -C * Math.sin(f.spin));
        r.body.rotation.set(cur.lean + f.spin, 0, now === 'power' ? Math.sin(time * 40) * 0.02 : 0);
        r.torso.rotation.y = cur.twist;
        r.head.rotation.x = cur.headX;
        r.arms.forEach((a, i) => {
          a.upper.rotation.set(cur.armX[i], 0, cur.armZ[i]);
          a.fore.rotation.x = cur.foreX[i];
        });
        r.legs.forEach((l, i) => {
          l.upper.rotation.set(cur.legX[i], 0, cur.legZ[i]);
          l.lower.rotation.x = cur.kneeX[i];
        });
        const shout = now === 'power' || now === 'point' || now === 'charge' || now === 'punch' || now === 'punch2' || now === 'kick';
        r.brows.forEach((b, i) => (b.rotation.z += ((i ? 1 : -1) * (shout ? 0.6 : 0.35) - b.rotation.z) * k));
        // Powered up: the aura flares and flickers, and the hair glows gold.
        r.aura.visible = f.power > 0.01;
        r.auraMat.uniforms.power.value = f.power;
        r.auraMat.uniforms.time.value = time;
        r.aura.scale.set(1 + Math.sin(time * 9) * 0.04, 1 + Math.sin(time * 11) * 0.06, 1 + Math.cos(time * 9) * 0.04);
        r.flames.forEach((fl, i) => {
          // Each flame rises from the feet to above the head, shrinking as it goes.
          const k = (time * 1.3 + i / r.flames.length) % 1;
          const a = (i / r.flames.length) * TAU + time * 0.8;
          fl.position.set(Math.cos(a) * (0.42 - k * 0.2), 0.2 + k * 1.9, Math.sin(a) * (0.42 - k * 0.2));
          fl.scale.setScalar(Math.sin(Math.PI * k) * (0.7 + f.power * 0.5));
        });
        const glow = smooth(f.power);
        r.hairMat.emissiveIntensity = glow * 1.1;
        r.hairMat.color.copy(DARK).lerp(GOLD, glow);
        f.emoteAge += dt;
        showSymbol(f.emote, f.emoteAge < 1.6 ? f.emoteKind : null, f.emoteAge, 1.6, 0.6);
        // Moving fast: leave afterimages behind.
        const moved = dt > 0 ? r.root.position.distanceTo(f.last) / dt : 0;
        f.last.copy(r.root.position);
        f.ghostIn -= dt;
        if (moved > 5 && f.ghostIn <= 0 && r.root.visible) {
          leaveGhost(f);
          f.ghostIn = 0.04;
        }
      }
    });
  },
};
