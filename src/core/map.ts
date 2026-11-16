import type { GameContext } from './game';
import { landmarks } from './landmarks';

/**
 * The map: press M (or the Map button) to see where everything and everyone is.
 * It is drawn at the same angle as the game, so "up-left" on the map is "up-left"
 * on screen, and it is centred on the cube.
 */

const INK = '#1d1b19';
const RED = '#f2542d';
/** How many cells from the cube the map reaches. Anything further sits on the edge. */
const REACH = 21;
const WHO: Record<string, [string, string]> = {
  goth: ['#1d1b19', 'Goths'],
  femboy: ['#f08db4', 'Femboys'],
  leader: ['#d6b24a', 'The leader'],
  soldier: ['#6f7752', 'Soldiers'],
};
const CULT: [string, string] = ['#3b3b42', 'Your cult'];

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
    const size = Math.min(window.innerWidth - 32, window.innerHeight - 150, 560);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = canvas.height = Math.round(size * dpr);
      canvas.style.width = canvas.style.height = `${size}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const cube = ctx.state.cube ?? { x: 0, z: 0 };
    const half = size / 2;
    const unit = (half - 26) / (REACH * 2); // a cell, along one diamond axis
    /** World cell -> map pixel, same slant as the game camera. */
    const at = (x: number, z: number): [number, number] => {
      const dx = x - cube.x;
      const dz = z - cube.z;
      return [half + (dx - dz) * unit, half + (dx + dz) * unit * 0.58];
    };
    /** The same, but held inside the map's edge if it is too far away. */
    const held = (x: number, z: number): [number, number, boolean] => {
      const [px, py] = at(x, z);
      const k = Math.max(Math.abs(px - half) / (half - 16), Math.abs(py - half) / (half - 16));
      return k <= 1 ? [px, py, false] : [half + (px - half) / k, half + (py - half) / k, true];
    };
    const font = (px: number, weight = 800) => {
      g.font = `${weight} ${px}px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif`;
    };

    // The floor: a faint line every five cells.
    g.strokeStyle = 'rgba(29, 27, 25, 0.07)';
    g.lineWidth = 1;
    const cx = Math.round(cube.x / 5) * 5;
    const cz = Math.round(cube.z / 5) * 5;
    for (let i = -REACH - 5; i <= REACH + 5; i += 5) {
      for (const [a, b] of [[at(cx + i, cz - REACH - 5), at(cx + i, cz + REACH + 5)], [at(cx - REACH - 5, cz + i), at(cx + REACH + 5, cz + i)]]) {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }

    // Labels keep out of each other's way: one that would overlap is nudged down a line.
    const placed: [number, number, number, number][] = [[half - 20, half - 24, 40, 30]];
    const label = (name: string, credit: string, px: number, py: number) => {
      font(11);
      const w = Math.max(g.measureText(name).width, credit ? g.measureText(credit).width * 0.85 : 0) + 8;
      const h = credit ? 24 : 13;
      const x = Math.min(size - w / 2 - 4, Math.max(w / 2 + 4, px));
      // Try just below the mark, then just above it, then further and further below.
      const clear = (y: number) =>
        !placed.some(([qx, qy, qw, qh]) => x - w / 2 < qx + qw && x + w / 2 > qx && y - 10 < qy + qh && y - 10 + h > qy);
      const y = [0, -(h + 22), 14, 28, 42, 56].map((off) => py + off).find(clear) ?? py;
      placed.push([x - w / 2, y - 10, w, h]);
      g.lineJoin = 'round';
      g.strokeStyle = '#fffdf8';
      g.lineWidth = 3.5;
      font(11);
      g.strokeText(name, x, y);
      g.fillStyle = INK;
      g.fillText(name, x, y);
      if (!credit) return;
      font(9, 600);
      g.strokeText(credit, x, y + 11);
      g.fillStyle = 'rgba(29, 27, 25, 0.62)';
      g.fillText(credit, x, y + 11);
    };

    // Places.
    g.textAlign = 'center';
    for (const m of landmarks(ctx)) {
      if (m.hidden) continue;
      const midX = m.x + (m.w ? m.w / 2 - 0.5 : 0);
      const midZ = m.z + (m.d ? m.d / 2 - 0.5 : 0);
      const [px, py, far] = held(midX, midZ);
      if (m.w && m.d && !far) {
        const corners = [at(m.x - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z - 0.5), at(m.x + m.w - 0.5, m.z + m.d - 0.5), at(m.x - 0.5, m.z + m.d - 0.5)];
        g.fillStyle = m.color;
        g.beginPath();
        corners.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = m.color;
        g.strokeStyle = '#fffdf8';
        g.lineWidth = 2;
        g.beginPath();
        g.rect(px - 5, py - 5, 10, 10);
        g.fill();
        g.stroke();
      }
      label(m.name.toUpperCase() + (far ? ' ›' : ''), '', px, py + (m.w && !far ? 4 : 19));
    }

    // People.
    const seen = new Set<string>();
    for (const { n } of (ctx.state.everyone ?? []) as { n: { x: number; z: number; cult: boolean; persona: { kind: string } } }[]) {
      const [color, label] = n.cult ? CULT : (WHO[n.persona.kind] ?? [INK, n.persona.kind]);
      seen.add(label);
      const [px, py, far] = held(n.x, n.z);
      if (far) continue;
      g.fillStyle = color;
      g.beginPath();
      g.arc(px, py, n.persona.kind === 'leader' && !n.cult ? 4.5 : 3, 0, Math.PI * 2);
      g.fill();
      if (n.cult) {
        g.strokeStyle = RED;
        g.lineWidth = 1.5;
        g.stroke();
      }
    }

    // The cube, always in the middle.
    g.fillStyle = RED;
    g.strokeStyle = '#fffdf8';
    g.lineWidth = 2.5;
    g.beginPath();
    g.rect(half - 6, half - 6, 12, 12);
    g.fill();
    g.stroke();
    font(10);
    g.fillStyle = INK;
    g.fillText('YOU', half, half - 11);

    // Legend, bottom-left: only the kinds that exist right now.
    g.textAlign = 'left';
    font(10, 700);
    let row = 0;
    for (const [color, label] of [...Object.values(WHO), CULT]) {
      if (!seen.has(label)) continue;
      const y = size - 12 - row++ * 15;
      g.fillStyle = color;
      g.beginPath();
      g.arc(14, y - 3.5, 3.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = INK;
      g.fillText(label, 24, y);
    }
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
