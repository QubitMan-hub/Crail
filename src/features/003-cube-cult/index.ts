import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { addStealable } from '../../core/loot';
import { tip } from '../../core/tip';
import { DIRS, type DirIndex, type Lead, type Npc } from '../../characters/brain';
import { everyone, type Member } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { box, fuse, group, HIP, mat } from '../../characters/rig';

/**
 * The Cult of the Cube. Earn a charm (ride a ride, or visit the shrine), then stop
 * beside anyone but the leader and stay still: the cube preaches, a ring fills, and
 * they put on the robe and follow the cube from then on. Bumping people recruits nobody.
 * Only the four most senior members follow the cube; the rest keep to the temple.
 * Stop moving and they gather and worship. Take them to the temple to be ordained:
 * priests make the shrine give more, and the high priest recruits on his own.
 */

const RED = '#f2542d';
const INK = '#1d1b19';
const STONE = '#a59f96';
const STONE_DARK = '#8b857c';
const FLAME = '#ffb23e';

export const SHRINE = { x: -8, z: -1 };
const MAX_CHARMS = 6;
const SHRINE_REFILL = 30;
/** Seconds before the same ride will pay out a charm again. Visiting all four is the fast way. */
const RIDE_REST = 40;
/** What it takes to recruit each kind. The leader cannot be bought at any price. */
const COST: Record<string, number> = { soldier: 1, femboy: 1, goth: 2 };
const NAMES: Record<string, string> = { soldier: 'Soldiers', femboy: 'Femboys', goth: 'Goths' };
/** The temple: a hall behind the shrine where members are ordained. */
export const TEMPLE = { x: -11, z: -4 };
/** How many members follow the cube about. The rest stay at the temple. */
const RETINUE = 4;
/** Where the congregation stands: rows in front of the temple, facing it, with an aisle up the middle. */
const PEWS: { x: number; z: number; dir: DirIndex }[] = [0, 1, 2, 3, 4].flatMap((row) =>
  [-12, -10, -13, -9, -14, -8].map((x) => ({ x, z: row, dir: 3 as DirIndex })),
);
type Rank = 'acolyte' | 'priest' | 'high';
/** How often the high priest goes out and brings someone back, in seconds. */
const PREACH_EVERY = 45;
/** The high priest stops bringing people in for free once the cult is this big. */
const FREE_RECRUITS_UP_TO = 8;
/** After losing a charm, this many seconds when nothing can take another. */
const GRACE = 4;
const GOLD = '#d6b24a';
/** How long the cube must hold still beside someone to win them over, per charm they cost. */
const PREACH_SECONDS = 1.6;
const PREACH_SETTLE = 0.35;
/** What they may be doing when a sermon starts. Not on a ride, not mid-gag, not already listening. */
const WILL_LISTEN = ['idle', 'walk', 'march', 'stare', 'lost', 'snub', 'wave', 'giggle', 'pat', 'inspect', 'salute', 'visit'];
/** [members needed, name, what the player is told]. */
const RANKS: [number, string, string][] = [
  [1, 'Following', 'You have a follower. Stand still and see what they do.'],
  [3, 'Sect', 'A sect of three. The cube has earned a halo.'],
  [6, 'Order', 'An order of six. The ground glows when they worship.'],
  [10, 'Religion', 'Ten members. This is a religion now.'],
];
const FOLLOW_SPEED = 3.1;

const ROBE = '#3b3b42';
const ROBE_LIGHT = '#4b4b54';
const VOID = '#0c0c0f';
const ROPE = '#8d7c5d';

/**
 * The uniform: a floor-length charcoal robe, a caped collar, wide sleeves and a deep
 * hood with nothing visible inside it. But you can still tell who is under it: the
 * trim is in their old colours, their hair peeks out under the brim, and anything
 * that stuck out before (ears, twin tails, a cap, a gun barrel) still sticks out.
 */
