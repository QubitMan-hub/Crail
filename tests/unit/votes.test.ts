import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS tool, no type declarations
import { rankComments, shortcodeOf } from '../../tools/collect-comments.mjs';

const c = (id: string, username: string, like_count: number, timestamp: string, extra = {}) => ({
  id, username, like_count, timestamp, text: `idea ${id}`, ...extra,
});

describe('vote ranking', () => {
  const comments = [
    c('a', 'ana', 5, '2026-01-01T10:00:00+0000'),
    c('b', 'bo', 9, '2026-01-01T12:00:00+0000'),
    c('c', 'cy', 9, '2026-01-01T11:00:00+0000'),
    c('d', 'qubitman_ftw', 50, '2026-01-01T10:30:00+0000'),
    c('e', 'eve', 99, '2026-01-01T10:45:00+0000', { hidden: true }),
    c('f', 'late', 70, '2026-01-02T10:00:01+0000'),
  ];
  const ranked = rankComments(comments, { owner: 'qubitman_ftw', deadline: '2026-01-02T10:00:00Z' });

  it('puts most likes first and breaks ties by earliest comment', () => {
    expect(ranked.map((r: any) => r.id)).toEqual(['c', 'b', 'a']);
    expect(ranked[0]).toMatchObject({ rank: 1, username: 'cy', likes: 9 });
  });
  it("excludes the creator's own, hidden and after-deadline comments", () => {
    const ids = ranked.map((r: any) => r.id);
    expect(ids).not.toContain('d');
    expect(ids).not.toContain('e');
    expect(ids).not.toContain('f');
  });
});

describe('shortcodeOf', () => {
  it('reads reel and post permalinks', () => {
    expect(shortcodeOf('https://www.instagram.com/reel/DAbc_12-x/')).toBe('DAbc_12-x');
    expect(shortcodeOf('https://www.instagram.com/qubitman_ftw/p/Xyz9/?igsh=1')).toBe('Xyz9');
    expect(shortcodeOf('nonsense')).toBeNull();
  });
});
