/**
 * The report's arithmetic, checked without the engine.
 *
 * The scoring function is the one thing the player's game and every benchmark
 * game must agree on, so the cases below are mostly about the edges where it
 * would be tempting to return a number that looks fine and means nothing: a
 * phase the game never reached, a game that was never winning, a band built
 * from three samples.
 */
import {
  AXES, BANDS, MIN_SAMPLE, bandFor, comparableAxes, percentile, pickBand, ratingIn, scoreGame,
  summarise, type AxisScores, type BandStats,
} from '../src/coach/report';
import type { AnalysedGame, AnalysedMove, Color, MotifTag, Phase } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  (JSON.stringify(got) === JSON.stringify(want) ? ok(n, String(got)) : bad(n, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

/* ---- fixtures ---- */

function move(over: Partial<AnalysedMove> & { color: Color; phase: Phase }): AnalysedMove {
  return {
    ply: 0, moveNumber: 1, san: 'e4', uci: 'e2e4',
    fenBefore: '', fenAfter: '',
    evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
    winLoss: 0, accuracy: 100, verdict: 'good',
    bestSan: null, bestLineSan: [], bestLineUci: [], refutationSan: [], refutationUci: [],
    secondBestWinLoss: null, alternativesSan: [], motifs: [], secondsSpent: null, stableFromDepth: 0,
    ...over,
  };
}

function game(moves: AnalysedMove[], accuracyByPhase?: Partial<Record<Phase, number>>): AnalysedGame {
  const phases = { opening: 70, middlegame: 70, endgame: 70, ...accuracyByPhase };
  return {
    id: 'x', hero: 'w',
    meta: { white: 'a', black: 'b', result: '1-0', date: null, event: null, whiteElo: 1250, blackElo: 1250, timeControl: null, eco: null, termination: null },
    moves,
    openingId: null, openingName: null, bookPlies: 0,
    accuracy: { w: 70, b: 70 },
    accuracyByPhase: {
      opening: { w: phases.opening, b: 70 },
      middlegame: { w: phases.middlegame, b: 70 },
      endgame: { w: phases.endgame, b: 70 },
    },
    counts: { w: {} as never, b: {} as never },
    depth: 12, analysedAt: 0, startingFen: '',
  };
}

const many = (n: number, over: Partial<AnalysedMove> & { color: Color; phase: Phase }) =>
  Array.from({ length: n }, () => move(over));

/* ---- a phase the game never reached is not a zero ---- */
{
  const g = game([...many(8, { color: 'w', phase: 'opening' }), ...many(8, { color: 'w', phase: 'middlegame' })]);
  const s = scoreGame(g, 'w');
  eq('an unplayed endgame scores null', s.endgame, null);
  eq('a played opening scores a number', typeof s.opening, 'number');
  const short = game(many(3, { color: 'w', phase: 'opening' }));
  eq('three moves is too few to score a phase', scoreGame(short, 'w').opening, null);
}

/* ---- converting is only asked about when there was something to convert ---- */
{
  const level = game(many(10, { color: 'w', phase: 'middlegame' }));
  eq('never winning means conversion is not scored', scoreGame(level, 'w').conversion, null);

  const winning = game(many(10, { color: 'w', phase: 'middlegame', evalBefore: { cp: 600, mate: null } }));
  const s = scoreGame(winning, 'w');
  if (typeof s.conversion === 'number') ok('a winning position is scored for conversion', String(s.conversion));
  else bad('a winning position should be scored for conversion');

  const thrown = game(many(10, { color: 'w', phase: 'middlegame', evalBefore: { cp: 600, mate: null }, winLoss: 5 }));
  const lost = scoreGame(thrown, 'w').conversion as number;
  if (lost < (s.conversion as number)) ok('throwing a win away scores lower', `${lost} < ${s.conversion}`);
  else bad('throwing a win away should score lower', `${lost} vs ${s.conversion}`);
}

/* ---- only the player's own moves count ---- */
{
  const mixed = game([
    ...many(8, { color: 'w', phase: 'middlegame' }),
    ...many(8, { color: 'b', phase: 'middlegame', winLoss: 40, motifs: ['hanging-piece'] as MotifTag[] }),
  ]);
  eq('the opponent’s blunders do not count against you', scoreGame(mixed, 'w').tactics, 100);
}

/* ---- tactics responds to the right motifs ---- */
{
  const clean = game(many(8, { color: 'w', phase: 'middlegame' }));
  const forked = game([
    ...many(7, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 30, motifs: ['allowed-fork'] as MotifTag[] }),
  ]);
  eq('a clean game scores full tactics', scoreGame(clean, 'w').tactics, 100);
  eq('a fork costs tactics', scoreGame(forked, 'w').tactics, 70);
  eq('a fork that was not a blunder leaves the blunder axis alone', scoreGame(forked, 'w').blunders, 100);
}

/* ---- blunder rate ---- */
{
  // Scored per typical-length game: one blunder in twenty of your own moves is
  // two blunders a game, and each one costs twenty points.
  const oneIn40 = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('one blunder a game', scoreGame(oneIn40, 'w').blunders, 80);

  const oneIn20 = game([
    ...many(19, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('two blunders a game', scoreGame(oneIn20, 'w').blunders, 60);

  // A rate, not a count: the same proportion over twice the moves scores the same.
  const twoIn40 = game([
    ...many(38, { color: 'w', phase: 'middlegame' }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('a longer game is not punished for its length', scoreGame(twoIn40, 'w').blunders, 60);

  const wreck2 = game(many(20, { color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }));
  eq('the blunder axis cannot go below zero', scoreGame(wreck2, 'w').blunders, 0);

  const theirs = game([
    ...many(10, { color: 'w', phase: 'middlegame' }),
    ...many(10, { color: 'b', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('the opponent\u2019s blunders are not yours', scoreGame(theirs, 'w').blunders, 100);
}

/* ---- every axis stays inside the scale ---- */
{
  const wreck = game(many(10, { color: 'w', phase: 'middlegame', winLoss: 90, motifs: ['hanging-piece', 'king-safety'] as MotifTag[] }));
  const s = scoreGame(wreck, 'w');
  const outside = AXES.filter((a) => s[a.id] !== null && ((s[a.id] as number) < 0 || (s[a.id] as number) > 100));
  if (!outside.length) ok('scores are clamped to 0..100');
  else bad('score out of range', outside.map((a) => `${a.id}=${s[a.id]}`).join(', '));
}

/* ---- percentiles and banding ---- */
{
  eq('median of a known set', percentile([10, 20, 30, 40, 50], 0.5), 30);
  eq('lower quartile', percentile([10, 20, 30, 40, 50], 0.25), 20);
  eq('an empty set is zero rather than NaN', percentile([], 0.5), 0);

  eq('a rating lands in its band', bandFor(1250).label, '1100–1399');
  eq('a very high rating lands in the top band', bandFor(2800).label, BANDS[BANDS.length - 1].label);
  eq('a very low rating lands in the bottom band', bandFor(400).label, BANDS[0].label);
}

/* ---- summarising a band ---- */
{
  // Six games: every one scores the opening, only four reach an endgame.
  const scored: AxisScores[] = [60, 65, 70, 75, 80, 85].map((v, i) => ({
    opening: v, middlegame: v, tactics: v, blunders: v,
    endgame: i < 4 ? v : null,
    conversion: null,
  }));
  const s = summarise(BANDS[1], scored);

  eq('games counted', s.games, 6);
  eq('median across a well-sampled axis', s.median.opening, 73);
  eq('the sample size per axis is recorded', s.n.opening, 6);

  /*
   * The important one. Four readings is under the floor, and an axis nobody
   * measured must not come back as zero: a benchmark of zero sits on the
   * centre of the chart and makes any score at all look exceptional.
   */
  eq('an under-sampled axis is null, not zero', s.median.endgame, null);
  eq('an axis nobody could answer is null, not zero', s.median.conversion, null);
  eq('its sample size is still reported', s.n.endgame, 4);
}

/* ---- the chart only draws what both sides can answer ---- */
{
  const band = summarise(BANDS[1], Array.from({ length: 6 }, () => ({
    opening: 70, middlegame: 70, endgame: 70, tactics: 70, blunders: 70, conversion: null,
  })));
  const scores: AxisScores = {
    opening: 80, middlegame: 80, endgame: null, tactics: 80, blunders: 80, conversion: 80,
  };
  const drawn = comparableAxes(scores, band).map((a) => a.id);
  eq('an axis the game missed is dropped', drawn.includes('endgame'), false);
  eq('an axis the benchmark cannot answer is dropped', drawn.includes('conversion'), false);
  eq('the rest are drawn', drawn, ['opening', 'middlegame', 'tactics', 'blunders']);
}

/* ---- a thin band is not a benchmark ---- */
{
  const full = (label: string, games: number): BandStats => ({
    ...BANDS.find((b) => b.label === label)!,
    games,
    median: Object.fromEntries(AXES.map((a) => [a.id, 70])) as BandStats['median'],
    p25: Object.fromEntries(AXES.map((a) => [a.id, 60])) as BandStats['p25'],
    p75: Object.fromEntries(AXES.map((a) => [a.id, 80])) as BandStats['p75'],
    n: Object.fromEntries(AXES.map((a) => [a.id, games])) as BandStats['n'],
  });

  const benchmark = [full('1100–1399', 3), full('1400–1699', MIN_SAMPLE)];
  const thin = pickBand(benchmark, 1250);
  if (thin && !thin.exact && thin.band.label === '1400–1699') ok('a thin band falls back to the nearest usable one');
  else bad('thin band fallback', JSON.stringify(thin));

  const exact = pickBand(benchmark, 1500);
  if (exact?.exact) ok('a well-sampled band is used as-is');
  else bad('exact band', JSON.stringify(exact));

  eq('no rating means no comparison', pickBand(benchmark, null), null);
  eq('no benchmark means no comparison', pickBand([], 1500), null);
}

/* ---- the rating comes from the player's own side ---- */
{
  const g = game(many(4, { color: 'w', phase: 'opening' }));
  eq('white reads the white rating', ratingIn({ ...g, hero: 'w' }), 1250);
  eq('black reads the black rating', ratingIn({ ...g, hero: 'b', meta: { ...g.meta, blackElo: 1800 } }), 1800);
  eq('a file with no ratings reads null', ratingIn({ ...g, meta: { ...g.meta, whiteElo: null } }), null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
