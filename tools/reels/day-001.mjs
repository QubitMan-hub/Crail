// The Day 1 Reel: goth baddies. Times are in seconds.
//   0-7.8      HOOK       the lonely cube, the real top comment, instant regret
//   7.8-14.8   FLASHBACK  yesterday's Reel on an old TV: "WHATEVER. IT. IS."
//   14.8-18    REVEAL     wide shot, then a close tracking shot
//   18-22      STARE      she stops, she judges, the cube backs away
//   22-26.8    SEAT       she sits on the cube; it struggles free; gravity catches up
//   26.8-30    CORNERED   four of them close in; the call for Day 2
//   30-33.3    PUNCHLINE  the cube runs for it. There is another one.
//
// Needs two files that are not in the repository (see prepare):
//   captures/day-001-assets/comment.png   the real top comment, cropped from a screenshot
//   captures/day-000.mp4                  the finished Day 0 Reel, for the flashback
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { clamp, esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-001-assets';
const OLD_REEL = 'captures/day-000.mp4';
const FPS = 30;

// Flashback: where in yesterday's Reel the line sits, and how it plays here.
const SRC_START = 13.25; // "Whatever the top comment is, I add it into the game..."
const SRC_SLOW = 16.75; //  "...whatever. it. is."
const SRC_END = 17.85;
const CARD = 7.8;
const TV = 8.7;
const SLOW = TV + (SRC_SLOW - SRC_START); // 12.2
const SLOW_RATE = 0.5;
const PAUSE = SLOW + (SRC_END - SRC_SLOW) / SLOW_RATE; // 14.4
const NOW = 14.8;

const T = { reveal: NOW, close: 16.4, stare: 18.0, seat: 22.0, cornered: 26.8, run: 30.0, black: 33.0 };
const seconds = 33.3;

function prepare() {
  mkdirSync(ASSETS, { recursive: true });
  if (!existsSync(`${ASSETS}/comment.png`)) throw new Error(`Missing ${ASSETS}/comment.png (crop of the winning comment).`);
  if (!existsSync(OLD_REEL)) throw new Error(`Missing ${OLD_REEL} (the finished Day 0 Reel).`);
  if (!existsSync(`${ASSETS}/fb_0001.jpg`)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(SRC_START), '-t', String(SRC_END - SRC_START + 0.2),
      '-i', OLD_REEL, '-vf', `fps=${FPS},crop=1080:810:0:225,scale=800:600`, '-q:v', '3', `${ASSETS}/fb_%04d.jpg`]);
  }
}

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [0.4, 1.0, 'S'], [1.4, 2.0, 'D'],
  [18.1, 18.4, 'A'], [20.1, 20.2, 'D'], [21.75, 21.95, 'D'],
  [23.9, 23.95, 'S'], [24.3, 24.35, 'S'], [24.7, 24.75, 'S'], [25.1, 25.5, 'S'],
  [30.1, 31.3, 'A'],
];

// Each scene plays in its own patch of the endless floor, so nothing wanders into the wrong shot.
const actions = [
  [0, 'goths.staged', true], [0, 'goths.clear'], [0, 'cut'],
  // Reveal: five of them, already walking.
  [T.reveal, 'cube.teleport', 0, 0],
  [T.reveal, 'goths.spawn', 0, -3, 1, 0, { steps: 5 }],
  [T.reveal, 'goths.spawn', 1, 2, -3, 1, { steps: 7 }],
  [T.reveal, 'goths.spawn', 2, -1, -4, 0, { steps: 4 }],
  [T.reveal, 'goths.spawn', 3, 3, 2, 2, { steps: 5 }],
  [T.reveal, 'goths.spawn', 4, -4, -2, 1, { steps: 4 }],
  [T.reveal, 'cut'], [T.close, 'cut'],
  // Stare (goth 5), set walking a moment before the cut.
  [17.2, 'goths.spawn', 0, 38, 0, 0, { steps: 8 }],
  [T.stare, 'cube.teleport', 43, 0], [T.stare, 'cut'],
  // Seat (goth 6).
  [T.seat, 'cube.teleport', 80, 0],
  [T.seat, 'goths.spawn', 4, 78, 0, 0, { idle: 99 }],
  [T.seat, 'goths.do', 6, 'sit'], [T.seat, 'cut'],
  // Cornered (goths 7-10), walking in from all four sides.
  [26.2, 'goths.spawn', 0, 120, -3, 1, { steps: 6 }],
  [26.2, 'goths.spawn', 1, 117, 0, 0, { steps: 6 }],
  [26.2, 'goths.spawn', 3, 123, 0, 2, { steps: 6 }],
  [26.2, 'goths.spawn', 2, 120, 3, 3, { steps: 6 }],
  [T.cornered, 'cube.teleport', 120, 0], [T.cornered, 'cut'],
  // Punchline (goth 11): standing exactly where the cube is running to.
  [T.run, 'cube.teleport', 166, 0],
  [T.run, 'goths.spawn', 0, 159, 0, 0, { idle: 99 }], [T.run, 'cut'],
];

