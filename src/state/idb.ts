/**
 * Minimal IndexedDB key/value store used to persist analysed games.
 *
 * localStorage is not an option here: one analysed game runs to tens of
 * kilobytes of per-move evaluations and principal variations, so a few dozen
 * games would blow the ~5MB quota.
 */
const DB_NAME = 'chess-coach';
const STORE = 'kv';

/**
 * What has gone wrong with storage, if anything.
 *
 * `null` is the normal case. `'read'` means the saved state could not be read
 * back, which is the dangerous one: an unreadable store is indistinguishable
 * from an empty one, so without this flag the app would come up looking like a
 * fresh install and then write that emptiness over data that was fine.
 * `'write'` means nothing new is being saved.
 *
 * Both used to be swallowed. The app told the player their games were stored
 * on this machine while quietly storing nothing.
 */
export type StorageFault = null | 'read' | 'write';

let fault: StorageFault = null;
const watchers = new Set<() => void>();

export function getStorageFault(): StorageFault {
  return fault;
}

export function subscribeStorageFault(fn: () => void): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}

function raise(next: Exclude<StorageFault, null>): void {
  // A read fault outranks a write fault, because it is the one that makes
  // writing unsafe — and once reading has failed, writes are refused anyway.
  if (fault === 'read' || fault === next) return;
  fault = next;
  for (const w of [...watchers]) w();
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise = opening;
  /*
   * A rejected promise must not be cached. It used to be, so a single failure
   * to open — another tab mid-upgrade, a browser that briefly refuses — made
   * every read and write for the life of the page fail against it.
   */
  opening.catch(() => { if (dbPromise === opening) dbPromise = null; });
  return opening;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const idbStorage = {
  async getItem(name: string): Promise<string | null> {
    try {
      return (await tx<string | undefined>('readonly', (s) => s.get(name))) ?? null;
    } catch {
      /*
       * Still null, because the caller's contract has no third answer — but
       * the fault is recorded, and every write below is refused from here on.
       * Returning null quietly was how an unreadable database turned into an
       * empty one on the next keystroke.
       */
      raise('read');
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    if (fault === 'read') return;
    try {
      await tx('readwrite', (s) => s.put(value, name));
    } catch {
      /* Storage may be unavailable in private browsing; the app still works,
       * but it must stop claiming the session is being saved. */
      raise('write');
    }
  },
  async removeItem(name: string): Promise<void> {
    if (fault === 'read') return;
    try {
      await tx('readwrite', (s) => s.delete(name));
    } catch {
      raise('write');
    }
  },
};

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
