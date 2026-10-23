/**
 * Tiny promise wrapper around IndexedDB, the browser's built-in storage that lives on the
 * user's own device. Each feature opens its own database (history, saved keys) so they stay
 * independent of each other. Nothing here ever leaves the browser.
 */
const DB_VERSION = 1;

const connections = new Map<string, Promise<IDBDatabase>>();

/** Open (and on first use create) a database whose stores all use `id` as their key. */
export function openDb(name: string, stores: readonly string[]): Promise<IDBDatabase> {
  let pending = connections.get(name);
  if (!pending) {
    pending = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser'));
        return;
      }
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab upgrading the database: step aside, reopen on next use
        db.onversionchange = () => {
          db.close();
          connections.delete(name);
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Could not open the database'));
      req.onblocked = () => reject(new Error('The database is blocked by another tab'));
    }).catch((err) => {
      connections.delete(name);
      throw err;
    });
    connections.set(name, pending);
  }
  return pending;
}

/** For tests: close every connection so a "page refresh" can reopen them. */
export async function closeAllDbs(): Promise<void> {
  const all = Array.from(connections.values());
  connections.clear();
  for (const p of all) {
    try {
      (await p).close();
    } catch {
      /* already closed */
    }
  }
}

export const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });

export const isQuotaError = (err: unknown): boolean =>
  !!err && typeof err === 'object' && ((err as { name?: string }).name === 'QuotaExceededError' || (err as { code?: number }).code === 22);
