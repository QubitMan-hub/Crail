// The Day 2 Reel: femboys. Times are in seconds.
//   0-5.2      HOOK      where Day 1 left off: the cube, cornered by goths
//   5.2-8.8    WINNER    the real top comment, which out-liked the Reel itself
//   8.8-14     COMMENTS  four more real comments, each with a one-line reply
//   14-16.4    DEAL      "a deal is a deal" and the running gag: WHATEVER. IT. IS.
//   16.4-19.6  REVEAL    wide shot, then a close tracking shot
//   19.6-22.6  GREETING  a femboy waves at a goth; she ends up wearing a bow
//   22.6-27.6  ADOPTED   bump one three times: giggle, pats, a bow for the cube
//   27.6-33    DAY 3     the parade, and the new rule for tomorrow
//   33-35.9    PUNCHLINE she kept the bow
//
// Needs files that are not in the repository (see prepare):
//   captures/day-002-assets/{femboys,bro,slop,ironman,replace,likes}.png  crops of the real comments
//   captures/day-000.mp4                                                 the Day 0 Reel, for the callback
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { clamp, esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-002-assets';
const OLD_REEL = 'captures/day-000.mp4';
const FPS = 30;

const SRC_A = 16.75; // "...whatever. it. is." in the Day 0 Reel
const SRC_B = 17.85;
const T = {
  winner: 5.2, comments: 8.8, deal: 14.0, tv: 15.2, reveal: 16.4, close: 18.2,
  greeting: 19.6, adopted: 22.6, parade: 27.6, punch: 33.0, black: 35.6,
};
const seconds = 35.9;

function prepare() {
  mkdirSync(ASSETS, { recursive: true });
  for (const f of ['femboys', 'bro', 'slop', 'ironman', 'replace', 'likes']) {
    if (!existsSync(`${ASSETS}/${f}.png`)) throw new Error(`Missing ${ASSETS}/${f}.png (crop of a real comment).`);
  }
  if (!existsSync(OLD_REEL)) throw new Error(`Missing ${OLD_REEL} (the finished Day 0 Reel).`);
  if (!existsSync(`${ASSETS}/tv_0001.jpg`)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(SRC_A), '-t', String(SRC_B - SRC_A + 0.2),
      '-i', OLD_REEL, '-vf', `fps=${FPS},crop=1080:810:0:225,scale=800:600`, '-q:v', '3', `${ASSETS}/tv_%04d.jpg`]);
  }
}

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [12.95, 13.0, 'D'], [13.25, 13.3, 'A'], [13.55, 13.6, 'D'],
  [22.9, 23.0, 'A'], [24.2, 24.3, 'A'], [25.7, 25.8, 'A'],
  [27.9, 28.0, 'D'], [28.75, 28.85, 'D'], [29.6, 29.7, 'D'], [30.45, 30.55, 'D'], [31.3, 31.4, 'D'], [32.15, 32.25, 'D'],
  [33.1, 33.95, 'A'],
];

