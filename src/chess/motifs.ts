import { Chess } from 'chess.js';
import type { Color, Evaluation, MotifTag, Phase, PieceType, Square } from '../types';
import { winPctFor } from './evaluation';
import {
  PIECE_VALUE, attacksFrom, developedMinors, findPins, findSkewers, forkTargets,
  hasBackRankRisk, heavyMaterial, kingExposure, kingSquare, loosePieces, other,
  pawnStructure, piecesOf, rankOf, fileOf, seeMove, toSquare,
} from './board';

export interface MotifInput {
  fenBefore: string;
  fenAfter: string;
  playedUci: string;
  mover: Color;
  /** Engine's preferred line from fenBefore, in UCI. */
  bestPv: string[];
  /** Engine's preferred line from fenAfter — how the opponent punishes the move. */
  refutationPv: string[];
  evalBefore: Evaluation;
  evalAfter: Evaluation;
  winLoss: number;
  phase: Phase;
  secondsSpent: number | null;
  clockRemaining: number | null;
  timeControlBase: number | null;
}

/** Most specific first: when a move earns many tags we keep the informative ones. */
const CAUSE_PRIORITY: MotifTag[] = [
  'allowed-mate', 'missed-mate', 'back-rank',
  'hanging-piece', 'moved-into-attack', 'missed-material',
  'allowed-fork', 'allowed-pin', 'allowed-skewer', 'discovered-attack', 'trapped-piece',
  'missed-fork', 'missed-pin', 'ignored-threat', 'unsound-sacrifice',
  'king-safety', 'weak-square', 'bad-trade', 'pawn-structure',
  'premature-queen', 'development', 'lost-the-initiative',
];

const CONTEXT_TAGS: MotifTag[] = ['converting-advantage', 'defending-worse', 'endgame-technique', 'time-trouble'];

function playUci(chess: Chess, uci: string) {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
  } catch {
    return null;
  }
}

function clone(fen: string): Chess {
  return new Chess(fen);
}

function pinKeys(chess: Chess, victim: Color): Set<string> {
  return new Set(findPins(chess, victim).map((p) => `${p.front}>${p.back}`));
}
function skewerKeys(chess: Chess, victim: Color): Set<string> {
  return new Set(findSkewers(chess, victim).map((p) => `${p.front}>${p.back}`));
}

/** Valuable pieces of `victim` that `by` attacks, keyed by attacker square. */
function attackMap(chess: Chess, by: Color, victim: Color): Map<Square, Square[]> {
  const map = new Map<Square, Square[]>();
  for (const p of piecesOf(chess, by)) {
    const hits = attacksFrom(chess, p.square).filter((t) => {
      const occ = chess.get(t as never);
      return occ && occ.color === victim && PIECE_VALUE[occ.type as PieceType] >= 3;
    });
    if (hits.length) map.set(p.square, hits);
  }
  return map;
}

/** A knight the mover's pawns can never challenge, sitting in the mover's half. */
function isOutpost(chess: Chess, sq: Square, owner: Color): boolean {
  const piece = chess.get(sq as never);
  if (!piece || piece.type !== 'n' || piece.color !== owner) return false;
  const victim = other(owner);
  const r = rankOf(sq);
  const inVictimHalf = victim === 'w' ? r <= 4 : r >= 3;
  if (!inVictimHalf) return false;
  // Could any victim pawn ever advance to attack this square?
  const f = fileOf(sq);
  const dir = victim === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    for (let step = 1; step <= 6; step++) {
      const t = toSquare(f + df, r - dir * step);
      if (!t) break;
      const occ = chess.get(t as never);
      if (occ && occ.type === 'p' && occ.color === victim) return false;
      if (occ) break;
    }
  }
  return true;
}

/** Is a piece of `owner` on `sq` unable to reach any square where it is not lost? */
function isTrapped(chess: Chess, sq: Square, owner: Color): boolean {
  const piece = chess.get(sq as never);
  if (!piece || piece.color !== owner || piece.type === 'k' || piece.type === 'p') return false;
  if (chess.turn() !== owner) return false;
  const value = PIECE_VALUE[piece.type as PieceType];
  const attackers = chess.attackers(sq as never, other(owner));
  if (!attackers.length) return false;
  // Only interesting when a cheaper piece is doing the attacking.
  const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[(chess.get(a as never)?.type ?? 'p') as PieceType]));
  if (cheapest >= value) return false;

  const escapes = chess.moves({ square: sq as never, verbose: true });
  for (const m of escapes) {
    if (seeMove(chess, { from: m.from, to: m.to, promotion: m.promotion }) >= -0.5) return false;
  }
  // Being defended well enough to survive also counts as not trapped.
  return escapes.length > 0 || attackers.length > 0;
}

