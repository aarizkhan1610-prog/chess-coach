import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type BoardHighlight } from './Board';
import { advance, goalMet, type Drill } from '../coach/basics';
import type { Color } from '../types';

/**
 * One task, one board, no engine.
 *
 * Wrong moves are not rejected — they are simply not the answer, and the task
 * stays on screen until it is done. Blocking the move would teach the shape of
 * the drill rather than the shape of the piece.
 */
export function DrillBoard({ drill, onSolved }: { drill: Drill; onSolved: () => void }) {
  const mover = new Chess(drill.fen).turn() as Color;

  const [fen, setFen] = useState(drill.fen);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setFen(drill.fen);
    setLastMove(null);
    setTries(0);
    setSolved(false);
    setNote(null);
    setShowing(false);
  }, [drill]);

  useEffect(() => { reset(); }, [reset]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onMove(m: { from: string; to: string; promotion?: string }) {
    if (solved || showing) return;
    const next = advance(fen, m);
    if (!next) return;

    setFen(next.fen);
    setLastMove({ from: m.from, to: m.to });
    const n = tries + 1;
    setTries(n);

    if (goalMet(drill.fen, next.fen, drill.goal, mover)) {
      setSolved(true);
      setNote(drill.done);
      onSolved();
      return;
    }
    if (next.over === 'stalemate') setNote('That is stalemate — no legal move, but no check either, so the game is a draw.');
    else if (next.over === 'mate') setNote('That is checkmate.');
    else if (next.reply) setNote(`That was check, so the king stepped away with ${next.reply}.`);
    else setNote(n >= 2 ? drill.hint : null);
  }

  /** Walk through the answer a move at a time, so it can be followed. */
  function showSolution() {
    if (showing) return;
    setShowing(true);
    setNote(null);
    let current = drill.fen;
    setFen(current);
    setLastMove(null);

    const step = (i: number) => {
      if (i >= drill.solution.length) {
        setNote('That is the idea. Try it yourself now.');
        // Hold the finished position long enough to read, then hand the board
        // back at the start — otherwise "try it yourself" appears over a board
        // where the task is already done.
        timer.current = setTimeout(() => {
          setFen(drill.fen);
          setLastMove(null);
          setShowing(false);
        }, 1400);
        return;
      }
      const probe = new Chess(current);
      let played;
      try {
        played = probe.move(drill.solution[i]);
      } catch {
        setShowing(false);
        return;
      }
      const next = advance(current, { from: played.from, to: played.to, promotion: played.promotion });
      if (!next) { setShowing(false); return; }
      current = next.fen;
      setFen(current);
      setLastMove({ from: played.from, to: played.to });
      timer.current = setTimeout(() => step(i + 1), 900);
    };
    timer.current = setTimeout(() => step(0), 400);
  }

  const highlights: BoardHighlight[] = solved
    ? []
    : (drill.mark ?? []).map((square) => ({ square, color: 'var(--accent)' }));

  return (
    <div className="drill">
      <div className="drill-board">
        <Board
          fen={fen}
          orientation={drill.orientation ?? mover}
          movable={solved || showing ? 'none' : mover}
          onMove={(m) => onMove({ from: m.from, to: m.to, promotion: m.promotion })}
          lastMove={lastMove}
          highlights={highlights}
          coordinates
        />
      </div>

      <div className="drill-side">
        <p className={`drill-task ${solved ? 'done' : ''}`}>{solved ? drill.done : drill.task}</p>
        {note && !solved && <p className="small dim drill-note">{note}</p>}

        <div className="row wrap drill-actions">
          {!solved && (
            <button className="btn sm" onClick={showSolution} disabled={showing}>
              {showing ? 'Watching…' : 'Show me how'}
            </button>
          )}
          <button className="btn sm ghost" onClick={reset} disabled={showing}>Start again</button>
          {tries > 0 && !solved && <span className="tiny faint">{tries} {tries === 1 ? 'move' : 'moves'}</span>}
        </div>
      </div>
    </div>
  );
}
