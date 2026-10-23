import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * A modal that asks before something that cannot be undone.
 *
 * Follows the alert-dialog pattern: focus starts on the SAFE button (Cancel), Tab stays inside
 * the dialog, Escape or a click outside cancels, and focus goes back to where it was when it
 * closes. It is drawn on top of the page (not inside the panel), so nothing can clip it.
 */
export const ConfirmDialog: React.FC<{
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  /** The button that opened the dialog. Focus goes back to it when the dialog closes. Named explicitly
   *  because Safari and Firefox on a Mac do not focus a button when it is clicked. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, description, confirmLabel, cancelLabel = 'Cancel', icon, returnFocusRef, onConfirm, onCancel }) => {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      const back = returnFocusRef?.current ?? before;
      if (back && document.contains(back) && !(back as HTMLButtonElement).disabled) back.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      const order = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
      const at = order.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? order.length - 1 : at - 1) : at === -1 || at === order.length - 1 ? 0 : at + 1;
      e.preventDefault();
      order[next].focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault(); // stop the browser moving focus to the page, so focus can return to the button
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm bg-lab-card border border-lab-border rounded-lg shadow-2xl p-5"
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-lab-text">
              {title}
            </h2>
            <p id={descId} className="mt-1 text-sm text-lab-muted leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm font-semibold text-lab-text bg-lab-subtle border border-lab-border hover:border-sky-500/50 focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded text-sm font-bold bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-lab-card transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
