import React from 'react';
import { useHistoryController } from '../hooks/useAuditHistory';
import { createdAtMs } from '../storage/historyFile';
import { AuditHistoryMeta } from '../types/finding';

/** "Oct 15, 10:20 AM". Older items without a date show the time they were saved. */
export const formatWhen = (m: Pick<AuditHistoryMeta, 'id' | 'createdAt' | 'timestamp'>): string => {
  if (!m.createdAt) return m.timestamp;
  const t = createdAtMs(m);
  return t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : m.timestamp;
};

/**
 * What just happened (downloaded, deleted, could not save), announced to screen readers.
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
