import * as THREE from 'three';
import type { EmoteKind } from './brain';

/** Little symbols that pop up over a head. Drawn in code, in the game's ink and red. */
export type SymbolKind = EmoteKind | 'heartbreak' | 'charm';

const INK = '#1f2430';
const CREAM = '#fffaf0';
const RED = '#e8402a';
const PINK = '#f0609e';
const YELLOW = '#ffc933';
const cache = new Map<SymbolKind, THREE.Texture>();

function draw(kind: SymbolKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  g.lineJoin = g.lineCap = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const glyph = (text: string, size: number, y = 84) => {
    g.font = `${size}px 'Lilita One', 'Rubik Variable', system-ui, sans-serif`;
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
    // Delight, comic style: a ring of short shine marks bursting out of nothing.
    for (const [stroke, width] of [[CREAM, 26], [YELLOW, 13]] as const) {
      g.strokeStyle = stroke;
      g.lineWidth = width;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const r0 = i % 2 ? 34 : 28;
        const r1 = i % 2 ? 58 : 66;
        g.beginPath();
        g.moveTo(80 + Math.cos(a) * r0, 84 + Math.sin(a) * r0);
        g.lineTo(80 + Math.cos(a) * r1, 84 + Math.sin(a) * r1);
        g.stroke();
      }
    }
  } else if (kind === 'charm') {
    // The charm token, as in the corner of the screen: yellow, with a little cube.
    g.beginPath();
    g.arc(80, 80, 60, 0, Math.PI * 2);
    g.fillStyle = YELLOW;
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = INK;
    g.stroke();
    const cube = () => {
      g.beginPath();
      g.moveTo(80, 48);
      g.lineTo(108, 64);
      g.lineTo(108, 96);
      g.lineTo(80, 112);
      g.lineTo(52, 96);
      g.lineTo(52, 64);
      g.closePath();
    };
    cube();
    g.fillStyle = '#fff3c4';
    g.fill();
    g.lineWidth = 10;
    g.stroke();
    g.beginPath();
    g.moveTo(52, 64);
    g.lineTo(80, 80);
    g.lineTo(108, 64);
    g.moveTo(80, 80);
    g.lineTo(80, 112);
    g.stroke();
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
