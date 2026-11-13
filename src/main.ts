import './style.css';
import { createGame } from './core/game';
import { currentDay, parseSelection, selectFeatures } from './core/feature';
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

const hint = document.getElementById('hint')!;
game.ctx.events.on('cube:rolled', () => hint.classList.add('gone'));

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
  /** Scripted control for tests and video shots, e.g. direct('cube.teleport', 3, 4). */
  direct: (name: string, ...args: unknown[]) => game.ctx.events.emit(`direct:${name}`, args),
  // Only in ?manual mode: lets the reel renderer drive time and the camera.
  game: manual ? game : undefined,
};
