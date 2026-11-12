import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rollPose, snapQuat, stepToward } from '../../src/features/000-cube/roll';

describe('stepToward', () => {
  it('stops at the target', () => {
    expect(stepToward({ x: 2, z: -1 }, { x: 2, z: -1 })).toBeNull();
  });
  it('takes the longer axis first and reaches the target', () => {
    const pos = { x: 0, z: 0 };
    const to = { x: -3, z: 5 };
    expect(stepToward(pos, to)).toEqual({ dx: 0, dz: 1 });
    let steps = 0;
    for (let d = stepToward(pos, to); d; d = stepToward(pos, to)) {
      pos.x += d.dx;
      pos.z += d.dz;
      steps++;
    }
    expect(pos).toEqual(to);
    expect(steps).toBe(8);
  });
});

describe('rollPose', () => {
  const start = new THREE.Vector3(0, 0.5, 0);
  const q0 = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  it.each([
    [{ dx: 1, dz: 0 }, [1, 0.5, 0]],
    [{ dx: -1, dz: 0 }, [-1, 0.5, 0]],
    [{ dx: 0, dz: 1 }, [0, 0.5, 1]],
    [{ dx: 0, dz: -1 }, [0, 0.5, -1]],
  ] as const)('ends exactly one cell over for %j', (dir, end) => {
    rollPose(start, q0, dir, 1, pos, quat);
    expect(pos.x).toBeCloseTo(end[0]);
    expect(pos.y).toBeCloseTo(end[1]);
    expect(pos.z).toBeCloseTo(end[2]);
  });

  it('lifts the centre mid-roll and tips the top face forward', () => {
    rollPose(start, q0, { dx: 1, dz: 0 }, 0.6, pos, quat);
    expect(pos.y).toBeGreaterThan(0.5);
    rollPose(start, q0, { dx: 1, dz: 0 }, 1, pos, quat);
    const top = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    expect(top.x).toBeCloseTo(1);
    expect(top.y).toBeCloseTo(0);
  });

  it('stays axis-aligned after many snapped rolls', () => {
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3(0, 0.5, 0);
    const dirs = [{ dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }, { dx: 0, dz: -1 }] as const;
    for (let i = 0; i < 400; i++) {
      rollPose(p.clone(), q.clone(), dirs[(i * 7) % 4], 1, p, q);
      snapQuat(q);
    }
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
    for (const v of m.elements) expect(Math.abs(v - Math.round(v))).toBeLessThan(1e-9);
  });
});
