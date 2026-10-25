/**
 * The benchmark corpus: the analysed games behind "typical for your rating".
 *
 * The app ships only the summary — medians and quartiles per rating band, in
 * src/coach/benchmark.ts. This is the evidence those numbers were computed
 * from: several hundred real rated Lichess games, each analysed by Stockfish
 * the same way a player's own games are. Analysing them takes about an hour;
 * scoring them takes seconds. Keeping them is what lets the scoring change
 * without paying the hour again — and without swapping in a different sample,
 * which would make it impossible to tell a better formula from different games.
 *
 * It is stored compressed in the repository, so it lives in git and on GitHub
 * rather than anywhere that can be cleared. The first copy was kept in a
 * temporary directory and the system deleted it.
 *
 * Node only: nothing in the app imports this, so none of it reaches the browser.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BANDS, scoreGame, summarise, type AxisScores, type BandStats } from '../src/coach/report';
import type { AnalysedGame, Color } from '../src/types';

export interface CorpusEntry {
  band: string;
  color: Color;
  game: AnalysedGame;
}

export const STORED_CORPUS = new URL('../data/benchmark-corpus.json.gz', import.meta.url).pathname;

/** Files ending .gz are read compressed. */
export function readCorpus(path: string): CorpusEntry[] {
  const raw = readFileSync(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as CorpusEntry[];
}

/** Files ending .gz are written compressed — about seven times smaller. */
export function writeCorpus(path: string, corpus: CorpusEntry[]): void {
  const json = Buffer.from(JSON.stringify(corpus));
  writeFileSync(path, path.endsWith('.gz') ? gzipSync(json, { level: 9 }) : json);
}

/** The stored corpus, or null when there is none. */
export function storedCorpus(): CorpusEntry[] | null {
  return existsSync(STORED_CORPUS) ? readCorpus(STORED_CORPUS) : null;
}

/** One performance: a game, from one side. */
export const entryKey = (e: CorpusEntry) => `${e.game.id}:${e.color}`;

/**
 * Several corpora as one, each game counted once.
 *
 * Crawls overlap, and a game counted twice would weight one performance double
 * in its band. The id is a hash of the players, the date and the moves, so it
 * matches across separate crawls.
 */
export function mergeCorpora(...parts: CorpusEntry[][]): { corpus: CorpusEntry[]; duplicates: number } {
  const seen = new Set<string>();
  const corpus: CorpusEntry[] = [];
  let duplicates = 0;
  for (const part of parts) {
    for (const entry of part) {
      const key = entryKey(entry);
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      corpus.push(entry);
    }
  }
  return { corpus, duplicates };
}

/**
 * The benchmark table from a corpus — exactly what src/coach/benchmark.ts holds.
 *
 * Shared by the builder and by the test that checks the shipped table still
 * matches the stored games, so the two cannot compute it differently.
 */
export function benchmarkFrom(corpus: CorpusEntry[]): BandStats[] {
  const scored = new Map<string, AxisScores[]>(BANDS.map((b) => [b.label, []]));
  for (const entry of corpus) scored.get(entry.band)?.push(scoreGame(entry.game, entry.color));
  return BANDS.map((b) => summarise(b, scored.get(b.label)!));
}
