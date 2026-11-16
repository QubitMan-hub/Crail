// The Day 3 Reel: combo weekend. Three features, one episode. Times are in seconds.
//   0-5.2     HOOK    cold open on him marching at the camera: "the comments chose a dictator"
//   5.2-8.4   COMBO   red card: three comments, one weekend
//   8.4-19.4  ONE     soldiers built by hand, a gold statue nobody asked for, a rocket with a 0% record
//   19.4-28   TWO     the park: four rides, zero inspections, and he does not queue
//   28-44.6   THREE   the cult: preach to recruit, he is immune, the temple ordains, they worship
//   44.6-61.2 WAR     he noticed: conscription, an aimed rocket, the tank, then the map and bailing off a ride
//   61.2-65.8 OUT     she still has the bow
//
// Needs files that are not in the repository:
//   captures/day-003-assets/{top,park,cult}.png   screenshots of the three real comments
import { existsSync } from 'node:fs';
import { esc, keyframes, pop, smooth } from './kit.mjs';

const ASSETS = 'captures/day-003-assets';
const T = { combo: 5.2, one: 8.4, statue: 11.4, rocket: 13.6, two: 19.4, swing: 22.4, wheel: 25.0, three: 28.0, immune: 33.4, temple: 35.6, walk: 39.6, war: 44.6, pad: 47.3, strike: 49.0, tank: 53.4, map: 56.4, bail: 58.8, out: 61.2, black: 65.5 };
const seconds = 65.8;
/** Where the war plays: the cube and three followers here, him and his pad up-left of them. */
const W = { x: 60, z: -40 };
const HIM = { x: W.x - 13, z: W.z };
/** The temple's door cell: where the cube stands to be let in. */
const DOOR = { x: -11, z: -2 };
/** Where the cult scene plays. */
const C = { x: 60, z: 30 };

function prepare() {
  for (const f of ['top', 'park', 'cult']) {
    if (!existsSync(`${ASSETS}/${f}.png`)) throw new Error(`Missing ${ASSETS}/${f}.png (screenshot of a real comment).`);
  }
}

// D = down-right, W = up-right, A = up-left, S = down-left.
const keys = [
  [54.75, 54.85, 'D'], [55.05, 55.15, 'D'],
  [56.5, 56.6, 'M'], [58.6, 58.7, 'M'],
  [60.1, 60.2, 'D'],
  [36.4, 36.5, 'W'],
  [40.0, 40.1, 'D'], [40.4, 40.5, 'D'], [40.8, 40.9, 'D'],
];

