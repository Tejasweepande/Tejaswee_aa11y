import { AuditHistoryItem, AuditHistoryMeta } from '../types/finding';
import { createdAtMs, toMeta } from './historyFile';
import { isQuotaError, openDb, request, transactionDone } from './idb';

export const STORE_META = 'history_meta'; // the light summary of each audit (for the list)
export const STORE_DATA = 'history_data'; // the full audit, loaded when it is opened
const openHistoryDb = () => openDb('a11y-lab-history', [STORE_META, STORE_DATA]);

/** How many audits are kept. Older ones are removed automatically. */
export const MAX_HISTORY = 20;

export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'quota' | 'error' };

const newestFirst = (a: AuditHistoryMeta, b: AuditHistoryMeta) => createdAtMs(b) - createdAtMs(a);

/** Newest first. Light summaries only. */
export async function listAudits(): Promise<AuditHistoryMeta[]> {
  const db = await openHistoryDb();
  const metas = (await request(db.transaction(STORE_META, 'readonly').objectStore(STORE_META).getAll())) as AuditHistoryMeta[];
  return metas.sort(newestFirst);
}

export async function loadAudit(id: string): Promise<AuditHistoryItem | null> {
  const db = await openHistoryDb();
  const rec = (await request(db.transaction(STORE_DATA, 'readonly').objectStore(STORE_DATA).get(id))) as { id: string; item: AuditHistoryItem } | undefined;
  return rec ? rec.item : null;
}

async function writeAndPrune(items: AuditHistoryItem[], keep: number): Promise<{ added: number }> {
  const db = await openHistoryDb();
  const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
  const metaStore = tx.objectStore(STORE_META);
  const dataStore = tx.objectStore(STORE_DATA);
  const done = transactionDone(tx);
  done.catch(() => undefined);
  let added = 0;
  for (const item of items) {
    const withDate: AuditHistoryItem = item.createdAt ? item : { ...item, createdAt: new Date(createdAtMs(item)).toISOString() };
    const exists = await request(metaStore.getKey(withDate.id));
    if (exists === undefined) added += 1;
    metaStore.put(toMeta(withDate));
    dataStore.put({ id: withDate.id, item: withDate });
  }
  // Keep only the newest `keep`, removing the rest from both stores in the same transaction
  const all = ((await request(metaStore.getAll())) as AuditHistoryMeta[]).sort(newestFirst);
  for (const old of all.slice(keep)) {
    metaStore.delete(old.id);
    dataStore.delete(old.id);
  }
  await done;
  return { added };
}

/** Save one finished audit and drop anything beyond the newest MAX_HISTORY. */
export async function saveAudit(item: AuditHistoryItem): Promise<SaveResult> {
  try {
    await writeAndPrune([item], MAX_HISTORY);
    return { ok: true };
  } catch (err) {
    if (isQuotaError(err)) {
      // Storage is full: make room by keeping fewer, then try once more
      try {
        await writeAndPrune([item], Math.max(1, Math.floor(MAX_HISTORY / 2)));
        return { ok: true };
      } catch (err2) {
        return { ok: false, reason: isQuotaError(err2) ? 'quota' : 'error' };
      }
    }
    return { ok: false, reason: err instanceof Error && /not available/i.test(err.message) ? 'unavailable' : 'error' };
  }
}

export async function clearHistory(): Promise<void> {
  const db = await openHistoryDb();
  const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
  tx.objectStore(STORE_META).clear();
  tx.objectStore(STORE_DATA).clear();
  await transactionDone(tx);
}

/** Every saved audit, in full, newest first. Used by Export. */
export async function loadAllAudits(): Promise<AuditHistoryItem[]> {
  const metas = await listAudits();
  const items: AuditHistoryItem[] = [];
  for (const m of metas) {
    const item = await loadAudit(m.id);
    if (item) items.push(item);
  }
  return items;
}

/** Merge imported audits in (an audit that is already saved is skipped), then re-apply the cap. */
export async function importAudits(items: AuditHistoryItem[]): Promise<{ added: number; duplicates: number }> {
  const existing = new Set((await listAudits()).map((m) => m.id));
  const fresh = items.filter((i) => !existing.has(i.id));
  if (fresh.length === 0) return { added: 0, duplicates: items.length };
  await writeAndPrune(fresh, MAX_HISTORY);
  // "added" = how many of the new ones survived the cap
  const kept = new Set((await listAudits()).map((m) => m.id));
  return { added: fresh.filter((i) => kept.has(i.id)).length, duplicates: items.length - fresh.length };
}
