/**
 * The backup file, read and written.
 *
 * Restore writes straight into the store, and the file came off somebody's
 * disk, so most of what matters here is what gets refused: a file that is not
 * ours, a file from a newer version, and — the one that would actually hurt —
 * a file with no games in it, which would otherwise replace a working library
 * with nothing and report success.
 */
import { BACKUP_FORMAT, DATA_KEYS, makeBackup, readBackup } from '../src/state/backup';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  (JSON.stringify(got) === JSON.stringify(want) ? ok(n, String(got)) : bad(n, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const refuses = (n: string, text: string) => {
  const r = readBackup(text);
  if (!r.ok && r.reason.length > 0) ok(n, r.reason);
  else bad(n, 'it was accepted');
};

const state = () => ({
  settings: { rating: 1400, theme: 'dark' },
  games: { a: { id: 'a' }, b: { id: 'b' } },
  gameOrder: ['a', 'b'],
  progress: {}, solverRating: 1250,
  lessonStep: {}, lessonDone: { fork: true },
  openingStep: {}, openingQuizBest: {},
  taught: {}, basicsDone: {}, coachSpotsDone: {}, training: {},
  sessions: [], totals: { attempted: 3, solved: 2, bestStreak: 2 },
});

/* ---- writing ---- */
{
  const file = makeBackup(state());
  eq('the file says which app wrote it', file.app, 'chess-coach');
  eq('and in what format', file.format, BACKUP_FORMAT);
  eq('and how many games are in it', file.games, 2);
  if (/^\d{4}-\d{2}-\d{2}T/.test(file.exportedAt)) ok('and when', file.exportedAt);
  else bad('the export date should be an ISO timestamp', file.exportedAt);

  /* Functions, and anything else the store happens to hold, stay out. */
  const withActions = { ...state(), addGames: () => {}, secret: 'nope' };
  const picked = makeBackup(withActions as unknown as Record<string, unknown>);
  eq('actions are not carried', 'addGames' in picked.state, false);
  eq('nor is anything unrecognised', 'secret' in picked.state, false);
  eq('every data key is', Object.keys(picked.state).sort(), [...DATA_KEYS].sort());
}

/* ---- the round trip ---- */
{
  const text = JSON.stringify(makeBackup(state()));
  const read = readBackup(text);
  if (!read.ok) { bad('a file this app wrote reads back'); }
  else {
    ok('a file this app wrote reads back', `${read.games} games`);
    eq('with its games intact', read.state.gameOrder, ['a', 'b']);
    eq('and its progress', (read.state.lessonDone as Record<string, boolean>).fork, true);
    eq('and the date it was taken', typeof read.exportedAt, 'string');
  }
}

/* ---- what must be refused ---- */
{
  refuses('a file that is not JSON', 'not json at all');
  refuses('a JSON array', '[1,2,3]');
  refuses('a number', '42');
  refuses('an empty object', '{}');
  refuses('an object with no games', JSON.stringify({ settings: {}, gameOrder: [] }));
  refuses('games without an order', JSON.stringify({ games: { a: {} } }));
  refuses('an order without games', JSON.stringify({ gameOrder: ['a'] }));
  refuses('a wrapper from another app', JSON.stringify({ app: 'something-else', state: { games: {}, gameOrder: [] } }));
  refuses('a format from the future', JSON.stringify({
    app: 'chess-coach', format: BACKUP_FORMAT + 1, state: { games: {}, gameOrder: [] },
  }));

  /* The empty-library case. A backup taken before importing anything is a
   * valid file, and restoring it over a full library would be a wipe reported
   * as a success — so an empty game list is not something to restore. */
  const empty = readBackup(JSON.stringify(makeBackup({ ...state(), games: {}, gameOrder: [] })));
  eq('an empty backup is refused', empty.ok, false);
}

/* ---- older files, written before the envelope existed ---- */
{
  const legacy = JSON.stringify(state());
  const read = readBackup(legacy);
  if (!read.ok) bad('a bare state object still restores', read.reason);
  else {
    ok('a bare state object still restores', `${read.games} games`);
    eq('it just has no export date', read.exportedAt, null);
  }
}

/* ---- the whitelist holds on the way in, not only on the way out ---- */
{
  const hostile = JSON.stringify({
    ...state(),
    __proto__: { polluted: true },
    addGames: 'not a function any more',
    somethingElse: 1,
  });
  const read = readBackup(hostile);
  if (!read.ok) bad('a file with extra keys is still read', read.reason);
  else {
    ok('a file with extra keys is still read');
    eq('but the extra keys are dropped', Object.keys(read.state).every((k) => (DATA_KEYS as readonly string[]).includes(k)), true);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
