import * as THREE from 'three';
import type { Feature } from '../../core/feature';

/** Safety rubber, as under a climbing frame: pale mint, flecked. */
const GROUND = '#d6e6dc';
const GRID_LINE = '#c2d6ca';
const FLECKS = ['#c4d8cc', '#e7f1ea', '#b8cdc0', '#cfe2d6'];
const RARE_FLECKS = ['#e8402a', '#ffc933', '#2f6fe0'];
const SIZE = 80;

function gridTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = GROUND;
  g.fillRect(0, 0, 128, 128);
  // Rubber granules: lots of nearly-the-same flecks, and now and then a bright one.
  let s = 9;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.025 ? RARE_FLECKS[Math.floor(r() * 3)] : FLECKS[Math.floor(r() * FLECKS.length)];
    const size = 2 + r() * 2.5;
    g.fillRect(r() * 128, r() * 128, size, size);
  }
  g.strokeStyle = GRID_LINE;
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(SIZE, SIZE);
  // Cells are centred on whole numbers, so lines sit on the halves.
  t.offset.set(0.5, 0.5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The empty world: an endless pale floor and the light that falls on it. */
export const world: Feature = {
  meta: {
    id: '000-world',
    day: 0,
    title: 'An empty world',
    credit: { username: 'qubitman_ftw', text: 'An empty world.', method: 'founder' },
  },
  setup(ctx) {
    ctx.scene.background = new THREE.Color(GROUND);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE, SIZE),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    ctx.scene.add(floor);

    ctx.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9dccf, 1.5));

    const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
    // The sun's direction never changes; it sits far up that line so its shadow box can be big.
    const toSun = new THREE.Vector3(-5, 10, 3).normalize();
    const SUN_DISTANCE = 40;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    const s = sun.shadow.camera;
    s.near = 1;
    s.far = 90;
    ctx.scene.add(sun, sun.target);

    // The light's own axes, for keeping the shadow map still as the view moves.
    const across = new THREE.Vector3().crossVectors(toSun, new THREE.Vector3(0, 1, 0)).normalize();
    const upward = new THREE.Vector3().crossVectors(across, toSun).normalize();
    const view = new THREE.Vector3();
    const snapped = new THREE.Vector3();
    let half = 0;

    ctx.onUpdate(() => {
      // The floor travels with the player in whole cells, so the world never ends and the
      // grid never appears to slide.
      const x = Math.round(ctx.focus.x);
      const z = Math.round(ctx.focus.z);
      floor.position.set(x, 0, z);

      // Shadows cover everything on screen (plus room for tall things just off it), so none
      // pop in or out at the edges. The box only changes size in steps, not every frame.
      const cam = ctx.camera;
      const zoom = Math.max(0.3, cam.zoom * Math.min(1, ctx.lens));
      const reach = Math.hypot(cam.right, cam.top * 1.75) / zoom + 4;
      const want = Math.ceil(reach / 4) * 4;
      if (want !== half) {
        half = want;
        s.left = s.bottom = -half;
        s.right = s.top = half;
        s.updateProjectionMatrix();
      }
      // Centre the box where the camera is actually looking (it leans away from the cube in
      // a fight), then snap it to the shadow map's own pixel grid, so shadow edges stay put
      // instead of crawling as the view glides.
      view.copy(cam.position).sub(new THREE.Vector3(12, 12, 12)).setY(0);
      const texel = (2 * half) / sun.shadow.mapSize.x;
      const a = Math.round(view.dot(across) / texel) * texel;
      const b = Math.round(view.dot(upward) / texel) * texel;
      snapped.copy(across).multiplyScalar(a).addScaledVector(upward, b).addScaledVector(toSun, view.dot(toSun));
      sun.target.position.copy(snapped);
      sun.position.copy(snapped).addScaledVector(toSun, SUN_DISTANCE);
    });
  },
};
