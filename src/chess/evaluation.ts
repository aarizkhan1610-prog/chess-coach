import type { Color, Evaluation, MoveVerdict } from '../types';

/** Centipawn value used to stand in for a forced mate. */
const MATE_CP = 10000;
/** Reserved magnitude meaning "the game is already over on the board". */
export const TERMINAL_CP = 30000;

export const TERMINAL: { whiteMated: Evaluation; blackMated: Evaluation; draw: Evaluation } = {
  whiteMated: { cp: -TERMINAL_CP, mate: null },
  blackMated: { cp: TERMINAL_CP, mate: null },
  draw: { cp: 0, mate: null },
};

export function isTerminal(e: Evaluation): boolean {
  return e.mate === null && Math.abs(e.cp ?? 0) >= TERMINAL_CP - 1;
}

export function evalToCp(e: Evaluation): number {
  if (e.mate === null && Math.abs(e.cp ?? 0) >= TERMINAL_CP - 1) return e.cp ?? 0;
  if (e.mate !== null) {
    const sign = e.mate > 0 ? 1 : -1;
    return sign * (MATE_CP - Math.min(Math.abs(e.mate), 100) * 10);
  }
  return e.cp ?? 0;
}

export function isMate(e: Evaluation): boolean {
  return e.mate !== null;
}

/**
 * Win probability for White, 0..100.
 * Logistic fit used by Lichess; keeps the scale comparable to public tooling.
 */
export function winPctWhite(e: Evaluation): number {
  if (e.mate !== null) return e.mate > 0 ? 100 : 0;
  if (isTerminal(e)) return (e.cp ?? 0) > 0 ? 100 : 0;
  const cp = Math.max(-1500, Math.min(1500, e.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function winPctFor(e: Evaluation, color: Color): number {
  const w = winPctWhite(e);
  return color === 'w' ? w : 100 - w;
}

/** Win-probability points the mover threw away. Never negative. */
export function winLossFor(before: Evaluation, after: Evaluation, mover: Color): number {
  return Math.max(0, winPctFor(before, mover) - winPctFor(after, mover));
}

/** Lichess's per-move accuracy curve, clamped to 0..100. */
export function accuracyFromWinLoss(winLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

export interface ClassifyInput {
  winLoss: number;
  winPctBefore: number;
  playedIsBest: boolean;
  /** Win% drop the second-best move would have caused. Null when unknown. */
  secondBestWinLoss: number | null;
  legalMoveCount: number;
  /** True when the move gives up material that the engine still likes. */
  isSacrifice: boolean;
  inBook: boolean;
}

/**
 * Turn a win% loss into a human label.
 *
 * Two guards keep the labels honest:
 *  - in a already-lost or already-won position, win% swings are cheap, so
 *    errors there are softened by one step;
 *  - a position with one legal move can't be a mistake.
 */
export function classifyMove(i: ClassifyInput): MoveVerdict {
  if (i.legalMoveCount <= 1) return 'forced';
  if (i.inBook) return 'book';

  const extreme = i.winPctBefore < 12 || i.winPctBefore > 88;

  let verdict: MoveVerdict;
  if (i.winLoss >= 30) verdict = 'blunder';
  else if (i.winLoss >= 20) verdict = 'mistake';
  else if (i.winLoss >= 10) verdict = 'inaccuracy';
  else if (i.playedIsBest) verdict = 'best';
  else verdict = 'good';

  if (extreme) {
    if (verdict === 'blunder') verdict = 'mistake';
    else if (verdict === 'mistake') verdict = 'inaccuracy';
    else if (verdict === 'inaccuracy') verdict = 'good';
  }

  // Promote genuinely hard-to-find best moves.
  if (verdict === 'best' && i.secondBestWinLoss !== null && i.secondBestWinLoss >= 20) {
    verdict = i.isSacrifice ? 'brilliant' : 'great';
  }
  return verdict;
}

export const VERDICT_META: Record<MoveVerdict, { label: string; color: string; symbol: string }> = {
  brilliant:  { label: 'Brilliant',  color: 'var(--v-brilliant)',  symbol: '!!' },
  great:      { label: 'Great',      color: 'var(--v-great)',      symbol: '!' },
  best:       { label: 'Best',       color: 'var(--v-best)',       symbol: '✓' },
  good:       { label: 'Good',       color: 'var(--v-good)',       symbol: '' },
  book:       { label: 'Book',       color: 'var(--v-book)',       symbol: '♞' },
  forced:     { label: 'Forced',     color: 'var(--v-book)',       symbol: '□' },
  inaccuracy: { label: 'Inaccuracy', color: 'var(--v-inaccuracy)', symbol: '?!' },
  mistake:    { label: 'Mistake',    color: 'var(--v-mistake)',    symbol: '?' },
  blunder:    { label: 'Blunder',    color: 'var(--v-blunder)',    symbol: '??' },
};

export function formatEval(e: Evaluation): string {
  if (e.mate !== null) return `${e.mate > 0 ? '' : '-'}M${Math.abs(e.mate)}`;
  if (isTerminal(e)) return (e.cp ?? 0) > 0 ? '1-0' : '0-1';
  const p = (e.cp ?? 0) / 100;
  return `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(2)}`;
}

/** Population standard deviation of a slice. */
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

export interface AccuracySample {
  accuracy: number;
  /** Win% for this mover before the move — used to measure how sharp the position was. */
  winPctBefore: number;
}

/**
 * Game accuracy for one side.
 *
 * A straight mean is too forgiving: in a short game a piece blunder hides
 * behind a handful of book moves. So we combine two means, as Lichess does:
 *
 *  - a volatility-weighted mean, which counts mistakes in calm positions more
 *    heavily than noise in wild ones, and
 *  - a harmonic mean, which is dragged down hard by any single bad move.
 *
 * The average of the two tracks how strong a game actually felt.
 */
export function gameAccuracy(samples: AccuracySample[]): number {
  if (!samples.length) return 0;
  if (samples.length === 1) return samples[0].accuracy;

  const win = samples.map((s) => s.winPctBefore);
  const window = Math.max(2, Math.min(8, Math.ceil(samples.length / 5)));

  let weighted = 0;
  let weightTotal = 0;
  for (let i = 0; i < samples.length; i++) {
    const slice = win.slice(Math.max(0, i - window), Math.min(win.length, i + window + 1));
    const weight = Math.max(0.5, Math.min(12, stdev(slice)));
    weighted += samples[i].accuracy * weight;
    weightTotal += weight;
  }
  const weightedMean = weightTotal > 0 ? weighted / weightTotal : 0;

  const harmonicMean =
    samples.length / samples.reduce((a, s) => a + 1 / Math.max(s.accuracy, 1), 0);

  return Math.max(0, Math.min(100, (weightedMean + harmonicMean) / 2));
}
