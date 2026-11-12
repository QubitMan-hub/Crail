export type Dir = { dx: -1 | 0 | 1; dz: -1 | 0 | 1 };

/**
 * Isometric mapping (camera sits at +x,+y,+z):
 * up = up-right, right = down-right, down = down-left, left = up-left.
 */
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: { dx: 0, dz: -1 }, KeyW: { dx: 0, dz: -1 },
  ArrowRight: { dx: 1, dz: 0 }, KeyD: { dx: 1, dz: 0 },
  ArrowDown: { dx: 0, dz: 1 }, KeyS: { dx: 0, dz: 1 },
  ArrowLeft: { dx: -1, dz: 0 }, KeyA: { dx: -1, dz: 0 },
};

export class Input {
  private held: string[] = [];
  private tapHandlers = new Set<(x: number, y: number) => void>();
  private gestureHandlers = new Set<() => void>();

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!(e.code in KEY_DIRS) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (!this.held.includes(e.code)) this.held.push(e.code);
      this.gesture();
    });
    window.addEventListener('keyup', (e) => {
      this.held = this.held.filter((c) => c !== e.code);
    });
    window.addEventListener('blur', () => (this.held = []));

    let down: { x: number; y: number; id: number } | null = null;
    target.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    target.addEventListener('pointerup', (e) => {
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 12) return;
      this.gesture();
      this.tapHandlers.forEach((fn) => fn(e.clientX, e.clientY));
    });
  }

  /** Most recently pressed direction that is still held. */
  heldDir(): Dir | null {
    const code = this.held[this.held.length - 1];
    return code ? KEY_DIRS[code] : null;
  }

  onTap(fn: (clientX: number, clientY: number) => void): void {
    this.tapHandlers.add(fn);
  }

  /** Fires on every key press or tap. Audio must wait for this. */
  onGesture(fn: () => void): void {
    this.gestureHandlers.add(fn);
  }

  private gesture(): void {
    this.gestureHandlers.forEach((fn) => fn());
  }
}
