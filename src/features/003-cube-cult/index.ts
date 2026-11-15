import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import type { DirIndex, Lead, Npc } from '../../characters/brain';
import type { Member } from '../../characters/cast';
import { box, group, mat } from '../../characters/rig';

/**
 * The Cult of the Cube. Earn a charm (ride a ride, or visit the shrine), then bump
 * into anyone: they put on a red hood and follow the cube from then on. Stop moving
 * and they gather in a circle and worship. This is the first thing in the game that
 * is a game: there is something to collect, and something to do with it.
 */

const RED = '#f2542d';
const INK = '#1d1b19';
const STONE = '#a59f96';
const STONE_DARK = '#8b857c';
const FLAME = '#ffb23e';

export const SHRINE = { x: -8, z: -1 };
const MAX_CHARMS = 5;
const SHRINE_REFILL = 25;
const FOLLOW_SPEED = 2.4;

/** A red hood with the cube's dot on the brow. Fits over whatever they were wearing. */
function buildHood(headTop: number): THREE.Group {
  const hood = new THREE.Group();
  const lift = Math.max(0, headTop - 0.6);
  box(hood, RED, 0.64, 0.24 + lift, 0.62, 0, 0.5 + lift / 2, -0.02);
  box(hood, RED, 0.64, 0.5, 0.1, 0, 0.3, -0.3);
  for (const s of [1, -1]) box(hood, RED, 0.08, 0.44, 0.5, s * 0.3, 0.34, -0.08);
  box(hood, RED, 0.3, 0.3, 0.3, 0, 0.72 + lift, -0.16).rotation.x = -0.5; // the point
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), mat(INK));
  dot.position.set(0, 0.52 + lift / 2, 0.292);
  hood.add(dot);
  hood.name = 'hood';
  return hood;
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
    const state = {
      charms: 0,
      members,
      /** Called when the cube bumps someone. True if that bump recruited them. */
      tryRecruit(m: Member): boolean {
        const n = m.n;
        if (state.charms <= 0 || n.cult) return false;
        if (['hop', 'sit', 'hang', 'plop', 'rise', 'hopOff'].includes(n.mode)) return false;
        state.charms -= 1;
        n.cult = true;
        n.lead = lead;
        n.speed = FOLLOW_SPEED;
        n.focus = null;
        n.wait = 0;
        n.mode = 'revere';
        n.t = 0;
        n.timer = 1.5;
        n.emote = { kind: 'heart', t: 0 };
        m.rig.head.add(buildHood(m.rig.headTop));
        members.push(n);
        ctx.bump(0.1);
        ctx.events.emit('cult:joined', { id: n.id });
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
        if (members.length === 0) tip('Bump into someone to recruit them');
      }
    };
    ctx.events.on('park:rode', () => gain());
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
      if (!ready) return;
      ready = false;
      refill = 0;
      gain();
    });

    // ---- The counter in the corner ---------------------------------------------
    const hud = document.createElement('div');
    hud.id = 'cult';
    hud.className = 'hud';
    const charmsEl = document.createElement('span');
    const membersEl = document.createElement('span');
    hud.append(charmsEl, membersEl);
    document.body.appendChild(hud);
    function refresh(bump: boolean) {
      charmsEl.innerHTML = `<b>✦</b> ${state.charms}`;
      charmsEl.title = 'Charms';
      membersEl.textContent = `Cult ${members.length}`;
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
      tipFor = 4.5;
    }

    ctx.onUpdate((dt, time) => {
      // Anyone removed from the world (scripted scenes) is no longer a member.
      for (let i = members.length - 1; i >= 0; i--) {
        if (ctx.grid.at(members[i].x, members[i].z) !== members[i].occ) {
          members.splice(i, 1);
          refresh(false);
        }
      }
      members.forEach((n, i) => {
        n.slot = i;
        n.lead = lead;
      });

      if (!ready && (refill += dt) > SHRINE_REFILL) ready = true;
      idol.position.y = 1.1 + Math.sin(time * 2) * 0.05;
      idol.rotation.y += dt * (ready ? 2.2 : 0.3);
      idol.scale.setScalar(ready ? 1 + Math.sin(time * 5) * 0.08 : 0.8);

      if (tipFor > 0 && (tipFor -= dt) <= 0) hint?.classList.add('gone');
    });
  },
};
