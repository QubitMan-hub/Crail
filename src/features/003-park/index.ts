import * as THREE from 'three';
import type { Feature } from '../../core/feature';
import type { Occupant } from '../../core/grid';
import { addLandmark } from '../../core/landmarks';
import { seededRandom } from '../../core/rng';
import { everyone, type Member } from '../../characters/cast';
import { box, fuse, group, HIP } from '../../characters/rig';

/**
 * The park. A real place with a gate, paths, a fountain and three rides big enough
 * for the cube and for anyone else who wanders in: a ferris wheel, a carousel and a
 * trampoline. Roll into a ride to get on. Everyone else queues up on their own.
 */

const INK = '#1d1b19';
const CREAM = '#fbf6ee';
const RED = '#f2542d';
const PINK = '#f6a8c4';
const BLUE = '#9fd0f5';
const LAV = '#c7b3f3';
const SUN = '#f6cf6b';
const STEEL = '#8d8a96';
const STONE = '#b3ada3';
const WATER = '#8cc9ea';
const LEAF = '#8fb873';
const LEAF_DARK = '#739a5c';
const PINE = '#5f8a66';
const TRUNK = '#8a6248';
const WOOD = '#b98a62';
const PASTELS = [PINK, BLUE, SUN, LAV];

/** The lawn: top-left cell and size. The gate is on the west side, facing where the game starts. */
export const PARK = { x: 9, z: -7, w: 15, d: 13, gate: { x: 9, z: 0 } };
const WHEEL = { x: 19, z: -6, hub: 4.35, radius: 3.4, seats: 8, speed: 0.7 };
const CAROUSEL = { x: 13, z: -4, radius: 1.75, seats: 8, speed: 0.95, seconds: 8 };
const TRAMPOLINE = { x: 13, z: 3, top: 0.44, seconds: 5.5 };
const TRAMPOLINE_SPOTS = [[0, 0], [0.75, 0.7], [-0.75, 0.7], [0.75, -0.7], [-0.75, -0.7]];

type RideKind = 'wheel' | 'carousel' | 'trampoline';
const KINDS: RideKind[] = ['wheel', 'carousel', 'trampoline'];
const CAPACITY: Record<RideKind, number> = { wheel: WHEEL.seats, carousel: CAROUSEL.seats, trampoline: TRAMPOLINE_SPOTS.length };
const HOP = 0.45;

interface Rider {
  who: 'cube' | Member;
  kind: RideKind;
  seat: number;
  t: number;
  /** Where they got on, and so where they get off. */
  from: THREE.Vector3;
  /** Wheel only: how far the wheel had turned when they boarded. */
  startAngle: number;
  leaving: number;
}

// ---- Scenery ------------------------------------------------------------------

function roundTree(p: THREE.Object3D, x: number, z: number, s = 1): void {
  const t = group(p, x, 0, z);
  t.scale.setScalar(s);
  box(t, TRUNK, 0.24, 0.8, 0.24, 0, 0.4, 0);
  box(t, LEAF, 1.05, 0.75, 1.05, 0, 1.1, 0);
  box(t, LEAF_DARK, 0.78, 0.55, 0.78, 0.06, 1.7, -0.04);
  box(t, LEAF, 0.44, 0.38, 0.44, 0, 2.12, 0.03);
}

function pine(p: THREE.Object3D, x: number, z: number, s = 1): void {
  const t = group(p, x, 0, z);
  t.scale.setScalar(s);
  box(t, TRUNK, 0.2, 0.6, 0.2, 0, 0.3, 0);
  [1.0, 0.78, 0.56, 0.34].forEach((w, i) => box(t, i % 2 ? LEAF_DARK : PINE, w, 0.46, w, 0, 0.75 + i * 0.42, 0));
}

