import * as THREE from 'three';
import type { Feature } from '../../core/feature';

const GROUND = '#e9e3d6';
const GRID_LINE = '#d9d1c0';
const SIZE = 80;

function gridTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = GROUND;
  g.fillRect(0, 0, 128, 128);
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

    ctx.scene.add(new THREE.HemisphereLight(0xffffff, 0xe4d9c6, 1.5));

    const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
    const sunOffset = new THREE.Vector3(-5, 10, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 4;
    const s = sun.shadow.camera;
    s.left = s.bottom = -7;
    s.right = s.top = 7;
    s.near = 1;
    s.far = 30;
    ctx.scene.add(sun, sun.target);

    ctx.onUpdate(() => {
      // The floor and the sun travel with the player in whole cells, so the
      // world never ends and the grid never appears to slide.
      const x = Math.round(ctx.focus.x);
      const z = Math.round(ctx.focus.z);
      floor.position.set(x, 0, z);
      sun.target.position.set(x, 0, z);
      sun.position.set(x, 0, z).add(sunOffset);
    });
  },
};
