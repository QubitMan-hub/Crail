// Renders a finished vertical Reel (1080x1920, 30fps, H.264 + AAC) from a shot list,
// frame by frame, so the motion is perfectly smooth on any machine.
//
//   npm run build && npm run reel -- day-000                 -> captures/day-000.mp4
//   npm run reel -- day-000 --voice voice.m4a                -> same, with your voice-over mixed in
//   add --voice-trim 0.9 to cut dead air off the start of the voice, --no-sfx for voice only
//
// A shot list (tools/reels/<name>.mjs) exports:
//   seconds, keys [[from, to, key]], camera(t) -> {zoom, focus?: [x, z], follow?: [cast, index]},
//   html(t) -> overlay markup, css, sfx [[time, kind]], and optionally:
//   actions [[time, name, ...args]]  scripted events ('cut' snaps the camera, anything else goes
//                                    to the game's director, e.g. 'cube.teleport', 'goths.spawn')
//   frozen(t) -> true                game time stands still (overlay-only moments)
//   gameStyle(t) -> css              inline style for the game canvas (filters for transitions)
//   assets {dir}, prepare()          files served to the overlay at /reelasset/<file>
//   audio [{file, at, filter}]       extra audio clips mixed in at a time
//   voice [[srcFrom, srcTo, at]]     where each spoken line of the --voice file lands in the video
//   music {sections, duck}           a quiet plucked tune between [from, to] times, lowered under speech
//   world(t) -> {cubeY, impactAt}
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    voice: { type: 'string' },
    // Seconds to cut from the start of the voice file (dead air before the first word).
    'voice-trim': { type: 'string', default: '0' },
    // Leave out the game's thuds and the shot list's effects: voice only.
    'no-sfx': { type: 'boolean', default: false },
    day: { type: 'string' },
  },
});
const name = positionals[0];
if (!name) throw new Error('Usage: npm run reel -- <shot list name, e.g. day-000>');
const shots = (await import(pathToFileURL(path.resolve(`tools/reels/${name}.mjs`)).href)).default;
await shots.prepare?.();

const FPS = 30;
const W = 1080;
const H = 1920;
const frames = Math.round(shots.seconds * FPS);
const dir = `captures/${name}-frames`;
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

const OVERLAY_CSS = `
  .hud, #sound { display: none !important; }
  /* Shot lists draw into this layer. Keep clear of Instagram's own buttons:
     nothing important in the top 11% or the bottom 22%. */
  #reel { position: fixed; inset: 0; overflow: hidden; pointer-events: none; color: #1d1b19;
          font-family: 'Inter Display', 'Inter', system-ui, sans-serif; }
  ${shots.css ?? ''}
`;

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const landings = [];
const heard = [];
const actions = [...(shots.actions ?? [])].sort((a, b) => a[0] - b[0]);
try {
  const page = await browser.newPage({ viewport: { width: W / 2, height: H / 2 }, deviceScaleFactor: 2 });
  const day = values.day ? `&day=${values.day}` : '';
  if (shots.assets) {
    await page.route('**/reelasset/**', (route) => {
      const file = path.basename(new URL(route.request().url()).pathname);
      return route.fulfill({ path: path.join(shots.assets.dir, file) });
    });
  }
  await page.goto(`http://localhost:4175/?manual${day}`);
  await page.waitForFunction(() => window.__crail?.game);
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(() => {
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'reel' }));
    window.__landings = 0;
    const { game } = window.__crail;
    game.ctx.events.on('cube:rolled', () => window.__landings++);
    window.__heard = [];
    for (const e of ['cube:bonk', 'cube:struggle', 'goth:plop', 'goth:rejected']) {
      game.ctx.events.on(e, () => window.__heard.push(e));
    }
    window.__cube = game.ctx.scene.getObjectByName('cube');
  });

  const held = new Set();
  let seen = 0;
  let nextAction = 0;
  const due = [];
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    const want = new Set(shots.keys.filter(([a, b]) => t >= a && t < b).map(([, , key]) => `Key${key}`));
    for (const code of held) if (!want.has(code)) { await page.keyboard.up(code); held.delete(code); }
    for (const code of want) if (!held.has(code)) { await page.keyboard.down(code); held.add(code); }

    const world = shots.world?.(t) ?? {};
    const impact = world.impactAt !== undefined && t >= world.impactAt && t - 1 / FPS < world.impactAt;
    while (nextAction < actions.length && actions[nextAction][0] <= t) due.push(actions[nextAction++].slice(1));
    const { count, heard: now } = await page.evaluate(
      async ({ dt, cam, html, cubeY, impact, due, gameStyle }) => {
        const { game, direct } = window.__crail;
        const { ctx } = game;
        let cut = false;
        for (const [name, ...args] of due) {
          if (name === 'cut') cut = true;
          else direct(name, ...args);
        }
        ctx.camera.zoom = cam.zoom;
        ctx.camera.updateProjectionMatrix();
        if (cam.follow !== undefined) {
          // follow: a goth's index, or [cast, index] such as ['femboys', 0].
          const [cast, index] = Array.isArray(cam.follow) ? cam.follow : ['goths', cam.follow];
          const n = ctx.state[cast]?.npcs[index];
          if (n) {
            const k = n.nx === null ? 0 : n.p;
            const x = n.x + ((n.nx ?? n.x) - n.x) * k;
            const z = n.z + ((n.nz ?? n.z) - n.z) * k;
            ctx.focusOverride = (ctx.focusOverride ?? ctx.focus.clone()).set(x, 0, z);
          }
        } else if (cam.focus) ctx.focusOverride = (ctx.focusOverride ?? ctx.focus.clone()).set(cam.focus[0], 0, cam.focus[1]);
        else ctx.focusOverride = null;
        if (cubeY !== undefined && !ctx.state.cube.moving) window.__cube.position.y = cubeY;
        if (impact) ctx.bump(0.45);
        if (cut) {
          game.step(0);
          game.snapCamera();
        }
        game.step(dt);
        document.getElementById('game').style.cssText = gameStyle;
        const layer = document.getElementById('reel');
        layer.innerHTML = html;
        await Promise.all([...layer.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
        return { count: window.__landings, heard: window.__heard.splice(0) };
      },
      {
        dt: shots.frozen?.(t) ? 0 : 1 / FPS,
        cam: shots.camera(t),
        html: shots.html(t),
        cubeY: world.cubeY,
        impact,
        due: due.splice(0),
        gameStyle: shots.gameStyle?.(t) ?? '',
      },
    );
    for (const e of now) heard.push([t, e]);
    for (; seen < count; seen++) landings.push(t);
    await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, quality: 95, type: 'jpeg' });
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
} finally {
  await browser.close();
  await server.close();
}

