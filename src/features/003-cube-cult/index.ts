import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { tip } from '../../core/tip';
import type { DirIndex, Lead, Npc } from '../../characters/brain';
import { everyone, type Member } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { box, fuse, group, HIP, mat } from '../../characters/rig';

/**
 * The Cult of the Cube. Earn a charm (ride a ride, or visit the shrine), then bump
 * into anyone but the leader: they put on the robe and follow the cube from then on.
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
type Rank = 'acolyte' | 'priest' | 'high';
/** How often the high priest goes out and brings someone back, in seconds. */
const PREACH_EVERY = 45;
const GOLD = '#d6b24a';
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
 * hood with nothing visible inside it. Whoever they were, they look like this now.
 * The only colour is a small red cube on a cord, and any bow they refuse to give up.
 */
function robe(m: Member): void {
  const { rig, n } = m;
  const wide = n.persona.kind === 'leader' ? 1.22 : 1;
  const bow = rig.head.getObjectByName('bow');
  for (const part of [rig.torso, rig.head, rig.armL, rig.armR, rig.legL, rig.legR]) {
    for (const child of part.children) child.visible = false;
  }
  rig.stride = 0; // nothing under there to see moving

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
  box(skirt, ROBE_LIGHT, 0.7 * wide, 0.1, 0.52, 0, -0.71, 0);
  box(skirt, ROPE, 0.62 * wide, 0.05, 0.44, 0, 0.05, 0);
  box(skirt, ROPE, 0.05, 0.3, 0.05, 0.14 * wide, -0.1, 0.23);
  fuse(skirt);

  for (const arm of [rig.armL, rig.armR]) {
    const sleeve = group(arm);
    box(sleeve, ROBE, 0.2, 0.5, 0.24, 0, -0.2, 0);
    box(sleeve, ROBE, 0.27, 0.16, 0.32, 0, -0.5, 0); // bell cuff
    box(sleeve, VOID, 0.2, 0.02, 0.25, 0, -0.585, 0);
    fuse(sleeve);
  }

  const hood = group(rig.head);
  box(hood, VOID, 0.5, 0.52, 0.5, 0, 0.3, 0); // where a face would be
  box(hood, ROBE, 0.72, 0.16, 0.76, 0, 0.63, 0.02);
  box(hood, ROBE, 0.72, 0.7, 0.12, 0, 0.32, -0.32);
  for (const side of [1, -1]) box(hood, ROBE, 0.11, 0.7, 0.66, side * 0.305, 0.32, 0.03);
  box(hood, ROBE_LIGHT, 0.72, 0.09, 0.1, 0, 0.57, 0.37); // the brim droops forward
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

    const members: Npc[] = [];
    let clock = 0;

    /** Put the robe on, fall in behind the cube. No charge: the caller has dealt with that. */
    const enlist = (m: Member) => {
      const n = m.n;
      n.cult = true;
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
      /** Called when the cube bumps someone. True if that bump recruited them. */
      tryRecruit(m: Member): boolean {
        const n = m.n;
        if (state.charms <= 0 || n.cult) return false;
        if (['hop', 'sit', 'hang', 'plop', 'rise', 'hopOff', 'riding'].includes(n.mode)) return false;
        if (n.persona.kind === 'leader') {
          // He cannot be recruited. He reacts the way he reacts to everything: by pointing.
          tip('He answers to no one. Least of all a cube.');
          return false;
        }
        const cost = COST[n.persona.kind] ?? 1;
        if (state.charms < cost) {
          // Not enough. They react the way they always did, and you learn the price.
          tip(`${NAMES[n.persona.kind] ?? 'They'} cost ✦${cost}. You have ✦${state.charms}.`);
          return false;
        }
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
        if (members.length === 0) tip('Bump into someone to recruit them. Goths cost ✦2.');
      }
    };

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
    addLandmark(ctx, 'Temple', SHRINE.x - 1.5, SHRINE.z - 1.5);
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
      members.forEach((n, i) => {
        n.slot = i;
        n.lead = lead;
      });

      if (!ready && (refill += dt) > SHRINE_REFILL) ready = true;
      idol.position.y = 1.1 + Math.sin(time * 2) * 0.05;
      idol.rotation.y += dt * (ready ? 2.2 : 0.3);
      idol.scale.setScalar(ready ? 1 + Math.sin(time * 5) * 0.08 : 0.8);

      markers.forEach((marker, ride) => {
        const on = rideReady(ride);
        showSymbol(marker, on ? 'sparkle' : null, 1, 99, 1.5 + Math.sin(time * 3) * 0.12);
        if (on) marker.position.y += Math.sin(time * 2.2) * 0.004;
      });

      if (cubeMesh) {
        cubeMesh.getWorldPosition(at);
        halo.visible = members.length >= 3;
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
      if (high && sincePreach > PREACH_EVERY) {
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
