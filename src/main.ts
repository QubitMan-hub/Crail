import './style.css';
import { createGame } from './core/game';
import { currentDay, parseSelection, selectFeatures } from './core/feature';
import { allFeatures } from './features';

const features = selectFeatures(allFeatures, parseSelection(location.search));
const manual = new URLSearchParams(location.search).has('manual');
const game = createGame(document.getElementById('game')!, features, manual);
const day = currentDay(features);

document.getElementById('day')!.textContent = `Day ${day}`;

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
  // Only in ?manual mode: lets the reel renderer drive time and the camera.
  game: manual ? game : undefined,
};
