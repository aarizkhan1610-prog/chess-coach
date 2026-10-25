/**
 * The shipped "typical for your rating" figures, checked against their evidence.
 *
 * src/coach/benchmark.ts is a summary of the games stored in
 * data/benchmark-corpus.json.gz. This fails if those games go missing — the
 * first copy did, from a temporary directory — or if the shipped figures no
 * longer match what the stored games produce, which is what happens when the
 * scoring changes and nobody re-runs `npm run build:benchmark`. It runs in the
 * deploy, so neither can reach the live site unnoticed.
 */
import { existsSync } from 'node:fs';
import { BENCHMARK } from '../src/coach/benchmark';
import { MIN_SAMPLE } from '../src/coach/report';
import { STORED_CORPUS, benchmarkFrom, mergeCorpora, storedCorpus, type CorpusEntry } from '../scripts/corpus';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

/* ---- the games are there ---- */
if (!existsSync(STORED_CORPUS)) {
  bad('the stored benchmark games are missing', `expected ${STORED_CORPUS} — restore it from git, or run npm run benchmark:crawl`);
} else {
  const corpus = storedCorpus()!;
  ok('the stored benchmark games are present', `${corpus.length} games`);

  if (corpus.length >= 250) ok('there are enough of them to mean something', String(corpus.length));
  else bad('the stored corpus is too small to benchmark against', String(corpus.length));

  const { duplicates } = mergeCorpora(corpus);
  if (duplicates === 0) ok('no game is counted twice');
  else bad('the stored corpus counts some games twice', `${duplicates} duplicates`);

  /* ---- and the shipped figures are exactly what they produce ---- */
  const rebuilt = benchmarkFrom(corpus);
  for (const band of BENCHMARK) {
    const fresh = rebuilt.find((b) => b.label === band.label);
    if (!fresh) { bad(`band ${band.label} is missing from the rebuild`); continue; }
    if (JSON.stringify(fresh) === JSON.stringify(band)) {
      ok(`${band.label} matches the stored games`, `${band.games} games`);
    } else {
      bad(`${band.label} no longer matches the stored games`,
        'the scoring changed without a re-score — run npm run build:benchmark');
    }
    if (band.games >= MIN_SAMPLE) ok(`${band.label} is sampled well enough to use`);
    else bad(`${band.label} has too few games`, String(band.games));
  }
}

/* ---- merging never double-counts, which is what makes a re-crawl safe ---- */
{
  const g = (id: string, color: 'w' | 'b'): CorpusEntry => ({ band: '1100–1399', color, game: { id } as never });
  const { corpus, duplicates } = mergeCorpora([g('a', 'w'), g('b', 'w')], [g('a', 'w'), g('a', 'b')]);
  if (corpus.length === 3 && duplicates === 1) ok('a re-crawl adds new games and skips the ones already stored');
  else bad('merging should keep 3 and drop 1', `${corpus.length} kept, ${duplicates} dropped`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
