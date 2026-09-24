import { Chess } from 'chess.js';
import type {
  AnalysedGame, AnalysedMove, Color, Evaluation, MoveVerdict, Phase, PositionAnalysis,
} from '../types';
import {
  TERMINAL, accuracyFromWinLoss, classifyMove, gameAccuracy, winLossFor, winPctFor,
} from '../chess/evaluation';
import { detectMotifs, phaseOf } from '../chess/motifs';
import { moveTimes, pvToSan, type ParsedGame } from '../chess/pgn';

/** Anything that can evaluate a position — the worker engine, or a test double. */
export interface Analyser {
  analyse(fen: string, opts: { depth?: number; multipv?: number }): Promise<PositionAnalysis>;
}

export interface BookLookup {
  (sans: string[]): { id: string; name: string; bookPlies: number } | null;
}

export interface AnalyseOptions {
  depth: number;
  multipv?: number;
  onProgress?: (done: number, total: number) => void;
  /** Flip to true to abort mid-game; the promise rejects with AnalysisCancelled. */
  signal?: { cancelled: boolean };
  book?: BookLookup;
  /** Reuse evaluations across games in a batch. */
  cache?: Map<string, PositionAnalysis>;
}

export class AnalysisCancelled extends Error {
  constructor() {
    super('Analysis cancelled');
    this.name = 'AnalysisCancelled';
  }
}

/** Evaluation of a position where the game has already ended. */
function terminalEval(chess: Chess): Evaluation | null {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) return chess.turn() === 'w' ? TERMINAL.whiteMated : TERMINAL.blackMated;
  return TERMINAL.draw;
}

const EMPTY_ANALYSIS = (fen: string, evaluation: Evaluation): PositionAnalysis => ({
  fen,
  depth: 0,
  lines: [{ multipv: 1, depth: 0, evaluation, pv: [] }],
  stableFromDepth: 0,
});