function lamp(p: THREE.Object3D, x: number, z: number, bulbs: THREE.Mesh[]): void {
  const l = group(p, x, 0, z);
  box(l, INK, 0.2, 0.12, 0.2, 0, 0.06, 0);
  box(l, INK, 0.08, 2.0, 0.08, 0, 1.05, 0);
  box(l, INK, 0.3, 0.06, 0.3, 0, 2.08, 0);
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.26, 0.24),
    new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffc94d', emissiveIntensity: 0.9 }),
  );
  bulb.position.set(x, 2.25, z);
  bulbs.push(bulb);
}

function bench(p: THREE.Object3D, x: number, z: number): void {
  const b = group(p, x, 0, z);
  box(b, WOOD, 0.9, 0.07, 0.36, 0, 0.36, 0.04);
  box(b, WOOD, 0.9, 0.3, 0.06, 0, 0.6, -0.14);
  for (const s of [1, -1]) box(b, INK, 0.07, 0.36, 0.34, s * 0.38, 0.18, 0.04);
}

function fountain(p: THREE.Object3D, x: number, z: number): void {
  const f = group(p, x, 0, z);
  box(f, STONE, 0.96, 0.24, 0.96, 0, 0.12, 0);
  box(f, WATER, 0.8, 0.05, 0.8, 0, 0.245, 0);
  box(f, STONE, 0.22, 0.7, 0.22, 0, 0.55, 0);
  box(f, STONE, 0.56, 0.1, 0.56, 0, 0.9, 0);
  box(f, WATER, 0.44, 0.05, 0.44, 0, 0.96, 0);
  box(f, WATER, 0.1, 0.34, 0.1, 0, 1.12, 0);
}

function ticketBooth(p: THREE.Object3D, x: number, z: number): void {
  const b = group(p, x, 0, z);
  for (let i = 0; i < 4; i++) box(b, i % 2 ? CREAM : RED, 0.215, 1.25, 0.86, -0.3225 + i * 0.215, 0.625, 0);
  box(b, INK, 0.02, 0.4, 0.5, 0.44, 0.85, 0); // the window, facing the path
  box(b, CREAM, 1.05, 0.08, 1.05, 0, 1.3, 0);
  box(b, RED, 0.8, 0.14, 0.8, 0, 1.4, 0);
  box(b, SUN, 0.2, 0.2, 0.2, 0, 1.56, 0);
  const awning = box(b, RED, 0.4, 0.05, 0.9, 0.6, 1.12, 0);
  awning.rotation.z = -0.35;
}

function balloonCart(p: THREE.Object3D, x: number, z: number): void {
  const c = group(p, x, 0, z);
  box(c, WOOD, 0.7, 0.3, 0.5, 0, 0.42, 0);
  box(c, CREAM, 0.76, 0.05, 0.56, 0, 0.6, 0);
  for (const s of [1, -1]) box(c, INK, 0.28, 0.28, 0.06, s * 0.2, 0.16, 0.26);
  const spots: [number, number, number, string][] = [
    [-0.2, 1.75, 0, RED], [0.12, 2.05, 0.08, BLUE], [0.34, 1.65, -0.1, SUN], [-0.05, 2.4, -0.06, PINK], [0.26, 2.3, 0.14, LAV],
  ];
  for (const [bx, by, bz, color] of spots) {
    box(c, color, 0.3, 0.36, 0.3, bx, by, bz);
    box(c, INK, 0.012, by - 0.62 - 0.18, 0.012, bx * 0.6, (by - 0.18 + 0.62) / 2, bz * 0.6);
  }
}

/** A string of little flags between two points. */
function bunting(p: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, sag = 0.25): void {
  const n = Math.max(4, Math.round(a.distanceTo(b) / 0.32));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const at = a.clone().lerp(b, k);
    at.y -= Math.sin(Math.PI * k) * sag;
    const flag = box(p, [RED, SUN, BLUE, PINK, LAV][i % 5], 0.16, 0.16, 0.03, at.x, at.y - 0.08, at.z);
    flag.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, Math.PI / 4);
  }
}

