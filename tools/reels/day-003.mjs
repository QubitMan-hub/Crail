// The Day 3 Reel: combo weekend. Three features in one episode. Times are in seconds.
//   0-3      HOOK    where Day 2 left off: she kept the bow
//   3-6.5    COMBO   red card: three comments, one weekend
//   6.5-14.5 ONE     top comment: the leader, his soldiers, and the rocket
//   14.5-24.5 TWO    pick: the park. Everyone rides. Rides earn charms.
//   24.5-34  THREE   pick: the cult. Charms recruit. They follow, then they worship.
//   34-38.3  OUT     she still has the bow
//
// Needs files that are not in the repository:
//   captures/day-003-assets/{top,park,cult}.png   screenshots of the three real comments
import { existsSync } from 'node:fs';
import { esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-003-assets';
const T = { combo: 3.0, one: 6.5, rocket: 10.9, two: 14.5, carousel: 18.0, wheel: 20.8, three: 24.5, walk: 29.6, out: 35.0, black: 39.0 };
const seconds = 39.3;
/** Where the cult scene plays. */
const C = { x: 50, z: 24 };

function prepare() {
  for (const f of ['top', 'park', 'cult']) {
    if (!existsSync(`${ASSETS}/${f}.png`)) throw new Error(`Missing ${ASSETS}/${f}.png (screenshot of a real comment).`);
  }
}

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [0.6, 0.7, 'A'], [1.1, 1.2, 'A'],
  [25.7, 25.8, 'S'], [26.8, 26.9, 'A'], [27.9, 28.0, 'W'],
  [30.0, 30.1, 'D'], [30.4, 30.5, 'D'], [30.8, 30.9, 'D'],
];

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const clearAll = (t) => CASTS.map((c) => [t, `${c}.clear`]);
const actions = [
  ...CASTS.map((c) => [0, `${c}.staged`, true]),
  ...clearAll(0),
  [0, 'cult.charms', 0],
  // Hook: the goth from Day 2, still wearing the bow.
  [0, 'cube.teleport', 3, 0], [0, 'goths.spawn', 0, 1, 0, 0, { idle: 99 }], [0, 'goths.bow', 0], [0, 'cut'],
  // One: he sets off early, far away, so he already has two soldiers when we cut to him.
  [1.0, 'leader.spawn', 0, -70, 0, 0, { steps: 40 }],
  [1.2, 'leader.build'], [3.8, 'leader.build'],
  [T.one, 'cube.teleport', -70, 30], [T.one, 'cut'],
  [8.0, 'leader.build'],
  [10.7, 'leader.site'], [T.rocket, 'cut'], [11.3, 'leader.launch'],
  // Two: the park, already busy.
  ...clearAll(T.two),
  [T.two, 'goths.spawn', 0, 12, -1, 3, { idle: 99 }], [T.two, 'goths.spawn', 2, 14, -1, 3, { idle: 99 }],
  [T.two, 'goths.spawn', 1, 18, -5, 3, { idle: 99 }],
  [T.two, 'femboys.spawn', 0, 16, -3, 2, { idle: 99 }], [T.two, 'femboys.spawn', 1, 16, -5, 2, { idle: 99 }],
  [T.two, 'femboys.spawn', 2, 12, 1, 1, { idle: 99 }], [T.two, 'femboys.spawn', 3, 14, 1, 1, { idle: 99 }],
  [T.two, 'leader.spawn', 0, 13, -1, 3, { idle: 99 }],
  [T.two, 'park.board', 'goths', 0, 'carousel'], [T.two, 'park.board', 'goths', 1, 'carousel'],
  [T.two, 'park.board', 'goths', 2, 'wheel'],
  [T.two, 'park.board', 'femboys', 0, 'carousel'], [T.two, 'park.board', 'femboys', 1, 'carousel'],
  [T.two, 'park.board', 'femboys', 2, 'trampoline'], [T.two, 'park.board', 'femboys', 3, 'trampoline'],
  [T.two, 'park.board', 'leader', 0, 'carousel'],
  [T.two, 'cube.teleport', 20, -5], [T.two, 'cut'], [15.0, 'park.ride', 'wheel'],
  [T.carousel, 'cut'], [T.wheel, 'cut'],
  // Three: three people about to have a change of career.
  ...clearAll(T.three),
  [T.three, 'cube.teleport', C.x, C.z], [T.three, 'cult.charms', 3], [T.three, 'cult.face', 0],
  [T.three, 'femboys.spawn', 0, C.x, C.z + 1, 3, { idle: 99 }],
  [T.three, 'leader.spawn', 0, C.x - 1, C.z, 0, { idle: 99 }],
  [T.three, 'goths.spawn', 1, C.x, C.z - 1, 1, { idle: 99 }], [T.three, 'goths.bow', 0],
  [T.three, 'cut'], [T.walk, 'cut'], [T.out, 'cut'],
];

