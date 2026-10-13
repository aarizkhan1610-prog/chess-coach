import { Pill } from './ui';
import { MIN_SIDE, type ProgressReading } from '../coach/progress';

/*
 * What happened to a habit after you started training it.
 *
 * Worded so as not to claim more than the numbers can. A drop after training
 * is reported as a drop after training, never as "training worked": the habit
 * you train is the one that was worst lately, and that tends to come down on
 * its own, and players improve across the board for reasons of their own. The
 * rest-of-your-game figure sits next to it for exactly that reason.
 */

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A one-word state for the row it sits on. */
export function ProgressPill({ reading }: { reading: ProgressReading }) {
  switch (reading.verdict) {
    case 'improving': return <Pill color="var(--good)">down since training</Pill>;
    case 'worse': return <Pill color="var(--bad)">up since training</Pill>;
    case 'no-clear-change': return <Pill>no clear change yet</Pill>;
    case 'too-early': return <Pill>measuring</Pill>;
    default: return null;
  }
}

/** The compact line under a habit on the coach. */
export function progressSummary(reading: ProgressReading): string | null {
  if (reading.verdict === 'not-trained') return null;
  if (reading.verdict === 'too-early') {
    return `Training since ${fmtDate(reading.trainedSince!)} · ${reading.after.games} of ${MIN_SIDE} games played since`;
  }
  return `${reading.before.perGame} → ${reading.after.perGame} win% a game since you started training it`;
}

/** The full reading, at the top of a habit's training page. */
export function TrainingProgressPanel({ reading }: { reading: ProgressReading }) {
  if (reading.verdict === 'not-trained') {
    return (
      <div className="progress-panel">
        <div className="small">
          <span className="bold">This starts the clock.</span> From your first session here, every game you play is
          compared with the games from before — so the coach can tell whether this habit is actually going away,
          rather than assuming it.
        </div>
      </div>
    );
  }

  const since = fmtDate(reading.trainedSince!);
  const needAfter = Math.max(0, MIN_SIDE - reading.after.games);
  const needBefore = Math.max(0, MIN_SIDE - reading.before.games);

  return (
    <div className={`progress-panel ${reading.verdict}`}>
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <span className="bold">Since you started training this</span>
        <ProgressPill reading={reading} />
        <span className="tiny faint" style={{ marginLeft: 'auto' }}>from {since}</span>
      </div>

      <div className="progress-sides">
        <div className="progress-side">
          <div className="progress-value mono">{reading.before.games ? reading.before.perGame : '—'}</div>
          <div className="tiny faint">win% a game before · {reading.before.games} game{reading.before.games === 1 ? '' : 's'}</div>
        </div>
        <div className="progress-arrow" aria-hidden>→</div>
        <div className="progress-side">
          <div className="progress-value mono">{reading.after.games ? reading.after.perGame : '—'}</div>
          <div className="tiny faint">since · {reading.after.games} game{reading.after.games === 1 ? '' : 's'}</div>
        </div>
      </div>

      <p className="small dim" style={{ margin: 0 }}>
        {reading.verdict === 'too-early' && (
          needAfter > 0 && needBefore > 0
            ? <>Needs {MIN_SIDE} games on each side of {since} to say anything — {needBefore} more from before, and {needAfter} more played since.</>
            : needAfter > 0
              ? <>Play and import {needAfter} more game{needAfter === 1 ? '' : 's'} and this becomes a reading rather than a guess.</>
              : <>There are not yet {MIN_SIDE} games from before {since} to compare against — import older games to fill that side in.</>
        )}
        {reading.verdict === 'improving' && (
          <>That drop is larger than shuffling the same games produces by chance. It is a real change in your games —
            though some of it may be this habit fading on its own, so keep an eye on it.</>
        )}
        {reading.verdict === 'no-clear-change' && (
          <>{reading.change < 0 ? 'Lower, ' : reading.change > 0 ? 'Higher, ' : ''}but a gap this size still turns up by
            chance often enough that it could be noise. More games will settle it.</>
        )}
        {reading.verdict === 'worse' && (
          <>This has got worse since you started — a gap too large to be chance. Worth going back through your own
            positions below rather than more puzzles.</>
        )}
        {reading.overall && (
          <> Everything else you lose to went from {reading.overall.before} to {reading.overall.after} a game over the
            same stretch{reading.overall.after < reading.overall.before - 3
              ? ', so part of this may be your game improving generally.'
              : '.'}</>
        )}
      </p>

      {reading.undated > 0 && (
        <div className="tiny faint">
          {reading.undated} game{reading.undated === 1 ? '' : 's'} left out — no record of when {reading.undated === 1 ? 'it was' : 'they were'} played,
          so {reading.undated === 1 ? 'it' : 'they'} cannot be placed either side.
        </div>
      )}
    </div>
  );
}
