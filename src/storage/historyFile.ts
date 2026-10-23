import { AuditHistoryItem, AuditHistoryMeta } from '../types/finding';

/**
 * The file written by "Export history" and read by "Import history".
 * It holds audits only: screenshots, scanned links, findings. It never holds the Figma
 * token or the Gemini key.
 */
export const HISTORY_FILE_APP = 'a11y-lab';
export const HISTORY_FILE_KIND = 'audit-history';
export const HISTORY_FILE_VERSION = 1;
/** Refuse files bigger than this instead of freezing the tab on a huge parse. */
export const MAX_IMPORT_BYTES = 300 * 1024 * 1024;

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

export const historyFileName = (now = new Date()): string => `a11y-lab-history-${now.toISOString().slice(0, 10)}.json`;

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

const MODULES = ['contrast', 'keyboard', 'screenreader', 'structure'];
const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'];
const MODES = ['image', 'figma', 'url'];
const SCALES = ['1x', '2x', '3x', 'unknown'];

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function isValidFinding(f: unknown): boolean {
  if (!isObj(f)) return false;
  const w = f.wcag;
  return (
    isStr(f.id) && isStr(f.module) && MODULES.includes(f.module) && isStr(f.severity) && SEVERITIES.includes(f.severity) &&
    isStr(f.evidence) && isObj(f.target) && isObj(w) && isStr(w.sc) && isStr(w.name) && isStr(w.level)
  );
}

/**
 * Checks an item from an imported file and returns a cleaned copy, or null if it is not a
 * usable audit. The app renders these findings directly, so a malformed one must never get
 * in. Remote image addresses are dropped: opening a file should not make the browser
 * contact other sites.
 */
export function cleanImportedItem(x: unknown): AuditHistoryItem | null {
  if (!isObj(x)) return null;
  if (!isStr(x.id) || !x.id || x.id.length > 200) return null;
  if (!isStr(x.inputMode) || !MODES.includes(x.inputMode)) return null;
  if (!isStr(x.label) || !isStr(x.timestamp)) return null;
  if (x.createdAt !== undefined && (!isStr(x.createdAt) || Number.isNaN(Date.parse(x.createdAt)))) return null;
  if (!isNum(x.regionsCount) || !isNum(x.findingsCount)) return null;
  if (!Array.isArray(x.findings) || !x.findings.every(isValidFinding)) return null;
  if (!Array.isArray(x.regions) || !x.regions.every((r) => isObj(r) && isStr(r.id) && isObj(r.bbox))) return null;
  if (!Array.isArray(x.screenReaderItems) || !x.screenReaderItems.every((r) => isObj(r) && isStr(r.id))) return null;
  if (!isObj(x.moduleToggles) || !MODULES.every((m) => typeof (x.moduleToggles as Record<string, unknown>)[m] === 'boolean')) return null;
  if (!isStr(x.exportScale) || !SCALES.includes(x.exportScale)) return null;
  if (x.iframeHtml !== null && x.iframeHtml !== undefined && !isStr(x.iframeHtml)) return null;
  const img = isStr(x.imageSrc) && /^data:image\/[a-z0-9.+-]+[;,]/i.test(x.imageSrc) ? x.imageSrc : null;
  return {
    ...(x as unknown as AuditHistoryItem),
    imageSrc: img,
    iframeHtml: isStr(x.iframeHtml) ? x.iframeHtml : null,
    figmaUrl: isStr(x.figmaUrl) ? x.figmaUrl : '',
    webUrl: isStr(x.webUrl) ? x.webUrl : '',
    pastedHtml: isStr(x.pastedHtml) ? x.pastedHtml : '',
    exemptedCount: isNum(x.exemptedCount) ? x.exemptedCount : 0,
    exemptedDetails: Array.isArray(x.exemptedDetails) ? x.exemptedDetails : [],
  };
}

export type ParsedHistoryFile = { ok: true; items: AuditHistoryItem[]; invalid: number } | { ok: false; error: string };

export function parseHistoryFile(text: string): ParsedHistoryFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObj(data) || data.app !== HISTORY_FILE_APP || data.kind !== HISTORY_FILE_KIND) {
    return { ok: false, error: 'This is not an A11y Lab history file.' };
  }
  if (data.version !== HISTORY_FILE_VERSION) {
    return { ok: false, error: `This history file is version ${String(data.version)}, which this version of the app cannot read.` };
  }
  if (!Array.isArray(data.items)) return { ok: false, error: 'The file contains no audits.' };
  const items: AuditHistoryItem[] = [];
  let invalid = 0;
  for (const raw of data.items) {
    const item = cleanImportedItem(raw);
    if (item) items.push(item);
    else invalid += 1;
  }
  return { ok: true, items, invalid };
}
