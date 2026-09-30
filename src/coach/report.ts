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
  { id: 'blunders', label: 'Blunders', hint: 'How often a move threw away a large chunk of the game. Each blunder in a 40-move game costs 20 points.' },
  { id: 'conversion', label: 'Converting', hint: 'How much of a winning position you handed back, per 40-move game.' },
] as const;

export type AxisId = (typeof AXES)[number]['id'];

/** Below this many moves, a phase score is noise rather than a measurement. */
const MIN_MOVES = 4;

/** Win percentage above which a position counts as one you ought to be winning. */
const WINNING = 70;

/** A game's worth of moves, so every rate is quoted per game rather than as a fraction. */
const TYPICAL_GAME = 40;

/** What one blunder in a game of that length costs on the scale. */
const PER_BLUNDER = 20;

function isTactical(tag: MotifTag): boolean {
  return MOTIF_META[tag].family === 'tactics';
}

/**
 * Win probability a 40-move game can shed on one axis before it scores zero.
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
  const winning = mine.filter((m) => winPctFor(m.evalBefore, color) >= WINNING);

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
    blunders: mine.length < MIN_MOVES
      ? null
      : Math.max(0, Math.round(
        100 - (mine.filter((m) => m.verdict === 'blunder').length / mine.length) * TYPICAL_GAME * PER_BLUNDER,
      )),
    /*
     * Divided by the whole game rather than by the winning moves alone: a
     * player who was winning for five moves and threw it away should not be
     * measured on a five-move denominator, which would read as a total
     * collapse whatever they did next.
     */
    conversion: winning.length < MIN_MOVES
      ? null
      : rateScore(winning.reduce((n, m) => n + m.winLoss, 0), mine.length),
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

/** The axes both the game and the benchmark can actually speak to. */
export function comparableAxes(scores: AxisScores, band: BandStats) {
  return AXES.filter((a) => scores[a.id] !== null && band.median[a.id] !== null);
}
