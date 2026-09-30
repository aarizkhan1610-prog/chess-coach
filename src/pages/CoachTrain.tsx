import { useMemo, useState } from 'react';
import { CoachedBoard } from '../components/CoachedBoard';
import { Pill, navigate } from '../components/ui';
import { useEngineStatus } from '../engine/useEngine';
import { examplesFor, lessonFor } from '../coach/lessons';
import { buildProfile } from '../coach/weaknesses';
import { coachSpots, spotReason } from '../coach/fromGames';
import { puzzlesFromGames } from '../coach/puzzles';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { openingById } from '../openings';
import { MOTIF_META, type MotifTag } from '../types';
import { useGames, useStore } from '../state/store';

/*
 * Training one habit.
 *
 * The coach used to be a single queue of a player's worst moves in cost order,
 * which trains nothing in particular: three consecutive positions could be
 * three unrelated mistakes, so no pattern ever repeats often enough to stick.
 * This page is the opposite — six positions of the *same* motif, from the
 * player's own games, worst first, and then the lesson and the drill for it.
 *
 * That is why it uses `examplesFor` rather than `coachSpots`: `coachSpots`
 * spreads round-robin across games on purpose, which is exactly wrong here.
 */

const OPENING_TAGS: MotifTag[] = ['development', 'premature-queen', 'king-safety'];

export function CoachTrainPage({ tag }: { tag: MotifTag }) {
  const games = useGames();
  const { status } = useEngineStatus();
  const done = useStore((s) => s.coachSpotsDone);
  const markDone = useStore((s) => s.markSpotDone);
  const lessonDone = useStore((s) => s.lessonDone[tag]);

  const [index, setIndex] = useState(0);

  const meta = MOTIF_META[tag];
  const lesson = lessonFor(tag);
  const spots = useMemo(() => examplesFor(games, tag, 6), [games, tag]);

  const puzzleCount = useMemo(() => {
    const mine = puzzlesFromGames(games).filter((p) => p.tags.includes(tag)).length;
    return mine + STARTER_PUZZLES.filter((p) => p.tags.includes(tag)).length;
  }, [games, tag]);

  const opening = useMemo(() => {
    if (!OPENING_TAGS.includes(tag)) return null;
    const played = buildProfile(games).openingRecord[0];
    return played && openingById(played.openingId) ? played : null;
  }, [games, tag]);

  const spot = spots[index];
  const trained = spots.filter((s) => done[`${s.gameId}:${s.ply}`]).length;

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => navigate('/coach')}>{'← Back to the coach'}</button>
        <h1>{meta.label}</h1>
        <p className="sub">{lesson?.oneLiner ?? meta.short}</p>
      </div>

      {/* ---- Stage 1: your own positions ---- */}
      <section className="coach-block">
        <div className="row wrap coach-stage-head">
          <h2>Your positions</h2>
          {spots.length > 0 && <Pill>{`${trained} of ${spots.length} done`}</Pill>}
        </div>

        {spots.length === 0 ? (
          <div className="card small dim">
            This has not shown up in the games you have imported, so there is nothing of your own to work
            through. The lesson below still applies.
          </div>
        ) : (
          <>
            <div className="coach-spot-why">
              <b>vs {spot.opponent}</b>
              <span className="dim">{` · position ${index + 1} of ${spots.length}`}</span>
              <br />
              You played <span className="mono">{spot.san}</span> here and it cost{' '}
              <b>{Math.round(spot.winLoss)} points</b>. Every position on this page is the same mistake, so
              look for what they have in common.
            </div>

            {status === 'error' && (
              <p className="tiny" style={{ color: 'var(--bad)' }}>
                The engine did not start, so moves cannot be explained. Reloading usually fixes it.
              </p>
            )}

            <CoachedBoard
              key={`${spot.gameId}:${spot.ply}`}
              prompt="Your move. Try anything, including what you played at the time."
              startFen={spot.fenBefore}
              userSide={spot.hero}
              orientation={spot.hero}
              opponentSkill={10}
              footer={
                <div className="row wrap coach-spot-nav">
                  <button className="btn sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                    {'← Previous'}
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => { markDone(`${spot.gameId}:${spot.ply}`); setIndex((i) => Math.min(i + 1, spots.length - 1)); }}
                    disabled={index >= spots.length - 1 && Boolean(done[`${spot.gameId}:${spot.ply}`])}
                  >
                    Mark done
                  </button>
                  <button
                    className="btn primary sm"
                    disabled={index >= spots.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    Next position →
                  </button>
                  <div className="spacer" />
                  <button className="btn sm ghost" onClick={() => navigate(`/game/${spot.gameId}`)}>
                    See the whole game
                  </button>
                </div>
              }
            />
          </>
        )}
      </section>

      {/* ---- Stage 2: the idea ---- */}
      {lesson && (
        <section className="coach-block">
          <h2>The idea behind it</h2>
          <button className="rec-card coach-stage-card" onClick={() => navigate(`/lessons/${tag}`)}>
            <span className="rec-source">{lessonDone ? 'Read' : `${lesson.estMinutes} min read`}</span>
            <span className="rec-title">{lesson.title}</span>
            <span className="rec-why">{lesson.why}</span>
            <span className="rec-cta">{lessonDone ? 'Read it again' : 'Read the lesson'} →</span>
          </button>
        </section>
      )}

      {/* ---- Stage 3: drill it ---- */}
      {puzzleCount > 0 && (
        <section className="coach-block">
          <h2>Drill the pattern</h2>
          <button className="rec-card coach-stage-card" onClick={() => navigate(`/puzzles/tag-${tag}`)}>
            <span className="rec-source">{`${puzzleCount} puzzle${puzzleCount === 1 ? '' : 's'}`}</span>
            <span className="rec-title">Only this pattern, one position after another</span>
            <span className="rec-why">
              Recognising it at the board is repetition, not understanding — which is the one thing puzzles
              are genuinely good for.
            </span>
            <span className="rec-cta">Start drilling →</span>
          </button>
        </section>
      )}

      {/* ---- Stage 4: the opening it keeps happening in ---- */}
      {opening && (
        <section className="coach-block">
          <h2>Where it keeps happening</h2>
          <button className="rec-card coach-stage-card" onClick={() => navigate(`/openings/${opening.openingId}`)}>
            <span className="rec-source">Your most played opening</span>
            <span className="rec-title">{opening.name}</span>
            <span className="rec-why">
              {`You have played this ${opening.games} time${opening.games === 1 ? '' : 's'}, scoring ${Math.round(opening.score)}%. `}
              Knowing its plans is the difference between remembering moves and knowing why they are played.
            </span>
            <span className="rec-cta">Learn the ideas →</span>
          </button>
        </section>
      )}
    </div>
  );
}

