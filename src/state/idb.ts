/**
 * Minimal IndexedDB key/value store used to persist analysed games.
 *
 * localStorage is not an option here: one analysed game runs to tens of
 * kilobytes of per-move evaluations and principal variations, so a few dozen
 * games would blow the ~5MB quota.
 */
const DB_NAME = 'chess-coach';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
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
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    try {
      await tx('readwrite', (s) => s.put(value, name));
    } catch {
      /* Storage may be unavailable in private browsing; the app still works. */
    }
  },
  async removeItem(name: string): Promise<void> {
    try {
      await tx('readwrite', (s) => s.delete(name));
    } catch {
      /* ignore */
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
