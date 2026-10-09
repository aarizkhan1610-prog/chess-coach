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
  scoreOpenings, summarise, type AxisScores, type BandStats,
} from '../src/coach/report';
import type { AnalysedGame, AnalysedMove, Color, MotifTag, Phase } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  (JSON.stringify(got) === JSON.stringify(want) ? ok(n, String(got)) : bad(n, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

/* ---- fixtures ---- */

function move(over: Partial<AnalysedMove> & { color: Color; phase: Phase }): AnalysedMove {
  const m: AnalysedMove = {
    ply: 0, moveNumber: 1, san: 'e4', uci: 'e2e4',
    fenBefore: '', fenAfter: '',
    evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
    winLoss: 0, accuracy: 100, verdict: 'good',
    bestSan: null, bestLineSan: [], bestLineUci: [], refutationSan: [], refutationUci: [],
    secondBestWinLoss: null, alternativesSan: [], motifs: [], secondsSpent: null, stableFromDepth: 0,
    ...over,
  };
  /*
   * A move given no "after" left the evaluation where it found it. Defaulting
   * it to equality instead made every winning fixture read as a crash to 50%
   * on every move, which went unnoticed for as long as nothing scored from it.
   */
  if (!over.evalAfter) m.evalAfter = m.evalBefore;
  return m;
}

const K = 0.00368208;
/** Centipawns that give White this win percentage, for building trajectories. */
function cpFor(winPct: number): number {
  return Math.round(-Math.log(100 / Math.max(0.5, Math.min(99.5, winPct)) - 1) / K);
}

/**
 * A game from White's win percentage at the start of each of their moves.
 * Whatever is lost within the move shows up as that move's own "after".
 */
function trajectory(winPcts: number[], phase: Phase = 'middlegame'): AnalysedGame {
  return game(winPcts.map((w, i) => {
    const next = winPcts[i + 1] ?? w;
    return move({
      color: 'w', phase, ply: i * 2, moveNumber: i + 1,
      evalBefore: { cp: cpFor(w), mate: null },
      evalAfter: { cp: cpFor(Math.min(w, next)), mate: null },
      winLoss: Math.max(0, w - next),
    });
  }));
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
  eq('a played opening scores a number', typeof s.opening, 'number');
  /* The endgame is not an axis: it could not order the rating bands it would
   * be drawn against. Its accuracy is reported, just not compared. */
  eq('there is no endgame axis', AXES.some((a) => a.id === 'endgame'), false);
  const short = game(many(3, { color: 'w', phase: 'opening' }));
  eq('three moves is too few to score a phase', scoreGame(short, 'w').opening, null);
}

/* ---- converting ---- */
{
  const conv = (winPcts: number[]) => scoreGame(trajectory(winPcts), 'w').conversion;
  const atLeast = (n: string, got: number | null, floor: number) =>
    (got !== null && got >= floor ? ok(n, String(got)) : bad(n, `got ${got}, wanted >= ${floor}`));
  const atMost = (n: string, got: number | null, ceil: number) =>
    (got !== null && got <= ceil ? ok(n, String(got)) : bad(n, `got ${got}, wanted <= ${ceil}`));

  eq('never winning means conversion is not scored', conv([50, 48, 52, 49, 51, 50, 47, 53]), null);

  /* One position over the line and gone again is a chance missed, not a
   * conversion — the error and tactics axes answer for that one. */
  eq('a single winning position is not a conversion', conv([50, 52, 75, 50, 48, 51, 49, 50]), null);

  atLeast('holding a won game scores near the top', conv([90, 88, 91, 89, 92, 90, 93, 95, 98, 99]), 85);
  atLeast('a short decisive game is not punished for being short', conv([80, 86, 91, 95, 98, 99]), 90);

  /*
   * The defect this axis was rebuilt for. Summing per-move losses made the
   * worst case the quietest: collapse quickly and there were barely any
   * winning moves to sum, so the axis either flattered the player or — with
   * fewer than four winning moves — declined to score them at all.
   */
  atMost('handing the whole thing back scores near the floor', conv([93, 88, 80, 70, 55, 40, 25, 10, 4, 1]), 12);
  atMost('a fast collapse is still scored', conv([50, 85, 92, 20, 10, 5, 3, 2]), 12);

  /* Giving back more is worse than giving back a lot, which is the ordering a
   * single capped share could not express — both came out at zero. */
  const drawn = conv([95, 90, 84, 77, 70, 62, 55, 50, 50, 50]);
  const crushed = conv([95, 90, 80, 60, 40, 20, 10, 4, 2, 1]);
  if (drawn !== null && crushed !== null && drawn > crushed + 20) {
    ok('giving back the win beats giving back the win and more', `${drawn} vs ${crushed}`);
  } else {
    bad('giving back the win should beat being crushed after', `${drawn} vs ${crushed}`);
  }

  /* Measured against the running peak, so a later recovery cannot bury it. */
  atMost('giving it back and winning anyway still counts', conv([95, 70, 52, 60, 80, 92, 97, 99]), 65);

  /* Churn is not conversion: an evaluation that wobbles while never dropping
   * below its own winning floor gave nothing away. */
  const churn = conv([90, 86, 91, 87, 92, 88, 93, 89, 94, 90]);
  atLeast('a wobbling evaluation is not a give-back', churn, 80);

  const collapse = drawn;
  if (collapse !== null && churn !== null && collapse < churn - 30) {
    ok('churn and collapse are far apart', `${churn} vs ${collapse}`);
  } else {
    bad('churn and collapse should be far apart', `${churn} vs ${collapse}`);
  }

  /* Scale independence: the same shape over twice the moves is the same score. */
  const shortHold = conv([88, 85, 90, 87, 92, 94]);
  const longHold = conv(Array.from({ length: 40 }, (_, i) => 88 + (i % 2 ? 0 : 3)));
  if (shortHold !== null && longHold !== null && Math.abs(shortHold - longHold) <= 10) {
    ok('game length does not move the score', `${shortHold} vs ${longHold}`);
  } else {
    bad('game length should not move the score', `${shortHold} vs ${longHold}`);
  }
}

/* ---- tactics also counts what the detector never named ---- */
{
  /*
   * The motif detector only runs above 8 win-probability points, so half of
   * all games above 2000 carried no tactical motif at all and scored a flat
   * 100. A move answered by a capture or a check is the same damage seen from
   * the other side, and every move already stores that reply.
   */
  const quiet = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, refutationSan: ['Rd8'] }),
  ]);
  eq('a quiet punishment is not tactics', scoreGame(quiet, 'w').tactics, 100);

  const captured = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, refutationSan: ['Nxe5'] }),
  ]);
  const checked = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, refutationSan: ['Qh5+'] }),
  ]);
  const mated = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, refutationSan: ['Rd8#'] }),
  ]);
  eq('a move answered by a capture counts', scoreGame(captured, 'w').tactics, 84);
  eq('so does one answered by a check', scoreGame(checked, 'w').tactics, 84);
  eq('and one answered by mate', scoreGame(mated, 'w').tactics, 84);

  /* The two sources must not double-count the same move. */
  const both = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, motifs: ['allowed-fork'] as MotifTag[], refutationSan: ['Nxe5+'] }),
  ]);
  eq('a move that is both is counted once', scoreGame(both, 'w').tactics, 84);

  /* A forcing reply to a move that cost nothing is just a forcing reply. */
  const harmless = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 0, refutationSan: ['Nxe5+'] }),
  ]);
  eq('a forcing reply that cost nothing costs nothing', scoreGame(harmless, 'w').tactics, 100);
}

