import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { box, group } from '../../characters/rig';

/**
 * A small park with three rides. Roll into a ride to ride it.
 * It is a real place: it stays where it is, and a label points back to it when you leave.
 */

const INK = '#1d1b19';
const CREAM = '#fbf6ee';
const RED = '#f2542d';
const PINK = '#f6a8c4';
const BLUE = '#9fd0f5';
const LAV = '#c7b3f3';
const SUN = '#f6cf6b';
const STEEL = '#8d8a96';
const LEAF = '#8fb873';
const LEAF_DARK = '#739a5c';
const TRUNK = '#8a6248';

/** Top-left corner of the lawn, and its size in cells. */
export const PARK = { x: 8, z: -3, size: 6 };
const WHEEL = { x: 11, z: -3, height: 2.95, radius: 2.3 };
const CAROUSEL = { x: 9, z: 0 };
const TRAMPOLINE = { x: 12, z: 1 };

type RideKind = 'wheel' | 'carousel' | 'trampoline';
const SECONDS: Record<RideKind, number> = { wheel: 6.2, carousel: 5.2, trampoline: 4.0 };

function tree(parent: THREE.Object3D, x: number, z: number): void {
  const t = group(parent, x, 0, z);
  box(t, TRUNK, 0.22, 0.7, 0.22, 0, 0.35, 0);
  box(t, LEAF, 0.95, 0.7, 0.95, 0, 1.0, 0);
  box(t, LEAF_DARK, 0.7, 0.5, 0.7, 0.06, 1.55, -0.04);
  box(t, LEAF, 0.4, 0.34, 0.4, 0, 1.93, 0.03);
}

function sign(parent: THREE.Object3D, x: number, z: number): void {
  const s = group(parent, x, 0, z);
  box(s, TRUNK, 0.1, 1.2, 0.1, 0, 0.6, 0);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = CREAM;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = INK;
  g.font = "900 78px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PARK', 128, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.06), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 })),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
  ]);
  board.position.set(0, 1.25, 0);
  board.rotation.y = Math.PI / 4; // square-on to the camera
  board.castShadow = true;
  s.add(board);
}

function buildWheel(parent: THREE.Object3D) {
  const base = group(parent, WHEEL.x, 0, WHEEL.z);
  for (const s of [1, -1]) {
    for (const f of [0.22, -0.22]) {
      const leg = box(base, STEEL, 0.12, 3.2, 0.12, s * 0.75, 1.48, f);
      leg.rotation.z = s * 0.25;
    }
  }
  box(base, INK, 2.9, 0.12, 0.7, 0, 0.06, 0);
  const wheel = group(base, 0, WHEEL.height, 0);
  box(wheel, RED, 0.34, 0.34, 0.62, 0, 0, 0);
  const cars: THREE.Group[] = [];
  const colors = [PINK, BLUE, SUN, LAV, PINK, BLUE, SUN, LAV];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(wheel, CREAM, 0.07, WHEEL.radius, 0.07, Math.sin(a) * WHEEL.radius * 0.5, -Math.cos(a) * WHEEL.radius * 0.5, 0);
    spoke.rotation.z = a;
    const rim = box(wheel, CREAM, 1.82, 0.09, 0.12, Math.sin(a + Math.PI / 8) * WHEEL.radius * 0.96, -Math.cos(a + Math.PI / 8) * WHEEL.radius * 0.96, 0);
    rim.rotation.z = a + Math.PI / 8;
    // Seat 0 is left empty: that one is for the cube.
    if (i === 0) continue;
    const car = group(wheel, Math.sin(a) * WHEEL.radius, -Math.cos(a) * WHEEL.radius, 0);
    box(car, colors[i], 0.5, 0.34, 0.5, 0, -0.26, 0);
    box(car, CREAM, 0.56, 0.06, 0.56, 0, 0.02, 0);
    box(car, INK, 0.05, 0.3, 0.05, 0, -0.06, 0);
    cars.push(car);
  }
  return { wheel, cars };
}