const CASTS = ['goths', 'femboys', 'soldiers', 'leader'];
const clearAll = (t) => CASTS.map((c) => [t, `${c}.clear`]);
const actions = [
  ...CASTS.map((c) => [0, `${c}.staged`, true]),
  ...clearAll(0),
  [0, 'cult.charms', 0], [0, 'cube.teleport', -70, 30],
  // Hook and One: he marches the whole way, building as he goes.
  [0, 'leader.spawn', 0, -66, 0, 0, { steps: 44 }], [0, 'leader.soldier'], [0, 'leader.tank'], [0, 'cut'],
  [T.one, 'cut'], [8.3, 'leader.build'],
  [11.6, 'leader.statue'], [T.statue, 'cut'],
  [13.2, 'leader.site'], [13.3, 'leader.build'], [T.rocket, 'cut'], [13.7, 'leader.launch', 'tip'],
  // The cube gets on the wheel early, so it comes back round on cue.
  [18.0, 'cube.teleport', 30, -8], [18.05, 'park.ride', 'wheel'],
  // Two: the park, already busy.
  ...clearAll(T.two),
  [T.two, 'goths.spawn', 0, 15, -4, 3, { idle: 99 }], [T.two, 'goths.spawn', 2, 17, -4, 3, { idle: 99 }],
  [T.two, 'goths.spawn', 1, 28, -8, 3, { idle: 99 }], [T.two, 'goths.spawn', 3, 27, 4, 1, { idle: 99 }],
  [T.two, 'goths.spawn', 0, 19, 5, 3, { idle: 99 }],
  [T.two, 'femboys.spawn', 0, 19, -6, 2, { idle: 99 }], [T.two, 'femboys.spawn', 1, 19, -8, 2, { idle: 99 }],
  [T.two, 'femboys.spawn', 2, 14, 5, 1, { idle: 99 }], [T.two, 'femboys.spawn', 3, 16, 5, 1, { idle: 99 }],
  [T.two, 'femboys.spawn', 0, 31, 4, 1, { idle: 99 }], [T.two, 'femboys.spawn', 1, 25, 5, 3, { idle: 99 }],
  [T.two, 'leader.spawn', 0, 29, 4, 1, { idle: 99 }], [T.two, 'leader.soldier'], [T.two, 'leader.soldier'],
  [T.two, 'park.board', 'goths', 0, 'carousel'], [T.two, 'park.board', 'goths', 1, 'carousel'],
  [T.two, 'park.board', 'goths', 2, 'wheel'], [T.two, 'park.board', 'goths', 3, 'swing'],
  [T.two, 'park.board', 'goths', 4, 'bench'],
  [T.two, 'park.board', 'femboys', 0, 'carousel'], [T.two, 'park.board', 'femboys', 1, 'carousel'],
  [T.two, 'park.board', 'femboys', 2, 'trampoline'], [T.two, 'park.board', 'femboys', 3, 'trampoline'],
  [T.two, 'park.board', 'femboys', 4, 'swing'], [T.two, 'park.board', 'femboys', 5, 'bench'],
  [T.two, 'park.board', 'leader', 0, 'swing'],
  [T.two, 'cut'], [T.swing, 'cut'], [22.6, 'leader.drill'], [T.wheel, 'cut'],
  // Three: the cube stands still between a femboy and a goth and preaches. Three charms.
  // The leader is right there too. Nothing happens to him.
  ...clearAll(T.three),
  [T.three, 'cube.teleport', C.x, C.z], [T.three, 'cult.charms', 3], [T.three, 'cult.face', 1],
  [T.three, 'femboys.spawn', 0, C.x, C.z + 1, 3, { idle: 99 }],
  [T.three, 'goths.spawn', 1, C.x, C.z - 1, 1, { idle: 99 }],
  [T.three, 'leader.spawn', 0, C.x - 1, C.z, 0, { idle: 99 }],
  [T.three, 'cut'], [T.immune, 'cut'],
  // The temple: five members, already recruited, about to be ordained.
  ...clearAll(T.temple),
  [T.temple, 'cube.teleport', DOOR.x, DOOR.z], [T.temple, 'cult.charms', 0], [T.temple, 'cult.face', 3],
  [T.temple, 'goths.spawn', 1, DOOR.x, DOOR.z + 2, 3, { idle: 99 }], [T.temple, 'goths.bow', 0],
  [T.temple, 'femboys.spawn', 0, DOOR.x + 1, DOOR.z + 1, 3, { idle: 99 }],
  [T.temple, 'femboys.spawn', 1, DOOR.x - 1, DOOR.z + 1, 3, { idle: 99 }],
  [T.temple, 'goths.spawn', 2, DOOR.x + 2, DOOR.z + 2, 3, { idle: 99 }],
  [T.temple, 'femboys.spawn', 2, DOOR.x - 2, DOOR.z + 2, 3, { idle: 99 }],
  [T.temple, 'cult.recruit', 'goths', 0], [T.temple, 'cult.recruit', 'femboys', 0], [T.temple, 'cult.recruit', 'femboys', 1],
  [T.temple, 'cult.recruit', 'goths', 1], [T.temple, 'cult.recruit', 'femboys', 2],
  [T.temple, 'cut'], [T.walk, 'cut'],
  // War: he drafts a passer-by, then aims the rocket at the cube and its three followers.
  ...clearAll(T.war),
  [T.war, 'cube.teleport', W.x, W.z], [T.war, 'cult.charms', 3], [T.war, 'cult.face', 3],
  [T.war, 'goths.spawn', 0, W.x - 1, W.z + 2, 3, { idle: 99 }],
  [T.war, 'femboys.spawn', 0, W.x + 1, W.z + 2, 3, { idle: 99 }],
  [T.war, 'femboys.spawn', 1, W.x - 2, W.z + 1, 3, { idle: 99 }],
  [T.war, 'cult.recruit', 'goths', 0], [T.war, 'cult.recruit', 'femboys', 0], [T.war, 'cult.recruit', 'femboys', 1],
  [T.war, 'leader.spawn', 0, HIM.x, HIM.z, 1, { idle: 99 }], [T.war, 'leader.site'], [T.war, 'leader.tank'],
  [T.war, 'femboys.spawn', 3, HIM.x, HIM.z + 2, 3, { idle: 99 }],
  [T.war, 'cut'], [45.3, 'leader.conscript'], [45.6, 'leader.launch', 'strike'],
  [T.pad, 'cut'], [T.strike, 'cut'],
  [T.tank + 0.1, 'leader.shell'],
  [T.map, 'cut'],
  // Bailing off the trampoline.
  [T.bail, 'cube.teleport', 15, 9], [T.bail + 0.05, 'park.ride', 'trampoline'], [T.bail, 'cut'],
  // Out: her again, with the bow.
  ...clearAll(T.out),
  [T.out, 'cube.teleport', -70, 30],
  [T.out, 'goths.spawn', 1, DOOR.x, DOOR.z + 6, 3, { idle: 99 }], [T.out, 'goths.bow', 0],
  [T.out, 'cut'],
];

