import { buildWeaknesses, buildProfile, coachSummary } from '../src/coach/weaknesses';
import { puzzlesFromGame, estimateRating, isCorrectFirstMove, ratingBand, solverMoveCount, trimToSolverMove } from '../src/coach/puzzles';
import { newProgress, review, isDue, selectPuzzles, updateSolverRating } from '../src/coach/srs';
import { buildPlan, examplesFor, ALL_LESSONS, lessonFor } from '../src/coach/lessons';
import type { AnalysedGame, AnalysedMove, Color, MotifTag, MoveVerdict, Puzzle } from '../src/types';

let pass = 0, fail = 0;
function chk(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name} = ${g}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}
const ok = (n: string, c: boolean, d = '') => (c ? (pass++, console.log(`  ok   ${n} ${d}`)) : (fail++, console.log(`  FAIL ${n} ${d}`)));

/* ---------- fixtures ---------- */
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function mv(o: Partial<AnalysedMove> & { ply: number; color: Color }): AnalysedMove {
  return {
    moveNumber: Math.floor(o.ply / 2) + 1,
    san: 'e4', uci: 'e2e4', fenBefore: START, fenAfter: START,
    evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
    winLoss: 0, accuracy: 100, verdict: 'good' as MoveVerdict,
    bestSan: 'e4', bestLineSan: ['e4'], bestLineUci: ['e2e4'],
    refutationSan: [], refutationUci: [], secondBestWinLoss: 20,
    alternativesSan: [], phase: 'middlegame', motifs: [], secondsSpent: null, stableFromDepth: 8,
    ...o,
  };
}

function game(id: string, hero: Color, moves: AnalysedMove[], extra: Partial<AnalysedGame> = {}): AnalysedGame {
  return {
    id, hero, moves,
    meta: { white: 'me', black: 'them', result: '1-0', date: '2026.01.01', event: null,
      whiteElo: null, blackElo: null, timeControl: null, eco: null, termination: null },
    openingId: 'italian', openingName: 'Italian Game', bookPlies: 0,
    accuracy: { w: 80, b: 80 },
    accuracyByPhase: { opening: { w: 90, b: 90 }, middlegame: { w: 80, b: 80 }, endgame: { w: 70, b: 70 } },
    counts: { w: { brilliant: 0, great: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, forced: 0 },
              b: { brilliant: 0, great: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, forced: 0 } },
    depth: 14, analysedAt: 1000, startingFen: START, ...extra,
  };
}

/* ---------- weakness aggregation ---------- */
{
  const games = [
    game('g1', 'w', [
      mv({ ply: 0, color: 'w', winLoss: 30, verdict: 'blunder', motifs: ['hanging-piece'] }),
      mv({ ply: 1, color: 'b', winLoss: 40, verdict: 'blunder', motifs: ['back-rank'] }), // opponent: ignored
      mv({ ply: 2, color: 'w', winLoss: 20, verdict: 'mistake', motifs: ['hanging-piece'] }),
    ]),
    game('g2', 'w', [
      mv({ ply: 0, color: 'w', winLoss: 10, verdict: 'inaccuracy', motifs: ['king-safety'] }),
    ], { analysedAt: 2000 }),
  ];
  const w = buildWeaknesses(games);
  chk('only hero moves counted', w.map((x) => x.tag), ['hanging-piece', 'king-safety']);
  chk('hanging-piece total win loss', w[0].winLoss, 50);
  chk('hanging-piece per game (2 games)', w[0].perGame, 25);
  chk('occurrences', w[0].occurrences, 2);
  chk('games affected', w[0].gamesAffected, 1);
  chk('top weakness anchors severity at 100', w[0].severity, 100);
  ok('second weakness has lower severity', w[1].severity < 100, String(w[1].severity));
  chk('shares sum to 100', Math.round(w.reduce((a, x) => a + x.share, 0)), 100);
  chk('examples point at the right plies', w[0].examples, [{ gameId: 'g1', ply: 0 }, { gameId: 'g1', ply: 2 }]);
}
{
  // A move with two motifs splits its cost rather than double-counting.
  const g = [game('g1', 'w', [mv({ ply: 0, color: 'w', winLoss: 40, motifs: ['hanging-piece', 'king-safety'] })])];
  const w = buildWeaknesses(g);
  chk('two motifs split the cost', w.map((x) => x.winLoss), [20, 20]);
}
{
  // Trend: the same motif appearing only in the recent half should trend up.
  const games = [
    game('old', 'w', [mv({ ply: 0, color: 'w', winLoss: 0, motifs: [] })], { analysedAt: 1 }),
    game('new', 'w', [mv({ ply: 0, color: 'w', winLoss: 30, motifs: ['hanging-piece'] })], { analysedAt: 2 }),
  ];
  ok('trend is positive when a habit is recent', buildWeaknesses(games)[0].trend > 0, String(buildWeaknesses(games)[0].trend));
}
chk('no games means no weaknesses', buildWeaknesses([]), []);

