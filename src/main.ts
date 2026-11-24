import '@fontsource/lilita-one/400.css';
import '@fontsource-variable/rubik/index.css';
import './style.css';
import { createGame } from './core/game';
import { currentDay, parseSelection, selectFeatures } from './core/feature';
import { setupMap } from './core/map';
import { renderOffline, Sound, type SfxEvent } from './core/sound';
import { allFeatures } from './features';
import { CHEVRON, CLOSE, COMMENT, CUBE, MAP, SOUND_OFF, SOUND_ON, withCharms } from './ui/icons';
import { tip } from './core/tip';

const features = selectFeatures(allFeatures, parseSelection(location.search));
const params = new URLSearchParams(location.search);
const manual = params.has('manual');
const seed = params.has('seed') ? Number(params.get('seed')) : manual ? 1 : undefined;
// No WebGL (some in-app browsers): say so plainly instead of showing an empty page.
const canWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();
if (!canWebGL) {
  document.getElementById('nogl')!.hidden = false;
  throw new Error('CRAIL needs WebGL');
}
const game = createGame(document.getElementById('game')!, features, { manual, seed });
const day = currentDay(features);

document.querySelector('#brand .logo')!.innerHTML = CUBE;
const dayBtn = document.getElementById('day') as HTMLButtonElement;
dayBtn.textContent = `Day ${day}`;
dayBtn.insertAdjacentHTML('beforeend', CHEVRON);

// Credits: every feature, who asked for it, and their exact words, newest first, each
// stamped with its day.
const credits = document.getElementById('credits')!;
const creditList = credits.querySelector('ol')!;
for (const f of [...features].reverse()) {
  if (f.meta.secret) continue;
  const row = document.createElement('li');
  const stamp = document.createElement('span');
  stamp.className = 'stamp';
  stamp.textContent = `Day ${f.meta.day}`;
  const title = document.createElement('b');
  title.textContent = f.meta.title;
  const said = document.createElement('q');
  const who = document.createElement('span');
  who.className = 'who';
  if (f.meta.credit.method === 'founder') {
    who.textContent = 'where it started';
  } else {
    who.textContent = `@${f.meta.credit.username}`;
    said.textContent = f.meta.credit.text;
  }
  row.append(stamp, title, who);
  if (said.textContent) row.append(said);
  creditList.append(row);
}
// The way in for your own idea: the series runs on comments.
const ask = document.createElement('p');
ask.className = 'ask';
ask.innerHTML = COMMENT;
ask.append(`Day ${day + 1} could be yours: comment on the newest Reel from @qubitman_ftw.`);
credits.append(ask);
const toggleCredits = (open = credits.hidden) => {
  credits.hidden = !open;
  dayBtn.setAttribute('aria-expanded', String(open));
};
dayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleCredits();
});
// Closes with Esc or a tap anywhere outside it.
window.addEventListener('pointerdown', (e) => {
  if (!credits.hidden && !credits.contains(e.target as Node) && e.target !== dayBtn && !dayBtn.contains(e.target as Node)) toggleCredits(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !credits.hidden) toggleCredits(false);
});
document.getElementById('map-btn')!.innerHTML = MAP;

const map = setupMap(game.ctx, document.getElementById('map-btn') as HTMLButtonElement);

