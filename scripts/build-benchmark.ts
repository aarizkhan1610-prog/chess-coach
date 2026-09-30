/**
 * Regenerates src/coach/benchmark.ts by measuring real games.
 *
 *   npm run build:benchmark
 *
 * The app has no idea how other people play, and a comparison against numbers
 * somebody made up is worse than no comparison at all. So the baseline is
 * measured: rated games are sampled from the public Lichess API across rating
 * bands, pushed through exactly the same analysis and scoring code that runs on
 * the user's own games, and the result is written out as a table.
 *
 * Every game's PGN carries both players' ratings, which is also how the pool of
 * players is built: fetch one player's games, harvest their opponents and the
 * ratings they were at, and fetch from whoever falls in a band that still needs
 * filling.
 */
import { writeFileSync } from 'node:fs';
import { bootNodeEngine, search, type NodeEngine } from '../tests/engine-node';
import { parsePgn, type ParsedGame } from '../src/chess/pgn';
import { analyseGame, type Analyser } from '../src/engine/analyze';
import { findOpening } from '../src/openings';
import { AXES, BANDS, bandFor, scoreGame, summarise, type AxisScores, type BandStats } from '../src/coach/report';
import type { Color, PositionAnalysis } from '../src/types';

const DEPTH = 12;
const GAMES_PER_BAND = Number(process.env.GAMES_PER_BAND ?? 24);
const SEEDS = (process.env.SEEDS ?? 'german11').split(',');
/*
 * A hard ceiling on requests. Without one the crawl will hunt for the rarest
 * band until the queue drains, and since every batch of games adds two dozen
 * fresh candidates, that is effectively never.
 */
const MAX_FETCHES = Number(process.env.MAX_FETCHES ?? 70);
/** Lichess asks for one request at a time and a pause between them. */
const POLITE_MS = 1500;
const UA = 'chess-coach benchmark builder (github.com/aarizkhan1610-prog/chess-coach)';

function asAnalyser(e: NodeEngine): Analyser {
  return {
    async analyse(fen, opts): Promise<PositionAnalysis> {
      const r = await search(e, fen, opts.depth ?? DEPTH, opts.multipv ?? 1);
      const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
      return {
        fen,
        depth: r.lines[0]?.depth ?? 0,
        stableFromDepth: r.lines[0]?.depth ?? 0,
        lines: r.lines.map((l) => ({
          multipv: l!.multipv,
          depth: l!.depth,
          evaluation: { cp: l!.cp === null ? null : l!.cp * sign, mate: l!.mate === null ? null : l!.mate * sign },
          pv: l!.pv,
        })),
      };
    },
  };
}

/*
 * Grabbed before the engine is anywhere near being booted. The Emscripten
 * loader that ships with Stockfish installs its own `fetch` over the global
 * one, and by the time the crawl starts the real implementation has gone.
 */
const httpFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strong players, to seed the top band — a crawl upward from a beginner rarely reaches it. */
async function topPlayers(): Promise<Candidate[]> {
  try {
    const res = await httpFetch('https://lichess.org/api/player/top/50/blitz', {
      headers: { Accept: 'application/vnd.lichess.v3+json', 'User-Agent': UA },
    });
    if (!res.ok) return [];
    const body = await res.json() as { users?: { id: string; perfs?: { blitz?: { rating?: number } } }[] };
    return (body.users ?? []).map((u) => ({ user: u.id, rating: u.perfs?.blitz?.rating ?? 2400 }));
  } catch {
    return [];
  }
}