// The game's sound is made in code, so remake the same thud for each landing,
// plus the shot list's own effects.
const RATE = 48000;
const pcm = new Float32Array(Math.ceil(shots.seconds * RATE));
/** A sine whose pitch slides from f0 to f1 over `slide` seconds, with exponential decay. */
function blip(at, { f0, f1, slide, decay, len, gain }) {
  const start = Math.round(at * RATE);
  const k = Math.log(f1 / f0) / slide;
  for (let n = 0; n < RATE * len && start + n < pcm.length; n++) {
    const s = n / RATE;
    const phase =
      (2 * Math.PI * f0 * (Math.exp(k * Math.min(s, slide)) - 1)) / k + 2 * Math.PI * f1 * Math.max(0, s - slide);
    pcm[start + n] += gain * Math.sin(phase) * Math.exp(-decay * s) * Math.min(1, n / 48);
  }
}
const SOUNDS = {
  boom: { f0: 150, f1: 38, slide: 0.22, decay: 9, len: 0.6, gain: 0.8 },
  pop: { f0: 520, f1: 880, slide: 0.05, decay: 45, len: 0.12, gain: 0.22 },
  tick: { f0: 1500, f1: 1400, slide: 0.02, decay: 110, len: 0.05, gain: 0.16 },
  // Dull knock: the cube bumping into something.
  bonk: { f0: 95, f1: 55, slide: 0.06, decay: 30, len: 0.16, gain: 0.5 },
  // A low, flat "...": the sound of being judged.
  dun: { f0: 174, f1: 92, slide: 0.3, decay: 5, len: 0.6, gain: 0.3 },
  thump: { f0: 120, f1: 40, slide: 0.12, decay: 14, len: 0.35, gain: 0.7 },
};
/** Tape hiss / TV static: filtered noise between two times. */
function hiss(from, to, gain) {
  let last = 0;
  let state = 12345;
  for (let n = Math.round(from * RATE); n < to * RATE && n < pcm.length; n++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = state / 2147483648 - 1;
    const hp = white - last; // crude high-pass, so it hisses rather than rumbles
    last = white;
    const edge = Math.min(1, (n / RATE - from) / 0.05, (to - n / RATE) / 0.05);
    pcm[n] += hp * gain * 0.5 * Math.max(0, edge);
  }
}
/** A tone that climbs and swells, then stops dead. */
function riser(from, to, gain) {
  let phase = 0;
  for (let n = Math.round(from * RATE); n < to * RATE && n < pcm.length; n++) {
    const k = (n / RATE - from) / (to - from);
    phase += (2 * Math.PI * (70 + 330 * k * k)) / RATE;
    const tremolo = 0.7 + 0.3 * Math.sin(2 * Math.PI * (4 + 10 * k) * (n / RATE));
    pcm[n] += Math.sin(phase) * gain * k * tremolo;
  }
}
landings.forEach((t, i) => {
  const f0 = 105 + ((i * 37) % 25);
  blip(t, { f0, f1: f0 * 0.45, slide: 0.09, decay: 38, len: 0.13, gain: 0.5 });
});
const HEARD = { 'cube:bonk': ['bonk', 0.1], 'cube:struggle': ['bonk', 0.08], 'goth:plop': ['thump', 0] };
for (const [t, e] of heard) if (HEARD[e]) blip(t + HEARD[e][1], SOUNDS[HEARD[e][0]]);
/**
 * "Tiptoe": a small, sneaky plucked tune in A minor, made from sine plucks.
 * Plays inside each [from, to] section and drops in level inside each duck range.
 */
