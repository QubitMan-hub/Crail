import * as THREE from 'three';

/**
 * Water that feels like water: a surface that moves in small waves, shallow at the
 * edges and dark in the middle, foam where it meets the sand, a few fish under the
 * surface, sparkles on top, and ripples and splashes whenever anything goes in.
 */

export const WATER_LEVEL = 0.16;
const SHALLOW = new THREE.Color('#9fe1e6');
const MID = new THREE.Color('#5cbfd4');
const DEEP = new THREE.Color('#2f89ab');
const EDGE = new THREE.Color('#d9f6f2');

export interface Water {
  group: THREE.Group;
  update(dt: number, time: number): void;
  /** A ring spreading out from a spot on the surface. */
  ripple(x: number, z: number, size?: number, delay?: number): void;
  /** A burst of droplets, and a ring: something jumped (or rolled) in. */
  splash(x: number, z: number, strength?: number): void;
}

export function createWater(cells: [number, number][], deep: (x: number, z: number) => boolean): Water {
  const group = new THREE.Group();
  const wet = new Set(cells.map(([x, z]) => `${x},${z}`));
  const isWet = (x: number, z: number) => wet.has(`${x},${z}`);

  // ---- The surface: a little grid per cell, shared corners, moved every frame ----------
  const STEPS = 2; // quads per cell side
  const index = new Map<string, number>();
  const pos: number[] = [];
  const col: number[] = [];
  const tris: number[] = [];
  const vertex = (vx: number, vz: number): number => {
    const k = `${vx.toFixed(2)},${vz.toFixed(2)}`;
    let i = index.get(k);
    if (i !== undefined) return i;
    i = pos.length / 3;
    index.set(k, i);
    pos.push(vx, WATER_LEVEL, vz);
    // Colour by how far this point is from dry land: pale at the edge, dark in the middle.
    let shore = 9;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const cx = Math.round(vx) + dx;
        const cz = Math.round(vz) + dz;
        if (isWet(cx, cz)) continue;
        // Distance from this point to the nearest edge of a dry cell.
        const ex = Math.max(0, Math.abs(vx - cx) - 0.5);
        const ez = Math.max(0, Math.abs(vz - cz) - 0.5);
        shore = Math.min(shore, Math.hypot(ex, ez));
      }
    }
    const c = shore < 0.08 ? EDGE.clone() : shore < 0.9 ? SHALLOW.clone().lerp(MID, shore / 0.9) : MID.clone().lerp(DEEP, Math.min(1, (shore - 0.9) / 1.4));
    if (deep(Math.round(vx), Math.round(vz))) c.lerp(DEEP, 0.35);
    col.push(c.r, c.g, c.b);
    return i;
  };
  for (const [x, z] of cells) {
    for (let a = 0; a < STEPS; a++) {
      for (let b = 0; b < STEPS; b++) {
        const x0 = x - 0.5 + a / STEPS;
        const z0 = z - 0.5 + b / STEPS;
        const s = 1 / STEPS;
        const [p, q, r, t] = [vertex(x0, z0), vertex(x0 + s, z0), vertex(x0 + s, z0 + s), vertex(x0, z0 + s)];
        tris.push(p, r, q, p, t, r);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(tris);
  geo.computeVertexNormals();
  const surface = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.8 }),
  );
  surface.receiveShadow = true;
  group.add(surface);
  const base = Float32Array.from(pos);

  // ---- Foam where the water meets the sand -------------------------------------------
  // One mesh for all of it: a flat strip along every edge where water meets sand.
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false });
  const foamVerts: number[] = [];
  const y = WATER_LEVEL + 0.012;
  for (const [x, z] of cells) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (isWet(x + dx, z + dz)) continue;
      // A thin quad just inside the edge.
      const [hx, hz] = dx ? [0.06, 0.51] : [0.51, 0.06];
      const [ox, oz] = [x + dx * 0.44, z + dz * 0.44];
      const a = [ox - hx, y, oz - hz];
      const b = [ox + hx, y, oz - hz];
      const c = [ox + hx, y, oz + hz];
      const d = [ox - hx, y, oz + hz];
      foamVerts.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(foamVerts, 3));
  group.add(new THREE.Mesh(foamGeo, foamMat));

  // ---- Fish, under the surface, in the deep part ------------------------------------
  const deepCells = cells.filter(([x, z]) => deep(x, z));
  const cx = deepCells.reduce((s, [x]) => s + x, 0) / Math.max(1, deepCells.length);
  const cz = deepCells.reduce((s, [, z]) => s + z, 0) / Math.max(1, deepCells.length);
  const fish = ['#f2843a', '#f6c445', '#e9f2f4'].map((color, i) => {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), new THREE.MeshStandardMaterial({ color }));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.02), new THREE.MeshStandardMaterial({ color }));
    tail.position.x = -0.1;
    f.add(body, tail);
    group.add(f);
    return { f, tail, phase: i * 2.1, r: 0.6 + i * 0.25 };
  });

  // ---- Sparkles that wink on the surface ---------------------------------------------
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const sparkles = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.07), sparkMat.clone());
    m.rotation.y = Math.PI / 4;
    group.add(m);
    return { m, t: i * 0.7, at: cells[(i * 5) % cells.length] };
  });

  // ---- Ripples and splashes: small pools of meshes, reused ---------------------------
  const ripples = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 28),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    return { m, age: 9, size: 1 };
  });
  let nextRipple = 0;
  const drops = Array.from({ length: 26 }, () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#e6fbff', transparent: true }));
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), age: 9 };
  });
  let nextDrop = 0;

  const ripple = (x: number, z: number, size = 1, delay = 0) => {
    const r = ripples[nextRipple++ % ripples.length];
    Object.assign(r, { age: -delay, size });
    r.m.position.set(x, WATER_LEVEL + 0.015, z);
  };
  const splash = (x: number, z: number, strength = 1) => {
    ripple(x, z, 1.4 * strength);
    ripple(x, z, 0.9 * strength, 0.15);
    const n = Math.round(9 * strength);
    for (let i = 0; i < n; i++) {
      const d = drops[nextDrop++ % drops.length];
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      d.age = 0;
      d.m.visible = true;
      d.m.position.set(x + Math.cos(a) * 0.2, WATER_LEVEL + 0.1, z + Math.sin(a) * 0.2);
      d.v.set(Math.cos(a) * (0.8 + Math.random()), (2.2 + Math.random() * 1.2) * strength, Math.sin(a) * (0.8 + Math.random()));
    }
  };

  const update = (dt: number, time: number) => {
    // Waves: two slow swells crossing each other, smaller at the edges.
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      const edge = col[i * 3] > 0.8 ? 0.3 : 1;
      p.setY(i, WATER_LEVEL + (Math.sin(time * 1.6 + x * 1.7 + z * 0.9) * 0.018 + Math.sin(time * 2.3 - x * 0.8 + z * 1.9) * 0.012) * edge);
    }
    p.needsUpdate = true;
    foamMat.opacity = 0.45 + Math.sin(time * 2.2) * 0.15;
    for (const { f, tail, phase, r } of fish) {
      const t = time * 0.55 + phase;
      const x = cx + Math.cos(t) * r;
      const z = cz + Math.sin(t * 1.3) * r * 0.7;
      const nx = cx + Math.cos(t + 0.05) * r;
      const nz = cz + Math.sin((t + 0.05) * 1.3) * r * 0.7;
      f.position.set(x, WATER_LEVEL - 0.1 + Math.sin(t * 3) * 0.02, z);
      f.rotation.y = Math.atan2(-(nz - z), nx - x);
      tail.rotation.y = Math.sin(time * 14 + phase) * 0.6;
    }
    for (const s of sparkles) {
      s.t += dt;
      const k = (s.t % 3.2) / 3.2;
      const on = k < 0.18 ? Math.sin((k / 0.18) * Math.PI) : 0;
      if (k < 0.01) s.at = cells[Math.floor(Math.random() * cells.length)];
      s.m.visible = on > 0;
      (s.m.material as THREE.MeshBasicMaterial).opacity = on * 0.9;
      s.m.position.set(s.at[0] + Math.sin(s.t * 7) * 0.3, WATER_LEVEL + 0.03, s.at[1] + Math.cos(s.t * 5) * 0.3);
    }
    for (const r of ripples) {
      r.age += dt;
      const k = Math.min(1, r.age / 1.1);
      r.m.scale.setScalar((0.15 + k * 0.75) * r.size);
      r.m.visible = r.age >= 0 && r.age < 1.1;
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    }
    for (const d of drops) {
      if (!d.m.visible) continue;
      d.age += dt;
      d.v.y -= 9 * dt;
      d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < WATER_LEVEL) d.m.visible = false;
    }
  };

  return { group, update, ripple, splash };
}
