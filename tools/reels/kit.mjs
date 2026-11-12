// Small animation helpers shared by every Reel shot list.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { const c = clamp(x); return c * c * (3 - 2 * c); };
/** 0 -> 1 with a little overshoot: the "pop". */
export const backOut = (x) => { const c = clamp(x) - 1; return 1 + c * c * (2.7 * c + 1.7); };
/** Scale for something that pops in at `start` (0 before it). */
export const pop = (t, start, dur = 0.22) => (t < start ? 0 : backOut((t - start) / dur));
/** Value from [time, value] keyframes, eased between. */
export function keyframes(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, v0] = frames[i - 1];
      const [t1, v1] = frames[i];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return frames[frames.length - 1][1];
}
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Splits voice-over lines [start, end, text] into short caption chunks of a few
 * words each, timed across the line in proportion to their length.
 */
export function chunkCaptions(lines, maxChars = 16) {
  const out = [];
  for (const [start, end, text] of lines) {
    const chunks = [];
    let cur = '';
    for (const w of text.split(' ')) {
      const endsSentence = /[.?!…]$/.test(cur);
      if (cur && (endsSentence || (cur + ' ' + w).length > maxChars)) { chunks.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) chunks.push(cur);
    const total = chunks.reduce((n, c) => n + c.length + 2, 0);
    let t = start;
    for (const c of chunks) {
      const d = ((c.length + 2) / total) * (end - start);
      out.push([t, t + d, c]);
      t += d;
    }
  }
  return out;
}
