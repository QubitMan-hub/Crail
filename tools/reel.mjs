// Renders a finished vertical Reel (1080x1920, 30fps, H.264 + AAC) from a shot list,
// frame by frame, so the motion is perfectly smooth on any machine.
//
//   npm run build && npm run reel -- day-000                 -> captures/day-000.mp4
//   npm run reel -- day-000 --voice voice.m4a                -> same, with your voice-over mixed in
//   add --voice-trim 0.9 to cut dead air off the start of the voice, --no-sfx for voice only
//
// A shot list (tools/reels/<name>.mjs) exports:
//   seconds, keys [[from, to, key]], camera(t) -> {zoom}, html(t) -> overlay markup,
//   css, sfx [[time, 'boom' | 'pop' | 'tick']], and optionally world(t) -> {cubeY, impactAt}.
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
try {
  const page = await browser.newPage({ viewport: { width: W / 2, height: H / 2 }, deviceScaleFactor: 2 });
  const day = values.day ? `&day=${values.day}` : '';
  await page.goto(`http://localhost:4175/?manual${day}`);
  await page.waitForFunction(() => window.__crail?.game);
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(() => {
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'reel' }));
    window.__landings = 0;
    const { game } = window.__crail;
    game.ctx.events.on('cube:rolled', () => window.__landings++);
    window.__cube = game.ctx.scene.children.find((o) => o.isMesh && o.castShadow);
  });

  const held = new Set();
  let seen = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    const want = new Set(shots.keys.filter(([a, b]) => t >= a && t < b).map(([, , key]) => `Key${key}`));
    for (const code of held) if (!want.has(code)) { await page.keyboard.up(code); held.delete(code); }
    for (const code of want) if (!held.has(code)) { await page.keyboard.down(code); held.add(code); }

    const world = shots.world?.(t) ?? {};
    const impact = world.impactAt !== undefined && t >= world.impactAt && t - 1 / FPS < world.impactAt;
    const count = await page.evaluate(
      ({ dt, zoom, html, cubeY, impact }) => {
        const { game } = window.__crail;
        game.ctx.camera.zoom = zoom;
        game.ctx.camera.updateProjectionMatrix();
        if (cubeY !== undefined && !game.ctx.state.cube.moving) window.__cube.position.y = cubeY;
        if (impact) game.ctx.bump(0.45);
        game.step(dt);
        document.getElementById('reel').innerHTML = html;
        return window.__landings;
      },
      { dt: 1 / FPS, zoom: shots.camera(t).zoom, html: shots.html(t), cubeY: world.cubeY, impact },
    );
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
};
landings.forEach((t, i) => {
  const f0 = 105 + ((i * 37) % 25);
  blip(t, { f0, f1: f0 * 0.45, slide: 0.09, decay: 38, len: 0.13, gain: 0.5 });
});
for (const [t, kind] of shots.sfx ?? []) blip(t, SOUNDS[kind]);

const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
pcm.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
await writeFile(`${dir}/sfx.wav`, wav);

const out = `captures/${name}.mp4`;
const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-i', `${dir}/sfx.wav`];
if (values.voice) {
  const voice = `[2:a]atrim=start=${Number(values['voice-trim'])},asetpts=PTS-STARTPTS,highpass=f=70,loudnorm=I=-15:TP=-1.5,aresample=48000,apad[v]`;
  const mix = values['no-sfx']
    ? `${voice};[v]anull[a]`
    // Voice up front, effects tucked underneath it.
    : `[1:a]volume=0.5[t];${voice};[t][v]amix=inputs=2:duration=first:normalize=0[a]`;
  args.push('-i', values.voice, '-filter_complex', mix, '-map', '0:v', '-map', '[a]');
} else if (values['no-sfx']) {
  args.push('-map', '0:v');
}
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(shots.seconds), out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
await rm(dir, { recursive: true, force: true });
console.log(`Saved ${out} (${landings.length} rolls)`);
