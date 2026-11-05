import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, EllipsisVertical, Trash2 } from 'lucide-react';

const MENU_WIDTH = 176;

/**
 * The ⋮ button on a history entry, and the little menu it opens: Download or Delete.
 *
 * A standard menu button: Enter, Space or the arrow keys open it, the arrows (and Home / End) move
 * between the items, Escape or Tab close it and put focus back on the button, and a click outside
 * closes it. The menu is drawn on top of the page, so the scrolling list cannot clip it, and it
 * opens upward when there is no room below.
 */
export const HistoryEntryMenu: React.FC<{
  entryLabel: string;
  /** Lets the parent put focus back on this button after a dialog closes. */
  triggerRef?: (el: HTMLButtonElement | null) => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ entryLabel, triggerRef, onDownload, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const focusItem = (i: number) => {
    const list = items();
    if (list.length) list[(i + list.length) % list.length].focus();
  };
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  // Work out where to draw the menu once it exists and can be measured
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below;
    const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top, left });
  }, [open]);

  // Once it is placed, move focus into it
  useEffect(() => {
    if (open && pos) focusItem(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos === null]);

  // Close when the page moves under it, or when the user clicks elsewhere
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close(false);
    };
    const move = () => close(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open, close]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(list.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') { e.preventDefault(); close(true); }
  };

  const choose = (action: () => void) => () => {
    close(true);
    action();
  };

  // The focus ring is drawn inside the row (the app's default ring is drawn outside and would spill over the menu's edge)
  const itemClass = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-lab-subtle focus:outline-none focus-visible:bg-lab-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600';

  return (
    <>
      <button
        ref={(el) => {
          btnRef.current = el;
          triggerRef?.(el);
        }}
        type="button"
        aria-label={`More actions for ${entryLabel}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKey}
        className={`inline-flex items-center justify-center w-8 h-8 rounded text-lab-muted hover:text-lab-text hover:bg-lab-subtle focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors ${open ? 'bg-lab-subtle text-lab-text' : ''}`}
      >
        <EllipsisVertical className="w-4 h-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Actions for ${entryLabel}`}
            onKeyDown={onMenuKey}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: MENU_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
            className="z-50 bg-lab-card border border-lab-border rounded-lg shadow-xl py-1"
          >
            <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onDownload)} className={`${itemClass} text-lab-text`}>
              <Download className="w-4 h-4" aria-hidden="true" />
              Download
            </button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onDelete)} className={`${itemClass} text-red-600 dark:text-red-400`}>
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