function gate(p: THREE.Object3D): THREE.Mesh {
  const { x, z } = PARK.gate;
  for (const s of [1, -1]) {
    for (let i = 0; i < 5; i++) box(p, i % 2 ? CREAM : RED, 0.34, 0.5, 0.34, x, 0.25 + i * 0.5, z + s);
    box(p, SUN, 0.42, 0.14, 0.42, x, 2.57, z + s);
  }
  box(p, RED, 0.3, 0.2, 2.6, x, 2.75, z);
  // The sign faces into the sun, which is also where the camera is.
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = CREAM;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = INK;
  g.font = "900 96px 'Avenir Next', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('P A R K', 256, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plain = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 2.2), [face, plain, plain, plain, plain, plain]);
  sign.position.set(x + 0.12, 3.14, z);
  sign.castShadow = true;
  return sign;
}

function fence(p: THREE.Object3D, x: number, z: number): void {
  const f = group(p, x, 0, z);
  box(f, CREAM, 0.08, 0.06, 1.0, 0, 0.4, 0);
  box(f, CREAM, 0.08, 0.06, 1.0, 0, 0.2, 0);
  for (const dz of [-0.33, 0, 0.33]) box(f, CREAM, 0.1, 0.56, 0.12, 0, 0.28, dz);
}

// ---- Rides ----------------------------------------------------------------------

function buildWheel(p: THREE.Object3D) {
  const base = group(p, WHEEL.x, 0, WHEEL.z);
  const frame = group(base);
  box(frame, INK, 4.9, 0.14, 0.9, 0, 0.07, 0);
  for (const side of [1, -1]) {
    for (const depth of [0.4, -0.4]) {
      const leg = box(frame, STEEL, 0.16, WHEEL.hub + 0.3, 0.16, side * 1.15, WHEEL.hub / 2, depth);
      leg.rotation.z = side * 0.26;
    }
  }
  box(frame, RED, 0.5, 0.5, 1.1, 0, WHEEL.hub, 0);
  box(frame, SUN, 0.22, 0.22, 1.2, 0, WHEEL.hub, 0);
  fuse(frame);

  const wheel = group(base, 0, WHEEL.hub, 0);
  const spokes = group(wheel);
  const R = WHEEL.radius;
  const n = WHEEL.seats;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const depth of [0.42, -0.42]) {
      const spoke = box(spokes, CREAM, 0.07, R, 0.07, Math.sin(a) * R * 0.5, -Math.cos(a) * R * 0.5, depth);
      spoke.rotation.z = a;
      const mid = a + Math.PI / n;
      const chord = 2 * R * Math.sin(Math.PI / n);
      const rim = box(spokes, i % 2 ? RED : CREAM, chord + 0.06, 0.1, 0.1, Math.sin(mid) * R * Math.cos(Math.PI / n), -Math.cos(mid) * R * Math.cos(Math.PI / n), depth);
      rim.rotation.z = mid;
    }
    box(spokes, STEEL, 0.07, 0.07, 0.9, Math.sin(a) * R, -Math.cos(a) * R, 0); // the axle each car hangs from
  }
  fuse(spokes);

  // Open cars: a floor the cube fits on, a back rail and a little roof.
  const cars: THREE.Group[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const car = group(wheel, Math.sin(a) * R, -Math.cos(a) * R, 0);
    const color = PASTELS[i % PASTELS.length];
    for (const s of [1, -1]) box(car, INK, 0.05, 0.75, 0.05, s * 0.55, -0.36, 0);
    box(car, color, 1.22, 0.12, 0.78, 0, -0.74, 0);
    box(car, color, 1.22, 0.3, 0.07, 0, -0.55, -0.36);
    box(car, CREAM, 1.34, 0.08, 0.86, 0, 0.06, 0);
    fuse(car);
    cars.push(car);
  }
  return { wheel, cars };
}

