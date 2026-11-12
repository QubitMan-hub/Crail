// Renders a finished vertical Reel (1080x1920, 30fps, H.264 + AAC) from a shot list,
// frame by frame, so the motion is perfectly smooth on any machine.
//
//   npm run build && npm run reel -- day-000                 -> captures/day-000.mp4
//   npm run reel -- day-000 --voice voice.m4a                -> same, with your voice-over mixed in
//   npm run reel -- day-000 --no-captions                    -> without the caption lines
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
    'no-captions': { type: 'boolean', default: false },
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
  #reel-title, #reel-caption {
    position: fixed; left: 0; right: 0; text-align: center; white-space: pre-line;
    font-family: 'Inter Display', 'Inter', system-ui, sans-serif; color: #1d1b19;
    transition: none; pointer-events: none;
  }
  /* Kept clear of Instagram's own buttons: nothing in the top 12% or bottom 22%. */
  #reel-title { top: 15%; font-weight: 900; font-size: 46px; line-height: 1.08; letter-spacing: 0.02em; }
  #reel-title.small { font-weight: 800; font-size: 30px; letter-spacing: 0.04em; }
  #reel-caption { top: 66%; padding: 0 56px; }
  #reel-caption span {
    display: inline; font-weight: 700; font-size: 21px; line-height: 1.5;
    background: #1d1b19; color: #f4efe4; padding: 3px 9px; border-radius: 4px;
    box-decoration-break: clone; -webkit-box-decoration-break: clone;
  }
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
    for (const id of ['reel-title', 'reel-caption']) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    window.__landings = 0;
    window.__crail.game.ctx.events.on('cube:rolled', () => window.__landings++);
  });

  const at = (list, t) => list.find(([a, b]) => t >= a && t < b)?.[2] ?? '';
  const smooth = (x) => x * x * (3 - 2 * x);
  const zoomAt = (t) => {
    const z = shots.zoom;
    if (t <= z[0][0]) return z[0][1];
    for (let i = 1; i < z.length; i++) {
      if (t <= z[i][0]) {
        const k = smooth((t - z[i - 1][0]) / (z[i][0] - z[i - 1][0]));
        return z[i - 1][1] + (z[i][1] - z[i - 1][1]) * k;
      }
    }
    return z[z.length - 1][1];
  };

  const held = new Set();
  let seen = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    const want = new Set(shots.keys.filter(([a, b]) => t >= a && t < b).map(([, , key]) => `Key${key}`));
    for (const code of held) if (!want.has(code)) { await page.keyboard.up(code); held.delete(code); }
    for (const code of want) if (!held.has(code)) { await page.keyboard.down(code); held.add(code); }
    const count = await page.evaluate(
      ({ dt, zoom, title, caption }) => {
        const { game } = window.__crail;
        game.ctx.camera.zoom = zoom;
        game.ctx.camera.updateProjectionMatrix();
        game.step(dt);
        const tEl = document.getElementById('reel-title');
        tEl.textContent = title;
        tEl.className = title === title.toUpperCase() ? '' : 'small';
        const cEl = document.getElementById('reel-caption');
        cEl.replaceChildren();
        if (caption) cEl.appendChild(Object.assign(document.createElement('span'), { textContent: caption }));
        return window.__landings;
      },
      { dt: 1 / FPS, zoom: zoomAt(t), title: at(shots.titles, t), caption: values['no-captions'] ? '' : at(shots.captions, t) },
    );
    for (; seen < count; seen++) landings.push(t);
    await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, quality: 95, type: 'jpeg' });
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
} finally {
  await browser.close();
  await server.close();
}

// The game's sound is made in code, so remake the same thud for each landing.
const RATE = 48000;
const pcm = new Float32Array(Math.ceil(shots.seconds * RATE));
landings.forEach((t, i) => {
  const f0 = 105 + ((i * 37) % 25);
  const start = Math.round(t * RATE);
  for (let n = 0; n < RATE * 0.13 && start + n < pcm.length; n++) {
    const s = n / RATE;
    // Pitch falls from f0 to 45% of it over 90ms, like the in-game oscillator.
    const k = Math.log(0.45) / 0.09;
    const phase = (2 * Math.PI * f0 * (Math.exp(k * s) - 1)) / k;
    pcm[start + n] += 0.5 * Math.sin(phase) * Math.exp(-38 * s);
  }
});
const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
pcm.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
await writeFile(`${dir}/thuds.wav`, wav);

const out = `captures/${name}.mp4`;
const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-i', `${dir}/thuds.wav`];
if (values.voice) {
  // Voice up front, thuds tucked underneath it.
  args.push('-i', values.voice, '-filter_complex',
    '[1:a]volume=0.55[t];[2:a]loudnorm=I=-15:TP=-1.5,aresample=48000[v];[t][v]amix=inputs=2:duration=first:normalize=0[a]',
    '-map', '0:v', '-map', '[a]');
}
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(shots.seconds), out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
await rm(dir, { recursive: true, force: true });
console.log(`Saved ${out} (${landings.length} rolls)`);
