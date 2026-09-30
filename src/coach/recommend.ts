import { MOTIF_META, type AnalysedGame, type MotifTag } from '../types';
import { AXES, bandFor, pickBand, type AxisId } from './report';
import { BENCHMARK } from './benchmark';
import { buildProfile } from './weaknesses';
import { lessonFor } from './lessons';
import { ALL_OPENINGS, openingById } from '../openings';

/*
 * What to point someone at.
 *
 * Two sources, in strict order of authority. Once there are games, the
 * recommendation comes from what this player actually keeps doing — that is
 * the whole point of the app. Before then the only fact available is the
 * rating they typed in, and rather than guess what players at that level need,
 * the benchmark is asked: it already measures, from real games, which part of
 * the game is weakest at each rating.
 *
 * Lessons, puzzles and openings are reached through here rather than from the
 * navigation, so nothing is suggested without a reason attached to it.
 */

export type RecommendSource = 'your-games' | 'your-rating' | 'starting-out';

export interface Recommendation {
  id: string;
  title: string;
  /** Why this, and not something else. Always specific enough to argue with. */
  why: string;
  href: string;
  cta: string;
  source: RecommendSource;
}

/** The resource that addresses each part of the game. */
const AXIS_LESSON: Record<AxisId, MotifTag> = {
  opening: 'development',
  middlegame: 'lost-the-initiative',
  endgame: 'endgame-technique',
  tactics: 'hanging-piece',
  blunders: 'hanging-piece',
  conversion: 'converting-advantage',
};

function lessonLink(tag: MotifTag): { title: string; href: string } {
  const lesson = lessonFor(tag);
  return {
    title: lesson ? lesson.title : MOTIF_META[tag].label,
    href: `/lessons/${tag}`,
  };
}

/** The weakest measured part of the game for players at this rating. */
function weakestAt(rating: number): { axis: (typeof AXES)[number]; median: number } | null {
  const choice = pickBand(BENCHMARK, rating);
  if (!choice) return null;
  const scored = AXES
    .map((axis) => ({ axis, median: choice.band.median[axis.id] }))
    .filter((x): x is { axis: (typeof AXES)[number]; median: number } => x.median !== null)
    // A saturated axis says nothing about what to work on.
    .filter((x) => x.median < 95)
    .sort((a, b) => a.median - b.median);
  return scored[0] ?? null;
}

export function recommend(games: AnalysedGame[], rating: number | null, limit = 3): Recommendation[] {
  const out: Recommendation[] = [];

  /* ---- what this player keeps doing ---- */
  if (games.length) {
    const profile = buildProfile(games);
    for (const weakness of profile.weaknesses.slice(0, limit)) {
      const link = lessonLink(weakness.tag);
      out.push({
        id: `weakness:${weakness.tag}`,
        title: link.title,
        why: `${MOTIF_META[weakness.tag].label} has cost you ${Math.round(weakness.perGame)} points a game across ${weakness.gamesAffected} of your games.`,
        href: link.href,
        cta: 'Work on it',
        source: 'your-games',
      });
    }

    // Puzzles built from this player's own missed moves, not a generic pack.
    const blunders = games.reduce(
      (n, g) => n + g.moves.filter((m) => m.color === g.hero && m.verdict === 'blunder').length,
      0,
    );
    if (blunders > 0) {
      out.push({
        id: 'puzzles:yours',
        title: 'Puzzles from your own blunders',
        why: `Your games contain ${blunders} blunder${blunders === 1 ? '' : 's'}, each one a position you have already proved you get wrong.`,
        href: '/puzzles/weakness',
        cta: 'Drill them',
        source: 'your-games',
      });
    }

    // The opening actually played most, rather than one chosen for them.
    const played = profile.openingRecord[0];
    if (played && ALL_OPENINGS.some((o) => o.id === played.openingId)) {
      out.push({
        id: `opening:${played.openingId}`,
        title: played.name,
        why: `You have played this in ${played.games} game${played.games === 1 ? '' : 's'}, scoring ${Math.round(played.score)}%.`,
        href: `/openings/${played.openingId}`,
        cta: 'Learn the ideas',
        source: 'your-games',
      });
    }
  }

  if (out.length >= limit) return out.slice(0, limit);

  /* ---- what players at this rating are measurably weakest at ---- */
  if (rating !== null) {
    const weakest = weakestAt(rating);
    if (weakest) {
      const tag = AXIS_LESSON[weakest.axis.id];
      const link = lessonLink(tag);
      out.push({
        id: `band:${weakest.axis.id}`,
        title: link.title,
        why: `Across real games at ${bandFor(rating).label}, ${weakest.axis.label.toLowerCase()} is the weakest part of the game — a median of ${weakest.median} out of 100.`,
        href: link.href,
        cta: 'Start here',
        source: 'your-rating',
      });
      out.push({
        id: 'puzzles:starter',
        title: 'Sharpen the pattern recognition',
        why: 'Tactics decide almost every game below master level, and they are the one thing that improves purely by repetition.',
        href: '/puzzles',
        cta: 'Solve some',
        source: 'your-rating',
      });
    }
    out.push({
      id: 'import',
      title: 'Let the coach read your games',
      why: 'A rating says what players like you tend to struggle with. Your own games say what you struggle with.',
      href: '/import',
      cta: 'Import them',
      source: 'your-rating',
    });
  }

  /* ---- no rating, no games ---- */
  if (!out.length) {
    out.push({
      id: 'basics',
      title: 'Learn how the pieces move',
      why: 'Ten short sections and a famous game played move by move, with the reasoning for each one.',
      href: '/basics',
      cta: 'Start',
      source: 'starting-out',
    });
    out.push({
      id: 'basics:play',
      title: 'Play a game with a coach watching',
      why: 'A deliberately weak opponent, and every move you make explained as you go.',
      href: '/basics/play',
      cta: 'Play',
      source: 'starting-out',
    });
  }

  return out.slice(0, limit);
}

