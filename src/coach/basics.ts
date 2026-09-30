import { Chess } from 'chess.js';
import { other, withTurn } from '../chess/board';
import type { Color, PieceType, Square } from '../types';

/*
 * Learning the pieces.
 *
 * Every drill is a real chess position, which is the only way the board can
 * answer back honestly — but that means both kings must be on the board, since
 * chess.js will not load a position without them. They are parked away from the
 * action, and `tests/basics.test.ts` checks every claim made here: that each
 * position is legal, that each task can actually be completed, and that the
 * stated solution completes it.
 *
 * Nothing here uses the engine. A first lesson should not wait on a 1.7 MB
 * download, and none of these questions need a search to answer.
 */

export type DrillGoal =
  /** One of your pieces ends up on this square. */
  | { kind: 'reach'; square: Square }
  /** Nothing of the opponent's is left but the king. */
  | { kind: 'captureAll' }
  /** The opponent is checkmated. */
  | { kind: 'mate' }
  /** Your king is no longer in check. */
  | { kind: 'escape' }
  /** You have a piece you did not start with. */
  | { kind: 'promote' };

export interface Drill {
  id: string;
  /** The instruction, in one line. */
  task: string;
  fen: string;
  goal: DrillGoal;
  /** Squares to mark as the objective. */
  mark?: Square[];
  /** Shown after a move that does not finish the job. */
  hint: string;
  /** Shown on success. */
  done: string;
  /** A move list that completes it, in SAN. Verified by the tests. */
  solution: string[];
  orientation?: Color;
}

export interface Tour {
  id: string;
  /** Sidebar and contents label. */
  title: string;
  /** One line under the title. */
  lede: string;
  piece?: PieceType;
  /** Read before the drills. Two or three short paragraphs. */
  read: string[];
  /** A position that shows the piece's reach, with the piece on `from`. */
  showFen?: string;
  showFrom?: Square;
  drills: Drill[];
}

/* ------------------------------------------------------------------ *
 * The pieces
 * ------------------------------------------------------------------ */

