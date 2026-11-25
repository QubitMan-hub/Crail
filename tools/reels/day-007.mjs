// The Day 7 Reel: late, but with an excuse. Times are in seconds.
//   0-3.2     HOOK     "Day 7 is late. There's a reason." over the new forest
//   3.2-9.6   EXCUSE   was busy: the old look (BEFORE), wiped away to the new one (AFTER)
//   9.6-12.8  SPARKLE  the AI sparkle that used to float over the rides: fired
//   12.8-16.2 COMMENT  the top comment: a block counter. Fair.
//   16.2-22.8 COUNTER  every block, counted: a pop at 100, and the 1,000 line
//   22.8-31.5 TREES    the personal request: trees, random, eight kinds; bump one
//   31.5-36   OUT      Day 8: the top comment decides
//
// Needs a file that is not in the repository:
//   captures/day-007-assets/before.png   the park in the old look, framed exactly like the
//                                         AFTER shot (rendered from the commit before the redesign)
import { existsSync } from 'node:fs';
import { esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-007-assets';
const T = { busy: 3.2, wipe: 5.6, after: 6.3, sparkle: 9.6, comment: 12.8, counter: 16.2, trees: 22.8, out: 31.5 };
const seconds = 36;
/** The park shot, framed exactly as the BEFORE picture was. */
const PARK = { cube: [13, 2], focus: [13.5, 1.5], zoom: 1.05 };
const GROVE = [-26, -19];

function prepare() {
  if (!existsSync(`${ASSETS}/before.png`)) throw new Error(`Missing ${ASSETS}/before.png (the old look, framed like the AFTER shot).`);
}

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const actions = [
  ...CASTS.map((c) => [0, `${c}.staged`, true]),
  [0, 'octopus.staged', true], [0, 'picachu.staged', true], [0, 'rivals.staged', true],
  [0, 'cult.charms', 3], [0, 'blocks.set', 0],
  [0, 'cube.teleport', GROVE[0], GROVE[1]], [0, 'cut'],
  [T.busy, 'cube.teleport', ...PARK.cube], [T.busy, 'cut'],
  // Nobody in the way of the counter run.
  ...CASTS.map((c) => [T.comment, `${c}.clear`]), [T.comment, 'fighters.staged', true],
  [T.comment, 'cube.teleport', -7, 0], [T.comment, 'cut'],
  // Every block, counted: 95 to past 100, then again from 995 to past 1,000.
  [T.counter, 'blocks.set', 95],
  [19.4, 'cube.teleport', -7, 0], [19.4, 'blocks.set', 995], [19.4, 'cut'],
  [T.trees, 'cube.teleport', GROVE[0], GROVE[1]], [T.trees, 'cut'],
  [27.6, 'trees.bump'],
];
// D rolls east.
const keys = [[16.6, 18.6, 'D'], [19.8, 21.8, 'D'], [28.0, 28.12, 'D']];

const zoom = [
  [0, 0.9], [T.busy - 0.01, 1.0],
  [T.busy, PARK.zoom], [T.sparkle - 0.01, PARK.zoom], [T.sparkle + 0.6, 2.1], [T.comment - 0.01, 2.2],
  [T.comment, 1.45], [T.trees - 0.01, 1.5],
  [T.trees, 1.3], [29.6, 1.3], [33.5, 0.62], [seconds, 0.58],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < T.busy) cam.focus = [GROVE[0] + keyframes([[0, -1.5], [T.busy, 0.5]], t), GROVE[1] + 1];
  else if (t < T.sparkle) cam.focus = PARK.focus;
  else if (t < T.comment) cam.focus = [keyframes([[T.sparkle, PARK.focus[0]], [T.sparkle + 0.6, 11.2]], t), keyframes([[T.sparkle, PARK.focus[1]], [T.sparkle + 0.6, 2.7]], t)];
  // Otherwise the camera follows the cube.
  return cam;
}

// How far the counter has got, read from the game.
const probe = `({ blocks: window.__crail.state.blocks.total })`;

