import { openDb, request, transactionDone } from './idb';

/**
 * The Gemini API key, kept in this browser the same way the audit history is: in the browser's own
 * storage (IndexedDB) on this device, in its own small database, never sent anywhere except to Google
 * when Gemini is called. It is saved once, so a refresh does not ask for it again.
 *
 * Nothing in the app ever displays it. If the browser will not store it (some private windows), every
 * function here fails quietly and the app falls back to remembering the key only for the open tab.
 */
const STORE = 'gemini_key';
const ID = 'key';
const openKeyDb = () => openDb('a11y-lab-gemini', [STORE]);

/** The saved key, or '' when there is none (or the browser cannot store one). */
export async function loadGeminiKey(): Promise<string> {
  try {
    const db = await openKeyDb();
    const rec = (await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(ID))) as { id: string; value: string } | undefined;
    return rec?.value ?? '';
  } catch {
    return '';
  }
}

/** Save the key. Returns false if the browser would not store it. */
export async function saveGeminiKey(key: string): Promise<boolean> {
  try {
    const db = await openKeyDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: ID, value: key, savedAt: new Date().toISOString() });
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  }
}

/** Remove the saved key (used when Google no longer accepts it). */
export async function forgetGeminiKey(): Promise<void> {
  try {
    const db = await openKeyDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(ID);
    await transactionDone(tx);
  } catch {
    /* nothing was saved, or the browser cannot store: nothing to remove */
  }
}