const zoom = [
  [0, 1.4], [T.combo, 1.2],
  [T.one, 1.45], [T.statue - 0.01, 1.55], [T.statue, 1.2], [T.rocket - 0.01, 1.3],
  [T.rocket, 0.95], [16.0, 0.95], [17.6, 0.8], [T.two - 0.01, 0.9],
  [T.two, 0.29], [T.swing - 0.01, 0.34], [T.swing, 0.8], [T.wheel - 0.01, 0.9],
  [T.wheel, 0.82], [T.three - 0.01, 0.9],
  [T.three, 1.4], [T.immune - 0.01, 1.5], [T.immune, 1.7], [T.temple - 0.01, 1.85],
  [T.temple, 0.8], [T.walk - 0.01, 0.9],
  [T.walk, 0.85], [41.5, 0.85], [T.war - 0.01, 1.0],
  [T.war, 1.5], [T.pad - 0.01, 1.6], [T.pad, 1.0], [T.strike - 0.01, 0.9],
  [T.strike, 0.95], [T.tank, 0.85], [T.map, 0.85], [T.bail - 0.01, 0.85], [T.bail, 1.0], [T.out - 0.01, 1.1],
  [T.out, 1.75], [seconds, 1.95],
];
function camera(t) {
  const cam = { zoom: keyframes(zoom, t) };
  if (t < T.rocket) cam.follow = ['leader', 0];
  else if (t < T.two) cam.at = 'rocket';
  else if (t < T.swing) cam.focus = [22, -0.5];
  else if (t < T.wheel) cam.focus = [29.4, 5.6];
  else if (t < T.three) cam.focus = [29.5, -9.5];
  else if (t < T.immune) cam.focus = [C.x, C.z];
  else if (t < T.temple) cam.focus = [C.x - 0.7, C.z];
  else if (t < T.walk) cam.focus = [DOOR.x + 0.3, DOOR.z - 0.4];
  else if (t < T.war) cam.focus = [keyframes([[T.walk, DOOR.x + 0.6], [40, DOOR.x + 0.6], [41.4, DOOR.x + 2.6], [T.war, DOOR.x + 2.8]], t), DOOR.z + 0.2];
  else if (t < T.pad) cam.focus = [HIM.x, HIM.z + 1];
  else if (t < T.strike) cam.at = 'rocket';
  else if (t < T.bail) return cam; // on the cube, wherever it gets thrown
  else if (t < T.out) cam.focus = [15, 7.6];
  else cam.follow = ['goths', 0];
  return cam;
}

const frozen = (t) => t >= T.combo && t < T.one - 0.2;

