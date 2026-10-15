/**
 * Tiny promise wrapper around IndexedDB. Everything the app saves on the user's device
 * lives in one database with three stores:
 *   history_meta  the light summary of each audit (for the list)
 *   history_data  the full audit (screenshot, page HTML, findings...), loaded on demand
 *   vault         the saved Figma token / Gemini key (plain or encrypted)
 * Nothing here ever leaves the browser.
 */
const DB_NAME = 'a11y-lab';
const DB_VERSION = 1;

export const STORE_META = 'history_meta';
export const STORE_DATA = 'history_data';
export const STORE_VAULT = 'vault';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of [STORE_META, STORE_DATA, STORE_VAULT]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab upgrading the database: step aside, reopen on next use
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Could not open the database'));
      req.onblocked = () => reject(new Error('The database is blocked by another tab'));
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** For tests: close the connection so a "page refresh" can reopen it. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    (await dbPromise).close();
  } catch {
    /* already closed */
  }
  dbPromise = null;
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