const css = `
  #reel { font-family: var(--text); }
  .sign { position:absolute; left:0; right:0; text-align:center; }
  .sign > div { display:inline-block; padding:14px 24px 12px; font:400 58px/1 var(--display); color:var(--ink);
                background:var(--paper); border:3px solid var(--ink); border-radius:18px;
                box-shadow:0 10px 24px -6px rgba(31,36,48,.45); transform:rotate(-2deg); }
  .sign.small > div { font-size:30px; padding:10px 18px 8px; transform:rotate(1.5deg); background:var(--yellow); }
  .stamp { position:absolute; left:0; right:0; top:15%; text-align:center; }
  .stamp span { display:inline-block; padding:8px 16px 5px; font:400 34px/1 var(--display); letter-spacing:.02em;
                border:3px solid var(--ink); border-radius:12px; transform:rotate(-4deg); }
  .stamp.before span { background:#efe9dc; color:#7b766c; border-color:#7b766c; }
  .stamp.after span { background:var(--yellow); color:var(--ink); }
  .cap { position:absolute; left:0; right:0; top:61%; text-align:center; }
  .cap div { font:400 46px/1.04 var(--display); color:var(--ink); -webkit-text-stroke:10px var(--paper); paint-order:stroke fill; }
  .cap.loud div { font-size:64px; color:var(--red); }
  .before-img { position:absolute; inset:0; background:url('/reelasset/before.png') center / 540px 960px no-repeat; }
  .wipe-edge { position:absolute; top:0; bottom:0; width:10px; background:var(--paper); box-shadow:0 0 18px rgba(31,36,48,.35); }
  .inset { position:absolute; left:50%; top:22%; width:170px; height:170px; margin-left:-85px; border:3px solid var(--ink);
           border-radius:18px; overflow:hidden; box-shadow:0 10px 24px -6px rgba(31,36,48,.45);
           background:url('/reelasset/before.png') 49px -406px / 540px 960px no-repeat; }
  .inset b { position:absolute; left:-10px; right:-10px; top:58px; padding:6px 0 3px; text-align:center;
             font:400 40px/1 var(--display); color:var(--paper); background:var(--red); transform:rotate(-14deg);
             border-top:3px solid var(--ink); border-bottom:3px solid var(--ink); }
  .card { position:absolute; left:26px; right:26px; top:17%; padding:22px 24px 20px; background:var(--paper);
          border:3px solid var(--ink); border-radius:20px; box-shadow:0 14px 30px -8px rgba(31,36,48,.5); transform-origin:30% 50%; }
  .card .tag { position:absolute; left:16px; top:-22px; padding:6px 12px 4px; font:400 20px/1 var(--display);
               background:var(--yellow); border:3px solid var(--ink); border-radius:10px; }
  .card .who { font-weight:650; font-size:20px; color:var(--blue-deep); }
  .card .what { margin-top:8px; font-weight:650; font-size:31px; line-height:1.18; color:var(--ink); }
  .card .likes { display:flex; align-items:center; gap:6px; margin-top:12px; font-weight:650; font-size:19px; color:var(--red); }
  .card .likes svg { width:22px; height:22px; }
  .counter { position:absolute; left:0; right:0; top:19%; text-align:center; }
  .counter > div { display:inline-flex; align-items:center; gap:14px; padding:14px 26px 12px 18px; background:var(--paper);
                   border:3px solid var(--ink); border-radius:20px; box-shadow:0 12px 28px -8px rgba(31,36,48,.5); }
  .counter svg { width:64px; height:64px; }
  .counter b { font:400 96px/1 var(--display); font-variant-numeric:tabular-nums; color:var(--ink); }
  .counter span { font-weight:650; font-size:26px; color:var(--ink-soft); align-self:flex-end; margin-bottom:12px; }
  .out { position:absolute; left:0; right:0; top:22%; text-align:center; }
  .out .d8 { display:inline-block; padding:10px 26px 4px; font:400 120px/1 var(--display); background:var(--yellow);
             border:4px solid var(--ink); border-radius:24px; transform:rotate(-3deg); box-shadow:0 14px 30px -8px rgba(31,36,48,.5); }
  .out .line { margin-top:20px; font:400 40px/1.05 var(--display); color:var(--ink); -webkit-text-stroke:10px var(--paper); paint-order:stroke fill; }
  .out .tag { display:inline-block; margin-top:20px; padding:10px 18px 7px; font:400 24px/1 var(--display); color:var(--paper);
              background:var(--blue); border:3px solid var(--ink); border-radius:12px; }
  .black { position:absolute; inset:0; background:#000; }
  .flash { position:absolute; inset:0; background:var(--paper); }
`;

