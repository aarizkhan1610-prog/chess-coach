import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type BoardArrow } from '../components/Board';
import {
  Card, EvalBar, EvalGraph, MoveList, Pill, VerdictBadge, accuracyColor,
  Empty, Meter, formatDate, navigate, resultBadge,
} from '../components/ui';
import { useStore } from '../state/store';
import { MOTIF_META, type AnalysedGame, type Color, type MoveVerdict } from '../types';
import { VERDICT_META, formatEval } from '../chess/evaluation';
import { lessonTitleFor } from '../coach/lessons';
import { openingById } from '../openings';

const SUMMARY_ORDER: MoveVerdict[] = ['brilliant', 'great', 'best', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

export function GameReviewPage({ gameId }: { gameId: string }) {
  const game = useStore((s) => s.games[gameId]);
  const settings = useStore((s) => s.settings);
  const setHero = useStore((s) => s.setHero);
  const [ply, setPly] = useState(-1);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => setPly(-1), [gameId]);

  // Keyboard navigation over the game.
  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { setPly((p) => Math.max(-1, p - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPly((p) => Math.min(game.moves.length - 1, p + 1)); e.preventDefault(); }
      else if (e.key === 'Home') { setPly(-1); e.preventDefault(); }
      else if (e.key === 'End') { setPly(game.moves.length - 1); e.preventDefault(); }
      else if (e.key === 'f') setFlipped((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  if (!game) {
    return (
      <Empty title="Game not found" action={<button className="btn" onClick={() => navigate('/games')}>Back to games</button>}>
        It may have been removed.
      </Empty>
    );
  }

  const baseOrientation: Color = settings.autoOrient ? game.hero : 'w';
  const orientation: Color = flipped ? (baseOrientation === 'w' ? 'b' : 'w') : baseOrientation;
  const move = ply >= 0 ? game.moves[ply] : null;
  const fen = move ? move.fenAfter : game.startingFen;
  const evaluation = move ? move.evalAfter : game.moves[0]?.evalBefore ?? { cp: 0, mate: null };

  const arrows = useMemo<BoardArrow[]>(() => {
    if (!move) return [];
    const out: BoardArrow[] = [
      { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), color: VERDICT_META[move.verdict].color },
    ];
    // On a real mistake, show what should have been played instead.
    const isError = ['inaccuracy', 'mistake', 'blunder'].includes(move.verdict);
    if (isError && move.bestLineUci[0] && move.bestLineUci[0] !== move.uci) {
      out.push({ from: move.bestLineUci[0].slice(0, 2), to: move.bestLineUci[0].slice(2, 4), color: 'var(--v-best)' });
    }
    return out;
  }, [move]);

  const heroName = game.hero === 'w' ? game.meta.white : game.meta.black;
  const oppName = game.hero === 'w' ? game.meta.black : game.meta.white;
  const result = resultBadge(game.meta.result, game.hero);
  const heroAcc = game.accuracy[game.hero];
  const oppAcc = game.accuracy[game.hero === 'w' ? 'b' : 'w'];
  const course = game.openingId ? openingById(game.openingId) : undefined;

  const mistakes = game.moves.filter(
    (m) => m.color === game.hero && ['inaccuracy', 'mistake', 'blunder'].includes(m.verdict),
  );

  return (
    <div>
      <div className="page-head">
        <div className="row wrap">
          <div>
            <h1>{heroName} vs {oppName}</h1>
            <div className="sub row wrap" style={{ gap: 8 }}>
              <Pill color={result.color}>{result.text}</Pill>
              <span>{formatDate(game.meta.date)}</span>
              {game.meta.timeControl && <span>· {game.meta.timeControl}</span>}
              {game.openingName && (
                <>
                  <span>·</span>
                  {course ? (
                    <a href={`#/openings/${course.id}`}>{game.openingName}</a>
                  ) : (
                    <span>{game.openingName}</span>
                  )}
                </>
              )}
              <span className="faint">· depth {game.depth}</span>
            </div>
          </div>
          <div className="spacer" />
          <button className="btn sm ghost" onClick={() => setFlipped((f) => !f)} title="Flip board (f)">Flip</button>
          <button
            className="btn sm ghost"
            onClick={() => setHero(game.id, game.hero === 'w' ? 'b' : 'w')}
            title="Change which side is treated as you"
          >
            I played {game.hero === 'w' ? 'Black' : 'White'}
          </button>
        </div>
      </div>

      <div className="split wide">
        <div className="grid">
          <div className="board-col">
            <EvalBar evaluation={evaluation} orientation={orientation} />
            <Board
              fen={fen}
              orientation={orientation}
              lastMove={move ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4) } : null}
              arrows={arrows}
              movable="none"
            />
          </div>

          <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
            <button className="btn sm" onClick={() => setPly(-1)} title="Start (Home)">⏮</button>
            <button className="btn sm" onClick={() => setPly((p) => Math.max(-1, p - 1))} title="Previous (←)">◀</button>
            <span className="mono small dim" style={{ minWidth: 92, textAlign: 'center' }}>
              {move ? `${move.moveNumber}${move.color === 'w' ? '.' : '…'} ${move.san}` : 'Start'}
            </span>
            <button className="btn sm" onClick={() => setPly((p) => Math.min(game.moves.length - 1, p + 1))} title="Next (→)">▶</button>
            <button className="btn sm" onClick={() => setPly(game.moves.length - 1)} title="End (End)">⏭</button>
          </div>

          <Card title="Win probability" className="pad-0" >
            <div style={{ padding: '0 0 0' }}>
              <EvalGraph moves={game.moves} current={ply} onSeek={setPly} heroColor={game.hero} />
              <div className="row tiny faint" style={{ padding: '6px 2px 0' }}>
                <span>Higher = better for White</span>
                <div className="spacer" />
                <span>Click to jump · ← → to step</span>
              </div>
            </div>
          </Card>

          <MoveDetail game={game} ply={ply} />
        </div>

        <div className="grid">
          <Card title="Accuracy">
            <div className="grid" style={{ gap: 12 }}>
              <div>
                <div className="row small">
                  <span className="bold">{heroName}</span>
                  <div className="spacer" />
                  <span className="mono bold" style={{ color: accuracyColor(heroAcc) }}>{heroAcc}%</span>
                </div>
                <Meter value={heroAcc} color={accuracyColor(heroAcc)} />
              </div>
              <div>
                <div className="row small">
                  <span className="dim">{oppName}</span>
                  <div className="spacer" />
                  <span className="mono" style={{ color: accuracyColor(oppAcc) }}>{oppAcc}%</span>
                </div>
                <Meter value={oppAcc} color={accuracyColor(oppAcc)} />
              </div>
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="tiny faint" style={{ marginBottom: 7 }}>YOUR MOVES</div>
              <div className="row wrap" style={{ gap: 5 }}>
                {SUMMARY_ORDER.map((v) => {
                  const n = game.counts[game.hero][v];
                  if (!n) return null;
                  return <Pill key={v} color={VERDICT_META[v].color}>{n} {VERDICT_META[v].label.toLowerCase()}</Pill>;
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="tiny faint" style={{ marginBottom: 7 }}>BY PHASE</div>
              {(['opening', 'middlegame', 'endgame'] as const).map((p) => {
                const v = game.accuracyByPhase[p][game.hero];
                if (!v) return null;
                return (
                  <div key={p} style={{ marginBottom: 7 }}>
                    <div className="row tiny"><span className="dim" style={{ textTransform: 'capitalize' }}>{p}</span><div className="spacer" /><span className="mono">{v}%</span></div>
                    <Meter value={v} color={accuracyColor(v)} />
                  </div>
                );
              })}
            </div>
          </Card>

          {mistakes.length > 0 && (
            <Card title={`Your mistakes (${mistakes.length})`}>
              <div className="grid" style={{ gap: 6 }}>
                {mistakes.map((m) => (
                  <button
                    key={m.ply}
                    className="btn sm"
                    style={{ justifyContent: 'flex-start', gap: 8 }}
                    onClick={() => setPly(m.ply)}
                  >
                    <span className="mono" style={{ minWidth: 54, textAlign: 'left' }}>
                      {m.moveNumber}{m.color === 'w' ? '.' : '…'} {m.san}
                    </span>
                    <span className="mark bold" style={{ color: VERDICT_META[m.verdict].color }}>{VERDICT_META[m.verdict].symbol}</span>
                    <div className="spacer" />
                    <span className="tiny faint">−{m.winLoss}</span>
                  </button>
                ))}
              </div>
              <button className="btn sm primary" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate('/puzzles/rewind')}>
                Train these as puzzles
              </button>
            </Card>
          )}

          <Card title="Moves">
            <MoveList moves={game.moves} current={ply} onSelect={setPly} heroColor={game.hero} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function MoveDetail({ game, ply }: { game: AnalysedGame; ply: number }) {
  const move = ply >= 0 ? game.moves[ply] : null;
  if (!move) {
    return (
      <Card>
        <div className="small dim">
          Step through the game with the arrow keys, or click a marker on the graph to jump straight to a mistake.
        </div>
      </Card>
    );
  }

  const meta = VERDICT_META[move.verdict];
  const isError = ['inaccuracy', 'mistake', 'blunder'].includes(move.verdict);
  const isHero = move.color === game.hero;

  // Render the engine's line as real move numbers.
  const sanLine = (line: string[], startPly: number) => {
    const out: string[] = [];
    line.forEach((san, i) => {
      const p = startPly + i;
      const num = Math.floor(p / 2) + 1;
      if (p % 2 === 0) out.push(`${num}. ${san}`);
      else out.push(i === 0 ? `${num}… ${san}` : san);
    });
    return out.join(' ');
  };

  return (
    <Card>
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <span className="mono bold">{move.moveNumber}{move.color === 'w' ? '.' : '…'} {move.san}</span>
        <VerdictBadge verdict={move.verdict} />
        <Pill>{move.phase}</Pill>
        {!isHero && <Pill>opponent</Pill>}
        <div className="spacer" />
        <span className="mono small dim">{formatEval(move.evalBefore)} → {formatEval(move.evalAfter)}</span>
      </div>

      {isError && (
        <div className="banner warn" style={{ marginBottom: 10 }}>
          <div>
            <div>
              This move gave away <span className="bold">{move.winLoss}</span> win-probability points.
              {move.bestSan && <> The engine prefers <span className="mono bold">{move.bestSan}</span>.</>}
            </div>
            {move.refutationSan.length > 0 && (
              <div className="small" style={{ marginTop: 5 }}>
                Punished by <span className="mono">{sanLine(move.refutationSan, move.ply + 1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(move.verdict === 'brilliant' || move.verdict === 'great') && (
        <div className="banner ok" style={{ marginBottom: 10 }}>
          <div>
            {move.verdict === 'brilliant' ? 'A sacrifice that works' : 'The only move that held the position'} — the
            next-best try was {move.secondBestWinLoss} win-probability points worse.
          </div>
        </div>
      )}

      {move.bestLineSan.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="tiny faint">ENGINE LINE</div>
          <div className="line-san">{sanLine(move.bestLineSan, move.ply)}</div>
        </div>
      )}

      {move.motifs.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="tiny faint" style={{ marginBottom: 6 }}>WHAT WENT WRONG</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {move.motifs.map((t) => (
              <a key={t} href={`#/lessons/${t}`} style={{ textDecoration: 'none' }}>
                <Pill color="var(--accent)" title={`Open the lesson: ${lessonTitleFor(t)}`}>
                  {MOTIF_META[t].label} →
                </Pill>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="row tiny faint wrap" style={{ marginTop: 10, gap: 12 }}>
        <span>accuracy {move.accuracy}%</span>
        {move.secondsSpent !== null && <span>{move.secondsSpent}s spent</span>}
        {move.secondBestWinLoss !== null && <span>2nd best −{move.secondBestWinLoss}</span>}
        {move.alternativesSan.length > 0 && <span>also fine: {move.alternativesSan.join(', ')}</span>}
      </div>
    </Card>
  );
}
