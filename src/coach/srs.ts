import type { MotifTag, Puzzle, PuzzleProgress } from '../types';

const DAY = 24 * 60 * 60 * 1000;

export function newProgress(puzzleId: string): PuzzleProgress {
  return {
    puzzleId,
    ease: 2.3,
    interval: 0,
    dueAt: Date.now(),
    attempts: 0,
    solvedFirstTry: 0,
    lapses: 0,
    lastSeen: 0,
  };
}

/**
 * SM-2 style scheduling, simplified for chess patterns.
 *
 * A pattern you saw instantly comes back in a week; one you fumbled comes back
 * tomorrow; one you got wrong comes back in the same session.
 */
export function review(progress: PuzzleProgress, outcome: 'first-try' | 'hinted' | 'failed'): PuzzleProgress {
  const next: PuzzleProgress = { ...progress, attempts: progress.attempts + 1, lastSeen: Date.now() };

  if (outcome === 'failed') {
    next.lapses++;
    next.ease = Math.max(1.3, progress.ease - 0.3);
    next.interval = 0;
    next.dueAt = Date.now();
    return next;
  }
  if (outcome === 'hinted') {
    next.ease = Math.max(1.3, progress.ease - 0.12);
    next.interval = Math.max(1, Math.round(progress.interval * 0.6) || 1);
    next.dueAt = Date.now() + next.interval * DAY;
    return next;
  }

  next.solvedFirstTry++;
  next.ease = Math.min(3.0, progress.ease + 0.1);
  next.interval = progress.interval === 0 ? 1 : progress.interval === 1 ? 3 : Math.round(progress.interval * next.ease);
  next.dueAt = Date.now() + next.interval * DAY;
  return next;
}

export function isDue(progress: PuzzleProgress | undefined, now = Date.now()): boolean {
  return !progress || progress.dueAt <= now;
}

export interface SelectOptions {
  /** Restrict to puzzles carrying at least one of these motifs. */
  tags?: MotifTag[];
  /** Target difficulty; puzzles are ranked by closeness to it. */
  targetRating?: number;
  count: number;
  /** Prefer puzzles that are due for review. */
  spaced?: boolean;
  /** Deterministic ordering seed, for shareable daily sets. */
  seed?: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a set of puzzles for a session. */
export function selectPuzzles(
  puzzles: Puzzle[],
  progress: Record<string, PuzzleProgress>,
  opts: SelectOptions,
): Puzzle[] {
  let pool = puzzles;
  if (opts.tags?.length) {
    const wanted = new Set(opts.tags);
    pool = pool.filter((p) => p.tags.some((t) => wanted.has(t)));
  }
  if (!pool.length) return [];

  const now = Date.now();
  const rand = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 31));

  const scored = pool.map((p) => {
    const pr = progress[p.id];
    let score = 0;
    if (opts.spaced) {
      // Due items first; never-seen items count as due.
      score += isDue(pr, now) ? 0 : 1000;
      score += (pr?.solvedFirstTry ?? 0) * 5;
      score -= (pr?.lapses ?? 0) * 8;
    }
    if (opts.targetRating) score += Math.abs(p.rating - opts.targetRating) / 100;
    score += rand() * (opts.spaced ? 2 : 6);
    return { p, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, opts.count).map((s) => s.p);
}

/** Running rating for the solver, adjusted after each attempt. */
export function updateSolverRating(current: number, puzzleRating: number, solved: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - current) / 400));
  const k = 32;
  return Math.round(current + k * ((solved ? 1 : 0) - expected));
}
