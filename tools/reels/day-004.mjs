// The Day 4 Reel: the octopus. Times are in seconds.
//   0-3.6     HOOK     something in a tide pool is watching: "the comments added a thief"
//   3.6-10    GOTH     the comment, then it climbs out and takes a goth's bow
//   10-13     FEMBOY   one sock
//   13-18.5   ARMY     the flag; the tank fires back and misses
//   18.5-22   CUBE     it robs you too
//   22-27     ROCK     everything is on a rock; bump it and it all goes back
//   27-31     OUT      it is still watching
//
// Needs a file that is not in the repository:
//   captures/day-004-assets/top.png   screenshot of the real comment
import { existsSync } from 'node:fs';
import { esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-004-assets';
const T = { comment: 3.6, goth: 6.6, femboy: 10.0, army: 13.0, cube: 18.5, rock: 22.0, out: 27.0, black: 30.7 };
const seconds = 31;
const POOL = { x: 3, z: 14 };
/** Empty floor, far from everything, for the scenes that need a clean background. */
const F = { x: 40, z: 44 };
const A = { x: -40, z: 40 };
const C = { x: 40, z: -40 };

function prepare() {
  if (!existsSync(`${ASSETS}/top.png`)) throw new Error(`Missing ${ASSETS}/top.png (screenshot of the real comment).`);
}

// W = up-right.
const keys = [[23.2, 23.3, 'W'], [24.0, 24.1, 'W']];

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const clearAll = (t) => CASTS.map((c) => [t, `${c}.clear`]);
const actions = [
  ...CASTS.map((c) => [0, `${c}.staged`, true]), [0, 'octopus.staged', true],
  ...clearAll(0),
  [0, 'cult.charms', 0], [0, 'cube.teleport', -70, 30],
  // She has a bow. Not for long.
  [0, 'goths.spawn', 1, POOL.x, POOL.z + 4, 0, { idle: 99 }], [0, 'goths.bow', 0], [0, 'cut'],
  [5.3, 'octopus.steal', 'goth'],
  // One femboy, a long way from anywhere. The army sets up off screen while this plays.
  ...clearAll(T.femboy),
  [T.femboy, 'femboys.spawn', 0, F.x, F.z, 0, { idle: 99 }],
  [T.femboy, 'octopus.stashNow'], [T.femboy + 0.05, 'octopus.near', 'sock', 0, -4], [T.femboy + 0.05, 'cut'],
  [T.femboy, 'leader.spawn', 0, A.x, A.z, 0, { idle: 99 }], [T.femboy, 'leader.statue'], [T.femboy, 'leader.flag'], [T.femboy, 'leader.tank'],
  [10.6, 'octopus.steal', '', 'sock'],
  // The flag.
  [T.army, 'octopus.stashNow'], [T.army + 0.05, 'octopus.near', 'flag', 0, 4], [T.army + 0.05, 'cut'],
  [13.5, 'octopus.steal', '', 'flag'],
  // You.
  [T.cube, 'octopus.stashNow'], [T.cube, 'cube.teleport', C.x, C.z], [T.cube, 'cult.charms', 3],
  [T.cube + 0.05, 'octopus.near', 'charm', -4, 0], [T.cube + 0.05, 'cut'],
  [18.9, 'octopus.steal', '', 'charm'],
  // The rock.
  [T.rock, 'octopus.stashNow'], [T.rock, 'cube.teleport', POOL.x + 2, POOL.z + 2], [T.rock + 0.05, 'cut'],
  [T.out, 'cut'],
];

const zoom = [
  [0, 1.9], [T.comment, 1.6], [5.2, 1.3], [T.femboy - 0.01, 1.4],
  [T.femboy, 1.35], [T.army - 0.01, 1.5],
  [T.army, 0.95], [T.cube - 0.01, 0.85],
  [T.cube, 1.2], [T.rock - 0.01, 1.35],
  [T.rock, 1.15], [T.out - 0.01, 1.25],
  [T.out, 2.0], [seconds, 2.4],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < 5.3) cam.focus = [POOL.x, POOL.z];
  else if (t < T.femboy) cam.focus = [POOL.x + 0.3, keyframes([[5.3, POOL.z], [6.4, POOL.z + 2.4], [8.0, POOL.z + 2.4], [9.2, POOL.z + 0.6], [T.femboy, POOL.z + 0.4]], t)];
  else if (t < T.army) cam.focus = [F.x, keyframes([[T.femboy, F.z - 2], [11.4, F.z - 0.8], [T.army, F.z - 0.8]], t)];
  else if (t < T.cube) cam.at = 'army.flag';
  else if (t < T.rock) return cam; // on the cube
  else if (t < T.out) cam.focus = [POOL.x + 1.2, POOL.z + 0.6];
  else cam.focus = [POOL.x, POOL.z];
  return cam;
}

