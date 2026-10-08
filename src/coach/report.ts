import { MOTIF_META, type AnalysedGame, type AnalysedMove, type Color, type MotifTag, type Phase } from '../types';
import { winPctFor } from '../chess/evaluation';

/*
 * Scoring a game on a handful of axes, so it can be shown as a shape rather
 * than a table of numbers.
 *
 * The same function scores the player's game and every game in the benchmark.
 * That is the whole point: a comparison between two numbers computed different
 * ways is worse than no comparison at all, because it looks trustworthy.
 *
 * Every axis runs 0..100 with higher being better, so the shape reads the
 * obvious way round — bigger is better, and a dent points at the thing to work
 * on. An axis returns null when the game did not contain enough of it to say
 * anything, which is common in a single game and must never be drawn as zero.
 */

export const AXES = [
  { id: 'opening', label: 'Opening', hint: 'Getting pieces out and claiming the centre.' },
  { id: 'middlegame', label: 'Middlegame', hint: 'Play once the pieces are out and the position is sharp.' },
  { id: 'endgame', label: 'Endgame', hint: 'Technique once most of the pieces are traded off.' },
  { id: 'tactics', label: 'Tactics', hint: 'Win probability handed over to forks, pins, hanging pieces and mates, per 40-move game.' },
  { id: 'errors', label: 'Serious errors', hint: 'How often a move threw away a real chunk of the game. Blunders count once, mistakes count half, and one blunder in a 40-move game costs 20 points.' },
  { id: 'conversion', label: 'Converting', hint: 'The most win probability you handed back from a winning position. 100 means a lead you never gave up.' },
] as const;

export type AxisId = (typeof AXES)[number]['id'];

/** Below this many moves, a phase score is noise rather than a measurement. */
const MIN_MOVES = 4;

/** Win percentage above which a position counts as one you ought to be winning. */
const WINNING = 70;

/**
 * Winning positions needed before converting is a fair thing to ask about.
 *
 * A single position at 70% that evaporates is a chance missed, and the tactics
 * and error axes already answer for it. Two is the cheapest bar that stops one
 * ply of engine noise being read as a won game, and — unlike a bar on how
 * *long* the advantage lasted — it does not throw out the fast collapses, which
 * are the whole reason the axis exists.
 */
const MIN_WINNING_POSITIONS = 2;

/** A game's worth of moves, so every rate is quoted per game rather than as a fraction. */
const TYPICAL_GAME = 40;

/** What one blunder in a game of that length costs on the scale. */
const PER_BLUNDER = 20;

/**
 * A mistake counts half.
 *
 * Blunders alone put the median at 100 in four of five rating bands, because
 * the median game at any rating contains none — the axis was measuring
 * correctly and saying nothing. Mistakes are the same failure one notch down
 * and there are enough of them per game for the statistic to move.
 */
const MISTAKE_WEIGHT = 0.5;

function isTactical(tag: MotifTag): boolean {
  return MOTIF_META[tag].family === 'tactics';
}

/**
 * Win probability a 40-move game can shed to tactics before it scores zero.
 *
 * The number has to come from somewhere, and an unbounded sum is not an
 * option: clipped at zero, "a bit careless" and "catastrophic" become the same
 * reading, and most games at the lower ratings sit on the floor. This value was
 * chosen and then checked against the benchmark, which spreads across the range
 * rather than piling up at either end.
 */
const FULL_COST = 200;

/**
 * A rate, not a total. Measured per typical-length game so a long game is not
 * punished for being long, which is the same footing the blunder axis uses.
 */
function rateScore(lossPoints: number, moves: number): number {
  if (moves <= 0) return 100;
  const perGame = (lossPoints / moves) * TYPICAL_GAME;
  return Math.max(0, Math.min(100, Math.round(100 - (perGame / FULL_COST) * 100)));
}

/**
 * The hero's win percentage through the game, in order.
 *
 * Both sides of each of their own moves: a move that throws the game away is
 * visible only in the second number, and the position after the opponent's
 * reply arrives as the first number of the move after.
 */
function winTrajectory(mine: AnalysedMove[], color: Color): number[] {
  const out: number[] = [];
  for (const m of mine) {
    out.push(winPctFor(m.evalBefore, color));
    out.push(winPctFor(m.evalAfter, color));
  }
  return out;
}

