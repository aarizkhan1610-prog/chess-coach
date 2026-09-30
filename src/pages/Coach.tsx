import { useMemo, useState } from 'react';
import { CoachedBoard } from '../components/CoachedBoard';
import { Pill, navigate } from '../components/ui';
import { useEngineStatus } from '../engine/useEngine';
import { coachSpots, spotReason } from '../coach/fromGames';
import { useGames } from '../state/store';

/*
 * The coach, working on the player's own games.
 *
 * The board opens where a game actually went wrong and answers whatever is
 * played next — including the move that was played at the time, which is often
 * the most useful thing to try first. Nothing is graded; the point is to find
 * out what the options do, which a puzzle cannot tell you because a puzzle has
 * already decided what the answer is.
 *
 * Reviewing those same mistakes without playing anything is a separate thing
 * and stays where it was, on the game's own page.
 */
export function CoachPage() {
  const games = useGames();
  const { status } = useEngineStatus();
  const spots = useMemo(() => coachSpots(games), [games]);
  const [index, setIndex] = useState(0);

  if (!spots.length) {
    return (
      <div>
        <div className="page-head">
          <h1>Your coach</h1>
          <p className="sub">
            Play through the moments your own games turned, with someone explaining what each option does.
          </p>
        </div>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            {games.length === 0
              ? 'There are no games to work from yet. Import a few and the coach will open at the positions where they went wrong.'
              : 'Nothing to revisit — the analysis found no mistakes worth going back to in the games you have imported.'}
          </p>
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            <button className="btn primary" onClick={() => navigate('/import')}>Import your games</button>
            <button className="btn" onClick={() => navigate('/basics/play')}>Play a coached game instead</button>
          </div>
        </div>
      </div>
    );
  }

  const spot = spots[index % spots.length];
  const reason = spotReason(spot);
  const when = new Date(spot.at).toLocaleDateString();

  return (
    <div>
      <div className="page-head">
        <h1>Your coach</h1>
        <p className="sub">
          Positions from your own games, worst first. Play anything — you will be told what it does, and
          you can always take it back.
        </p>
      </div>

      <div className="row wrap coach-spot-head">
        <Pill>{`${index + 1} of ${spots.length}`}</Pill>
        <span className="small">
          <b>vs {spot.opponent}</b>
          <span className="dim">{` · move ${spot.moveNumber} · ${when}`}</span>
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