/* ---- openings, against the band ---- */
{
  /** A game in one opening, with a given opening-phase accuracy. */
  function opened(id: string, openingAcc: number, result = '1-0', hero: Color = 'w'): AnalysedGame {
    const g = game(many(8, { color: hero, phase: 'opening' }));
    return {
      ...g,
      hero,
      openingId: id,
      openingName: id,
      meta: { ...g.meta, result },
      accuracyByPhase: {
        opening: { w: openingAcc, b: openingAcc },
        middlegame: { w: 70, b: 70 },
        endgame: { w: 70, b: 70 },
      },
    };
  }

  const band = (openingMedian: number | null): BandStats => ({
    ...BANDS[1], games: 60,
    median: { opening: openingMedian, middlegame: 70, endgame: 70, tactics: 70, errors: 70, conversion: 70 },
    p25: { opening: 60, middlegame: 60, endgame: 60, tactics: 60, errors: 60, conversion: 60 },
    p75: { opening: 90, middlegame: 90, endgame: 90, tactics: 90, errors: 90, conversion: 90 },
    n: { opening: 60, middlegame: 60, endgame: 60, tactics: 60, errors: 60, conversion: 60 },
  });

  eq('no openings recognised means nothing to score', scoreOpenings([], band(80)).length, 0);

  /* One game is a sample of one, whatever it says. */
  const once = scoreOpenings([opened('london', 40)], band(80));
  eq('a single game in an opening is listed but not scored', once[0].gap, null);
  eq('and it still reports how many games that was', once[0].games, 1);

  const twice = scoreOpenings([opened('london', 40), opened('london', 44)], band(80));
  eq('two games is enough to score', twice[0].opening, 42);
  eq('the gap is measured against the band', twice[0].gap, -38);
  eq('and the band figure is carried with it', twice[0].typical, 80);

  /* Worst against the band first — the row worth reading is at the top. */
  const mixed = scoreOpenings(
    [opened('london', 40), opened('london', 44), opened('caro-kann', 95), opened('caro-kann', 93)],
    band(80),
  );
  eq('the weakest opening sorts first', mixed.map((o) => o.openingId), ['london', 'caro-kann']);
  eq('an opening better than the band scores positive', (mixed[1].gap as number) > 0, true);

  /* Unscorable rows go last, however many games they have. */
  const withSingles = scoreOpenings(
    [opened('london', 40), opened('london', 44), opened('scotch', 20)],
    band(80),
  );
  eq('an unscored opening sorts after the scored ones', withSingles[withSingles.length - 1].openingId, 'scotch');

  /*
   * The order is by gap, which is what the callers that want "the opening you
   * play most" have to re-sort out of — the coach card and the recommendation
   * both label that case explicitly.
   */
  const ordered = scoreOpenings(
    [opened('london', 95), opened('london', 95), opened('london', 95),
     opened('scotch', 40), opened('scotch', 44)],
    band(80),
  );
  eq('sorting is by gap, not by games played', ordered[0].openingId, 'scotch');
  eq('and the most played is recoverable from the same list',
    [...ordered].sort((a, b) => b.games - a.games)[0].openingId, 'london');

  /* No rating, no baseline — and the score must not invent one. */
  const noBand = scoreOpenings([opened('london', 40), opened('london', 44)], null);
  eq('without a band there is no typical', noBand[0].typical, null);
  eq('and therefore no gap', noBand[0].gap, null);
  eq('but the opening is still scored', noBand[0].opening, 42);

  /* The result percentage reads from the hero's side, not White's. */
  const asBlack = scoreOpenings([opened('caro-kann', 70, '0-1', 'b'), opened('caro-kann', 70, '0-1', 'b')], band(80));
  eq('a win as Black counts as a win', asBlack[0].score, 100);
  const drawn = scoreOpenings([opened('london', 70, '1/2-1/2'), opened('london', 70, '1/2-1/2')], band(80));
  eq('a draw is half a point', drawn[0].score, 50);
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
  eq('a clean game scores full tactics', scoreGame(clean, 'w').tactics, 100);

  // Forty own moves losing forty win-percent to a fork: forty of the
  // two-hundred-and-fifty-point scale, so sixteen off the score.
  const forked = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, motifs: ['allowed-fork'] as MotifTag[] }),
  ]);
  eq('a fork costs tactics', scoreGame(forked, 'w').tactics, 84);

  // The same damage over half as many moves is twice the rate.
  const denser = game([
    ...many(19, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', winLoss: 40, motifs: ['allowed-fork'] as MotifTag[] }),
  ]);
  eq('tactics is a rate, not a total', scoreGame(denser, 'w').tactics, 68);

  // And it no longer bottoms out the moment a game goes badly: the old scale
  // clipped everything past a hundred points to zero, so careless and
  // catastrophic read the same.
  const rough = game([
    ...many(36, { color: 'w', phase: 'middlegame' }),
    ...many(4, { color: 'w', phase: 'middlegame', winLoss: 30, motifs: ['allowed-fork'] as MotifTag[] }),
  ]);
  const ruinous = game(many(40, { color: 'w', phase: 'middlegame', winLoss: 30, motifs: ['allowed-fork'] as MotifTag[] }));
  eq('a rough game still scores above the floor', scoreGame(rough, 'w').tactics, 52);
  eq('a ruinous one reaches it', scoreGame(ruinous, 'w').tactics, 0);
  eq('a fork that was not a blunder leaves the blunder axis alone', scoreGame(forked, 'w').errors, 100);
  eq('a tactical error does not touch the phase scores', scoreGame(forked, 'w').opening, null);
}