// Voice-over, as estimated. Retimed to the real recording afterwards.
const captions = [
  [0.2, 1.0, 'Day three'], [1.0, 1.6, 'of letting'], [1.6, 2.3, 'Instagram comments'], [2.3, 2.9, 'build my game.'],
  [3.2, 4.0, 'You chose'], [4.0, 5.0, 'a dictator.'],
  [5.4, 6.4, 'I had a free weekend.'], [6.5, 7.3, 'So you get'], [7.3, 8.2, 'three features.'],
  [8.6, 9.4, 'He builds soldiers.'], [9.5, 10.2, 'One at a time.'], [10.3, 11.0, 'By hand.'],
  [11.6, 12.5, 'He built a gold statue'], [12.5, 13.2, 'of himself.'],
  [13.9, 14.8, 'And a rocket.'], [16.4, 17.4, 'Success rate:'], [17.4, 18.3, 'zero percent.'], [18.6, 19.3, 'They clap anyway.'],
  [19.6, 20.3, 'Pick one:'], [20.3, 20.9, 'a park.'], [21.0, 21.7, 'Four rides.'], [21.7, 22.3, 'Zero inspections.'],
  [22.6, 23.4, 'Everyone rides.'], [23.6, 24.8, 'He does not queue.'],
  [25.2, 26.0, 'Every ride'], [26.0, 26.9, 'gives me a charm.'],
  [28.2, 28.9, 'Pick two:'], [28.9, 29.6, 'a cult.'], [29.9, 30.8, 'Rides give charms.'], [30.8, 31.9, 'Charms buy followers.'], [32.2, 33.2, 'So… Disneyland.'],
  [33.6, 34.5, 'He can’t be recruited.'], [34.6, 35.4, 'I tried.'],
  [35.8, 36.7, 'There’s a temple.'], [36.9, 37.9, 'Members get promoted.'], [38.1, 39.4, 'The boss gets a stick.'],
  [39.9, 40.9, 'Now they follow me.'], [41.6, 42.3, 'I stop,'], [42.3, 43.1, 'they worship.'], [43.3, 43.9, 'I have a halo.'], [43.9, 44.5, 'This is fine.'],
  [44.8, 45.7, 'Then he noticed.'], [45.9, 47.1, 'He drafts my people now.'],
  [47.5, 48.7, 'And the rocket?'], [49.2, 50.0, 'It’s aimed.'], [50.1, 50.9, 'At me.'], [52.4, 53.3, 'That cost me a charm.'],
  [53.6, 54.6, 'The tank shoots too.'], [55.8, 56.3, 'Missed.'],
  [56.7, 57.5, 'There’s a map now.'], [57.6, 58.5, 'Press M.'],
  [59.0, 59.9, 'And you can bail'], [59.9, 60.9, 'off any ride.'],
  [61.5, 62.2, 'Day four.'], [62.2, 63.1, 'Top comment wins.'], [63.4, 64.1, 'Please.'], [64.1, 65.2, 'Just say “add a tree”.'],
];
// Short written asides, popped on like a reply.
const asides = [
  [12.0, 13.5, 'nobody asked.'],
  [18.7, 19.35, 'success rate: 0%'],
  [21.8, 22.35, 'safety inspections: 0'],
  [28.6, 30.3, 'stand still to preach'],
  [30.5, 33.3, 'goth: ✦2 (expensive taste)'],
  [33.9, 35.5, 'leader: immune'],
  [37.0, 39.5, 'acolyte → priest → high priest'],
  [40.0, 41.5, 'robes keep their colours'],
  [45.7, 47.2, 'conscripted. no paperwork.'],
  [49.3, 51.8, 'get out of the ring'],
  [52.2, 53.3, '−1 ✦'],
  [55.7, 56.35, 'tank accuracy: also 0%'],
  [60.3, 61.15, 'no charm for quitters'],
];

const sfx = [
  [T.combo, 'boom'], [6.2, 'pop'], [6.8, 'pop'], [7.4, 'pop'],
  [T.one, 'pop'], [11.6, 'pop'], [13.7, 'tick'], [14.5, 'tick'], [15.3, 'tick'],
  [T.two, 'pop'], [T.three, 'pop'], [36.5, 'boom'],
  [T.war, 'pop'], [45.6, 'tick'], [46.4, 'tick'], [47.2, 'tick'], [51.9, 'boom'], [55.6, 'boom'], [T.map + 0.1, 'pop'], [T.bail, 'pop'], [64.9, 'dun'],
];
const music = {
  sections: [[0, T.combo], [T.one, 64.1]],
  duck: [[0.2, 5.0], [8.6, 11.0], [11.6, 13.2], [13.9, 14.8], [16.4, 19.3], [19.6, 22.3], [22.6, 24.8], [25.2, 26.9], [28.2, 33.2], [33.6, 35.4], [35.8, 39.4], [39.9, 40.9], [41.6, 44.5], [44.8, 47.1], [47.5, 48.7], [49.2, 50.9], [52.4, 54.6], [55.8, 58.5], [59.0, 60.9], [61.5, 65.2]],
};

