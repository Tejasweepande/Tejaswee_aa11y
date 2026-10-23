import React, { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { useHistoryController } from '../hooks/useAuditHistory';
import { MAX_HISTORY } from '../storage/historyStore';
import { createdAtMs } from '../storage/historyFile';
import { AuditHistoryMeta } from '../types/finding';

/** "Oct 15, 10:20 AM". Older items without a date show the time they were saved. */
export const formatWhen = (m: Pick<AuditHistoryMeta, 'id' | 'createdAt' | 'timestamp'>): string => {
  if (!m.createdAt) return m.timestamp;
  const t = createdAtMs(m);
  return t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : m.timestamp;
};

const toolBtn =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm font-semibold text-lab-text bg-lab-subtle border border-lab-border hover:border-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-sky-500';

/**
 * Export / Import / Clear for the saved audit history, plus an honest line about where it lives.
 * Without a history provider it renders nothing.
 */
export const HistoryTools: React.FC = () => {
  const h = useHistoryController();
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!h) return null;
  const { items, notice, canSave } = h;

  const saveLine = canSave ? '' : 'This browser is not letting the app save, so audits last only until you refresh.';

  return (
    <div className="space-y-3 pt-1" data-testid="history-tools">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toolBtn} onClick={() => void h.exportAll()} disabled={items.length === 0}>
          <Download className="w-4 h-4" aria-hidden="true" />
          Export
        </button>
        <button type="button" className={toolBtn} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" aria-hidden="true" />
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose an A11y Lab history file to import"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // so choosing the same file again still fires
            if (file) void h.importFile(file);
          }}
        />
        {confirming ? (
          <span role="group" aria-label="Confirm clearing history" className="inline-flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-lab-text">Delete all saved audits?</span>
            <button
              type="button"
              className="px-3 py-2 rounded text-sm font-bold bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500"
              onClick={() => {
                setConfirming(false);
                void h.clear();
              }}
            >
              Yes, delete
            </button>
            <button type="button" className={toolBtn} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className={`${toolBtn} text-red-600 dark:text-red-400`} onClick={() => setConfirming(true)} disabled={items.length === 0}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear history
          </button>
        )}
      </div>

      <p className="text-xs text-lab-dim leading-relaxed">
        Saved on this device only. Keeps the latest {MAX_HISTORY} audits ({items.length} saved now). {saveLine}
      </p>

      <div role="status" aria-live="polite" className={notice ? `text-sm leading-relaxed ${notice.kind === 'error' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-lab-text'}` : 'sr-only'}>
        {notice?.text ?? ''}
      </div>
    </div>
  );
};