function buildCarousel(parent: THREE.Object3D) {
  const base = group(parent, CAROUSEL.x, 0, CAROUSEL.z);
  box(base, CREAM, 2.8, 0.14, 2.8, 0, 0.07, 0);
  box(base, RED, 2.5, 0.05, 2.5, 0, 0.165, 0);
  box(base, INK, 0.2, 2.3, 0.2, 0, 1.3, 0);
  // Canopy: three stacked tiers and a knob.
  box(base, RED, 2.9, 0.14, 2.9, 0, 2.3, 0);
  box(base, CREAM, 2.2, 0.2, 2.2, 0, 2.47, 0);
  box(base, RED, 1.3, 0.2, 1.3, 0, 2.67, 0);
  box(base, SUN, 0.3, 0.3, 0.3, 0, 2.92, 0);
  const turn = group(base, 0, 0, 0);
  const mounts: THREE.Mesh[] = [];
  const colors = [PINK, BLUE, LAV, SUN];
  for (let i = 0; i < 4; i++) {
    // Offset by 45 degrees: the cube rides in the gap straight ahead.
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const m = group(turn, Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0);
    box(m, STEEL, 0.05, 2.1, 0.05, 0, 1.2, 0);
    mounts.push(box(m, colors[i], 0.38, 0.34, 0.5, 0, 0.75, 0));
    m.rotation.y = a + Math.PI / 2;
  }
  return { turn, mounts };
}

function buildTrampoline(parent: THREE.Object3D) {
  const t = group(parent, TRAMPOLINE.x, 0, TRAMPOLINE.z);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(t, STEEL, 0.08, 0.3, 0.08, x * 0.4, 0.15, z * 0.4);
  for (const s of [1, -1]) {
    box(t, BLUE, 0.96, 0.09, 0.12, 0, 0.32, s * 0.42);
    box(t, BLUE, 0.12, 0.09, 0.96, s * 0.42, 0.32, 0);
  }
  const mat = box(t, INK, 0.74, 0.03, 0.74, 0, 0.3, 0);
  return { mat };
}

