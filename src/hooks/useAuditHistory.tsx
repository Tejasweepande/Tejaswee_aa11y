import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuditHistoryItem, AuditHistoryMeta } from '../types/finding';
import { MAX_HISTORY, deleteAudit, listAudits, loadAudit, saveAudit } from '../storage/historyStore';
import { auditFileName, buildHistoryFile, createdAtMs, toMeta } from '../storage/historyFile';

/**
 * The saved audit history, kept on this device (IndexedDB). Each finished audit is saved
 * automatically, only the newest MAX_HISTORY are kept, and the list holds light summaries;
 * a full audit is loaded when it is opened. Each entry can be downloaded as a file or deleted.
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
  add: (item: AuditHistoryItem) => Promise<void>;
  load: (id: string) => Promise<AuditHistoryItem | null>;
  /** Save one audit as a .json file on the user's computer. */
  downloadJson: (id: string) => Promise<void>;
  /**
   * Get one audit ready for its full report. Returns the audit (and tells the user what to do in the
   * print window), or null (and says why) when it cannot be found.
   */
  prepareReport: (id: string) => Promise<AuditHistoryItem | null>;
  /** Delete one audit from this device. */
  remove: (id: string) => Promise<void>;
  dismissNotice: () => void;
}

export const HistoryContext = createContext<HistoryController | null>(null);
export const useHistoryController = () => useContext(HistoryContext);

function saveJsonFile(name: string, data: unknown) {
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

export function useAuditHistoryState(): HistoryController {
  const [items, setItems] = useState<AuditHistoryMeta[]>([]);
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const [notice, setNotice] = useState<HistoryNotice | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Audits the browser would not save: kept here so they can still be opened this session
  const memoryOnly = useRef(new Map<string, AuditHistoryItem>());

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
      return;
    }
    memoryOnly.current.set(stamped.id, stamped);
    if (memoryOnly.current.size > MAX_HISTORY) memoryOnly.current.delete(memoryOnly.current.keys().next().value as string);
    if (res.reason === 'unavailable') setCanSave(false);
    setNotice({
      kind: 'error',
      text:
        res.reason === 'quota'
          ? 'This audit could not be saved because the browser storage is full. You can still open it until you refresh. Delete an older audit to free space.'
          : res.reason === 'unavailable'
          ? 'This browser is not letting the app save audits (a private window can do this). They will be lost when you refresh.'
          : 'This audit could not be saved. You can still open it until you refresh.',
    });
  }, []);

  const load = useCallback(async (id: string) => {
    const inMemory = memoryOnly.current.get(id);
    if (inMemory) return inMemory;
    try {
      return await loadAudit(id);
    } catch {
      return null;
    }
  }, []);

  const downloadJson = useCallback(
    async (id: string) => {
      const item = await load(id);
      if (!item) {
        setNotice({ kind: 'error', text: 'That audit could not be found, so it could not be downloaded.' });
        return;
      }
      saveJsonFile(auditFileName(item), buildHistoryFile([item]));
      setNotice({
        kind: 'success',
        text: `Downloaded “${item.label}” as a JSON file. It contains the screenshot and the links you scanned, so keep it private. It does not contain your Figma token or Gemini key.`,
      });
    },
    [load]
  );

  const prepareReport = useCallback(
    async (id: string) => {
      const item = await load(id);
      if (!item) {
        setNotice({ kind: 'error', text: 'That audit could not be found, so its report could not be opened.' });
        return null;
      }
      setNotice({ kind: 'info', text: `Opening the report for “${item.label}”. In the print window, choose “Save as PDF”.` });
      return item;
    },
    [load]
  );

  const remove = useCallback(async (id: string) => {
    const label = itemsRef.current.find((i) => i.id === id)?.label ?? 'The audit';
    try {
      await deleteAudit(id);
    } catch (err) {
      // No storage at all (the audit only ever lived in memory): removing it from the list is enough.
      // Any other failure means it is still saved, so say so and keep it listed.
      if (!(err instanceof Error && /not available/i.test(err.message))) {
        setNotice({ kind: 'error', text: `“${label}” could not be deleted. Please try again.` });
        return;
      }
    }
    memoryOnly.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setNotice({ kind: 'success', text: `Deleted “${label}”.` });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { items, ready, canSave, notice, add, load, downloadJson, prepareReport, remove, dismissNotice };
}
