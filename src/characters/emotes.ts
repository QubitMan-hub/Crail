import * as THREE from 'three';
import type { EmoteKind } from './brain';

/** Little symbols that pop up over a head. Drawn in code, in the game's ink and red. */
export type SymbolKind = EmoteKind | 'heartbreak';

const INK = '#1d1b19';
const CREAM = '#f6f1e6';
const RED = '#f2542d';
const PINK = '#ee6fa4';
const cache = new Map<SymbolKind, THREE.Texture>();

function draw(kind: SymbolKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  g.lineJoin = g.lineCap = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const glyph = (text: string, size: number, y = 84) => {
    g.font = `900 ${size}px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif`;
    g.strokeStyle = CREAM;
    g.lineWidth = 20;
    g.strokeText(text, 80, y);
    g.fillStyle = INK;
    g.fillText(text, 80, y);
  };
  if (kind === 'dots') {
    for (const [stroke, r] of [[CREAM, 20], [INK, 14]] as const) {
      g.fillStyle = stroke;
      for (const x of [38, 80, 122]) {
        g.beginPath();
        g.arc(x, 86, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (kind === 'q') glyph('?', 132);
  else if (kind === 'bang') glyph('!', 132);
  else if (kind === 'note') glyph('♪', 124);
  else if (kind === 'anger') {
    // The cartoon "vein": four hooks around a centre.
    for (const [stroke, width] of [[CREAM, 30], [RED, 15]] as const) {
      g.strokeStyle = stroke;
      g.lineWidth = width;
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(80, 80);
        g.rotate((i * Math.PI) / 2);
        g.beginPath();
        g.moveTo(16, 50);
        g.quadraticCurveTo(16, 16, 50, 16);
        g.stroke();
        g.restore();
      }
    }
  } else if (kind === 'sparkle') {
    // Four-point star with a little one beside it.
    const star = (cx: number, cy: number, r: number) => {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rr = i % 2 ? r * 0.32 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
    };
    for (const [cx, cy, r] of [[70, 86, 52], [124, 40, 24]]) {
      star(cx, cy, r);
      g.strokeStyle = CREAM;
      g.lineWidth = 14;
      g.stroke();
      g.fillStyle = PINK;
      g.fill();
    }
  } else {
    // A heart: whole and pink, or red with a crack through it.
    const heart = () => {
      g.beginPath();
      g.moveTo(80, 132);
      g.bezierCurveTo(10, 86, 22, 30, 58, 30);
      g.bezierCurveTo(70, 30, 78, 38, 80, 50);
      g.bezierCurveTo(82, 38, 90, 30, 102, 30);
      g.bezierCurveTo(138, 30, 150, 86, 80, 132);
      g.closePath();
    };
    heart();
    g.strokeStyle = CREAM;
    g.lineWidth = 18;
    g.stroke();
    g.fillStyle = kind === 'heart' ? PINK : RED;
    g.fill();
    if (kind === 'heartbreak') {
      g.strokeStyle = CREAM;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(80, 44);
      g.lineTo(66, 70);
      g.lineTo(92, 88);
      g.lineTo(78, 128);
      g.stroke();
    }
  }
  return c;
}

export function symbolTexture(kind: SymbolKind): THREE.Texture {
  let t = cache.get(kind);
  if (!t) {
    t = new THREE.CanvasTexture(draw(kind));
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(kind, t);
  }
  return t;
}

export function makeSymbolSprite(): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
  s.renderOrder = 10;
  s.scale.setScalar(0);
  return s;
}

/** Pop in, hold, fade. `age` 0..`life` seconds. */
export function showSymbol(s: THREE.Sprite, kind: SymbolKind | null, age: number, life: number, size = 0.62): void {
  const m = s.material;
  if (!kind) {
    m.opacity = 0;
    s.scale.setScalar(0);
    return;
  }
  const tex = symbolTexture(kind);
  if (m.map !== tex) {
    m.map = tex;
    m.needsUpdate = true;
  }
  const k = Math.min(1, age / 0.16) - 1;
  const pop = 1 + k * k * (2.7 * k + 1.7);
  s.scale.setScalar(size * Math.max(0.001, pop));
  m.opacity = Math.min(1, (life - age) / 0.25);
}
