import { useMemo, useState, type ReactNode } from 'react';
import { RadarChart } from './RadarChart';
import { MIN_SAMPLE, comparableAxes, pickBand, ratingIn, scoreGame, type AxisScores, type BandStats } from '../coach/report';
import { BENCHMARK, BENCHMARK_BUILT } from '../coach/benchmark';
import type { AnalysedGame } from '../types';

/*
 * The report a game opens on.
 *
 * A wall of percentages is accurate and tells you nothing: there is no way to
 * know whether 71% is good without something to hold it against. The shape
 * answers the only question most people actually have — where am I unusual? —
 * and everything that used to be on this tab is still here, one click away,
 * for when the answer is "why".
 */

/** Anything inside this of the band median is noise, not a finding. */
const NOTABLE = 6;

function verdictLine(scores: AxisScores, band: BandStats): ReactNode {
  // Only axes both sides can answer, so the headline never rests on a gap that
  // is really an absence.
  const gaps = comparableAxes(scores, band)
    .map((a) => ({ axis: a, gap: (scores[a.id] as number) - (band.median[a.id] as number) }))
    .sort((a, b) => a.gap - b.gap);

  if (!gaps.length) return 'Not enough of this game to compare.';

  const worst = gaps[0];
  const best = gaps[gaps.length - 1];

  /*
   * The axis label is the topic of the sentence, never its subject. Half of
   * them are plural ("blunders", "tactics") and one is a gerund, so anything
   * of the form "your X was..." is wrong for most of the chart.
   */
  const name = (a: typeof best) => <b>{a.axis.label.toLowerCase()}</b>;

  if (worst.gap >= -NOTABLE && best.gap <= NOTABLE) {
    return 'A typical game for your rating — nothing stands out either way.';
  }
  if (worst.gap < -NOTABLE && best.gap > NOTABLE) {
    return <>Above typical for your rating on {name(best)}, below on {name(worst)}.</>;
  }
  if (worst.gap < -NOTABLE) {
    return <>Below typical for your rating on {name(worst)} — that is where this game slipped.</>;
  }
  return <>Above typical for your rating on {name(best)}.</>;
}

export function GameReport({ game, details }: { game: AnalysedGame; details: ReactNode }) {
  const [open, setOpen] = useState(false);

  const scores = useMemo(() => scoreGame(game, game.hero), [game]);
  const rating = ratingIn(game);
  const choice = useMemo(() => pickBand(BENCHMARK, rating), [rating]);

  /* No rating in the file, or no benchmark worth the name: say so plainly. */
  if (!choice) {
    return (
      <div className="grid" style={{ gap: 'var(--space-4)' }}>
        <div className="report-note small dim">
          {rating === null
            ? 'This game has no rating in it, so there is nothing to compare against. Games imported from Lichess or Chess.com carry one.'
            : `There are not yet ${MIN_SAMPLE} benchmark games at your rating, so a comparison would be guesswork.`}
        </div>
        {details}
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 'var(--space-4)' }}>
      <RadarChart scores={scores} band={choice.band} />

      <p className="report-verdict">{verdictLine(scores, choice.band)}</p>

      {!choice.exact && (
        <p className="tiny faint">
          Compared against {choice.band.label}, the nearest band with enough games — your own is too
          thinly sampled to be a fair yardstick.
        </p>
      )}

      <details className="report-more" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{open ? 'Hide the full breakdown' : 'Full breakdown'}</summary>
        <div className="report-details">{details}</div>
      </details>

      <p className="tiny faint">
        Typical figures measured from real rated games on {BENCHMARK_BUILT}, scored with the same code that
        scored yours.
      </p>
    </div>
  );
}