export async function analyseGame(
  engine: Analyser,
  parsed: ParsedGame,
  hero: Color,
  opts: AnalyseOptions,
): Promise<AnalysedGame> {
  const multipv = opts.multipv ?? 3;
  const cache = opts.cache ?? new Map<string, PositionAnalysis>();

  // Every position the game passes through: before each move, plus the final one.
  const fens = [...parsed.moves.map((m) => m.fenBefore), parsed.moves[parsed.moves.length - 1].fenAfter];
  const analyses: PositionAnalysis[] = [];

  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.cancelled) throw new AnalysisCancelled();
    const fen = fens[i];
    const cached = cache.get(`${fen}@${opts.depth}`);
    if (cached) {
      analyses.push(cached);
    } else {
      const board = new Chess(fen);
      const terminal = terminalEval(board);
      const result = terminal
        ? EMPTY_ANALYSIS(fen, terminal)
        : await engine.analyse(fen, { depth: opts.depth, multipv });
      cache.set(`${fen}@${opts.depth}`, result);
      analyses.push(result);
    }
    opts.onProgress?.(i + 1, fens.length);
  }

  const book = opts.book?.(parsed.moves.map((m) => m.san)) ?? null;
  const bookPlies = book?.bookPlies ?? 0;
  const times = moveTimes(parsed);

  const moves: AnalysedMove[] = parsed.moves.map((m, i) => {
    const before = analyses[i];
    const after = analyses[i + 1];
    const evalBefore = before.lines[0]?.evaluation ?? { cp: 0, mate: null };
    const evalAfter = after.lines[0]?.evaluation ?? { cp: 0, mate: null };

    const winLoss = winLossFor(evalBefore, evalAfter, m.color);
    const bestLineUci = before.lines[0]?.pv ?? [];
    const refutationUci = after.lines[0]?.pv ?? [];
    const playedIsBest = bestLineUci[0] === m.uci;

    // How much worse the engine's second choice would have been.
    const second = before.lines[1];
    const secondBestWinLoss =
      second && before.lines[0]
        ? Math.max(0, winPctFor(before.lines[0].evaluation, m.color) - winPctFor(second.evaluation, m.color))
        : null;

    // Moves that were roughly as good — accepted as alternate puzzle solutions.
    const alternativesSan = before.lines
      .slice(1)
      .filter((l) => before.lines[0] && winPctFor(before.lines[0].evaluation, m.color) - winPctFor(l.evaluation, m.color) <= 5)
      .map((l) => pvToSan(m.fenBefore, l.pv, 1)[0])
      .filter((s): s is string => Boolean(s));

    const board = new Chess(m.fenBefore);
    const legalMoveCount = board.moves().length;
    const phase: Phase = phaseOf(m.fenBefore, i);
    const inBook = i < bookPlies;

    const verdict: MoveVerdict = classifyMove({
      winLoss,
      winPctBefore: winPctFor(evalBefore, m.color),
      playedIsBest,
      secondBestWinLoss,
      legalMoveCount,
      isSacrifice: false,
      inBook,
    });

    const motifs =
      winLoss >= 8 && !inBook
        ? detectMotifs({
            fenBefore: m.fenBefore,
            fenAfter: m.fenAfter,
            playedUci: m.uci,
            mover: m.color,
            bestPv: bestLineUci,
            refutationPv: refutationUci,
            evalBefore,
            evalAfter,
            winLoss,
            phase,
            secondsSpent: times[i],
            clockRemaining: m.clockSeconds,
            timeControlBase: parsed.timeControl?.base ?? null,
          })
        : [];

    return {
      ply: i,
      moveNumber: m.moveNumber,
      color: m.color,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      evalBefore,
      evalAfter,
      winLoss: Math.round(winLoss * 10) / 10,
      accuracy: Math.round(accuracyFromWinLoss(winLoss) * 10) / 10,
      verdict,
      bestSan: bestLineUci.length ? pvToSan(m.fenBefore, bestLineUci, 1)[0] ?? null : null,
      bestLineSan: pvToSan(m.fenBefore, bestLineUci, 8),
      bestLineUci: bestLineUci.slice(0, 10),
      refutationSan: pvToSan(m.fenAfter, refutationUci, 6),
      refutationUci: refutationUci.slice(0, 10),
      secondBestWinLoss: secondBestWinLoss === null ? null : Math.round(secondBestWinLoss * 10) / 10,
      alternativesSan,
      phase,
      motifs,
      secondsSpent: times[i],
      stableFromDepth: before.stableFromDepth,
    };
  });

  /* ---- aggregates ---- */
  const byColour = (c: Color) => moves.filter((m) => m.color === c);
  const samples = (list: AnalysedMove[]) =>
    list.map((m) => ({ accuracy: m.accuracy, winPctBefore: winPctFor(m.evalBefore, m.color) }));
  const accuracy = {
    w: Math.round(gameAccuracy(samples(byColour('w'))) * 10) / 10,
    b: Math.round(gameAccuracy(samples(byColour('b'))) * 10) / 10,
  };

  const phases: Phase[] = ['opening', 'middlegame', 'endgame'];
  const accuracyByPhase = Object.fromEntries(
    phases.map((p) => [
      p,
      {
        w: Math.round(gameAccuracy(samples(byColour('w').filter((m) => m.phase === p))) * 10) / 10,
        b: Math.round(gameAccuracy(samples(byColour('b').filter((m) => m.phase === p))) * 10) / 10,
      },
    ]),
  ) as Record<Phase, { w: number; b: number }>;

  const emptyCounts = (): Record<MoveVerdict, number> => ({
    brilliant: 0, great: 0, best: 0, good: 0, book: 0,
    inaccuracy: 0, mistake: 0, blunder: 0, forced: 0,
  });
  const counts: Record<Color, Record<MoveVerdict, number>> = { w: emptyCounts(), b: emptyCounts() };
  for (const m of moves) counts[m.color][m.verdict]++;

  return {
    id: parsed.id,
    meta: parsed.meta,
    hero,
    moves,
    openingId: book?.id ?? null,
    openingName: book?.name ?? null,
    bookPlies,
    accuracy,
    accuracyByPhase,
    counts,
    depth: opts.depth,
    analysedAt: Date.now(),
    startingFen: parsed.startingFen,
  };
}

/** Positions to evaluate for a batch — used to show a realistic progress bar. */
export function totalPositions(games: ParsedGame[]): number {
  return games.reduce((sum, g) => sum + g.moves.length + 1, 0);
}