function buildCarousel(p: THREE.Object3D) {
  const base = group(p, CAROUSEL.x, 0, CAROUSEL.z);
  const still = group(base);
  box(still, CREAM, 4.8, 0.16, 4.8, 0, 0.08, 0);
  box(still, RED, 4.4, 0.05, 4.4, 0, 0.185, 0);
  for (let i = 0; i < 6; i++) box(still, i % 2 ? CREAM : RED, 0.9, 0.46, 0.9, 0, 0.44 + i * 0.46, 0); // striped drum
  // Canopy: kept narrower than the ring of horses, so riders are never hidden under it.
  box(still, RED, 3.5, 0.16, 3.5, 0, 3.4, 0);
  box(still, CREAM, 2.6, 0.26, 2.6, 0, 3.61, 0);
  box(still, RED, 1.7, 0.26, 1.7, 0, 3.87, 0);
  box(still, CREAM, 0.9, 0.26, 0.9, 0, 4.13, 0);
  box(still, SUN, 0.34, 0.4, 0.34, 0, 4.45, 0);
  for (let i = 0; i < 7; i++) {
    const at = -1.5 + i * 0.5;
    const color = i % 2 ? CREAM : SUN;
    for (const s of [1, -1]) {
      box(still, color, 0.38, 0.22, 0.08, at, 3.23, s * 1.75);
      box(still, color, 0.08, 0.22, 0.38, s * 1.75, 3.23, at);
    }
  }
  box(still, CREAM, 0.94, 0.5, 0.94, 0, 3.1, 0);
  fuse(still);

  const turn = group(base);
  const mounts: THREE.Group[] = [];
  for (let i = 0; i < CAROUSEL.seats; i++) {
    const a = (i / CAROUSEL.seats) * Math.PI * 2;
    const post = group(turn, Math.sin(a) * CAROUSEL.radius, 0, Math.cos(a) * CAROUSEL.radius);
    post.rotation.y = a + Math.PI / 2;
    box(post, SUN, 0.06, 2.6, 0.06, 0, 1.5, 0);
    // An arm from the drum out to each pole, so the horses hang from something.
    box(post, SUN, CAROUSEL.radius, 0.07, 0.07, CAROUSEL.radius / 2, 2.78, 0);
    // A blocky horse, nose pointing the way the carousel turns.
    const horse = group(post, 0, 0.95, 0);
    const color = PASTELS[i % PASTELS.length];
    box(horse, color, 0.44, 0.4, 0.95, 0, 0, 0);
    box(horse, color, 0.3, 0.44, 0.3, 0, 0.3, 0.42);
    box(horse, color, 0.26, 0.22, 0.34, 0, 0.3, 0.68);
    box(horse, CREAM, 0.1, 0.36, 0.5, 0, 0.36, 0.2); // mane
    box(horse, CREAM, 0.12, 0.12, 0.22, 0, 0.12, -0.55); // tail
    box(horse, RED, 0.46, 0.08, 0.4, 0, 0.22, -0.02); // saddle
    for (const [lx, lz] of [[0.14, 0.32], [-0.14, 0.32], [0.14, -0.32], [-0.14, -0.32]]) box(horse, color, 0.1, 0.3, 0.1, lx, -0.32, lz);
    fuse(horse);
    mounts.push(horse);
  }
  return { turn, mounts };
}