/* ---------- profile ---------- */
{
  const games = [
    game('g1', 'w', [
      mv({ ply: 0, color: 'w', verdict: 'best', accuracy: 100, phase: 'opening' }),
      mv({ ply: 2, color: 'w', verdict: 'blunder', accuracy: 20, winLoss: 35, phase: 'middlegame', motifs: ['hanging-piece'] }),
      mv({ ply: 4, color: 'w', verdict: 'good', accuracy: 90, phase: 'endgame' }),
      mv({ ply: 1, color: 'b', verdict: 'best', accuracy: 100 }),
    ]),
  ];
  const p = buildProfile(games);
  chk('games counted', p.games, 1);
  chk('only hero moves counted in profile', p.moves, 3);
  chk('verdict tally', [p.verdicts.best, p.verdicts.blunder, p.verdicts.good], [1, 1, 1]);
  ok('accuracy is between the extremes', p.accuracy > 20 && p.accuracy < 100, String(p.accuracy));
  chk('opening phase accuracy', p.accuracyByPhase.opening, 100);
  chk('momentum needs more games', p.momentum, null);
  chk('opening record', p.openingRecord, [{ openingId: 'italian', name: 'Italian Game', games: 1, score: 100, accuracy: 80 }]);
  ok('coach summary mentions the weakness', coachSummary(p).some((s) => s.includes('undefended')), coachSummary(p)[0]);
  ok('empty profile has a friendly summary', coachSummary(buildProfile([]))[0].startsWith('Import'), coachSummary(buildProfile([]))[0]);
}

