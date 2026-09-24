import { Chess } from 'chess.js';
import type { AnalysedGame, AnalysedMove, Color, MotifTag, Puzzle } from '../types';
import { MOTIF_META } from '../types';
import { other } from '../chess/board';

/**
 * Cut an engine line down to the part that is actually a puzzle.
 *
 * Two rules, both necessary:
 *  - stop after the last forcing move (capture, check or promotion). Beyond
 *    that point the tactic has resolved and the engine's continuation is just
 *    one good move among many — asking the solver to guess it is unfair;
 *  - end on the solver's own move, so the line always resolves.
 */
export function trimToSolverMove(line: string[], maxSolverMoves: number): string[] {
  const maxPlies = Math.max(1, maxSolverMoves * 2 - 1);
  let out = line.slice(0, maxPlies);

  let lastForcing = -1;
  for (let i = 0; i < out.length; i++) {
    const san = out[i];
    if (san.includes('x') || san.includes('+') || san.includes('#') || san.includes('=')) lastForcing = i;
  }
  if (lastForcing >= 0) out = out.slice(0, lastForcing + 1);
  else out = out.slice(0, 1);

  if (out.length % 2 === 0) out = out.slice(0, -1);
  return out.length ? out : line.slice(0, 1);
}

function isCapture(san: string): boolean {
  return san.includes('x');
}
function isCheck(san: string): boolean {
  return san.includes('+') || san.includes('#');
}
function isMate(line: string[]): boolean {
  return line.some((s) => s.includes('#'));
}

/**
 * Difficulty estimate, in the familiar 600-2600 range.
 *
 * The signals are: how long the forcing line is, whether the key move is quiet
 * (quiet moves are much harder to spot than captures and checks), and how deep
 * the engine had to search before it settled on the move.
 */
export function estimateRating(input: {
  solution: string[];
  winSwing: number;
  stableFromDepth: number;
  tags: MotifTag[];
}): number {
  const solverMoves = Math.ceil(input.solution.length / 2);
  let rating = 850;

  rating += 170 * (solverMoves - 1);

  const first = input.solution[0] ?? '';
  if (!isCapture(first) && !isCheck(first)) rating += 220; // a quiet key move
  else if (isCapture(first) && isCheck(first)) rating -= 60;
  else if (isCapture(first)) rating -= 110;

  // Engines find shallow tactics instantly; a late-stabilising move was subtle.
  if (input.stableFromDepth >= 14) rating += 170;
  else if (input.stableFromDepth >= 10) rating += 80;
  else if (input.stableFromDepth <= 4) rating -= 130;

  if (isMate(input.solution)) rating += 80;
  // A huge swing usually means the material was simply hanging.
  if (input.winSwing >= 45) rating -= 90;

  if (input.tags.includes('back-rank')) rating -= 60;
  if (input.tags.includes('discovered-attack') || input.tags.includes('trapped-piece')) rating += 90;

  return Math.max(600, Math.min(2600, Math.round(rating / 10) * 10));
}

function describeTags(tags: MotifTag[]): string {
  const labels = tags.filter((t) => MOTIF_META[t].family === 'tactics').map((t) => MOTIF_META[t].short.toLowerCase());
  if (!labels.length) return 'the best move';
  return labels.join(' / ');
}

function sideName(c: Color): string {
  return c === 'w' ? 'White' : 'Black';
}

/** Verify a SAN line is playable from a FEN; returns the plies that worked. */
function playableLength(fen: string, line: string[]): number {
  const c = new Chess(fen);
  let n = 0;
  for (const san of line) {
    try {
      c.move(san);
      n++;
    } catch {
      break;
    }
  }
  return n;
}

export interface PuzzleGenOptions {
  /** Include "punish your opponent's blunder" puzzles as well. */
  includePunish?: boolean;
  /** Only generate from the hero's own moves. */
  heroOnly?: boolean;
  /**
   * Build "find the better move" puzzles from both players' mistakes.
   * Off by default: from your own games, the position you actually faced is
   * the one worth re-playing, and a puzzle from the opponent's side would be
   * mislabelled as your mistake. The bundled starter pack turns it on, since
   * it has no hero.
   */
  missFromBothSides?: boolean;
  maxSolverMoves?: number;
}

/**
 * Build puzzles out of the mistakes in one analysed game.
 *
 * Two kinds come from every blunder:
 *  - "your-miss": the position you faced, with the move you failed to find;
 *  - "punish": the position after your blunder, from the other side, so you
 *    learn to spot the same pattern when an opponent allows it.
 */