const zoom = [
  [0, 1.15], [6.2, 1.2], [7.8, 2.3],
  [T.reveal, 0.7], [T.close - 0.01, 0.78], [T.close, 2.0], [T.stare - 0.01, 2.1],
  [T.stare, 1.45], [18.9, 1.45], [19.3, 1.8], [T.seat - 0.01, 1.8],
  [T.seat, 1.75], [25.0, 1.85], [25.2, 1.45], [T.cornered - 0.01, 1.45],
  [T.cornered, 1.05], [T.run - 0.01, 1.25],
  [T.run, 1.2], [31.15, 1.2], [31.4, 1.7], [seconds, 1.8],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t >= T.reveal && t < T.close) cam.focus = [0, 0];
  else if (t >= T.close && t < T.stare) cam.follow = 1;
  else if (t >= T.stare && t < T.seat) cam.focus = [40.9, 0];
  else if (t >= T.seat && t < T.cornered) cam.focus = [80, 0.4];
  else if (t >= T.cornered && t < T.run) cam.focus = [119.1, -0.9];
  return cam;
}

const frozen = (t) => t >= CARD && t < NOW;
// The classic wobble into a memory.
const gameStyle = (t) => (t >= 7.35 && t < CARD ? 'filter:url(#wave)' : '');

// Voice-over, as estimated. Retimed to the real recording afterwards.
const captions = [
  [0.25, 1.1, 'Day one'], [1.1, 1.75, 'of letting'], [1.75, 2.6, 'Instagram comments'], [2.6, 3.2, 'build my game.'],
  [3.5, 4.6, 'You guys asked for…'], [4.9, 6.0, 'goth baddies.'],
  [6.5, 7.5, 'I regret saying this.'],
  [15.0, 15.5, 'So…'], [15.5, 16.6, 'I actually added them.'],
  [23.4, 24.0, 'Anyway,'], [24.0, 24.7, 'this is what you guys'], [24.7, 25.3, 'made me do.'],
  [27.0, 27.8, 'Top comment decides'], [27.8, 28.8, 'what I add for Day 2.'], [29.1, 30.0, 'Please have mercy.'],
];

const sfx = [
  [3.2, 'pop'], [4.9, 'boom'],
  [SLOW, 'riser', PAUSE, 0.22],
  [18.95, 'dun'], [28.2, 'pop'], [31.55, 'dun'],
];