const zoom = [
  [0, 1.35], [T.combo, 1.55],
  [T.one, 1.25], [T.rocket - 0.01, 1.45], [T.rocket, 1.0], [T.two - 0.01, 0.95],
  [T.two, 0.44], [T.carousel - 0.01, 0.5], [T.carousel, 1.05], [T.wheel - 0.01, 1.15],
  [T.wheel, 0.82], [T.three - 0.01, 0.9],
  [T.three, 1.45], [T.walk - 0.01, 1.35], [T.walk, 0.9], [31.5, 0.9], [T.out - 0.01, 1.12],
  [T.out, 2.1], [seconds, 2.3],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < T.one) cam.focus = [0.7, -0.8];
  else if (t < T.rocket) cam.follow = ['leader', 0];
  else if (t < T.two) cam.at = 'rocket';
  else if (t < T.carousel) cam.focus = [16, -1.5];
  else if (t < T.wheel) cam.focus = [13.6, -3.4];
  else if (t < T.three) cam.focus = [19.5, -6.5];
  else if (t < T.walk) cam.focus = [C.x, C.z];
  else if (t < T.out) cam.focus = [keyframes([[T.walk, C.x + 0.3], [30, C.x + 0.3], [31.4, C.x + 2.8], [T.out, C.x + 3.0]], t), C.z];
  else cam.follow = ['goths', 0];
  return cam;
}

const frozen = (t) => t >= T.combo && t < T.one - 0.4;

// Voice-over, as estimated. Retimed to the real recording afterwards.
const captions = [
  [0.25, 1.1, 'Day three'], [1.1, 1.7, 'of letting'], [1.7, 2.4, 'Instagram comments'], [2.4, 2.95, 'build my game.'],
  [3.2, 4.2, 'I had a free weekend.'], [4.3, 5.3, 'So this isn’t one feature.'], [5.4, 6.3, 'It’s three.'],
  [6.8, 7.5, 'Top comment:'], [7.5, 8.7, 'he builds a military.'],
  [9.2, 10.0, 'He builds soldiers.'], [10.0, 10.8, 'They follow him.'],
  [12.2, 13.0, 'His rocket'], [13.0, 14.2, 'has never worked.'],
  [14.8, 15.6, 'My first pick:'], [15.6, 16.2, 'a park.'], [16.3, 17.2, 'With rides.'],
  [18.2, 19.1, 'Everyone can ride.'], [19.4, 20.3, 'Even him.'],
  [21.4, 22.3, 'Every ride'], [22.3, 23.4, 'earns a charm.'],
  [24.8, 25.6, 'Second pick:'], [25.6, 26.5, 'make a cult.'],
  [26.9, 27.8, 'A charm'], [27.8, 28.8, 'recruits anyone.'],
  [29.9, 31.2, 'They follow me now.'],
  [32.6, 33.4, 'I stop,'], [33.4, 34.6, 'they worship.'],
  [35.3, 36.3, 'Day four:'], [36.3, 37.3, 'top comment wins.'], [37.5, 38.5, 'Please. Be normal.'],
];

