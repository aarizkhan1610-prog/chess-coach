import { Meter, Pill } from './ui';
import { MOTIF_META, type WeaknessStat } from '../types';
import type { ReactNode } from 'react';
import { ProgressPill, progressSummary } from './TrainingProgress';
import type { ProgressReading } from '../coach/progress';

/**
 * One ranked habit, as it appears on both the coach and the report.
 *
 * Shared so the two halves of the app describe the same finding the same way —
 * the report states it, the coach acts on it, and a reader should be able to
 * recognise the row in both places.
 */
export function WeaknessRow({
  weakness,
  rank,
  actions,
  progress,
}: {
  weakness: WeaknessStat;
  rank: number;
  /** Buttons on the right. The coach trains it; the report offers examples. */
  actions?: ReactNode;
  /** Before and after training, when this habit has been trained. */
  progress?: ProgressReading;
}) {
  const meta = MOTIF_META[weakness.tag];
  const trained = progress && progress.verdict !== 'not-trained';
  const summary = progress ? progressSummary(progress) : null;

  return (
    <div className="weakness-row">
      <div className="weakness-rank">{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 7 }}>
          <span className="bold">{meta.label}</span>
          <Pill>{meta.family}</Pill>
          {/*
            * Once a habit has been trained, the before-and-after comparison is
            * the reading that matters, and it replaces the half-and-half trend
            * rather than sitting beside it — two labels that could disagree
            * about the same habit would be worse than either one.
            */}
          {trained && <ProgressPill reading={progress!} />}
          {!trained && weakness.trend > 0.5 && <Pill color="var(--bad)">getting worse</Pill>}
          {!trained && weakness.trend < -0.5 && <Pill color="var(--good)">improving</Pill>}
        </div>
        <div className="tiny faint">
          {weakness.occurrences}× in {weakness.gamesAffected} game{weakness.gamesAffected === 1 ? '' : 's'} ·
          {' '}{weakness.perGame} win% per game · {weakness.share}% of all your losses
        </div>
        {summary && <div className="tiny" style={{ marginTop: 3, color: 'var(--text-dim)' }}>{summary}</div>}
        <div style={{ marginTop: 5 }}><Meter value={weakness.severity} /></div>
      </div>
      {actions}
    </div>
  );
}
