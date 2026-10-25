import type {
  AnalysedGame, AnalysedMove, MotifTag, MoveVerdict, Phase, Profile, WeaknessStat,
} from '../types';
import { MOTIF_META } from '../types';
import { byPlayed, splitTrend } from './progress';
import { gameAccuracy, winPctFor } from '../chess/evaluation';
import { resultScore } from '../chess/pgn';

const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

function heroMoves(game: AnalysedGame): AnalysedMove[] {
  return game.moves.filter((m) => m.color === game.hero);
}

function emptyVerdicts(): Record<MoveVerdict, number> {
  return { brilliant: 0, great: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, forced: 0 };
}

/**
 * Turn a set of analysed games into a ranked list of weaknesses.
 *
 * Attribution rule: a move tagged with two motifs splits its win% loss between
 * them, so a single blunder cannot inflate several categories at once.
 */
export function buildWeaknesses(games: AnalysedGame[]): WeaknessStat[] {
  if (!games.length) return [];

  interface Acc {
    occurrences: number;
    winLoss: number;
    games: Set<string>;
    examples: { gameId: string; ply: number; winLoss: number }[];
    recentWinLoss: number;
    olderWinLoss: number;
    /** What this habit cost in each game it appeared in. */
    byGame: Map<string, number>;
  }
  const acc = new Map<MotifTag, Acc>();

  /*
   * "Recent" is the newest half of the games by when they were played.
   *
   * It used to be by when they were analysed, which is not the same order and
   * for the commonest import is the opposite one: Lichess returns a player's
   * games newest first, a batch is analysed in the order it arrives, and so the
   * newest game got the earliest analysis time. Every "improving" and "getting
   * worse" on a Lichess import was reading time backwards.
   */
  const ordered = byPlayed(games);
  const splitAt = Math.floor(ordered.length / 2);
  const recentIds = new Set(ordered.slice(splitAt).map((g) => g.id));
  const recentCount = ordered.length - splitAt;
  const olderCount = splitAt;

  let totalWinLoss = 0;

  for (const game of games) {
    for (const move of heroMoves(game)) {
      if (!move.motifs.length) continue;
      const share = move.winLoss / move.motifs.length;
      for (const tag of move.motifs) {
        const a = acc.get(tag) ?? {
          occurrences: 0, winLoss: 0, games: new Set<string>(), examples: [], recentWinLoss: 0, olderWinLoss: 0,
          byGame: new Map<string, number>(),
        };
        a.byGame.set(game.id, (a.byGame.get(game.id) ?? 0) + share);
        a.occurrences++;
        a.winLoss += share;
        a.games.add(game.id);
        a.examples.push({ gameId: game.id, ply: move.ply, winLoss: move.winLoss });
        if (recentIds.has(game.id)) a.recentWinLoss += share;
        else a.olderWinLoss += share;
        acc.set(tag, a);
        totalWinLoss += share;
      }
    }
  }

  const olderGames = ordered.slice(0, splitAt);
  const newerGames = ordered.slice(splitAt);

  const stats: WeaknessStat[] = [...acc.entries()].map(([tag, a]) => {
    const perGame = a.winLoss / games.length;
    /*
     * Every game counts on its side of the split, including the ones where the
     * habit never came up — a game it did not cost anything in is evidence too.
     * Lower is better: this is a cost.
     */
    const reading = splitTrend(
      olderGames.map((g) => a.byGame.get(g.id) ?? 0),
      newerGames.map((g) => a.byGame.get(g.id) ?? 0),
      false,
    );
    const recentRate = recentCount ? a.recentWinLoss / recentCount : 0;
    const olderRate = olderCount ? a.olderWinLoss / olderCount : 0;
    return {
      tag,
      occurrences: a.occurrences,
      gamesAffected: a.games.size,
      winLoss: Math.round(a.winLoss * 10) / 10,
      perGame: Math.round(perGame * 10) / 10,
      share: totalWinLoss > 0 ? Math.round((a.winLoss / totalWinLoss) * 1000) / 10 : 0,
      severity: 0,
      trend: olderCount && recentCount ? Math.round((recentRate - olderRate) * 10) / 10 : 0,
      trendVerdict: reading.verdict,
      examples: a.examples
        .sort((x, y) => y.winLoss - x.winLoss)
        .slice(0, 8)
        .map(({ gameId, ply }) => ({ gameId, ply })),
    };
  });

  // Severity is a relative priority: the costliest weakness anchors at 100.
  const maxPerGame = Math.max(...stats.map((s) => s.perGame), 0.0001);
  for (const s of stats) s.severity = Math.round((s.perGame / maxPerGame) * 100);

  return stats.sort((a, b) => b.perGame - a.perGame);
}