function buildTrampoline(p: THREE.Object3D) {
  const t = group(p, TRAMPOLINE.x, 0, TRAMPOLINE.z);
  const frame = group(t);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    box(frame, STEEL, 0.1, 0.42, 0.1, x * 1.32, 0.21, z * 1.32);
  }
  for (const s of [1, -1]) {
    box(frame, BLUE, 2.9, 0.12, 0.3, 0, 0.45, s * 1.3);
    box(frame, BLUE, 0.3, 0.12, 2.9, s * 1.3, 0.45, 0);
  }
  // Corner poles with flags, so it reads as a ride from a distance.
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    box(frame, CREAM, 0.08, 1.5, 0.08, x * 1.36, 1.2, z * 1.36);
    box(frame, PASTELS[(x + 1 + (z + 1) / 2) % 4], 0.3, 0.2, 0.03, x * 1.36 + 0.17, 1.83, z * 1.36);
  }
  fuse(frame);
  const mat = box(t, INK, 2.36, 0.04, 2.36, 0, TRAMPOLINE.top - 0.02, 0);
  const mark = box(t, CREAM, 0.5, 0.01, 0.5, 0, TRAMPOLINE.top + 0.005, 0);
  mark.castShadow = false;
  return { mat, mark };
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
    const rand = seededRandom(ctx.seed ^ 0x9a4c);

    // ---- Ground: a green wash for the lawn, pale paths, flowers -----------------
    const wash = (color: string, opacity: number, x0: number, z0: number, w: number, d: number, y: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x0 + w / 2 - 0.5, y, z0 + d / 2 - 0.5);
      m.renderOrder = -1;
      root.add(m);
    };
    wash('#b4cf92', 0.55, PARK.x, PARK.z, PARK.w, PARK.d, 0.004);
    // Paths: in from the gate, a plaza round the fountain, and a spur to each ride.
    wash('#f6efe0', 0.8, 9, -1, 8, 3, 0.006);
    wash('#f6efe0', 0.8, 16, -5, 3, 9, 0.006);
    wash('#f6efe0', 0.8, 16, -5, 7, 1, 0.007);
    wash('#f6efe0', 0.8, 11, 1, 5, 1, 0.007);

    const scenery = new THREE.Group();
    root.add(scenery);
    const bulbs: THREE.Mesh[] = [];
    const solid: [number, number][] = [];
    const put = (fn: (p: THREE.Object3D, x: number, z: number) => void, x: number, z: number) => {
      fn(scenery, x, z);
      solid.push([x, z]);
    };
    put(fountain, 17, 0);
    put(ticketBooth, 10, -2);
    put(balloonCart, 10, 2);
    put(bench, 19, 2);
    put(bench, 21, 2);
    for (const [x, z] of [[15, 1], [19, -2], [19, 1], [22, -1]] as const) {
      lamp(scenery, x, z, bulbs);
      solid.push([x, z]);
    }
    put((p, x, z) => roundTree(p, x, z, 1.1), 23, -3);
    put((p, x, z) => pine(p, x, z, 1.15), 22, 4);
    put(roundTree, 17, 5);
    put(pine, 10, 5);
    put((p, x, z) => pine(p, x, z, 0.9), 23, 1);
    put((p, x, z) => roundTree(p, x, z, 0.85), 16, -7);
    put(pine, 23, -7);
    // A picket fence along the front, either side of the gate.
    for (let z = PARK.z; z <= PARK.z + PARK.d - 1; z++) {
      if (Math.abs(z - PARK.gate.z) <= 1) continue;
      put(fence, PARK.x, z);
    }
    solid.push([PARK.gate.x, PARK.gate.z - 1], [PARK.gate.x, PARK.gate.z + 1]);
    const signBoard = gate(scenery);
    bunting(scenery, new THREE.Vector3(15, 2.1, 1), new THREE.Vector3(19, 2.1, 1));
    bunting(scenery, new THREE.Vector3(19, 2.1, 1), new THREE.Vector3(19, 2.1, -2));
    bunting(scenery, new THREE.Vector3(19, 2.1, -2), new THREE.Vector3(22, 2.1, -1));
    // Flowers, scattered on the grass between cells so nobody treads on them.
    for (let i = 0; i < 46; i++) {
      const fx = PARK.x + 1 + Math.floor(rand() * (PARK.w - 2)) + 0.5;
      const fz = PARK.z + Math.floor(rand() * (PARK.d - 1)) + 0.5;
      const onPath = (fz > -1.6 && fz < 1.6 && fx < 17) || (fx > 15.4 && fx < 18.6 && fz > -5.6 && fz < 3.6);
      if (onPath) continue;
      box(scenery, [PINK, SUN, LAV, CREAM, RED][i % 5], 0.13, 0.1, 0.13, fx, 0.05, fz).castShadow = false;
    }
    fuse(scenery);
    scenery.add(signBoard);
    for (const b of bulbs) root.add(b);

    const { wheel, cars } = buildWheel(root);
    const { turn, mounts } = buildCarousel(root);
    const { mat, mark } = buildTrampoline(root);
    addLandmark(ctx, 'Park', PARK.gate.x + 3, PARK.gate.z);

    // ---- Everything solid claims its cells ---------------------------------------
    const cellsOf: Record<RideKind, [number, number][]> = { wheel: [], carousel: [], trampoline: [] };
    for (let dx = -2; dx <= 2; dx++) cellsOf.wheel.push([WHEEL.x + dx, WHEEL.z]);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) cellsOf.carousel.push([CAROUSEL.x + dx, CAROUSEL.z + dz]);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) cellsOf.trampoline.push([TRAMPOLINE.x + dx, TRAMPOLINE.z + dz]);
    for (const kind of KINDS) {
      const who: Occupant = { kind: 'ride', id: kind };
      for (const [x, z] of cellsOf[kind]) ctx.grid.claim(x, z, who);
    }
    const decor: Occupant = { kind: 'structure', id: 'park' };
    for (const [x, z] of solid) ctx.grid.claim(x, z, decor);

    /** Free floor cells right next to a ride: where you stand to get on. */
    const boardingCells = (kind: RideKind): [number, number][] => {
      const own = new Set(cellsOf[kind].map(([x, z]) => `${x},${z}`));
      const out = new Map<string, [number, number]>();
      for (const [x, z] of cellsOf[kind]) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${z + dz}`;
          if (!own.has(k)) out.set(k, [x + dx, z + dz]);
        }
      }
      return [...out.values()];
    };
    const boarding: Record<RideKind, [number, number][]> = {
      wheel: boardingCells('wheel').filter(([, z]) => z > WHEEL.z), // from the front only
      carousel: boardingCells('carousel'),
      trampoline: boardingCells('trampoline'),
    };
    const nextTo = (kind: RideKind, x: number, z: number) => boarding[kind].some(([bx, bz]) => bx === x && bz === z);

    // ---- Riding ------------------------------------------------------------------
    const state = { rides: 0, riding: null as RideKind | null, riders: 0, npcRides: 0 };
    ctx.state.park = state;
    const cube = ctx.state.cube;
    const cubeMesh = ctx.scene.getObjectByName('cube');
    const riders: Rider[] = [];
    const lastRode = new Map<Member, number>();
    let wheelAngle = 0;
    let turnAngle = 0;
    let clock = 0;

    const freeSeat = (kind: RideKind): number => {
      const taken = new Set(riders.filter((r) => r.kind === kind).map((r) => r.seat));
      const seats = [...Array(CAPACITY[kind]).keys()].filter((s) => !taken.has(s));
      if (!seats.length) return -1;
      if (kind !== 'wheel') return seats[0];
      // The wheel: take whichever empty car is nearest the bottom right now.
      const height = (s: number) => -Math.cos(wheelAngle + (s / WHEEL.seats) * Math.PI * 2);
      return seats.sort((a, b) => height(a) - height(b))[0];
    };

    const board = (who: 'cube' | Member, kind: RideKind, x: number, z: number): boolean => {
      const seat = freeSeat(kind);
      if (seat < 0) return false;
      riders.push({ who, kind, seat, t: 0, from: new THREE.Vector3(x, 0, z), startAngle: wheelAngle, leaving: -1 });
      return true;
    };

    const boardCube = (kind: RideKind) => {
      if (!cube || !cubeMesh || cube.pinned || cube.carried || riders.some((r) => r.who === 'cube')) return;
      if (!board('cube', kind, cube.x, cube.z)) return;
      cube.pinned = true;
      cube.carried = true;
      state.riding = kind;
    };
    const boardNpc = (m: Member, kind: RideKind): boolean => {
      const n = m.n;
      if (n.cult || n.nx !== null || n.carry || !['idle', 'visit'].includes(n.mode)) return false;
      if (!board(m, kind, n.x, n.z)) return false;
      n.mode = 'riding';
      n.t = 0;
      n.goal = null;
      n.emote = { kind: 'sparkle', t: 0 };
      return true;
    };

    // Rolling into a ride is how the cube gets on.
    ctx.events.on<{ occupant?: Occupant }>('cube:bonk', ({ occupant }) => {
      if (occupant?.kind === 'ride') boardCube(occupant.id as RideKind);
    });
    // Scripted control, for tests and video shots.
    ctx.events.on<[RideKind]>('direct:park.ride', ([kind]) => boardCube(kind));
    ctx.events.on<[string, number, RideKind]>('direct:park.board', ([cast, index, kind]) => {
      const n = ctx.state[cast]?.npcs[index];
      const m = everyone(ctx).find((e) => e.n === n);
      if (m) boardNpc(m, kind);
    });

    const smooth = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const seatAt = new THREE.Vector3();
    /** Where a seat is right now (the surface you sit or stand on), and which way it faces. */
    const seat = (r: Rider): number => {
      if (r.kind === 'wheel') {
        const a = wheelAngle + (r.seat / WHEEL.seats) * Math.PI * 2;
        seatAt.set(WHEEL.x + Math.sin(a) * WHEEL.radius, WHEEL.hub - Math.cos(a) * WHEEL.radius - 0.68, WHEEL.z);
        return 0;
      }
      if (r.kind === 'carousel') {
        const a = turnAngle + (r.seat / CAROUSEL.seats) * Math.PI * 2;
        seatAt.set(CAROUSEL.x + Math.sin(a) * CAROUSEL.radius, mounts[r.seat].position.y + 0.26, CAROUSEL.z + Math.cos(a) * CAROUSEL.radius);
        return a + Math.PI / 2;
      }
      // Trampoline: everyone bounces to their own beat, a little higher each time.
      const [ox, oz] = TRAMPOLINE_SPOTS[r.seat];
      const beat = 0.92 + r.seat * 0.07;
      const b = Math.max(0, r.t - HOP) / beat;
      const phase = b % 1;
      const height = Math.min(2.6, 1.1 + Math.floor(b) * 0.45);
      seatAt.set(TRAMPOLINE.x + ox, TRAMPOLINE.top + height * 4 * phase * (1 - phase), TRAMPOLINE.z + oz);
      return (r.seat * 1.3) % (Math.PI * 2);
    };
    const finished = (r: Rider): boolean => {
      if (r.kind === 'wheel') return wheelAngle - r.startAngle >= Math.PI * 2;
      return r.t >= (r.kind === 'carousel' ? CAROUSEL.seconds : TRAMPOLINE.seconds);
    };

    let sinceInvite = 0;
    let sinceBoarding = 0;
    ctx.onUpdate((dt, time) => {
      clock += dt;
      wheelAngle += dt * WHEEL.speed;
      turnAngle += dt * CAROUSEL.speed;
      wheel.rotation.z = wheelAngle;
      for (const car of cars) car.rotation.z = -wheelAngle; // cars hang level
      turn.rotation.y = turnAngle;
      mounts.forEach((m, i) => (m.position.y = 0.95 + Math.sin(time * 2.2 + i * 1.7) * 0.2));
      bulbs.forEach((b, i) => ((b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(time * 3 + i) * 0.15));

      // ---- Carry everyone who is on a ride ----
      let lowest = 1;
      for (let i = riders.length - 1; i >= 0; i--) {
        const r = riders[i];
        r.t += dt;
        if (r.leaving < 0 && finished(r)) r.leaving = 0;
        if (r.leaving >= 0) r.leaving += dt;
        const yaw = seat(r);
        const on = r.leaving >= 0 ? 1 - smooth(r.leaving / HOP) : smooth(r.t / HOP);
        const hop = Math.sin(Math.PI * on) * 0.7;
        if (r.kind === 'trampoline') lowest = Math.min(lowest, seatAt.y - TRAMPOLINE.top);

        if (r.who === 'cube') {
          if (cubeMesh) {
            const groundY = 0.5;
            cubeMesh.position.set(
              r.from.x + (seatAt.x - r.from.x) * on,
              groundY + (seatAt.y + 0.5 - groundY) * on + hop,
              r.from.z + (seatAt.z - r.from.z) * on,
            );
            const bounce = r.kind === 'trampoline' ? Math.max(0, r.t - HOP) / 0.92 : 0;
            cubeMesh.rotation.set(bounce >= 1 && on === 1 ? (bounce % 1) * Math.PI * 2 : 0, r.kind === 'carousel' ? yaw * on : 0, 0);
          }
        } else {
          const n = r.who.n;
          const s = r.who.rig.root.scale.x;
          const sitting = r.kind !== 'trampoline';
          // Seated: hips rest on the seat. Bouncing: feet on the mat.
          const y = sitting ? seatAt.y + (0.1 - HIP) * s : seatAt.y;
          n.carry = {
            x: r.from.x + (seatAt.x - r.from.x) * on,
            y: y * on + hop,
            z: r.from.z + (seatAt.z - r.from.z) * on,
            yaw,
            pose: sitting ? 'sit' : 'bounce',
          };
        }

        if (r.leaving >= HOP) {
          riders.splice(i, 1);
          if (r.who === 'cube') {
            state.riding = null;
            state.rides += 1;
            cube.carried = false;
            ctx.events.emit('direct:cube.teleport', [r.from.x, r.from.z]);
            ctx.events.emit('park:rode', { ride: r.kind });
            ctx.bump(0.08);
          } else {
            const n = r.who.n;
            n.carry = null;
            n.mode = n.persona.wanders ? 'idle' : 'march';
            n.t = 0;
            n.timer = 1 + rand() * 1.5;
            lastRode.set(r.who, clock);
            state.npcRides += 1;
          }
        }
      }
      state.riders = riders.length;
      // The mat dips under whoever is lowest.
      const dip = riders.some((r) => r.kind === 'trampoline') ? Math.max(0, 0.16 - lowest) * 0.7 : 0;
      mat.position.y = TRAMPOLINE.top - 0.02 - dip;
      mark.position.y = TRAMPOLINE.top + 0.005 - dip;

      // ---- Everyone else: get on if you are standing next to a ride -----------------
      const crowd = everyone(ctx);
      if ((sinceBoarding += dt) > 0.5) {
        sinceBoarding = 0;
        for (const m of crowd) {
          const n = m.n;
          if (m.world.staged || n.mode !== 'idle' || n.t < 0.7) continue;
          if (clock - (lastRode.get(m) ?? -99) < 14) continue;
          const kind = KINDS.find((k) => nextTo(k, n.x, n.z));
          if (kind && rand() < 0.6) boardNpc(m, kind);
        }
      }
      // ---- And now and then, someone nearby decides to go to the park ----------------
      if ((sinceInvite += dt) > 3.5) {
        sinceInvite = 0;
        const visiting = crowd.filter((m) => m.n.mode === 'visit').length;
        if (visiting + riders.length < 7) {
          const idle = crowd.filter(
            (m) =>
              !m.world.staged && !m.n.cult && m.n.persona.wanders && ['idle', 'walk'].includes(m.n.mode) &&
              Math.abs(m.n.x - 16) + Math.abs(m.n.z + 1) < 26 && clock - (lastRode.get(m) ?? -99) > 20,
          );
          const m = idle[Math.floor(rand() * idle.length)];
          const kind = KINDS[Math.floor(rand() * KINDS.length)];
          const spots = boarding[kind].filter(([x, z]) => ctx.grid.isFree(x, z));
          const spot = spots[Math.floor(rand() * spots.length)];
          if (m && spot && freeSeat(kind) >= 0) {
            m.n.goal = { x: spot[0], z: spot[1] };
            m.n.mode = 'visit';
            m.n.t = 0;
            m.n.wait = 0;
          }
        }
      }
    });
  },
};
