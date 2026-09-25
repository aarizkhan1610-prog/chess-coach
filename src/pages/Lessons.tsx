import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { useGames, useStore } from '../state/store';
import { buildProfile } from '../coach/weaknesses';
import { ALL_LESSONS, buildPlan, coreTrack, examplesFor, lessonFor, remainingLessons, type Lesson, type LessonStep } from '../coach/lessons';
import { Board } from '../components/Board';
import { Card, Empty, Pill, navigate, formatDate } from '../components/ui';
import { TrainBrowser, type TrainNode } from '../components/TrainBrowser';
import { MOTIF_META, type MotifTag } from '../types';

/** The board shows a lesson's own worked position, when it has one. */
function lessonFen(lesson: Lesson): { fen?: string; caption?: string } {
  const step = lesson.steps.find((x) => x.kind === 'position');
  if (step && step.kind === 'position') return { fen: step.fen, caption: step.prompt };
  return {};
}

function lessonNode(lesson: Lesson, done: boolean, prefix?: string): TrainNode {
  const pos = lessonFen(lesson);
  return {
    id: lesson.tag,
    label: prefix ? `${prefix}. ${lesson.title}` : lesson.title,
    detail: lesson.oneLiner,
    meta: done ? 'done' : `${lesson.estMinutes} min`,
    fen: pos.fen,
    caption: pos.caption ?? 'No position in this lesson — it is all board habits',
    href: `/lessons/${lesson.tag}`,
    cta: done ? 'Revisit' : 'Start the lesson',
    summary: (
      <div className="row wrap" style={{ gap: 6 }}>
        <Pill>{MOTIF_META[lesson.tag].family}</Pill>
        <Pill>{lesson.estMinutes} min</Pill>
        <Pill>{lesson.steps.length} steps</Pill>
        {done && <Pill color="var(--good)">done</Pill>}
      </div>
    ),
  };
}

const FAMILY_NODE = {
  tactics: { label: 'Tactics', detail: 'Hanging pieces, forks, pins, back ranks — how material changes hands' },
  strategy: { label: 'Strategy', detail: 'King safety, pawn structure, trades and the slower decisions' },
  phase: { label: 'Converting, defending and endgames', detail: 'Winning won positions, saving bad ones, and the clock' },
} as const;

export function LessonsPage() {
  const games = useGames();
  const profile = useMemo(() => buildProfile(games), [games]);
  const plan = useMemo(() => buildPlan(profile, 6), [profile]);
  const done = useStore((s) => s.lessonDone);
  const track = useMemo(() => coreTrack(done), [done]);

  const trackDone = track.filter((t) => t.done).length;
  const lessonsDone = ALL_LESSONS.filter((l) => done[l.tag]).length;

  const roots = useMemo<TrainNode[]>(() => {
    const nodes: TrainNode[] = [];

    if (plan.length) {
      nodes.push({
        id: 'plan',
        label: 'Your plan',
        detail: 'Ranked by what your own games say is costing you the most',
        meta: `${plan.length}`,
        children: plan.map((item) => ({
          ...lessonNode(item.lesson, Boolean(done[item.lesson.tag])),
          detail: item.reason,
        })),
      });
    }

    nodes.push({
      id: 'track',
      label: plan.length ? 'The core track' : 'Start here: the core track',
      detail: 'The habits that decide most games, in the order that pays off fastest',
      meta: `${trackDone}/${track.length}`,
      children: track.map((step, i) => ({
        ...lessonNode(step.lesson, step.done, String(i + 1)),
        detail: step.why,
      })),
    });

    for (const family of ['tactics', 'strategy', 'phase'] as const) {
      const lessons = ALL_LESSONS.filter((l) => MOTIF_META[l.tag].family === family);
      if (!lessons.length) continue;
      const doneCount = lessons.filter((l) => done[l.tag]).length;
      nodes.push({
        id: family,
        label: FAMILY_NODE[family].label,
        detail: FAMILY_NODE[family].detail,
        meta: `${doneCount}/${lessons.length}`,
        children: lessons.map((l) => lessonNode(l, Boolean(done[l.tag]))),
      });
    }
    return nodes;
  }, [plan, track, trackDone, done]);

  return (
    <div>
      <div className="page-head">
        <h1>Lessons</h1>
        <div className="sub">
          {plan.length
            ? 'Your plan comes from your own games. The rest is there whenever you want it.'
            : 'Twenty-six lessons. Start with the track and the order is decided for you.'}
          {lessonsDone > 0 && ` · ${lessonsDone} of ${ALL_LESSONS.length} completed`}
        </div>
      </div>

      <TrainBrowser rootLabel="All lessons" roots={roots} />
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