const CUBE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.6l8.6 4.9v9L12 21.4l-8.6-4.9v-9z" fill="#e8402a" stroke="#1f2430" stroke-width="2.2" stroke-linejoin="round"/><path d="M3.4 7.5L12 12.4l8.6-4.9M12 12.4v9" fill="none" stroke="#1f2430" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 12.4l8.6-4.9v9L12 21.4z" fill="#000" opacity=".16"/></svg>';
const HEART_SVG = '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="#e8402a" stroke="#1f2430" stroke-width="2" stroke-linejoin="round"/></svg>';

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;
const lines = (l) => l.map((x) => `<div>${esc(x)}</div>`).join('');
/** In, held, then out. */
const life = (t, a, b, dur = 0.2) => pop(t, a, dur) * (1 - smooth((t - (b - 0.18)) / 0.18));

// Captions: [from, to, lines, loud?]
const captions = [
  [T.busy + 0.3, T.wipe, ['Was busy.']],
  [T.after + 0.2, 8.0, ['So the whole game', 'got a makeover.']],
  [8.0, T.sparkle, ['New font.', 'New colours.']],
  [T.sparkle + 0.4, 11.4, ['The AI sparkle?']],
  [11.4, T.comment, ['Fired.'], true],
  [14.6, T.counter, ['Fair.'], true],
  [16.6, 18.0, ['Every block.', 'Counted.']],
  [18.0, 19.4, ['Forever.'], true],
  [T.trees + 0.2, 25.0, ['Plus a personal request:', 'trees.']],
  [25.0, 26.6, ['Random.', 'Procedural.']],
  [26.6, 28.1, ['Eight kinds.']],
  [28.2, 29.8, ['Bump one:', 'free leaves.']],
  [29.8, T.out, ['An actual forest.', 'Grown as you go.']],
];
let thousandAt = Infinity;

