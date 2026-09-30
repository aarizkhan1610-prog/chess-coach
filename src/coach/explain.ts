import { Chess, type Move } from 'chess.js';
import type {
  Color, Evaluation, MotifTag, MoveVerdict, PieceType, PositionAnalysis, Square,
} from '../types';
import { detectMotifs, phaseOf } from '../chess/motifs';
import { classifyMove, winLossFor } from '../chess/evaluation';
import {
  PIECE_VALUE, attacksFrom, developedMinors, findPins, findSkewers, forkTargets,
  fileOf, loosePieces, other, pawnStructure, piecesOf, seeMove, seeOnSquare, tryLoad,
  winningCaptures,
} from '../chess/board';

/*
 * Turning analysis into something a beginner can act on.
 *
 * The rest of the app already works out *that* a move was bad and assigns it a
 * motif, but a motif is a category, not an explanation: `hanging-piece` tells a
 * new player nothing. This module does two things the analysis path never
 * needed. It names the actual pieces and squares involved, so the reader can
 * look at the board and see what is being talked about, and it explains moves
 * that are *good* — the motif detector only ever fires on mistakes, so praise
 * had to be built from scratch.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

const NAME: Record<PieceType, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

/**
 * What a beginner is taught, not what the engine uses.
 *
 * `PIECE_VALUE` scores a bishop at 3.2 because that sharpens the exchange
 * evaluation. Telling someone they lost "3.2 points" is noise.
 */
const POINTS: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const CENTRE: Square[] = ['d4', 'e4', 'd5', 'e5'];
const HOME_MINORS: Record<Color, Square[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
};

function article(word: string): string {
  return 'aeiou'.includes(word[0]) ? `an ${word}` : `a ${word}`;
}

/** "knight on f3", or just "piece" when the square is empty. */
function at(chess: Chess, sq: Square): string {
  const p = chess.get(sq as never);
  return p ? `${NAME[p.type as PieceType]} on ${sq}` : 'piece';
}

function worth(type: PieceType): string {
  const n = POINTS[type];
  return `${article(NAME[type])} (${n} point${n === 1 ? '' : 's'})`;
}

/** Replay a UCI principal variation as SAN so it can be read aloud. */
function sanLine(fen: string, pv: string[], max = 6): string[] {
  const c = tryLoad(fen);
  if (!c) return [];
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined }).san);
    } catch {
      break;
    }
  }
  return out;
}

function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
  } catch {
    return null;
  }
}

/** Points of `color`'s pieces minus the opponent's, in the values above. */
function balance(chess: Chess, color: Color): number {
  let n = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = POINTS[sq.type as PieceType];
      n += sq.color === color ? v : -v;
    }
  }
  return n;
}

/**
 * What the move actually costs in material, by playing the punishment out.
 *
 * Exchange evaluation only looks at the destination square, so it cannot see a
 * fork: the rook is lost two moves later, on the other side of the board. The
 * line is cut after an even number of plies so both sides have had the same
 * number of moves and a half-finished recapture does not read as a loss.
 */
function materialCost(fenBefore: string, playedUci: string, refutationPv: string[]): number {
  const line = tryLoad(fenBefore);
  if (!line) return 0;
  const mover = line.turn() as Color;
  const start = balance(line, mover);
  if (!playUci(line, playedUci)) return 0;
  const n = Math.min(4, refutationPv.length);
  let landed: Square | null = null;
  for (const uci of refutationPv.slice(0, n)) {
    if (!playUci(line, uci)) break;
    landed = uci.slice(2, 4);
  }
  /*
   * An odd number of plies leaves an exchange half-played, which reads as a
   * loss when it was a trade. Rounding down is not the answer either: a
   * one-move line would then be dropped entirely and a hung piece would come
   * back as costing nothing. So the mover gets their recapture, if taking back
   * is actually good for them.
   */
  if (line.turn() === mover && landed) {
    const back = winningCaptures(line, 0).find((c) => c.to === landed);
    if (back) playUci(line, `${back.from}${back.to}`);
  }
  return balance(line, mover) - start;
}