export function detectMotifs(i: MotifInput): MotifTag[] {
  const causes = new Set<MotifTag>();
  const context = new Set<MotifTag>();

  const before = clone(i.fenBefore);
  const after = clone(i.fenAfter);
  const mover = i.mover;
  const opp = other(mover);

  const playedFrom = i.playedUci.slice(0, 2);
  const playedTo = i.playedUci.slice(2, 4);
  const playedPiece = before.get(playedFrom as never);
  const playedSee = seeMove(before, { from: playedFrom, to: playedTo, promotion: i.playedUci.slice(4, 5) || undefined });

  const wpBefore = winPctFor(i.evalBefore, mover);
  const wpAfter = winPctFor(i.evalAfter, mover);

  /* ---------------- mate ---------------- */
  const mateAgainst = (e: Evaluation) => e.mate !== null && (mover === 'w' ? e.mate < 0 : e.mate > 0);
  const mateFor = (e: Evaluation) => e.mate !== null && (mover === 'w' ? e.mate > 0 : e.mate < 0);
  if (mateAgainst(i.evalAfter) && !mateAgainst(i.evalBefore)) causes.add('allowed-mate');
  if (mateFor(i.evalBefore) && !mateFor(i.evalAfter)) causes.add('missed-mate');

  /* ---------------- how the opponent punishes it ---------------- */
  const refUci = i.refutationPv[0];
  if (refUci) {
    const afterRef = clone(i.fenAfter);
    const ref = playUci(afterRef, refUci);
    if (ref) {
      const refGain = seeMove(after, { from: ref.from, to: ref.to, promotion: ref.promotion });

      if ((ref.captured || ref.flags.includes('e')) && refGain >= 1.2) {
        if (ref.to === playedTo) causes.add('moved-into-attack');
        else causes.add('hanging-piece');
      }

      if (forkTargets(afterRef, ref.to).length >= 2) causes.add('allowed-fork');

      const pinsBefore = pinKeys(after, mover);
      for (const key of pinKeys(afterRef, mover)) if (!pinsBefore.has(key)) causes.add('allowed-pin');
      const skewersBefore = skewerKeys(after, mover);
      for (const key of skewerKeys(afterRef, mover)) if (!skewersBefore.has(key)) causes.add('allowed-skewer');

      // Discovery: a piece other than the one that moved gains a new target.
      const mapBefore = attackMap(after, opp, mover);
      const mapAfter = attackMap(afterRef, opp, mover);
      for (const [from, hits] of mapAfter) {
        if (from === ref.to) continue;
        const prior = mapBefore.get(from) ?? [];
        if (hits.some((h) => !prior.includes(h))) causes.add('discovered-attack');
      }

      if (afterRef.isCheckmate() || (ref.san.includes('+') && hasBackRankRisk(after, mover))) {
        const homeRank = mover === 'w' ? 0 : 7;
        if (rankOf(ref.to) === homeRank && hasBackRankRisk(after, mover)) causes.add('back-rank');
      }

      for (const p of piecesOf(afterRef, mover)) {
        if (isTrapped(afterRef, p.square, mover)) { causes.add('trapped-piece'); break; }
      }

      if (isOutpost(afterRef, ref.to, opp)) causes.add('weak-square');

      // The same shot was already on the board before this move.
      const priorThreats = loosePieces(before, mover, 1.2);
      if (priorThreats.some((t) => t.to === ref.to) && refGain >= 1.2) causes.add('ignored-threat');
    }
  }

  /* ---------------- what the mover missed ---------------- */
  const bestUci = i.bestPv[0];
  if (bestUci && bestUci !== i.playedUci) {
    const afterBest = clone(i.fenBefore);
    const best = playUci(afterBest, bestUci);
    if (best) {
      const bestGain = seeMove(before, { from: best.from, to: best.to, promotion: best.promotion });
      if ((best.captured || best.flags.includes('e')) && bestGain >= 1.2 && playedSee < bestGain - 0.8) {
        causes.add('missed-material');
      }
      if (forkTargets(afterBest, best.to).length >= 2) causes.add('missed-fork');
      const oppPinsNow = pinKeys(before, opp);
      for (const key of pinKeys(afterBest, opp)) if (!oppPinsNow.has(key)) causes.add('missed-pin');

      // Opening guidance: the engine wanted a developing move and got a shuffle.
      if (i.phase === 'opening' && developedMinors(before, mover) < 3) {
        const bestDevelops = best.piece === 'n' || best.piece === 'b' || best.flags.includes('k') || best.flags.includes('q');
        const playedDevelops = playedPiece?.type === 'n' || playedPiece?.type === 'b';
        const playedCastles = i.playedUci === 'e1g1' || i.playedUci === 'e1c1' || i.playedUci === 'e8g8' || i.playedUci === 'e8c8';
        if (bestDevelops && !playedDevelops && !playedCastles) causes.add('development');
      }
    }
  }

  /* ---------------- self-inflicted problems ---------------- */
  if (playedSee <= -1.5 && i.winLoss >= 12) causes.add('unsound-sacrifice');

  if (playedPiece?.type === 'q' && i.phase === 'opening' && developedMinors(before, mover) <= 1 && i.winLoss >= 8) {
    causes.add('premature-queen');
  }

  {
    const kBefore = kingExposure(before, mover);
    const kAfter = kingExposure(after, mover);
    const worse = kAfter.attacked - kBefore.attacked >= 2 || kAfter.shieldHoles > kBefore.shieldHoles;
    if (worse && i.winLoss >= 10) causes.add('king-safety');
    // Moving a pawn in front of your own king is the classic version.
    const ks = kingSquare(before, mover);
    if (ks && playedPiece?.type === 'p' && Math.abs(fileOf(playedFrom) - fileOf(ks)) <= 1 && i.winLoss >= 10) {
      const nearKing = Math.abs(rankOf(playedFrom) - rankOf(ks)) <= 2;
      if (nearKing && kAfter.shieldHoles > kBefore.shieldHoles) causes.add('king-safety');
    }
  }

  {
    const sBefore = pawnStructure(before, mover);
    const sAfter = pawnStructure(after, mover);
    const worse =
      sAfter.isolated > sBefore.isolated || sAfter.doubled > sBefore.doubled || sAfter.backward > sBefore.backward;
    if (worse && i.winLoss >= 10) causes.add('pawn-structure');
  }

  // An even-looking trade that quietly hands over the position.
  if (playedPiece && (before.get(playedTo as never) || i.playedUci.length > 4) && Math.abs(playedSee) < 0.6 && i.winLoss >= 12) {
    causes.add('bad-trade');
  }

  /* ---------------- fallback ---------------- */
  if (!causes.size && i.winLoss >= 10) {
    const quiet = !before.get(playedTo as never) && !after.inCheck();
    if (quiet && wpBefore >= 50) causes.add('lost-the-initiative');
    else if (i.phase === 'opening') causes.add('development');
    else if (i.phase === 'endgame') causes.add('endgame-technique');
    else causes.add('lost-the-initiative');
  }

  /* ---------------- context ---------------- */
  if (wpBefore >= 70 && wpAfter < 60) context.add('converting-advantage');
  if (wpBefore <= 35 && i.winLoss >= 15) context.add('defending-worse');
  if (i.phase === 'endgame' && i.winLoss >= 12 && heavyMaterial(before) <= 16) context.add('endgame-technique');
  {
    const rushed = i.secondsSpent !== null && i.secondsSpent <= 2.5 && i.winLoss >= 15;
    const lowClock =
      i.clockRemaining !== null && i.timeControlBase !== null && i.clockRemaining < Math.max(15, i.timeControlBase * 0.1);
    if (rushed || (lowClock && i.winLoss >= 12)) context.add('time-trouble');
  }

  const orderedCauses = CAUSE_PRIORITY.filter((t) => causes.has(t)).slice(0, 2);
  const orderedContext = CONTEXT_TAGS.filter((t) => context.has(t)).slice(0, 2);
  return [...orderedCauses, ...orderedContext];
}

/** Opening / middlegame / endgame from material and move number. */
export function phaseOf(fen: string, ply: number): Phase {
  const c = new Chess(fen);
  const material = heavyMaterial(c);
  if (material <= 16) return 'endgame';
  if (ply < 20 && material >= 52) return 'opening';
  if (ply < 12) return 'opening';
  return 'middlegame';
}
