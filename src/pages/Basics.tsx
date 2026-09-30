import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../components/Board';
import { CoachedBoard } from '../components/CoachedBoard';
import { DrillBoard } from '../components/DrillBoard';
import { Pill, navigate } from '../components/ui';
import { useEngineStatus } from '../engine/useEngine';
import { RULES, TOURS, findBasic, type Tour } from '../coach/basics';
import { GuidedGameBoard } from '../components/GuidedGame';
import { OPERA } from '../coach/guidedGame';
import { useStore } from '../state/store';

/**
 * The learn-to-play track, in the order someone actually needs it: what the
 * pieces do, then the rules that catch everyone out, then a real game with a
 * coach watching. The first two stages never touch the engine, so a complete
 * beginner reaches their first drill without waiting for a download.
 */

function progressOf(tour: Tour, done: Record<string, boolean>): { done: number; total: number } {
  const total = tour.drills.length;
  return { done: tour.drills.filter((d) => done[d.id]).length, total };
}

function SectionRow({ tour, done }: { tour: Tour; done: Record<string, boolean> }) {
  const p = progressOf(tour, done);
  const complete = p.total > 0 && p.done === p.total;
  return (
    <button className={`train-row ${complete ? 'selected' : ''}`} onClick={() => navigate(`/basics/${tour.id}`)}>
      <span className="train-row-text">
        <span className="train-row-label">{tour.title}</span>
        <span className="train-row-detail">{tour.lede}</span>
      </span>
      <span className="train-row-meta">
        {p.total === 0 ? 'Read' : complete ? 'Done' : `${p.done}/${p.total}`}
      </span>
      <span className="train-row-arrow" aria-hidden>{'→'}</span>
    </button>
  );
}

export function BasicsPage() {
  const done = useStore((s) => s.basicsDone);
  const total = [...TOURS, ...RULES].reduce((n, t) => n + t.drills.length, 0);
  const finished = Object.keys(done).filter((k) => done[k]).length;

  return (
    <div>
      <div className="page-head">
        <h1>Start from the beginning</h1>
        <p className="sub">
          How each piece moves, the rules that catch everyone out, and then a real game with
          someone explaining every move you make. No chess needed to begin.
        </p>
        {finished > 0 && <Pill>{`${finished} of ${total} drills done`}</Pill>}
      </div>

      <section className="basics-stage">
        <h2>1 · How the pieces move</h2>
        <ul className="train-list">
          {TOURS.map((t) => <li key={t.id}><SectionRow tour={t} done={done} /></li>)}
        </ul>
      </section>

      <section className="basics-stage">
        <h2>2 · The rules people get wrong</h2>
        <ul className="train-list">
          {RULES.map((t) => <li key={t.id}><SectionRow tour={t} done={done} /></li>)}
        </ul>
      </section>

      <section className="basics-stage">
        <h2>3 · Play a game</h2>
        <ul className="train-list">
          <li>
            <button className={`train-row ${done[`guided-${OPERA.id}`] ? 'selected' : ''}`} onClick={() => navigate('/basics/game')}>
              <span className="train-row-text">
                <span className="train-row-label">{OPERA.title}</span>
                <span className="train-row-detail">
                  {OPERA.subtitle} Every move explained before you play it, and the checkmate left to you.
                </span>
              </span>
              <span className="train-row-meta">{done[`guided-${OPERA.id}`] ? 'Done' : '17 moves'}</span>
              <span className="train-row-arrow" aria-hidden>{'→'}</span>
            </button>
          </li>
          <li>
            <button className="train-row" onClick={() => navigate('/basics/play')}>
              <span className="train-row-text">
                <span className="train-row-label">Play with a coach</span>
                <span className="train-row-detail">
                  A real game against a deliberately weak opponent. Every move you make is explained,
                  and you can always take one back.
                </span>
              </span>
              <span className="train-row-arrow" aria-hidden>{'→'}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}

export function BasicsGamePage() {
  const { status } = useEngineStatus();

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => navigate('/basics')}>{'← Back to the basics'}</button>
        <h1>{OPERA.title}</h1>
        <p className="sub">{OPERA.subtitle}</p>
        <div className="guided-blurb">
          {OPERA.blurb.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
        </div>
        {status === 'loading' && <p className="tiny faint">Warming up the engine…</p>}
      </div>
      <GuidedGameBoard game={OPERA} />
    </div>
  );
}