function plyOf(fen: string): number {
  const parts = fen.split(' ');
  const full = Number(parts[5] ?? 1) || 1;
  return (full - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}

/* ------------------------------------------------------------------ *
 * Shape
 * ------------------------------------------------------------------ */

export type VirtueTag =
  | 'wins-material'
  | 'even-trade'
  | 'forces-mate'
  | 'answers-threat'
  | 'creates-threat'
  | 'develops'
  | 'castles'
  | 'takes-centre';

export type Tone = 'excellent' | 'good' | 'ok' | 'dubious' | 'bad' | 'losing';

export interface ExplainPoint {
  /** Machine-readable reason, so the UI can decorate without parsing prose. */
  code: MotifTag | VirtueTag | 'terminal';
  /** What happened in *this* position. Always specific, always worth reading. */
  text: string;
  /**
   * The general rule behind it, which is the same every time it fires.
   * Kept apart from `text` so the interface can teach it once and then stop:
   * hearing "openings are a race to develop" four moves running is noise.
   */
  principle?: string;
  /** Squares worth lighting up while this point is on screen. */
  squares?: Square[];
  arrow?: { from: Square; to: Square };
}

export interface Explanation {
  verdict: MoveVerdict;
  tone: Tone;
  /** One sentence. The thing to show large. */
  headline: string;
  /** Supporting detail, most important first. */
  points: ExplainPoint[];
  /** Set when a bad move still did something right, so praise is not simply lost. */
  concession: string | null;
  /** How the opponent punishes it. */
  punish: { san: string[]; uci: string[] } | null;
  /** What the coach would have played instead. */
  better: { san: string; uci: string } | null;
  /** Pawns the mover nets once the punishment lands. Negative means material lost. */
  materialSwing: number;
  motifs: MotifTag[];
  virtues: VirtueTag[];
  winLoss: number;
}

export interface ExplainInput {
  fenBefore: string;
  playedUci: string;
  /** Search of `fenBefore`. MultiPV 2 or more lets the verdict spot forced moves. */
  before: PositionAnalysis;
  /** Search of the position after the move. Null when the move ended the game. */
  after: PositionAnalysis | null;
  /**
   * The move that reached this position. Without it a recapture looks exactly
   * like winning a piece: exchange evaluation only sees the material standing
   * on the square now, not the piece that was traded for it a ply ago.
   */
  lastMove?: { to: Square; captured?: PieceType } | null;
  /**
   * Where the mover's own pieces have been this game. Without it there is no
   * way to notice the commonest opening habit of all — shuffling one piece
   * around while the rest sit at home.
   */
  moverMoves?: { from: Square; to: Square }[];
  /**
   * Beginner calibration keeps quiet about small positional drift and judges
   * mostly on material and mate. Standard uses the same bands as game review.
   */
  calibration?: 'beginner' | 'standard';
}

/* ------------------------------------------------------------------ *
 * Bands
 * ------------------------------------------------------------------ */

const BANDS = {
  // Nearly every beginner move loses a little evaluation. Applying the review
  // thresholds here would mark almost everything as an error, which teaches
  // nothing and reads as nagging.
  beginner: { dubious: 15, bad: 25, losing: 35 },
  standard: { dubious: 10, bad: 20, losing: 30 },
} as const;

/** Motifs that are about judgement rather than material. Suppressed for beginners. */
const POSITIONAL: MotifTag[] = [
  'king-safety', 'pawn-structure', 'development', 'premature-queen', 'bad-trade',
  'weak-square', 'lost-the-initiative', 'converting-advantage', 'defending-worse',
  'endgame-technique', 'time-trouble',
];

/* ------------------------------------------------------------------ *
 * Working context
 * ------------------------------------------------------------------ */

interface Ctx {
  beforeC: Chess;
  afterC: Chess;
  mover: Color;
  opp: Color;
  played: Move;
  playedSee: number;
  /** Points the mover already gave up on this square, when the move is a recapture. */
  recaptured: number;
  /** The mover's earlier moves this game, oldest first. */
  moverMoves: { from: Square; to: Square }[];
  /** The opponent's punishing move, already played on `afterRefC`. */
  ref: Move | null;
  afterRefC: Chess | null;
  refGain: number;
  best: Move | null;
  afterBestC: Chess | null;
  bestSee: number;
  evalBefore: Evaluation;
  evalAfter: Evaluation;
  winLoss: number;
  refSan: string[];
}

/* ------------------------------------------------------------------ *
 * Why a move was bad
 * ------------------------------------------------------------------ */

/**
 * Generic wording, used when the specific template cannot find concrete
 * squares to point at. Every one of these is a complete sentence on its own.
 */
const FALLBACK: Record<MotifTag, string> = {
  'hanging-piece': 'That leaves one of your pieces undefended.',
  'moved-into-attack': 'You moved a piece to a square your opponent attacks.',
  'missed-material': 'There was free material on the board and this move passed it by.',
  'allowed-fork': 'That lets one enemy piece attack two of yours at once.',
  'missed-fork': 'You had a move that attacked two pieces at once.',
  'allowed-pin': 'That lets your opponent pin one of your pieces.',
  'missed-pin': 'You had a pin available.',
  'allowed-skewer': 'That lines two of your pieces up for a skewer.',
  'discovered-attack': 'That allows a discovered attack — moving one piece uncovers another.',
  'trapped-piece': 'One of your pieces is now short of safe squares.',
  'back-rank': 'Your king is stuck on the back rank with no escape square.',
  'missed-mate': 'There was a forced checkmate here.',
  'allowed-mate': 'That allows a forced checkmate.',
  'ignored-threat': 'Your opponent was threatening something and this move does not address it.',
  'unsound-sacrifice': 'That gives up material without enough in return.',
  'king-safety': 'That loosens the squares around your own king.',
  'pawn-structure': 'That leaves your pawns weaker than they were.',
  'development': 'In the opening, bring out a new piece rather than moving one twice.',
  'premature-queen': 'The queen comes out too early here and can be chased around.',
  'bad-trade': 'That trade helps your opponent more than it helps you.',
  'weak-square': 'That hands your opponent a square your pawns can no longer contest.',
  'lost-the-initiative': 'That move is passive and lets your opponent take over.',
  'converting-advantage': 'You are winning — simplify and keep it simple.',
  'defending-worse': 'You are worse here, so look for the most stubborn defence.',
  'endgame-technique': 'Endgames reward activity: push passed pawns and use your king.',
  'time-trouble': 'That looks rushed.',
};

type Template = (c: Ctx) => ExplainPoint | null;

const VICE: Partial<Record<MotifTag, Template>> = {
  'allowed-mate': (c) => {
    const n = c.evalAfter.mate === null ? null : Math.abs(c.evalAfter.mate);
    const line = c.refSan.slice(0, 4).join(' ');
    return {
      code: 'allowed-mate',
      text: n
        ? `That allows checkmate in ${n}: ${line}.`
        : `That allows a forced checkmate: ${line}.`,
      arrow: c.ref ? { from: c.ref.from, to: c.ref.to } : undefined,
    };
  },

  'missed-mate': (c) => {
    if (!c.best) return null;
    const n = c.evalBefore.mate === null ? null : Math.abs(c.evalBefore.mate);
    return {
      code: 'missed-mate',
      text: n === 1
        ? `${c.best.san} was checkmate on the spot.`
        : `You had a forced checkmate here, starting with ${c.best.san}.`,
      arrow: { from: c.best.from, to: c.best.to },
    };
  },

  'hanging-piece': (c) => {
    if (!c.ref || !c.ref.captured) return null;
    const victim = c.ref.captured as PieceType;
    return {
      code: 'hanging-piece',
      text: `Your ${at(c.afterC, c.ref.to)} has nothing defending it. Your opponent plays ${c.ref.san} and wins ${worth(victim)}.`,
      squares: [c.ref.to],
      arrow: { from: c.ref.from, to: c.ref.to },
    };
  },

  'moved-into-attack': (c) => {
    if (!c.ref || !c.ref.captured) return null;
    return {
      code: 'moved-into-attack',
      text: `${c.played.to} is covered by your opponent's ${at(c.afterC, c.ref.from)}. ${c.ref.san} takes your ${NAME[c.played.piece as PieceType]} straight back.`,
      squares: [c.played.to, c.ref.from],
      arrow: { from: c.ref.from, to: c.ref.to },
    };
  },

  'missed-material': (c) => {
    if (!c.best || !c.best.captured) return null;
    return {
      code: 'missed-material',
      text: `${c.best.san} was there: it wins ${worth(c.best.captured as PieceType)} and you cannot be punished for it.`,
      squares: [c.best.to],
      arrow: { from: c.best.from, to: c.best.to },
    };
  },

  'allowed-fork': (c) => {
    if (!c.ref || !c.afterRefC) return null;
    const hits = forkTargets(c.afterRefC, c.ref.to);
    if (hits.length < 2) return null;
    const named = hits.slice(0, 2).map((s) => `your ${at(c.afterRefC as Chess, s)}`);
    return {
      code: 'allowed-fork',
      text: `${c.ref.san} forks ${named.join(' and ')} — one piece attacking two at once. You can only save one of them.`,
      squares: [c.ref.to, ...hits.slice(0, 2)],
      arrow: { from: c.ref.from, to: c.ref.to },
    };
  },

  'allowed-pin': (c) => {
    if (!c.ref || !c.afterRefC) return null;
    const had = new Set(findPins(c.afterC, c.mover).map((p) => `${p.front}>${p.back}`));
    const fresh = findPins(c.afterRefC, c.mover).find((p) => !had.has(`${p.front}>${p.back}`));
    if (!fresh) return null;
    return {
      code: 'allowed-pin',
      text: `${c.ref.san} pins your ${at(c.afterRefC, fresh.front)} against your ${at(c.afterRefC, fresh.back)} — it cannot move without losing the piece behind it.`,
      squares: [fresh.attacker, fresh.front, fresh.back],
    };
  },

  'allowed-skewer': (c) => {
    if (!c.ref || !c.afterRefC) return null;
    const had = new Set(findSkewers(c.afterC, c.mover).map((p) => `${p.front}>${p.back}`));
    const fresh = findSkewers(c.afterRefC, c.mover).find((p) => !had.has(`${p.front}>${p.back}`));
    if (!fresh) return null;
    return {
      code: 'allowed-skewer',
      text: `${c.ref.san} lines up your ${at(c.afterRefC, fresh.front)} and your ${at(c.afterRefC, fresh.back)}. When the front one moves, the one behind it drops.`,
      squares: [fresh.attacker, fresh.front, fresh.back],
    };
  },

  'trapped-piece': (c) => {
    if (!c.afterRefC) return null;
    for (const p of piecesOf(c.afterRefC, c.mover)) {
      if (p.type === 'k' || p.type === 'p') continue;
      const attackers = c.afterRefC.attackers(p.square as never, c.opp);
      if (!attackers.length) continue;
      const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[(c.afterRefC?.get(a as never)?.type ?? 'p') as PieceType]));
      if (cheapest >= PIECE_VALUE[p.type]) continue;
      return {
        code: 'trapped-piece',
        text: `Your ${at(c.afterRefC, p.square)} runs out of safe squares after ${c.ref?.san ?? 'the reply'}.`,
        squares: [p.square],
      };
    }
    return null;
  },

  'back-rank': (c) => {
    if (!c.ref) return null;
    return {
      code: 'back-rank',
      text: `Your king has no square to step to, so ${c.ref.san} lands on the back rank with nothing to stop it.`,
      squares: [c.ref.to],
      arrow: { from: c.ref.from, to: c.ref.to },
    };
  },

  'ignored-threat': (c) => {
    const threats = loosePieces(c.beforeC, c.mover, 1.2);
    const t = threats[0];
    if (!t) return null;
    return {
      code: 'ignored-threat',
      text: `Your opponent was already threatening ${t.san}, winning ${worth(t.victim)}. This move does nothing about it.`,
      squares: [t.to],
    };
  },

  'unsound-sacrifice': (c) => ({
    code: 'unsound-sacrifice',
    text: `That hands over ${Math.abs(Math.round(c.playedSee))} points of material, and there is no way to win it back.`,
    squares: [c.played.to],
  }),

  'premature-queen': (c) => ({
    code: 'premature-queen',
    text: `Your queen on ${c.played.to} is going to get chased around.`,
    principle: 'Bring the queen out late. It is the piece you can least afford to lose, so every enemy piece that attacks it gains a free move while you run.',
    squares: [c.played.to],
  }),

  'development': (c) => (c.best
    ? {
      code: 'development',
      text: `Nothing new came out. ${c.best.san} is the kind of move to look for here.`,
      principle: 'In the opening, prefer a move that brings a new piece into the game over one that moves a piece you have already developed.',
      arrow: { from: c.best.from, to: c.best.to },
    }
    : null),

  'pawn-structure': (c) => {
    const s0 = pawnStructure(c.beforeC, c.mover);
    const s1 = pawnStructure(c.afterC, c.mover);
    const what = s1.doubled > s0.doubled ? 'doubled' : s1.isolated > s0.isolated ? 'isolated' : s1.backward > s0.backward ? 'backward' : null;
    if (!what) return null;
    return {
      code: 'pawn-structure',
      text: `That leaves you with ${what} pawns.`,
      principle: 'Pawns are the only pieces that cannot move backwards, so a pawn weakness is permanent. Think before you push one.',
    };
  },
};

