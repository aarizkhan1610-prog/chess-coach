import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ALL_OPENINGS, GROUP_LABEL, openingById, openingsByGroup, type Opening } from '../openings';
import { Board } from '../components/Board';
import { Card, Empty, Meter, Pill, navigate } from '../components/ui';
import { useGames, useStore } from '../state/store';
import type { Color } from '../types';

const DIFFICULTY = ['', 'Beginner-friendly', 'Intermediate', 'Demanding'];

export function OpeningsPage() {
  const groups = useMemo(() => openingsByGroup(), []);
  const openingStep = useStore((s) => s.openingStep);
  const quizBest = useStore((s) => s.openingQuizBest);
  const games = useGames();
  const [filter, setFilter] = useState('');

  // Highlight courses for the openings the user actually plays.
  const played = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) if (g.openingId) counts.set(g.openingId, (counts.get(g.openingId) ?? 0) + 1);
    return counts;
  }, [games]);

  const q = filter.trim().toLowerCase();
  const matches = (o: Opening) =>
    !q || o.name.toLowerCase().includes(q) || o.eco.toLowerCase().includes(q) || o.style.some((s) => s.includes(q));

  return (
    <div>
      <div className="page-head">
        <div className="row wrap">
          <div>
            <h1>Openings</h1>
            <div className="sub">{ALL_OPENINGS.length} courses, each taught move by move with the ideas behind them.</div>
          </div>
          <div className="spacer" />
          <input
            type="text"
            placeholder="Search by name, ECO or style…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>
      </div>

      {played.size > 0 && !q && (
        <Card title="The openings you actually play" style={{ marginBottom: 18 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            {[...played.entries()]
              .filter(([id]) => openingById(id))
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <a key={id} href={`#/openings/${id}`} style={{ textDecoration: 'none' }}>
                  <Pill color="var(--accent)">{openingById(id)!.name} · {n} game{n === 1 ? '' : 's'} →</Pill>
                </a>
              ))}
            {[...played.keys()].every((id) => !openingById(id)) && (
              <span className="small dim">None of your openings have a course yet.</span>
            )}
          </div>
        </Card>
      )}

      {groups.map(({ group, openings }) => {
        const shown = openings.filter(matches);
        if (!shown.length) return null;
        return (
          <div key={group} style={{ marginBottom: 22 }}>
            <h2 style={{ marginBottom: 10 }}>{GROUP_LABEL[group]}</h2>
            <div className="cards-grid">
              {shown.map((o) => {
                const step = openingStep[o.id] ?? 0;
                const pct = Math.round((step / Math.max(1, o.steps.length - 1)) * 100);
                return (
                  <a key={o.id} href={`#/openings/${o.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Card className="mode-card">
                      <div className="row" style={{ marginBottom: 5 }}>
                        <span className="bold">{o.name}</span>
                        <div className="spacer" />
                        <Pill>{o.eco}</Pill>
                      </div>
                      <div className="small dim" style={{ minHeight: 56 }}>{o.summary}</div>
                      <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                        {o.style.slice(0, 3).map((s) => <Pill key={s}>{s}</Pill>)}
                        <div className="spacer" />
                        {played.has(o.id) && <Pill color="var(--accent)">you play this</Pill>}
                      </div>
                      {step > 0 && (
                        <div style={{ marginTop: 9 }}>
                          <Meter value={pct} label={quizBest[o.id] ? `quiz ${quizBest[o.id]}%` : `${pct}%`} />
                        </div>
                      )}
                    </Card>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Tab = 'learn' | 'ideas' | 'branches' | 'traps' | 'quiz';

export function OpeningPage({ id }: { id: string }) {
  const opening = openingById(id);
  const setOpeningStep = useStore((s) => s.setOpeningStep);
  const [tab, setTab] = useState<Tab>('learn');
  const [ply, setPly] = useState(0);
  const [line, setLine] = useState<{ label: string; moves: string[] } | null>(null);

  useEffect(() => { setPly(0); setLine(null); setTab('learn'); }, [id]);

  if (!opening) {
    return <Empty title="Opening not found" action={<button className="btn" onClick={() => navigate('/openings')}>All openings</button>} />;
  }

  const activeMoves = line?.moves ?? opening.moves;

  const { fen, lastMove } = useMemo(() => {
    const c = new Chess();
    let last: { from: string; to: string } | null = null;
    for (let i = 0; i < ply && i < activeMoves.length; i++) {
      try {
        const m = c.move(activeMoves[i]);
        last = { from: m.from, to: m.to };
      } catch { break; }
    }
    return { fen: c.fen(), lastMove: last };
  }, [activeMoves, ply]);

  // The lesson step that covers the current position.
  const stepIndex = opening.steps.findIndex((s) => ply <= s.upto);
  const step = opening.steps[stepIndex === -1 ? opening.steps.length - 1 : stepIndex];

  useEffect(() => {
    if (!line && stepIndex >= 0) setOpeningStep(opening.id, stepIndex);
  }, [stepIndex, line, opening.id, setOpeningStep]);

  const orientation: Color = opening.side;

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" style={{ marginBottom: 6 }} onClick={() => navigate('/openings')}>← Openings</button>
        <div className="row wrap">
          <div>
            <h1>{opening.name}</h1>
            <div className="sub">{opening.summary}</div>
          </div>
          <div className="spacer" />
          <Pill>{opening.eco}</Pill>
          <Pill>{opening.side === 'w' ? 'for White' : 'for Black'}</Pill>
          <Pill>{DIFFICULTY[opening.difficulty]}</Pill>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 6, marginBottom: 16 }}>
        {(['learn', 'ideas', 'branches', 'traps', 'quiz'] as Tab[]).map((t) => {
          if (t === 'traps' && !opening.traps.length) return null;
          return (
            <button key={t} className={`btn sm ${tab === t ? 'primary' : 'ghost'}`} onClick={() => setTab(t)}>
              {t === 'learn' ? 'Step by step' : t === 'quiz' ? 'Test yourself' : t[0].toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {tab === 'quiz' ? (
        <OpeningQuiz opening={opening} />
      ) : (
        <div className="split wide">
          <div className="grid">
            <Board fen={fen} orientation={orientation} lastMove={lastMove} movable="none" />
            <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
              <button className="btn sm" onClick={() => setPly(0)}>⏮</button>
              <button className="btn sm" onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
              <span className="mono small dim" style={{ minWidth: 70, textAlign: 'center' }}>{ply}/{activeMoves.length}</span>
              <button className="btn sm" onClick={() => setPly((p) => Math.min(activeMoves.length, p + 1))}>▶</button>
              <button className="btn sm" onClick={() => setPly(activeMoves.length)}>⏭</button>
            </div>

            <Card title={line ? line.label : 'Main line'} actions={line ? <button className="btn sm ghost" onClick={() => { setLine(null); setPly(0); }}>Back to main line</button> : undefined}>
              <div className="row wrap" style={{ gap: 4 }}>
                {activeMoves.map((san, i) => (
                  <span key={i} className="row" style={{ gap: 4 }}>
                    {i % 2 === 0 && <span className="tiny faint mono">{i / 2 + 1}.</span>}
                    <button
                      className={`tree-move ${i + 1 === ply ? 'current' : ''} ${i + 1 > ply ? 'future' : ''}`}
                      onClick={() => setPly(i + 1)}
                    >
                      {san}
                    </button>
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid">
            {tab === 'learn' && (
              <>
                <Card title={step?.title ?? 'The moves'}>
                  <p>{step?.body}</p>
                  {!line && (
                    <div className="row" style={{ marginTop: 10 }}>
                      <button
                        className="btn sm"
                        disabled={stepIndex <= 0}
                        onClick={() => setPly(opening.steps[Math.max(0, stepIndex - 1)]?.upto ?? 0)}
                      >
                        ← Previous idea
                      </button>
                      <div className="spacer" />
                      <button
                        className="btn sm primary"
                        onClick={() => {
                          const next = opening.steps[stepIndex + 1];
                          if (next) setPly(next.upto);
                          else setTab('quiz');
                        }}
                      >
                        {opening.steps[stepIndex + 1] ? 'Next idea →' : 'Test yourself →'}
                      </button>
                    </div>
                  )}
                </Card>
                <Card title="Lesson progress">
                  <div className="step-nav" style={{ marginBottom: 0 }}>
                    {opening.steps.map((s, i) => (
                      <button
                        key={i}
                        className={`step-dot ${i === stepIndex ? 'active' : ''} ${ply > s.upto ? 'done' : ''}`}
                        title={s.title}
                        onClick={() => { setLine(null); setPly(s.upto); }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {tab === 'ideas' && (
              <>
                <Card title="Key ideas">
                  <ul>{opening.ideas.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </Card>
                <Card title={`Your plans (${opening.side === 'w' ? 'White' : 'Black'})`}>
                  <ul>{opening.plans.you.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </Card>
                <Card title="What your opponent is trying to do">
                  <ul>{opening.plans.them.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </Card>
              </>
            )}

            {tab === 'branches' && (
              <Card title="Variations">
                <div className="grid" style={{ gap: 12 }}>
                  {opening.branches.map((b) => (
                    <div key={b.name} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                      <div className="row">
                        <span className="bold">{b.name}</span>
                        <div className="spacer" />
                        <button className="btn sm" onClick={() => { setLine({ label: b.name, moves: b.moves }); setPly(b.moves.length); }}>
                          Play through
                        </button>
                      </div>
                      <div className="small dim" style={{ marginTop: 4 }}>{b.idea}</div>
                      <div className="mono tiny faint" style={{ marginTop: 4 }}>
                        {b.moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === 'traps' && (
              <Card title="Traps worth knowing">
                <div className="grid" style={{ gap: 14 }}>
                  {opening.traps.map((t) => (
                    <div key={t.name} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                      <div className="row">
                        <span className="bold">{t.name}</span>
                        <div className="spacer" />
                        <button className="btn sm" onClick={() => { setLine({ label: t.name, moves: t.moves }); setPly(0); }}>
                          Play through
                        </button>
                      </div>
                      <div className="small" style={{ marginTop: 5 }}>{t.explain}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Play the line from memory
 * ------------------------------------------------------------------ */
function OpeningQuiz({ opening }: { opening: Opening }) {
  const setQuizBest = useStore((s) => s.setOpeningQuizBest);
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const moves = opening.moves;
  const userPlaysEven = opening.side === 'w';
  const isUserPly = (p: number) => (p % 2 === 0) === userPlaysEven;
  const userMoveCount = moves.filter((_, i) => isUserPly(i)).length;
  // How many of your own moves you have actually played so far.
  const userMovesPlayed = moves.slice(0, ply).filter((_, i) => isUserPly(i)).length;

  function reset() {
    setPly(0); setFen(new Chess().fen()); setWrong(null); setMistakes(0);
    setRevealed(false); setDone(false); setLastMove(null);
  }

  // When it is the opponent's turn, the app plays the book move.
  useEffect(() => {
    if (done || ply >= moves.length || isUserPly(ply)) return;
    const t = setTimeout(() => {
      const c = new Chess(fen);
      try {
        const m = c.move(moves[ply]);
        setFen(c.fen());
        setLastMove({ from: m.from, to: m.to });
        setPly((p) => p + 1);
      } catch { setDone(true); }
    }, 420);
    return () => clearTimeout(t);
  }, [ply, fen, done, moves, userPlaysEven]);

  useEffect(() => {
    if (ply >= moves.length && !done) {
      setDone(true);
      const score = Math.round(((userMoveCount - mistakes) / Math.max(1, userMoveCount)) * 100);
      setQuizBest(opening.id, score);
    }
  }, [ply, moves.length, done, mistakes, userMoveCount, opening.id, setQuizBest]);

  const expected = moves[ply];
  const norm = (s: string) => s.replace(/[+#!?]/g, '');

  if (done) {
    const score = Math.round(((userMoveCount - mistakes) / Math.max(1, userMoveCount)) * 100);
    return (
      <Card>
        <h2 style={{ marginBottom: 8 }}>{mistakes === 0 ? 'Perfect run' : `${score}%`}</h2>
        <p className="dim">
          You played {userMoveCount - mistakes} of {userMoveCount} book moves correctly
          {mistakes > 0 && ` — ${mistakes} slip${mistakes === 1 ? '' : 's'}`}.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={reset}>Again</button>
          <button className="btn" onClick={() => navigate('/openings')}>Other openings</button>
        </div>
      </Card>
    );
  }

  return (
    <div className="split wide">
      <Board
        fen={fen}
        orientation={opening.side}
        movable={isUserPly(ply) && !revealed ? opening.side : 'none'}
        lastMove={lastMove}
        onMove={(m) => {
          if (norm(m.san) === norm(expected)) {
            setFen(m.fenAfter);
            setLastMove({ from: m.from, to: m.to });
            setPly((p) => p + 1);
            setWrong(null);
          } else {
            setWrong(m.san);
            setMistakes((x) => x + 1);
          }
        }}
      />
      <div className="grid">
        <Card title="Play the line from memory">
          <p className="small dim">
            You are {opening.side === 'w' ? 'White' : 'Black'}. Play the main line of the {opening.name};
            the opponent's moves are played for you.
          </p>
          <div className="row" style={{ marginTop: 6 }}>
            <Pill>move {Math.floor(ply / 2) + 1}</Pill>
            <Pill>{userMovesPlayed}/{userMoveCount} played</Pill>
            {mistakes > 0 && <Pill color="var(--bad)">{mistakes} wrong</Pill>}
          </div>

          {wrong && (
            <div className="banner error" style={{ marginTop: 12 }}>
              <div>
                <div><span className="mono bold">{wrong}</span> is not the book move here.</div>
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  <button className="btn sm" onClick={() => setWrong(null)}>Try again</button>
                  <button
                    className="btn sm ghost"
                    onClick={() => {
                      const c = new Chess(fen);
                      const m = c.move(expected);
                      setFen(c.fen());
                      setLastMove({ from: m.from, to: m.to });
                      setPly((p) => p + 1);
                      setWrong(null);
                    }}
                  >
                    Show me ({expected})
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm ghost" onClick={reset}>Restart</button>
          </div>
        </Card>

        <Card title="Reminder">
          <ul className="small">{opening.ideas.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
