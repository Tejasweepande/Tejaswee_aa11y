import React, { useEffect, useRef, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { useHistoryController } from '../hooks/useAuditHistory';
import { AuditHistoryMeta } from '../types/finding';
import { ConfirmDialog } from './ConfirmDialog';
import { HistoryEmptyState } from './HistoryEmptyState';
import { HistoryEntryMenu } from './HistoryEntryMenu';
import { formatWhen } from './HistoryTools';

/**
 * The saved audits, newest first, or the zero state when there are none.
 *
 * Clicking a card opens that audit. The ⋮ menu to the right of its date offers Download and
 * Delete; Delete asks first. After a delete, focus moves to the next entry (or to the zero
 * state), so keyboard and screen-reader users are not left stranded.
 */
export const HistoryEntries: React.FC<{ items: AuditHistoryMeta[]; onOpen: (m: AuditHistoryMeta) => void }> = ({ items, onOpen }) => {
  const h = useHistoryController();
  const [deleting, setDeleting] = useState<AuditHistoryMeta | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement | null>());
  const openers = useRef(new Map<string, HTMLButtonElement | null>());
  const returnTo = useRef<HTMLButtonElement | null>(null);
  const focusIndex = useRef<number | null>(null);

  // After a delete: focus the entry that moved into its place, or the zero state when none is left
  useEffect(() => {
    if (focusIndex.current === null) return;
    const i = Math.min(focusIndex.current, items.length - 1);
    focusIndex.current = null;
    const next = i >= 0 ? openers.current.get(items[i].id) : document.querySelector<HTMLElement>('[data-testid="history-empty-title"]');
    next?.focus();
  }, [items]);

  if (items.length === 0) return <HistoryEmptyState />;

  return (
    <>
      <div className="flex flex-col gap-3">
        {items.map((audit) => (
          <div
            key={audit.id}
            data-testid="history-entry"
            className="relative rounded border border-lab-border bg-lab-subtle/50 shadow-sm transition-all hover:border-sky-500/50 hover:bg-lab-elevated"
          >
            <button
              ref={(el) => void openers.current.set(audit.id, el)}
              type="button"
              onClick={() => onOpen(audit)}
              className="flex flex-col gap-2 w-full p-3 pr-12 rounded text-sm text-left focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <div className="flex justify-between items-center w-full gap-3">
                <span className="font-semibold text-lab-text truncate">{audit.label}</span>
                <span className="text-lab-muted flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" aria-hidden="true" /> {formatWhen(audit)}
                </span>
              </div>
              <div className="flex items-center text-xs text-lab-muted w-full">
                <span className="flex gap-3">
                  <span title="Regions Scanned" className="flex items-center gap-1">
                    <span className="font-semibold text-lab-text">{audit.regionsCount}</span> Regions
                  </span>
                  <span title="Barriers Found" className={`flex items-center gap-1 font-semibold ${audit.findingsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {audit.findingsCount} Barriers
                  </span>
                </span>
              </div>
            </button>
            {h && (
              <div className="absolute top-1.5 right-2">
                <HistoryEntryMenu
                  entryLabel={audit.label}
                  triggerRef={(el) => void triggers.current.set(audit.id, el)}
                  onDownload={() => void h.downloadOne(audit.id)}
                  onDelete={() => {
                    returnTo.current = triggers.current.get(audit.id) ?? null;
                    setDeleting(audit);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {deleting && h && (
        <ConfirmDialog
          title="Delete this audit?"
          icon={<Trash2 className="w-5 h-5" />}
          description={`“${deleting.label}” from ${formatWhen(deleting)} will be permanently deleted from this device. It can't be undone. If you might want it back, download it first.`}
          confirmLabel="Delete"
          returnFocusRef={returnTo}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            focusIndex.current = items.findIndex((i) => i.id === deleting.id);
            const id = deleting.id;
            setDeleting(null);
            void h.remove(id);
          }}
        />
      )}
    </>
  );
};