const everyone = (t, ...rest) => [[t, 'goths.clear'], [t, 'femboys.clear'], ...rest.map((r) => [t, ...r])];
// Each scene plays in its own patch of the endless floor.
const actions = [
  [0, 'goths.staged', true], [0, 'femboys.staged', true],
  // Hook: four goths, already closing in.
  ...everyone(0,
    ['goths.spawn', 0, 0, -1, 1, { steps: 3 }], ['goths.spawn', 1, -1, 0, 0, { steps: 3 }],
    ['goths.spawn', 3, 1, 0, 2, { steps: 3 }], ['goths.spawn', 2, 0, 1, 3, { steps: 3 }], ['cut']),
  // Winner, comments, deal: the cube alone with its thoughts.
  ...everyone(T.winner, ['cube.teleport', 40, 0], ['cut']),
  [12.7, 'cube.pin', true], [13.9, 'cube.pin', false],
  // Reveal.
  ...everyone(T.reveal,
    ['cube.teleport', 80, 0],
    ['femboys.spawn', 0, 77, 1, 0, { steps: 6 }], ['femboys.spawn', 1, 82, -3, 1, { steps: 6 }],
    ['femboys.spawn', 2, 79, -4, 1, { steps: 5 }], ['femboys.spawn', 3, 83, 2, 2, { steps: 5 }],
    ['goths.spawn', 0, 76, -2, 1, { steps: 4 }], ['goths.spawn', 2, 84, -1, 2, { steps: 3 }], ['cut']),
  [T.close, 'cut'],
  // Greeting: femboy 4 walks up to goth 2 with a bow to give.
  [18.8, 'goths.spawn', 0, 119, 0, 0, { idle: 99 }],
  [18.8, 'femboys.spawn', 0, 122, 0, 2, { steps: 6 }], [18.8, 'femboys.do', 4, 'gift'],
  [T.greeting, 'cube.teleport', 126, 6], [T.greeting, 'cut'],
  // Adopted.
  ...everyone(T.adopted, ['cube.teleport', 160, 0], ['femboys.spawn', 1, 159, 0, 0, { idle: 99 }], ['cut']),
  // Parade: three femboys and one goth fall in behind the cube.
  ...everyone(T.parade,
    ['cube.teleport', 200, 0],
    ['femboys.spawn', 0, 197, 0, 0, { idle: 0.1 }], ['femboys.spawn', 2, 195, 0, 0, { idle: 0.1 }],
    ['femboys.spawn', 3, 193, 0, 0, { idle: 0.1 }], ['goths.spawn', 1, 191, 0, 0, { idle: 0.1 }],
    ['femboys.do', 0, 'follow'], ['femboys.do', 1, 'follow'], ['femboys.do', 2, 'follow'], ['goths.do', 0, 'follow'], ['cut']),
  // Punchline: a goth who has been given a bow, standing exactly where the cube is going.
  ...everyone(T.punch, ['cube.teleport', 244, 0], ['goths.spawn', 0, 239, 0, 0, { idle: 99 }], ['goths.bow', 0], ['cut']),
];

const zoom = [
  [0, 1.05], [T.winner - 0.01, 1.3],
  [T.winner, 1.35], [T.deal, 1.5], [T.tv, 1.9],
  [T.reveal, 0.72], [T.close - 0.01, 0.8], [T.close, 2.0], [T.greeting - 0.01, 2.1],
  [T.greeting, 1.5], [20.4, 1.5], [20.8, 1.85], [T.adopted - 0.01, 1.9],
  [T.adopted, 1.7], [26.4, 1.7], [26.8, 2.0], [T.parade - 0.01, 2.0],
  [T.parade, 0.95], [T.punch - 0.01, 1.05],
  [T.punch, 1.2], [33.8, 1.2], [34.1, 1.75], [seconds, 1.85],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < T.winner) cam.focus = [-0.9, -0.9];
  else if (t >= T.reveal && t < T.close) cam.focus = [80, -0.5];
  else if (t >= T.close && t < T.greeting) cam.follow = ['femboys', 0];
  else if (t >= T.greeting && t < T.adopted) cam.focus = [119.7, 0];
  else if (t >= T.adopted && t < T.parade) cam.focus = [159.6, 0];
  else if (t >= T.parade && t < T.punch) cam.focus = [keyframes([[T.parade, 198.6], [T.punch, 204.4]], t), 0];
  return cam;
}

const frozen = (t) => t >= T.tv && t < T.reveal;

// Voice-over, as estimated. Retimed to the real recording afterwards.
const captions = [
  [0.25, 1.1, 'Day two'], [1.1, 1.7, 'of letting'], [1.7, 2.4, 'Instagram comments'], [2.4, 2.9, 'build my game.'],
  [3.1, 3.8, 'I thought it couldn’t'], [3.8, 4.4, 'get worse than'], [4.4, 5.1, 'goth baddies.'],
  [5.7, 6.6, 'Then this got'], [6.6, 7.5, 'more likes'], [7.5, 8.5, 'than the actual reel.'],
  [8.95, 9.7, 'And the rest of you'], [9.7, 10.4, 'were no help.'],
  [14.15, 15.15, 'But a deal is a deal.'],
  [16.7, 17.2, 'So…'], [17.3, 18.1, 'femboys.'],
  [22.9, 23.6, 'The goths'], [23.6, 24.4, 'rejected my cube.'],
  [24.9, 25.5, 'These guys'], [25.5, 26.3, 'adopted it.'],
  [27.9, 28.6, 'Tomorrow,'], [28.6, 29.7, 'top comment still wins.'],
  [29.9, 30.7, 'But I also pick'], [30.7, 31.4, 'one idea that actually'], [31.4, 32.3, 'makes this a game.'],
  [32.4, 33.0, 'Please. Cook.'],
];
// Real comments, shown as they appeared, each with a short written reply.
const replies = [
  [9.0, 'bro', 'even the comments are worried'],
  [10.25, 'slop', 'fair.'],
  [11.5, 'ironman', 'I cannot afford those lawyers'],
  [12.75, 'replace', '…no.'],
];