// Yesterday's voice, through a tired old TV speaker. Then slowed down to half speed.
const tape = 'highpass=f=320,lowpass=f=3300,vibrato=f=5.5:d=0.12,volume=0.95';
const audio = [
  { file: OLD_REEL, at: TV, filter: `atrim=${SRC_START}:${SRC_SLOW},asetpts=PTS-STARTPTS,${tape}` },
  {
    file: OLD_REEL, at: SLOW,
    filter: `atrim=${SRC_SLOW}:${SRC_END},asetpts=PTS-STARTPTS,asetrate=${48000 * SLOW_RATE},aresample=48000,${tape},aecho=0.8:0.75:110:0.4`,
  },
];

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:41px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .comment { position:absolute; left:16px; right:16px; top:21%; transform-origin:12% 50%; }
  .comment img { display:block; width:100%; border-radius:16px; box-shadow:0 18px 50px rgba(29,27,25,.35); }
  .comment .tag { position:absolute; left:10px; top:-38px; }
  .memory { position:absolute; inset:0; background:#3b2745; display:flex; align-items:center; justify-content:center; }
  .memory div { font-family:'Bitstream Charter','Liberation Serif',serif; font-style:italic; font-weight:700;
                font-size:54px; color:#f6f1e6; text-align:center; line-height:1.1; }
  .memory b { display:inline-block; font-weight:700; }
  .room { position:absolute; inset:0; background:#0c0b0e; }
  .tv { position:absolute; left:20px; right:20px; top:24%; aspect-ratio:4/3; border-radius:26px; overflow:hidden;
        background:#000; box-shadow:0 0 0 10px #1c1a20, 0 0 0 13px #2b2832, 0 0 90px rgba(140,120,255,.22); transform-origin:50% 88%; }
  .tv img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .tv .pic { filter:saturate(.5) contrast(.9) brightness(1.12) sepia(.28) blur(.6px); }
  .tv .ghost { opacity:.28; mix-blend-mode:screen; transform:translateX(5px); filter:saturate(.5) blur(1px); }
  .tv .lines { position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(0,0,0,.26) 0 1.5px, transparent 1.5px 4px); }
  .tv .snow { position:absolute; inset:0; filter:url(#snow); opacity:.2; mix-blend-mode:screen; background:#fff; }
  .tv .roll { position:absolute; left:0; right:0; height:14%; background:linear-gradient(180deg, transparent, rgba(255,255,255,.16), transparent); }
  .tv .glass { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.6) 100%); }
  .osd { position:absolute; font-family:'JetBrains Mono', monospace; font-weight:800; font-size:19px; color:#eef0e4;
         text-shadow:2px 0 #f33, -2px 0 #3cf; letter-spacing:.04em; }
  .shout { position:absolute; left:0; right:0; top:65%; text-align:center; font-weight:900; font-size:58px; line-height:.98;
           color:#f6f1e6; letter-spacing:.01em; }
  .shout b { display:block; }
  .black { position:absolute; inset:0; background:#000; }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;
const svgFilters = (t) => {
  const k = smooth((t - 7.35) / (CARD - 7.35));
  const frame = Math.round(t * FPS);
  return `<svg width="0" height="0" style="position:absolute"><defs>
    <filter id="wave" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency="0.004 ${(0.012 + 0.01 * Math.sin(t * 20)).toFixed(4)}" numOctaves="1" seed="${frame % 7}"/>
      <feDisplacementMap in="SourceGraphic" scale="${(k * 110).toFixed(1)}"/>
    </filter>
    <filter id="snow"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${frame}"/>
      <feColorMatrix type="saturate" values="0"/></filter>
  </defs></svg>`;
};

function flashback(t) {
  const out = t < SLOW ? SRC_START + (t - TV) : Math.min(SRC_END, SRC_SLOW + (t - SLOW) * SLOW_RATE);
  const frame = String(Math.max(1, Math.round((out - SRC_START) * FPS) + 1)).padStart(4, '0');
  const k = clamp((t - SLOW) / (PAUSE - SLOW));
  const shake = t >= SLOW && t < PAUSE ? Math.sin(t * 70) * k * 3 : 0;
  const s = 1 + smooth(k) * 0.3;
  const roll = ((t * 0.23) % 1.3) * 100 - 15;
  const sec = Math.floor(out);
  const said = [[SLOW + 0.14, 'WHATEVER.'], [SLOW + 0.66, 'IT.'], [SLOW + 1.58, 'IS.']];
  let h = `<div class="room">
    <div class="tv" style="transform:translate(${shake.toFixed(1)}px,0) scale(${s.toFixed(3)}) rotate(${(shake * 0.12).toFixed(2)}deg)">
      <img class="pic" src="/reelasset/fb_${frame}.jpg"><img class="ghost" src="/reelasset/fb_${frame}.jpg">
      <div class="snow"></div><div class="lines"></div><div class="roll" style="top:${roll.toFixed(1)}%"></div><div class="glass"></div>
      <div class="osd" style="left:22px;top:18px">${t < SLOW ? '▶ PLAY' : t < PAUSE ? '▶ SLOW' : '❚❚ PAUSE'}</div>
      <div class="osd" style="right:22px;bottom:16px">DAY 0 · 0:${String(sec).padStart(2, '0')}</div>
    </div>`;
  if (t >= SLOW) {
    h += '<div class="shout">';
    for (const [at, word] of said) h += `<b ${scaled(pop(t, at, 0.18))}>${word}</b>`;
    h += '</div>';
  }
  return h + '</div>';
}

function html(t) {
  let h = svgFilters(t);

  if (t < 3.15) {
    h += `<div class="big" style="top:13%;font-size:128px">DAY 1</div>`;
    h += `<div class="sub" style="top:28%;opacity:${t > 0.9 ? 1 : 0}">letting comments build my game</div>`;
  }
  if (within(t, 3.2, 6.2)) {
    // The real comment, exactly as it appeared.
    // On "goth baddies" it punches in on the words themselves.
    const s = pop(t, 3.2, 0.24) * (1 + 0.62 * smooth((t - 4.85) / 0.16));
    h += `<div class="comment" ${scaled(s, `transform:rotate(-2deg) scale(${s.toFixed(3)})`)}>
      <span class="tag">📌 TOP COMMENT</span><img src="/reelasset/comment.png"></div>`;
  }
  if (within(t, CARD, TV)) {
    const letters = [...'one day earlier…'].map((ch, i) =>
      `<b style="transform:translateY(${(Math.sin(t * 9 + i * 0.7) * 6).toFixed(1)}px)">${ch === ' ' ? '&nbsp;' : ch}</b>`).join('');
    h += `<div class="memory"><div>${letters}</div></div>`;
  }
  if (within(t, TV, NOW)) h += flashback(t);

  if (within(t, 28.2, T.run)) {
    h += `<div class="sub" ${scaled(pop(t, 28.2), 'top:11.5%')}><span class="tag">DAY 2</span></div>`;
    h += `<div class="big" ${scaled(pop(t, 28.3), 'top:15.5%;font-size:60px')}>TOP COMMENT<br>WINS</div>`;
  }
  if (within(t, 31.6, T.black)) {
    h += `<div class="big" ${scaled(pop(t, 31.6), 'top:62%;font-size:44px;line-height:1.08;padding:0 30px;-webkit-text-stroke:9px #f6f1e6;paint-order:stroke fill')}>I think I’ve lost<br>control of my game.</div>`;
  }

  const c = captions.find(([a, b]) => within(t, a, b));
  if (c) h += `<div class="cap"><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  if (t >= T.black) h += '<div class="black"></div>';
  return h;
}

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, frozen, gameStyle, html, css, sfx, audio };
