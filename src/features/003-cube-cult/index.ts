import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import type { DirIndex, Lead, Npc } from '../../characters/brain';
import { everyone, type Member } from '../../characters/cast';
import { makeSymbolSprite, showSymbol } from '../../characters/emotes';
import { box, fuse, group, HIP, mat } from '../../characters/rig';

/**
 * The Cult of the Cube. Earn a charm (ride a ride, or visit the shrine), then bump
 * into anyone: they put on the robe and follow the cube from then on. Stop moving
 * and they gather in a circle and worship. This is the first thing in the game that
 * is a game: there is something to collect, and something to do with it.
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
/** What it takes to recruit each kind. The leader is dear, but his soldiers follow him for free. */
const COST: Record<string, number> = { soldier: 1, femboy: 1, goth: 2, leader: 3 };
const NAMES: Record<string, string> = { soldier: 'Soldiers', femboy: 'Femboys', goth: 'Goths', leader: 'The leader' };
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
        const cost = COST[n.persona.kind] ?? 1;
        if (state.charms < cost) {
          // Not enough. They react the way they always did, and you learn the price.
          tip(`${NAMES[n.persona.kind] ?? 'They'} cost ✦${cost}. You have ✦${state.charms}.`);
          return false;
        }
        state.charms -= cost;
        enlist(m);
        if (n.persona.kind === 'leader') {
          // Recruit the leader and his whole army comes with him. That is called a coup.
          const army = everyone(ctx).filter((e) => e.n.persona.kind === 'soldier' && !e.n.cult && e.n.mode !== 'riding');
          for (const soldier of army) enlist(soldier);
          if (army.length) tip(`A coup. ${army.length} soldier${army.length > 1 ? 's' : ''} joined for free.`);
          ctx.events.emit('cult:coup', { soldiers: army.length });
        }
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
    addLandmark(ctx, 'Shrine', SHRINE.x, SHRINE.z);
    let refill = SHRINE_REFILL - 4;
    let ready = false;
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant !== shrine) return;
      // Everyone bows when the cube visits its own shrine.
      for (const n of members) if (n.mode === 'march') Object.assign(n, { mode: 'revere', t: 0, timer: 1.4 });
      if (!ready) return tip('The shrine is not ready yet.');
      ready = false;
      refill = 0;
      // A bigger congregation gives more: one charm, plus one for every three members.
      const tithe = 1 + Math.floor(members.length / 3);
      gain(tithe);
      if (tithe > 1) tip(`The congregation gives ✦${tithe}.`);
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
    const hint = document.getElementById('hint');
    let tipFor = 0;
    function tip(text: string) {
      if (!hint) return;
      hint.textContent = text;
      hint.classList.remove('gone');
      tipFor = 5;
    }

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

      if (tipFor > 0 && (tipFor -= dt) <= 0) hint?.classList.add('gone');
    });
  },
};