function tiptoe({ sections, duck = [], gain = 1 }) {
  const BEAT = 0.6;
  const hz = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);
  // Per bar: a bass note and four plucks (eighth notes on beats 1-2, rests on 3-4 for air).
  const bars = [
    [-24, [0, 3, 7, 3]], [-24, [0, 3, 7, 12]], [-28, [-4, 0, 3, 0]], [-29, [-5, -1, 2, -1]],
  ];
  const level = (t) => (duck.some(([a, b]) => t >= a - 0.15 && t < b + 0.2) ? 0.42 : 1);
  const pluck = (at, f, amp, decay, end) => {
    const start = Math.round(at * RATE);
    for (let n = 0; n < RATE * 0.9 && start + n < pcm.length; n++) {
      const tt = n / RATE;
      if (at + tt > end) break;
      const fade = Math.min(1, (end - at - tt) / 0.04, n / 96);
      const wave = Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) + 0.12 * Math.sin(6 * Math.PI * f * tt);
      pcm[start + n] += wave * amp * gain * level(at) * Math.exp(-decay * tt) * fade;
    }
  };
  for (const [from, to] of sections) {
    for (let beat = 0; from + beat * BEAT < to; beat++) {
      const [bass, notes] = bars[Math.floor(beat / 4) % bars.length];
      const at = from + beat * BEAT;
      const inBar = beat % 4;
      if (inBar === 0 || inBar === 2) pluck(at, hz(bass), 0.2, 5, to);
      if (inBar < 2) {
        pluck(at, hz(notes[inBar * 2]), 0.11, 9, to);
        pluck(at + BEAT / 2, hz(notes[inBar * 2 + 1]), 0.11, 9, to);
      } else if (inBar === 3) pluck(at + BEAT / 2, hz(notes[3]), 0.08, 9, to);
    }
  }
}
if (shots.music) tiptoe(shots.music);
for (const [t, kind, a, b] of shots.sfx ?? []) {
  if (kind === 'harp') {
    // A rising run of plucks: the sound of drifting into a memory.
    [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24].forEach((semi, i) => {
      const f = 330 * 2 ** (semi / 12);
      blip(t + i * 0.075, { f0: f, f1: f * 1.002, slide: 0.05, decay: 6, len: 0.6, gain: 0.11 });
    });
  } else if (kind === 'hiss') hiss(t, a, b);
  else if (kind === 'riser') riser(t, a, b);
  else blip(t, SOUNDS[kind]);
}

const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
pcm.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
await writeFile(`${dir}/sfx.wav`, wav);

const out = `captures/${name}.mp4`;
const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-i', `${dir}/sfx.wav`];
// Audio graph: effects (unless --no-sfx), extra clips from the shot list, and the voice-over on top.
const chains = [];
const mixed = [];
let input = 2;
if (!values['no-sfx']) {
  chains.push(`[1:a]volume=${values.voice ? 0.5 : 1}[fx]`);
  mixed.push('[fx]');
}
for (const clip of shots.audio ?? []) {
  args.push('-i', clip.file);
  const ms = Math.round(clip.at * 1000);
  chains.push(`[${input}:a]${clip.filter},aresample=48000,adelay=${ms}:all=1[c${input}]`);
  mixed.push(`[c${input}]`);
  input++;
}
if (values.voice) {
  args.push('-i', values.voice);
  // Even out the voice first (quiet words up, loud words down), then set it to a comfortable level.
  const level = 'highpass=f=80,acompressor=threshold=-28dB:ratio=3.5:attack=6:release=180:makeup=5,loudnorm=I=-17:TP=-2:LRA=7,aresample=48000';
  const segments = shots.voice;
  if (!segments) {
    chains.push(`[${input}:a]atrim=start=${Number(values['voice-trim'])},asetpts=PTS-STARTPTS,${level}[vo]`);
    mixed.push('[vo]');
  } else {
    // Each spoken line is cut out and placed on its own, so the gaps between them are truly silent.
    chains.push(`[${input}:a]${level},asplit=${segments.length}${segments.map((_, i) => `[vs${i}]`).join('')}`);
    segments.forEach(([from, to, at], i) => {
      const len = to - from;
      chains.push(`[vs${i}]atrim=${from}:${to},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(len - 0.06).toFixed(2)}:d=0.06,adelay=${Math.round(at * 1000)}:all=1[vo${i}]`);
      mixed.push(`[vo${i}]`);
    });
  }
}
if (mixed.length) {
  chains.push(`${mixed.join('')}amix=inputs=${mixed.length}:duration=longest:normalize=0,alimiter=limit=0.7:attack=3:release=60:level=disabled,apad[a]`);
  args.push('-filter_complex', chains.join(';'), '-map', '0:v', '-map', '[a]');
} else {
  args.push('-map', '0:v');
}
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(shots.seconds), out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
await rm(dir, { recursive: true, force: true });
console.log(`Saved ${out} (${landings.length} rolls)`);
