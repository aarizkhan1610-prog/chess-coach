/**
 * Reading and writing the backup file.
 *
 * Everything this app knows lives in one browser profile. Clearing site data,
 * a new machine, or a storage fault takes all of it, and re-analysing a few
 * dozen games is minutes of engine time the player has already paid once. The
 * export existed before this module; what it did not have was a way back in,
 * which made it a file nobody could do anything with.
 *
 * Kept free of React and of the store so it can be tested as arithmetic.
 */

/**
 * The state keys worth carrying between browsers.
 *
 * A whitelist rather than "whatever the file contains": restore writes
 * straight into the store, and a file picked off disk is not a trusted
 * object. Unknown keys are dropped rather than merged.
 */
export const DATA_KEYS = [
  'settings', 'games', 'gameOrder', 'progress', 'solverRating',
  'lessonStep', 'lessonDone', 'openingStep', 'openingQuizBest',
  'taught', 'basicsDone', 'coachSpotsDone', 'sessions', 'totals',
] as const;

export type DataKey = (typeof DATA_KEYS)[number];
export type BackupState = Partial<Record<DataKey, unknown>>;

/** Bumped only if the shape changes in a way a reader has to know about. */
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: 'chess-coach';
  format: number;
  exportedAt: string;
  games: number;
  state: BackupState;
}

export type BackupRead =
  | { ok: true; state: BackupState; games: number; exportedAt: string | null }
  | { ok: false; reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pick(source: Record<string, unknown>): BackupState {
  const out: BackupState = {};
  for (const key of DATA_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function makeBackup(state: Record<string, unknown>): BackupFile {
  const picked = pick(state);
  const order = picked.gameOrder;
  return {
    app: 'chess-coach',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    games: Array.isArray(order) ? order.length : 0,
    state: picked,
  };
}

/**
 * Parse a file the user chose, and refuse anything that is not one of ours.
 *
 * The envelope is new, so a file written by the older export is a bare state
 * object with no wrapper at all. Those are still read: the alternative is
 * telling somebody their own backup is invalid, and the shape check below is
 * what actually decides whether the contents are usable.
 *
 * Keys the file does not mention are left alone rather than reset. A backup
 * this app wrote always contains all of them; a partial file is more likely
 * hand-made than a request to wipe everything it omits.
 */
export function readBackup(text: string): BackupRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not JSON, so it is not a backup this app wrote.' };
  }
  if (!isObject(parsed)) {
    return { ok: false, reason: 'That file does not contain an object.' };
  }

  const wrapped = isObject(parsed.state) && parsed.app === 'chess-coach';
  if (isObject(parsed.state) && !wrapped) {
    return { ok: false, reason: 'That looks like a backup from a different app.' };
  }
  if (wrapped && typeof parsed.format === 'number' && parsed.format > BACKUP_FORMAT) {
    return {
      ok: false,
      reason: `That backup was written by a newer version of this app (format ${parsed.format}).`,
    };
  }

  const source = wrapped ? (parsed.state as Record<string, unknown>) : parsed;

  /*
   * The two load-bearing keys, and a game in them. Without all three there is
   * nothing to restore, and accepting the file would replace a working library
   * with nothing while reporting success — a backup taken before the first
   * import is a valid file and still must not be restorable over a full one.
   * Clearing the library deliberately is what the delete button is for.
   */
  if (!isObject(source.games) || !Array.isArray(source.gameOrder) || source.gameOrder.length === 0) {
    return { ok: false, reason: 'That file has no analysed games in it.' };
  }

  const state = pick(source);
  if (Object.keys(state).length === 0) {
    return { ok: false, reason: 'That file has nothing this app can restore.' };
  }

  return {
    ok: true,
    state,
    games: (source.gameOrder as unknown[]).length,
    exportedAt: wrapped && typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
  };
}

/** Hand the backup to the browser as a file. */
export function downloadBackup(state: Record<string, unknown>): void {
  const file = makeBackup(state);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chess-coach-backup-${file.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