// Sound effects and the fight music. Browsers only allow sound after a key press or tap.
const sound = new Sound();
game.ctx.input.onGesture(() => sound.unlock());
game.ctx.events.on<SfxEvent>('sfx', (e) => sound.play(e));
game.ctx.events.on<boolean>('sfx:music', (on) => sound.music(on));
game.ctx.events.on<boolean>('sound:set', (on) => {
  sound.enabled = on;
  if (!on) sound.music(false);
});

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
  ['003-cube-cult', 'Your cult', 'Your three most senior followers walk with you; the rest wait at the temple. Bump the shrine for charms, and the temple door to give out ranks.'],
  ['003-supreme-leader', 'The leader', 'Cannot be recruited. Bump his statue, flag or launch pad and his soldiers react.'],
  ['003-supreme-leader', 'Danger', 'Once your cult has three members, his rockets aim at you: get out of the red ring. A hit costs a charm.'],
  ['004-octopus', 'Gåmson', 'The octopus. Steals from everyone. Roll into him to make him drop things. Bump the rock by his pool to give everything back.'],
  ['005-immortal-gamson', 'Immortal', 'Tank shells and rockets cannot hurt Gåmson any more. Only you can make him let go.'],
  ['006-rivals', 'Fights', 'Now and then two rival fighters drop in to pick a fight with Gåmson. Bump one on the ground twice and they leave, impressed.'],
  ['007-block-counter', 'Blocks', 'The counter under your cult counts every block you have ever rolled. It remembers, visit to visit.'],
  ['007-trees', 'Trees', 'The world grows woods as you roll: pines, birches, cherry blossom, autumn maples and more. Bump one and leaves come down.'],
  ['005-tahgong', 'Tåhgong', 'Gåmson’s squid friend. He is nice: while Gåmson is out, he takes things back off the rock to their owners. Bump into him for a hug, and now and then a charm.'],
];
const helpBtn = document.getElementById('help-btn') as HTMLButtonElement;
const help = document.getElementById('help')!;
const ids = new Set(features.map((f) => f.meta.id));
// In the order things were added: the way the game grew.
HELP.sort((a, b) => Number(a[0].slice(0, 3)) - Number(b[0].slice(0, 3)));
for (const [id, term, text] of HELP) {
  if (!ids.has(id)) continue;
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  withCharms(dd, text);
  help.querySelector('dl')!.append(dt, dd);
}
const toggleHelp = (open = help.hidden) => {
  help.hidden = !open;
  helpBtn.setAttribute('aria-expanded', String(open));
};
const helpClose = help.querySelector('.close') as HTMLButtonElement;
helpClose.innerHTML = CLOSE;
helpBtn.addEventListener('click', () => {
  toggleHelp();
  if (!help.hidden) helpClose.focus();
});
helpClose.addEventListener('click', () => {
  toggleHelp(false);
  helpBtn.focus();
});
// Only a tap on the dim backdrop closes it: touching the card (to scroll it) does not.
help.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === help) toggleHelp(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !help.hidden) {
    toggleHelp(false);
    helpBtn.focus();
  }
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
  soundBtn.innerHTML = soundOn ? SOUND_ON : SOUND_OFF;
  soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
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
  /** Only in ?manual mode: renders the game's sounds offline, in step with the video. */
  renderSound: manual ? renderOffline : undefined,
};

// ---- Arriving from the Reel: what is new today, and who asked for it ---------------------
// Shown once per new day, out of the way, gone at the first move.
if (!manual) {
  const arrival = document.getElementById('arrival')!;
  let seen = 0;
  try {
    seen = Number(localStorage.getItem('crail.seenDay')) || 0;
  } catch {
    /* storage blocked: show it every visit */
  }
  const today = features.filter((f) => f.meta.day === day && !f.meta.secret);
  if (seen < day && today.length) {
    const card = document.createElement('div');
    card.className = 'card bolted';
    const h = document.createElement('h2');
    h.textContent = `Day ${day}`;
    const list = document.createElement('ul');
    for (const f of today) {
      const li = document.createElement('li');
      const what = document.createElement('b');
      what.textContent = f.meta.title;
      const who = document.createElement('span');
      who.textContent = `asked for by @${f.meta.credit.username}`;
      li.append(what, who);
      list.append(li);
    }
    card.append(h, list);
    arrival.append(card);
    arrival.hidden = false;
    let gone = false;
    const leave = () => {
      if (gone) return;
      gone = true;
      arrival.classList.add('leaving');
      setTimeout(() => (arrival.hidden = true), 450);
      try {
        localStorage.setItem('crail.seenDay', String(day));
      } catch {
        /* ignore */
      }
    };
    game.ctx.events.on('cube:rolled', leave);
    setTimeout(leave, 7000);
  }
  // A while into a session, the reminder that the next day is up to them.
  let rolled = 0;
  game.ctx.events.on('cube:rolled', () => {
    if (++rolled === 150) tip(`What should Day ${day + 1} be? Comment on the newest Reel from @qubitman_ftw.`, 7);
  });
}
