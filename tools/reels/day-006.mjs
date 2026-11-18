// The Day 6 Reel: the fight. Times are in seconds.
//   0-3       HOOK     the pool, too quiet: "the comments asked for a fight" (film braam)
//   3-6.6     COMMENT  the top comment, as a card
//   6.6-11.2  MEET     two rivals moved in: Sonny, Prinz, and a glare
//   11.2-     FIGHT    the whole fight, as it plays in the game: its own camera, slow motion,
//                      sound and music. Captions follow the fight's beats as they happen.
//   then      OUT      Day 7: the top comment decides
//
// No files needed: the comment card is drawn here. If a screenshot of the real comment is
// put at captures/day-006-assets/top.png, it is used instead.
import { existsSync } from 'node:fs';
import { esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-006-assets';
const SHOT = existsSync(`${ASSETS}/top.png`);
const POOL = { x: 3, z: 14 };
/** Where Sonny and Prinz are met: the sand down-left of the pool. */
const M = { x: -4, z: 21 };
const T = { comment: 3.0, meet: 6.6, glare: 8.9, fight: 11.2 };
// How long the fight runs is measured by a dry run (tools/reels/day-006 notes): the end
// card goes up as they leave, and the Reel ends a moment after.
const seconds = 54.4;

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const actions = [
  ...CASTS.flatMap((c) => [[0, `${c}.staged`, true], [0, `${c}.clear`]]),
  [0, 'octopus.staged', true], [0, 'picachu.staged', true],
  [0, 'cult.charms', 0], [0, 'cube.teleport', 1, 21],
  // Facing the camera to be introduced.
  [0, 'fighters.place', 0, M.x - 1, M.z, 99, 1], [0, 'fighters.place', 1, M.x + 1, M.z, 99, 1], [0, 'cut'],
  [T.glare, 'rivals.standoff', 2.2],
  // The fight, with its moves chosen: a combo, both at once, a beam, the two of them at it.
  [T.fight, 'rivals.fight', 1, ['punch:Sonny', 'flurry', 'beam:Prinz', 'clash']],
];

const zoom = [[0, 2.15], [T.comment, 1.8], [T.meet - 0.01, 1.7], [T.meet, 2.5], [T.fight - 0.01, 2.6], [T.fight, 1.0]];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < T.meet) cam.focus = [POOL.x + 0.2, POOL.z + keyframes([[0, 1.4], [T.meet, 0.6]], t)];
  else if (t < T.fight) cam.focus = [M.x, M.z - 0.3];
  // In the fight the game's own camera does the work.
  return cam;
}

// Where the fighters are on screen, and how the fight is going, read from the game.
const probe = `(() => {
  const s = window.__crail.state;
  const cam = window.__crail.game.ctx.camera;
  const tags = s.everyone.filter((m) => m.n.persona.kind === 'fighter').map((m) => {
    const p = m.rig.root.position.clone();
    p.y += 2.05;
    p.project(cam);
    return [p.x, p.y, m.rig.root.visible];
  });
  return { beat: s.rivals.beat, fighting: s.rivals.fighting, tags };
})()`;

// What to say on each beat of the fight.
const SAY = {
  taunt: ['They picked a fight', 'with Gåmson.'],
  power: ['POWERING UP'],
  'punch:Sonny': ['Jab. Cross.'],
  flurry: ['Both. At. Once.'],
  'beam:Prinz': ['Prinz charges a beam…'],
  clash: ['…then they forget Gåmson', 'and fight each other.'],
  stray: ['A stray beam', 'smashes his rock.'],
  rescue: ['TÅHGONG', 'TO THE RESCUE'],
  bow: ['GG.'],
};
let lastBeat = '';
let beatAt = 0;
let outAt = Infinity;

const css = `
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; white-space:nowrap; }
  .hook { position:absolute; left:0; right:0; top:12%; text-align:center; }
  .hook div { display:inline-block; background:var(--ink); color:#f6f1e6; font-weight:900; font-size:46px; line-height:1.02;
              padding:14px 24px 12px; border-radius:16px; transform:rotate(-2deg); letter-spacing:.01em; }
  .hook b { color:var(--red); }
  .card { position:absolute; left:26px; right:26px; top:17%; background:#fffdf8; border-radius:22px; padding:22px 24px 20px;
          box-shadow:0 22px 60px rgba(29,27,25,.35); transform-origin:30% 50%; }
  .card .who { font-weight:800; font-size:21px; letter-spacing:.01em; }
  .card .who i { font-style:normal; opacity:.45; font-weight:700; margin-left:8px; }
  .card .what { font-weight:800; font-size:33px; line-height:1.15; margin-top:8px; }
  .card .likes { margin-top:12px; font-weight:800; font-size:18px; color:var(--red); letter-spacing:.04em; }
  .card .tag { position:absolute; left:16px; top:-40px; }
  .card img { display:block; width:100%; border-radius:14px; }
  .name { position:absolute; transform:translate(-50%, -100%); }
  .name span { display:inline-block; font-weight:900; font-size:20px; letter-spacing:.16em; color:#fffdf8;
               padding:7px 13px 6px; border-radius:10px; white-space:nowrap; box-shadow:0 8px 20px rgba(29,27,25,.25); }
  .cap { position:absolute; left:0; right:0; top:61%; text-align:center; }
  .cap div { font-weight:900; font-size:42px; line-height:1.08; color:var(--ink);
             -webkit-text-stroke:10px #f6f1e6; paint-order:stroke fill; letter-spacing:.005em; }
  .cap.loud div { font-size:58px; letter-spacing:.04em; color:var(--red); }
  .out { position:absolute; left:0; right:0; top:22%; text-align:center; }
  .out .d7 { font-weight:900; font-size:110px; letter-spacing:.06em; color:var(--ink); -webkit-text-stroke:12px #f6f1e6; paint-order:stroke fill; }
  .out .line { margin-top:8px; font-weight:900; font-size:36px; color:var(--ink); -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .out .tag { margin-top:22px; font-size:19px; background:var(--red); color:#fffdf8; border-color:var(--red); }
  .black { position:absolute; inset:0; background:#000; }
  .flash { position:absolute; inset:0; background:#fffdf8; }
`;