// Voice-over, as estimated. Retimed to the real recording afterwards.
const captions = [
  [0.2, 0.9, 'Day four'], [0.9, 2.0, 'of letting Instagram comments'], [2.0, 2.8, 'build this game.'],
  [3.8, 4.5, 'Top comment:'], [4.5, 5.2, 'an octopus'], [5.2, 6.3, 'that steals from everyone.'],
  [6.8, 7.9, 'It takes a goth’s bow.'], [8.4, 9.4, 'She noticed.'],
  [10.2, 11.2, 'A femboy’s sock.'], [11.8, 12.7, 'Just the one.'],
  [13.2, 14.4, 'The dictator’s flag.'], [15.0, 16.2, 'The tank fires back.'], [17.2, 18.1, 'And misses.'],
  [18.7, 19.8, 'It even robs you.'], [20.4, 21.6, 'That was your charm.'],
  [22.2, 23.0, 'It keeps everything'], [23.0, 23.7, 'on a rock.'], [24.3, 25.1, 'Bump the rock.'], [25.3, 26.7, 'Everyone gets their stuff back.'],
  [27.2, 27.9, 'Day five.'], [27.9, 28.9, 'Top comment wins.'], [29.3, 30.5, 'It’s still watching.'],
];
// Short written asides, popped on like a reply.
const asides = [
  [6.9, 8.3, 'bow: gone'],
  [11.9, 12.9, 'sock: gone'],
  [14.9, 16.6, 'flag: gone'],
  [17.0, 18.4, 'tank accuracy: still 0%'],
  [20.3, 21.9, '✦3 → ✦2'],
  [24.3, 26.8, 'all returned · +1 ✦'],
];

const sfx = [
  [T.comment, 'pop'], [6.5, 'pop'], [T.femboy, 'pop'], [11.8, 'pop'], [T.army, 'pop'], [14.8, 'pop'],
  [15.6, 'tick'], [16.9, 'boom'], [T.cube, 'pop'], [20.2, 'pop'], [T.rock, 'pop'], [24.3, 'boom'], [30.2, 'dun'],
];
const music = {
  sections: [[0, 29.3]],
  duck: [[0.2, 2.8], [3.8, 6.3], [6.8, 7.9], [8.4, 9.4], [10.2, 12.7], [13.2, 14.4], [15.0, 16.2], [17.2, 18.1], [18.7, 21.6], [22.2, 23.7], [24.3, 26.7], [27.2, 28.9], [29.3, 30.5]],
};

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; white-space:nowrap; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:39px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .hook { position:absolute; left:0; right:0; top:8.5%; text-align:center; }
  .hook div { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:900; font-size:44px; line-height:1.02;
              padding:12px 22px 10px; border-radius:16px; transform:rotate(-2deg); }
  .hook b { color:var(--red); }
  .comment { position:absolute; left:18px; right:18px; top:15%; transform-origin:30% 50%; }
  .comment img { display:block; width:100%; border-radius:16px; box-shadow:0 18px 50px rgba(29,27,25,.35); }
  .comment .tag { position:absolute; left:10px; top:-38px; }
  .aside { position:absolute; left:0; right:0; top:27%; text-align:center; }
  .aside span { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:800; font-size:25px;
                padding:9px 18px 8px; border-radius:14px; transform:rotate(1.5deg); }
  .black { position:absolute; inset:0; background:#000; }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;

function html(t) {
  let h = '';
  if (t < T.comment) {
    h += `<div class="hook"><div>THE COMMENTS ADDED<br>A <b>THIEF.</b></div></div>`;
    h += `<div class="sub" style="top:23%"><span class="tag">DAY 4</span></div>`;
  }
  if (within(t, T.comment, 6.5)) {
    const leaving = 1 - smooth((t - 6.25) / 0.25);
    const s = pop(t, T.comment, 0.22) * leaving;
    h += `<div class="comment" ${scaled(s, `transform:rotate(-2deg) scale(${s.toFixed(3)})`)}>
      <span class="tag">TOP COMMENT</span><img src="/reelasset/top.png"></div>`;
  }
  const aside = asides.find(([a, b]) => within(t, a, b));
  if (aside) h += `<div class="aside"><span ${scaled(pop(t, aside[0], 0.16), 'transform-origin:50% 50%')}>${esc(aside[2])}</span></div>`;
  if (within(t, 29.2, T.black)) h += `<div class="big" ${scaled(pop(t, 29.2), 'top:13%;font-size:46px')}>lock up your socks.</div>`;
  const c = captions.find(([a, b]) => within(t, a, b));
  if (c) h += `<div class="cap"><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  if (t >= T.black) h += '<div class="black"></div>';
  return h;
}

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, html, css, sfx, music };
