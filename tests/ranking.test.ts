/**
 * What the coach recommends first, once training has started.
 *
 * The first block is the important one: somebody who has trained nothing gets
 * exactly the order they had before. Everything after is a case where training
 * has produced evidence and the order should move because of it — and the near
 * misses where it must not.
 */
import { buildWeaknesses } from '../src/coach/weaknesses';
import { STALLED_MIN_SESSIONS, isStalled, rankHabits, rankReason } from '../src/coach/ranking';
import type { TrainingRecord } from '../src/coach/progress';
import type { AnalysedGame, AnalysedMove, MotifTag } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  (JSON.stringify(got) === JSON.stringify(want) ? ok(n, JSON.stringify(got)) : bad(n, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const DAY = 24 * 3600_000;
const TRAINED = Date.UTC(2026, 9, 10, 12);
const A: MotifTag = 'hanging-piece';
const B: MotifTag = 'allowed-fork';
const C: MotifTag = 'back-rank';

let seq = 0;
/** A game played `days` from training, losing the given amounts to each habit. */
function game(days: number, costs: Partial<Record<MotifTag, number>>): AnalysedGame {
  const id = `r${seq++}`;
  const moves: AnalysedMove[] = [];
  let ply = 0;
  for (const [tag, cost] of Object.entries(costs)) {
    if (!cost) continue;
    moves.push({
      ply: ply, moveNumber: ply / 2 + 1, color: 'w', san: 'e4', uci: 'e2e4', fenBefore: '', fenAfter: '',
      evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
      winLoss: cost, accuracy: 50, verdict: 'mistake', phase: 'middlegame',
      bestSan: null, bestLineSan: [], bestLineUci: [], refutationSan: [], refutationUci: [],
      secondBestWinLoss: null, alternativesSan: [], motifs: [tag as MotifTag], secondsSpent: null, stableFromDepth: 0,
    } as AnalysedMove);
    ply += 2;
  }
  return {
    id, hero: 'w',
    meta: { white: 'me', black: id, result: '1-0', date: '2026.10.01', playedAt: TRAINED + days * DAY,
      event: null, whiteElo: 1500, blackElo: 1500, timeControl: null, eco: null, termination: null },
    moves, openingId: null, openingName: null, bookPlies: 0,
    accuracy: { w: 80, b: 80 },
    accuracyByPhase: { opening: { w: 80, b: 80 }, middlegame: { w: 80, b: 80 }, endgame: { w: 80, b: 80 } },
    counts: { w: {} as never, b: {} as never }, depth: 12, analysedAt: 0, startingFen: '',
  };
}

const BEFORE = [-6, -5, -4, -3, -2, -1];
const AFTER = [1, 2, 3, 4, 5, 6];
const trained = (count: number): TrainingRecord => ({ firstAt: TRAINED, lastAt: TRAINED, count, byKind: { position: count } });
const order = (games: AnalysedGame[], training: Record<string, TrainingRecord>) =>
  rankHabits(games, buildWeaknesses(games), training).map((h) => h.weakness.tag);
const profile = (games: AnalysedGame[]) => buildWeaknesses(games).map((w) => w.tag);

/* ---- nothing trained, nothing moves ---- */
{
  const games = [...BEFORE, ...AFTER].map((d, i) => game(d, { [A]: 20, [B]: i % 2 ? 12 : 0, [C]: i % 3 ? 0 : 9 }));
  eq('with no training the order is exactly the profile’s', order(games, {}), profile(games));
  const states = rankHabits(games, buildWeaknesses(games), {}).map((h) => h.state);
  eq('and every habit is untrained', [...new Set(states)], ['untrained']);
}

/* ---- a habit that came down makes room ---- */
{
  // A: 30 a game before, nothing since. B: 10 a game throughout.
  const games = [
    ...BEFORE.map((d) => game(d, { [A]: 30, [B]: 10 })),
    ...AFTER.map((d) => game(d, { [B]: 10 })),
  ];
  eq('the profile still leads with A, by its lifetime cost', profile(games)[0], A);
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(4) });
  eq('the coach leads with B once A has come down', ranked.map((h) => h.weakness.tag), [B, A]);
  eq('A reads as improving', ranked[1].state, 'improving');
  eq('ranked by what it costs now', ranked[1].currentCost, 0);
  eq('the figures are on the reading', [ranked[1].reading.before.perGame, ranked[1].reading.after.perGame], [30, 0]);
  if (rankReason(ranked[1])?.includes('what it costs now')) ok('and the reason says what it is ranked by', rankReason(ranked[1])!);
  else bad('the reason should say it is ranked by its current cost', String(rankReason(ranked[1])));
}

/* ---- a habit that has not moved after real training yields ---- */
{
  // A: 20 a game every time, before and since. B: 12 a game throughout.
  const games = [...BEFORE, ...AFTER].map((d) => game(d, { [A]: 20, [B]: 12 }));
  eq('A leads the profile', profile(games)[0], A);

  const stalled = rankHabits(games, buildWeaknesses(games), { [A]: trained(STALLED_MIN_SESSIONS + 1) });
  eq(`after ${STALLED_MIN_SESSIONS + 1} sessions and no change, B goes first`, stalled.map((h) => h.weakness.tag), [B, A]);
  eq('A is stalled', stalled[1].state, 'stalled');
  if (rankReason(stalled[1])?.includes(`${STALLED_MIN_SESSIONS + 1} training sessions`)) ok('and the reason counts the sessions', rankReason(stalled[1])!);
  else bad('the stalled reason should count the sessions', String(rankReason(stalled[1])));

  /* Two sessions is too little work to call it unresponsive. */
  const light = rankHabits(games, buildWeaknesses(games), { [A]: trained(2) });
  eq('after two sessions A keeps its place', light.map((h) => h.weakness.tag), [A, B]);
  eq('and is steady, not stalled', light[0].state, 'steady');
}

