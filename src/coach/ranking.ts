import { progressFor, type ProgressReading, type TrainingRecord } from './progress';
import type { AnalysedGame, MotifTag, WeaknessStat } from '../types';

/*
 * What to work on next, given what training has already shown.
 *
 * The profile ranks habits by what they have cost across every game, which is
 * the right order for a report and the wrong one for a coach once training has
 * started: it keeps recommending a habit that has already come down, and keeps
 * recommending one that a week of work has not moved. This re-ranks by the best
 * estimate of what each habit costs now, and lets a habit that has been
 * properly trained without moving yield its place for a while.
 *
 * For somebody who has trained nothing, the order is exactly the profile's.
 * That is tested, because a re-ranking that quietly reshuffled advice for
 * people it has no new information about would be worse than none.
 */

/** Training sessions before "no change" counts as evidence rather than too little work. */
export const STALLED_MIN_SESSIONS = 6;

/**
 * How much a stalled habit's cost counts for, when ranking.
 *
 * This one is a prior, not a measurement. There is no data yet on how players
 * respond to training, so any value here is a judgement; a half moves a stalled
 * habit below an untrained one costing a little over half as much, which gives
 * something else a turn without burying the habit. When there are enough
 * real readings, this is the number to replace with one learned from them.
 */
export const STALLED_WEIGHT = 0.5;

/**
 * Above this, a gap is as likely as not to be shuffling, which is the line
 * between "no sign of change" and "a change not yet proven".
 *
 * It splits the inconclusive cases in two, because they call for opposite
 * advice. Found on real games: time trouble went from 2.9 to 10.1 a game
 * at p 0.21, converting from 2.6 to 6.1 at p 0.61. Both are "no clear change",
 * and the first rule demoted both — telling somebody a habit that had tripled
 * could wait. The first is a rise not yet proven, which is a reason to watch
 * it; only the second is a habit that has shown no sign of responding.
 */
export const NO_SIGN_P = 0.5;

export type HabitState = 'untrained' | 'measuring' | 'improving' | 'steady' | 'rising' | 'stalled' | 'worse';

export interface RankedHabit {
  weakness: WeaknessStat;
  reading: ProgressReading;
  state: HabitState;
  /** Best estimate of what this habit costs per game now. */
  currentCost: number;
  /** What it was ranked by. */
  priority: number;
  /** Training sessions logged against it. */
  sessions: number;
}

/** Up since training, by more than looks like chance, but not yet significantly. */
export function isRising(reading: ProgressReading): boolean {
  return reading.verdict === 'no-clear-change'
    && reading.change > 0
    && reading.pValue !== null && reading.pValue < NO_SIGN_P;
}

/**
 * Trained properly, enough games since, and no sign of it coming down.
 *
 * "No clear change" alone is not enough, in either direction. A habit that is
 * lower but not yet significantly lower is moving the right way, and demoting
 * it would abandon work that may be paying off; one that is higher but not yet
 * significantly higher may be getting worse, and demoting that is the opposite
 * of what a coach should do. Stalled is what is left: no sign of movement at
 * all, after enough work for that to mean something.
 */
export function isStalled(reading: ProgressReading, record: TrainingRecord | undefined): boolean {
  return reading.verdict === 'no-clear-change'
    && reading.change >= 0
    && !isRising(reading)
    && (record?.count ?? 0) >= STALLED_MIN_SESSIONS;
}

export function rankHabits(
  games: AnalysedGame[],
  weaknesses: WeaknessStat[],
  training: Record<string, TrainingRecord>,
): RankedHabit[] {
  const ranked = weaknesses.map((weakness): RankedHabit => {
    const record = training[weakness.tag];
    const reading = progressFor(games, weakness.tag, record);
    const sessions = record?.count ?? 0;

    switch (reading.verdict) {
      /*
       * A significant change, either way: what it costs since training is the
       * better estimate of what it costs now.
       */
      case 'improving':
      case 'worse': {
        const cost = reading.after.perGame;
        return { weakness, reading, sessions, state: reading.verdict, currentCost: cost, priority: cost };
      }
      /*
       * No significant difference means the split is not telling anything, and
       * the honest estimate is the one across all the games. Ranking on the
       * "since" half alone would act on exactly the noise the test rejected.
       */
      case 'no-clear-change': {
        const cost = weakness.perGame;
        const stalled = isStalled(reading, record);
        return {
          weakness, reading, sessions,
          state: stalled ? 'stalled' : isRising(reading) ? 'rising' : 'steady',
          currentCost: cost,
          // Rising is not promoted either: unproven is unproven both ways.
          priority: stalled ? cost * STALLED_WEIGHT : cost,
        };
      }
      case 'too-early':
        return { weakness, reading, sessions, state: 'measuring', currentCost: weakness.perGame, priority: weakness.perGame };
      default:
        return { weakness, reading, sessions, state: 'untrained', currentCost: weakness.perGame, priority: weakness.perGame };
    }
  });

  // Ties fall back to the profile's own order, so nothing moves without a reason.
  const profileOrder = new Map<MotifTag, number>(weaknesses.map((w, i) => [w.tag, i]));
  return ranked.sort((a, b) =>
    b.priority - a.priority || profileOrder.get(a.weakness.tag)! - profileOrder.get(b.weakness.tag)!);
}

/** One line on why a habit sits where it does, when that is not obvious from its cost. */
export function rankReason(habit: RankedHabit): string | null {
  switch (habit.state) {
    case 'stalled':
      return `Moved down for now — ${habit.sessions} training sessions and no sign of it coming down across `
        + `${habit.reading.after.games} games since, so the coach is putting something else first. Worth coming back to with fresh eyes.`;
    // The before-and-after figures are already on the row; the note is what to make of them.
    case 'rising':
      return 'Higher since you started, though not clearly enough to be sure yet — worth watching rather than setting aside.';
    case 'worse':
      return 'Up since you started training it. Go back through your own positions rather than more puzzles.';
    case 'improving':
      return 'Ranked by what it costs now, not across all your games — which is why it sits lower than its total suggests.';
    default:
      return null;
  }
}