export function buildProfile(games: AnalysedGame[]): Profile {
  const verdicts = emptyVerdicts();
  let moveCount = 0;
  const allSamples: { accuracy: number; winPctBefore: number }[] = [];
  const phaseSamples: Record<Phase, { accuracy: number; winPctBefore: number }[]> = {
    opening: [], middlegame: [], endgame: [],
  };

  for (const game of games) {
    for (const m of heroMoves(game)) {
      moveCount++;
      verdicts[m.verdict]++;
      const sample = { accuracy: m.accuracy, winPctBefore: winPctFor(m.evalBefore, m.color) };
      allSamples.push(sample);
      phaseSamples[m.phase].push(sample);
    }
  }

  /*
   * Momentum: your most recent games against the ones just before them, by
   * when they were played.
   *
   * It was the last five against the five before, labelled as soon as they
   * differed by a point — which, with how much one game's accuracy varies from
   * the next, they almost always do: on games in a random order it reported a
   * trend 88–92% of the time. It now looks at up to the last twenty games, ten
   * against ten, and only calls it a trend when the gap is beyond chance.
   * Twenty rather than every game, because "recently" should still mean
   * recently for somebody with two hundred games.
   */
  const recentWindow = byPlayed(games).slice(-20).map((g) => g.accuracy[g.hero]);
  const half = Math.floor(recentWindow.length / 2);
  const momentumReading = splitTrend(recentWindow.slice(0, half), recentWindow.slice(half), true);
  const momentum = recentWindow.length >= 4 ? momentumReading.change : null;

  // Per-opening record from the hero's point of view.
  const openings = new Map<string, { name: string; games: number; score: number; acc: number[] }>();
  for (const g of games) {
    if (!g.openingId) continue;
    const entry = openings.get(g.openingId) ?? { name: g.openingName ?? g.openingId, games: 0, score: 0, acc: [] };
    entry.games++;
    entry.score += resultScore(g.meta.result, g.hero);
    entry.acc.push(g.accuracy[g.hero]);
    openings.set(g.openingId, entry);
  }

  return {
    games: games.length,
    moves: moveCount,
    accuracy: Math.round(gameAccuracy(allSamples) * 10) / 10,
    accuracyByPhase: Object.fromEntries(
      PHASES.map((p) => [p, Math.round(gameAccuracy(phaseSamples[p]) * 10) / 10]),
    ) as Record<Phase, number>,
    verdicts,
    weaknesses: buildWeaknesses(games),
    momentum,
    momentumVerdict: momentumReading.verdict,
    openingRecord: [...openings.entries()]
      .map(([openingId, e]) => ({
        openingId,
        name: e.name,
        games: e.games,
        score: Math.round((e.score / e.games) * 1000) / 10,
        accuracy: Math.round((e.acc.reduce((a, b) => a + b, 0) / e.acc.length) * 10) / 10,
      }))
      .sort((a, b) => b.games - a.games),
  };
}

/** A short, plain-language summary of what to work on. */
export function coachSummary(profile: Profile): string[] {
  const out: string[] = [];
  if (!profile.games) return ['Import a few games and I will tell you what to work on.'];

  const top = profile.weaknesses.slice(0, 3);
  if (top.length) {
    out.push(
      `Your most expensive habit is ${MOTIF_META[top[0].tag].label.toLowerCase()}, which costs about ${top[0].perGame} win-probability points per game.`,
    );
  }
  const phases = Object.entries(profile.accuracyByPhase) as [Phase, number][];
  const played = phases.filter(([, v]) => v > 0);
  if (played.length >= 2) {
    const worst = played.reduce((a, b) => (b[1] < a[1] ? b : a));
    out.push(`Your weakest phase is the ${worst[0]} at ${worst[1]}% accuracy.`);
  }
  if (profile.verdicts.blunder > 0) {
    const per = profile.verdicts.blunder / profile.games;
    out.push(`You blunder ${per.toFixed(1)} times per game on average.`);
  }
  /*
   * Only a trend that survived the test is reported as one. An unclear result
   * is said as unclear, not as "stable" — with ten games a side the test
   * cannot tell steady from slowly moving, and claiming either would be a guess.
   */
  if (profile.momentumVerdict === 'improving') {
    out.push(`You are trending up: recent games are ${profile.momentum} accuracy points better, more than chance would explain.`);
  } else if (profile.momentumVerdict === 'worse') {
    out.push(`Recent games are ${Math.abs(profile.momentum ?? 0)} accuracy points worse than the ones before, more than chance would explain — worth a look.`);
  } else if (profile.momentumVerdict === 'unclear') {
    out.push('Your recent games are not clearly better or worse than the ones before them.');
  }
  const rising = profile.weaknesses.filter((w) => w.trendVerdict === 'worse').slice(0, 1);
  if (rising.length) out.push(`${MOTIF_META[rising[0].tag].label} is getting worse, not better.`);
  return out;
}
