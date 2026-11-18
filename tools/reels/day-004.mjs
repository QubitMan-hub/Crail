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
const T = { comment: 3.6, goth: 6.6, femboy: 10.3, army: 13.0, cube: 18.5, rock: 21.9, out: 26.9, black: 30.7 };
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
const keys = [[23.9, 24.0, 'W'], [24.7, 24.8, 'W']];

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const clearAll = (t) => CASTS.map((c) => [t, `${c}.clear`]);
const actions = [
  ...CASTS.map((c) => [0, `${c}.staged`, true]), [0, 'octopus.staged', true],
  ...clearAll(0),
  [0, 'cult.charms', 0], [0, 'cube.teleport', -70, 30],
  // She has a bow. Not for long.
  [0, 'goths.spawn', 1, POOL.x, POOL.z + 4, 0, { idle: 99 }], [0, 'goths.bow', 0], [0, 'cut'],
  [6.6, 'octopus.steal', 'goth'],
  // One femboy, a long way from anywhere. The army sets up off screen while this plays.
  // The goth stays in the world: her bow will fly back to her at the end.
  ...['femboys', 'soldiers', 'leader'].map((c) => [T.femboy, `${c}.clear`]),
  [T.femboy, 'femboys.spawn', 0, F.x, F.z, 0, { idle: 99 }],
  [T.femboy, 'octopus.stashNow'], [T.femboy + 0.05, 'octopus.near', 'sock', 0, -4], [T.femboy + 0.05, 'cut'],
  [T.femboy, 'leader.spawn', 0, A.x, A.z, 0, { idle: 99 }], [T.femboy, 'leader.statue'], [T.femboy, 'leader.flag'], [T.femboy, 'leader.tank'],
  [10.4, 'octopus.steal', '', 'sock'],
  // The flag.
  [T.army, 'octopus.stashNow'], [T.army + 0.05, 'octopus.near', 'flag', 0, 4], [T.army + 0.05, 'cut'],
  [13.3, 'octopus.steal', '', 'flag'],
  // You.
  [T.cube, 'octopus.stashNow'], [T.cube, 'cube.teleport', C.x, C.z], [T.cube, 'cult.charms', 3],
  [T.cube + 0.05, 'octopus.near', 'charm', -4, 0], [T.cube + 0.05, 'cut'],
  [18.9, 'octopus.steal', '', 'charm'],
  // The rock.
  [T.rock, 'octopus.stashNow'], [T.rock, 'cube.teleport', POOL.x + 2, POOL.z + 2], [T.rock, 'goths.place', 0, POOL.x, POOL.z + 2], [T.rock + 0.05, 'cut'],
  [T.out, 'cube.teleport', -70, 30], [T.out, 'cut'],
];

const zoom = [
  [0, 1.9], [T.comment, 1.6], [6.5, 1.3], [T.femboy - 0.01, 1.4],
  [T.femboy, 1.35], [T.army - 0.01, 1.5],
  [T.army, 0.95], [T.cube - 0.01, 0.85],
  [T.cube, 1.2], [T.rock - 0.01, 1.35],
  [T.rock, 1.15], [T.out - 0.01, 1.25],
  [T.out, 2.0], [seconds, 2.4],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < 6.6) cam.focus = [POOL.x, POOL.z];
  else if (t < T.femboy) cam.focus = [POOL.x + 0.3, keyframes([[6.6, POOL.z], [7.5, POOL.z + 3.2], [9.0, POOL.z + 3.2], [9.8, POOL.z + 1], [T.femboy, POOL.z + 0.8]], t)];
  else if (t < T.army) cam.focus = [F.x, keyframes([[T.femboy, F.z - 2], [11.5, F.z - 0.8], [T.army, F.z - 0.8]], t)];
  else if (t < T.cube) cam.at = 'army.flag';
  else if (t < T.rock) return cam; // on the cube
  else if (t < T.out) cam.focus = [POOL.x + 1.2, POOL.z + 0.6];
  else cam.focus = [POOL.x, POOL.z];
  return cam;
}