/* ---- moving the right way, not yet significantly, is not stalled ---- */
{
  const games = [
    ...BEFORE.map((d, i) => game(d, { [A]: [20, 20, 0, 20, 0, 20][i], [B]: 12 })),
    ...AFTER.map((d, i) => game(d, { [A]: [20, 0, 0, 20, 0, 0][i], [B]: 12 })),
  ];
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(10) });
  const a = ranked.find((h) => h.weakness.tag === A)!;
  eq('a drop that is not yet significant is steady', a.state, 'steady');
  eq('and is not demoted', a.priority, a.weakness.perGame);
  eq('even with plenty of training', isStalled(a.reading, trained(10)), false);
}

/*
 * ---- not proven either way, but rising, is not stalled ----
 *
 * Found on real games: a habit went from 2.9 to 10.1 a game since training at
 * p 0.21, and the first version of the rule demoted it — told somebody a habit
 * that had tripled could wait. A rise not yet proven is a reason to watch it.
 */
{
  /*
   * A: one loss in six games before, four in six since — p 0.248, beside the
   * real case's 0.21. B costs 9 a game: below A's pooled 12.5 but above half of
   * it, so this only passes if A is not demoted.
   */
  const games = [
    ...BEFORE.map((d, i) => game(d, { [A]: [0, 0, 0, 0, 0, 30][i], [B]: 9 })),
    ...AFTER.map((d, i) => game(d, { [A]: [30, 30, 30, 0, 30, 0][i], [B]: 9 })),
  ];
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(STALLED_MIN_SESSIONS + 1) });
  const a = ranked.find((h) => h.weakness.tag === A)!;
  const p = a.reading.pValue!;
  if (a.reading.verdict === 'no-clear-change' && p < 0.5) ok('a quadrupling that is not yet significant', `p ${p}`);
  else bad('the fixture should be a non-significant rise below p 0.5', `${a.reading.verdict}, p ${p}`);
  eq('is rising, not stalled', a.state, 'rising');
  eq('and is not demoted', a.priority, a.weakness.perGame);
  eq('so it keeps its place above a cheaper habit', ranked.map((h) => h.weakness.tag), [A, B]);
  if (rankReason(a)?.includes('worth watching')) ok('and says to watch it', rankReason(a)!);
  else bad('a rising habit should be flagged to watch', String(rankReason(a)));
}

/* ---- a rise that looks like nothing at all, after real training, is stalled ---- */
{
  // A: one loss before, two since — as likely as not to be chance. B: 5 a game.
  const games = [
    ...BEFORE.map((d, i) => game(d, { [A]: [30, 0, 0, 0, 0, 0][i], [B]: 5 })),
    ...AFTER.map((d, i) => game(d, { [A]: [30, 30, 0, 0, 0, 0][i], [B]: 5 })),
  ];
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(STALLED_MIN_SESSIONS + 1) });
  const a = ranked.find((h) => h.weakness.tag === A)!;
  if ((a.reading.pValue ?? 0) >= 0.5) ok('a rise this small is noise', `p ${a.reading.pValue}`);
  else bad('the fixture should sit at p 0.5 or above', `p ${a.reading.pValue}`);
  eq('is stalled', a.state, 'stalled');
  eq('and yields to a cheaper habit', ranked.map((h) => h.weakness.tag), [B, A]);
}

/* ---- a habit that got worse rises ---- */
{
  // A: nothing before, 30 a game since. B: 20 a game throughout.
  const games = [
    ...BEFORE.map((d) => game(d, { [B]: 20 })),
    ...AFTER.map((d) => game(d, { [A]: 30, [B]: 20 })),
  ];
  eq('B leads the profile — A averages 15 over everything', profile(games), [B, A]);
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(3) });
  eq('A goes first, at what it costs since', ranked.map((h) => h.weakness.tag), [A, B]);
  eq('A is worse', ranked[0].state, 'worse');
}

/* ---- still measuring keeps the lifetime estimate ---- */
{
  const games = [
    ...BEFORE.map((d) => game(d, { [A]: 30, [B]: 10 })),
    ...[1, 2].map((d) => game(d, { [B]: 10 })),
  ];
  const ranked = rankHabits(games, buildWeaknesses(games), { [A]: trained(4) });
  const a = ranked.find((h) => h.weakness.tag === A)!;
  eq('two games since is still measuring', a.state, 'measuring');
  eq('so it is ranked on everything, not on the two games', a.priority, a.weakness.perGame);
  eq('and keeps its place', ranked[0].weakness.tag, A);
}

/* ---- ties do not reshuffle ---- */
{
  const games = [...BEFORE, ...AFTER].map((d) => game(d, { [A]: 10, [B]: 10, [C]: 10 }));
  eq('equal habits keep the profile’s order', order(games, {}), profile(games));
  eq('every time', order(games, {}), order(games, {}));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
