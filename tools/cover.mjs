// Renders a Reel cover image (1080x1920 PNG). All text sits inside the centre
// 3:4 area, which is what shows on the profile grid.
//
//   npm run build && node tools/cover.mjs --day 0 --line1 "ONE CUBE." --line2 "YOU DECIDE THE REST."
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    day: { type: 'string', default: '0' },
    line1: { type: 'string', default: 'ONE CUBE.' },
    line2: { type: 'string', default: 'YOU DECIDE THE REST.' },
    zoom: { type: 'string', default: '1.5' },
    size: { type: 'string', default: '92' },
    // Scripted setup, as JSON: [["goths.clear"], ["goths.spawn", 0, -1, 0, 0, {"idle": 99}], ...]
    stage: { type: 'string', default: '[]' },
    seconds: { type: 'string', default: '0' },
  },
});
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const server = await preview({ preview: { port: 4176, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
await mkdir('captures', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:4176/?manual&day=${values.day}`);
  await page.waitForFunction(() => window.__crail?.game);
  await page.addStyleTag({
    content: `
    .hud, #sound { display: none !important; }
    #cover { position: fixed; inset: 0; color: #1d1b19; text-align: center;
             font-family: 'Inter Display', 'Inter', system-ui, sans-serif; }
    #cover .day { position: absolute; left: 0; right: 0; top: 13.5%; }
    #cover .day span { display: inline-block; background: #f2542d; color: #1d1b19; font-weight: 900;
                       font-size: 34px; letter-spacing: .06em; padding: 8px 20px 6px; border-radius: 10px; }
    #cover .l1 { position: absolute; left: 0; right: 0; top: 19.5%; font-weight: 900; font-size: ${Number(values.size)}px; line-height: 1; white-space: nowrap; }
    #cover .l2 { position: absolute; left: 0; right: 0; top: 67%; font-weight: 900; font-size: 40px; line-height: 1.05; padding: 0 16px; white-space: nowrap; }
    #cover .brand { position: absolute; left: 0; right: 0; top: 79%; font-weight: 800; font-size: 20px; letter-spacing: .34em; padding-left: .34em; opacity: .7; }`,
  });
  await page.evaluate(
    ({ day, l1, l2, zoom, stage, seconds }) => {
      const { game, direct } = window.__crail;
      game.ctx.camera.zoom = zoom;
      game.ctx.camera.updateProjectionMatrix();
      for (const [name, ...args] of stage) direct(name, ...args);
      for (let t = 0; t < seconds; t += 1 / 30) game.step(1 / 30);
      game.step(0);
      const el = Object.assign(document.createElement('div'), { id: 'cover' });
      el.innerHTML = `<div class="day"><span>DAY ${day}</span></div><div class="l1">${l1}</div><div class="l2">${l2}</div><div class="brand">CRAIL</div>`;
      document.body.appendChild(el);
    },
    { day: Number(values.day), l1: esc(values.line1), l2: esc(values.line2), zoom: Number(values.zoom), stage: JSON.parse(values.stage), seconds: Number(values.seconds) },
  );
  const out = `captures/day-${String(values.day).padStart(3, '0')}-cover.png`;
  await page.screenshot({ path: out });
  console.log(`Saved ${out}`);
} finally {
  await browser.close();
  await server.close();
}