export function puzzlesFromGame(game: AnalysedGame, opts: PuzzleGenOptions = {}): Puzzle[] {
  const maxSolverMoves = opts.maxSolverMoves ?? 3;
  const includePunish = opts.includePunish ?? true;
  const out: Puzzle[] = [];
  const opponentName = game.hero === 'w' ? game.meta.black : game.meta.white;

  for (const m of game.moves) {
    const isHero = m.color === game.hero;
    if (opts.heroOnly && !isHero) continue;
    if (m.verdict !== 'blunder' && m.verdict !== 'mistake') continue;

    /* ---- "you missed this" ---- */
    // Skip when several moves were about equally good: there is no clear answer
    // to grade against, which makes for a frustrating puzzle.
    const unique = m.secondBestWinLoss === null || m.secondBestWinLoss >= 8;
    const bestLine = m.bestLineSan.slice(0, playableLength(m.fenBefore, m.bestLineSan));
    if ((isHero || opts.missFromBothSides) && unique && bestLine.length >= 1) {
      const solution = trimToSolverMove(bestLine, maxSolverMoves);
      out.push({
        id: `${game.id}:${m.ply}:miss`,
        fen: m.fenBefore,
        solverColor: m.color,
        solution,
        alternates: m.alternativesSan,
        tags: m.motifs.length ? m.motifs : ['missed-material'],
        rating: estimateRating({ solution, winSwing: m.winLoss, stableFromDepth: m.stableFromDepth, tags: m.motifs }),
        origin: 'your-miss',
        gameId: game.id,
        ply: m.ply,
        prompt: isHero
          ? `${sideName(m.color)} to play. In your game you played ${m.san} here — find what you missed.`
          : `${sideName(m.color)} to play. ${m.san} was played here — find the better move.`,
        explanation: `${solution[0]} was the move. ${m.san} cost about ${m.winLoss} win-probability points. Theme: ${describeTags(m.motifs)}.`,
      });
    }

    /* ---- "punish it" ---- */
    const refLine = m.refutationSan.slice(0, playableLength(m.fenAfter, m.refutationSan));
    if (includePunish && m.winLoss >= 20 && refLine.length >= 1) {
      const solution = trimToSolverMove(refLine, maxSolverMoves);
      const solver = other(m.color);
      const whoBlundered = isHero ? 'You' : opponentName;
      out.push({
        id: `${game.id}:${m.ply}:punish`,
        fen: m.fenAfter,
        solverColor: solver,
        solution,
        alternates: [],
        tags: m.motifs.length ? m.motifs : ['missed-material'],
        rating: estimateRating({ solution, winSwing: m.winLoss, stableFromDepth: m.stableFromDepth, tags: m.motifs }),
        origin: 'punish',
        gameId: game.id,
        ply: m.ply,
        prompt: `${sideName(solver)} to play. ${whoBlundered} just played ${m.san} — punish it.`,
        explanation: `${solution.join(' ')} is the refutation. Recognising this pattern from both sides is what stops you allowing it. Theme: ${describeTags(m.motifs)}.`,
      });
    }
  }

  return out;
}

export function puzzlesFromGames(games: AnalysedGame[], opts?: PuzzleGenOptions): Puzzle[] {
  const seen = new Set<string>();
  const out: Puzzle[] = [];
  for (const g of games) {
    for (const p of puzzlesFromGame(g, opts)) {
      // One puzzle per position, keeping the first (most recent import wins).
      const key = `${p.fen}|${p.solution[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/** Does this move solve the puzzle? Accepts engine-equal alternatives. */
export function isCorrectFirstMove(puzzle: Puzzle, san: string): boolean {
  const normalise = (s: string) => s.replace(/[+#!?]/g, '');
  const target = normalise(puzzle.solution[0] ?? '');
  if (normalise(san) === target) return true;
  return puzzle.alternates.some((a) => normalise(a) === normalise(san));
}

/** The opponent's scripted reply after a correct solver move, if any. */
export function replyAfter(puzzle: Puzzle, solverMoveIndex: number): string | null {
  return puzzle.solution[solverMoveIndex * 2 + 1] ?? null;
}

export function solverMoveCount(puzzle: Puzzle): number {
  return Math.ceil(puzzle.solution.length / 2);
}

export function ratingBand(rating: number): string {
  if (rating < 900) return 'Easy';
  if (rating < 1200) return 'Beginner';
  if (rating < 1500) return 'Intermediate';
  if (rating < 1800) return 'Advanced';
  if (rating < 2100) return 'Hard';
  return 'Expert';
}