async function fetchGames(user: string, max: number): Promise<string> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}`
    + `?max=${max}&rated=true&perfType=blitz,rapid,classical&clocks=false&evals=false&opening=false`;
  const res = await httpFetch(url, { headers: { Accept: 'application/x-chess-pgn', 'User-Agent': UA } });
  if (res.status === 429) throw new Error('rate limited by Lichess — wait a few minutes and try again');
  if (!res.ok) throw new Error(`Lichess returned ${res.status} for ${user}`);
  return res.text();
}

interface Candidate {
  user: string;
  rating: number;
}

/** Everyone in this batch, with the rating they held at the time. */
function playersIn(games: ParsedGame[]): Candidate[] {
  const out: Candidate[] = [];
  for (const g of games) {
    if (g.meta.whiteElo) out.push({ user: g.meta.white, rating: g.meta.whiteElo });
    if (g.meta.blackElo) out.push({ user: g.meta.black, rating: g.meta.blackElo });
  }
  return out;
}

async function main() {
  const engine = await bootNodeEngine();
  const analyser = asAnalyser(engine);

  const scored = new Map<string, AxisScores[]>(BANDS.map((b) => [b.label, []]));
  const seen = new Set<string>();
  const queue: Candidate[] = SEEDS.map((user) => ({ user, rating: 0 }));

  const needed = (label: string) => GAMES_PER_BAND - (scored.get(label)?.length ?? 0);
  const done = () => BANDS.every((b) => needed(b.label) <= 0);

  console.log(`Building a benchmark of ${GAMES_PER_BAND} games per band at depth ${DEPTH}\n`);

  // The top band is unreachable by crawling outward from a club player.
  if (needed(BANDS[BANDS.length - 1].label) > 0) queue.push(...await topPlayers());

  let fetches = 0;
  while (queue.length && !done() && fetches < MAX_FETCHES) {
    /*
     * Take whoever helps most rather than whoever arrived first. A queue in
     * arrival order spends the whole budget on the middle bands, because that
     * is where most players are and therefore where most candidates come from.
     */
    let pick = 0;
    let bestNeed = -1;
    for (let i = 0; i < queue.length; i++) {
      const need = queue[i].rating ? needed(bandFor(queue[i].rating).label) : 1;
      if (need > bestNeed) { bestNeed = need; pick = i; }
    }
    const next = queue.splice(pick, 1)[0];
    if (seen.has(next.user.toLowerCase())) continue;
    seen.add(next.user.toLowerCase());

    // Skip anyone whose band is already full; their games cost a request each.
    if (next.rating && needed(bandFor(next.rating).label) <= 0) continue;

    let batch: ParsedGame[];
    try {
      if (fetches > 0) await wait(POLITE_MS);
      fetches++;
      // The app's own parser, which also does the splitting and copes with the
      // line endings and oddities real exports contain.
      batch = parsePgn(await fetchGames(next.user, 12)).games;
    } catch (err) {
      console.log(`  skip ${next.user}: ${String(err)}`);
      continue;
    }

    // Widen the pool before spending engine time on this batch.
    for (const c of playersIn(batch)) {
      if (!seen.has(c.user.toLowerCase()) && needed(bandFor(c.rating).label) > 0) queue.push(c);
    }

    for (const parsed of batch) {
      if (done()) break;
      if (parsed.moves.length < 16) continue;

      /*
       * Score whichever player's rating still needs samples. A game where both
       * players want counting is counted twice — once per side — which is
       * fair: they are two different performances.
       */
      for (const color of ['w', 'b'] as Color[]) {
        const rating = color === 'w' ? parsed.meta.whiteElo : parsed.meta.blackElo;
        if (!rating) continue;
        const band = bandFor(rating);
        if (needed(band.label) <= 0) continue;

        try {
          const game = await analyseGame(analyser, parsed, color, { depth: DEPTH, multipv: 2, book: findOpening });
          scored.get(band.label)!.push(scoreGame(game, color));
          const filled = BANDS.map((b) => `${b.label.padEnd(10)} ${scored.get(b.label)!.length}/${GAMES_PER_BAND}`);
          process.stdout.write(`\r  ${filled.join('  ')}   `);
        } catch (err) {
          console.log(`\n  analysis failed: ${String(err)}`);
        }
      }
    }
  }

  console.log('\n');
  const stats: BandStats[] = BANDS.map((b) => summarise(b, scored.get(b.label)!));
  for (const s of stats) {
    console.log(`${s.label.padEnd(12)} n=${String(s.games).padStart(3)}  `
      + AXES.map((a) => `${a.label} ${String(s.median[a.id]).padStart(3)}`).join('  '));
  }

  const thin = stats.filter((s) => s.games < 8);
  if (thin.length) {
    console.log(`\nNOTE: thin sample in ${thin.map((s) => s.label).join(', ')}.`
      + ' The app will fall back to the nearest well-sampled band and say so.'
      + ' Raise MAX_FETCHES or pass SEEDS to fill them.');
  }

  const banner = `/* Generated by scripts/build-benchmark.ts — do not edit by hand.
 *
 * Median and quartile scores for real rated games, by rating band, measured
 * with the same scoring code that runs on the user's own games. Built on
 * ${new Date().toISOString().slice(0, 10)} at depth ${DEPTH}.
 */
import type { BandStats } from './report';

export const BENCHMARK: BandStats[] = ${JSON.stringify(stats, null, 2)};

/** The day the numbers above were measured, so the interface can say so. */
export const BENCHMARK_BUILT = '${new Date().toISOString().slice(0, 10)}';
`;
  writeFileSync(new URL('../src/coach/benchmark.ts', import.meta.url), banner);
  console.log(`\nWrote src/coach/benchmark.ts from ${fetches} requests.`);
  engine.quit();
}

main();
