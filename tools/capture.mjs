// Records a vertical (9:16) gameplay clip for a Reel, driven by a script of key presses.
//
//   npm run build && npm run capture                  -> captures/day-latest.webm
//   npm run capture -- --day 3 --name day-003         -> the game as it was on day 3
//   npm run capture -- --keys "D:900,W:700,A:500"     -> custom moves (key:milliseconds)
//
// Convert for Instagram:  ffmpeg -i captures/x.webm -c:v libx264 -pix_fmt yuv420p -r 30 x.mp4
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, rename } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    day: { type: 'string' },
    name: { type: 'string', default: 'day-latest' },
    keys: { type: 'string', default: 'D:700,W:700,A:1050,S:700,D:350,_:600' },
    width: { type: 'string', default: '1080' },
    height: { type: 'string', default: '1920' },
    hud: { type: 'boolean', default: false },
  },
});

const size = { width: Number(values.width), height: Number(values.height) };
const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
await mkdir('captures', { recursive: true });

try {
  // Render at half size with 2x pixel density: phone-like framing, full-HD output.
  const context = await browser.newContext({
    viewport: { width: size.width / 2, height: size.height / 2 },
    deviceScaleFactor: 2,
    recordVideo: { dir: 'captures', size },
  });
  const page = await context.newPage();
  const query = values.day ? `?day=${values.day}` : '';
  await page.goto(`http://localhost:4174/${query}`);
  await page.waitForFunction(() => window.__crail?.state.cube);
  // Reels get their own captions and voice-over, so hide on-screen UI by default.
  if (!values.hud) await page.addStyleTag({ content: '.hud, #sound { display: none !important; }' });
  await page.waitForTimeout(800);

  for (const move of values.keys.split(',')) {
    const [key, ms] = move.split(':');
    if (key === '_') {
      await page.waitForTimeout(Number(ms));
      continue;
    }
    await page.keyboard.down(`Key${key.toUpperCase()}`);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(`Key${key.toUpperCase()}`);
    await page.waitForTimeout(120);
  }

  const video = page.video();
  await context.close();
  const out = `captures/${values.name}.webm`;
  await rename(await video.path(), out);
  console.log(`Saved ${out}`);
} finally {
  await browser.close();
  await server.close();
}
