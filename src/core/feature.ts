import type { GameContext } from './game';

/** Who a feature belongs to. Shown in credits and recorded in the vote ledger. */
export interface FeatureCredit {
  username: string;
  /** The winning comment or poll option, quoted as written. */
  text: string;
  method: 'top-comment' | 'poll' | 'founder';
}

export interface FeatureMeta {
  /** Folder name, e.g. "007-jump". Unique and stable. */
  id: string;
  /** Episode number that introduced it. Day 0 is the launch build. */
  day: number;
  title: string;
  credit: FeatureCredit;
}

export interface Feature {
  meta: FeatureMeta;
  /** Build the feature. Use ctx.onUpdate for per-frame work. */
  setup(ctx: GameContext): void;
}

export interface FeatureSelection {
  /** Play the game as it was on this day (the "time machine"). */
  day?: number;
  /** Feature ids to switch off: the rollback lever. */
  off?: string[];
}

export function selectFeatures(all: Feature[], sel: FeatureSelection = {}): Feature[] {
  const off = new Set(sel.off ?? []);
  return all
    .filter((f) => !off.has(f.meta.id))
    .filter((f) => sel.day === undefined || f.meta.day <= sel.day)
    // Stable: features from the same day keep their registry order.
    .sort((a, b) => a.meta.day - b.meta.day);
}

export function parseSelection(search: string): FeatureSelection {
  const p = new URLSearchParams(search);
  const sel: FeatureSelection = {};
  const day = p.get('day');
  if (day !== null && /^\d+$/.test(day)) sel.day = Number(day);
  const off = p.get('off');
  if (off) sel.off = off.split(',').map((s) => s.trim()).filter(Boolean);
  return sel;
}

export function currentDay(features: Feature[]): number {
  return features.reduce((d, f) => Math.max(d, f.meta.day), 0);
}
