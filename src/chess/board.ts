import { Chess } from 'chess.js';
import type { Color, PieceType, Square } from '../types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 100 };

export function fileOf(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}
export function rankOf(sq: Square): number {
  return sq.charCodeAt(1) - 49;
}
export function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}`;
}
export function other(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

const KNIGHT_DELTAS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_DELTAS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export function slideDirs(type: PieceType): number[][] {
  if (type === 'r') return ROOK_DIRS;
  if (type === 'b') return BISHOP_DIRS;
  if (type === 'q') return [...ROOK_DIRS, ...BISHOP_DIRS];
  return [];
}

/**
 * Squares the piece on `sq` attacks, regardless of whose turn it is and
 * regardless of whether moving there would be legal (pins are ignored).
 * chess.js only generates moves for the side to move, so we need our own
 * attack map to reason about the opponent's pieces.
 */
export function attacksFrom(chess: Chess, sq: Square): Square[] {
  const piece = chess.get(sq as never);
  if (!piece) return [];
  const f = fileOf(sq);
  const r = rankOf(sq);
  const out: Square[] = [];

  if (piece.type === 'p') {
    const dr = piece.color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const t = toSquare(f + df, r + dr);
      if (t) out.push(t);
    }
    return out;
  }
  if (piece.type === 'n') {
    for (const [df, dr] of KNIGHT_DELTAS) {
      const t = toSquare(f + df, r + dr);
      if (t) out.push(t);
    }
    return out;
  }
  if (piece.type === 'k') {
    for (const [df, dr] of KING_DELTAS) {
      const t = toSquare(f + df, r + dr);
      if (t) out.push(t);
    }
    return out;
  }
  for (const [df, dr] of slideDirs(piece.type)) {
    let cf = f + df;
    let cr = r + dr;
    while (true) {
      const t = toSquare(cf, cr);
      if (!t) break;
      out.push(t);
      if (chess.get(t as never)) break; // blocked, but the blocker itself is attacked
      cf += df;
      cr += dr;
    }
  }
  return out;
}

export function piecesOf(chess: Chess, color: Color): { square: Square; type: PieceType }[] {
  const out: { square: Square; type: PieceType }[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.color === color) out.push({ square: cell.square, type: cell.type as PieceType });
    }
  }
  return out;
}

export function kingSquare(chess: Chess, color: Color): Square | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && cell.type === 'k') return cell.square;
    }
  }
  return null;
}

/** Rewrite a FEN so `color` is to move, clearing the en-passant square. */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  return parts.join(' ');
}

/** Load a FEN without validation, returning null when chess.js rejects it. */
export function tryLoad(fen: string): Chess | null {
  try {
    const c = new Chess();
    c.load(fen, { skipValidation: true } as never);
    return c;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Static exchange evaluation
 * ------------------------------------------------------------------ */

/**
 * Material the side to move wins by starting a capture sequence on `target`,
 * in pawn units. Plays the real capture sequence with legal move generation,
 * so x-rays, pins and overloaded defenders are handled for free. Either side
 * may stop capturing when continuing would lose material, hence the max(0).
 */
export function seeOnSquare(chess: Chess, target: Square, guard = 0): number {
  if (guard > 12) return 0;
  const caps = chess
    .moves({ verbose: true })
    .filter((m) => m.to === target && (m.captured !== undefined || m.flags.includes('e')))
    // A king is never a capture target in a legal game; seeing one means we are
    // reasoning about a position with the turn artificially flipped.
    .filter((m) => m.captured !== 'k');
  if (!caps.length) return 0;

  caps.sort((a, b) => PIECE_VALUE[a.piece as PieceType] - PIECE_VALUE[b.piece as PieceType]);
  const m = caps[0];
  const gained =
    (m.captured ? PIECE_VALUE[m.captured as PieceType] : 0) +
    (m.promotion ? PIECE_VALUE[m.promotion as PieceType] - PIECE_VALUE.p : 0);

  const next = tryLoad(chess.fen());
  if (!next) return 0;
  try {
    next.move({ from: m.from, to: m.to, promotion: m.promotion });
  } catch {
    return 0;
  }
  return Math.max(0, gained - seeOnSquare(next, target, guard + 1));
}

/** Net material for the mover after all recaptures on the destination square. */
export function seeMove(
  chess: Chess,
  move: { from: Square; to: Square; promotion?: string },
): number {
  const next = tryLoad(chess.fen());
  if (!next) return 0;
  let played;
  try {
    played = next.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return 0;
  }
  const gained =
    (played.captured ? PIECE_VALUE[played.captured as PieceType] : 0) +
    (played.promotion ? PIECE_VALUE[played.promotion as PieceType] - PIECE_VALUE.p : 0);
  return gained - seeOnSquare(next, move.to, 0);
}

/**
 * Captures available to the side to move that win material outright.
 * `minGain` is in pawn units.
 */
export function winningCaptures(chess: Chess, minGain = 0.8) {
  const out: { from: Square; to: Square; san: string; gain: number; victim: PieceType }[] = [];
  for (const m of chess.moves({ verbose: true })) {
    if (!m.captured && !m.flags.includes('e')) continue;
    if (m.captured === 'k') continue;
    const gain = seeMove(chess, { from: m.from, to: m.to, promotion: m.promotion });
    if (gain >= minGain) {
      out.push({ from: m.from, to: m.to, san: m.san, gain, victim: (m.captured ?? 'p') as PieceType });
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/**
 * Pieces of `color` that the opponent could profitably capture right now.
 * Needs the opponent on move, so the turn is flipped on a copy; positions
 * where that is illegal (the opponent would be in check) yield nothing.
 */
export function loosePieces(chess: Chess, color: Color, minGain = 0.8) {
  const flipped = tryLoad(withTurn(chess.fen(), other(color)));
  if (!flipped || flipped.inCheck()) return [];
  // If `color` is the one in check, handing the move to the opponent would let
  // them "capture the king" — an illegal position we must not reason about.
  const ks = kingSquare(flipped, color);
  if (!ks || flipped.isAttacked(ks as never, other(color))) return [];
  return winningCaptures(flipped, minGain);
}

/* ------------------------------------------------------------------ *
 * Tactical geometry
 * ------------------------------------------------------------------ */

export interface Alignment {
  attacker: Square;
  attackerType: PieceType;
  front: Square;
  frontType: PieceType;
  back: Square;
  backType: PieceType;
}

/**
 * Every line where an enemy slider looks at two of `victim`'s pieces in a row.
 * A pin is an alignment whose back piece is worth more (classically, the king);
 * a skewer is the reverse.
 */
export function findAlignments(chess: Chess, victim: Color): Alignment[] {
  const out: Alignment[] = [];
  for (const attacker of piecesOf(chess, other(victim))) {
    for (const [df, dr] of slideDirs(attacker.type)) {
      let cf = fileOf(attacker.square) + df;
      let cr = rankOf(attacker.square) + dr;
      let front: { square: Square; type: PieceType } | null = null;
      while (true) {
        const t = toSquare(cf, cr);
        if (!t) break;
        const occ = chess.get(t as never);
        if (occ) {
          if (occ.color !== victim) break;
          if (!front) {
            front = { square: t, type: occ.type as PieceType };
          } else {
            out.push({
              attacker: attacker.square,
              attackerType: attacker.type,
              front: front.square,
              frontType: front.type,
              back: t,
              backType: occ.type as PieceType,
            });
            break;
          }
        }
        cf += df;
        cr += dr;
      }
    }
  }
  return out;
}

export function findPins(chess: Chess, victim: Color): Alignment[] {
  return findAlignments(chess, victim).filter(
    (a) => PIECE_VALUE[a.backType] > PIECE_VALUE[a.frontType] && PIECE_VALUE[a.attackerType] <= PIECE_VALUE[a.backType],
  );
}

export function findSkewers(chess: Chess, victim: Color): Alignment[] {
  return findAlignments(chess, victim).filter((a) => PIECE_VALUE[a.frontType] > PIECE_VALUE[a.backType] && a.frontType !== 'p');
}

/**
 * Targets the piece on `from` attacks that are worth taking: the enemy king,
 * or an enemy piece worth at least a knight that cannot be adequately met.
 * Two or more such targets is a fork.
 */
export function forkTargets(chess: Chess, from: Square, minValue = 3): Square[] {
  const piece = chess.get(from as never);
  if (!piece) return [];
  const attackerValue = PIECE_VALUE[piece.type as PieceType];
  const out: Square[] = [];
  for (const t of attacksFrom(chess, from)) {
    const occ = chess.get(t as never);
    if (!occ || occ.color === piece.color) continue;
    if (occ.type === 'k') {
      out.push(t);
      continue;
    }
    const value = PIECE_VALUE[occ.type as PieceType];
    if (value < minValue) continue;
    // Winning a defended piece still counts when the attacker is cheaper.
    const defended = chess.attackers(t as never, occ.color).length > 0;
    if (!defended || value > attackerValue + 0.5) out.push(t);
  }
  return out;
}

/** Squares around the king that the opponent attacks, plus the king's escapes. */
export function kingExposure(chess: Chess, color: Color): { attacked: number; escapes: number; shieldHoles: number } {
  const ks = kingSquare(chess, color);
  if (!ks) return { attacked: 0, escapes: 0, shieldHoles: 0 };
  const f = fileOf(ks);
  const r = rankOf(ks);
  let attacked = 0;
  let escapes = 0;
  for (const [df, dr] of KING_DELTAS) {
    const t = toSquare(f + df, r + dr);
    if (!t) continue;
    const hit = chess.attackers(t as never, other(color)).length > 0;
    if (hit) attacked++;
    const occ = chess.get(t as never);
    if (!hit && (!occ || occ.color !== color)) escapes++;
  }
  // Missing pawns on the three files in front of the king.
  const dr = color === 'w' ? 1 : -1;
  let shieldHoles = 0;
  for (const df of [-1, 0, 1]) {
    let found = false;
    for (let step = 1; step <= 2; step++) {
      const t = toSquare(f + df, r + dr * step);
      if (!t) continue;
      const occ = chess.get(t as never);
      if (occ && occ.type === 'p' && occ.color === color) found = true;
    }
    if (!found) shieldHoles++;
  }
  return { attacked, escapes, shieldHoles };
}

/** King stuck on its back rank behind its own unmoved pawns with no escape. */
export function hasBackRankRisk(chess: Chess, color: Color): boolean {
  const ks = kingSquare(chess, color);
  if (!ks) return false;
  const homeRank = color === 'w' ? 0 : 7;
  if (rankOf(ks) !== homeRank) return false;
  const f = fileOf(ks);
  const dr = color === 'w' ? 1 : -1;
  let blocked = 0;
  let squares = 0;
  for (const df of [-1, 0, 1]) {
    const t = toSquare(f + df, homeRank + dr);
    if (!t) continue;
    squares++;
    const occ = chess.get(t as never);
    if (occ && occ.color === color) blocked++;
  }
  if (squares === 0 || blocked < squares) return false;
  // A heavy enemy piece must be able to reach the back rank for it to matter.
  const heavies = piecesOf(chess, other(color)).filter((p) => p.type === 'r' || p.type === 'q');
  return heavies.length > 0;
}

export function pawnStructure(chess: Chess, color: Color) {
  const pawns = piecesOf(chess, color).filter((p) => p.type === 'p');
  const byFile = new Map<number, number[]>();
  for (const p of pawns) {
    const f = fileOf(p.square);
    byFile.set(f, [...(byFile.get(f) ?? []), rankOf(p.square)]);
  }
  let isolated = 0;
  let doubled = 0;
  let backward = 0;
  for (const [f, ranks] of byFile) {
    if (ranks.length > 1) doubled += ranks.length - 1;
    const hasNeighbour = byFile.has(f - 1) || byFile.has(f + 1);
    if (!hasNeighbour) isolated += ranks.length;
    else {
      // Behind every friendly pawn on both adjacent files => backward.
      const neighbourRanks = [...(byFile.get(f - 1) ?? []), ...(byFile.get(f + 1) ?? [])];
      for (const r of ranks) {
        const ahead = color === 'w' ? neighbourRanks.every((n) => n > r) : neighbourRanks.every((n) => n < r);
        if (ahead && neighbourRanks.length) backward++;
      }
    }
  }
  return { isolated, doubled, backward, count: pawns.length };
}

export function developedMinors(chess: Chess, color: Color): number {
  const home = color === 'w' ? ['b1', 'c1', 'f1', 'g1'] : ['b8', 'c8', 'f8', 'g8'];
  let developed = 0;
  for (const sq of home) {
    const occ = chess.get(sq as never);
    if (!occ || occ.color !== color || (occ.type !== 'n' && occ.type !== 'b')) developed++;
  }
  return developed;
}

/** Non-pawn, non-king material on the board, in pawn units, both sides. */
export function heavyMaterial(chess: Chess): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type !== 'p' && cell.type !== 'k') total += PIECE_VALUE[cell.type as PieceType];
    }
  }
  return Math.round(total * 10) / 10;
}