export const TOURS: Tour[] = [
  {
    id: 'pawn',
    title: 'The pawn',
    lede: 'The only piece that cannot go backwards.',
    piece: 'p',
    read: [
      'Pawns move straight forward, one square at a time. On its very first move a pawn may go two squares instead, which is why the game opens so quickly.',
      'They capture differently from how they move: straight ahead they are blocked by anything in the way, but they take one square diagonally forward. A pawn standing nose to nose with another pawn cannot take it, and neither can move.',
      'A pawn that reaches the far end of the board is replaced — almost always by a queen. A pawn is worth one point and a queen nine, so that single moment decides a lot of games.',
    ],
    showFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    showFrom: 'e2',
    drills: [
      {
        id: 'pawn-capture',
        task: 'Take a black pawn. Only one of the two can be taken.',
        fen: '8/6k1/8/3pp3/3P4/8/8/6K1 w - - 0 1',
        goal: { kind: 'reach', square: 'e5' },
        mark: ['e5'],
        hint: 'The pawn directly in front of yours blocks it. Pawns capture on the diagonal.',
        done: 'That is the only capture there was. Straight ahead a pawn is blocked; diagonally it takes.',
        solution: ['dxe5'],
      },
      {
        id: 'pawn-promote',
        task: 'Walk the pawn to the end of the board and promote it.',
        fen: '8/6k1/8/1P6/8/8/8/6K1 w - - 0 1',
        goal: { kind: 'promote' },
        mark: ['b8'],
        hint: 'Keep pushing. Three squares to go.',
        done: 'A pawn worth one point just became a queen worth nine.',
        solution: ['b6', 'b7', 'b8=Q'],
      },
    ],
  },

  {
    id: 'knight',
    title: 'The knight',
    lede: 'Moves in an L, and jumps over everything.',
    piece: 'n',
    read: [
      'The knight moves two squares in one direction and then one square at a right angle — an L shape. It is the only piece that does not travel in a straight line.',
      'It is also the only piece that jumps. Nothing blocks a knight: it ignores whatever is standing between where it starts and where it lands, friend or enemy.',
      'A knight always lands on the opposite colour from the one it left. That is worth knowing, because it means a knight can never attack something twice in a row from the same square, and a knight on the rim reaches only four squares instead of eight.',
    ],
    showFen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1',
    showFrom: 'd4',
    drills: [
      {
        id: 'knight-jump',
        task: 'Every square around the knight is blocked by your own pawns. Land it on e5.',
        fen: '7k/8/8/8/2PPP3/2PNP3/2PPP3/7K w - - 0 1',
        goal: { kind: 'reach', square: 'e5' },
        mark: ['e5'],
        hint: 'Knights jump. The pawns are not in the way.',
        done: 'Nothing can block a knight. It is the only piece you can trap and still not stop.',
        solution: ['Ne5'],
      },
      {
        id: 'knight-travel',
        task: 'Bring the knight all the way to c5.',
        fen: '7k/8/8/8/8/8/8/N6K w - - 0 1',
        goal: { kind: 'reach', square: 'c5' },
        mark: ['c5'],
        hint: 'Two squares one way, one square across. It will take more than one move.',
        done: 'Knights are slow across open ground — that is the price of jumping.',
        solution: ['Nb3', 'Nc5'],
      },
    ],
  },

  {
    id: 'bishop',
    title: 'The bishop',
    lede: 'Diagonals only, and one colour for the whole game.',
    piece: 'b',
    read: [
      'Bishops move diagonally, as far as they like, until something stops them. They cannot jump.',
      'Because every diagonal step keeps a square the same colour, a bishop never changes colour. The one that starts on a light square will be on a light square when the game ends. Half the board is permanently out of its reach.',
      'That is why the two bishops together are worth more than the sum of their parts: between them they cover everything.',
    ],
    showFen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
    showFrom: 'd4',
    drills: [
      {
        id: 'bishop-both',
        task: 'Take both black pawns.',
        fen: 'k7/8/7p/8/5p2/8/8/2B4K w - - 0 1',
        goal: { kind: 'captureAll' },
        mark: ['f4', 'h6'],
        hint: 'Both pawns sit on dark squares, and so does your bishop. Take the near one first.',
        done: 'Both pawns were on the bishop’s colour. Anything on the other colour would have been untouchable.',
        solution: ['Bxf4', 'Bxh6'],
      },
    ],
  },

  {
    id: 'rook',
    title: 'The rook',
    lede: 'Straight lines, and the second most valuable piece.',
    piece: 'r',
    read: [
      'Rooks move in straight lines: along a rank or up and down a file, as far as they like, until something blocks them.',
      'A rook is worth about five pawns, behind only the queen. They are slow to bring into the game, which is part of why castling matters — it is the one move that develops a rook for free.',
      'Rooks are strongest on open files, where no pawn stands in the way, and along the opponent’s second rank.',
    ],
    showFen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
    showFrom: 'd4',
    drills: [
      {
        id: 'rook-both',
        task: 'Take both black pawns.',
        fen: '3k4/8/8/p3p3/8/8/8/R6K w - - 0 1',
        goal: { kind: 'captureAll' },
        mark: ['a5', 'e5'],
        hint: 'Up the file first, then straight across the rank.',
        done: 'Up a file, along a rank. A rook never needs a diagonal.',
        solution: ['Rxa5', 'Rxe5'],
      },
    ],
  },

  {
    id: 'queen',
    title: 'The queen',
    lede: 'A rook and a bishop in one piece.',
    piece: 'q',
    read: [
      'The queen moves like a rook and a bishop together: straight lines and diagonals, any distance. She is worth about nine pawns, more than a rook and a bishop combined.',
      'That value is also the catch. A queen is the piece you can least afford to lose, so she is the easiest one to chase around — every enemy piece that attacks her gains a free move while you run.',
      'Bring her out once the smaller pieces are already doing something, not before.',
    ],
    showFen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
    showFrom: 'd4',
    drills: [
      {
        id: 'queen-both',
        task: 'Take both black pawns.',
        fen: '1k6/8/8/8/3p3p/8/8/Q6K w - - 0 1',
        goal: { kind: 'captureAll' },
        mark: ['d4', 'h4'],
        hint: 'One of them is on a diagonal from the queen, the other is along a rank.',
        done: 'A diagonal, then a rank. Only the queen can do both.',
        solution: ['Qxd4', 'Qxh4'],
      },
    ],
  },

  {
    id: 'king',
    title: 'The king',
    lede: 'One square at a time, and the whole game depends on it.',
    piece: 'k',
    read: [
      'The king moves one square in any direction. It is slow, but it is the piece the game is about: you never capture a king, you trap it.',
      'When a king is attacked it is in check, and you must deal with it immediately — move the king, block the attack, or take the attacker. If none of those is possible, that is checkmate and the game is over.',
      'You may never move into check, and you may never leave your king in check. In the endgame, once most pieces are gone, the king turns into a strong attacking piece in its own right.',
    ],
    showFen: '4k3/8/8/8/3K4/8/8/8 w - - 0 1',
    showFrom: 'd4',
    drills: [
      {
        id: 'king-escape',
        task: 'Your king is in check. Get out of it.',
        fen: '4r3/3k4/8/8/8/8/8/4K3 w - - 0 1',
        goal: { kind: 'escape' },
        hint: 'The rook attacks the whole e-file. Step off it.',
        done: 'Out of check. When there is nothing to block with and nothing to capture, the king moves.',
        solution: ['Kd2'],
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * The rules that catch people out
 * ------------------------------------------------------------------ */

export const RULES: Tour[] = [
  {
    id: 'checkmate',
    title: 'Checkmate',
    lede: 'How the game is actually won.',
    read: [
      'Checkmate is check that cannot be answered: the king is attacked, it has nowhere legal to go, the attacker cannot be captured, and nothing can be put in the way.',
      'Notice that none of that requires having more pieces. A player with a queen more can still be checkmated, which is why king safety matters more than material.',
    ],
    drills: [
      {
        id: 'mate-backrank',
        task: 'Checkmate in one move.',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        goal: { kind: 'mate' },
        hint: 'The black king is hemmed in by its own pawns. Which square can your rook reach along the back rank?',
        done: 'That is the back-rank mate. The king was trapped by its own pawns, not by yours.',
        solution: ['Ra8#'],
      },
    ],
  },

  {
    id: 'stalemate',
    title: 'Stalemate',
    lede: 'The draw that ruins winning positions.',
    read: [
      'If the player to move has no legal move at all and is not in check, the game is a draw. That is stalemate, and it counts as half a point even for the player who was losing badly.',
      'It is the commonest way a beginner throws away a win. With a queen against a lone king it is very easy to take every square away at once and accidentally end the game.',
      'The position shown here is stalemate: it is Black to move, the king is not in check, and every square it could go to is covered. The cure is simple — before a move that hems the king in, check whether it still has somewhere to go.',
    ],
    showFen: 'k7/8/1Q6/8/8/8/8/6K1 b - - 0 1',
    drills: [],
  },

  {
    id: 'castling',
    title: 'Castling',
    lede: 'Two pieces, one move.',
    read: [
      'Castling moves the king two squares towards a rook, and hops that rook over to the other side of it. It is the only move where two of your pieces move at once.',
      'It is allowed only if neither the king nor that rook has moved, the squares between them are empty, and the king is not in check and does not pass through or land on an attacked square.',
      'It does two jobs: the king leaves the middle of the board, and a rook that would otherwise sit in the corner for twenty moves joins the game.',
    ],
    drills: [
      {
        id: 'castle-short',
        task: 'Castle on the kingside — move the king two squares towards the rook on h1.',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        goal: { kind: 'reach', square: 'g1' },
        mark: ['g1'],
        hint: 'Move the king from e1 to g1. The rook comes to f1 by itself.',
        done: 'King safe in the corner, rook off the edge and into the game.',
        solution: ['O-O'],
      },
    ],
  },

  {
    id: 'en-passant',
    title: 'En passant',
    lede: 'The rule nobody believes the first time.',
    read: [
      'A pawn on its starting square may advance two squares. If doing so takes it straight past an enemy pawn that could have captured it on the way, that enemy pawn may take it anyway — landing on the square it skipped.',
      'The capture is only available on the very next move. Wait one turn and the chance is gone for good.',
      'It exists so the two-square first move cannot be used to sneak a pawn past an opponent untouched.',
    ],
    drills: [
      {
        id: 'ep-take',
        task: 'Black has just played the d-pawn two squares. Take it in passing.',
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        goal: { kind: 'reach', square: 'd6' },
        mark: ['d6'],
        hint: 'Your pawn captures onto d6 — the square the black pawn skipped over.',
        done: 'The black pawn is gone, and yours is on the square it tried to run past.',
        solution: ['exd6'],
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Drill mechanics
 * ------------------------------------------------------------------ */

export interface Advance {
  fen: string;
  /** The opponent's forced reply, when they had to answer a check. */
  reply: string | null;
  /** Whether that reply was the king moving, rather than a block or a capture. */
  replyIsKing: boolean;
  over: 'mate' | 'stalemate' | null;
}

/**
 * Play the learner's move and hand the position back to them.
 *
 * In these drills the enemy pieces are furniture: the turn is simply given
 * back, so a target stays where it is while the learner works out how to
 * reach it. The one exception is check — a king cannot be left standing in it,
 * and a position where the side not to move is in check is not a legal FEN, so
 * it steps aside. That is the rule being taught anyway.
 */
export function advance(fen: string, move: { from: string; to: string; promotion?: string }): Advance | null {
  const board = new Chess(fen);
  const mover = board.turn() as Color;
  try {
    board.move(move);
  } catch {
    return null;
  }

  if (board.isCheckmate()) return { fen: board.fen(), reply: null, replyIsKing: false, over: 'mate' };
  if (board.isStalemate()) return { fen: board.fen(), reply: null, replyIsKing: false, over: 'stalemate' };

  if (board.inCheck()) {
    const legal = board.moves({ verbose: true });
    // Prefer the king stepping away: it is the answer to check these drills are
    // teaching, and blocking or capturing would need explaining in its own
    // right. Whichever it turns out to be, say which so the caption is true.
    const escape = legal.find((m) => m.piece === 'k') ?? legal[0];
    if (!escape) return { fen: board.fen(), reply: null, replyIsKing: false, over: 'mate' };
    board.move(escape);
    return { fen: board.fen(), reply: escape.san, replyIsKing: escape.piece === 'k', over: null };
  }

  return { fen: withTurn(board.fen(), mover), reply: null, replyIsKing: false, over: null };
}

/** Count of everything `color` has on the board, by type. */
function census(board: Chess, color: Color): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of board.board()) {
    for (const sq of row) {
      if (sq && sq.color === color) out[sq.type] = (out[sq.type] ?? 0) + 1;
    }
  }
  return out;
}

export function goalMet(startFen: string, fen: string, goal: DrillGoal, mover: Color): boolean {
  const board = new Chess(fen);
  switch (goal.kind) {
    case 'reach': {
      const piece = board.get(goal.square as never);
      return Boolean(piece && piece.color === mover);
    }
    case 'captureAll': {
      const theirs = census(board, other(mover));
      return Object.entries(theirs).every(([type, n]) => type === 'k' || n === 0);
    }
    case 'mate':
      return board.isCheckmate() && board.turn() !== mover;
    case 'escape':
      return board.turn() === mover && !board.inCheck();
    case 'promote': {
      const before = census(new Chess(startFen), mover);
      const now = census(board, mover);
      return (['q', 'r', 'b', 'n'] as const).some((t) => (now[t] ?? 0) > (before[t] ?? 0));
    }
  }
}

export const ALL_BASICS: Tour[] = [...TOURS, ...RULES];

export function findBasic(id: string): Tour | undefined {
  return ALL_BASICS.find((t) => t.id === id);
}