const sfx = [
  [T.winner, 'pop'], [6.6, 'boom'],
  ...replies.map(([t]) => [t, 'pop']),
  [T.tv + 0.07, 'boom'],
  [20.75, 'dun'], [26.6, 'pop'], [29.9, 'pop'], [34.1, 'dun'],
];
const music = {
  sections: [[0, T.tv], [T.reveal + 0.05, 33.75]],
  duck: [[0.2, 2.9], [3.1, 5.1], [5.7, 8.5], [8.9, 10.4], [14.1, 15.2], [16.7, 18.1], [22.9, 26.3], [27.9, 33.0]],
};
const tape = 'highpass=f=320,lowpass=f=3300,vibrato=f=5.5:d=0.12,volume=0.95';
const audio = [{ file: OLD_REEL, at: T.tv, filter: `atrim=${SRC_A}:${SRC_B},asetpts=PTS-STARTPTS,${tape}` }];

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:39px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .comment { position:absolute; left:18px; right:18px; top:17%; transform-origin:14% 50%; }
  .comment img { display:block; width:100%; border-radius:16px; box-shadow:0 18px 50px rgba(29,27,25,.35); }
  .comment .tag { position:absolute; left:10px; top:-38px; }
  .reply { position:absolute; left:0; right:0; top:30%; text-align:center; }
  .reply span { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:800; font-size:25px;
                padding:9px 18px 8px; border-radius:14px; transform:rotate(1.5deg); }
  .versus { position:absolute; left:0; right:0; top:31%; display:flex; justify-content:center; align-items:flex-end; gap:22px; }
  .versus div { text-align:center; font-weight:800; font-size:15px; letter-spacing:.12em; }
  .versus b { display:block; font-weight:900; font-size:64px; line-height:.95; letter-spacing:0; }
  .versus .gt { font-size:52px; font-weight:900; padding-bottom:8px; }
  .versus img { height:26px; vertical-align:middle; border-radius:6px; }
  .room { position:absolute; inset:0; background:#0c0b0e; }
  .tv { position:absolute; left:20px; right:20px; top:24%; aspect-ratio:4/3; border-radius:26px; overflow:hidden;
        background:#000; box-shadow:0 0 0 10px #1c1a20, 0 0 0 13px #2b2832, 0 0 90px rgba(140,120,255,.22); transform-origin:50% 88%; }
  .tv img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .tv .pic { filter:saturate(.5) contrast(.9) brightness(1.12) sepia(.28) blur(.6px); }
  .tv .ghost { opacity:.28; mix-blend-mode:screen; transform:translateX(5px); filter:saturate(.5) blur(1px); }
  .tv .lines { position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(0,0,0,.26) 0 1.5px, transparent 1.5px 4px); }
  .tv .snow { position:absolute; inset:0; filter:url(#snow); opacity:.2; mix-blend-mode:screen; background:#fff; }
  .tv .glass { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.6) 100%); }
  .osd { position:absolute; font-family:'JetBrains Mono', monospace; font-weight:800; font-size:19px; color:#eef0e4;
         text-shadow:2px 0 #f33, -2px 0 #3cf; letter-spacing:.04em; }
  .shout { position:absolute; left:0; right:0; top:65%; text-align:center; font-weight:900; font-size:58px; line-height:.98; color:#f6f1e6; }
  .shout b { display:block; }
  .plus { position:absolute; left:0; right:0; top:19.5%; text-align:center; }
  .plus span { display:inline-block; background:#ee6fa4; color:var(--ink); font-weight:900; font-size:34px; padding:8px 18px 6px;
               border-radius:12px; transform:rotate(-2deg); }
  .black { position:absolute; inset:0; background:#000; }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;

function tv(t) {
  const src = Math.min(SRC_B, SRC_A + (t - T.tv) * 0.92);
  const frame = String(Math.max(1, Math.round((src - SRC_A) * FPS) + 1)).padStart(4, '0');
  const k = clamp((t - T.tv) / (T.reveal - T.tv));
  const shake = Math.sin(t * 70) * k * 3;
  const said = [[T.tv + 0.07, 'WHATEVER.'], [T.tv + 0.36, 'IT.'], [T.tv + 0.84, 'IS.']];
  let h = `<svg width="0" height="0" style="position:absolute"><defs><filter id="snow">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${Math.round(t * FPS)}"/>
      <feColorMatrix type="saturate" values="0"/></filter></defs></svg>
    <div class="room"><div class="tv" style="transform:translate(${shake.toFixed(1)}px,0) scale(${(1 + smooth(k) * 0.25).toFixed(3)})">
      <img class="pic" src="/reelasset/tv_${frame}.jpg"><img class="ghost" src="/reelasset/tv_${frame}.jpg">
      <div class="snow"></div><div class="lines"></div><div class="glass"></div>
      <div class="osd" style="left:22px;top:18px">◀◀ REWIND</div>
      <div class="osd" style="right:22px;bottom:16px">DAY 0 · 0:${String(Math.floor(src)).padStart(2, '0')}</div>
    </div><div class="shout">`;
  for (const [at, word] of said) h += `<b ${scaled(pop(t, at, 0.14))}>${word}</b>`;
  return h + '</div></div>';
}

function comment(t, at, file, tag, punchAt) {
  const s = pop(t, at, 0.22) * (punchAt ? 1 + 0.25 * smooth((t - punchAt) / 0.16) : 1);
  return `<div class="comment" ${scaled(s, `transform:rotate(-2deg) scale(${s.toFixed(3)})`)}>
    ${tag ? `<span class="tag">${tag}</span>` : ''}<img src="/reelasset/${file}.png"></div>`;
}

function html(t) {
  let h = '';

  if (t < 2.9) {
    h += `<div class="big" style="top:11%;font-size:128px">DAY 2</div>`;
    h += `<div class="sub" style="top:25%;opacity:${t > 0.9 ? 1 : 0}">letting comments build my game</div>`;
  }
  if (within(t, T.winner, T.comments)) {
    h += comment(t, T.winner, 'femboys', '📌 TOP COMMENT', 5.75);
    if (t >= 6.6) {
      h += `<div class="versus" ${scaled(pop(t, 6.6, 0.2))}>
        <div>THIS COMMENT<b>85</b></div><div class="gt">&gt;</div>
        <div>THE WHOLE REEL <img src="/reelasset/likes.png"><b>68</b></div></div>`;
    }
  }
  if (within(t, T.comments, T.deal)) {
    const cur = [...replies].reverse().find(([at]) => t >= at);
    if (cur) {
      const [at, file, reply] = cur;
      h += comment(t, at, file, '');
      h += `<div class="reply"><span ${scaled(pop(t, at + 0.45, 0.16), 'transform-origin:50% 50%')}>${esc(reply)}</span></div>`;
    }
  }
  if (within(t, T.tv, T.reveal)) h += tv(t);

  if (within(t, 28.3, T.punch)) {
    h += `<div class="sub" ${scaled(pop(t, 28.3), 'top:10%')}><span class="tag">DAY 3</span></div>`;
    h += `<div class="big" ${scaled(pop(t, 28.4), 'top:13.5%;font-size:44px;white-space:nowrap')}>TOP COMMENT WINS</div>`;
    h += `<div class="plus"><span ${scaled(pop(t, 29.9), 'transform-origin:50% 50%')}>+ 1 idea I pick</span></div>`;
    h += `<div class="sub" style="top:26.5%;font-size:21px;opacity:${t > 30.7 ? 1 : 0}">one that makes this an actual game</div>`;
  }
  if (within(t, 34.4, T.black)) {
    h += `<div class="big" ${scaled(pop(t, 34.4), 'top:62%;font-size:46px;-webkit-text-stroke:9px #f6f1e6;paint-order:stroke fill')}>she kept the bow.</div>`;
  }

  const c = captions.find(([a, b]) => within(t, a, b));
  if (c) h += `<div class="cap"><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  if (t >= T.black) h += '<div class="black"></div>';
  return h;
}

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, frozen, html, css, sfx, audio, music };
