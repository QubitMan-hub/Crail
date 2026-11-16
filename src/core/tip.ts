/**
 * A short line of text at the bottom of the screen, for telling the player what just
 * happened or what something costs. Features share the one line; the newest wins.
 */
let timer: ReturnType<typeof setTimeout> | undefined;

export function tip(text: string, seconds = 5): void {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('gone');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.add('gone'), seconds * 1000);
}
