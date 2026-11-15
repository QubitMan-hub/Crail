import * as THREE from 'three';
import type { GameContext } from './game';

/**
 * A named place in the world. While it is off-screen, a small label sits at the edge
 * of the screen pointing toward it, so places are worth walking back to.
 */
export function addLandmark(ctx: GameContext, name: string, x: number, z: number): void {
  const el = document.createElement('div');
  el.className = 'landmark';
  const arrow = document.createElement('i');
  arrow.textContent = '➤';
  const label = document.createElement('span');
  label.textContent = name;
  el.append(label, arrow);
  document.body.appendChild(el);

  const p = new THREE.Vector3();
  ctx.onUpdate(() => {
    p.set(x, 0.5, z).project(ctx.camera);
    const off = Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.86;
    el.classList.toggle('shown', off);
    if (!off) return;
    // Pin the label to the screen edge along the line from the centre to the place.
    const k = Math.min(0.84 / Math.abs(p.x || 1e-6), 0.74 / Math.abs(p.y || 1e-6));
    const ex = p.x * k;
    const ey = p.y * k;
    el.style.left = `${(ex * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-ey * 0.5 + 0.5) * 100}%`;
    arrow.style.transform = `rotate(${Math.atan2(-p.y, p.x)}rad)`;
  });
}
