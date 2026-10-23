import React, { useEffect, useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { useHistoryController } from '../hooks/useAuditHistory';
import { ConfirmDialog } from './ConfirmDialog';
import { MAX_HISTORY } from '../storage/historyStore';
import { createdAtMs } from '../storage/historyFile';
import { formatBytes } from '../storage/storageInfo';
import { AuditHistoryMeta } from '../types/finding';

/** "Oct 15, 10:20 AM". Older items without a date show the time they were saved. */
export const formatWhen = (m: Pick<AuditHistoryMeta, 'id' | 'createdAt' | 'timestamp'>): string => {
  if (!m.createdAt) return m.timestamp;
  const t = createdAtMs(m);
  return t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : m.timestamp;
};

const iconBtn =
  'inline-flex items-center justify-center w-9 h-9 rounded text-lab-text bg-lab-subtle border border-lab-border hover:border-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-sky-500';

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, danger, buttonRef, children }) => (
  // Icon only, so the name lives in aria-label (screen readers) and title (the hover tooltip)
  <button ref={buttonRef} type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`${iconBtn}${danger ? ' text-red-600 dark:text-red-400' : ''}`}>
    {children}
  </button>
);

/**
 * Export / Import / Clear as three icon buttons for the title row of the History page.
 * Clearing asks first, in a dialog. Without a history provider it renders nothing.
 */
export const HistoryActions: React.FC = () => {
  const h = useHistoryController();
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const focusImportNext = useRef(false);

  // After everything is deleted the Clear button is disabled, so hand focus to Import
  useEffect(() => {
    if (!confirming && focusImportNext.current) {
      focusImportNext.current = false;
      importRef.current?.focus();
    }
  }, [confirming]);

  if (!h) return null;
  const count = h.items.length;

  return (
    <div role="group" aria-label="History actions" className="flex items-center gap-1.5 shrink-0" data-testid="history-actions">
      <IconButton label="Export history" onClick={() => void h.exportAll()} disabled={count === 0}>
        <Download className="w-4 h-4" aria-hidden="true" />
      </IconButton>
      <IconButton label="Import history" onClick={() => fileRef.current?.click()} buttonRef={importRef}>
        <Upload className="w-4 h-4" aria-hidden="true" />
      </IconButton>
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
      <IconButton label="Clear history" onClick={() => setConfirming(true)} disabled={count === 0} danger buttonRef={clearRef}>
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </IconButton>
      {confirming && (
        <ConfirmDialog
          title="Clear history?"
          icon={<Trash2 className="w-5 h-5" />}
          description={`This permanently deletes ${count === 1 ? 'the 1 saved audit' : `all ${count} saved audits`} from this device. It can't be undone. If you might want ${count === 1 ? 'it' : 'them'} back, export first.`}
          confirmLabel="Delete all"
          returnFocusRef={clearRef}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            focusImportNext.current = true;
            setConfirming(false);
            void h.clear();
          }}
        />
      )}
    </div>
  );
};

/**
 * What just happened (exported, imported, cleared, could not save), announced to screen readers.
 * It sits under the title, so it is seen straight away even with a long list below.
 * Without a history provider it renders nothing.
 */
export const HistoryNotice: React.FC = () => {
  const h = useHistoryController();
  if (!h) return null;
  const notice = h.notice;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="history-notice"
      className={notice ? `mb-4 text-sm leading-relaxed ${notice.kind === 'error' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-lab-text'}` : 'sr-only'}
    >
      {notice?.text ?? ''}
    </div>
  );
};

/** An honest line about where the history lives. Without a history provider it renders nothing. */
export const HistoryStorageNote: React.FC = () => {
  const h = useHistoryController();
  const refreshInfo = h?.refreshInfo;

  useEffect(() => {
    void refreshInfo?.();
  }, [refreshInfo]);

  if (!h) return null;
  const { items, info, canSave } = h;

  const persistLine = !canSave
    ? 'This browser is not letting the app save, so audits last only until you refresh.'
    : info?.persisted === true
    ? 'Your browser will keep this until you clear it.'
    : info?.persisted === false
    ? 'Your browser may clear this if it runs low on space. Export a backup to be safe.'
    : '';

  return (
    <p className="mt-4 text-xs text-lab-dim leading-relaxed" data-testid="history-storage-note">
      Saved on this device only. Keeps the latest {MAX_HISTORY} audits ({items.length} saved now)
      {info?.usageBytes != null ? `, using ${formatBytes(info.usageBytes)} of browser storage` : ''}. {persistLine}
    </p>
  );
};