/**
 * The most win probability handed back from a winning high-water mark.
 *
 * Drawdown from the running peak, not the sum of per-move losses. The sum
 * measured churn rather than conversion: an evaluation that wobbles between
 * 90% and 86% for twenty moves adds up to a large number while nothing was
 * ever given away, and that is the ordinary shape of a game somebody is
 * winning. Worse, it made the axis quietest about its own worst case — a player
 * who collapsed quickly spent few moves winning, so there was little to sum,
 * and with fewer than four such moves the axis declined to score them at all.
 * Across 300 measured games the old axis also moved 28 points between samples,
 * which is what measuring noise looks like.
 *
 * Measured against the running peak rather than the game's best moment, or a
 * later recovery would paper over the collapse that came before it.
 *
 * Counted in win-probability points and deliberately not divided by the
 * advantage that was there to lose. That scale is already the normalisation —
 * it is why this file measures in win percentage rather than centipawns, and
 * why the tactics axis and the loss breakdown are counted the same way.
 * Dividing by the surplus on top of it normalises twice, and measured over the
 * same 300 games that put 56% of sub-1100 games on exactly zero: at a peak of
 * 72% there are only 22 points to give back, so any ordinary swing saturates.
 *
 * What this says is how much was handed back, not whether the win was finally
 * lost. Giving back 45 points and drawing scores better than giving back 90 and
 * losing, which is the intended ordering; the result itself is on the report
 * beside it.
 */
function worstGiveBack(trajectory: number[]): number | null {
  let peak = -1;
  let worst: number | null = null;
  for (const now of trajectory) {
    if (now > peak) peak = now;
    if (peak < WINNING) continue;
    const given = peak - now;
    if (worst === null || given > worst) worst = given;
  }
  return worst;
}

export type AxisScores = Record<AxisId, number | null>;

export function scoreGame(game: AnalysedGame, color: Color): AxisScores {
  const mine = game.moves.filter((m) => m.color === color);
  const phaseScore = (phase: Phase): number | null => {
    const count = mine.filter((m) => m.phase === phase).length;
    if (count < MIN_MOVES) return null;
    return Math.round(game.accuracyByPhase[phase][color]);
  };

  const lostTo = (match: (m: AnalysedMove) => boolean): number =>
    mine.filter(match).reduce((n, m) => n + m.winLoss, 0);

  /*
   * Converting is only a question if there was ever anything to convert, and
   * scoring it out of positions that were never winning would punish a player
   * for having a hard game.
   */
  const trajectory = winTrajectory(mine, color);
  const everWinning = trajectory.filter((w) => w >= WINNING).length;
  const giveBack = everWinning >= MIN_WINNING_POSITIONS ? worstGiveBack(trajectory) : null;

  return {
    opening: phaseScore('opening'),
    middlegame: phaseScore('middlegame'),
    endgame: phaseScore('endgame'),
    tactics: mine.length < MIN_MOVES ? null : rateScore(lostTo((m) => m.motifs.some(isTactical)), mine.length),
    /*
     * A rate rather than a count, so a long game is not punished for being
     * long, expressed per typical-length game because "two blunders a game" is
     * a thing a person can picture and "0.05" is not.
     */
    errors: mine.length < MIN_MOVES
      ? null
      : Math.max(0, Math.round(
        100 - (
          (mine.filter((m) => m.verdict === 'blunder').length
            + mine.filter((m) => m.verdict === 'mistake').length * MISTAKE_WEIGHT)
          / mine.length
        ) * TYPICAL_GAME * PER_BLUNDER,
      )),
    /*
     * A drawdown rather than a rate, so the number means the same thing in a
     * 20-move game and a 70-move one — and so the axis answers loudest in the
     * case it is named for, a won game given away.
     */
    conversion: mine.length < MIN_MOVES || giveBack === null
      ? null
      : Math.max(0, Math.min(100, Math.round(100 - giveBack))),
  };
}

/* ------------------------------------------------------------------ *
 * The benchmark
 * ------------------------------------------------------------------ */

export interface Band {
  /** Inclusive. */
  from: number;
  /** Inclusive. */
  to: number;
  label: string;
}

export interface BandStats extends Band {
  /** How many games went into this band. Shown, because a reader deserves it. */
  games: number;
  /**
   * Median score per axis, and the quartiles either side of it. Null where too
   * few games in the band could answer that axis — a benchmark of zero would
   * put the typical line on the centre point and make any score look stellar.
   */
  median: Record<AxisId, number | null>;
  p25: Record<AxisId, number | null>;
  p75: Record<AxisId, number | null>;
  /** How many games actually contributed to each axis. */
  n: Record<AxisId, number>;
}

