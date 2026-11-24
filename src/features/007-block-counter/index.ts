import type { Feature } from '../../core/feature';
import { tip } from '../../core/tip';
import { CUBE } from '../../ui/icons';

/**
 * A block counter: how many blocks the cube has rolled, ever. It sits under the cult
 * count, ticks up with every roll, gives a little pop every hundred, and has something
 * to say at the big round numbers. The total is kept in this browser, so it keeps
 * climbing visit after visit.
 */

const KEY = 'crail.blocks';
/** Round numbers, and what is said when the cube reaches them. */
const MILESTONES: [number, string][] = [
  [10, 'Ten blocks. A journey of a thousand blocks begins with ten.'],
  [100, '100 blocks rolled. The cube is warming up.'],
  [500, '500 blocks. Somebody get this cube a water bottle.'],
  [1000, '1,000 blocks! The cube does not have legs, and it is still tired.'],
  [2500, '2,500 blocks. Officially a long-distance cube.'],
  [5000, '5,000 blocks. Gåmson has started a betting pool on where you are going.'],
  [10000, '10,000 blocks. Touch grass. Literally: there is some in the park.'],
  [25000, '25,000 blocks. Legend.'],
];

const read = (): number => {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0; // storage can be blocked: count from zero, it still works for this visit
  }
};
const save = (n: number) => {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* ignore */
  }
};

export const blockCounter: Feature = {
  meta: {
    id: '007-block-counter',
    day: 7,
    title: 'A block counter',
    credit: { username: 'lonokkalani', text: 'Add a block counter so we can see how my blocks we have moved', method: 'top-comment' },
  },
  setup(ctx) {
    const state = { total: read(), session: 0 };
    ctx.state.blocks = state;

    const el = document.createElement('div');
    el.id = 'blocks';
    el.innerHTML = `${CUBE}<b></b><span>blocks</span>`;
    (document.getElementById('board') ?? document.body).appendChild(el);
    const num = el.querySelector('b') as HTMLElement;
    // The number counts up to the real total rather than jumping, so it reads like an odometer.
    let shown = state.total;
    const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
    num.textContent = fmt(shown);
    const pop = (cls: string) => {
      el.classList.remove(cls);
      void el.offsetWidth; // restart the animation
      el.classList.add(cls);
    };

    ctx.events.on('cube:rolled', () => {
      state.total += 1;
      state.session += 1;
      save(state.total);
      pop('tick');
      if (state.total % 100 === 0) {
        pop('hundred');
        ctx.events.emit('sfx', { kind: 'chime', gain: 0.35, pitch: 1.2 });
      }
      const m = MILESTONES.find(([n]) => n === state.total);
      if (m) tip(m[1], 5, { urgent: state.total >= 1000 });
    });

    // Scripted control, for tests and video shots.
    ctx.events.on<[number]>('direct:blocks.set', ([n]) => {
      state.total = Math.max(0, Math.floor(n));
      shown = state.total;
      num.textContent = fmt(shown);
      save(state.total);
    });

    ctx.onUpdate((dt) => {
      if (shown === state.total) return;
      // Close the gap quickly, never overshooting: big jumps whizz, single rolls tick.
      const gap = state.total - shown;
      shown += Math.sign(gap) * Math.max(Math.min(Math.abs(gap), 1), Math.abs(gap) * Math.min(1, dt * 10));
      if (Math.abs(state.total - shown) < 0.5) shown = state.total;
      num.textContent = fmt(shown);
    });
  },
};
