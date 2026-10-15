import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuditHistoryItem, AuditHistoryMeta } from '../types/finding';
import { MAX_HISTORY, clearHistory, importAudits, listAudits, loadAllAudits, loadAudit, saveAudit } from '../storage/historyStore';
import { MAX_IMPORT_BYTES, buildHistoryFile, createdAtMs, historyFileName, parseHistoryFile, toMeta } from '../storage/historyFile';
import { StorageInfo, getStorageInfo, requestPersistence } from '../storage/persistence';

/**
 * The saved audit history, kept on this device (IndexedDB). Each finished audit is saved
 * automatically, only the newest MAX_HISTORY are kept, and the list holds light summaries;
 * a full audit is loaded when it is opened.
 *
 * If the browser will not let the app save (a private window, full disk), audits still show up
 * for this session from memory and a notice says they will be lost on refresh.
 */
export type HistoryNotice = { kind: 'success' | 'info' | 'error'; text: string };

export interface HistoryController {
  items: AuditHistoryMeta[];
  ready: boolean;
  /** false when the browser cannot save at all (items then live in memory only) */
  canSave: boolean;
  notice: HistoryNotice | null;
  info: StorageInfo | null;
  add: (item: AuditHistoryItem) => Promise<void>;
  load: (id: string) => Promise<AuditHistoryItem | null>;
  clear: () => Promise<void>;
  exportAll: () => Promise<void>;
  importFile: (file: File) => Promise<void>;
  refreshInfo: () => Promise<void>;
  dismissNotice: () => void;
}

export const HistoryContext = createContext<HistoryController | null>(null);
export const useHistoryController = () => useContext(HistoryContext);

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file);
  });

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function useAuditHistoryState(): HistoryController {
  const [items, setItems] = useState<AuditHistoryMeta[]>([]);
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const [notice, setNotice] = useState<HistoryNotice | null>(null);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  // Audits the browser would not save: kept here so they can still be opened this session
  const memoryOnly = useRef(new Map<string, AuditHistoryItem>());

  const refreshInfo = useCallback(async () => {
    setInfo(await getStorageInfo());
  }, []);

  useEffect(() => {
    let alive = true;
    listAudits()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setCanSave(false))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback(async (item: AuditHistoryItem) => {
    const stamped: AuditHistoryItem = item.createdAt ? item : { ...item, createdAt: new Date().toISOString() };
    // Show it straight away; saving happens in the background
    setItems((prev) => [toMeta(stamped), ...prev.filter((p) => p.id !== stamped.id)].sort((a, b) => createdAtMs(b) - createdAtMs(a)).slice(0, MAX_HISTORY));
    const res = await saveAudit(stamped);
    if (res.ok) {
      memoryOnly.current.delete(stamped.id);
      setCanSave(true);
      void requestPersistence(); // asked after a first real save, never on page load
      void refreshInfo();
      return;
    }
    memoryOnly.current.set(stamped.id, stamped);
    if (memoryOnly.current.size > MAX_HISTORY) memoryOnly.current.delete(memoryOnly.current.keys().next().value as string);
    if (res.reason === 'unavailable') setCanSave(false);
    setNotice({
      kind: 'error',
      text:
        res.reason === 'quota'
          ? 'This audit could not be saved because the browser storage is full. You can still open it until you refresh. Export or clear history to free space.'
          : res.reason === 'unavailable'
          ? 'This browser is not letting the app save audits (a private window can do this). They will be lost when you refresh.'
          : 'This audit could not be saved. You can still open it until you refresh.',
    });
  }, [refreshInfo]);

  const load = useCallback(async (id: string) => {
    const inMemory = memoryOnly.current.get(id);
    if (inMemory) return inMemory;
    try {
      return await loadAudit(id);
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await clearHistory();
    } catch {
      /* nothing was saved */
    }
    memoryOnly.current.clear();
    setItems([]);
    setNotice({ kind: 'success', text: 'Saved history cleared.' });
    void refreshInfo();
  }, [refreshInfo]);

  const exportAll = useCallback(async () => {
    let all: AuditHistoryItem[] = [];
    try {
      all = await loadAllAudits();
    } catch {
      /* fall back to what is in memory */
    }
    const seen = new Set(all.map((a) => a.id));
    for (const m of memoryOnly.current.values()) if (!seen.has(m.id)) all.push(m);
    if (all.length === 0) {
      setNotice({ kind: 'info', text: 'There are no audits to export yet.' });
      return;
    }
    downloadJson(historyFileName(), buildHistoryFile(all));
    setNotice({
      kind: 'success',
      text: `Exported ${plural(all.length, 'audit', 'audits')}. The file contains your screenshots and the links you scanned, so keep it private. It does not contain your Figma token or Gemini key.`,
    });
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMPORT_BYTES) {
        setNotice({ kind: 'error', text: 'That file is too large to import (over 300 MB).' });
        return;
      }
      let parsed;
      try {
        parsed = parseHistoryFile(await readFileAsText(file));
      } catch {
        setNotice({ kind: 'error', text: 'That file could not be read.' });
        return;
      }
      if (!parsed.ok) {
        setNotice({ kind: 'error', text: parsed.error });
        return;
      }
      if (parsed.items.length === 0) {
        setNotice({ kind: 'error', text: parsed.invalid > 0 ? `None of the ${plural(parsed.invalid, 'audit', 'audits')} in that file could be read.` : 'That file contains no audits.' });
        return;
      }
      try {
        const { added, duplicates } = await importAudits(parsed.items);
        setItems(await listAudits());
        setCanSave(true);
        void requestPersistence();
        void refreshInfo();
        const fresh = parsed.items.length - duplicates;
        const bits = [`Imported ${plural(added, 'audit', 'audits')}`];
        if (duplicates > 0) bits.push(`${duplicates} already saved`);
        if (parsed.invalid > 0) bits.push(`${parsed.invalid} could not be read`);
        if (fresh > added) bits.push(`only the newest ${MAX_HISTORY} are kept`);
        setNotice({ kind: added > 0 ? 'success' : 'info', text: bits.join(', ') + '.' });
      } catch {
        setNotice({ kind: 'error', text: 'The audits could not be saved on this device.' });
      }
    },
    [refreshInfo]
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { items, ready, canSave, notice, info, add, load, clear, exportAll, importFile, refreshInfo, dismissNotice };
}
