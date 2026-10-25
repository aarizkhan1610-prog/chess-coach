/**
 * Do the progress labels mean anything?
 *
 * Two halves, and both are needed. The first gives the app real games in a
 * random order — where by construction nothing is changing — and counts how
 * often it claims a trend anyway. Before the significance test it did for
 * 86–92% of habits and players. The second checks that a real trend is still
 * found, because a "fix" that never labelled anything would pass the first
 * half perfectly and be worthless.
 */
import { buildProfile, buildWeaknesses } from '../src/coach/weaknesses';
import { accuracyOverTime } from '../src/coach/report';
import { slopeTrend } from '../src/coach/progress';
import { storedCorpus } from '../scripts/corpus';
import type { AnalysedGame, AnalysedMove, MotifTag } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

/* The significance level is 5%; allow some room for sampling in the check itself. */
const CEILING = 10;

/* ---- no trend to find: how often is one claimed? ---- */
{
  const corpus = storedCorpus();
  if (!corpus) {
    bad('the stored benchmark games are needed for this check');
  } else {
    /*
     * A proper generator, and enough trials for the rate to settle. With a
     * simple one and 120 trials, one reading landed on exactly 10%; at 600 it
     * measured 6.2%, and 5.2% with this generator — the expected 5%. Too few
     * trials made the check, not the labels, look borderline.
     */
    let a = 11;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (const size of [10, 20, 40]) {
      let habits = 0, habitLabels = 0, runs = 0, momentumLabels = 0, chartLabels = 0;
      for (let trial = 0; trial < 300; trial++) {
        const pool = [...corpus];
        const picked: AnalysedGame[] = [];
        for (let i = 0; i < size; i++) {
          const e = pool.splice(Math.floor(rand() * pool.length), 1)[0];
          picked.push({ ...e.game, hero: e.color, meta: { ...e.game.meta, playedAt: Math.floor(rand() * 1e12) } });
        }
        const profile = buildProfile(picked);
        for (const w of profile.weaknesses) {
          if (w.occurrences < 2) continue;
          habits++;
          if (w.trendVerdict === 'improving' || w.trendVerdict === 'worse') habitLabels++;
        }
        runs++;
        if (profile.momentumVerdict === 'improving' || profile.momentumVerdict === 'worse') momentumLabels++;
        const chart = slopeTrend(accuracyOverTime(picked).map((p) => p.accuracy));
        if (chart.verdict === 'improving' || chart.verdict === 'worse') chartLabels++;
      }
      const h = pct(habitLabels, habits), m = pct(momentumLabels, runs), c = pct(chartLabels, runs);
      (h <= CEILING ? ok : bad)(`${size} games in random order: habits labelled`, `${h.toFixed(1)}% (was 86–91%)`);
      (m <= CEILING ? ok : bad)(`${size} games in random order: "trending up/down"`, `${m.toFixed(1)}% (was 88–92%)`);
      (c <= CEILING ? ok : bad)(`${size} games in random order: chart trend`, `${c.toFixed(1)}% (was up to 77%)`);
    }
  }
}

/* ---- a real trend is still found ---- */
const T0 = Date.UTC(2026, 0, 1);
let seq = 0;
function game(i: number, opts: { cost?: number; accuracy?: number }): AnalysedGame {
  const moves: AnalysedMove[] = [];
  if (opts.cost) {
    moves.push({
      ply: 0, moveNumber: 1, color: 'w', san: 'e4', uci: 'e2e4', fenBefore: '', fenAfter: '',
      evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null },
      winLoss: opts.cost, accuracy: 50, verdict: 'blunder', phase: 'middlegame',
      bestSan: null, bestLineSan: [], bestLineUci: [], refutationSan: [], refutationUci: [],
      secondBestWinLoss: null, alternativesSan: [], motifs: ['hanging-piece' as MotifTag], secondsSpent: null, stableFromDepth: 0,
    } as AnalysedMove);
  }
  const acc = opts.accuracy ?? 75;
  return {
    id: `t${seq++}`, hero: 'w',
    meta: { white: 'me', black: 'x', result: '1-0', date: null, playedAt: T0 + i * 3600_000,
      event: null, whiteElo: 1500, blackElo: 1500, timeControl: null, eco: null, termination: null },
    moves, openingId: null, openingName: null, bookPlies: 0,
    accuracy: { w: acc, b: acc },
    accuracyByPhase: { opening: { w: acc, b: acc }, middlegame: { w: acc, b: acc }, endgame: { w: acc, b: acc } },
    counts: { w: {} as never, b: {} as never }, depth: 12, analysedAt: 0, startingFen: '',
  };
}
const wobble = (i: number) => [0, 4, -3, 2, -5, 3, -2, 5, -4, 1][i % 10];

{
  // Hanging pieces in eight of the first ten games, then in one of the next ten.
  const stopped = Array.from({ length: 20 }, (_, i) =>
    game(i, { cost: i < 10 ? (i % 5 === 4 ? 0 : 25) : (i === 14 ? 25 : 0) }));
  const w = buildWeaknesses(stopped).find((x) => x.tag === 'hanging-piece')!;
  (w.trendVerdict === 'improving' ? ok : bad)('a habit that clearly stopped is still called improving', w.trendVerdict);

  const started = Array.from({ length: 20 }, (_, i) =>
    game(i, { cost: i >= 10 ? (i % 5 === 4 ? 0 : 25) : (i === 4 ? 25 : 0) }));
  const v = buildWeaknesses(started).find((x) => x.tag === 'hanging-piece')!;
  (v.trendVerdict === 'worse' ? ok : bad)('a habit that clearly started is still called getting worse', v.trendVerdict);

  // Accuracy around 62 for ten games, then around 84, with game-to-game noise.
  const better = Array.from({ length: 20 }, (_, i) => game(i, { accuracy: (i < 10 ? 62 : 84) + wobble(i) }));
  const p = buildProfile(better);
  (p.momentumVerdict === 'improving' ? ok : bad)('a clear step up in accuracy is still "trending up"', `${p.momentumVerdict}, ${p.momentum}`);

  // A steady climb of two points a game, with the same noise.
  const climb = Array.from({ length: 20 }, (_, i) => 50 + i * 2 + wobble(i));
  const t = slopeTrend(climb);
  (t.verdict === 'improving' ? ok : bad)('a steady climb is still a trend on the chart', `${t.verdict}, slope ${t.change}`);
}

/* ---- and too few games is said as too few, not as "no trend" ---- */
{
  const few = Array.from({ length: 6 }, (_, i) => game(i, { cost: i < 3 ? 30 : 0 }));
  const w = buildWeaknesses(few).find((x) => x.tag === 'hanging-piece')!;
  (w.trendVerdict === 'too-few' ? ok : bad)('six games is too few to call a habit trend', w.trendVerdict);
  const p = buildProfile(few);
  (p.momentumVerdict === 'too-few' ? ok : bad)('and too few for momentum', p.momentumVerdict);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
