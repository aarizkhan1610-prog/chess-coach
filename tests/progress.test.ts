/**
 * Time, training, and whether training worked.
 *
 * Two things are checked here. The first is a bug that read time backwards:
 * games were ordered by when they were analysed, and Lichess hands a player's
 * games over newest first, so every trend on a Lichess import was inverted.
 * The second is the before/after comparison that decides whether training a
 * habit changed anything — mostly the cases where it must refuse to say.
 */
import { playedAtFrom } from '../src/chess/pgn';
import { buildProfile, buildWeaknesses } from '../src/coach/weaknesses';
import { accuracyOverTime } from '../src/coach/report';
import {
  MIN_SIDE, byPlayed, logged, motifCost, permutationP, progressFor, whenPlayed, type TrainingRecord,
} from '../src/coach/progress';
import type { AnalysedGame, AnalysedMove, MotifTag } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  (JSON.stringify(got) === JSON.stringify(want) ? ok(n, String(got)) : bad(n, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const HOUR = 3600_000;
const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);

function move(over: Partial<AnalysedMove>): AnalysedMove {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'e4', uci: 'e2e4', fenBefore: '', fenAfter: '',
    evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
    winLoss: 0, accuracy: 100, verdict: 'good', phase: 'middlegame',
    bestSan: null, bestLineSan: [], bestLineUci: [], refutationSan: [], refutationUci: [],
    secondBestWinLoss: null, alternativesSan: [], motifs: [], secondsSpent: null, stableFromDepth: 0,
    ...over,
  } as AnalysedMove;
}

let seq = 0;
/** A game played at `playedAt`, losing `cost` to `tag` once (or nothing). */
function game(opts: { playedAt?: number | null; date?: string | null; analysedAt?: number; cost?: number; tag?: MotifTag; accuracy?: number }): AnalysedGame {
  const id = `g${seq++}`;
  const moves: AnalysedMove[] = [move({ ply: 0 }), move({ ply: 2 })];
  if (opts.cost) moves.push(move({ ply: 4, winLoss: opts.cost, motifs: [opts.tag ?? 'hanging-piece'], verdict: 'blunder' }));
  const acc = opts.accuracy ?? 80;
  return {
    id, hero: 'w',
    meta: {
      white: 'me', black: id, result: '1-0', event: null, whiteElo: 1500, blackElo: 1500,
      timeControl: null, eco: null, termination: null,
      date: opts.date !== undefined ? opts.date : null,
      playedAt: opts.playedAt,
    },
    moves, openingId: null, openingName: null, bookPlies: 0,
    accuracy: { w: acc, b: acc },
    accuracyByPhase: { opening: { w: acc, b: acc }, middlegame: { w: acc, b: acc }, endgame: { w: acc, b: acc } },
    counts: { w: {} as never, b: {} as never },
    depth: 12, analysedAt: opts.analysedAt ?? T0, startingFen: '',
  };
}

/* ---- reading the clock off a PGN ---- */
{
  eq('a UTC date and time', playedAtFrom('2026.10.13', '13:18:00'), Date.UTC(2026, 9, 13, 13, 18, 0));
  eq('a time without seconds', playedAtFrom('2026.10.13', '09:05'), Date.UTC(2026, 9, 13, 9, 5, 0));
  eq('no time means midnight', playedAtFrom('2026.10.13', null), Date.UTC(2026, 9, 13));
  eq('an unknown date is no date', playedAtFrom('2026.??.??', '12:00:00'), null);
  eq('no date at all', playedAtFrom(null, '12:00:00'), null);
}

/* ---- precision ---- */
{
  eq('a known time is precise', whenPlayed(game({ playedAt: T0, date: '2026.10.01' }))?.precise, true);
  eq('a date alone is not', whenPlayed(game({ playedAt: null, date: '2026.10.01' }))?.precise, false);
  eq('and sits at midnight', whenPlayed(game({ playedAt: null, date: '2026.10.01' }))?.at, Date.UTC(2026, 9, 1));
  eq('no date is no time', whenPlayed(game({ playedAt: null, date: null })), null);
}

/*
 * ---- the inversion ----
 *
 * Lichess returns newest first and a batch is analysed in the order it
 * arrives, so analysis time runs opposite to play time. Six games: the oldest
 * three hang pieces, the newest three do not. That is somebody who stopped
 * hanging pieces, and every reading below must say so.
 */
{
  const played = [0, 1, 2, 3, 4, 5].map((i) => T0 + i * HOUR);
  const batch = played
    .slice().reverse()                                   // newest first, as Lichess sends them
    .map((at, i) => game({
      playedAt: at,
      date: '2026.10.01',
      analysedAt: T0 + 100 * HOUR + i * 1000,            // analysed in arrival order
      cost: at < T0 + 3 * HOUR ? 30 : 0,                 // only the three oldest hang a piece
      accuracy: at < T0 + 3 * HOUR ? 60 : 90,
    }));

  eq('games sort by when they were played', byPlayed(batch).map((g) => whenPlayed(g)!.at), played);

  const hanging = buildWeaknesses(batch).find((w) => w.tag === 'hanging-piece')!;
  if (hanging.trend < 0) ok('a habit that stopped reads as improving', `trend ${hanging.trend}`);
  else bad('a habit that stopped should read as improving — this is the inversion', `trend ${hanging.trend}`);

  const series = accuracyOverTime(batch).map((p) => p.accuracy);
  eq('the accuracy chart runs oldest to newest', series, [60, 60, 60, 90, 90, 90]);
}

