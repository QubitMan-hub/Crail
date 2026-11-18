import * as THREE from 'three';
import { EventBus } from './events';
import { Input } from './input';
import { Grid } from './grid';
import type { Feature } from './feature';

/** Everything a feature is allowed to touch. */
export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  events: EventBus;
  input: Input;
  /** Who stands on which floor cell. Claim a cell before moving into it. */
  grid: Grid;
  /** Seed for anything random, so a run can be replayed exactly. */
  seed: number;
  /** Shared, serialisable game state. Namespaced by feature, e.g. state.cube. */
  state: Record<string, any>;
  /** Point the camera follows. Features move it; the core eases toward it. */
  focus: THREE.Vector3;
  /** When set, the camera looks here instead of at `focus` (cut-scenes, video shots). */
  focusOverride: THREE.Vector3 | null;
  /** Run fn every frame with delta seconds (clamped) and elapsed seconds. */
  onUpdate(fn: (dt: number, time: number) => void): void;
  /** World position on the ground plane under a screen point. */
  groundPoint(clientX: number, clientY: number): THREE.Vector3 | null;
  /** Small downward camera bump, for impacts. */
  bump(strength?: number): void;
  /** A short sideways shake of the camera, for the biggest hits. */
  shake(strength?: number): void;
  /**
   * Slow the whole world down for a moment: a near-freeze on a punch landing, slow motion
   * for a big one. It eases back to normal speed by itself. The camera keeps real time.
   */
  slowmo(scale: number, seconds: number): void;
  /** Extra zoom a feature asks for (a close-up). 1 is none; the camera eases to it. */
  lens: number;
}

export interface Game {
  ctx: GameContext;
  features: Feature[];
  /** Advance the simulation manually (tests and scripted capture). */
  step(dt: number): void;
  /** Jump the camera to its target instead of gliding there. */
  snapCamera(): void;
}

const CAMERA_OFFSET = new THREE.Vector3(12, 12, 12);
/** World units that must always fit across the shorter screen side. */
const VIEW_SPAN = 9;
const VIEW_SPAN_PORTRAIT = 7;

export interface GameOptions {
  /** Skip the real-time loop; the caller advances time with step(). Used to render video. */
  manual?: boolean;
  seed?: number;
}

export function createGame(container: HTMLElement, features: Feature[], opts: GameOptions = {}): Game {
  const manual = opts.manual ?? false;
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
  let shakeAmp = 0;
  let timeScale = 1;
  let slowScale = 1;
  let slowLeft = 0;
  let lens = 1;

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
    grid: new Grid(),
    seed: opts.seed ?? (Math.random() * 0xffffffff) >>> 0,
    state: {},
    focus,
    focusOverride: null,
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
    shake(strength = 0.12) {
      shakeAmp = Math.max(shakeAmp, strength);
    },
    slowmo(scale, seconds) {
      slowScale = Math.min(slowScale, scale);
      slowLeft = Math.max(slowLeft, seconds);
      timeScale = Math.min(timeScale, scale);
    },
    lens: 1,
  };

  for (const f of features) f.setup(ctx);

  let time = 0;
  let realTime = 0;
  const placeCamera = () => {
    // The shake moves the camera across the screen (along the view's own right and up).
    const sx = Math.sin(realTime * 61) * shakeAmp;
    const sy = Math.cos(realTime * 47) * shakeAmp * 0.6;
    const ox = sx * 0.707;
    const oz = -sx * 0.707;
    camera.position.copy(eased).add(CAMERA_OFFSET);
    camera.position.x += ox;
    camera.position.z += oz;
    camera.position.y += bumpY + sy;
    camera.lookAt(eased.x + ox, eased.y + bumpY + sy, eased.z + oz);
  };
  const step = (dt: number) => {
    realTime += dt;
    // Slow motion: hold the slow speed for as long as asked, then ease back up.
    if (slowLeft > 0) {
      slowLeft -= dt;
      timeScale = slowScale;
    } else {
      slowScale = 1;
      timeScale += (1 - timeScale) * (1 - Math.exp(-9 * dt));
      if (timeScale > 0.995) timeScale = 1;
    }
    const sim = dt * timeScale;
    time += sim;
    for (const fn of updaters) fn(sim, time);
    eased.lerp(ctx.focusOverride ?? focus, 1 - Math.exp(-6 * dt));
    bumpY *= Math.exp(-18 * dt);
    shakeAmp *= Math.exp(-11 * dt);
    if (shakeAmp < 0.002) shakeAmp = 0;
    placeCamera();
    // The close-up multiplies whatever zoom the player (or a video shot) has set.
    lens += (ctx.lens - lens) * (1 - Math.exp(-2.6 * dt));
    if (Math.abs(lens - ctx.lens) < 0.0005) lens = ctx.lens;
    const base = camera.zoom;
    camera.zoom = base * lens;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    camera.zoom = base;
  };

  eased.copy(focus);
  let last = performance.now();
  const frame = (now: number) => {
    // Never negative: the first frame's timestamp can be earlier than the moment the game
    // started, and a negative step would run every timer backwards. Never more than 0.05 s
    // either, so a stalled tab does not jump.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  };
  if (manual) step(0);
  else requestAnimationFrame(frame);

  const snapCamera = () => void eased.copy(ctx.focusOverride ?? focus);

  return { ctx, features, step, snapCamera };
}