const scaled = (s, extra = '') => `style="transform:scale(${s.toFixed(3)});opacity:${s > 0 ? 1 : 0};${extra}"`;
const within = (t, a, b) => t >= a && t < b;
const lines = (l) => l.map((x) => `<div>${esc(x)}</div>`).join('');

function html(t, probe) {
  let h = '';
  // A white flash on each hard cut.
  for (const c of [T.comment, T.meet, T.fight]) {
    if (within(t, c, c + 0.12)) h += `<div class="flash" style="opacity:${(1 - (t - c) / 0.12).toFixed(2)}"></div>`;
  }
  if (within(t, 0.45, T.comment)) {
    h += `<div class="hook" ${scaled(pop(t, 0.45, 0.25))}><div>THE COMMENTS<br>ASKED FOR<br>A <b>FIGHT.</b></div></div>`;
    h += `<div class="big" style="top:33.5%"><span class="tag" ${scaled(pop(t, 0.9))}>DAY 6</span></div>`;
  }
  if (within(t, T.comment, T.meet)) {
    const leaving = 1 - smooth((t - (T.meet - 0.25)) / 0.25);
    const s = pop(t, T.comment, 0.22) * leaving;
    const body = SHOT
      ? `<img src="/reelasset/top.png">`
      : `<div class="who">@ancientpro_gamer<i>top comment</i></div>
         <div class="what">Add goku and Vegeta fighting with octopus</div>
         <div class="likes">♥ 34</div>`;
    h += `<div class="card" ${scaled(s, `transform:rotate(-2deg) scale(${s.toFixed(3)})`)}><span class="tag">TOP COMMENT</span>${body}</div>`;
    if (t > 4.6) h += `<div class="cap" ${scaled(pop(t, 4.6, 0.18) * leaving)}>${lines(['Gåmson vs. two', 'very angry fighters.'])}</div>`;
  }
  if (within(t, T.meet, T.fight) && probe?.tags) {
    const looks = [['Sonny', '#d8432f'], ['Prinz', '#4f3a86']];
    probe.tags.forEach(([x, y, shown], i) => {
      if (!shown) return;
      const s = pop(t, T.meet + 0.15 + i * 0.45, 0.2);
      h += `<div class="name" style="left:${((x + 1) * 50).toFixed(2)}%;top:${((1 - y) * 50).toFixed(2)}%">
        <span ${scaled(s, `background:${looks[i][1]}`)}>${looks[i][0].toUpperCase()}</span></div>`;
    });
    if (t < T.glare) h += `<div class="cap" ${scaled(pop(t, 7.4, 0.18))}>${lines(['Two rivals', 'moved in.'])}</div>`;
    else h += `<div class="cap" ${scaled(pop(t, T.glare + 0.1, 0.18))}>${lines(['They do not', 'get along.'])}</div>`;
  }
  if (t >= T.fight && probe) {
    if (probe.beat !== lastBeat) {
      lastBeat = probe.beat;
      beatAt = t;
      if ((probe.beat === 'leave' || !probe.fighting) && outAt === Infinity) outAt = t;
    }
    const say = SAY[lastBeat];
    // Each caption stays up for most of its beat, but not so long it talks over the next.
    if (say && t - beatAt < 2.6) {
      const k = pop(t, beatAt + 0.1, 0.18) * (1 - smooth((t - beatAt - 2.3) / 0.3));
      const loud = lastBeat === 'power' || lastBeat === 'rescue' || lastBeat === 'bow';
      h += `<div class="cap${loud ? ' loud' : ''}" ${scaled(k)}>${lines(say)}</div>`;
    }
  }
  if (t >= outAt) {
    h += `<div class="out">
      <div class="d7" ${scaled(pop(t, outAt + 0.1, 0.26))}>DAY 7</div>
      <div class="line" ${scaled(pop(t, outAt + 0.45, 0.2))}>the top comment decides</div>
      <span class="tag" ${scaled(pop(t, outAt + 0.8, 0.2))}>COMMENT BELOW</span></div>`;
  }
  if (t >= seconds - 0.35) h += `<div class="black" style="opacity:${smooth((t - (seconds - 0.35)) / 0.3).toFixed(2)}"></div>`;
  return h;
}

// Sound for the parts before the fight; the fight brings its own.
const gameSfx = [
  [0, { kind: 'drone', dur: 3.3 }],
  [0, { kind: 'stinger', gain: 0.9 }],
  [1.6, { kind: 'riser', dur: 1.4, gain: 0.8 }],
  [T.comment, { kind: 'heavy', gain: 0.7 }],
  [T.meet, { kind: 'whoosh', dur: 0.4 }],
  [T.glare, { kind: 'crack', gain: 0.35 }],
  [10.1, { kind: 'riser', dur: 1.1, gain: 0.7 }],
];
const sfx = [[T.meet + 0.15, 'pop'], [T.meet + 0.6, 'pop'], [7.4, 'pop'], [T.glare + 0.3, 'dun']];
const music = { sections: [[T.comment + 0.2, T.fight - 0.3]] };

export default {
  seconds, assets: SHOT ? { dir: ASSETS } : undefined, keys: [], actions, camera, html, css, sfx, music, gameSfx, probe,
};