function robe(m: Member): void {
  const { rig, n } = m;
  const wide = n.persona.kind === 'leader' ? 1.22 : 1;
  const bow = rig.head.getObjectByName('bow');
  for (const part of [rig.torso, rig.head, rig.armL, rig.armR, rig.legL, rig.legR]) {
    for (const child of part.children) child.visible = false;
  }
  rig.stride = 0; // nothing under there to see moving
  const { trim, hair, kind } = rig.identity;
  rig.root.userData.robe = { trim, hair };
  // Ears, tails and loose locks stay on show. Long hair down the back goes inside the hood.
  for (const loose of rig.sway) if (!rig.hang.includes(loose)) loose.visible = true;

  // Above the waist the robe bends with them; the skirt hangs straight from the hips.
  const top = group(rig.torso);
  box(top, ROBE, 0.58 * wide, 0.62, 0.4, 0, 0.3, 0);
  // Caped collar: two tiers over the shoulders, the lower one a shade lighter.
  box(top, ROBE_LIGHT, 0.94 * wide, 0.08, 0.66, 0, 0.41, 0);
  box(top, ROBE, 0.84 * wide, 0.2, 0.56, 0, 0.55, 0);
  // The cube, on a cord.
  box(top, ROPE, 0.03, 0.2, 0.02, 0, 0.36, 0.29);
  box(top, RED, 0.1, 0.1, 0.1, 0, 0.25, 0.3);
  fuse(top);
  const skirt = group(rig.body, 0, HIP, 0);
  box(skirt, ROBE, 0.6 * wide, 0.3, 0.42, 0, -0.08, 0);
  box(skirt, ROBE, 0.66 * wide, 0.42, 0.48, 0, -0.4, 0); // flares toward the floor
  box(skirt, trim, 0.7 * wide, 0.1, 0.52, 0, -0.71, 0);
  box(skirt, ROPE, 0.62 * wide, 0.05, 0.44, 0, 0.05, 0);
  box(skirt, ROPE, 0.05, 0.3, 0.05, 0.14 * wide, -0.1, 0.23);
  fuse(skirt);

  for (const arm of [rig.armL, rig.armR]) {
    const sleeve = group(arm);
    box(sleeve, ROBE, 0.2, 0.5, 0.24, 0, -0.2, 0);
    box(sleeve, ROBE, 0.27, 0.16, 0.32, 0, -0.5, 0); // bell cuff
    box(sleeve, trim, 0.28, 0.05, 0.33, 0, -0.56, 0);
    box(sleeve, VOID, 0.2, 0.02, 0.25, 0, -0.585, 0);
    fuse(sleeve);
  }

  const hood = group(rig.head);
  box(hood, VOID, 0.5, 0.52, 0.5, 0, 0.3, 0); // where a face would be
  box(hood, ROBE, 0.72, 0.16, 0.76, 0, 0.63, 0.02);
  box(hood, ROBE, 0.72, 0.7, 0.12, 0, 0.32, -0.32);
  for (const side of [1, -1]) box(hood, ROBE, 0.11, 0.7, 0.66, side * 0.305, 0.32, 0.03);
  box(hood, trim, 0.72, 0.09, 0.1, 0, 0.57, 0.37); // the brim droops forward, in their colours
  box(hood, hair, 0.42, 0.09, 0.05, 0.02, 0.47, 0.262); // a fringe, peeking out
  if (kind === 'soldier') {
    // He kept the cap. It goes over the hood.
    box(hood, '#6f7752', 0.8, 0.08, 0.76, 0, 0.74, 0.02);
    box(hood, '#c8452f', 0.62, 0.06, 0.6, 0, 0.69, 0.02);
    box(hood, INK, 0.44, 0.035, 0.16, 0, 0.67, 0.42);
  }
  if (kind === 'tank') {
    // It used to be a tank. Old habits.
    box(hood, '#565d40', 0.11, 0.11, 0.6, 0, 0.3, 0.5);
    box(hood, INK, 0.14, 0.14, 0.08, 0, 0.3, 0.8);
  }
  box(hood, ROBE, 0.7, 0.14, 0.62, 0, 0.0, 0.0);
  // The point: three shrinking blocks, leaning back.
  box(hood, ROBE, 0.5, 0.2, 0.5, 0, 0.78, -0.08);
  box(hood, ROBE, 0.32, 0.2, 0.32, 0, 0.94, -0.2);
  box(hood, ROBE, 0.17, 0.18, 0.17, 0, 1.08, -0.34);
  fuse(hood);
  if (bow) {
    // The bow stays. It goes on top of the hood.
    bow.visible = true;
    bow.position.set(0.16, 0.76, 0.2);
  }
}

