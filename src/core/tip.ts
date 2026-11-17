/**
 * A short line of text at the bottom of the screen, for telling the player what just
 * happened or what something costs. Features share the one line, so messages queue:
 * a new one waits until the current one has been on screen long enough to read.
 * Warnings that need the player to act now (`urgent`) skip the queue.
 */

interface Message {
  text: string;
  seconds: number;
}

/** How long a message stays up, at least, before a queued one may replace it. */
const READ_TIME = 1.8;
/** At most this many waiting; older ones are dropped, since they are out of date anyway. */
const MAX_WAITING = 3;

const queue: Message[] = [];
let current: (Message & { since: number }) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const now = () => performance.now() / 1000;

function show(m: Message): void {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = m.text;
  el.classList.remove('gone');
  current = { ...m, since: now() };
  clearTimeout(timer);
  // With more waiting, each gets just long enough to read; the last gets its full time.
  const hold = () => (queue.length ? Math.max(READ_TIME + 0.7, Math.min(m.seconds, 3)) : m.seconds);
  timer = setTimeout(next, hold() * 1000);
}

function next(): void {
  const m = queue.shift();
  if (m) return show(m);
  current = null;
  document.getElementById('hint')?.classList.add('gone');
}

export function tip(text: string, seconds = 5, opts: { urgent?: boolean } = {}): void {
  if (current?.text === text || queue.some((m) => m.text === text)) return;
  const m = { text, seconds };
  if (opts.urgent || !current) return show(m);
  queue.push(m);
  if (queue.length > MAX_WAITING) queue.shift();
  // The current one has had its moment: move on now rather than when it times out.
  const shown = now() - current.since;
  clearTimeout(timer);
  timer = setTimeout(next, Math.max(0, READ_TIME - shown) * 1000);
}
