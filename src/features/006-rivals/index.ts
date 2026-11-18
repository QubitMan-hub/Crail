import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import { addLandmark } from '../../core/landmarks';
import { seededRandom } from '../../core/rng';
import { tip } from '../../core/tip';
import { floor } from '../../characters/brain';
import { everyone } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { isWater, POOL, SHELF } from '../004-octopus';
import { buildFighter, PRINZ, SONNY, type FighterRig } from './model';

/**
 * Two rival fighters, Sonny and Prinz, who now and then drop out of the sky to pick a
 * fight with Gåmson. Not often: the first time after a few minutes, then every five to
 * seven, and only when the cube is close enough to see it.
 *
 * A fight is a little show: they land, trade insults and power up; Gåmson rises from
 * the pool, furious; then a run of moves in a different order every time (teleport
 * punches, his swats and ink, charged beams, and the two of them forgetting him to
 * fight each other). A stray beam smashes his rock, sending everything he stole home,
 * and Tåhgong comes to the rescue with a hug so big it blows them back. They bow, and
 * fly off. The tank takes a shot at them, and anyone standing too close gets knocked
 * flat. The cube can join in: bump a fighter on the ground twice and they leave early,
 * impressed, and the cube earns a charm.
 */

type Pose = 'stand' | 'fly' | 'punch' | 'charge' | 'fire' | 'hurt' | 'tumble' | 'cross' | 'power' | 'bow' | 'point';

interface Fighter {
  rig: FighterRig;
  name: string;
  pos: THREE.Vector3;
  face: number;
  pose: Pose;
  poseT: number;
  /** 0 to 1: aura and glowing hair. */
  power: number;
  /** Seconds of being dazed after a bump from the cube. */
  stun: number;
  /** Home spots: on the shore, in the air above the pool, and right beside Gåmson. */
  shore: THREE.Vector3;
  air: THREE.Vector3;
  close: THREE.Vector3;
  emote: THREE.Sprite;
  emoteKind: 'bang' | 'heart' | 'sparkle' | 'q' | 'anger' | null;
  emoteAge: number;
}

