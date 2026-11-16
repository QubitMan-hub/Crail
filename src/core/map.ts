import type { GameContext } from './game';
import { landmarks } from './landmarks';

/**
 * The map: press M (or the Map button) to see where everything and everyone is.
 * It is a small model of the world at the game's own angle: a slab of floor centred
 * on the cube, places painted on it, people and buildings standing on it as blocks,
 * and the names written flat on the ground.
 */

const INK = '#1d1b19';
const RED = '#f2542d';
/** How many cells from the cube the map reaches. Anything further sits on the edge. */
const REACH = 21;
/** How squashed the floor is, top to bottom: the game camera's own angle. */
const TILT = 0.58;
/** Thickness of the board the map sits on, in pixels. */
const SLAB = 12;
const WHO: Record<string, [string, string]> = {
  goth: ['#1d1b19', 'Goths'],
  femboy: ['#f08db4', 'Femboys'],
  leader: ['#d6b24a', 'The leader'],
  soldier: ['#6f7752', 'Soldiers'],
};
const CULT: [string, string] = ['#3b3b42', 'Your cult'];

/** A hex colour, darker (below 1) or lighter (above 1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const part = (v: number) => Math.round(Math.max(0, Math.min(255, k <= 1 ? v * k : v + (255 - v) * (k - 1) * 2)));
  return `rgb(${part(n >> 16)}, ${part((n >> 8) & 255)}, ${part(n & 255)})`;
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
  const toggle = () => {
    open = !open;
    panel.hidden = !open;
    button.setAttribute('aria-pressed', String(open));
    if (open) draw();
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
    const width = Math.min(window.innerWidth - 24, (window.innerHeight - 130) / (TILT + 0.12), 680);
    const height = Math.round(width * TILT + 46);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const cube = ctx.state.cube ?? { x: 0, z: 0 };
    const midX = width / 2;
    const midY = (height - SLAB) / 2 + 4;
    const unit = (width / 2 - 8) / (REACH * 2); // half the width of one cell's diamond
    const lift = unit * 1.05; // one cell of height, in pixels
    /** One cell along a floor axis, in floor pixels: text drawn on the floor is measured in these. */
    const cell = unit * Math.hypot(1, TILT);
    const ex = [1 / Math.hypot(1, TILT), TILT / Math.hypot(1, TILT)];

    const screen = () => g.setTransform(dpr, 0, 0, dpr, 0, 0);
    /** Draw on the floor: x runs along world +x, y along world +z, both in pixels, origin at the cube. */
    const onFloor = () => g.setTransform(dpr * ex[0], dpr * ex[1], -dpr * ex[0], dpr * ex[1], dpr * midX, dpr * midY);
    /** World position -> map pixel, at the same slant as the game camera. */
    const at = (x: number, z: number, y = 0): [number, number] => {
      const dx = x - cube.x;
      const dz = z - cube.z;
      return [midX + (dx - dz) * unit, midY + (dx + dz) * unit * TILT - y * lift];
    };
    /** A far-away spot, pulled in to the edge of the board. */
    const held = (x: number, z: number): [number, number, boolean] => {
      const k = Math.max(Math.abs(x - cube.x), Math.abs(z - cube.z)) / (REACH - 1.5);
      return k <= 1 ? [x, z, false] : [cube.x + (x - cube.x) / k, cube.z + (z - cube.z) / k, true];
    };
    const path = (points: [number, number][]) => {
      g.beginPath();
      points.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
    };
    /** A box standing on the floor: lit top, two shaded sides, like everything else in the game. */
    const block = (x: number, z: number, w: number, d: number, h: number, color: string, top = color) => {
      const [x0, x1, z0, z1] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
      g.fillStyle = shade(color, 0.62);
      path([at(x0, z1), at(x1, z1), at(x1, z1, h), at(x0, z1, h)]);
      g.fill();
      g.fillStyle = shade(color, 0.8);
      path([at(x1, z1), at(x1, z0), at(x1, z0, h), at(x1, z1, h)]);
      g.fill();
      g.fillStyle = top;
      path([at(x0, z0, h), at(x1, z0, h), at(x1, z1, h), at(x0, z1, h)]);
      g.fill();
    };
    const font = (px: number, weight = 800) => {
      g.font = `${weight} ${px}px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif`;
    };

    screen();
    g.clearRect(0, 0, width, height);

    // The board: a slab of floor, cut to a diamond around the cube.
    const R = REACH;
    const edge: [number, number][] = [at(cube.x - R, cube.z - R), at(cube.x + R, cube.z - R), at(cube.x + R, cube.z + R), at(cube.x - R, cube.z + R)];
    g.fillStyle = '#d9d0bd';
    path([edge[3], edge[2], [edge[2][0], edge[2][1] + SLAB], [edge[3][0], edge[3][1] + SLAB]]);
    g.fill();
    g.fillStyle = '#e6dfcf';
    path([edge[2], edge[1], [edge[1][0], edge[1][1] + SLAB], [edge[2][0], edge[2][1] + SLAB]]);
    g.fill();
    g.fillStyle = '#fffdf8';
    path(edge);
    g.fill();

    g.save();
    path(edge);
    g.clip();

    // A faint line every five cells.
    g.strokeStyle = 'rgba(29, 27, 25, 0.07)';
    g.lineWidth = 1;
    const cx = Math.round(cube.x / 5) * 5;
    const cz = Math.round(cube.z / 5) * 5;
    for (let i = -R - 5; i <= R + 5; i += 5) {
      for (const [a, b] of [[at(cx + i - 0.5, cz - R - 5), at(cx + i - 0.5, cz + R + 5)], [at(cx - R - 5, cz + i - 0.5), at(cx + R + 5, cz + i - 0.5)]]) {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }

    // Places that cover ground are painted onto the floor.
    const places = landmarks(ctx).filter((m) => !m.hidden);
    for (const m of places) {
      if (!m.w || !m.d) continue;
      g.fillStyle = m.color;
      path([at(m.x - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z + m.d - 0.5), at(m.x - 0.5, m.z + m.d - 0.5)]);
      g.fill();
    }

    // Names are written on the floor too, lying at the same angle as everything else.
    // One that would run into another is moved a row further along.
    const taken: [number, number, number, number][] = [];
    const later: (() => void)[] = [];
    const write = (text: string, x: number, z: number, px: number, color = INK, onTop = false) => {
      onFloor();
      font(px);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const w = g.measureText(text).width + 6;
      const h = px + 3;
      const fx = (x - cube.x) * cell;
      const limit = R * cell - w / 2 - 4;
      const u = Math.max(-limit, Math.min(limit, fx));
      const free = (v: number) => Math.abs(v) < R * cell - h / 2 && !taken.some(([qu, qv, qw, qh]) => Math.abs(u - qu) < (w + qw) / 2 && Math.abs(v - qv) < (h + qh) / 2);
      const base = (z - cube.z) * cell;
      const v = [0, 1, -1, 2, -2, 3, -3].map((row) => base + row * (h + 1)).find(free) ?? base;
      taken.push([u, v, w, h]);
      const ink = () => {
        onFloor();
        font(px);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(255, 253, 248, 0.85)';
        g.lineWidth = 3;
        g.strokeText(text, u, v);
        g.fillStyle = color;
        g.fillText(text, u, v);
        screen();
      };
      // Names of buildings go on after the blocks, so nobody stands on them.
      if (onTop) later.push(ink);
      else ink();
      screen();
    };
    // Keep names off the cube and off its own label.
    taken.push([0, 0, cell * 2.4, cell * 2.4]);
    const things: { depth: number; draw: () => void }[] = [];
    for (const m of places) {
      if (m.w && m.d) {
        const [x, z, far] = held(m.x + m.w / 2 - 0.5, m.z + m.d / 2 - 0.5);
        const inside = Math.abs(m.x + m.w / 2 - 0.5 - cube.x) < R + m.w / 2 - 4 && Math.abs(m.z + m.d / 2 - 0.5 - cube.z) < R + m.d / 2 - 4;
        // If only a corner of it is on the board, the name goes on the part that is.
        const nx = Math.max(m.x + 3, Math.min(m.x + m.w - 4, inside ? Math.max(cube.x - R + 5, Math.min(cube.x + R - 5, x)) : x));
        const nz = Math.max(m.z + 1, Math.min(m.z + m.d - 2, inside ? Math.max(cube.z - R + 3, Math.min(cube.z + R - 3, z)) : z));
        write(m.name.toUpperCase() + (far && !inside ? ' ›' : ''), inside ? nx : x, inside ? nz : z, 15, shade(m.color, 0.42));
        continue;
      }
      const [x, z, far] = held(m.x, m.z);
      write(m.name.toUpperCase() + (far ? ' ›' : ''), x, z + 2.3, 11, INK, true);
      things.push({ depth: x + z, draw: () => block(x, z, 1.5, 1.5, m.h ?? 2.2, m.color, shade(m.color, 1.12)) });
    }
    write('YOU', cube.x, cube.z + 2.1, 11, RED, true);
    g.restore();

    // People, as small blocks. Robed ones keep their own colour under a dark hood.
    const seen = new Set<string>();
    for (const { n } of (ctx.state.everyone ?? []) as { n: { x: number; z: number; cult: boolean; persona: { kind: string } } }[]) {
      const [color, label] = WHO[n.persona.kind] ?? [INK, n.persona.kind];
      seen.add(n.cult ? CULT[1] : label);
      if (Math.max(Math.abs(n.x - cube.x), Math.abs(n.z - cube.z)) > R - 1) continue;
      const boss = n.persona.kind === 'leader';
      things.push({
        depth: n.x + n.z,
        draw: () => block(n.x, n.z, boss ? 1.15 : 0.95, boss ? 1.15 : 0.95, boss ? 2 : 1.5, n.cult ? CULT[0] : color, n.cult ? color : shade(color, 1.15)),
      });
    }
    things.push({ depth: cube.x + cube.z + 0.01, draw: () => block(cube.x, cube.z, 1.5, 1.5, 1.5, RED, '#ff7a55') });
    things.sort((a, b) => a.depth - b.depth).forEach((t) => t.draw());
    later.forEach((ink) => ink());

    // The key sits in the empty corner under the board, lying at the same angle.
    let row = 0;
    for (const [color, label] of [...Object.values(WHO), CULT]) {
      if (!seen.has(label)) continue;
      const px = 14;
      const py = edge[3][1] + 30 + row++ * 17;
      if (py + (TILT * 90) > height) break;
      screen();
      const [ox, oy] = [px, py];
      const s = 4.5;
      g.fillStyle = shade(color, 0.62);
      path([[ox - s, oy], [ox, oy + s * TILT], [ox, oy + s * TILT + 6], [ox - s, oy + 6]]);
      g.fill();
      g.fillStyle = shade(color, 0.8);
      path([[ox, oy + s * TILT], [ox + s, oy], [ox + s, oy + 6], [ox, oy + s * TILT + 6]]);
      g.fill();
      g.fillStyle = label === CULT[1] ? RED : shade(color, 1.15);
      path([[ox - s, oy], [ox, oy - s * TILT], [ox + s, oy], [ox, oy + s * TILT]]);
      g.fill();
      g.setTransform(dpr * ex[0], dpr * ex[1], 0, dpr, dpr * (ox + 11), dpr * (oy + 8));
      font(10, 700);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = INK;
      g.fillText(label.toUpperCase(), 0, 0);
    }
    screen();
  }

  // Redrawn a few times a second while open: people move, and so do you.
  let since = 0;
  ctx.onUpdate((dt) => {
    if (!open || (since += dt) < 0.15) return;
    since = 0;
    draw();
  });
  window.addEventListener('resize', () => open && draw());

  return { toggle, isOpen: () => open };
}
