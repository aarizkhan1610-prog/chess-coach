import type { MotifTag, Profile, AnalysedGame } from '../types';
import { MOTIF_META } from '../types';
import { TACTICAL_LESSONS } from './lessonsTactical';
import { STRATEGIC_LESSONS } from './lessonsStrategic';
import type { Lesson } from './lessonTypes';

export * from './lessonTypes';

export const ALL_LESSONS: Lesson[] = [...TACTICAL_LESSONS, ...STRATEGIC_LESSONS];

const BY_TAG = new Map<MotifTag, Lesson>(ALL_LESSONS.map((l) => [l.tag, l]));

export function lessonFor(tag: MotifTag): Lesson | undefined {
  return BY_TAG.get(tag);
}

export interface PlanItem {
  lesson: Lesson;
  /** Why this lesson is in the plan right now. */
  reason: string;
  perGame: number;
  occurrences: number;
  severity: number;
  examples: { gameId: string; ply: number }[];
}

/**
 * The personalised curriculum: lessons ordered by how much each weakness is
 * actually costing this player, not by a fixed syllabus.
 */
export function buildPlan(profile: Profile, limit = 6): PlanItem[] {
  const out: PlanItem[] = [];
  for (const w of profile.weaknesses) {
    const lesson = BY_TAG.get(w.tag);
    if (!lesson) continue;
    out.push({
      lesson,
      reason: `${w.occurrences} time${w.occurrences === 1 ? '' : 's'} across ${w.gamesAffected} game${w.gamesAffected === 1 ? '' : 's'}, costing about ${w.perGame} win-probability points per game.`,
      perGame: w.perGame,
      occurrences: w.occurrences,
      severity: w.severity,
      examples: w.examples,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Lessons not yet in the plan, so the library is still browsable. */
export function remainingLessons(plan: PlanItem[]): Lesson[] {
  const inPlan = new Set(plan.map((p) => p.lesson.tag));
  return ALL_LESSONS.filter((l) => !inPlan.has(l.tag));
}

export interface YourExample {
  gameId: string;
  ply: number;
  san: string;
  bestSan: string | null;
  fenBefore: string;
  winLoss: number;
  opponent: string;
  date: string | null;
}

/** The learner's own positions for a given motif, newest and worst first. */
export function examplesFor(games: AnalysedGame[], tag: MotifTag, limit = 6): YourExample[] {
  const out: YourExample[] = [];
  for (const g of games) {
    for (const m of g.moves) {
      if (m.color !== g.hero || !m.motifs.includes(tag)) continue;
      out.push({
        gameId: g.id,
        ply: m.ply,
        san: m.san,
        bestSan: m.bestSan,
        fenBefore: m.fenBefore,
        winLoss: m.winLoss,
        opponent: g.hero === 'w' ? g.meta.black : g.meta.white,
        date: g.meta.date,
      });
    }
  }
  return out.sort((a, b) => b.winLoss - a.winLoss).slice(0, limit);
}

export function lessonTitleFor(tag: MotifTag): string {
  return BY_TAG.get(tag)?.title ?? MOTIF_META[tag].label;
}
