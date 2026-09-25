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

/**
 * A teaching order for someone with no games imported yet.
 *
 * The personalised plan is always better when it exists, because it is built
 * from what you actually get wrong. This is the fallback: the same lessons in
 * the order that tends to pay off fastest, cheapest habits first.
 */
export const CORE_TRACK: { tag: MotifTag; why: string }[] = [
  { tag: 'hanging-piece', why: 'More games are lost to an undefended piece than to every opening mistake combined.' },
  { tag: 'moved-into-attack', why: 'The other half of the same habit: check the square before you commit the piece.' },
  { tag: 'ignored-threat', why: 'Now build the habit of asking what your opponent just did, every move.' },
  { tag: 'missed-material', why: 'The cheapest source of free points: look at every capture before choosing.' },
  { tag: 'back-rank', why: 'One pawn move prevents an entire category of loss. Worth ten minutes.' },
  { tag: 'allowed-fork', why: 'The most common way material changes hands below master level.' },
  { tag: 'king-safety', why: 'Every other advantage depends on your king surviving.' },
  { tag: 'development', why: 'Almost every opening disaster traces back to attacking with two pieces.' },
  { tag: 'converting-advantage', why: 'Winning positions are a skill of their own — and the most frustrating to lose.' },
  { tag: 'bad-trade', why: 'An even trade of material can still be a losing trade.' },
  { tag: 'endgame-technique', why: 'The most learnable part of chess: concrete positions, knowledge that never expires.' },
];

export interface TrackStep {
  lesson: Lesson;
  why: string;
  done: boolean;
}

/** The core track, resolved to lessons and annotated with progress. */
export function coreTrack(done: Record<string, boolean>): TrackStep[] {
  return CORE_TRACK.flatMap(({ tag, why }) => {
    const lesson = BY_TAG.get(tag);
    return lesson ? [{ lesson, why, done: Boolean(done[tag]) }] : [];
  });
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