/**
 * The old flat queue, kept as a secondary route.
 *
 * Still the right tool when nothing is repeating often enough to train, or when
 * someone would simply rather go through their worst moves in order.
 */
export function CoachMixedPage() {
  const games = useGames();
  const { status } = useEngineStatus();
  const spots = useMemo(() => coachSpots(games), [games]);
  const [index, setIndex] = useState(0);

  if (!spots.length) {
    return (
      <div>
        <div className="page-head">
          <button className="btn sm ghost" onClick={() => navigate('/coach')}>{'← Back to the coach'}</button>
          <h1>All your mistakes</h1>
        </div>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Nothing to revisit — the analysis found no mistakes worth going back to in the games you have
            imported.
          </p>
          <button className="btn primary" onClick={() => navigate('/import')}>Import more games</button>
        </div>
      </div>
    );
  }

  const spot = spots[index % spots.length];
  const reason = spotReason(spot);

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => navigate('/coach')}>{'← Back to the coach'}</button>
        <h1>All your mistakes</h1>
        <p className="sub">Worst first, whatever the cause. Play anything — you will be told what it does.</p>
      </div>

      <div className="row wrap coach-spot-head">
        <Pill>{`${index + 1} of ${spots.length}`}</Pill>
        <span className="small">
          <b>vs {spot.opponent}</b>
          <span className="dim">{` · move ${spot.moveNumber}`}</span>
        </span>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => navigate(`/game/${spot.gameId}`)}>
          See the whole game
        </button>
      </div>

      <div className="coach-spot-why">
        You played <span className="mono">{spot.played}</span> here and it cost{' '}
        <b>{Math.round(spot.winLoss)} points</b> of win probability
        {reason ? <> — the analysis put it down to {reason}</> : null}. Find something better.
      </div>

      {status === 'error' && (
        <p className="tiny" style={{ color: 'var(--bad)' }}>
          The engine did not start, so moves cannot be explained. Reloading usually fixes it.
        </p>
      )}

      <CoachedBoard
        key={`${spot.gameId}:${spot.ply}`}
        prompt="Your move. Try anything, including what you played at the time."
        startFen={spot.fen}
        userSide={spot.hero}
        orientation={spot.hero}
        opponentSkill={10}
        footer={
          <div className="row wrap coach-spot-nav">
            <button className="btn sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              {'← Previous'}
            </button>
            <button
              className="btn primary sm"
              disabled={index >= spots.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next position →
            </button>
          </div>
        }
      />
    </div>
  );
}