/** The free-play sandbox. Split out so the contents page loads without the engine. */
export function BasicsPlayPage() {
  const { status } = useEngineStatus();

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => navigate('/basics')}>{'← Back to the basics'}</button>
        <h1>Play with a coach</h1>
        <p className="sub">
          Try things. Every move gets explained, nothing is locked, and you can take any move back.
        </p>
        {status === 'loading' && <p className="tiny faint">Warming up the engine…</p>}
        {status === 'error' && (
          <p className="tiny" style={{ color: 'var(--bad)' }}>
            The engine did not start, so moves cannot be explained. Reloading usually fixes it.
          </p>
        )}
      </div>
      <CoachedBoard prompt="Your move. Anything at all." userSide="w" opponentSkill={1} />
    </div>
  );
}

export function BasicsSectionPage({ id }: { id: string }) {
  const tour = findBasic(id);
  const done = useStore((s) => s.basicsDone);
  const markDone = useStore((s) => s.markBasicDone);
  const [index, setIndex] = useState(0);

  /* The squares the piece in the diagram can reach, so the shape is visible. */
  const reach = useMemo(() => {
    if (!tour?.showFen || !tour.showFrom) return [];
    try {
      const board = new Chess(tour.showFen);
      return board
        .moves({ square: tour.showFrom as never, verbose: true })
        .map((m) => ({ square: m.to, color: 'var(--accent)' }));
    } catch {
      return [];
    }
  }, [tour]);

  if (!tour) {
    navigate('/basics');
    return null;
  }

  const drill = tour.drills[index];
  const all = tour.drills.length;

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => navigate('/basics')}>{'← Back to the basics'}</button>
        <h1>{tour.title}</h1>
        <p className="sub">{tour.lede}</p>
      </div>

      <div className="basics-read">
        <div className="basics-prose">
          {tour.read.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
        </div>
        {tour.showFen && (
          <figure className="basics-figure">
            <Board fen={tour.showFen} movable="none" highlights={reach} coordinates />
            <figcaption className="tiny faint">
              {tour.showFrom
                ? `Every square it can reach from ${tour.showFrom}.`
                : 'Black to move, and no legal move to make.'}
            </figcaption>
          </figure>
        )}
      </div>

      {drill && (
        <section className="basics-stage">
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2>{all > 1 ? `Try it · ${index + 1} of ${all}` : 'Try it'}</h2>
            {done[drill.id] && <Pill>Done</Pill>}
          </div>
          <DrillBoard key={drill.id} drill={drill} onSolved={() => markDone(drill.id)} />
          <div className="row wrap drill-actions">
            {index > 0 && (
              <button className="btn sm ghost" onClick={() => setIndex((i) => i - 1)}>{'← Previous'}</button>
            )}
            {index < all - 1 && (
              <button className="btn primary sm" onClick={() => setIndex((i) => i + 1)}>Next task →</button>
            )}
          </div>
        </section>
      )}

      <NextSection id={tour.id} />
    </div>
  );
}

/** A single onward step, so there is never a dead end at the bottom of a page. */
function NextSection({ id }: { id: string }) {
  const order = [...TOURS, ...RULES];
  const at = order.findIndex((t) => t.id === id);
  const next = at >= 0 ? order[at + 1] : undefined;

  return (
    <div className="basics-next">
      {next ? (
        <button className="btn" onClick={() => navigate(`/basics/${next.id}`)}>
          Next: {next.title} →
        </button>
      ) : (
        <button className="btn primary" onClick={() => navigate('/basics/play')}>
          You know the rules — play a game →
        </button>
      )}
    </div>
  );
}