/**
 * What to do about *this* game.
 *
 * Deliberately narrower than the home page, which speaks for a whole history.
 * Here the reasons are drawn from the game on screen — the habit that cost the
 * most in it, the opening it was actually played in — because that is the
 * question someone has while looking at it, and a recommendation that could
 * have been made before they opened the page is not worth the space.
 */
export function recommendForGame(game: AnalysedGame): Recommendation[] {
  const out: Recommendation[] = [];
  const mine = game.moves.filter((m) => m.color === game.hero);
  const errors = mine.filter((m) => ['inaccuracy', 'mistake', 'blunder'].includes(m.verdict));

  /* The cause that cost the most here, splitting a move's cost between its causes. */
  const cost = new Map<MotifTag, { points: number; moves: number }>();
  for (const move of errors) {
    const causes = move.motifs.filter((t) => MOTIF_META[t].family !== 'phase');
    for (const tag of causes) {
      const prev = cost.get(tag) ?? { points: 0, moves: 0 };
      cost.set(tag, { points: prev.points + move.winLoss / causes.length, moves: prev.moves + 1 });
    }
  }
  const worst = [...cost.entries()].sort((a, b) => b[1].points - a[1].points)[0];
  if (worst) {
    const [tag, stat] = worst;
    const link = lessonLink(tag);
    out.push({
      id: `game-lesson:${tag}`,
      title: link.title,
      why: `${MOTIF_META[tag].label} cost you ${Math.round(stat.points)} points in this game alone, over ${stat.moves} move${stat.moves === 1 ? '' : 's'}.`,
      href: link.href,
      cta: 'Read the lesson',
      source: 'your-games',
    });
  }

  if (game.openingId && openingById(game.openingId)) {
    out.push({
      id: `game-opening:${game.openingId}`,
      title: game.openingName ?? 'This opening',
      why: `You left the book on move ${Math.floor(game.bookPlies / 2) + 1}. The course covers the ideas from there.`,
      href: `/openings/${game.openingId}`,
      cta: 'Learn the ideas',
      source: 'your-games',
    });
  }

  const replayable = mine.filter((m) => m.verdict === 'blunder' || m.verdict === 'mistake').length;
  if (replayable) {
    out.push({
      id: 'game-rewind',
      title: 'Replay what you missed',
      why: `${replayable} position${replayable === 1 ? '' : 's'} in this game where the move you wanted was there to be found.`,
      href: '/puzzles/rewind',
      cta: 'Try them',
      source: 'your-games',
    });
  }

  return out;
}

/** A rating already known from the games, so the question need not be asked. */
export function ratingFromGames(games: AnalysedGame[]): number | null {
  const ratings = games
    .map((g) => (g.hero === 'w' ? g.meta.whiteElo : g.meta.blackElo))
    .filter((r): r is number => typeof r === 'number' && r > 0);
  if (!ratings.length) return null;
  return Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
}
