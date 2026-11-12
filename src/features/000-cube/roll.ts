import * as THREE from 'three';
import type { Dir } from '../../core/input';

export interface Cell {
  x: number;
  z: number;
}

/** Next roll that brings `from` closer to `to`, longest axis first. Null when there. */
export function stepToward(from: Cell, to: Cell): Dir | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 0 && dz === 0) return null;
  if (Math.abs(dx) >= Math.abs(dz)) return { dx: Math.sign(dx) as 1 | -1, dz: 0 };
  return { dx: 0, dz: Math.sign(dz) as 1 | -1 };
}

/** A cube tips slowly, then falls fast. */
export function rollEase(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return Math.pow(c, 1.7);
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Pose of a unit cube part-way through rolling over its bottom edge.
 * `t` runs 0..1; at 1 the cube has moved exactly one cell.
 */
export function rollPose(
  startPos: THREE.Vector3,
  startQuat: THREE.Quaternion,
  dir: Dir,
  t: number,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): void {
  const d = new THREE.Vector3(dir.dx, 0, dir.dz);
  const axis = new THREE.Vector3().crossVectors(UP, d);
  const pivot = new THREE.Vector3(startPos.x + d.x * 0.5, 0, startPos.z + d.z * 0.5);
  const q = new THREE.Quaternion().setFromAxisAngle(axis, rollEase(t) * (Math.PI / 2));
  outPos.copy(startPos).sub(pivot).applyQuaternion(q).add(pivot);
  outQuat.copy(q).multiply(startQuat);
}

/** Snap a quaternion that should be a multiple of 90 degrees, killing float drift. */
export function snapQuat(q: THREE.Quaternion): THREE.Quaternion {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  m.elements.forEach((v, i) => (m.elements[i] = Math.round(v)));
  return q.setFromRotationMatrix(m).normalize();
}