interface Beat {
  name: string;
  dur: number;
  start?(): void;
  tick(t: number, prev: number): void;
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

const FIRST_FIGHT = 150;
const NEXT_FIGHT = [300, 420] as const;
/** The cube has to be this close (in cells) to the pool for a fight to start. */
const WITNESS = 26;
const G = new THREE.Vector3(POOL.x, 0.7, POOL.z);
/** The middle of the action, for the camera. */
const FIGHT = { x: POOL.x + 0.5, z: POOL.z + 1.8 };

export const rivals: Feature = {
  meta: {
    id: '006-rivals',
    day: 6,
    title: 'Two rival fighters pick fights with Gåmson',
    credit: { username: 'ancientpro_gamer', text: 'Add goku and Vegeta fighting with octopus', method: 'top-comment' },
  },
  setup(ctx) {
    const rand = seededRandom(ctx.seed ^ 0x6ff);
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const makeFighter = (look: typeof SONNY, shore: THREE.Vector3, air: THREE.Vector3, close: THREE.Vector3): Fighter => {
      const rig = buildFighter(look);
      rig.root.visible = false;
      ctx.scene.add(rig.root);
      const emote = makeSymbolSprite();
      emote.position.set(0, 2.6, 0);
      rig.root.add(emote);
      return { rig, name: look.name, pos: shore.clone(), face: 0, pose: 'stand', poseT: 0, power: 0, stun: 0, shore, air, close, emote, emoteKind: null, emoteAge: 9 };
    };
    // Sonny takes the west shore of the pool, Prinz the east.
    // Both on the near side of the pool, so the whole fight fits on screen: Sonny on the
    // west sand, Prinz on the east, hovering over the shallows, striking beside the den.
    const sonny = makeFighter(SONNY, v(POOL.x - 4.5, 0, POOL.z + 2.5), v(POOL.x - 2.5, 2.0, POOL.z + 1.5), v(POOL.x - 1.2, 0.9, POOL.z + 0.9));
    const prinz = makeFighter(PRINZ, v(POOL.x + 3, 0, POOL.z + 2.5), v(POOL.x + 2, 2.2, POOL.z + 1.2), v(POOL.x + 1.2, 0.9, POOL.z + 0.8));
    const both = [sonny, prinz];
    const say = (f: Fighter, kind: Fighter['emoteKind']) => Object.assign(f, { emoteKind: kind, emoteAge: 0 });

    const state = { fighting: false, fights: 0, cubeHits: 0, beat: '', staged: false, nextIn: FIRST_FIGHT };
    ctx.state.rivals = state;
    const mark = addLandmark(ctx, { name: 'Fight!', x: POOL.x, z: POOL.z - 3, color: '#f2542d', hidden: true });
    const octopus = () => ctx.state.octopus as OctopusAPI | undefined;
    const water = () => ctx.state.water as { splash(x: number, z: number, s?: number): void; ripple(x: number, z: number, s?: number): void } | undefined;
    const cubeNear = (cells = WITNESS) => {
      const c = ctx.state.cube as { x: number; z: number } | undefined;
      return !!c && Math.abs(c.x - POOL.x) + Math.abs(c.z - POOL.z) <= cells;
    };
    const say2 = (text: string, urgent = false) => cubeNear() && tip(text, 4, { urgent });

    // ---- Effects: dust rings, flashes, hearts, streaks -----------------------------------
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
    const flashMat = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const flashes = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flashMat.clone());
      m.visible = false;
      ctx.scene.add(m);
      return { m, age: 9 };
    });
    let nextFlash = 0;
    const flash = (p: THREE.Vector3, size = 1) => {
      const f = flashes[nextFlash++ % flashes.length];
      f.m.position.copy(p);
      f.m.scale.setScalar(size);
      f.age = 0;
    };
    const hearts = Array.from({ length: 12 }, () => {
      const s = makeSymbolSprite();
      s.visible = false;
      ctx.scene.add(s);
      return { s, age: 9, dir: new THREE.Vector3() };
    });
    const heartBurst = (p: THREE.Vector3) => {
      hearts.forEach((h, i) => {
        const a = (i / hearts.length) * Math.PI * 2;
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

    /** Something heavy lands: a dust ring (or a splash), a jolt, and anyone close is knocked flat. */
    const impact = (x: number, z: number, strength = 1) => {
      if (isWater(Math.round(x), Math.round(z))) water()?.splash(x, z, strength);
      else dust(x, z, 1.2 * strength);
      ctx.bump(0.18 * strength);
      for (const m of everyone(ctx)) {
        if (Math.hypot(m.n.x - x, m.n.z - z) <= 1.6 * strength) floor(m.n, m.world);
      }
    };

    // ---- Moving them about ---------------------------------------------------------------
    const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
    /** Fly from a to b over [t0, t1] of the beat, with an optional arc. */
    const fly = (f: Fighter, a: THREE.Vector3, b: THREE.Vector3, t: number, t0: number, t1: number, arc = 0) => {
      const k = ease(clamp01((t - t0) / (t1 - t0)));
      f.pos.copy(a).lerp(b, k);
      f.pos.y += Math.sin(Math.PI * k) * arc;
    };
    const faceTo = (f: Fighter, p: THREE.Vector3) => (f.face = Math.atan2(p.x - f.pos.x, p.z - f.pos.z));
    const pose = (f: Fighter, p: Pose) => {
      if (f.pose !== p) Object.assign(f, { pose: p, poseT: 0 });
    };
    const crossed = (t: number, prev: number, at: number) => prev < at && t >= at;
    /** Blink: gone from one spot, there at another, with a flash at each. */
    const blink = (f: Fighter, to: THREE.Vector3) => {
      flash(f.pos.clone().setY(f.pos.y + 1), 0.6);
      f.pos.copy(to);
      flash(f.pos.clone().setY(f.pos.y + 1), 0.6);
    };

    // ---- The beats ------------------------------------------------------------------------
    const arrive: Beat = {
      name: 'arrive', dur: 3.2,
      start() {
        both.forEach((f) => {
          f.rig.root.visible = true;
          f.power = 0;
          f.pos.copy(f.shore).add(v(f === sonny ? -4 : 4, 14, -6));
        });
        say2('Two fighters just dropped out of the sky next to Gåmson’s pool.', true);
      },
      tick(t, prev) {
        both.forEach((f, i) => {
          const t0 = i * 0.5;
          const from = f.shore.clone().add(v(i ? 4 : -4, 14, -6));
          pose(f, t < t0 + 0.9 ? 'fly' : 'stand');
          fly(f, from, f.shore, t, t0, t0 + 0.9);
          if (crossed(t, prev, t0 + 0.05)) streak(i, from, f.shore);
          if (crossed(t, prev, t0 + 0.9)) impact(f.shore.x, f.shore.z, 1);
          faceTo(f, G);
        });
      },
    };
    const taunt: Beat = {
      name: 'taunt', dur: 2.6,
      start() {
        const o = octopus();
        o?.provoke(60);
        o?.face(Math.atan2(sonny.pos.x - POOL.x, sonny.pos.z - POOL.z));
        say(sonny, 'bang');
      },
      tick(t, prev) {
        pose(sonny, t < 1.3 ? 'point' : 'stand');
        pose(prinz, 'cross');
        if (crossed(t, prev, 1.3)) {
          say(prinz, 'anger');
          octopus()?.face(Math.atan2(prinz.pos.x - POOL.x, prinz.pos.z - POOL.z));
        }
      },
    };
    const powerUp: Beat = {
      name: 'power', dur: 3.2,
      start() {
        say2('They are powering up…');
      },
      tick(t, prev) {
        both.forEach((f) => {
          pose(f, 'power');
          f.power = clamp01(t / 2.4);
        });
        for (const at of [0.4, 0.9, 1.4, 1.9, 2.4]) if (crossed(t, prev, at)) ctx.bump(0.08 + at * 0.03);
        if (crossed(t, prev, 2.4)) both.forEach((f) => dust(f.pos.x, f.pos.z, 1.6, f === sonny ? SONNY.aura : PRINZ.aura));
      },
    };
    const dashPunch = (f: Fighter): Beat => ({
      name: `punch:${f.name}`, dur: 2.2,
      start() {
        blink(f, f.close);
        faceTo(f, G);
      },
      tick(t, prev) {
        faceTo(f, G);
        pose(f, t < 0.7 ? 'punch' : t < 1.3 ? 'stand' : 'fly');
        if (crossed(t, prev, 0.45)) {
          octopus()?.hit();
          flash(G.clone().setY(1), 0.8);
        }
        if (t > 1.3) fly(f, f.close, f.air, t, 1.3, 2.2, 0.5);
      },
    });
    const swat = (f: Fighter): Beat => ({
      name: `swat:${f.name}`, dur: 2.6,
      tick(t, prev) {
        if (t < 0.6) {
          pose(f, 'fly');
          fly(f, f.air, f.close, t, 0, 0.6);
          faceTo(f, G);
        }
        if (crossed(t, prev, 0.65)) octopus()?.swat(Math.atan2(f.pos.x - POOL.x, f.pos.z - POOL.z));
        if (t >= 0.8 && t < 1.8) {
          pose(f, 'tumble');
          fly(f, f.close, f.shore, t, 0.8, 1.8, 2.2);
        }
        if (crossed(t, prev, 1.8)) {
          impact(f.shore.x, f.shore.z, 0.8);
          say(f, 'bang');
        }
        if (t >= 1.8) {
          pose(f, t < 2.2 ? 'hurt' : 'stand');
          faceTo(f, G);
        }
      },
    });
    const inked = (f: Fighter): Beat => ({
      name: `ink:${f.name}`, dur: 2.6,
      start() {
        if (f.pos.y > 0.2) f.pos.copy(f.shore);
        octopus()?.face(Math.atan2(f.pos.x - POOL.x, f.pos.z - POOL.z));
      },
      tick(t, prev) {
        if (crossed(t, prev, 0.3)) {
          octopus()?.inkAt(f.pos.x, f.pos.z);
          say(f, 'q');
          dust(f.pos.x, f.pos.z, 0.9, '#1d1b19');
        }
        if (t > 0.3 && t < 2.2) {
          // Blinded: staggering round in a little circle, arms out.
          pose(f, 'hurt');
          const a = (t - 0.3) * 3.2;
          f.pos.set(f.shore.x + Math.sin(a) * 0.5, 0, f.shore.z + (1 - Math.cos(a)) * 0.3);
          f.face = a * 1.6;
        }
        if (t >= 2.2) {
          f.pos.lerp(f.shore, 0.2);
          pose(f, 'stand');
          faceTo(f, G);
        }
      },
    });
    const beam = (f: Fighter, size = 1): Beat => ({
      name: `beam:${f.name}`, dur: 3.4,
      tick(t, prev) {
        if (t < 0.5) {
          pose(f, 'fly');
          fly(f, f.pos.clone(), f.air, t, 0, 0.5);
        }
        faceTo(f, G);
        if (t >= 0.5 && t < 1.7) {
          pose(f, 'charge');
          f.rig.ball.visible = true;
          f.rig.ball.scale.setScalar(0.4 + ((t - 0.5) / 1.2) * 1.4 * size);
          f.rig.ball.position.set(0.35, 1.15, 0.1);
        }
        if (crossed(t, prev, 1.7)) {
          f.rig.ball.visible = false;
          octopus()?.hit();
          water()?.splash(G.x, G.z, 2);
          ctx.bump(0.4 * size);
          flash(G.clone().setY(0.9), 1.4 * size);
        }
        if (t >= 1.7 && t < 2.5) {
          pose(f, 'fire');
          const len = f.pos.distanceTo(G) / f.rig.root.scale.x;
          const b = f.rig.beam;
          b.visible = true;
          b.position.set(0, 1.25, 0.3);
          b.scale.set(size * (1 + Math.sin(t * 60) * 0.12), size * (1 + Math.cos(t * 55) * 0.12), len);
          b.rotation.x = Math.atan2(f.pos.y + 1 - G.y, f.pos.distanceTo(G) * 1.0) * 0.9;
          (b.material as THREE.MeshBasicMaterial).color.set(f === sonny ? '#bff0ff' : '#e7d2ff');
        }
        if (crossed(t, prev, 2.5)) f.rig.beam.visible = false;
        if (t >= 2.5) pose(f, 'stand');
      },
    });
    const clash: Beat = {
      name: 'clash', dur: 3.2,
      start() {
        say2('They’ve forgotten Gåmson and started fighting each other.');
      },
      tick(t, prev) {
        const mid = v(POOL.x - 0.5, 2.6, POOL.z + 2.5);
        const meet = (_f: Fighter, side: number) => mid.clone().add(v(side * 0.55, 0, 0));
        if (t < 0.7) both.forEach((f, i) => {
          pose(f, 'fly');
          fly(f, f.pos.clone(), meet(f, i ? 1 : -1), t, 0, 0.7);
        });
        if (crossed(t, prev, 0.7)) {
          flash(mid, 1.2);
          ctx.bump(0.25);
          both.forEach((f) => say(f, 'anger'));
        }
        if (t >= 0.7 && t < 2.4) {
          // Trading blows, too fast to follow.
          const turn = Math.floor((t - 0.7) / 0.28) % 2;
          both.forEach((f, i) => {
            f.pos.copy(meet(f, i ? 1 : -1)).add(v(0, Math.sin(t * 9 + i) * 0.15, 0));
            faceTo(f, both[1 - i].pos);
            pose(f, turn === i ? 'punch' : 'hurt');
          });
          if (Math.floor((t - 0.7) / 0.28) !== Math.floor((prev - 0.7) / 0.28) && prev >= 0.7) flash(mid.clone().add(v(0, (rand() - 0.5) * 0.4, 0)), 0.5);
        }
        if (t >= 2.4) both.forEach((f) => {
          pose(f, 'fly');
          fly(f, f.pos.clone(), f.air, t, 2.4, 3.2);
        });
      },
    };
    const stray: Beat = {
      name: 'stray', dur: 3.6,
      start() {
        say2('Prinz is charging something big…', true);
      },
      tick(t, prev) {
        const f = prinz;
        if (t < 0.4) fly(f, f.pos.clone(), f.air, t, 0, 0.4);
        faceTo(f, G);
        if (t < 1.6) {
          pose(f, 'charge');
          f.rig.ball.visible = true;
          f.rig.ball.scale.setScalar(0.5 + (t / 1.6) * 2.2);
          f.rig.ball.position.set(0.35, 1.15, 0.1);
        }
        if (crossed(t, prev, 1.4)) octopus()?.swat(Math.atan2(f.pos.x - POOL.x, f.pos.z - POOL.z));
        if (crossed(t, prev, 1.6)) {
          f.rig.ball.visible = false;
          // Gåmson swats it aside, straight into his own rock.
          const rock = v(SHELF.x, 0.5, SHELF.z);
          flash(rock.clone().setY(0.8), 1.6);
          impact(SHELF.x, SHELF.z, 1.2);
          const n = octopus()?.scatter() ?? 0;
          say2(n ? `Gåmson swatted the beam into his own rock. Everything he stole is flying home.` : 'Gåmson swatted the beam into his own rock.', true);
        }
        if (t >= 1.6 && t < 2.3) {
          pose(f, 'fire');
          const b = f.rig.beam;
          const rock = v(SHELF.x, 0.5, SHELF.z);
          b.visible = true;
          b.position.set(0, 1.25, 0.3);
          b.scale.set(2, 2, f.pos.distanceTo(rock) / f.rig.root.scale.x);
          f.face = Math.atan2(rock.x - f.pos.x, rock.z - f.pos.z);
          b.rotation.x = 0.35;
        }
        if (crossed(t, prev, 2.3)) f.rig.beam.visible = false;
        if (t >= 2.3) {
          pose(f, 'cross');
          say(f, 'q');
        }
      },
    };
    // The rescue waits for Tåhgong: the hearts burst when he actually reaches Gåmson.
    let hugAt = -1;
    let burst = false;
    ctx.events.on('tahgong:comforted', () => {
      if (state.fighting && beats[current] === rescue && hugAt < 0) hugAt = beatT;
    });
    const rescue: Beat = {
      name: 'rescue', dur: 9,
      start() {
        hugAt = -1;
        burst = false;
        rescue.dur = 9;
        ctx.events.emit('rivals:rescue');
        say2('Tåhgong to the rescue!', true);
      },
      tick(t, prev) {
        // If he cannot get there in time, the hug happens anyway.
        if (hugAt < 0 && t > 6) {
          hugAt = t;
          octopus()?.calm?.();
        }
        const h = hugAt < 0 ? Infinity : hugAt;
        if (hugAt >= 0 && !burst) {
          burst = true;
          // A hug so big it blows them back.
          heartBurst(G.clone().setY(1.2));
          ctx.bump(0.2);
          water()?.splash(G.x, G.z, 1.2);
          rescue.dur = h + 2.4;
        }
        both.forEach((f) => {
          pose(f, t < h ? 'stand' : t < h + 1 ? 'tumble' : 'stand');
          if (t < h) faceTo(f, G);
        });
        if (t >= h && t < h + 1) both.forEach((f) => {
          const away = f.pos.clone().sub(G).setY(0).normalize();
          const back = f.shore.clone().add(away.multiplyScalar(1.5));
          fly(f, f.pos.clone(), back, t, h, h + 1, 1.2);
        });
        if (crossed(t, prev, h + 1)) both.forEach((f) => dust(f.pos.x, f.pos.z, 0.8));
      },
    };
    const bow: Beat = {
      name: 'bow', dur: 2.6,
      tick(t, prev) {
        both.forEach((f) => {
          f.power = Math.max(0, f.power - 0.02);
          faceTo(f, G);
          pose(f, t > 0.6 && t < 2.0 ? 'bow' : 'stand');
        });
        if (crossed(t, prev, 0.7)) {
          say(sonny, 'heart');
          say(prinz, 'sparkle');
        }
      },
    };
    const leave: Beat = {
      name: 'leave', dur: 2.2,
      tick(t, prev) {
        both.forEach((f, i) => {
          const t0 = i * 0.35;
          pose(f, 'fly');
          f.power = 0.6;
          const to = f.shore.clone().add(v(i ? 6 : -6, 16, -8));
          if (crossed(t, prev, t0)) {
            streak(i, f.pos.clone(), to);
            dust(f.pos.x, f.pos.z, 1, f === sonny ? SONNY.aura : PRINZ.aura);
          }
          if (t >= t0) fly(f, f.shore, to, t, t0, t0 + 1.0);
        });
      },
    };

    // ---- Running a fight -------------------------------------------------------------------
    let lean: THREE.Vector3 | null = null;
    let beats: Beat[] = [];
    let current = -1;
    let beatT = 0;
    const shuffle = <T,>(a: T[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const startFight = () => {
      if (state.fighting) return;
      const o = octopus();
      if (o) o.busy = true;
      state.fighting = true;
      state.fights += 1;
      state.cubeHits = 0;
      mark.hidden = false;
      // A different show every time: one swat, one beam, and three more picked at random.
      const extras = shuffle([dashPunch(sonny), dashPunch(prinz), inked(sonny), inked(prinz), clash, beam(prinz), swat(prinz)]).slice(0, 3);
      const moves = shuffle([swat(sonny), beam(sonny), ...extras]);
      // The tank takes its shot at the start of the brawl.
      const first = moves[0];
      const start = first.start?.bind(first);
      first.start = () => {
        start?.();
        ctx.events.emit('rivals:intruders', { x: prinz.shore.x, z: prinz.shore.z });
      };
      beats = [arrive, taunt, powerUp, ...moves, stray, rescue, bow, leave];
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
    };
    const endFight = () => {
      state.fighting = false;
      state.beat = '';
      mark.hidden = true;
      both.forEach((f) => {
        f.rig.root.visible = false;
        f.rig.ball.visible = false;
        f.rig.beam.visible = false;
        f.power = 0;
      });
      const o = octopus();
      if (o) o.busy = false;
      state.nextIn = NEXT_FIGHT[0] + rand() * (NEXT_FIGHT[1] - NEXT_FIGHT[0]);
      ctx.events.emit('rivals:ended');
    };
    /** Jump straight to the bow (the cube impressed them). */
    const skipToBow = () => {
      const i = beats.indexOf(bow);
      if (i < 0 || current >= i) return;
      both.forEach((f) => {
        f.rig.ball.visible = false;
        f.rig.beam.visible = false;
        if (f.pos.y > 0.1) f.pos.copy(f.shore);
      });
      current = i - 1;
      next();
    };

    // The cube joins in: roll right up to a fighter on the ground.
    ctx.events.on<{ x: number; z: number }>('cube:rolled', ({ x, z }) => {
      if (!state.fighting || current < 1 || beats[current] === leave || beats[current] === bow) return;
      for (const f of both) {
        if (f.pos.y > 0.3 || f.stun > 0 || Math.hypot(f.pos.x - x, f.pos.z - z) > 1.4) continue;
        f.stun = 1;
        say(f, 'bang');
        dust(f.pos.x, f.pos.z, 0.7);
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
    let speed = 1;
    ctx.events.on<[number?]>('direct:rivals.fight', ([s]) => {
      speed = s ?? 1;
      startFight();
    });
    ctx.events.on<[boolean]>('direct:rivals.staged', ([on]) => (state.staged = on));
    ctx.events.on('direct:rivals.end', () => state.fighting && endFight());

    // ---- Poses ---------------------------------------------------------------------------------
    const TARGET = {
      lean: 0, twist: 0, headX: 0, armX: [0, 0], armZ: [0.15, -0.15], foreX: [-0.3, -0.3], legX: [0, 0], legZ: [0.1, -0.1], kneeX: [0, 0],
    };
    type P = typeof TARGET;
    const posed = new Map<Fighter, P>();
    const target = (f: Fighter, time: number): P => {
      const p: P = JSON.parse(JSON.stringify(TARGET));
      const w = Math.sin(time * 20);
      switch (f.stun > 0 ? 'hurt' : f.pose) {
        case 'fly':
          Object.assign(p, { lean: 0.9, armX: [0.7, 0.7], armZ: [0.25, -0.25], foreX: [0, 0], legX: [0.35, 0.5], kneeX: [0.6, 0.4] });
          break;
        case 'punch':
          Object.assign(p, { twist: -0.45, armX: [-0.7, -1.55], armZ: [0.2, 0], foreX: [-1.4, 0], legX: [-0.4, 0.3], kneeX: [0.3, 0] });
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
          Object.assign(p, { armZ: [1.2, -1.2], legX: [0.6, -0.4], kneeX: [0.8, 0.8] });
          break;
        case 'cross':
          Object.assign(p, { headX: -0.12, armX: [-0.9, -0.9], armZ: [-0.55, 0.55], foreX: [-1.7, -1.7] });
          break;
        case 'power':
          Object.assign(p, { headX: -0.35, lean: -0.08, armX: [0.15, 0.15], armZ: [0.45, -0.45], foreX: [-0.5, -0.5], legZ: [0.3, -0.3], kneeX: [0.3, 0.3] });
          break;
        case 'bow':
          Object.assign(p, { lean: 0.75, headX: 0.3, armX: [0, 0], armZ: [0.05, -0.05], foreX: [0, 0] });
          break;
      }
      return p;
    };

    // ---- Every frame -----------------------------------------------------------------------
    ctx.onUpdate((dt, time) => {
      // Now and then, a fight. Not when the octopus is busy elsewhere, and not unseen.
      if (!state.fighting && !state.staged) {
        state.nextIn -= dt;
        if (state.nextIn <= 0) {
          const o = octopus();
          const ready = o && o.x === POOL.x && o.z === POOL.z && o.mode === 'lurk' && !o.carrying.length && cubeNear();
          if (ready) startFight();
          else state.nextIn = 15;
        }
      }
      if (state.fighting && current >= 0 && current < beats.length) {
        const prev = beatT;
        beatT += dt * speed;
        beats[current].tick(beatT, prev);
        if (beatT >= beats[current].dur) next();
      }

      // Effects.
      for (const r of rings) {
        r.age += dt;
        const k = Math.min(1, r.age / 0.7);
        r.m.visible = r.age < 0.7;
        r.m.scale.setScalar((0.2 + k * 1.3) * r.size);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
      for (const f of flashes) {
        f.age += dt;
        f.m.visible = f.age < 0.25;
        (f.m.material as THREE.MeshBasicMaterial).opacity = 1 - f.age / 0.25;
        f.m.rotation.y += dt * 8;
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

      // A spectator's camera: while a fight is on and the cube is near, the view leans
      // toward the fight (never so far that the cube leaves the screen). Scripted shots
      // (staged) do their own camera work.
      const c = ctx.state.cube as { x: number; z: number } | undefined;
      const watching = state.fighting && !state.staged && c && Math.hypot(c.x - FIGHT.x, c.z - FIGHT.z) < 16;
      if (watching && c) {
        const dx = FIGHT.x - c.x;
        const dz = FIGHT.z - c.z;
        const d = Math.hypot(dx, dz);
        const k = d > 3.5 ? 3.5 / d : 1;
        lean = lean ?? new THREE.Vector3(c.x, 0, c.z);
        lean.lerp(new THREE.Vector3(c.x + dx * k, 0, c.z + dz * k), Math.min(1, dt * 3));
        ctx.focusOverride = lean;
      } else if (lean) {
        if (ctx.focusOverride === lean) ctx.focusOverride = null;
        lean = null;
      }

      // The fighters.
      if (!state.fighting) return;
      for (const f of both) {
        f.poseT += dt;
        f.stun = Math.max(0, f.stun - dt);
        const r = f.rig;
        r.root.position.copy(f.pos);
        // Hovering in the air, a slow bob; on the ground, a fighter's bounce.
        const air = f.pos.y > 0.2;
        r.body.position.y = air ? Math.sin(time * 3 + f.face) * 0.06 : Math.abs(Math.sin(time * 5)) * 0.03;
        let turn = f.face - r.root.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        r.root.rotation.y += turn * Math.min(1, dt * 14);
        const p = target(f, time);
        const cur = posed.get(f) ?? JSON.parse(JSON.stringify(TARGET));
        const k = Math.min(1, dt * 16);
        const mix = (a: number, b: number) => a + (b - a) * k;
        cur.lean = mix(cur.lean, p.lean);
        cur.twist = mix(cur.twist, p.twist);
        cur.headX = mix(cur.headX, p.headX);
        for (const key of ['armX', 'armZ', 'foreX', 'legX', 'legZ', 'kneeX'] as const) for (const i of [0, 1]) cur[key][i] = mix(cur[key][i], p[key][i]);
        posed.set(f, cur);
        const spin = f.pose === 'tumble' ? f.poseT * 14 : 0;
        r.body.rotation.set(cur.lean + spin, 0, f.pose === 'power' ? Math.sin(time * 40) * 0.02 : 0);
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
        const shout = f.pose === 'power' || f.pose === 'point' || f.pose === 'charge';
        r.brows.forEach((b, i) => (b.rotation.z = (i ? 1 : -1) * (shout ? 0.6 : 0.35)));
        // Powered up: the aura flares and flickers, and the hair glows gold.
        r.auraMat.opacity = f.power * (0.09 + Math.sin(time * 18) * 0.03);
        r.aura.scale.set(1 + Math.sin(time * 9) * 0.05, 1 + Math.sin(time * 11) * 0.08, 1 + Math.cos(time * 9) * 0.05);
        r.aura.rotation.y = time * 2;
        r.hairMat.emissiveIntensity = f.power * 1.1;
        r.hairMat.color.set(f.power > 0.5 ? '#d9a520' : '#1d1b19');
        f.emoteAge += dt;
        showSymbol(f.emote, f.emoteAge < 1.6 ? f.emoteKind : null, f.emoteAge, 1.6, 0.6);
      }
    });
  },
};
