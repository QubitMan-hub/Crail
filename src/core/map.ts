import type { GameContext } from './game';
import { landmarks } from './landmarks';

/**
 * The map: press M (or the Map button) to see where you are and where everything is.
 *
 * It answers one question, so it says little: the places, labelled where they are;
 * you, in the middle; and people as one soft patch per group with a head count, not a
 * dot each. Red is yours (you, and your cult). The octopus is the only thing drawn on
 * its own, and only while it is out, because it may be carrying something of yours.
 * It is flat, at the same angle as the game, so "up-left" here is "up-left" on screen.
 */

const INK = '#1d1b19';
const PAPER = '#f7f2e7';
const RED = '#f2542d';
/** How many cells from the cube the map reaches. Anything further is pinned to the edge. */
const REACH = 22;
/** The octopus's name (his landmark is only used to say whether he is out). */
const OCTOPUS = 'Gåmson';
const FONT = `'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif`;

/** Who belongs to which group on the map, and how the group is shown. */
const GROUPS: Record<string, { color: string; one: string; many: string }> = {
  goth: { color: '#5b4a7a', one: 'Goth', many: 'Goths' },
  femboy: { color: '#e0679c', one: 'Femboy', many: 'Femboys' },
  army: { color: '#5f6b3a', one: 'Soldier', many: 'Army' },
  cult: { color: RED, one: 'Your follower', many: 'Your cult' },
  fighter: { color: '#c23a28', one: 'Fighter', many: 'Fighters' },
};
const groupOf = (n: Person): string => (n.cult ? 'cult' : n.persona.kind === 'leader' || n.persona.kind === 'soldier' ? 'army' : n.persona.kind);

interface Person {
  x: number;
  z: number;
  cult: boolean;
  lead: unknown;
  persona: { kind: string };
}