export const park: Feature = {
  meta: {
    id: '003-park',
    day: 3,
    title: 'A small park with rides',
    credit: { username: 'dg._.2004', text: 'add a small park with rides', method: 'creator-pick' },
  },
  setup(ctx) {
    const root = new THREE.Group();
    ctx.scene.add(root);

    // The lawn: a soft green wash over the floor, so the grid still shows through.
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(PARK.size, PARK.size),
      new THREE.MeshBasicMaterial({ color: '#b7cf96', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(PARK.x + PARK.size / 2 - 0.5, 0.004, PARK.z + PARK.size / 2 - 0.5);
    lawn.renderOrder = -1;
    root.add(lawn);

    const { wheel, cars } = buildWheel(root);
    const { turn, mounts } = buildCarousel(root);
    const { mat } = buildTrampoline(root);
    tree(root, PARK.x, PARK.z);
    tree(root, PARK.x + 5, PARK.z);
    sign(root, PARK.x, PARK.z + 5);
    addLandmark(ctx, 'Park', PARK.x + 2.5, PARK.z + 2.5);

    // Everything solid claims its cells, so nobody walks through a ride.
    const claim = (kind: string, id: string, cells: [number, number][]) => {
      const who: Occupant = { kind, id };
      for (const [x, z] of cells) ctx.grid.claim(x, z, who);
    };
    claim('ride', 'wheel', [[10, -3], [11, -3], [12, -3]]);
    const ring: [number, number][] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ring.push([CAROUSEL.x + dx, CAROUSEL.z + dz]);
    claim('ride', 'carousel', ring);
    claim('ride', 'trampoline', [[TRAMPOLINE.x, TRAMPOLINE.z]]);
    claim('structure', 'park-decor', [[PARK.x, PARK.z], [PARK.x + 5, PARK.z], [PARK.x, PARK.z + 5]]);

    const state = { rides: 0, riding: null as RideKind | null };
    ctx.state.park = state;
    const cube = ctx.state.cube;
    const cubeMesh = ctx.scene.getObjectByName('cube');
    let ride: { kind: RideKind; t: number; from: THREE.Vector3; angle: number } | null = null;
    let wheelAngle = 0;
    let turnAngle = 0;

    const start = (kind: RideKind) => {
      if (ride || !cube || !cubeMesh || cube.pinned || cube.carried) return;
      cube.pinned = true;
      cube.carried = true;
      state.riding = kind;
      // Start the carousel from whichever side the cube came in on.
      const angle = Math.atan2(cube.x - CAROUSEL.x, cube.z - CAROUSEL.z);
      ride = { kind, t: 0, from: new THREE.Vector3(cube.x, 0.5, cube.z), angle };
      if (kind === 'wheel') wheelAngle = 0;
    };

    // Rolling into a ride is how you get on.
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant?.kind === 'ride') start(occupant.id as RideKind);
    });
    ctx.events.on<[RideKind]>('direct:park.ride', ([kind]) => start(kind));

    const smooth = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const at = new THREE.Vector3();

    ctx.onUpdate((dt, time) => {
      // The rides turn gently all the time, and properly when someone is on them.
      const onWheel = ride?.kind === 'wheel';
      const onCarousel = ride?.kind === 'carousel';
      if (!onWheel) wheelAngle += dt * 0.25;
      turnAngle += dt * (onCarousel ? 2.6 : 0.5);
      wheel.rotation.z = wheelAngle;
      for (const car of cars) car.rotation.z = -wheelAngle; // seats hang level
      turn.rotation.y = turnAngle;
      mounts.forEach((m, i) => (m.position.y = 0.75 + Math.sin(time * 2.4 + i * 1.6) * 0.16));
      mat.position.y = 0.3;

      if (!ride || !cubeMesh) return;
      ride.t += dt;
      const k = ride.t / SECONDS[ride.kind];
      const hopIn = smooth(ride.t / 0.4);
      const hopOut = smooth((SECONDS[ride.kind] - ride.t) / 0.4);
      const blend = Math.min(hopIn, hopOut); // 0 at the cube's own cell, 1 on the ride
      const hop = Math.sin(Math.PI * blend) * 0.5;
      cubeMesh.rotation.set(0, 0, 0);

      if (ride.kind === 'wheel') {
        // One full turn, sitting in the empty seat.
        const turnK = smooth((ride.t - 0.4) / (SECONDS.wheel - 0.8));
        wheelAngle = turnK * Math.PI * 2;
        at.set(
          WHEEL.x + Math.sin(wheelAngle) * WHEEL.radius,
          WHEEL.height - Math.cos(wheelAngle) * WHEEL.radius + 0.1,
          WHEEL.z + 0.5,
        );
      } else if (ride.kind === 'carousel') {
        const a = ride.angle + smooth((ride.t - 0.3) / (SECONDS.carousel - 0.6)) * Math.PI * 4;
        at.set(CAROUSEL.x + Math.sin(a) * 1.0, 0.72 + Math.sin(ride.t * 5) * 0.14, CAROUSEL.z + Math.cos(a) * 1.0);
        cubeMesh.rotation.y = a;
      } else {
        // Four bounces, each higher than the last, with a flip.
        const b = Math.min(3.999, Math.max(0, (ride.t - 0.4) / ((SECONDS.trampoline - 0.8) / 4)));
        const phase = b % 1;
        const heights = [1.3, 2.2, 3.1, 1.0];
        const h = heights[Math.floor(b)] * 4 * phase * (1 - phase);
        at.set(TRAMPOLINE.x, 0.83 + h, TRAMPOLINE.z);
        cubeMesh.rotation.x = Math.floor(b) >= 1 ? phase * Math.PI * 2 : 0;
        mat.position.y = 0.3 - Math.max(0, 0.12 - h) * 0.9;
        if (phase < dt * 4 && ride.t > 0.5) ctx.bump(0.05);
      }
      cubeMesh.position.lerpVectors(ride.from, at, blend);
      cubeMesh.position.y += hop * (1 - blend) * 2;

      if (k >= 1) {
        const { kind, from } = ride;
        ride = null;
        state.riding = null;
        state.rides += 1;
        cube.carried = false;
        ctx.events.emit('direct:cube.teleport', [from.x, from.z]);
        ctx.events.emit('park:rode', { ride: kind });
        ctx.bump(0.08);
      }
    });
  },
};