const css = `
  #reel { z-index:9; }
  #map p { display:none; }
  .big { position:absolute; left:0; right:0; text-align:center; font-weight:900; line-height:1; letter-spacing:.01em; }
  .sub { position:absolute; left:0; right:0; text-align:center; font-weight:800; font-size:26px; letter-spacing:.05em; }
  .tag { display:inline-block; font-weight:800; font-size:15px; letter-spacing:.14em; padding:6px 12px 5px;
         border:2px solid var(--ink); border-radius:999px; background:#f6f1e6; white-space:nowrap; }
  .cap { position:absolute; left:0; right:0; top:63.5%; text-align:center; }
  .cap span { display:inline-block; font-weight:900; font-size:39px; letter-spacing:.005em; color:var(--ink);
              -webkit-text-stroke:9px #f6f1e6; paint-order:stroke fill; }
  .cap.onred span { color:#f6f1e6; -webkit-text-stroke:0; }
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
  if (t < T.combo) {
    // On screen from the very first frame: the whole premise in six words.
    h += `<div class="hook"><div>THE COMMENTS CHOSE<br>A <b>DICTATOR.</b></div></div>`;
    h += `<div class="sub" style="top:23%"><span class="tag">DAY 3</span></div>`;
  }
  if (within(t, T.combo, T.one)) {
    h += `<div class="red"><div class="title" ${scaled(pop(t, T.combo + 0.05, 0.25))}>COMBO<br>WEEKEND</div>
      <div class="x3" style="opacity:${t > 5.8 ? 1 : 0}">3 COMMENTS · 1 EPISODE</div>`;
    [['top', 6.2, 36, -3], ['park', 6.8, 48, 2.5], ['cult', 7.4, 60, -2]].forEach(([file, at, top, tilt]) => {
      const s = pop(t, at, 0.2);
      h += `<div class="stack" ${scaled(s, `top:${top}%;transform:rotate(${tilt}deg) scale(${s.toFixed(3)})`)}><img src="/reelasset/${file}.png"></div>`;
    });
    h += '</div>';
  }
  h += chapter(t, T.one, 10.6, 'top', '① TOP COMMENT');
  h += chapter(t, T.two, 21.6, 'park', '② MY PICK');
  h += chapter(t, T.three, 29.0, 'cult', '③ MY PICK');

  const aside = asides.find(([a, b]) => within(t, a, b));
  if (aside) h += `<div class="aside"><span ${scaled(pop(t, aside[0], 0.16), 'transform-origin:50% 50%')}>${esc(aside[2])}</span></div>`;

  if (within(t, 27.2, T.three)) h += `<div class="gain"><span ${scaled(pop(t, 27.2, 0.18))}>+1 <b>✦</b> charm</span></div>`;
  if (within(t, 42.4, T.war)) {
    h += `<div class="big" ${scaled(pop(t, 42.4), 'top:12%;font-size:50px')}>CULT: 5 · SECT</div>`;
    h += `<div class="sub" style="top:18.5%;font-size:21px;opacity:${t > 43.1 ? 1 : 0}">ride rides · earn charms · preach</div>`;
  }
  if (within(t, 64.0, T.black)) {
    h += `<div class="big" ${scaled(pop(t, 64.0), 'top:13%;font-size:46px')}>she still has the bow.</div>`;
  }

  const c = captions.find(([a, b]) => within(t, a, b));
  const onRed = within(t, T.combo, T.one);
  if (c) h += `<div class="cap${onRed ? ' onred' : ''}" ${onRed ? 'style="top:80%"' : ''}><span ${scaled(0.7 + 0.3 * pop(t, c[0], 0.14))}>${esc(c[2])}</span></div>`;
  if (t >= T.black) h += '<div class="black"></div>';
  return h;
}

export default { seconds, prepare, assets: { dir: ASSETS }, keys, actions, camera, frozen, html, css, sfx, music };
