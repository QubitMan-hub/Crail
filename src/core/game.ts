import * as THREE from 'three';
import { EventBus } from './events';
import { Input } from './input';
import type { Feature } from './feature';

/** Everything a feature is allowed to touch. */
export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  events: EventBus;
  input: Input;
  /** Shared, serialisable game state. Namespaced by feature, e.g. state.cube. */
  state: Record<string, any>;
  /** Point the camera follows. Features move it; the core eases toward it. */
  focus: THREE.Vector3;
  /** Run fn every frame with delta seconds (clamped) and elapsed seconds. */
  onUpdate(fn: (dt: number, time: number) => void): void;
  /** World position on the ground plane under a screen point. */
  groundPoint(clientX: number, clientY: number): THREE.Vector3 | null;
  /** Small downward camera bump, for impacts. */
  bump(strength?: number): void;
}

export interface Game {
  ctx: GameContext;
  features: Feature[];
  /** Advance the simulation manually (tests and scripted capture). */
  step(dt: number): void;
}

const CAMERA_OFFSET = new THREE.Vector3(12, 12, 12);
/** World units that must always fit across the shorter screen side. */
const VIEW_SPAN = 9;
const VIEW_SPAN_PORTRAIT = 7;

/**
 * `manual` skips the real-time loop; the caller advances time with step().
 * Used to render video frame by frame.
 */
export function createGame(container: HTMLElement, features: Feature[], manual = false): Game {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const focus = new THREE.Vector3();
  const eased = new THREE.Vector3();
  let bumpY = 0;

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = w / h;
    const halfH = (aspect >= 1 ? VIEW_SPAN : VIEW_SPAN_PORTRAIT / aspect) / 2;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  const updaters: Array<(dt: number, time: number) => void> = [];
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const ctx: GameContext = {
    scene,
    camera,
    renderer,
    events: new EventBus(),
    input: new Input(renderer.domElement),
    state: {},
    focus,
    onUpdate: (fn) => void updaters.push(fn),
    groundPoint(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    },
    bump(strength = 0.06) {
      bumpY = -strength;
    },
  };

  for (const f of features) f.setup(ctx);

  let time = 0;
  const placeCamera = () => {
    camera.position.copy(eased).add(CAMERA_OFFSET);
    camera.position.y += bumpY;
    camera.lookAt(eased.x, eased.y + bumpY, eased.z);
  };
  const step = (dt: number) => {
    time += dt;
    for (const fn of updaters) fn(dt, time);
    eased.lerp(focus, 1 - Math.exp(-6 * dt));
    bumpY *= Math.exp(-18 * dt);
    placeCamera();
    renderer.render(scene, camera);
  };

  eased.copy(focus);
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  };
  if (manual) step(0);
  else requestAnimationFrame(frame);

  return { ctx, features, step };
}
