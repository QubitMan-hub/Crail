// The Day 0 Reel, timed to the recorded voice-over (voice file trimmed by 0.9s).
// Times are in seconds. Six beats, each with its own visual idea:
//   0-3.8     HOOK   the cube slams into an empty world
//   3.9-7.4   GAME   "the entire game" pointed at one cube
//   7.5-11.8  EMPTY  checklist of everything that's missing, camera pulls way out
//   11.8-18   DEAL   red card, then comments fight for the top spot
//   18-23.7   CLOCK  24h countdown, then your name tag on the cube
//   23.8-29.6 CRAIL  each roll stamps a letter, then the call to comment
import { clamp, esc, keyframes, pop, smooth } from './kit.mjs';

const seconds = 29.6;

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [5.7, 6.0, 'D'], [6.5, 6.8, 'A'],
  [7.5, 10.6, 'D'],
  [13.3, 13.4, 'W'], [14.4, 14.5, 'A'], [15.5, 15.6, 'S'], [16.82, 16.92, 'D'],
  [18.1, 18.2, 'W'],
  [24.03, 24.8, 'D'],
  [28.1, 28.2, 'S'], [28.8, 28.9, 'S'],
];

const zoom = [
  [0, 1.35], [0.48, 1.35], [0.56, 1.0], [3.9, 1.06],
  [4.85, 1.06], [5.05, 1.9], [5.6, 1.95], [5.8, 1.25], [7.4, 1.2],
  [7.5, 1.2], [10.5, 0.42], [11.75, 0.4],
  [13.15, 0.4], [13.2, 1.15], [17.9, 1.05],
  [18.0, 1.05], [19.95, 1.25], [20.15, 1.7], [23.6, 2.0],
  [23.85, 1.0], [26.5, 0.95], [29.6, 1.05],
];

// The cube falls out of the sky at the very start.
const DROP = 0.5;
const world = (t) => ({
  cubeY: t < 0.25 ? 16 : t < DROP ? 0.5 + 15.5 * (1 - ((t - 0.25) / 0.25) ** 2) : 0.5,
  impactAt: DROP,
});

// Captions follow the actual words in the recording.
const captions = [
  [0.32, 1.18, 'Day zero'], [1.18, 1.84, 'of letting'], [1.84, 2.78, 'Instagram comments'], [2.78, 3.6, 'build my game.'],
  [3.96, 4.8, 'This is the game.'],
  [5.0, 5.6, 'One cube.'], [5.68, 6.3, 'It rolls.'], [6.48, 7.2, 'That’s everything.'],
  [7.68, 8.4, 'No enemies.'], [8.5, 9.2, 'No levels.'], [9.36, 10.0, 'No goal.'], [10.46, 10.76, 'Just…'], [10.76, 11.5, 'floor.'],
  [11.88, 12.8, 'So here’s the deal.'],
  [13.3, 13.84, 'Whatever the'], [13.84, 14.9, 'top comment is,'], [15.06, 15.84, 'I add it'], [15.84, 16.6, 'into the game.'],
  [16.82, 17.95, 'Whatever it is.'],
  [18.16, 19.4, 'You’ve got 24 hours.'],
  [20.08, 20.85, 'In two days,'], [20.92, 21.44, 'I’m back'], [21.44, 22.02, 'with your idea'], [22.02, 22.44, 'in the game'],
  [22.44, 22.98, 'and your name'], [22.98, 23.6, 'on it.'],
  [23.88, 24.58, 'It’s called'], [24.58, 25.3, 'CRAIL.'],
  [25.7, 26.62, 'Play it right now.'],
  [26.62, 27.44, 'The link is'], [27.44, 28.1, 'in my bio.'],
];

const comments = [
  [13.3, 'you', 'make it jump', '212'],
  [14.4, 'your_friend', 'give it a friend', '1,340'],
  [15.5, 'that_one_guy', 'add a moon', '4,809'],
  [16.82, 'someone_evil', 'taxes.', '12.4K'],
];
const missing = [[7.68, 'ENEMIES'], [8.5, 'LEVELS'], [9.36, 'A GOAL']];
const FLOOR = 10.76;
const letters = [...'CRAIL'].map((ch, i) => [24.2 + i * 0.17, ch]);
const CTA = 28.1;

