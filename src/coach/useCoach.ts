import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { getEngine } from '../engine/uci';
import { explainMove, type Explanation } from './explain';
import type { Color, PositionAnalysis } from '../types';

/*
 * A board you can experiment on.
 *
 * The learner plays whatever they like and is told what it does, then decides
 * whether to keep it. That decision is the whole point: a tutorial that only
 * accepts the right move teaches obedience, and one that accepts anything
 * without comment teaches nothing.
 *
 * Explaining a move costs two searches — the position before it and the
 * position after. The first is started the moment the position appears, while
 * the learner is still looking at the board, so by the time they commit only
 * the second is left to wait for.
 */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type CoachPhase =
  /** Waiting for the learner. */
  | 'yours'
  /** Working out what their move did. */
  | 'thinking'
  /** Explanation on screen; they choose to keep it or take it back. */
  | 'verdict'
  /** The opponent is replying. */
  | 'theirs'
  /** Checkmate, stalemate or a draw. */
  | 'over';

export interface CoachOptions {
  startFen?: string;
  /** Which side the learner plays. 'both' lets them move the pieces freely. */
  userSide?: Color | 'both';
  /** Stockfish handicap for the replies, 0 to 20. */
  opponentSkill?: number;
  /**
   * Supply the reply instead of the engine, in SAN. Returning null falls back
   * to the engine, which is how a scripted game copes with going off-script.
   */
  opponentMove?: (fen: string, history: string[]) => string | null;
  /** Search depth for the coaching. 12 is about 40ms a move and plenty here. */
  depth?: number;
}

export interface CoachApi {
  fen: string;
  /** What the board should show, which during a punishment preview is not `fen`. */
  shownFen: string;
  turn: Color;
  phase: CoachPhase;
  lastMove: { from: string; to: string } | null;
  history: string[];
  explanation: Explanation | null;
  /** True while the punishment is being played out on the board. */
  previewing: boolean;
  /** The move under consideration, in SAN. */
  candidate: string | null;
  /** True when the move under consideration ends the game. */
  endsGame: boolean;
  result: string | null;
  tryMove: (move: { from: string; to: string; promotion?: string }) => void;
  /** Commits the move under consideration. False when there was nothing to commit. */
  keep: () => boolean;
  undo: () => void;
  togglePunishment: () => void;
  reset: () => void;
}

interface Snapshot {
  fen: string;
  lastMove: { from: string; to: string } | null;
}

