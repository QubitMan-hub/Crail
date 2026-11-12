// The Day 0 Reel. Times are in seconds. Six beats, each with its own visual idea:
//   0-3    HOOK   the cube slams into an empty world
//   3-7    GAME   "the entire game" pointed at one cube
//   7-11   EMPTY  checklist of everything that's missing, camera pulls way out
//   11-17  DEAL   red card, then comments fight for the top spot
//   17-23  CLOCK  24h countdown, then your name tag on the cube
//   23-30  CRAIL  each roll stamps a letter, then the call to comment
import { chunkCaptions, clamp, esc, keyframes, pop, smooth } from './kit.mjs';

const seconds = 30;

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [5.0, 5.3, 'D'], [5.95, 6.25, 'A'],
  [7.1, 10.4, 'D'],
  [12.7, 12.8, 'W'], [13.75, 13.85, 'A'], [14.8, 14.9, 'S'], [15.85, 15.95, 'D'],
  [17.25, 17.35, 'W'],
  [23.3, 23.4, 'D'], [23.65, 23.75, 'D'], [24.0, 24.1, 'D'], [24.35, 24.45, 'D'], [24.7, 24.8, 'D'],
  [27.6, 27.7, 'S'], [28.3, 28.4, 'S'],
];

const zoom = [
  [0, 1.35], [0.48, 1.35], [0.56, 1.0], [3.2, 1.06],
  [3.9, 1.06], [4.1, 1.9], [4.9, 1.95], [5.1, 1.25], [6.9, 1.2],
  [7.1, 1.2], [10.0, 0.42], [10.9, 0.4],
  [12.55, 0.4], [12.6, 1.15], [16.9, 1.05],
  [17.2, 1.05], [19.4, 1.25], [19.6, 1.7], [22.9, 2.0],
  [23.2, 1.0], [26.5, 0.95], [30, 1.05],
];

// The cube falls out of the sky at the very start.
const DROP = 0.5;
const world = (t) => ({
  cubeY: t < 0.25 ? 16 : t < DROP ? 0.5 + 15.5 * (1 - ((t - 0.25) / 0.25) ** 2) : 0.5,
  impactAt: DROP,
});

const voice = [
  [0.2, 3.0, 'Day zero of letting Instagram comments build my game.'],
  [3.3, 6.8, 'This is the game. One cube. It rolls. That’s everything.'],
  [7.1, 10.9, 'No enemies. No levels. No goal. Just… floor.'],
  [11.1, 12.5, 'So here’s the deal.'],
  [12.7, 16.9, 'Whatever the top comment says, I add it to the game. Whatever it is.'],
  [17.2, 19.3, 'You’ve got 24 hours.'],
  [19.6, 22.9, 'In two days I’m back, with your idea in the game and your name on it.'],
  [23.2, 25.2, 'It’s called CRAIL.'],
  [25.4, 27.4, 'Play it right now. Link’s in my bio.'],
  [27.6, 29.6, 'Don’t waste the first one.'],
];
const captions = chunkCaptions(voice);

const comments = [
  [12.7, 'you', 'make it jump', '212'],
  [13.75, 'your_friend', 'give it a friend', '1,340'],
  [14.8, 'that_one_guy', 'add a moon', '4,809'],
  [15.85, 'someone_evil', 'taxes.', '12.4K'],
];
const missing = [[7.3, 'ENEMIES'], [8.2, 'LEVELS'], [9.1, 'A GOAL']];
const letters = [...'CRAIL'].map((ch, i) => [23.47 + i * 0.35, ch]);