// Short sounds: 'boom' impact, 'pop' for things appearing, 'tick' for the clock.
const sfx = [
  [DROP, 'boom'], [5.05, 'pop'],
  ...missing.map(([t]) => [t, 'pop']), [FLOOR, 'pop'],
  [11.8, 'boom'],
  ...comments.map(([t]) => [t, 'pop']),
  ...Array.from({ length: 12 }, (_, i) => [18.2 + i * 0.14, 'tick']), [20.0, 'boom'],
  [22.44, 'pop'], [25.7, 'pop'], [CTA, 'pop'],
];

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:41px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .cap.onred span { color:#f6f1e6; -webkit-text-stroke:0; }
  .list { position:absolute; left:64px; top:13%; font-weight:900; font-size:38px; line-height:1.28; }
  .list .x { color:var(--red); margin-left:14px; }
  .list .ok { color:#2f9e5b; margin-left:14px; }
  .strike { text-decoration:line-through; text-decoration-thickness:5px; text-decoration-color:var(--red); }
  .card { position:absolute; left:42px; right:42px; top:17%; background:#fffdf8; border-radius:22px; padding:18px 20px;
          box-shadow:0 14px 40px rgba(29,27,25,.18); display:flex; gap:14px; align-items:center; transform-origin:50% 100%; }
  .card .av { width:46px; height:46px; border-radius:50%; background:var(--red); flex:none; }
  .card .who { font-weight:700; font-size:17px; opacity:.6; }
  .card .txt { font-weight:800; font-size:30px; line-height:1.15; margin-top:2px; }
  .card .likes { margin-left:auto; text-align:center; font-weight:800; font-size:14px; color:var(--red); }
  .card .likes b { display:block; font-size:24px; line-height:1; }
  .pin { position:absolute; left:42px; top:12.2%; }
  .red { position:absolute; inset:0; background:var(--red); display:flex; align-items:center; justify-content:center; }
  .red div { font-weight:900; font-size:74px; line-height:.95; text-align:center; color:var(--ink); }
  .clock { font-variant-numeric:tabular-nums; font-size:84px; }
  .name { position:absolute; left:0; right:0; top:29.5%; text-align:center; }
  .name span { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:800; font-size:24px;
               padding:8px 16px; border-radius:12px; }
  .name i { display:block; width:0; height:0; margin:0 auto; border:9px solid transparent; border-top-color:var(--ink); }
  .word { position:absolute; left:0; right:0; top:14%; text-align:center; font-weight:900; font-size:104px; letter-spacing:.12em; padding-left:.12em; }
  .word b { display:inline-block; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .pointer { position:absolute; left:0; right:0; top:24%; text-align:center; font-weight:900; font-size:34px; line-height:1.1; }
  .pointer i { display:block; font-style:normal; color:var(--red); font-size:40px; }
  .arrow { position:absolute; left:0; right:0; top:74%; text-align:center; font-weight:900; font-size:60px; color:var(--red); }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;

function html(t) {
  let h = '';

  // HOOK
  if (t < 3.85) {
    const s = t < DROP ? 1 : 1 + 0.12 * Math.exp(-(t - DROP) * 9);
    h += `<div class="big" style="top:13%;font-size:128px;transform:scale(${s})">DAY 0</div>`;
    h += `<div class="sub" style="top:28%;opacity:${pop(t, 1.0) > 0 ? 1 : 0}">letting comments build my game</div>`;
  }

  // GAME
  if (within(t, 5.0, 7.4)) {
    h += `<div class="pointer" ${scaled(pop(t, 5.0))}>the entire game<i>↓</i></div>`;
  }

  // EMPTY
  if (within(t, 7.5, 11.8)) {
    h += '<div class="list">';
    for (const [at, label] of missing) {
      if (t >= at) h += `<div ${scaled(pop(t, at), 'transform-origin:0 50%')}><span class="strike">${label}</span><span class="x">✕</span></div>`;
    }
    if (t >= FLOOR) h += `<div ${scaled(pop(t, FLOOR), 'transform-origin:0 50%')}>FLOOR<span class="ok">✓</span></div>`;
    h += '</div>';
  }

  // DEAL
  if (within(t, 11.8, 13.2)) {
    h += `<div class="red"><div ${scaled(pop(t, 11.85, 0.3))}>HERE’S<br>THE<br>DEAL</div></div>`;
  }
  if (within(t, 13.2, 18.0)) {
    h += `<div class="pin"><span class="tag">📌 TOP COMMENT</span></div>`;
    const cur = [...comments].reverse().find(([at]) => t >= at);
    if (cur) {
      const [at, who, text, likes] = cur;
      h += `<div class="card" ${scaled(pop(t, at))}><div class="av"></div>
              <div><div class="who">@${who}</div><div class="txt">${esc(text)}</div></div>
              <div class="likes"><b>♥</b>${likes}</div></div>`;
    }
    h += `<div class="sub" style="top:29%;opacity:${t > 15.06 ? 1 : 0}">= the next thing I build</div>`;
  }

  // CLOCK
  if (within(t, 18.0, 20.0)) {
    const left = Math.round(86400 * (1 - smooth(clamp((t - 18.2) / 1.7)) ** 0.8));
    const p = (n) => String(n).padStart(2, '0');
    const txt = `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`;
    h += `<div class="big clock" style="top:15%">${txt}</div><div class="sub" style="top:25.5%">to get your comment to the top</div>`;
  }
  if (within(t, 20.0, 23.8)) {
    h += `<div class="big" ${scaled(pop(t, 20.05), 'top:14%;font-size:60px')}>2 DAYS LATER</div>`;
    h += `<div class="sub" style="top:21.5%;opacity:${t > 21.44 ? 1 : 0}">your idea is in the game</div>`;
    const bob = Math.sin((t - 22.44) * 4) * 4;
    h += `<div class="name" ${scaled(pop(t, 22.44), `transform:translateY(${bob}px) scale(${pop(t, 22.44).toFixed(3)});transform-origin:50% 100%`)}><span>built by @your_name</span><i></i></div>`;
  }

  // CRAIL
  if (t >= 23.8) {
    h += '<div class="word">';
    for (const [at, ch] of letters) h += `<b ${scaled(pop(t, at, 0.2))}>${ch}</b>`;
    h += '</div>';
    h += `<div class="sub" ${scaled(pop(t, 25.7), 'top:27.5%')}>PLAY IT NOW · LINK IN BIO</div>`;
    if (t >= CTA) {
      const bounce = Math.abs(Math.sin((t - CTA) * 5)) * 16;
      h += `<div class="sub" ${scaled(pop(t, CTA), 'top:70%;font-size:30px')}>what should I add?</div>`;
      h += `<div class="arrow" style="transform:translateY(${bounce}px)">↓</div>`;
    }
  }

  // Captions: a few words at a time, popping in.
  const c = captions.find(([a, b]) => within(t, a, b));
  if (c) {
    const onRed = within(t, 11.8, 13.2);
    h += `<div class="cap${onRed ? ' onred' : ''}"><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  }
  return h;
}

export default { seconds, keys, camera: (t) => ({ zoom: keyframes(zoom, t) }), world, html, css, sfx };