export const BANDS: Band[] = [
  { from: 0, to: 1099, label: 'Under 1100' },
  { from: 1100, to: 1399, label: '1100–1399' },
  { from: 1400, to: 1699, label: '1400–1699' },
  { from: 1700, to: 1999, label: '1700–1999' },
  { from: 2000, to: 9999, label: '2000+' },
];

export function bandFor(rating: number): Band {
  return BANDS.find((b) => rating >= b.from && rating <= b.to) ?? BANDS[BANDS.length - 1];
}

/** The rating the app believes the player had in this game, if the file said. */
export function ratingIn(game: AnalysedGame): number | null {
  return game.hero === 'w' ? game.meta.whiteElo : game.meta.blackElo;
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return Math.round(sorted[lo]);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

/** Below this many games a band is not worth comparing against. */
export const MIN_SAMPLE = 8;

export interface BandChoice {
  band: BandStats;
  /** False when the player's own band was too thinly sampled to use. */
  exact: boolean;
}

/**
 * The band to compare against, and whether it is really the player's own.
 *
 * A band built from three games is not a benchmark, so a thin one is passed
 * over for the nearest properly sampled one — and the caller is told, because
 * "typical for your rating" has to be true or it should not be on screen.
 */
export function pickBand(benchmark: BandStats[], rating: number | null): BandChoice | null {
  const usable = benchmark.filter((b) => b.games >= MIN_SAMPLE);
  if (!usable.length) return null;
  if (rating === null) return null;

  const own = usable.find((b) => rating >= b.from && rating <= b.to);
  if (own) return { band: own, exact: true };

  const midpoint = (b: BandStats) => (b.from + Math.min(b.to, 3000)) / 2;
  const nearest = usable.reduce((a, b) =>
    Math.abs(midpoint(b) - rating) < Math.abs(midpoint(a) - rating) ? b : a);
  return { band: nearest, exact: false };
}

/** Roll a set of scored games into the band summary the chart reads. */
/** Readings needed on one axis before that axis is worth comparing against. */
export const MIN_AXIS_SAMPLE = 5;

export function summarise(band: Band, scored: AxisScores[]): BandStats {
  const median = {} as Record<AxisId, number | null>;
  const p25 = {} as Record<AxisId, number | null>;
  const p75 = {} as Record<AxisId, number | null>;
  const n = {} as Record<AxisId, number>;

  for (const axis of AXES) {
    // Null means the game had nothing to say about this axis, so it is left
    // out of the average rather than counted as a zero.
    const values = scored
      .map((s) => s[axis.id])
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    n[axis.id] = values.length;
    const enough = values.length >= MIN_AXIS_SAMPLE;
    median[axis.id] = enough ? percentile(values, 0.5) : null;
    p25[axis.id] = enough ? percentile(values, 0.25) : null;
    p75[axis.id] = enough ? percentile(values, 0.75) : null;
  }

  return { ...band, games: scored.length, median, p25, p75, n };
}

/**
 * One shape for a whole set of games.
 *
 * The median of the per-game scores rather than the mean, and the same
 * statistic the benchmark itself is built from — so the player's shape and the
 * band's shape are computed the same way and can honestly be drawn on top of
 * one another. A single disastrous game should not redraw the profile, which is
 * exactly what a mean would let it do.
 */
export function aggregateScores(games: AnalysedGame[], minGames = 3): AxisScores {
  const scored = games.map((g) => scoreGame(g, g.hero));
  const out = {} as AxisScores;
  for (const axis of AXES) {
    const values = scored
      .map((s) => s[axis.id])
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    out[axis.id] = values.length >= minGames ? percentile(values, 0.5) : null;
  }
  return out;
}

/**
 * Games in one opening before it is worth scoring.
 *
 * Two is thin and the table says so by printing the count beside every row.
 * The alternative is a bar high enough that almost nobody clears it: a player
 * with twenty games spreads them over a dozen openings, and an opening card
 * that stays empty until the fiftieth game is not a feature.
 */
export const MIN_OPENING_GAMES = 2;

export interface OpeningScore {
  openingId: string;
  name: string;
  games: number;
  /** Result percentage across those games — a win is 100, a draw 50. */
  score: number;
  /** Median opening-phase score, on the same 0..100 scale as the axis. */
  opening: number | null;
  /** What the band scores in the opening phase, across all of its openings. */
  typical: number | null;
  /** Opening-phase score minus typical. Negative is worse than the band. */
  gap: number | null;
}

function resultPoints(result: string, hero: Color): number {
  if (result === '1/2-1/2') return 50;
  if (result === '1-0') return hero === 'w' ? 100 : 0;
  if (result === '0-1') return hero === 'b' ? 100 : 0;
  return 50;
}

/**
 * Each opening the player has played, scored against their rating band.
 *
 * The baseline is the band's opening-phase median — how players at this rating
 * handle the opening in general, not how they handle *this* opening. That
 * distinction is real and the interface has to carry it: across 300 measured
 * games the commonest single opening appeared 19 times spread over five bands,
 * and at most three openings in any band reached five games. A per-opening
 * baseline would be built from samples of two or three, which is a number with
 * a confidence interval wider than the scale it sits on.
 *
 * What the comparison does answer is worth having on its own: of the openings
 * you play, which ones leave you worse placed than you usually are by the time
 * the opening is over.
 */
export function scoreOpenings(
  games: AnalysedGame[],
  band: BandStats | null,
  minGames = MIN_OPENING_GAMES,
): OpeningScore[] {
  const typical = band?.median.opening ?? null;
  const by = new Map<string, { name: string; results: number[]; opening: number[] }>();

  for (const game of games) {
    if (!game.openingId) continue;
    const entry = by.get(game.openingId)
      ?? { name: game.openingName ?? game.openingId, results: [], opening: [] };
    entry.results.push(resultPoints(game.meta.result, game.hero));
    const scored = scoreGame(game, game.hero).opening;
    if (scored !== null) entry.opening.push(scored);
    by.set(game.openingId, entry);
  }

  return [...by.entries()]
    .map(([openingId, e]) => {
      const enough = e.results.length >= minGames && e.opening.length >= minGames;
      const opening = enough ? percentile([...e.opening].sort((a, b) => a - b), 0.5) : null;
      return {
        openingId,
        name: e.name,
        games: e.results.length,
        score: Math.round((e.results.reduce((a, b) => a + b, 0) / e.results.length) * 10) / 10,
        opening,
        typical,
        gap: opening !== null && typical !== null ? opening - typical : null,
      };
    })
    /* Worst against the band first, then whatever could not be scored, so the
     * row worth reading is the one at the top. */
    .sort((a, b) => {
      if (a.gap === null && b.gap === null) return b.games - a.games;
      if (a.gap === null) return 1;
      if (b.gap === null) return -1;
      return a.gap - b.gap;
    });
}

export interface LossBreakdown {
  /** Win-probability points the player gave away across every game. */
  total: number;
  byPhase: Record<Phase, number>;
  /** Loss the motif detector could not attribute to any named cause. */
  unattributed: number;
}

/**
 * Where the win probability actually went.
 *
 * The phase totals are the whole of it, so they add up to `total` by
 * construction. The named causes do not: a move can lose ground without any
 * motif firing, and pretending otherwise would quietly inflate every cause's
 * share. `unattributed` is that remainder, shown rather than hidden.
 */
export function lossBreakdown(games: AnalysedGame[], attributed: number): LossBreakdown {
  const byPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };
  let total = 0;

  for (const game of games) {
    for (const move of game.moves) {
      if (move.color !== game.hero) continue;
      byPhase[move.phase] += move.winLoss;
      total += move.winLoss;
    }
  }

  return {
    total: Math.round(total),
    byPhase: {
      opening: Math.round(byPhase.opening),
      middlegame: Math.round(byPhase.middlegame),
      endgame: Math.round(byPhase.endgame),
    },
    unattributed: Math.max(0, Math.round(total - attributed)),
  };
}

/** Per-game accuracy in the order they were played, for a trend. */
export function accuracyOverTime(games: AnalysedGame[]): { id: string; label: string; accuracy: number }[] {
  return [...games]
    .sort((a, b) => a.analysedAt - b.analysedAt)
    .map((g) => ({
      id: g.id,
      label: g.hero === 'w' ? g.meta.black : g.meta.white,
      accuracy: g.accuracy[g.hero],
    }));
}

/** The axes both the game and the benchmark can actually speak to. */
export function comparableAxes(scores: AxisScores, band: BandStats) {
  return AXES.filter((a) => scores[a.id] !== null && band.median[a.id] !== null);
}
