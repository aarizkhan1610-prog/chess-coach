import type {
  AnalysedGame, AnalysedMove, MotifTag, MoveVerdict, Phase, Profile, WeaknessStat,
} from '../types';
import { MOTIF_META } from '../types';
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
  }
  const acc = new Map<MotifTag, Acc>();

  // "Recent" is the newest half of the games, by analysis time.
  const ordered = [...games].sort((a, b) => a.analysedAt - b.analysedAt);
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
        };
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

  const stats: WeaknessStat[] = [...acc.entries()].map(([tag, a]) => {
    const perGame = a.winLoss / games.length;
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

  // Momentum: the last five games against the five before them.
  const byDate = [...games].sort((a, b) => a.analysedAt - b.analysedAt);
  const perGameAccuracy = byDate.map((g) => g.accuracy[g.hero]);
  let momentum: number | null = null;
  if (perGameAccuracy.length >= 4) {
    const recent = perGameAccuracy.slice(-5);
    const older = perGameAccuracy.slice(-10, -5);
    if (older.length >= 2) {
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      momentum = Math.round((mean(recent) - mean(older)) * 10) / 10;
    }
  }

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
  if (profile.momentum !== null) {
    out.push(
      profile.momentum >= 1
        ? `You are trending up: recent games are ${profile.momentum} accuracy points better.`
        : profile.momentum <= -1
          ? `Recent games are ${Math.abs(profile.momentum)} accuracy points worse than before — worth a look.`
          : 'Your accuracy has been stable across recent games.',
    );
  }
  const rising = profile.weaknesses.filter((w) => w.trend > 0.5).slice(0, 1);
  if (rising.length) out.push(`${MOTIF_META[rising[0].tag].label} is getting worse, not better.`);
  return out;
}
