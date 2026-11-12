import { describe, expect, it } from 'vitest';
import { currentDay, parseSelection, selectFeatures, type Feature } from '../../src/core/feature';

const f = (id: string, day: number): Feature => ({
  meta: { id, day, title: id, credit: { username: 'x', text: 'y', method: 'top-comment' } },
  setup() {},
});
const all = [f('002-b', 2), f('000-cube', 0), f('001-a', 1)];
const ids = (fs: Feature[]) => fs.map((x) => x.meta.id);

describe('feature selection', () => {
  it('orders features oldest first', () => {
    expect(ids(selectFeatures(all))).toEqual(['000-cube', '001-a', '002-b']);
  });
  it('time machine: ?day=N plays the game as of that day', () => {
    expect(ids(selectFeatures(all, parseSelection('?day=1')))).toEqual(['000-cube', '001-a']);
    expect(currentDay(selectFeatures(all, { day: 1 }))).toBe(1);
  });
  it('rollback: ?off= disables single features', () => {
    expect(ids(selectFeatures(all, parseSelection('?off=001-a')))).toEqual(['000-cube', '002-b']);
  });
  it('ignores junk parameters', () => {
    expect(parseSelection('?day=abc&off=')).toEqual({});
  });
});

describe('feature registry', () => {
  it('has unique ids whose prefix matches the day', async () => {
    // Imported lazily: features touch the DOM only inside setup().
    const { allFeatures } = await import('../../src/features');
    const seen = new Set<string>();
    for (const { meta } of allFeatures) {
      expect(seen.has(meta.id)).toBe(false);
      seen.add(meta.id);
      expect(meta.id).toMatch(/^\d{3}-[a-z0-9-]+$/);
      expect(Number(meta.id.slice(0, 3))).toBe(meta.day);
      expect(meta.credit.username).not.toBe('');
    }
  });
});