// Short sounds: 'boom' impact, 'pop' for things appearing, 'tick' for the clock.
const sfx = [
  [DROP, 'boom'], [4.1, 'pop'],
  ...missing.map(([t]) => [t, 'pop']), [10.2, 'pop'],
  [11.0, 'boom'],
  ...comments.map(([t]) => [t, 'pop']),
  ...Array.from({ length: 14 }, (_, i) => [17.4 + i * 0.14, 'tick']), [19.4, 'boom'],
  [20.2, 'pop'], [25.5, 'pop'], [27.6, 'pop'],
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
  if (t < 3.0) {
    const s = t < DROP ? 1 : 1 + 0.12 * Math.exp(-(t - DROP) * 9);
    h += `<div class="big" style="top:13%;font-size:128px;transform:scale(${s})">DAY 0</div>`;
    h += `<div class="sub" style="top:21.5%;opacity:${pop(t, 1.0) > 0 ? 1 : 0}">letting comments build my game</div>`;
  }

  // GAME
  if (within(t, 4.1, 6.9)) {
    h += `<div class="pointer" ${scaled(pop(t, 4.1))}>the entire game<i>↓</i></div>`;
  }

  // EMPTY
  if (within(t, 7.2, 10.95)) {
    h += '<div class="list">';
    for (const [at, label] of missing) {
      if (t >= at) h += `<div ${scaled(pop(t, at), 'transform-origin:0 50%')}><span class="strike">${label}</span><span class="x">✕</span></div>`;
    }
    if (t >= 10.2) h += `<div ${scaled(pop(t, 10.2), 'transform-origin:0 50%')}>FLOOR<span class="ok">✓</span></div>`;
    h += '</div>';
  }

  // DEAL
  if (within(t, 11.0, 12.6)) {
    h += `<div class="red"><div ${scaled(pop(t, 11.05, 0.3))}>HERE’S<br>THE<br>DEAL</div></div>`;
  }
  if (within(t, 12.6, 17.0)) {
    h += `<div class="pin"><span class="tag">📌 TOP COMMENT</span></div>`;
    const cur = [...comments].reverse().find(([at]) => t >= at);
    if (cur) {
      const [at, who, text, likes] = cur;
      h += `<div class="card" ${scaled(pop(t, at))}><div class="av"></div>
              <div><div class="who">@${who}</div><div class="txt">${esc(text)}</div></div>
              <div class="likes"><b>♥</b>${likes}</div></div>`;
    }
    h += `<div class="sub" style="top:29%;opacity:${t > 13.2 ? 1 : 0}">= the next thing I build</div>`;
  }

  // CLOCK
  if (within(t, 17.2, 19.5)) {
    const left = Math.round(86400 * (1 - smooth(clamp((t - 17.4) / 1.9)) ** 0.8));
    const p = (n) => String(n).padStart(2, '0');
    const txt = `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`;
    h += `<div class="big clock" style="top:15%">${txt}</div><div class="sub" style="top:25.5%">to get your comment to the top</div>`;
  }
  if (within(t, 19.5, 23.1)) {
    h += `<div class="big" style="top:14%;font-size:60px" ${scaled(pop(t, 19.5))}>2 DAYS LATER</div>`;
    h += `<div class="sub" style="top:21.5%;opacity:${t > 20.2 ? 1 : 0}">your idea is in the game</div>`;
    const bob = Math.sin((t - 20.2) * 4) * 4;
    h += `<div class="name" ${scaled(pop(t, 20.2), `transform:translateY(${bob}px) scale(${pop(t, 20.2).toFixed(3)});transform-origin:50% 100%`)}><span>built by @your_name</span><i></i></div>`;
  }

  // CRAIL
  if (t >= 23.2) {
    h += '<div class="word">';
    for (const [at, ch] of letters) h += `<b ${scaled(pop(t, at, 0.2))}>${ch}</b>`;
    h += '</div>';
    h += `<div class="sub" style="top:27.5%" ${scaled(pop(t, 25.5))}>PLAY IT NOW · LINK IN BIO</div>`;
    if (t >= 27.6) {
      const bounce = Math.abs(Math.sin((t - 27.6) * 5)) * 16;
      h += `<div class="sub" style="top:70%;font-size:30px" ${scaled(pop(t, 27.6))}>what should I add?</div>`;
      h += `<div class="arrow" style="transform:translateY(${bounce}px)">↓</div>`;
    }
  }

  // Captions: a few words at a time, popping in.
  const c = captions.find(([a, b]) => within(t, a, b));
  if (c && !within(t, 27.6, 30)) {
    const onRed = within(t, 11.0, 12.6);
    h += `<div class="cap${onRed ? ' onred' : ''}"><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  }
  return h;
}

export default { seconds, keys, camera: (t) => ({ zoom: keyframes(zoom, t) }), world, html, css, sfx, voice };