const sfx = [
  [T.combo, 'boom'], [4.2, 'pop'], [4.8, 'pop'], [5.4, 'pop'],
  [T.one, 'pop'], [T.two, 'pop'], [T.three, 'pop'], [38.3, 'dun'],
];
const music = {
  sections: [[0, T.combo], [T.one, 37.6]],
  duck: [[0.2, 2.95], [6.8, 8.7], [9.2, 10.8], [12.2, 14.2], [14.8, 17.2], [18.2, 20.3], [21.4, 23.4], [24.8, 28.8], [29.9, 31.2], [32.6, 34.6], [35.3, 38.5]],
};

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; white-space:nowrap; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:39px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .cap.onred span { color:#f6f1e6; -webkit-text-stroke:0; }
  .comment { position:absolute; left:18px; right:18px; top:15%; transform-origin:30% 50%; }
  .comment img { display:block; width:100%; border-radius:16px; box-shadow:0 18px 50px rgba(29,27,25,.35); }
  .comment .tag { position:absolute; left:10px; top:-38px; }
  .red { position:absolute; inset:0; background:var(--red); }
  .red .title { position:absolute; left:0; right:0; top:11%; text-align:center; font-weight:900; font-size:74px; line-height:.92; color:var(--ink); }
  .red .x3 { position:absolute; left:0; right:0; top:28.5%; text-align:center; font-weight:900; font-size:30px; letter-spacing:.06em; color:#f6f1e6; }
  .stack { position:absolute; left:34px; right:34px; }
  .stack img { display:block; width:100%; border-radius:12px; box-shadow:0 10px 30px rgba(29,27,25,.4); }
  .gain { position:absolute; left:0; right:0; top:30%; text-align:center; }
  .gain span { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:900; font-size:40px; padding:8px 20px 6px; border-radius:14px; }
  .gain b { color:var(--red); }
  .black { position:absolute; inset:0; background:#000; }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;

function chapter(t, at, until, file, tag) {
  if (!within(t, at, until)) return '';
  const leaving = 1 - smooth((t - (until - 0.25)) / 0.25);
  const s = pop(t, at, 0.22) * leaving;
  return `<div class="comment" ${scaled(s, `transform:rotate(-2deg) scale(${s.toFixed(3)})`)}>
    <span class="tag">${tag}</span><img src="/reelasset/${file}.png"></div>`;
}

function html(t) {
  let h = '';
  if (t < 2.95) {
    h += `<div class="big" style="top:11%;font-size:128px">DAY 3</div>`;
    h += `<div class="sub" style="top:25%;opacity:${t > 0.9 ? 1 : 0}">letting comments build my game</div>`;
  }
  if (within(t, T.combo, T.one)) {
    h += `<div class="red"><div class="title" ${scaled(pop(t, T.combo + 0.05, 0.25))}>COMBO<br>WEEKEND</div>
      <div class="x3" style="opacity:${t > 3.7 ? 1 : 0}">3 COMMENTS · 1 EPISODE</div>`;
    [['top', 4.2, 36, -3], ['park', 4.8, 48, 2.5], ['cult', 5.4, 60, -2]].forEach(([file, at, top, tilt]) => {
      const s = pop(t, at, 0.2);
      h += `<div class="stack" ${scaled(s, `top:${top}%;transform:rotate(${tilt}deg) scale(${s.toFixed(3)})`)}><img src="/reelasset/${file}.png"></div>`;
    });
    h += '</div>';
  }
  h += chapter(t, T.one, 9.0, 'top', '① TOP COMMENT');
  h += chapter(t, T.two, 17.6, 'park', '② MY PICK');
  h += chapter(t, T.three, 26.6, 'cult', '③ MY PICK');

  if (within(t, 24.0, T.three)) h += `<div class="gain"><span ${scaled(pop(t, 24.0, 0.18))}>+1 <b>✦</b> charm</span></div>`;
  if (within(t, 32.6, T.out)) {
    h += `<div class="big" ${scaled(pop(t, 32.6), 'top:13%;font-size:56px')}>CULT: 3</div>`;
    h += `<div class="sub" style="top:20%;font-size:21px;opacity:${t > 33.4 ? 1 : 0}">ride rides · earn charms · recruit everyone</div>`;
  }
  if (within(t, 37.6, T.black)) {
    h += `<div class="big" ${scaled(pop(t, 37.6), 'top:13%;font-size:46px')}>she still has the bow.</div>`;
  }

  const c = captions.find(([a, b]) => within(t, a, b));
  if (c) h += `<div class="cap${within(t, T.combo, T.one) ? ' onred' : ''}" ${within(t, T.combo, T.one) ? 'style="top:80%"' : ''}><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  if (t >= T.black) h += '<div class="black"></div>';
  return h;
}

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, frozen, html, css, sfx, music };