/* ---- blunder rate ---- */
{
  // Scored per typical-length game: one blunder in twenty of your own moves is
  // two blunders a game, and each one costs twenty points.
  const oneIn40 = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('one blunder a game', scoreGame(oneIn40, 'w').errors, 80);

  const oneIn20 = game([
    ...many(19, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('two blunders a game', scoreGame(oneIn20, 'w').errors, 60);

  // A rate, not a count: the same proportion over twice the moves scores the same.
  const twoIn40 = game([
    ...many(38, { color: 'w', phase: 'middlegame' }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('a longer game is not punished for its length', scoreGame(twoIn40, 'w').errors, 60);

  const wreck2 = game(many(20, { color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }));
  eq('the blunder axis cannot go below zero', scoreGame(wreck2, 'w').errors, 0);

  const theirs = game([
    ...many(10, { color: 'w', phase: 'middlegame' }),
    ...many(10, { color: 'b', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('the opponent\u2019s blunders are not yours', scoreGame(theirs, 'w').errors, 100);

  /*
   * Mistakes count half. Blunders alone left the median at the ceiling in four
   * of five rating bands, because the median game contains none of them.
   */
  const twoMistakes = game([
    ...many(38, { color: 'w', phase: 'middlegame' }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'mistake', winLoss: 22 }),
  ]);
  eq('two mistakes weigh the same as one blunder', scoreGame(twoMistakes, 'w').errors, 80);

  const oneBlunder = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  eq('and score the same as one blunder does', scoreGame(oneBlunder, 'w').errors, scoreGame(twoMistakes, 'w').errors);

  const both = game([
    ...many(36, { color: 'w', phase: 'middlegame' }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'mistake', winLoss: 22 }),
  ]);
  eq('blunders and mistakes add up', scoreGame(both, 'w').errors, 40);

  /*
   * Inaccuracies count, at a quarter. They were ignored, which left the axis
   * reading a flat 100 for the median game above 2000 — half of those games
   * contain no blunder and no mistake, so the benchmark was telling every
   * strong player that typical was perfect.
   */
  const soft = game([
    ...many(36, { color: 'w', phase: 'middlegame' }),
    ...many(4, { color: 'w', phase: 'middlegame', verdict: 'inaccuracy', winLoss: 12 }),
  ]);
  eq('inaccuracies count, at a quarter', scoreGame(soft, 'w').errors, 80);

  const oneMistake = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'mistake', winLoss: 22 }),
  ]);
  const twoInaccuracies = game([
    ...many(38, { color: 'w', phase: 'middlegame' }),
    ...many(2, { color: 'w', phase: 'middlegame', verdict: 'inaccuracy', winLoss: 12 }),
  ]);
  eq('two inaccuracies weigh what one mistake does',
    scoreGame(twoInaccuracies, 'w').errors, scoreGame(oneMistake, 'w').errors);

  /* The ordering that matters: nothing below a blunder may outrank one. */
  const blunderOnly = game([
    ...many(39, { color: 'w', phase: 'middlegame' }),
    move({ color: 'w', phase: 'middlegame', verdict: 'blunder', winLoss: 45 }),
  ]);
  const threeInaccuracies = game([
    ...many(37, { color: 'w', phase: 'middlegame' }),
    ...many(3, { color: 'w', phase: 'middlegame', verdict: 'inaccuracy', winLoss: 12 }),
  ]);
  eq('three inaccuracies still beat one blunder',
    (scoreGame(threeInaccuracies, 'w').errors as number) > (scoreGame(blunderOnly, 'w').errors as number), true);
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
  // Six games: every one scores the opening, only four say anything about
  // tactics, and none was ever winning.
  const scored: AxisScores[] = [60, 65, 70, 75, 80, 85].map((v, i) => ({
    opening: v, middlegame: v, errors: v,
    tactics: i < 4 ? v : null,
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
  eq('an under-sampled axis is null, not zero', s.median.tactics, null);
  eq('an axis nobody could answer is null, not zero', s.median.conversion, null);
  eq('its sample size is still reported', s.n.tactics, 4);
}

/* ---- the chart only draws what both sides can answer ---- */
{
  const band = summarise(BANDS[1], Array.from({ length: 6 }, () => ({
    opening: 70, middlegame: 70, endgame: 70, tactics: 70, errors: 70, conversion: null,
  })));
  const scores: AxisScores = {
    opening: 80, middlegame: 80, endgame: null, tactics: 80, errors: 80, conversion: 80,
  };
  const drawn = comparableAxes(scores, band).map((a) => a.id);
  eq('an axis the game missed is dropped', drawn.includes('endgame'), false);
  eq('an axis the benchmark cannot answer is dropped', drawn.includes('conversion'), false);
  eq('the rest are drawn', drawn, ['opening', 'middlegame', 'tactics', 'errors']);
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