// Voice-over: [from, to] in the recording, and where that line starts in the Reel.
const voice = [
  [1.37, 4.16, 0.17], //    Day four of letting Instagram comments build my game.
  [4.73, 8.48, 3.72], //    The top comment was an octopus that steals from everyone.
  [9.45, 10.73, 7.57], //   It takes a goth's bow,
  [11.26, 12.08, 9.07], //  she noticed.
  [12.69, 13.84, 10.47], // A femboy sock,
  [14.59, 15.27, 11.97], // just the one.
  [15.84, 17.06, 13.17], // The dictator's flag.
  [17.55, 18.62, 14.87], // The tank fires back.
  [19.2, 20.61, 16.77], //  And misses, as usual.
  [21.34, 22.54, 18.67], // It can even rob you.
  [23.15, 24.33, 20.32], // That was your charm.
  [25.02, 26.7, 22.07], //  It keeps everything on a rock,
  [27.01, 27.9, 23.97], //  bump the rock.
  [28.26, 29.65, 25.07], // Everyone gets their stuff back.
  [30.33, 32.15, 27.07], // Day five, the top comment wins.
  [32.9, 34.04, 29.27], //  It's still watching.
];
// Captions follow the actual words in the recording.
const captions = [
  [0.2, 0.72, 'Day four'], [0.72, 1.24, 'of letting'], [1.24, 2.12, 'Instagram comments'], [2.12, 2.93, 'build my game.'],
  [3.75, 4.41, 'The top comment'], [4.41, 5.65, 'was an octopus'], [6.07, 6.53, 'that steals'], [6.53, 7.44, 'from everyone.'],
  [7.6, 8.82, 'It takes a goth’s bow.'], [9.1, 9.86, 'She noticed.'],
  [10.5, 11.59, 'A femboy sock.'], [12.0, 12.62, 'Just the one.'],
  [13.2, 14.36, 'The dictator’s flag.'], [14.9, 15.91, 'The tank fires back.'], [16.8, 17.35, 'And misses,'], [17.35, 18.15, 'as usual.'],
  [18.7, 19.84, 'It can even rob you.'], [20.35, 21.47, 'That was your charm.'],
  [22.1, 22.93, 'It keeps everything'], [22.93, 23.72, 'on a rock.'], [24.0, 24.83, 'Bump the rock.'], [25.1, 25.65, 'Everyone gets'], [25.65, 26.43, 'their stuff back.'],
  [27.1, 27.6, 'Day five.'], [27.9, 28.86, 'The top comment wins.'], [29.3, 30.38, 'It’s still watching.'],
];
// Short written asides, popped on like a reply.
const asides = [
  [8.0, 9.0, 'bow: gone'],
  [11.7, 12.9, 'sock: gone'],
  [14.6, 16.4, 'flag: gone'],
  [16.8, 18.4, 'tank accuracy: still 0%'],
  [20.2, 21.8, '✦3 → ✦2'],
  [24.9, 25.9, 'all returned · +1 ✦'],
  [25.9, 26.85, 'Gåmson: furious'],
  [4.5, 7.2, 'his name is Gåmson'],
];

const sfx = [
  [T.comment, 'pop'], [7.8, 'pop'], [T.femboy, 'pop'], [11.6, 'pop'], [T.army, 'pop'], [14.5, 'pop'],
  [15.3, 'tick'], [16.6, 'boom'], [T.cube, 'pop'], [20.1, 'pop'], [T.rock, 'pop'], [24.9, 'boom'], [30.3, 'dun'],
];
const music = {
  sections: [[0, 29.3]],
  duck: voice.map(([from, to, at]) => [at, at + (to - from)]),
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
  if (within(t, T.comment, 7.3)) {
    const leaving = 1 - smooth((t - 7.05) / 0.25);
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

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, html, css, sfx, music, voice };
