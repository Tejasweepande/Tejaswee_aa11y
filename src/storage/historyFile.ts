import { AuditHistoryItem, AuditHistoryMeta } from '../types/finding';

/**
 * The file written by "Download" on a history entry.
 * It holds the audit only: screenshot, scanned links, findings. It never holds the Figma
 * token or the Gemini key. The format is labelled and versioned (app, kind, version) so a
 * future version of the app can read it back; nothing reads it today.
 */
export const HISTORY_FILE_APP = 'a11y-lab';
export const HISTORY_FILE_KIND = 'audit-history';
export const HISTORY_FILE_VERSION = 1;

export interface HistoryFile {
  app: typeof HISTORY_FILE_APP;
  kind: typeof HISTORY_FILE_KIND;
  version: number;
  exportedAt: string;
  items: AuditHistoryItem[];
}

export function buildHistoryFile(items: AuditHistoryItem[]): HistoryFile {
  return { app: HISTORY_FILE_APP, kind: HISTORY_FILE_KIND, version: HISTORY_FILE_VERSION, exportedAt: new Date().toISOString(), items };
}

/** "error-mesages-png-2026-10-26": the audit's name and the day it was run, safe to use in a file name. */
const nameAndDay = (item: Pick<AuditHistoryItem, 'label' | 'createdAt'>): string => {
  const slug = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '') || 'audit';
  const day = (item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? new Date(item.createdAt) : new Date()).toISOString().slice(0, 10);
  return `${slug}-${day}`;
};

/** "a11y-lab-error-mesages-png-2026-10-26.json" */
export const auditFileName = (item: Pick<AuditHistoryItem, 'label' | 'createdAt'>): string => `a11y-lab-${nameAndDay(item)}.json`;

/** "a11y-lab-report-error-mesages-png-2026-10-26": the page title while a report prints, which is what the browser suggests as the PDF's name. */
export const reportTitle = (item: Pick<AuditHistoryItem, 'label' | 'createdAt'>): string => `a11y-lab-report-${nameAndDay(item)}`;

/** The light summary of an item, as shown in the history list. */
export function toMeta(item: AuditHistoryItem): AuditHistoryMeta {
  return {
    id: item.id,
    createdAt: item.createdAt,
    timestamp: item.timestamp,
    inputMode: item.inputMode,
    label: item.label,
    regionsCount: item.regionsCount,
    findingsCount: item.findingsCount,
  };
}

/** Sort key: the audit date, falling back to the number inside ids like "audit-1760000000000". */
export function createdAtMs(m: Pick<AuditHistoryMeta, 'id' | 'createdAt'>): number {
  const t = m.createdAt ? Date.parse(m.createdAt) : NaN;
  if (Number.isFinite(t)) return t;
  const fromId = Number(m.id.replace(/^\D+/, ''));
  return Number.isFinite(fromId) ? fromId : 0;
}