/**
 * Marks of rank, worn over the robe. An acolyte has none. A priest wears a red stole.
 * The high priest wears a gold one, a gold band on the hood, and carries a staff.
 */
function dress(m: Member, rank: Rank): void {
  for (const part of [m.rig.torso, m.rig.head, m.rig.armR]) part.getObjectByName('rank')?.removeFromParent();
  if (rank === 'acolyte') return;
  const color = rank === 'high' ? GOLD : RED;
  const wide = m.n.persona.kind === 'leader' ? 1.22 : 1;
  const stole = group(m.rig.torso);
  stole.name = 'rank';
  for (const side of [1, -1]) box(stole, color, 0.1, 0.62, 0.02, side * 0.15 * wide, 0.2, 0.212);
  box(stole, color, 0.4 * wide, 0.07, 0.02, 0, 0.52, 0.29);
  fuse(stole);
  if (rank !== 'high') return;
  const band = group(m.rig.head);
  band.name = 'rank';
  box(band, GOLD, 0.75, 0.07, 0.79, 0, 0.5, 0.02);
  box(band, GOLD, 0.2, 0.2, 0.2, 0, 1.24, -0.4);
  fuse(band);
  const staff = group(m.rig.armR);
  staff.name = 'rank';
  box(staff, GOLD, 0.05, 1.7, 0.05, 0, -0.1, 0.16);
  box(staff, RED, 0.2, 0.2, 0.2, 0, 0.86, 0.16);
  fuse(staff);
}

/** The hall itself: a dark, pillared block on a stepped base, with the cube on the roof. */
function buildTemple(): { hall: THREE.Group; idol: THREE.Mesh; flames: THREE.Mesh[] } {
  const hall = new THREE.Group();
  const still = group(hall);
  box(still, STONE_DARK, 3.0, 0.18, 3.0, 0, 0.09, 0);
  box(still, STONE, 2.7, 0.18, 2.7, 0, 0.27, 0);
  box(still, ROBE, 2.1, 2.2, 2.1, 0, 1.46, 0);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    box(still, STONE, 0.34, 2.3, 0.34, x * 1.14, 1.5, z * 1.14);
    box(still, STONE_DARK, 0.44, 0.12, 0.44, x * 1.14, 2.7, z * 1.14);
  }
  // Doorways on the two sides the camera can see, each flanked by banners.
  box(still, VOID, 0.8, 1.5, 0.04, 0, 1.11, 1.06);
  box(still, VOID, 0.04, 1.5, 0.8, 1.06, 1.11, 0);
  for (const s of [1, -1]) {
    box(still, RED, 0.34, 1.3, 0.03, s * 0.74, 1.5, 1.07);
    box(still, INK, 0.12, 0.12, 0.035, s * 0.74, 1.72, 1.075);
    box(still, RED, 0.03, 1.3, 0.34, 1.07, 1.5, s * 0.74);
    box(still, INK, 0.035, 0.12, 0.12, 1.075, 1.72, s * 0.74);
  }
  box(still, STONE_DARK, 3.1, 0.22, 3.1, 0, 2.87, 0);
  box(still, STONE, 2.3, 0.24, 2.3, 0, 3.1, 0);
  box(still, STONE_DARK, 1.4, 0.26, 1.4, 0, 3.35, 0);
  // Braziers on the front corners of the steps.
  const flames: THREE.Mesh[] = [];
  for (const [x, z] of [[1.25, 1.25], [1.25, -0.2], [-0.2, 1.25]]) {
    box(still, STONE_DARK, 0.26, 0.36, 0.26, x, 0.54, z);
    box(still, INK, 0.34, 0.08, 0.34, x, 0.76, z);
  }
  fuse(still);
  for (const [x, z] of [[1.25, 1.25], [1.25, -0.2], [-0.2, 1.25]]) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.26, 0.2),
      new THREE.MeshStandardMaterial({ color: FLAME, emissive: '#ff7a1a', emissiveIntensity: 1.1 }),
    );
    f.position.set(x, 0.93, z);
    hall.add(f);
    flames.push(f);
  }
  // The cube, larger than life, turning slowly on the roof.
  const idol = box(hall, RED, 0.7, 0.7, 0.7, 0, 3.95, 0);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), mat(INK));
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.352;
  idol.add(dot);
  return { hall, idol, flames };
}

