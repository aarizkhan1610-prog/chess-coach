import { playedAtFrom } from '../chess/pgn';
import type { AnalysedGame, MotifTag } from '../types';

/*
 * Whether training a habit made it go away.
 *
 * The coach ranks habits by what they cost per game and has never checked
 * whether working on one changed anything. This is that check: the games
 * played before you started training a habit against the games played since,
 * scored the same way the weakness profile scores them.
 *
 * It is deliberately reluctant. A player trains whatever was worst lately, and
 * whatever was worst lately tends to drift back down on its own, so a lower
 * number afterwards is the expected result even when the training did nothing.
 * The verdict therefore needs enough games on both sides and a difference too
 * large to be shuffling — and when it cannot say, it says so rather than
 * congratulating anybody.
 */

export interface PlayedTime {
  at: number;
  /** False when only the date was known — the game sits at midnight. */
  precise: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** When a game was played, as far as its headers say. */
export function whenPlayed(game: AnalysedGame): PlayedTime | null {
  if (typeof game.meta.playedAt === 'number') return { at: game.meta.playedAt, precise: true };
  const day = playedAtFrom(game.meta.date, null);
  return day === null ? null : { at: day, precise: false };
}

/**
 * Games in the order they were played, oldest first.
 *
 * A game with no date at all is placed at the time it was analysed, which is
 * the latest it can have been played. That keeps it in the sequence rather
 * than piling every undated game up at one end.
 */
export function byPlayed(games: AnalysedGame[]): AnalysedGame[] {
  const key = (g: AnalysedGame) => whenPlayed(g)?.at ?? g.analysedAt;
  return [...games].sort((a, b) => key(a) - key(b) || a.analysedAt - b.analysedAt);
}

/** Win probability this game's hero lost to one motif, split the way the profile splits it. */
export function motifCost(game: AnalysedGame, tag: MotifTag): number {
  let cost = 0;
  for (const move of game.moves) {
    if (move.color !== game.hero || !move.motifs.includes(tag)) continue;
    cost += move.winLoss / move.motifs.length;
  }
  return cost;
}

/** Everything this game's hero lost to any named motif. */
function namedCost(game: AnalysedGame): number {
  let cost = 0;
  for (const move of game.moves) {
    if (move.color !== game.hero || !move.motifs.length) continue;
    cost += move.winLoss;
  }
  return cost;
}

/* ------------------------------------------------------------------ *
 * The training log
 * ------------------------------------------------------------------ */

export type TrainingKind = 'position' | 'lesson' | 'puzzle';

export interface TrainingRecord {
  /** The moment training began. Everything is measured from here. */
  firstAt: number;
  lastAt: number;
  count: number;
  byKind: Partial<Record<TrainingKind, number>>;
}

export function logged(prev: TrainingRecord | undefined, kind: TrainingKind, at: number): TrainingRecord {
  return {
    firstAt: prev ? Math.min(prev.firstAt, at) : at,
    lastAt: prev ? Math.max(prev.lastAt, at) : at,
    count: (prev?.count ?? 0) + 1,
    byKind: { ...prev?.byKind, [kind]: (prev?.byKind[kind] ?? 0) + 1 },
  };
}

/* ------------------------------------------------------------------ *
 * Before and after
 * ------------------------------------------------------------------ */

/** Games needed on each side before the comparison says anything. */
export const MIN_SIDE = 5;

/**
 * How unlikely a difference has to be before it is called a change.
 *
 * Conservative on purpose, because the two mistakes are not equal. Telling
 * somebody a habit is fixed when it is not sends them off to work on something
 * else; telling them it is not clear yet only means another week of it.
 */
export const SIGNIFICANCE = 0.05;

const PERMUTATIONS = 2000;

export type ProgressVerdict = 'not-trained' | 'too-early' | 'improving' | 'no-clear-change' | 'worse';

export interface SideReading {
  games: number;
  /** Win probability lost to this habit, per game. */
  perGame: number;
}

export interface ProgressReading {
  tag: MotifTag;
  verdict: ProgressVerdict;
  trainedSince: number | null;
  before: SideReading;
  after: SideReading;
  /** After minus before, per game. Negative is better. */
  change: number;
  /** How often shuffling the games produced a gap at least this big. */
  pValue: number | null;
  /**
   * The same split applied to every other named mistake — whether the player
   * improved across the board, which a single habit's number cannot separate
   * from training it.
   */
  overall: { before: number; after: number } | null;
  /** Games that could not be placed either side of the training. */
  undated: number;
}

/** A small seeded generator, so the same games always give the same verdict. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Two-sided permutation test on the difference in means.
 *
 * Chosen over a t-test because per-game cost is nothing like normal: most
 * games lose nothing at all to any one habit, and a few lose a great deal.
 * Shuffling makes no assumption about that shape.
 */
export function permutationP(before: number[], after: number[], seed = 1): number {
  const observed = Math.abs(mean(after) - mean(before));
  const pool = [...before, ...after];
  const rand = mulberry32(seed);
  let atLeast = 0;
  for (let i = 0; i < PERMUTATIONS; i++) {
    for (let j = pool.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [pool[j], pool[k]] = [pool[k], pool[j]];
    }
    const diff = Math.abs(mean(pool.slice(before.length)) - mean(pool.slice(0, before.length)));
    if (diff >= observed - 1e-9) atLeast++;
  }
  // The +1s count the observed arrangement itself, so p is never exactly 0.
  return (atLeast + 1) / (PERMUTATIONS + 1);
}

export function progressFor(
  games: AnalysedGame[],
  tag: MotifTag,
  record: TrainingRecord | undefined,
): ProgressReading {
  const empty: SideReading = { games: 0, perGame: 0 };
  if (!record) {
    return { tag, verdict: 'not-trained', trainedSince: null, before: empty, after: empty, change: 0, pValue: null, overall: null, undated: 0 };
  }

  const before: AnalysedGame[] = [];
  const after: AnalysedGame[] = [];
  let undated = 0;
  const trainingDay = Math.floor(record.firstAt / DAY);

  for (const game of games) {
    const played = whenPlayed(game);
    /*
     * A game with no date is left out rather than placed by when it was
     * imported: a game imported after you started training can easily have
     * been played long before.
     */
    if (!played) { undated++; continue; }
    // Date-only, and on the very day training began: it could be either side.
    if (!played.precise && Math.floor(played.at / DAY) === trainingDay) { undated++; continue; }
    (played.at < record.firstAt ? before : after).push(game);
  }

  const beforeCosts = before.map((g) => motifCost(g, tag));
  const afterCosts = after.map((g) => motifCost(g, tag));
  const reading = (costs: number[]): SideReading => ({
    games: costs.length,
    perGame: Math.round(mean(costs) * 10) / 10,
  });

  const b = reading(beforeCosts);
  const a = reading(afterCosts);
  const change = Math.round((mean(afterCosts) - mean(beforeCosts)) * 10) / 10;
  const enough = before.length >= MIN_SIDE && after.length >= MIN_SIDE;

  const overall = enough
    ? {
      before: Math.round(mean(before.map((g) => namedCost(g) - motifCost(g, tag))) * 10) / 10,
      after: Math.round(mean(after.map((g) => namedCost(g) - motifCost(g, tag))) * 10) / 10,
    }
    : null;

  if (!enough) {
    return { tag, verdict: 'too-early', trainedSince: record.firstAt, before: b, after: a, change, pValue: null, overall, undated };
  }

  const p = permutationP(beforeCosts, afterCosts);
  const verdict: ProgressVerdict = p >= SIGNIFICANCE ? 'no-clear-change' : change < 0 ? 'improving' : 'worse';
  return { tag, verdict, trainedSince: record.firstAt, before: b, after: a, change, pValue: Math.round(p * 1000) / 1000, overall, undated };
}
