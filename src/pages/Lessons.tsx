import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { useGames, useStore } from '../state/store';
import { buildProfile } from '../coach/weaknesses';
import { ALL_LESSONS, buildPlan, coreTrack, examplesFor, lessonFor, remainingLessons, type Lesson, type LessonStep } from '../coach/lessons';
import { Board } from '../components/Board';
import { Card, Empty, Meter, Pill, navigate, formatDate } from '../components/ui';
import { MOTIF_META, type MotifTag } from '../types';

export function LessonsPage() {
  const games = useGames();
  const profile = useMemo(() => buildProfile(games), [games]);
  const plan = useMemo(() => buildPlan(profile, 6), [profile]);
  const rest = useMemo(() => remainingLessons(plan), [plan]);
  const done = useStore((s) => s.lessonDone);
  const track = useMemo(() => coreTrack(done), [done]);

  const personalised = plan.length > 0;
  const trackDone = track.filter((t) => t.done).length;
  // Where to pick up: the first unfinished step.
  const nextStep = track.find((t) => !t.done) ?? track[0];

  return (
    <div>
      <div className="page-head">
        <h1>Lessons</h1>
        <div className="sub">
          {personalised
            ? 'Ordered by what your games say is costing you the most.'
            : 'Start at the top and work down — the order is the point. Once you import games, this list reorders itself around your actual weaknesses.'}
        </div>
      </div>

      {personalised ? (
        <Card title="Your plan" className="pad-0">
          <div style={{ padding: 16 }}>
            {plan.map((item, i) => (
              <div className="weakness-row" key={item.lesson.tag}>
                <div className="weakness-rank">{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 7 }}>
                    <span className="bold">{item.lesson.title}</span>
                    {done[item.lesson.tag] && <Pill color="var(--good)">done</Pill>}
                    <span className="tiny faint">{item.lesson.estMinutes} min</span>
                  </div>
                  <div className="tiny faint">{item.reason}</div>
                  <div style={{ marginTop: 5 }}><Meter value={item.severity} /></div>
                </div>
                <a className="btn sm primary" href={`#/lessons/${item.lesson.tag}`}>Start</a>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <>
          <Card className="track-head">
            <div className="row wrap" style={{ gap: 14 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 style={{ marginBottom: 4 }}>The core track</h2>
                <div className="small dim">
                  Eleven lessons covering the habits that decide most games. About two hours in total,
                  and you can stop after any one of them.
                </div>
              </div>
              <div className="track-progress">
                <div className="row" style={{ gap: 8 }}>
                  <span className="bold mono">{trackDone}/{track.length}</span>
                  <span className="tiny faint">done</span>
                </div>
                <Meter value={trackDone} max={track.length} />
              </div>
              {nextStep && (
                <a className="btn primary" href={`#/lessons/${nextStep.lesson.tag}`}>
                  {trackDone === 0 ? 'Start the track' : trackDone === track.length ? 'Review the track' : 'Continue'} →
                </a>
              )}
            </div>
          </Card>

          <ol className="track">
            {track.map((step, i) => (
              <li key={step.lesson.tag} className={`track-step ${step.done ? 'done' : ''}`}>
                <a className="track-num" href={`#/lessons/${step.lesson.tag}`} aria-hidden>
                  {step.done ? '\u2713' : i + 1}
                </a>
                <div className="track-body">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <a className="bold track-title" href={`#/lessons/${step.lesson.tag}`}>{step.lesson.title}</a>
                    {step.done && <Pill color="var(--good)">done</Pill>}
                    <span className="tiny faint">{step.lesson.estMinutes} min</span>
                  </div>
                  <div className="small dim">{step.why}</div>
                </div>
                <a className="btn sm" href={`#/lessons/${step.lesson.tag}`}>
                  {step.done ? 'Revisit' : 'Open'}
                </a>
              </li>
            ))}
          </ol>
        </>
      )}

      <div style={{ marginTop: 22 }}>
        <h2 style={{ marginBottom: 4 }}>{personalised ? 'Everything else' : 'The rest of the library'}</h2>
        <div className="small dim" style={{ marginBottom: 12 }}>
          {personalised
            ? 'Every lesson, whether or not it has shown up in your games.'
            : 'More specific patterns. Worth coming back to once the core track is behind you.'}
        </div>
        <div className="cards-grid">
          {(personalised ? rest : ALL_LESSONS.filter((l) => !track.some((t) => t.lesson.tag === l.tag))).map((l) => (
            <a key={l.tag} href={`#/lessons/${l.tag}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card className="mode-card">
                <div className="row" style={{ marginBottom: 6 }}>
                  <Pill>{MOTIF_META[l.tag].family}</Pill>
                  <div className="spacer" />
                  {done[l.tag] && <Pill color="var(--good)">done</Pill>}
                  <span className="tiny faint">{l.estMinutes} min</span>
                </div>
                <div className="bold">{l.title}</div>
                <div className="small dim" style={{ marginTop: 3 }}>{l.oneLiner}</div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LessonPage({ tag }: { tag: MotifTag }) {
  const lesson = lessonFor(tag);
  const games = useGames();
  const stepIndex = useStore((s) => s.lessonStep[tag] ?? 0);
  const setLessonStep = useStore((s) => s.setLessonStep);
  const markDone = useStore((s) => s.markLessonDone);
  const done = useStore((s) => s.lessonDone[tag] ?? false);
  const [step, setStep] = useState(0);

  if (!lesson) {
    return <Empty title="Lesson not found" action={<button className="btn" onClick={() => navigate('/lessons')}>All lessons</button>} />;
  }

  const current = lesson.steps[step];
  const last = step === lesson.steps.length - 1;

  function go(n: number) {
    const next = Math.max(0, Math.min(lesson!.steps.length - 1, n));
    setStep(next);
    setLessonStep(tag, next);
  }

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" style={{ marginBottom: 8 }} onClick={() => navigate('/lessons')}>← Lessons</button>
        <div className="row wrap">
          <div>
            <h1>{lesson.title}</h1>
            <div className="sub">{lesson.oneLiner}</div>
          </div>
          <div className="spacer" />
          <Pill>{MOTIF_META[tag].family}</Pill>
          <Pill>{lesson.estMinutes} min</Pill>
          {done && <Pill color="var(--good)">completed</Pill>}
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="small"><span className="bold">Why this matters. </span>{lesson.why}</div>
      </Card>

      <div className="step-nav" style={{ marginTop: 16 }}>
        {lesson.steps.map((s, i) => (
          <button
            key={i}
            className={`step-dot ${i === step ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
            onClick={() => go(i)}
            title={s.heading}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <StepView step={current} tag={tag} games={games} />

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" disabled={step === 0} onClick={() => go(step - 1)}>← Back</button>
        <div className="spacer" />
        <span className="small dim">Step {step + 1} of {lesson.steps.length}</span>
        <div className="spacer" />
        {last ? (
          <button
            className="btn primary"
            onClick={() => { markDone(tag, true); navigate(`/puzzles/tag-${tag}`); }}
          >
            Finish and drill it →
          </button>
        ) : (
          <button className="btn primary" onClick={() => go(step + 1)}>Next →</button>
        )}
      </div>
    </div>
  );
}

function StepView({ step, tag, games }: { step: LessonStep; tag: MotifTag; games: ReturnType<typeof useGames> }) {
  if (step.kind === 'read') {
    return (
      <Card title={step.heading}>
        {step.body.map((p, i) => <p key={i}>{p}</p>)}
      </Card>
    );
  }
  if (step.kind === 'checklist') {
    return (
      <Card title={step.heading}>
        <ul className="checklist">{step.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      </Card>
    );
  }
  if (step.kind === 'position') return <PositionStep step={step} />;
  if (step.kind === 'drill') {
    return (
      <Card title={step.heading}>
        <p>{step.body}</p>
        <button className="btn primary" onClick={() => navigate(`/puzzles/tag-${tag}`)}>
          Start {step.count} puzzles →
        </button>
      </Card>
    );
  }
  // 'yours'
  const examples = examplesFor(games, tag, 6);
  return (
    <Card title={step.heading}>
      <p>{step.body}</p>
      {examples.length === 0 ? (
        <div className="small dim">
          Nothing from your own games yet — import some and this fills in with the exact positions where this happened.
        </div>
      ) : (
        <div className="cards-grid">
          {examples.map((ex) => (
            <Card key={`${ex.gameId}-${ex.ply}`}>
              <div style={{ maxWidth: 190, margin: '0 auto 10px' }}>
                <Board fen={ex.fenBefore} orientation={ex.ply % 2 === 0 ? 'w' : 'b'} coordinates={false} movable="none" />
              </div>
              <div className="small">
                You played <span className="mono bold" style={{ color: 'var(--v-blunder)' }}>{ex.san}</span>
                {ex.bestSan && <> — better was <span className="mono bold" style={{ color: 'var(--v-best)' }}>{ex.bestSan}</span></>}
              </div>
              <div className="tiny faint" style={{ marginTop: 3 }}>vs {ex.opponent} · {formatDate(ex.date)} · −{ex.winLoss} win%</div>
              <button className="btn sm ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => navigate(`/game/${ex.gameId}`)}>Open in review</button>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

function PositionStep({ step }: { step: Extract<LessonStep, { kind: 'position' }> }) {
  const [fen, setFen] = useState(step.fen);
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [tried, setTried] = useState<string | null>(null);

  const orientation = step.orientation ?? (new Chess(step.fen).turn() as 'w' | 'b');
  const target = step.solution[0].replace(/[+#]/g, '');

  function reset() {
    setFen(step.fen);
    setState('idle');
    setTried(null);
  }

  return (
    <Card title={step.heading}>
      <div className="split">
        <div>
          <Board
            fen={fen}
            orientation={orientation}
            movable={state === 'right' ? 'none' : 'both'}
            onMove={(m) => {
              if (m.san.replace(/[+#]/g, '') === target) {
                setFen(m.fenAfter);
                setState('right');
              } else {
                setTried(m.san);
                setState('wrong');
              }
            }}
          />
        </div>
        <div>
          <p>{step.prompt}</p>
          {state === 'idle' && <div className="small dim">Make the move on the board.</div>}
          {state === 'wrong' && (
            <div className="banner error">
              <div>
                <div><span className="mono bold">{tried}</span> is not it. Try again.</div>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={reset}>Reset position</button>
              </div>
            </div>
          )}
          {state === 'right' && (
            <div className="fade-in">
              <div className="banner ok" style={{ marginBottom: 10 }}>
                <div><span className="mono bold">{step.solution[0]}</span> — correct.</div>
              </div>
              <p className="small">{step.explain}</p>
              <button className="btn sm ghost" onClick={reset}>Try again</button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
