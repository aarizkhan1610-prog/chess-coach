import { CoachedBoard } from '../components/CoachedBoard';
import { useEngineStatus } from '../engine/useEngine';

/**
 * The learn-to-play track.
 *
 * One sandbox for now: the starting position, against an opponent set well
 * below club strength, with every move explained. The point of starting here
 * is that the first move of a game is the only position in chess where every
 * legal option can be talked about sensibly, so it is the cheapest place to
 * show a beginner that the board will answer them back.
 */
export function BasicsPage() {
  const { status } = useEngineStatus();

  return (
    <div>
      <div className="page-head">
        <h1>Learn by playing</h1>
        <p className="sub">
          A real game against a deliberately weak opponent, with every move you make explained.
          Try things — the whole point is to find out what happens.
        </p>
        {status === 'loading' && <p className="tiny faint">Warming up the engine…</p>}
        {status === 'error' && (
          <p className="tiny" style={{ color: 'var(--bad)' }}>
            The engine did not start, so moves cannot be explained. Reloading usually fixes it.
          </p>
        )}
      </div>

      <CoachedBoard
        prompt="Your move. Anything at all."
        userSide="w"
        opponentSkill={1}
      />
    </div>
  );
}