export function useCoach(options: CoachOptions = {}): CoachApi {
  const {
    startFen = START,
    userSide = 'w',
    opponentSkill = 3,
    opponentMove,
    depth = 12,
  } = options;

  const engine = getEngine();

  const [fen, setFen] = useState(startFen);
  const [phase, setPhase] = useState<CoachPhase>('yours');
  const [lastMove, setLastMove] = useState<Snapshot['lastMove']>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [endsGame, setEndsGame] = useState(false);

  /** Where `undo` returns to. */
  const before = useRef<Snapshot | null>(null);
  /** The last move played into the current position, for recapture detection. */
  const incoming = useRef<{ to: string; captured?: string } | null>(null);
  /** The learner's own moves, kept so a piece moved twice can be spotted. */
  const mine = useRef<{ from: string; to: string }[]>([]);
  /** The move awaiting a decision, promoted into `mine` only if it is kept. */
  const pending = useRef<{ from: string; to: string } | null>(null);
  /** Analysis of the current position, started as soon as it appears. */
  const prefetch = useRef<{ fen: string; job: Promise<PositionAnalysis | null> } | null>(null);
  const alive = useRef(true);

  /**
   * The phase, readable synchronously.
   *
   * React state is a render behind, so two clicks landing in the same batch
   * both see the phase they were rendered with and both commit the move —
   * which appends the opponent's reply twice and leaves a scripted game a move
   * ahead of the board. The same reason `Board` keeps its drag origin in a ref.
   */
  const phaseRef = useRef<CoachPhase>('yours');
  const move = useCallback((next: CoachPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /**
   * Bumped whenever the position is rewound or restarted. Analysis already in
   * flight belongs to a move that no longer exists, and writing its verdict
   * would leave a card on screen describing a move that is not on the board.
   */
  const generation = useRef(0);

  /*
   * Set on the way in as well as cleared on the way out. React runs mount,
   * cleanup, mount in development, so a ref that is only ever cleared stays
   * false for the rest of the component's life and every result is discarded.
   */
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const analyse = useCallback(
    (target: string): Promise<PositionAnalysis | null> =>
      engine.analyse(target, { depth, multipv: 2 }).catch(() => null),
    [engine, depth],
  );

  /* Warm the current position while the learner thinks about it. */
  useEffect(() => {
    if (phase !== 'yours') return;
    if (prefetch.current?.fen === fen) return;
    prefetch.current = { fen, job: analyse(fen) };
  }, [fen, phase, analyse]);

  const finishIfOver = useCallback((board: Chess): boolean => {
    if (board.isCheckmate()) {
      setResult(board.turn() === 'w' ? 'Black wins by checkmate.' : 'White wins by checkmate.');
    } else if (board.isStalemate()) {
      setResult('Draw by stalemate.');
    } else if (board.isDraw()) {
      setResult('Draw.');
    } else {
      return false;
    }
    move('over');
    return true;
  }, []);

  const playOpponent = useCallback(async (fenNow: string, hist: string[]) => {
    const board = new Chess(fenNow);
    let reply: Move | null = null;

    const scripted = opponentMove?.(fenNow, hist);
    if (scripted) {
      try { reply = board.move(scripted); } catch { reply = null; }
    }
    if (!reply) {
      const analysis = await engine
        .analyse(fenNow, { depth: 8, multipv: 1, skill: opponentSkill })
        .catch(() => null);
      const uci = analysis?.lines[0]?.pv[0];
      if (uci) {
        try {
          reply = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
        } catch { reply = null; }
      }
    }
    if (!alive.current) return;
    if (!reply) { move('yours'); return; }

    incoming.current = { to: reply.to, captured: reply.captured };
    setFen(board.fen());
    setLastMove({ from: reply.from, to: reply.to });
    setHistory((h) => [...h, reply!.san]);
    if (!finishIfOver(board)) move('yours');
  }, [engine, opponentMove, opponentSkill, finishIfOver, move]);

  const tryMove = useCallback((wanted: { from: string; to: string; promotion?: string }) => {
    if (phaseRef.current !== 'yours') return;

    const board = new Chess(fen);
    let played: Move;
    try {
      played = board.move(wanted);
    } catch {
      return;
    }
    const gen = ++generation.current;

    const fenBefore = fen;
    const snapshot: Snapshot = { fen: fenBefore, lastMove };
    const incomingNow = incoming.current;

    const over = board.isCheckmate() || board.isStalemate() || board.isDraw();
    before.current = snapshot;
    pending.current = { from: played.from, to: played.to };
    setCandidate(played.san);
    setEndsGame(over);
    move('thinking');
    // Show the move straight away. Waiting for the engine before the piece
    // lands makes the board feel broken, however short the wait is.
    setFen(board.fen());
    setLastMove({ from: played.from, to: played.to });

    (async () => {
      const pre = prefetch.current?.fen === fenBefore ? prefetch.current.job : analyse(fenBefore);
      const [beforeAnalysis, afterAnalysis] = await Promise.all([
        pre,
        over ? Promise.resolve(null) : analyse(board.fen()),
      ]);
      if (!alive.current || generation.current !== gen) return;
      if (!beforeAnalysis) { move('verdict'); setExplanation(null); return; }

      try {
        setExplanation(explainMove({
          fenBefore,
          playedUci: `${played.from}${played.to}${played.promotion ?? ''}`,
          before: beforeAnalysis,
          after: afterAnalysis,
          lastMove: incomingNow
            ? { to: incomingNow.to, captured: incomingNow.captured as never }
            : null,
          moverMoves: [...mine.current],
        }));
      } catch {
        setExplanation(null);
      }
      move('verdict');
    })();
  }, [fen, lastMove, analyse, move]);

  const keep = useCallback((): boolean => {
    if (phaseRef.current !== 'verdict') return false;
    generation.current += 1;
    const board = new Chess(fen);
    const hist = candidate ? [...history, candidate] : history;
    setHistory(hist);
    setExplanation(null);
    setCandidate(null);
    setPreview(null);
    setEndsGame(false);
    if (pending.current) mine.current = [...mine.current, pending.current];
    pending.current = null;
    before.current = null;
    incoming.current = null;

    if (finishIfOver(board)) return true;
    if (userSide !== 'both' && board.turn() !== userSide) {
      move('theirs');
      void playOpponent(fen, hist);
      return true;
    }
    move('yours');
    return true;
  }, [fen, candidate, history, userSide, finishIfOver, playOpponent, move]);

  const undo = useCallback(() => {
    const snapshot = before.current;
    if (!snapshot) return;
    generation.current += 1;
    setFen(snapshot.fen);
    setLastMove(snapshot.lastMove);
    setExplanation(null);
    setCandidate(null);
    setPreview(null);
    setEndsGame(false);
    pending.current = null;
    before.current = null;
    move('yours');
  }, [move]);

  /*
   * Play the punishment out rather than naming it. For a beginner, watching
   * the knight disappear lands harder than a sentence saying it will.
   */
  const togglePunishment = useCallback(() => {
    const line = explanation?.punish?.uci;
    if (!line?.length) return;
    const board = new Chess(fen);
    for (const uci of line.slice(0, 2)) {
      try {
        board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      } catch {
        break;
      }
    }
    // Read the current value rather than closing over it: the handler is bound
    // at render, and a hover that fires first would leave it stale.
    setPreview((showing) => (showing ? null : board.fen()));
  }, [explanation, fen]);

  const reset = useCallback(() => {
    generation.current += 1;
    setFen(startFen);
    move('yours');
    setLastMove(null);
    setHistory([]);
    setExplanation(null);
    setCandidate(null);
    setPreview(null);
    setResult(null);
    setEndsGame(false);
    before.current = null;
    incoming.current = null;
    pending.current = null;
    mine.current = [];
    prefetch.current = null;
  }, [startFen, move]);

  return {
    fen,
    shownFen: preview ?? fen,
    turn: new Chess(fen).turn() as Color,
    phase,
    lastMove,
    history,
    explanation,
    previewing: preview !== null,
    candidate,
    endsGame,
    result,
    tryMove,
    keep,
    undo,
    togglePunishment,
    reset,
  };
}
