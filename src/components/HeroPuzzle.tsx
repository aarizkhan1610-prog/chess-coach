import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from './Board';
import { Pill, navigate } from './ui';
import { isCorrectFirstMove } from '../coach/puzzles';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import type { Puzzle } from '../types';

/**
 * A handful of one-move puzzles for the landing page.
 *
 * Chosen by shape rather than by id, so regenerating the starter pack cannot
 * silently break the demo: single-move, low rating, mates first because they
 * are the most satisfying thing to land on a first visit.
 */
const DEMO: Puzzle[] = STARTER_PUZZLES
  .filter((p) => p.solution.length === 1 && p.rating <= 1000)
  .sort((a, b) => {
    const isMate = (p: Puzzle) => (p.solution[0].includes('#') ? 0 : 1);
    return isMate(a) - isMate(b) || a.rating - b.rating;
  })
  .slice(0, 6);

function goalOf(puzzle: Puzzle): string {
  if (puzzle.solution[0].includes('#')) return 'Mate in one.';
  if (puzzle.solution[0].includes('x')) return 'Win material.';
  return 'Find the best move.';
}

export function HeroPuzzle() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, DEMO.length)));
  const puzzle = DEMO[index % Math.max(1, DEMO.length)];

  const [fen, setFen] = useState(puzzle?.fen ?? '');
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [tried, setTried] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [solved, setSolved] = useState(0);

  useEffect(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setState('idle');
    setTried(null);
    setLastMove(null);
  }, [puzzle]);

  const goal = useMemo(() => (puzzle ? goalOf(puzzle) : ''), [puzzle]);

  // The starter pack always contains one-move puzzles, but never assume it.
  if (!puzzle) return null;

  function onMove(san: string, fenAfter: string, from: string, to: string) {
    if (state === 'right') return;
    setLastMove({ from, to });
    if (isCorrectFirstMove(puzzle, san)) {
      setFen(fenAfter);
      setState('right');
      setSolved((n) => n + 1);
    } else {
      setTried(san);
      setState('wrong');
      // Put the piece back so they can try again straight away.
      setTimeout(() => {
        setFen(puzzle.fen);
        setLastMove(null);
      }, 700);
    }
  }

  function reveal() {
    const c = new Chess(puzzle.fen);
    try {
      const m = c.move(puzzle.solution[0]);
      setFen(c.fen());
      setLastMove({ from: m.from, to: m.to });
    } catch {
      /* the stored line is verified at build time; nothing to do if it fails */
    }
    setState('right');
  }

  return (
    <div className="hero-puzzle">
      <div className="hero-puzzle-head">
        <span className="bold">Try one now</span>
        <Pill>{puzzle.solverColor === 'w' ? 'White to play' : 'Black to play'}</Pill>
        {solved > 0 && <Pill color="var(--good)">{solved} solved</Pill>}
      </div>

      <Board
        fen={fen}
        orientation={puzzle.solverColor}
        movable={state === 'right' ? 'none' : puzzle.solverColor}
        onMove={(m) => onMove(m.san, m.fenAfter, m.from, m.to)}
        lastMove={lastMove}
        coordinates={false}
      />

      <div className={`hero-puzzle-foot ${state}`}>
        {state === 'idle' && (
          <>
            <span className="hero-goal">{goal}</span>
            <span className="tiny faint">Drag a piece, or click from and to.</span>
          </>
        )}
        {state === 'wrong' && (
          <>
            <span className="hero-goal">
              <span className="mono bold">{tried}</span> is not it — have another go.
            </span>
            <button className="btn sm ghost" onClick={reveal}>Show me</button>
          </>
        )}
        {state === 'right' && (
          <div className="fade-in" style={{ width: '100%' }}>
            <div className="hero-goal" style={{ color: 'var(--good)' }}>
              <span className="mono bold">{puzzle.solution[0]}</span> — that is the one.
            </div>
            <div className="tiny dim" style={{ marginTop: 4 }}>
              This came out of a real game. Import yours and the puzzles come from your own blunders.
            </div>
            <div className="row" style={{ gap: 6, marginTop: 9 }}>
              <button className="btn sm" onClick={() => setIndex((i) => i + 1)}>Another →</button>
              <button className="btn sm ghost" onClick={() => navigate('/puzzles')}>All puzzles</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