export function setupMap(ctx: GameContext, button: HTMLButtonElement): { toggle(): void; isOpen(): boolean } {
  const panel = document.createElement('div');
  panel.id = 'map';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Map');
  const canvas = document.createElement('canvas');
  const foot = document.createElement('p');
  foot.textContent = 'M or tap to close';
  panel.append(canvas, foot);
  document.body.appendChild(panel);
  const g = canvas.getContext('2d')!;

  let open = false;
  let openedAt = 0;
  const toggle = () => {
    open = !open;
    panel.hidden = !open;
    button.setAttribute('aria-pressed', String(open));
    if (open) {
      openedAt = performance.now();
      draw();
    }
  };
  button.addEventListener('click', () => {
    toggle();
    button.blur();
  });
  panel.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    toggle();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.metaKey && !e.ctrlKey && !e.altKey) toggle();
    else if (e.code === 'Escape' && open) toggle();
  });

  function draw(): void {
    const size = Math.max(240, Math.min(window.innerWidth - 32, window.innerHeight - 140, 560));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = canvas.height = Math.round(size * dpr);
      canvas.style.width = canvas.style.height = `${size}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const cube = ctx.state.cube ?? { x: 0, z: 0 };
    const half = size / 2;
    const pad = 22;
    const unit = (half - pad) / (REACH * 1.2);
    /** World cell -> map pixel, at the game camera's slant. */
    const at = (x: number, z: number): [number, number] => {
      const dx = x - cube.x;
      const dz = z - cube.z;
      return [half + (dx - dz) * unit, half + (dx + dz) * unit * 0.58];
    };
    const inside = (px: number, py: number, margin = pad) => px > margin && px < size - margin && py > margin && py < size - margin;
    /** Pull a point in to the edge of the card along the line from the middle. */
    const toEdge = (px: number, py: number): [number, number] => {
      const k = Math.max(Math.abs(px - half) / (half - pad), Math.abs(py - half) / (half - pad));
      return [half + (px - half) / k, half + (py - half) / k];
    };
    const font = (px: number, weight = 800) => (g.font = `${weight} ${px}px ${FONT}`);

    // The paper.
    g.fillStyle = PAPER;
    roundRect(g, 0, 0, size, size, 24);
    g.fill();
    g.save();
    roundRect(g, 0, 0, size, size, 24);
    g.clip();

    // A whisper of the floor grid, every five cells, so distance reads.
    g.strokeStyle = 'rgba(29, 27, 25, 0.045)';
    g.lineWidth = 1;
    const cx = Math.round(cube.x / 5) * 5;
    const cz = Math.round(cube.z / 5) * 5;
    for (let i = -REACH - 10; i <= REACH + 10; i += 5) {
      for (const [a, b] of [[at(cx + i - 0.5, cz - REACH - 10), at(cx + i - 0.5, cz + REACH + 10)], [at(cx - REACH - 10, cz + i - 0.5), at(cx + REACH + 10, cz + i - 0.5)]]) {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }

    // ---- Places ------------------------------------------------------------------
    // The octopus has its own marker below; its landmark only says whether it is out.
    const places = landmarks(ctx).filter((m) => !m.hidden && m.name !== OCTOPUS);
    // Grounds first (the park lawn, the pool), so everything else sits on them.
    for (const m of places) {
      if (m.cells) {
        // An irregular place: every cell it covers.
        g.fillStyle = m.color;
        for (const [x, z] of m.cells) {
          const corners = [at(x - 0.5, z - 0.5), at(x + 0.5, z - 0.5), at(x + 0.5, z + 0.5), at(x - 0.5, z + 0.5)];
          g.beginPath();
          corners.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
          g.closePath();
          g.fill();
        }
        continue;
      }
      if (!m.w || !m.d) continue;
      const corners = [at(m.x - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z + m.d - 0.5), at(m.x - 0.5, m.z + m.d - 0.5)];
      g.fillStyle = m.color;
      g.beginPath();
      corners.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
      g.closePath();
      g.fill();
    }

    // Labels keep out of each other's way, and out of yours.
    const taken: [number, number, number, number][] = [[half - 30, half - 30, 60, 52]];
    const free = (x: number, y: number, w: number, h: number) =>
      !taken.some(([qx, qy, qw, qh]) => x < qx + qw && x + w > qx && y < qy + qh && y + h > qy);
    const label = (text: string, px: number, py: number, color = INK, px2 = 11, weight = 800, track = 0.12) => {
      font(px2, weight);
      g.letterSpacing = `${track}em`;
      const w = g.measureText(text).width + 6;
      const h = px2 + 4;
      const x0 = Math.min(size - pad - w / 2, Math.max(pad + w / 2, px));
      const y = [0, 14, -14, 28, -28, 42].map((o) => py + o).find((yy) => free(x0 - w / 2, yy - h + 3, w, h));
      if (y === undefined) return;
      taken.push([x0 - w / 2, y - h + 3, w, h]);
      g.textAlign = 'center';
      g.lineJoin = 'round';
      g.strokeStyle = PAPER;
      g.lineWidth = 4;
      g.strokeText(text, x0, y);
      g.fillStyle = color;
      g.fillText(text, x0, y);
      g.letterSpacing = '0em';
    };

    const edgeMarks: (() => void)[] = [];
    for (const m of places) {
      // Shaped places (cells) are labelled at (x, z); rectangles in their middle.
      const area = !!(m.w && m.d) || !!m.cells;
      const mx = m.x + (m.w && m.d ? m.w / 2 - 0.5 : 0);
      const mz = m.z + (m.w && m.d ? m.d / 2 - 0.5 : 0);
      const [px, py] = at(mx, mz);
      if (!inside(px, py)) {
        // Off the map: a small pointer on the edge, with the name beside it.
        const [ex, ey] = toEdge(px, py);
        const angle = Math.atan2(py - half, px - half);
        edgeMarks.push(() => {
          g.save();
          g.translate(ex, ey);
          g.rotate(angle);
          g.fillStyle = INK;
          g.globalAlpha = 0.55;
          g.beginPath();
          g.moveTo(7, 0);
          g.lineTo(-3, -5);
          g.lineTo(-3, 5);
          g.closePath();
          g.fill();
          g.restore();
          label(m.name.toUpperCase(), ex - Math.cos(angle) * 30, ey - Math.sin(angle) * 14 + 4, 'rgba(29, 27, 25, 0.62)', 10, 800, 0.1);
        });
        continue;
      }
      if (!area) {
        // A building: a small solid diamond in its own colour.
        g.fillStyle = m.color;
        g.strokeStyle = PAPER;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px, py - 6);
        g.lineTo(px + 7, py);
        g.lineTo(px, py + 6);
        g.lineTo(px - 7, py);
        g.closePath();
        g.fill();
        g.stroke();
      }
      label(m.name.toUpperCase(), px, py + (area ? 4 : -11));
    }

    // ---- People: one patch per group, not a dot each -------------------------------
    const people = (ctx.state.everyone ?? []).map((m: { n: Person }) => m.n) as Person[];
    const clusters: { group: string; xs: number[]; zs: number[]; x: number; z: number }[] = [];
    // Your cult: the few walking with you are part of you, and the rest belong to the
    // temple, so they show as one patch there even while they are still walking over.
    const temple = places.find((m) => m.name === 'Temple');
    const congregation = people.filter((n) => n.cult && !n.lead);
    if (temple && congregation.length) {
      clusters.push({ group: 'cult', xs: congregation.map(() => temple.x), zs: congregation.map(() => temple.z + 4), x: temple.x, z: temple.z + 4 });
    }
    for (const n of people) {
      if (n.cult && (n.lead || temple)) continue;
      const group = groupOf(n);
      if (!GROUPS[group]) continue;
      const c = clusters.find((k) => k.group === group && Math.abs(k.x - n.x) + Math.abs(k.z - n.z) <= 6);
      if (c) {
        c.xs.push(n.x);
        c.zs.push(n.z);
        c.x = c.xs.reduce((a, b) => a + b, 0) / c.xs.length;
        c.z = c.zs.reduce((a, b) => a + b, 0) / c.zs.length;
      } else clusters.push({ group, xs: [n.x], zs: [n.z], x: n.x, z: n.z });
    }
    for (const c of clusters) {
      const [px, py] = at(c.x, c.z);
      if (!inside(px, py, pad + 6)) continue;
      const spread = c.group === 'cult' && temple ? 2 : Math.max(...c.xs.map((x, i) => Math.hypot(x - c.x, c.zs[i] - c.z)));
      const r = Math.min(46, 10 + spread * unit * 1.1 + Math.sqrt(c.xs.length) * 3);
      const { color, one, many } = GROUPS[c.group];
      const glow = g.createRadialGradient(px, py, 0, px, py, r);
      glow.addColorStop(0, hexA(color, 0.3));
      glow.addColorStop(0.65, hexA(color, 0.14));
      glow.addColorStop(1, hexA(color, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
      const count = c.xs.length;
      label(count === 1 ? one : `${many} ${count}`, px, py + 4, color, 10, 800, 0.04);
    }

    // The octopus, while it is out: its own colour, a ring, and its name.
    const o = ctx.state.octopus as { x: number; z: number; mode: string; carrying: string[] } | undefined;
    const octoOut = o && !(o.mode === 'lurk' && landmarks(ctx).find((m) => m.name === OCTOPUS)?.hidden);
    if (o && octoOut) {
      const [px, py] = at(o.x, o.z);
      if (inside(px, py, pad + 4)) {
        g.fillStyle = '#2f9c95';
        g.beginPath();
        g.arc(px, py, 4.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(47, 156, 149, 0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(px, py, 8.5, 0, Math.PI * 2);
        g.stroke();
        label(o.carrying.length ? `${OCTOPUS} · ${o.carrying.length} stolen` : OCTOPUS, px, py - 12, '#237a75', 10, 800, 0.04);
      }
    }

    edgeMarks.forEach((f) => f());

    // ---- You, always in the middle -------------------------------------------------
    // One slow pulse, the map's only animation, so the eye finds you first.
    const t = (performance.now() - openedAt) / 1000;
    const pulse = (t % 1.8) / 1.8;
    g.strokeStyle = hexA(RED, 0.45 * (1 - pulse));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(half, half, 9 + pulse * 16, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = RED;
    g.strokeStyle = PAPER;
    g.lineWidth = 2.5;
    g.beginPath();
    g.rect(half - 6, half - 6, 12, 12);
    g.fill();
    g.stroke();
    font(10, 800);
    g.letterSpacing = '0.14em';
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.fillText('YOU', half, half + 22);
    g.letterSpacing = '0em';
    g.restore();

    // The card's edge.
    g.strokeStyle = 'rgba(29, 27, 25, 0.1)';
    g.lineWidth = 1;
    roundRect(g, 0.5, 0.5, size - 1, size - 1, 24);
    g.stroke();
  }

  // Redrawn a few times a second while open: groups drift, and so do you.
  let since = 0;
  ctx.onUpdate((dt) => {
    if (!open || (since += dt) < 0.1) return;
    since = 0;
    draw();
  });
  window.addEventListener('resize', () => open && draw());

  return { toggle, isOpen: () => open };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A hex colour with some transparency. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