/* ------------------------------------------------------------------ *
 * Why a move was good
 * ------------------------------------------------------------------ */

function detectVirtues(c: Ctx): ExplainPoint[] {
  const out: ExplainPoint[] = [];
  const opening = phaseOf(c.beforeC.fen(), plyOf(c.beforeC.fen())) === 'opening';

  // Mate first: nothing else matters next to it.
  const mateFor = c.evalAfter.mate !== null && (c.mover === 'w' ? c.evalAfter.mate > 0 : c.evalAfter.mate < 0);
  if (mateFor) {
    out.push({
      code: 'forces-mate',
      text: `That forces checkmate in ${Math.abs(c.evalAfter.mate as number)} — your opponent cannot stop it.`,
    });
  }

  if (c.played.captured) {
    const taken = c.played.captured as PieceType;
    const net = POINTS[taken] - c.recaptured;
    const safe = c.afterC.attackers(c.played.to as never, c.opp).length === 0;
    if (c.playedSee >= 0.8 && net > 0) {
      out.push({
        code: 'wins-material',
        text: safe
          ? `That wins ${worth(taken)}, and nothing can take it back.`
          : `That wins ${worth(taken)} — your opponent can recapture, but you still come out ahead.`,
        principle: 'Before you take, count the attackers and the defenders. If you have more, the capture wins material.',
        squares: [c.played.to],
      });
    } else if (c.recaptured > 0) {
      out.push({
        code: 'even-trade',
        text: net === 0
          ? `That takes the ${NAME[taken]} back, so the trade comes out even.`
          : 'That recaptures, but you gave up more than you got back.',
        principle: 'Trading is fine when the pieces are worth the same. Count both sides of the exchange, not just what you capture.',
        squares: [c.played.to],
      });
    }
  }

  // A threat that existed before the move and does not survive it.
  const threatsBefore = loosePieces(c.beforeC, c.mover, 1.2);
  if (threatsBefore.length) {
    const stillThere = new Set(winningCaptures(c.afterC, 1.2).map((t) => t.to));
    const answered = threatsBefore.find((t) => !stillThere.has(t.to));
    if (answered) {
      out.push({
        code: 'answers-threat',
        text: `That deals with ${answered.san}, which was going to win ${worth(answered.victim)}.`,
        squares: [answered.to],
      });
    }
  }

  // A threat that did not exist before and does now.
  {
    const had = new Set(loosePieces(c.beforeC, c.opp, 1.2).map((t) => t.to));
    const fresh = loosePieces(c.afterC, c.opp, 1.2)
      // It is the opponent's move, so a "threat" from a piece they can simply
      // take is not a threat. Announcing one teaches exactly the wrong habit.
      .find((t) => !had.has(t.to) && seeOnSquare(c.afterC, t.from) < 0.8);
    if (fresh) {
      out.push({
        code: 'creates-threat',
        text: `Now you are threatening ${fresh.san}, winning ${worth(fresh.victim)}.`,
        squares: [fresh.to],
      });
    }
  }

  if (c.played.flags.includes('k') || c.played.flags.includes('q')) {
    out.push({
      code: 'castles',
      text: `Your king is tucked away on ${c.played.to}, and your rook comes into the game.`,
      principle: 'Castle early. The middle of the board is where the game opens up, and that is the last place a king wants to be.',
      squares: [c.played.to],
    });
  } else if (opening && (c.played.piece === 'n' || c.played.piece === 'b') && HOME_MINORS[c.mover].includes(c.played.from)) {
    out.push({
      code: 'develops',
      text: `That brings your ${NAME[c.played.piece as PieceType]} out to ${c.played.to}. You have ${developedMinors(c.afterC, c.mover)} of your four knights and bishops in play now.`,
      principle: 'The opening is a race to get your pieces off the back rank. A piece still sitting at home is a piece not helping.',
      squares: [c.played.to],
    });
  }

  if (c.played.piece === 'p' && CENTRE.includes(c.played.to)) {
    out.push({
      code: 'takes-centre',
      text: `Your pawn takes ${c.played.to}, one of the four squares in the middle of the board.`,
      principle: 'Fight for the centre. A piece in the middle reaches far more squares than one on the edge, so whoever owns the centre has the freer game.',
      squares: [c.played.to],
    });
  } else if (c.played.piece !== 'p' && c.played.piece !== 'k') {
    const gained = attacksFrom(c.afterC, c.played.to).filter((s) => CENTRE.includes(s)).length;
    const had = attacksFrom(c.beforeC, c.played.from).filter((s) => CENTRE.includes(s)).length;
    if (gained >= 2 && gained > had) {
      out.push({
        code: 'takes-centre',
        text: `From ${c.played.to} your ${NAME[c.played.piece as PieceType]} covers ${gained} of the four centre squares.`,
        squares: [c.played.to],
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Opening habits the evaluation is too forgiving about
 * ------------------------------------------------------------------ */

function canCastle(fen: string, color: Color): boolean {
  const rights = fen.split(' ')[2] ?? '-';
  return color === 'w' ? /[KQ]/.test(rights) : /[kq]/.test(rights);
}

/**
 * Soft notes on moves the engine barely minds but a beginner should not play.
 *
 * Giving up castling costs a fraction of a pawn, which is nothing next to the
 * thresholds that decide a move is a mistake — so a king step in the opening
 * reads as "nothing wrong with that" from the evaluation alone. For a learner
 * being taught king safety, that answer is worse than useless. These do not
 * change how severe the move is called; they replace a bland verdict with a
 * specific one.
 */
function cautions(c: Ctx): ExplainPoint[] {
  const out: ExplainPoint[] = [];
  if (phaseOf(c.beforeC.fen(), plyOf(c.beforeC.fen())) !== 'opening') return out;
  const castled = c.played.flags.includes('k') || c.played.flags.includes('q');

  if (!castled && canCastle(c.beforeC.fen(), c.mover) && !canCastle(c.afterC.fen(), c.mover)) {
    out.push({
      code: 'king-safety',
      text: c.played.piece === 'k'
        ? `Moving the king to ${c.played.to} gives up the right to castle, and it is still sitting in the middle of the board.`
        : `Moving that rook gives up the right to castle on one side.`,
      principle: 'Castling is the fastest way to get the king somewhere safe. Once you move the king or a rook, that option is gone for good.',
      squares: [c.played.to],
    });
  }

  if (
    c.played.piece !== 'p'
    && c.played.piece !== 'k'
    && developedMinors(c.beforeC, c.mover) < 4
    && c.moverMoves.some((m) => m.to === c.played.from)
  ) {
    out.push({
      code: 'development',
      text: `That ${NAME[c.played.piece as PieceType]} has already moved once, and you still have pieces sitting at home.`,
      principle: 'In the opening, move each piece once. A second move for a piece already in play is a move your opponent spends on a piece that is not.',
      squares: [c.played.to],
    });
  }

  const file = fileOf(c.played.to);
  if (c.played.piece === 'p' && (file === 0 || file === 7) && developedMinors(c.beforeC, c.mover) < 2) {
    out.push({
      code: 'development',
      text: `A pawn on the edge does not fight for the centre or let any of your pieces out.`,
      principle: 'Rook pawns are the least useful moves in the opening. With pieces still at home, almost anything else does more.',
      squares: [c.played.to],
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function explainMove(i: ExplainInput): Explanation {
  const calibration = i.calibration ?? 'beginner';
  const bands = BANDS[calibration];

  const beforeC = new Chess(i.fenBefore);
  const mover = beforeC.turn() as Color;
  const opp = other(mover);

  const afterC = new Chess(i.fenBefore);
  const played = playUci(afterC, i.playedUci);
  if (!played) throw new Error(`explainMove: ${i.playedUci} is not legal in ${i.fenBefore}`);

  /* The game may already be over, in which case there is no search to read. */
  if (afterC.isCheckmate()) {
    return terminal(played, 'Checkmate. That is the game — well played.', 'excellent', 'best');
  }
  if (afterC.isStalemate()) {
    return terminal(
      played,
      'Stalemate: your opponent has no legal move and is not in check, so the game is a draw. Watch for this when you are winning — leave the enemy king a square.',
      'bad',
      'mistake',
    );
  }
  if (afterC.isDraw()) {
    return terminal(played, 'That ends the game in a draw.', 'ok', 'good');
  }

  const evalBefore = i.before.lines[0]?.evaluation ?? { cp: 0, mate: null };
  const evalAfter = i.after?.lines[0]?.evaluation ?? { cp: 0, mate: null };
  const bestPv = i.before.lines[0]?.pv ?? [];
  const refutationPv = i.after?.lines[0]?.pv ?? [];
  const winLoss = winLossFor(evalBefore, evalAfter, mover);

  const afterRefC = refutationPv[0] ? new Chess(afterC.fen()) : null;
  const ref = afterRefC && refutationPv[0] ? playUci(afterRefC, refutationPv[0]) : null;
  const afterBestC = bestPv[0] ? new Chess(i.fenBefore) : null;
  const best = afterBestC && bestPv[0] ? playUci(afterBestC, bestPv[0]) : null;

  const playedSee = seeMove(beforeC, { from: played.from, to: played.to, promotion: played.promotion });
  const refGain = ref ? seeMove(afterC, { from: ref.from, to: ref.to, promotion: ref.promotion }) : 0;

  const recaptured = i.lastMove?.to === played.to && i.lastMove?.captured
    ? POINTS[i.lastMove.captured]
    : 0;

  const ctx: Ctx = {
    beforeC, afterC, mover, opp, played, playedSee, recaptured,
    moverMoves: i.moverMoves ?? [],
    ref, afterRefC, refGain,
    best, afterBestC,
    bestSee: best ? seeMove(beforeC, { from: best.from, to: best.to, promotion: best.promotion }) : 0,
    evalBefore, evalAfter, winLoss,
    refSan: sanLine(afterC.fen(), refutationPv),
  };

  const motifs = detectMotifs({
    fenBefore: i.fenBefore,
    fenAfter: afterC.fen(),
    playedUci: i.playedUci,
    mover,
    bestPv,
    refutationPv,
    evalBefore,
    evalAfter,
    winLoss,
    phase: phaseOf(i.fenBefore, plyOf(i.fenBefore)),
    secondsSpent: null,
    clockRemaining: null,
    timeControlBase: null,
  });

  const materialSwing = materialCost(i.fenBefore, i.playedUci, refutationPv);
  const virtues = detectVirtues(ctx);

  /*
   * Tone. Material and mate lead, because those are the things a beginner can
   * verify for themselves by looking at the board; the evaluation is a number
   * they have no way to check.
   */
  let tone: Tone;
  // Forcing mate settles it. Material is irrelevant next to the king, and the
  // most instructive moves in chess are the ones that give up a queen to mate.
  if (virtues.some((v) => v.code === 'forces-mate')) tone = 'excellent';
  else if (motifs.includes('allowed-mate') || materialSwing <= -3 || winLoss >= bands.losing) tone = 'losing';
  else if (materialSwing <= -1.5 || winLoss >= bands.bad) tone = 'bad';
  else if (winLoss >= bands.dubious) tone = 'dubious';
  else if (winLoss < 2 && bestPv[0] === i.playedUci) tone = 'excellent';
  else if (winLoss < 5) tone = 'good';
  else tone = 'ok';

  const bad = tone === 'dubious' || tone === 'bad' || tone === 'losing';

  /*
   * Praise is only offered once the vices have had their say. Without this the
   * coach cheerfully congratulates you for developing a knight to a square
   * where it is taken for free.
   */
  let points: ExplainPoint[];
  let concession: string | null = null;

  if (bad) {
    const shown = calibration === 'beginner' && winLoss < 25
      ? motifs.filter((m) => !POSITIONAL.includes(m))
      : motifs;
    const list = shown.length ? shown : motifs;
    points = list
      .map((tag) => VICE[tag]?.(ctx) ?? { code: tag, text: FALLBACK[tag] })
      .filter((p): p is ExplainPoint => Boolean(p))
      .slice(0, 2);
    if (!points.length) {
      // No motif fired, so say the one thing that is always concrete and
      // checkable. A bare pair of SAN moves means nothing to a beginner.
      points = [{
        code: 'lost-the-initiative',
        text: materialSwing <= -1
          ? `This costs material: after ${ctx.refSan[0] ?? 'the best reply'} you are ${Math.abs(Math.round(materialSwing))} points down.`
          : ref
            ? `Your opponent takes over after ${ref.san}.`
            : 'There was more to be had from this position.',
      }];
    }
    const kind = virtues.find((v) => v.code === 'develops' || v.code === 'castles' || v.code === 'takes-centre');
    if (kind) concession = kind.text;
  } else {
    // Praise first, then anything worth a word of warning, and only then the
    // bland answer — which should be rare, because it teaches nothing.
    points = [...virtues, ...cautions(ctx)].slice(0, 2);
    if (!points.length) {
      points = motifs
        .map((tag) => VICE[tag]?.(ctx) ?? { code: tag, text: FALLBACK[tag] })
        .filter((p): p is ExplainPoint => Boolean(p))
        .slice(0, 1);
      // If the only thing worth saying about a move is what is wrong with it,
      // it is not a good move, whatever the evaluation thinks. A warning
      // printed under the word "Good" reads as a bug and is ignored.
      if (points.length && (tone === 'excellent' || tone === 'good')) tone = 'ok';
    }
    if (!points.length) {
      points = [{
        code: 'lost-the-initiative',
        text: bestPv[0] === i.playedUci
          ? 'That is the best move in the position.'
          : 'Nothing wrong with that — it keeps the position healthy without changing much.',
      }];
    }
  }

  const verdict = classifyMove({
    winLoss,
    winPctBefore: mover === 'w' ? winPct(evalBefore) : 100 - winPct(evalBefore),
    playedIsBest: bestPv[0] === i.playedUci,
    secondBestWinLoss: i.before.lines[1]
      ? winLossFor(evalBefore, i.before.lines[1].evaluation, mover)
      : null,
    legalMoveCount: beforeC.moves().length,
    isSacrifice: playedSee <= -1.5 && winLoss < 10,
    inBook: false,
  });

  return {
    verdict,
    tone,
    headline: points[0].text,
    points,
    concession,
    punish: bad && ctx.refSan.length ? { san: ctx.refSan, uci: refutationPv } : null,
    better: bad && best ? { san: best.san, uci: bestPv[0] } : null,
    materialSwing,
    motifs,
    virtues: virtues.map((v) => v.code as VirtueTag),
    winLoss,
  };
}

function winPct(e: Evaluation): number {
  if (e.mate !== null) return e.mate > 0 ? 100 : 0;
  const cp = Math.max(-1500, Math.min(1500, e.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function terminal(played: Move, text: string, tone: Tone, verdict: MoveVerdict): Explanation {
  return {
    verdict,
    tone,
    headline: text,
    points: [{ code: 'terminal', text, squares: [played.to] }],
    concession: null,
    punish: null,
    better: null,
    materialSwing: 0,
    motifs: [],
    virtues: [],
    winLoss: 0,
  };
}