/* ---------- puzzle generation ---------- */
{
  const g = game('g1', 'w', [
    mv({
      ply: 0, color: 'w', verdict: 'blunder', winLoss: 35, san: 'Nxe5', motifs: ['hanging-piece'],
      fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
      fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4N3/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 1',
      bestLineSan: ['c3', 'Nf6', 'd3'], refutationSan: ['Nxe5', 'd4', 'Nxc4'], secondBestWinLoss: 25,
    }),
  ]);
  const ps = puzzlesFromGame(g);
  chk('both puzzle kinds generated', ps.map((p) => p.origin), ['your-miss', 'punish']);
  chk('miss puzzle uses the position before', ps[0].fen, 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1');
  chk('miss puzzle solver is the mover', ps[0].solverColor, 'w');
  chk('punish puzzle uses the position after', ps[1].fen, 'r1bqkbnr/pppp1ppp/2n5/4N3/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 1');
  chk('punish puzzle solver is the opponent', ps[1].solverColor, 'b');
  chk('solution ends on the solver move', ps[0].solution.length % 2, 1);
  // 'c3 Nf6 d3' has no forcing move, so only the key move is asked for.
  chk('quiet line trims to one move', ps[0].solution, ['c3']);
  chk('solver move count', solverMoveCount(ps[0]), 1);
  ok('prompt names the played move', ps[0].prompt.includes('Nxe5'), ps[0].prompt);
  ok('rating in range', ps[0].rating >= 600 && ps[0].rating <= 2600, String(ps[0].rating));
}
{
  // Ambiguous positions are skipped: no single answer to grade against.
  const g = game('g1', 'w', [mv({ ply: 0, color: 'w', verdict: 'blunder', winLoss: 35, secondBestWinLoss: 2,
    bestLineSan: ['c3'], refutationSan: [] })]);
  chk('ambiguous best move yields no "miss" puzzle', puzzlesFromGame(g).filter((p) => p.origin === 'your-miss').length, 0);
}
{
  const g = game('g1', 'w', [mv({ ply: 0, color: 'w', verdict: 'good', winLoss: 2 })]);
  chk('good moves make no puzzles', puzzlesFromGame(g), []);
}
{
  const g = game('g1', 'w', [
    mv({ ply: 0, color: 'w', verdict: 'blunder', winLoss: 35, bestLineSan: ['c3'], refutationSan: ['Nxe5'], secondBestWinLoss: 25 }),
    mv({ ply: 1, color: 'b', verdict: 'blunder', winLoss: 35, bestLineSan: ['e5'], refutationSan: ['Nf3'], secondBestWinLoss: 25,
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' }),
  ]);
  chk('heroOnly filters the opponent out', puzzlesFromGame(g, { heroOnly: true }).every((p) => p.ply === 0), true);
  chk('miss puzzles only come from your own moves',
    puzzlesFromGame(g).filter((p) => p.origin === 'your-miss').every((p) => p.ply === 0), true);
  chk('missFromBothSides opts in',
    puzzlesFromGame(g, { missFromBothSides: true }).filter((p) => p.origin === 'your-miss').length, 2);
  chk('includePunish can be disabled', puzzlesFromGame(g, { includePunish: false }).every((p) => p.origin === 'your-miss'), true);
}

/* ---------- solution trimming ---------- */
{
  const t = (line: string[], max = 3) => trimToSolverMove(line, max);
  chk('keeps a forcing capture line', t(['Nxe5', 'Nxe5', 'Qxe5']), ['Nxe5', 'Nxe5', 'Qxe5']);
  chk('keeps a mating line', t(['Ra8+', 'Kh7', 'Rxa7']), ['Ra8+', 'Kh7', 'Rxa7']);
  chk('drops aimless moves after the tactic', t(['Bxc6', 'Kd6', 'd5', 'Ke5', 'Kf1']), ['Bxc6']);
  chk('trims to the last forcing move', t(['Nd6+', 'Kd8', 'Nxf7', 'Ke7', 'Kg1']), ['Nd6+', 'Kd8', 'Nxf7']);
  chk('promotion counts as forcing', t(['a8=Q', 'Kh7', 'Qxb7']), ['a8=Q', 'Kh7', 'Qxb7']);
  chk('a quiet line keeps only the key move', t(['c3', 'Nf6', 'd3']), ['c3']);
  chk('always ends on the solver move', t(['Nxe5', 'Nxe5']).length % 2, 1);
  chk('caps at maxSolverMoves', t(['Nxe5', 'Nxe5', 'Qxe5', 'Qxe5', 'Rxe5', 'Rxe5', 'Kg1'], 2).length, 3);
  chk('never returns empty', t(['Kf1']), ['Kf1']);
}

/* ---------- rating heuristic ---------- */
{
  const base = { winSwing: 25, stableFromDepth: 8, tags: [] as MotifTag[] };
  const oneMoveCapture = estimateRating({ ...base, solution: ['Nxe5'] });
  const oneMoveQuiet = estimateRating({ ...base, solution: ['Rd1'] });
  const threeMove = estimateRating({ ...base, solution: ['Rd1', 'Kg8', 'Rd8', 'Kf7', 'Rxd7'] });
  ok('quiet moves rate harder than captures', oneMoveQuiet > oneMoveCapture, `${oneMoveQuiet} > ${oneMoveCapture}`);
  ok('longer lines rate harder', threeMove > oneMoveQuiet, `${threeMove} > ${oneMoveQuiet}`);
  ok('deep-to-find rates harder', estimateRating({ ...base, stableFromDepth: 16, solution: ['Rd1'] }) > oneMoveQuiet);
  ok('ratings clamp to the band', estimateRating({ ...base, solution: Array(40).fill('Rd1') }) <= 2600);
  chk('rating bands', [ratingBand(700), ratingBand(1300), ratingBand(2200)], ['Easy', 'Intermediate', 'Expert']);
}

/* ---------- answer matching ---------- */
{
  const p: Puzzle = { id: 'x', fen: START, solverColor: 'w', solution: ['Ra8+', 'Kh7'], alternates: ['Rb8'],
    tags: ['back-rank'], rating: 1000, origin: 'starter', gameId: null, ply: null, prompt: '', explanation: '' };
  chk('exact match', isCorrectFirstMove(p, 'Ra8+'), true);
  chk('match ignoring check marks', isCorrectFirstMove(p, 'Ra8'), true);
  chk('alternate accepted', isCorrectFirstMove(p, 'Rb8'), true);
  chk('wrong move rejected', isCorrectFirstMove(p, 'Rc1'), false);
}

/* ---------- spaced repetition ---------- */
{
  let p = newProgress('p1');
  chk('new puzzles are due', isDue(p), true);
  p = review(p, 'first-try');
  chk('first success schedules 1 day', p.interval, 1);
  p = review(p, 'first-try');
  chk('second success schedules 3 days', p.interval, 3);
  ok('ease rises with success', p.ease > 2.3, String(p.ease));
  ok('not due immediately after success', !isDue(p), String(p.dueAt - Date.now()));
  const failed = review(p, 'failed');
  chk('failure resets the interval', failed.interval, 0);
  chk('failure is due again now', isDue(failed), true);
  chk('failure counts a lapse', failed.lapses, 1);
  ok('failure lowers ease', failed.ease < p.ease, `${failed.ease} < ${p.ease}`);
  const hinted = review(p, 'hinted');
  ok('hinted shortens the interval', hinted.interval < p.interval, `${hinted.interval} < ${p.interval}`);
  chk('ease has a floor', review(review(review(review(review(newProgress('z'), 'failed'), 'failed'), 'failed'), 'failed'), 'failed').ease, 1.3);
}

/* ---------- puzzle selection ---------- */
{
  const mk = (id: string, tags: MotifTag[], rating: number): Puzzle => ({
    id, fen: START, solverColor: 'w', solution: ['e4'], alternates: [], tags, rating,
    origin: 'starter', gameId: null, ply: null, prompt: '', explanation: '',
  });
  const pool = [mk('a', ['back-rank'], 900), mk('b', ['hanging-piece'], 1200), mk('c', ['hanging-piece'], 1800), mk('d', ['king-safety'], 1500)];
  chk('tag filter', selectPuzzles(pool, {}, { tags: ['hanging-piece'], count: 5 }).map((p) => p.id).sort(), ['b', 'c']);
  chk('count respected', selectPuzzles(pool, {}, { count: 2 }).length, 2);
  chk('unknown tag yields nothing', selectPuzzles(pool, {}, { tags: ['missed-mate'], count: 5 }), []);
  chk('deterministic with a seed',
    selectPuzzles(pool, {}, { count: 3, seed: 7 }).map((p) => p.id),
    selectPuzzles(pool, {}, { count: 3, seed: 7 }).map((p) => p.id));
  {
    const target = selectPuzzles(pool, {}, { count: 1, targetRating: 1800, seed: 1 });
    chk('target rating steers selection', target[0].id, 'c');
  }
  {
    // A puzzle solved and scheduled far out should lose to unseen puzzles.
    const progress = { a: { ...review(newProgress('a'), 'first-try'), interval: 30, dueAt: Date.now() + 30 * 864e5 } };
    const picked = selectPuzzles(pool, progress, { count: 3, spaced: true, seed: 3 });
    chk('spaced mode defers what is not due', picked.map((p) => p.id).includes('a'), false);
  }
}
chk('solver rating rises on a win', updateSolverRating(1200, 1200, true) > 1200, true);
chk('solver rating falls on a loss', updateSolverRating(1200, 1200, false) < 1200, true);
ok('beating a harder puzzle gains more',
  updateSolverRating(1200, 1800, true) - 1200 > updateSolverRating(1200, 800, true) - 1200);

/* ---------- lesson plan ---------- */
{
  const games = [game('g1', 'w', [
    mv({ ply: 0, color: 'w', winLoss: 35, verdict: 'blunder', motifs: ['hanging-piece'], san: 'Nxe5', bestSan: 'c3' }),
    mv({ ply: 2, color: 'w', winLoss: 12, verdict: 'inaccuracy', motifs: ['king-safety'] }),
  ])];
  const plan = buildPlan(buildProfile(games));
  chk('plan is ordered by cost', plan.map((p) => p.lesson.tag), ['hanging-piece', 'king-safety']);
  ok('plan explains itself', plan[0].reason.includes('1 time'), plan[0].reason);
  chk('every motif has a lesson', ALL_LESSONS.length, 26);
  ok('lessonFor resolves', lessonFor('back-rank')?.title.length! > 0);
  const ex = examplesFor(games, 'hanging-piece');
  chk('examples come from the hero moves', ex.map((e) => e.san), ['Nxe5']);
  chk('example carries the engine suggestion', ex[0].bestSan, 'c3');
}
{
  // Every lesson must be well-formed, since they are hand-written content.
  let bad = 0;
  for (const l of ALL_LESSONS) {
    if (!l.title || !l.oneLiner || !l.why || l.steps.length < 2) { bad++; console.log(`       thin lesson: ${l.tag}`); }
    if (l.estMinutes < 1 || l.estMinutes > 60) { bad++; console.log(`       odd duration: ${l.tag}`); }
    for (const s of l.steps) {
      if (s.kind === 'checklist' && s.items.length < 3) { bad++; console.log(`       short checklist: ${l.tag}`); }
      if (s.kind === 'read' && s.body.length < 2) { bad++; console.log(`       short read: ${l.tag}`); }
      if (s.kind === 'drill' && s.count < 1) { bad++; console.log(`       empty drill: ${l.tag}`); }
    }
  }
  chk('all lessons well-formed', bad, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