export const cubeCult: Feature = {
  meta: {
    id: '003-cube-cult',
    day: 3,
    title: 'The Cult of the Cube',
    credit: { username: 'megamouse173', text: 'Make a cult plz', method: 'creator-pick' },
  },
  setup(ctx) {
    const cube = ctx.state.cube;
    if (!cube) return; // no cube, nothing to worship

    // ---- What the cube leaves behind for its followers to walk along ----------
    const lead: Lead = { x: cube.x, z: cube.z, dir: 0, trail: [] };
    ctx.events.on<{ x: number; z: number }>('cube:rolled', ({ x, z }) => {
      const dx = x - lead.x;
      const dz = z - lead.z;
      lead.dir = (dx > 0 ? 0 : dx < 0 ? 2 : dz > 0 ? 1 : 3) as DirIndex;
      lead.trail.unshift({ x: lead.x, z: lead.z });
      if (lead.trail.length > 24) lead.trail.length = 24;
      lead.x = x;
      lead.z = z;
    });

    // A bump counts as facing that way too, even though the cube did not move.
    ctx.events.on<{ x: number; z: number; tx: number; tz: number }>('cube:bonk', ({ x, z, tx, tz }) => {
      lead.dir = (tx > x ? 0 : tx < x ? 2 : tz > z ? 1 : 3) as DirIndex;
    });

    const members: Npc[] = [];
    let clock = 0;

    /** Put the robe on, fall in behind the cube. No charge: the caller has dealt with that. */
    const enlist = (m: Member) => {
      const n = m.n;
      n.cult = true;
      n.drafted = false; // the robe outranks the helmet
      m.rig.head.getObjectByName('helmet')?.removeFromParent();
      n.lead = lead;
      n.speed = FOLLOW_SPEED;
      n.focus = null;
      n.goal = null;
      n.wait = 0;
      n.mode = 'revere';
      n.t = 0;
      n.timer = 1.1;
      n.emote = { kind: 'heart', t: 0 };
      robe(m);
      members.push(n);
      ctx.events.emit('cult:joined', { id: n.id });
    };

    const state = {
      charms: 0,
      members,
      rank: '',
      /** Who the cube is preaching to right now, and how far through the sermon it is (0..1). */
      preaching: null as { id: string; progress: number } | null,
      /** Recruit someone on the spot, if the cube can pay. True if it worked. */
      tryRecruit(m: Member): boolean {
        const n = m.n;
        const cost = COST[n.persona.kind];
        if (n.cult || cost === undefined || state.charms < cost || n.mode === 'riding') return false;
        state.charms -= cost;
        enlist(m);
        ctx.bump(0.1);
        refresh(true);
        return true;
      },
    };
    ctx.state.cult = state;

    const gain = (n = 1) => {
      const before = state.charms;
      state.charms = Math.min(MAX_CHARMS, state.charms + n);
      if (state.charms > before) {
        refresh(true);
        if (members.length === 0) tip('Stop next to someone and stay still to preach. Goths cost ✦2.');
      }
    };

    // A charm can be lifted off the cube, but only one it can spare: never its last.
    // It is the same charm coming back, not a new one, so it returns without fuss.
    addStealable(ctx, {
      party: 'cube', name: 'one of your charms', token: 'charm',
      where: () => (state.charms >= 2 && grace <= 0 && ctx.state.cube ? { x: ctx.state.cube.x, z: ctx.state.cube.z } : null),
      take() {
        const before = state.charms;
        state.charms -= 1;
        grace = GRACE;
        refresh(true);
        tip(`The octopus stole one of your charms (✦${before} → ✦${state.charms}). Roll into it to get it back.`);
      },
      putBack() {
        if (state.charms >= MAX_CHARMS) return;
        state.charms += 1;
        refresh(true);
        tip(`Your stolen charm is back (✦${state.charms}).`);
      },
    });
    // Emptying the thief's rock of two or more things earns a charm, and says so.
    ctx.events.on<{ count: number }>('octopus:raided', ({ count }) => {
      if (count < 2 || state.charms >= MAX_CHARMS) return;
      state.charms += 1;
      refresh(true);
      tip(`You gave back all ${count} things it stole: +1 ✦ for that (✦${state.charms}).`);
    });

    // A blast that catches the cube knocks a charm out of it.
    // After losing one, a few seconds when nothing else can take a charm: no double losses.
    let grace = 0;
    ctx.events.on('cube:blast', () => {
      if (state.charms <= 0) return;
      if (grace > 0) return tip('The blast missed your charms. Lucky.');
      state.charms -= 1;
      grace = GRACE;
      refresh(true);
      tip('The blast knocked a charm out of you.');
    });

    // ---- Rides: each one pays out a charm, then needs a rest -------------------
    const rested = new Map<string, number>();
    const rideReady = (ride: string) => clock - (rested.get(ride) ?? -999) >= RIDE_REST;
    ctx.events.on<{ ride: string }>('park:rode', ({ ride }) => {
      if (!rideReady(ride)) return tip('That ride has no charm yet. Try another one.');
      rested.set(ride, clock);
      gain();
    });
    // A little sparkle floats over every ride that has a charm waiting.
    const markers = new Map<string, THREE.Sprite>();
    for (const [ride, [x, y, z]] of Object.entries((ctx.state.park?.spots ?? {}) as Record<string, number[]>)) {
      const marker = makeSymbolSprite();
      marker.position.set(x, y, z);
      ctx.scene.add(marker);
      markers.set(ride, marker);
    }

    ctx.events.on<[DirIndex]>('direct:cult.face', ([d]) => (lead.dir = d));
    ctx.events.on<[string, number]>('direct:cult.recruit', ([cast, index]) => {
      const m = everyone(ctx).find((e) => e.n === ctx.state[cast]?.npcs[index]);
      if (m && !m.n.cult) {
        enlist(m);
        refresh(false);
      }
    });
    ctx.events.on<[number]>('direct:cult.charms', ([n]) => {
      state.charms = n;
      refresh(false);
    });

    // ---- The shrine ------------------------------------------------------------
    const shrine: Occupant = { kind: 'shrine', id: 'shrine' };
    ctx.grid.claim(SHRINE.x, SHRINE.z, shrine);
    const s = group(ctx.scene, SHRINE.x, 0, SHRINE.z);
    box(s, STONE_DARK, 0.96, 0.14, 0.96, 0, 0.07, 0);
    box(s, STONE, 0.74, 0.5, 0.74, 0, 0.38, 0);
    box(s, STONE_DARK, 0.86, 0.1, 0.86, 0, 0.67, 0);
    for (const sx of [1, -1]) {
      box(s, '#fbf6ee', 0.09, 0.2, 0.09, sx * 0.3, 0.82, 0.3);
      const f = box(s, FLAME, 0.06, 0.09, 0.06, sx * 0.3, 0.96, 0.3);
      f.castShadow = false;
    }
    // A little cube, floating. It turns when there is a charm to collect.
    const idol = box(s, RED, 0.3, 0.3, 0.3, 0, 1.1, 0);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), mat(INK));
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.152;
    idol.add(dot);
    // The shrine stands right in front of the temple, so one mark covers both.
    addLandmark(ctx, { name: 'Temple', x: TEMPLE.x, z: TEMPLE.z, color: ROBE });
    let refill = SHRINE_REFILL - 4;
    let ready = false;
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant !== shrine) return;
      // Everyone bows when the cube visits its own shrine.
      for (const n of members) if (n.mode === 'march') Object.assign(n, { mode: 'revere', t: 0, timer: 1.4 });
      if (!ready) return tip('The shrine is not ready yet.');
      ready = false;
      refill = 0;
      // The shrine gives one charm, plus one for every ordained priest (the high priest counts).
      const clergy = [...ranks.values()].filter((r) => r !== 'acolyte').length;
      const tithe = 1 + Math.min(3, clergy);
      gain(tithe);
      tip(tithe > 1 ? `Your priests add to the offering: ✦${tithe}.` : 'The shrine gives ✦1. Ordained priests would make it give more.');
    });

    // ---- What a growing cult earns the cube -------------------------------------
    // Three members: a halo. Six: the ground glows when they worship.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 8, 28),
      new THREE.MeshStandardMaterial({ color: '#f6cf6b', emissive: '#f6b93b', emissiveIntensity: 0.9 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.visible = false;
    ctx.scene.add(halo);
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: '#f6b93b', transparent: true, opacity: 0, depthWrite: false }),
    );
    aura.rotation.x = -Math.PI / 2;
    ctx.scene.add(aura);
    const cubeMesh = ctx.scene.getObjectByName('cube');
    const at = new THREE.Vector3();

    // ---- Preaching: how the cube actually recruits ----------------------------------
    // A faint ring appears under whoever is listening, and fills as the sermon goes on.
    const ringOutline = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.46, 40),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0, depthWrite: false }),
    );
    const ringFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 40),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, depthWrite: false }),
    );
    for (const r of [ringOutline, ringFill]) {
      r.rotation.x = -Math.PI / 2;
      ctx.scene.add(r);
    }
    let sermon: { m: Member; t: number; need: number } | null = null;
    let lastNag = -99;
    const endSermon = (convert: boolean) => {
      if (!sermon) return;
      const { m } = sermon;
      sermon = null;
      state.preaching = null;
      if (convert) return void state.tryRecruit(m);
      if (m.n.mode === 'listen') m.n.timer = 0; // they shrug and move on
    };
    const preach = (dt: number) => {
      const still = !cube.moving && !cube.pinned && !cube.carried && cube.idleFor > PREACH_SETTLE;
      const beside = (n: Npc) => n.nx === null && Math.abs(n.x - cube.x) + Math.abs(n.z - cube.z) === 1;
      if (sermon && (!still || !beside(sermon.m.n) || sermon.m.n.cult || state.charms < (COST[sermon.m.n.persona.kind] ?? 99))) {
        endSermon(false);
      }
      if (!sermon && still && state.charms > 0) {
        const near = everyone(ctx).filter((e) => !e.n.cult && beside(e.n) && WILL_LISTEN.includes(e.n.mode));
        // With several people in reach: whoever the cube is facing, otherwise the cheapest.
        const price = (e: Member) => COST[e.n.persona.kind] ?? 99;
        const facing = (e: Member) => e.n.x === cube.x + DIRS[lead.dir][0] && e.n.z === cube.z + DIRS[lead.dir][1];
        const pick = near
          .filter((e) => price(e) <= state.charms)
          .sort((p, q) => Number(facing(q)) - Number(facing(p)) || price(p) - price(q))[0];
        if (pick) {
          const need = COST[pick.n.persona.kind] * PREACH_SECONDS;
          sermon = { m: pick, t: 0, need };
          Object.assign(pick.n, { mode: 'listen', t: 0, timer: need + 1, wait: 0, focus: null, goal: null });
          pick.n.emote = { kind: 'q', t: 0 };
        } else if (near.length && clock - lastNag > 8) {
          // Someone is there, but not someone the cube can win over right now. Say why.
          lastNag = clock;
          const who = near[0].n.persona.kind;
          const cost = COST[who];
          tip(cost === undefined ? 'He answers to no one. Least of all a cube.' : `${NAMES[who]} cost ✦${cost}. You have ✦${state.charms}.`);
        }
      }
      const glow = ringFill.material as THREE.MeshBasicMaterial;
      const line = ringOutline.material as THREE.MeshBasicMaterial;
      if (!sermon) {
        glow.opacity = 0;
        line.opacity = 0;
        return;
      }
      sermon.t += dt;
      const progress = Math.min(1, sermon.t / sermon.need);
      state.preaching = { id: sermon.m.n.id, progress };
      const { x, z } = sermon.m.n;
      ringOutline.position.set(x, 0.014, z);
      ringFill.position.set(x, 0.013, z);
      ringFill.scale.setScalar(Math.max(0.001, progress));
      line.opacity = 0.35;
      glow.opacity = 0.55;
      if (progress >= 1) endSermon(true);
    };

    // ---- The counter in the corner ---------------------------------------------
    const hud = document.createElement('div');
    hud.id = 'cult';
    hud.className = 'hud';
    const charmsEl = document.createElement('span');
    const membersEl = document.createElement('span');
    hud.append(charmsEl, membersEl);
    document.body.appendChild(hud);
    let announced = 0;
    function refresh(bump: boolean) {
      const rank = [...RANKS].reverse().find(([size]) => members.length >= size);
      state.rank = rank?.[1] ?? '';
      charmsEl.innerHTML = `<b>✦</b> ${state.charms}`;
      charmsEl.title = 'Charms';
      membersEl.textContent = `Cult ${members.length}${state.rank ? ` · ${state.rank}` : ''}`;
      if (rank && rank[0] > announced) {
        announced = rank[0];
        tip(rank[2]);
      }
      if (bump) {
        hud.classList.remove('bump');
        void hud.offsetWidth;
        hud.classList.add('bump');
      }
    }
    refresh(false);
    // ---- The temple: where members are ordained -----------------------------------
    const temple: Occupant = { kind: 'temple', id: 'temple' };
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ctx.grid.claim(TEMPLE.x + dx, TEMPLE.z + dz, temple);
    const { hall, idol: roofIdol, flames } = buildTemple();
    hall.position.set(TEMPLE.x, 0, TEMPLE.z);
    ctx.scene.add(hall);
    // A ring of candles round the shrine, on the corners between cells.
    const candles: THREE.Mesh[] = [];
    for (const [cx, cz] of [[1.5, 0.5], [1.5, -0.5], [-1.5, 0.5], [-1.5, -0.5], [0.5, 1.5], [-0.5, 1.5], [0.5, -1.5], [-0.5, -1.5]]) {
      box(ctx.scene, '#fbf6ee', 0.09, 0.22, 0.09, SHRINE.x + cx, 0.11, SHRINE.z + cz).castShadow = false;
      const f = box(ctx.scene, FLAME, 0.06, 0.1, 0.06, SHRINE.x + cx, 0.27, SHRINE.z + cz);
      f.castShadow = false;
      candles.push(f);
    }

    const ranks = new Map<Npc, Rank>();
    const memberOf = (n: Npc) => everyone(ctx).find((e) => e.n === n);
    /** Seniority decides: the longest-serving member leads, the next two are priests. */
    const ordain = (): { high: number; priest: number; acolyte: number } => {
      const tally = { high: 0, priest: 0, acolyte: 0 };
      members.forEach((n, i) => {
        const rank: Rank = i === 0 && members.length >= 3 ? 'high' : i <= 2 && members.length >= 2 ? 'priest' : 'acolyte';
        tally[rank] += 1;
        if (ranks.get(n) === rank) return;
        ranks.set(n, rank);
        const m = memberOf(n);
        if (m) dress(m, rank);
      });
      return tally;
    };
    Object.assign(state, { ranks, ordain });
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant !== temple) return;
      if (members.length === 0) return tip('The hall is empty. Recruit someone, then bring them here.');
      for (const n of members) if (n.mode === 'march') Object.assign(n, { mode: 'revere', t: 0, timer: 1.6 });
      const t = ordain();
      const parts = [t.high ? '1 high priest' : '', t.priest ? `${t.priest} priest${t.priest > 1 ? 's' : ''}` : '', t.acolyte ? `${t.acolyte} acolyte${t.acolyte > 1 ? 's' : ''}` : ''];
      tip(
        t.high
          ? `Ordained: ${parts.filter(Boolean).join(', ')}. The high priest will recruit for you.`
          : `Ordained: ${parts.filter(Boolean).join(', ')}. Three members and one becomes high priest.`,
        6,
      );
      ctx.bump(0.1);
    });
    let sincePreach = 0;

    ctx.onUpdate((dt, time) => {
      clock += dt;
      // Anyone removed from the world (scripted scenes) is no longer a member.
      for (let i = members.length - 1; i >= 0; i--) {
        if (ctx.grid.at(members[i].x, members[i].z) !== members[i].occ) {
          members.splice(i, 1);
          refresh(false);
        }
      }
      // If the cube was put somewhere without rolling there (a ride, a scripted scene),
      // its old trail no longer leads to it. Start a fresh one.
      if (!cube.moving && (lead.x !== cube.x || lead.z !== cube.z)) {
        lead.x = cube.x;
        lead.z = cube.z;
        lead.trail = [];
      }
      // Only the most senior few walk with the cube. Everyone else has a place in the
      // congregation in front of the temple, and goes there.
      members.forEach((n, i) => {
        n.slot = i;
        if (i < RETINUE) {
          n.lead = lead;
          if (n.post && PEWS.includes(n.post)) n.post = null;
        } else {
          n.lead = null;
          n.post = PEWS[(i - RETINUE) % PEWS.length];
        }
      });

      preach(dt);

      if (!ready && (refill += dt) > SHRINE_REFILL) ready = true;
      idol.position.y = 1.1 + Math.sin(time * 2) * 0.05;
      idol.rotation.y += dt * (ready ? 2.2 : 0.3);
      idol.scale.setScalar(ready ? 1 + Math.sin(time * 5) * 0.08 : 0.8);

      markers.forEach((marker, ride) => {
        const on = rideReady(ride);
        showSymbol(marker, on ? 'sparkle' : null, 1, 99, 1.5 + Math.sin(time * 3) * 0.12);
        if (on) marker.position.y += Math.sin(time * 2.2) * 0.004;
      });

      // While protected, the halo flickers, and so does the charm count.
      grace = Math.max(0, grace - dt);
      if (cubeMesh) {
        cubeMesh.getWorldPosition(at);
        halo.visible = members.length >= 3 && (grace <= 0 || Math.sin(time * 22) > 0);
        hud.classList.toggle('safe', grace > 0);
        halo.position.set(at.x, at.y + 0.86 + Math.sin(time * 2.4) * 0.03, at.z);
        halo.rotation.z = time * 0.8;
        // The glow only comes when they are actually worshipping.
        const worshipped = members.length >= 6 && cube.idleFor > 2.2 && !cube.pinned;
        const glow = aura.material as THREE.MeshBasicMaterial;
        glow.opacity += ((worshipped ? 0.55 : 0) - glow.opacity) * (1 - Math.exp(-4 * dt));
        aura.position.set(at.x, 0.015, at.z);
        aura.scale.setScalar(1 + (Math.sin(time * 2.6) * 0.5 + 0.5) * 0.7);
      }

      // The temple breathes: the cube on the roof turns, the fires flicker.
      roofIdol.rotation.y += dt * 0.5;
      roofIdol.position.y = 3.95 + Math.sin(time * 1.4) * 0.06;
      [...flames, ...candles].forEach((f, i) => f.scale.set(1, 0.8 + Math.sin(time * 11 + i * 2.3) * 0.25, 1));

      // Anyone no longer a member loses their rank.
      for (const n of ranks.keys()) if (!members.includes(n)) ranks.delete(n);

      // The high priest goes out and brings someone back, now and then, for free.
      sincePreach += dt;
      const high = members.find((n) => ranks.get(n) === 'high');
      if (high && sincePreach > PREACH_EVERY && members.length < FREE_RECRUITS_UP_TO) {
        const near = everyone(ctx).find(
          (e) =>
            !e.world.staged && !e.n.cult && e.n.persona.kind !== 'leader' && !e.n.post && e.n.nx === null &&
            ['idle', 'walk', 'march'].includes(e.n.mode) && Math.abs(e.n.x - high.x) + Math.abs(e.n.z - high.z) <= 5,
        );
        if (near) {
          sincePreach = 0;
          enlist(near);
          high.emote = { kind: 'sparkle', t: 0 };
          refresh(true);
          tip('The high priest brought someone in.');
        }
      }
    });
  },
};
