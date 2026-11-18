import './style.css';
import { createGame } from './core/game';
import { currentDay, parseSelection, selectFeatures } from './core/feature';
import { setupMap } from './core/map';
import { allFeatures } from './features';

const features = selectFeatures(allFeatures, parseSelection(location.search));
const params = new URLSearchParams(location.search);
const manual = params.has('manual');
const seed = params.has('seed') ? Number(params.get('seed')) : manual ? 1 : undefined;
const game = createGame(document.getElementById('game')!, features, { manual, seed });
const day = currentDay(features);

const dayBtn = document.getElementById('day') as HTMLButtonElement;
dayBtn.textContent = `Day ${day}`;

// Credits: every feature, who asked for it, and their exact words.
const credits = document.getElementById('credits')!;
for (const f of [...features].reverse()) {
  const row = document.createElement('li');
  const head = document.createElement('b');
  head.textContent = `Day ${f.meta.day} · ${f.meta.title}`;
  const who = document.createElement('span');
  who.textContent = f.meta.credit.method === 'founder' ? 'where it started' : `@${f.meta.credit.username}: “${f.meta.credit.text}”`;
  row.append(head, who);
  credits.append(row);
}
dayBtn.addEventListener('click', () => {
  const open = credits.toggleAttribute('hidden') === false;
  dayBtn.setAttribute('aria-expanded', String(open));
  dayBtn.blur();
});

const map = setupMap(game.ctx, document.getElementById('map-btn') as HTMLButtonElement);

// The opening instructions go once you have rolled. Later messages manage themselves.
const hint = document.getElementById('hint')!;
game.ctx.events.on('cube:rolled', () => {
  if (hint.querySelector('.keys, .touch')) hint.classList.add('gone');
});

// How to play: one line per thing you can do, only for the features in this build.
const HELP: [string, string, string][] = [
  ['000-cube', 'Roll', 'WASD or arrow keys, or tap where to go. Scroll or pinch to zoom. M opens the map.'],
  ['001-goth-baddies', 'Goths', 'They judge you. Bump one three times and find out.'],
  ['002-femboys', 'Femboys', 'Friendlier. Bump one three times and you may get a bow.'],
  ['003-park', 'Rides', 'Roll into a ride to get on. Each one gives a charm ✦, then needs a rest. Press a direction to get off early (no charm before halfway).'],
  ['003-cube-cult', 'Preach', 'With a charm, stop next to someone and stay still. A ring fills and they join. Goths cost ✦2.'],
  ['003-cube-cult', 'Your cult', 'Four followers walk with you; the rest wait at the temple. Bump the shrine for charms, and the temple door to give out ranks.'],
  ['003-supreme-leader', 'The leader', 'Cannot be recruited. Bump his statue, flag or launch pad and his soldiers react.'],
  ['003-supreme-leader', 'Danger', 'Once your cult has three members, his rockets aim at you: get out of the red ring. A hit costs a charm.'],
  ['004-octopus', 'Gåmson', 'The octopus. Steals from everyone. Roll into him to make him drop things. Bump the rock by his pool to give everything back.'],
];
const helpBtn = document.getElementById('help-btn') as HTMLButtonElement;
const help = document.getElementById('help')!;
const ids = new Set(features.map((f) => f.meta.id));
for (const [id, term, text] of HELP) {
  if (!ids.has(id)) continue;
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = text;
  help.querySelector('dl')!.append(dt, dd);
}
const toggleHelp = (open = help.hidden) => {
  help.hidden = !open;
  helpBtn.setAttribute('aria-expanded', String(open));
};
helpBtn.addEventListener('click', () => {
  toggleHelp();
  helpBtn.blur();
});
help.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  toggleHelp(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !help.hidden) toggleHelp(false);
});

// Zoom: scroll, pinch, or + and -. Remembered between visits. Video capture sets its own.
if (!manual) {
  const camera = game.ctx.camera;
  const canvas = game.ctx.renderer.domElement;
  let zoom = 1;
  try {
    zoom = Number(localStorage.getItem('crail.zoom')) || 1;
  } catch {
    /* storage can be blocked; start at the default */
  }
  const setZoom = (z: number) => {
    zoom = Math.min(1.7, Math.max(0.6, z));
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    try {
      localStorage.setItem('crail.zoom', String(zoom));
    } catch {
      /* ignore */
    }
  };
  setZoom(zoom);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Equal' || e.code === 'NumpadAdd') setZoom(zoom * 1.15);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZoom(zoom / 1.15);
  });
  const fingers = new Map<number, { x: number; y: number }>();
  let pinchFrom = 0;
  let zoomFrom = 1;
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      pinchFrom = spread();
      zoomFrom = zoom;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2 && pinchFrom > 0) setZoom(zoomFrom * (spread() / pinchFrom));
  });
  const lift = (e: PointerEvent) => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) pinchFrom = 0;
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
}

const soundBtn = document.getElementById('sound') as HTMLButtonElement;
let soundOn = true;
try {
  soundOn = localStorage.getItem('crail.sound') !== 'off';
} catch {
  /* storage can be blocked; sound simply defaults to on */
}
const applySound = () => {
  soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  game.ctx.events.emit('sound:set', soundOn);
};
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try {
    localStorage.setItem('crail.sound', soundOn ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  applySound();
  soundBtn.blur();
});
applySound();

// Read-only window into the game for tests and scripted video capture.
(window as any).__crail = {
  day,
  features: features.map((f) => f.meta),
  state: game.ctx.state,
  map,
  /** Scripted control for tests and video shots, e.g. direct('cube.teleport', 3, 4). */
  direct: (name: string, ...args: unknown[]) => game.ctx.events.emit(`direct:${name}`, args),
  // Only in ?manual mode: lets the reel renderer drive time and the camera.
  game: manual ? game : undefined,
};