/* Momentum needs ten games to compare five with five. */
{
  const played = Array.from({ length: 10 }, (_, i) => T0 + i * HOUR);
  const batch = played.slice().reverse().map((at, i) => game({
    playedAt: at, date: '2026.10.01', analysedAt: T0 + 100 * HOUR + i * 1000,
    accuracy: at < T0 + 5 * HOUR ? 60 : 90,
  }));
  const m = buildProfile(batch).momentum;
  if (m !== null && m > 0) ok('getting more accurate reads as momentum up', String(m));
  else bad('getting more accurate should read as momentum up', String(m));
}

/* ---- the training log ---- */
{
  let r: TrainingRecord | undefined;
  r = logged(r, 'position', T0 + 2 * HOUR);
  r = logged(r, 'lesson', T0 + 5 * HOUR);
  r = logged(r, 'position', T0 + HOUR);                 // arriving out of order
  eq('training starts at the earliest record', r.firstAt, T0 + HOUR);
  eq('and the latest is kept', r.lastAt, T0 + 5 * HOUR);
  eq('every session counts', r.count, 3);
  eq('by kind', r.byKind, { position: 2, lesson: 1 });
}

/* ---- the permutation test ---- */
{
  eq('identical samples give no evidence at all', permutationP([10, 0, 10, 0, 10], [10, 0, 10, 0, 10]) > 0.9, true);
  const p1 = permutationP([30, 30, 30, 30, 30, 30], [0, 0, 0, 0, 0, 0]);
  if (p1 < 0.01) ok('a complete separation is not chance', String(p1));
  else bad('a complete separation should not be chance', String(p1));
  eq('the same games always give the same answer',
    permutationP([5, 20, 0, 30, 10], [0, 5, 0, 10, 0]), permutationP([5, 20, 0, 30, 10], [0, 5, 0, 10, 0]));
}

/* ---- before and after ---- */
{
  const trainedAt = T0 + 10 * 24 * HOUR;
  const record: TrainingRecord = { firstAt: trainedAt, lastAt: trainedAt, count: 4, byKind: { position: 4 } };
  const at = (days: number) => trainedAt + days * 24 * HOUR;
  const g = (days: number, cost: number) => game({ playedAt: at(days), date: '2026.10.01', cost });

  eq('nothing trained, nothing to say', progressFor([g(-1, 30)], 'hanging-piece', undefined).verdict, 'not-trained');

  /* Fewer than MIN_SIDE games on either side cannot be read. */
  const thin = [g(-3, 30), g(-2, 30), g(-1, 30), g(-4, 30), g(-5, 30), g(1, 0), g(2, 0)];
  const early = progressFor(thin, 'hanging-piece', record);
  eq('two games since is too early', early.verdict, 'too-early');
  eq('even when they look better', early.after.perGame, 0);
  eq(`the bar is ${MIN_SIDE} a side`, MIN_SIDE, 5);

  /* Lost thirty points a game to it before, nothing since. */
  const fixed = [-6, -5, -4, -3, -2, -1].map((d) => g(d, 30)).concat([1, 2, 3, 4, 5, 6].map((d) => g(d, 0)));
  const better = progressFor(fixed, 'hanging-piece', record);
  eq('a habit that went away is improving', better.verdict, 'improving');
  eq('before', better.before, { games: 6, perGame: 30 });
  eq('after', better.after, { games: 6, perGame: 0 });
  eq('the change is negative', better.change, -30);

  /* The same mix either side of training is no change, however it is cut. */
  const flat = [-6, -5, -4, -3, -2, -1].map((d, i) => g(d, i % 2 ? 30 : 0))
    .concat([1, 2, 3, 4, 5, 6].map((d, i) => g(d, i % 2 ? 30 : 0)));
  eq('the same habit at the same rate is no clear change', progressFor(flat, 'hanging-piece', record).verdict, 'no-clear-change');

  /*
   * A small drop is not improvement. Somebody trains whatever was worst lately
   * and whatever was worst lately drifts down by itself, so a modest dip on a
   * handful of games has to be reported as unclear.
   */
  const dip = [-6, -5, -4, -3, -2, -1].map((d, i) => g(d, [30, 0, 30, 0, 30, 0][i]))
    .concat([1, 2, 3, 4, 5, 6].map((d, i) => g(d, [30, 0, 0, 0, 30, 0][i])));
  const dipped = progressFor(dip, 'hanging-piece', record);
  eq('a small dip on a few games is not a verdict', dipped.verdict, 'no-clear-change');
  if (dipped.change < 0) ok('though the direction is still reported', String(dipped.change));
  else bad('the direction should still be reported', String(dipped.change));

  const broke = [-6, -5, -4, -3, -2, -1].map((d) => g(d, 0)).concat([1, 2, 3, 4, 5, 6].map((d) => g(d, 30)));
  eq('a habit that appeared since is worse', progressFor(broke, 'hanging-piece', record).verdict, 'worse');

  /* A different habit is not this one. */
  eq('other habits do not count', motifCost(game({ playedAt: at(1), cost: 30, tag: 'allowed-fork' }), 'hanging-piece'), 0);

  /*
   * Games that cannot be placed. An undated game imported after training may
   * have been played years before it; a date-only game on the day training
   * started could be either side.
   */
  const unplaceable = [
    ...fixed,
    game({ playedAt: null, date: null, cost: 30 }),
    game({ playedAt: null, date: new Date(trainedAt).toISOString().slice(0, 10).replace(/-/g, '.'), cost: 30 }),
  ];
  const placed = progressFor(unplaceable, 'hanging-piece', record);
  eq('unplaceable games are left out', placed.undated, 2);
  eq('and do not move the reading', placed.after, { games: 6, perGame: 0 });

  /* Whether everything improved, which one habit's number cannot tell apart from training it. */
  eq('the rest of the game is reported alongside', better.overall, { before: 0, after: 0 });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