function html(t, probe) {
  let h = '';
  for (const c of [T.busy, T.comment, T.trees]) {
    if (within(t, c, c + 0.12)) h += `<div class="flash" style="opacity:${(1 - (t - c) / 0.12).toFixed(2)}"></div>`;
  }
  // Hook.
  if (within(t, 0.45, T.busy)) {
    h += `<div class="sign" style="top:13%"><div ${scaled(life(t, 0.45, T.busy, 0.25), 'transform:rotate(-2deg) scale(' + life(t, 0.45, T.busy, 0.25).toFixed(3) + ')')}>DAY 7 IS LATE.</div></div>`;
    if (t > 1.6) h += `<div class="sign small" style="top:24%"><div ${scaled(life(t, 1.6, T.busy), 'transform:rotate(1.5deg) scale(' + life(t, 1.6, T.busy).toFixed(3) + ')')}>There’s a reason.</div></div>`;
  }
  // Before, wiped away to after.
  if (within(t, T.busy, T.after)) {
    const k = smooth((t - T.wipe) / (T.after - T.wipe));
    h += `<div class="before-img" style="clip-path:inset(0 0 0 ${(k * 100).toFixed(2)}%)"></div>`;
    if (k > 0 && k < 1) h += `<div class="wipe-edge" style="left:calc(${(k * 100).toFixed(2)}% - 5px)"></div>`;
    if (t < T.wipe + 0.1) h += `<div class="stamp before"><span ${scaled(pop(t, T.busy + 0.1, 0.18), 'transform:rotate(-4deg) scale(' + pop(t, T.busy + 0.1, 0.18).toFixed(3) + ')')}>BEFORE</span></div>`;
  }
  if (within(t, T.after, T.sparkle)) h += `<div class="stamp after"><span ${scaled(life(t, T.after, T.sparkle, 0.18), 'transform:rotate(-4deg) scale(' + life(t, T.after, T.sparkle, 0.18).toFixed(3) + ')')}>AFTER</span></div>`;
  // The old sparkle, fired.
  if (within(t, T.sparkle + 0.4, T.comment)) {
    const s = life(t, T.sparkle + 0.4, T.comment);
    h += `<div class="inset" ${scaled(s, 'transform:scale(' + s.toFixed(3) + ')')}>${t > 11.4 ? `<b style="transform:rotate(-14deg) scale(${pop(t, 11.4, 0.16).toFixed(3)})">FIRED</b>` : ''}</div>`;
  }
  // The comment.
  if (within(t, T.comment, T.counter)) {
    const s = life(t, T.comment + 0.1, T.counter, 0.22);
    h += `<div class="card" ${scaled(s, 'transform:rotate(-2deg) scale(' + s.toFixed(3) + ')')}>
      <span class="tag">TOP COMMENT</span>
      <div class="who">@lonokkalani</div>
      <div class="what">Add a block counter so we can see how my blocks we have moved</div>
      <div class="likes">${HEART_SVG}5</div></div>`;
  }
  // The counter, big, in step with the game.
  if (within(t, T.counter, T.trees) && probe) {
    if (probe.blocks >= 1000 && thousandAt === Infinity) thousandAt = t;
    const s = life(t, T.counter, T.trees, 0.22);
    const hit = (probe.blocks >= 100 && probe.blocks < 110) || probe.blocks >= 1000;
    h += `<div class="counter"><div ${scaled(s, 'transform:scale(' + (s * (hit && t - thousandAt < 0.5 ? 1.08 : 1)).toFixed(3) + ')')}>${CUBE_SVG}<b>${probe.blocks.toLocaleString('en-US')}</b><span>blocks</span></div></div>`;
  }
  if (t >= thousandAt && t < T.trees) {
    h += `<div class="cap"><div ${scaled(pop(t, thousandAt + 0.1, 0.18), 'font-size:38px')}>1,000 blocks:</div><div ${scaled(pop(t, thousandAt + 0.4, 0.18), 'font-size:38px')}>the cube has no legs,</div><div ${scaled(pop(t, thousandAt + 0.7, 0.18), 'font-size:38px')}>and it is still tired.</div></div>`;
  } else {
    const c = captions.find(([a, b]) => within(t, a, b));
    if (c && !(c[0] === 18.0 && t >= thousandAt)) h += `<div class="cap${c[3] ? ' loud' : ''}" ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${lines(c[2])}</div>`;
  }
  // Out.
  if (t >= T.out) {
    h += `<div class="out">
      <div class="d8" ${scaled(pop(t, T.out + 0.1, 0.26), 'transform:rotate(-3deg) scale(' + pop(t, T.out + 0.1, 0.26).toFixed(3) + ')')}>DAY 8</div>
      <div class="line" ${scaled(pop(t, T.out + 0.5, 0.2))}>the top comment decides</div>
      <span class="tag" ${scaled(pop(t, T.out + 0.9, 0.2))}>COMMENT BELOW</span></div>`;
  }
  if (t >= seconds - 0.35) h += `<div class="black" style="opacity:${smooth((t - (seconds - 0.35)) / 0.3).toFixed(2)}"></div>`;
  return h;
}

const gameSfx = [
  [0, { kind: 'stinger', gain: 0.8 }],
  [T.wipe, { kind: 'whoosh', dur: 0.7, pitch: 0.8 }],
  [T.sparkle, { kind: 'whoosh', dur: 0.5 }],
  [11.4, { kind: 'crack', gain: 0.7 }],
  [T.comment, { kind: 'heavy', gain: 0.6 }],
  [T.trees, { kind: 'whoosh', dur: 0.5 }],
  [T.out, { kind: 'stinger', gain: 0.7 }],
];
const sfx = [[1.6, 'dun'], [T.busy + 0.1, 'pop'], [T.after, 'pop'], [8.0, 'pop'], [14.6, 'dun'], [18.0, 'pop'], [26.6, 'pop']];
const music = { sections: [[0.4, T.out - 0.2]] };

export default {
  seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, html, css, sfx, music, gameSfx, probe, query: '&seed=11',
};
