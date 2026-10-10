import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/** Material Design "info" (outlined) icon (Apache-2.0, google/material-design-icons). */
export const MaterialInfoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
    <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

interface Props {
  /** What the tip explains, e.g. "Automated checks score". Shown as the panel heading. */
  label: string;
  children: React.ReactNode;
  /** Full accessible name for the button. Default: "What is {label}?" */
  buttonLabel?: string;
  /** Replaces the default (lucide) "i" icon. */
  icon?: React.ReactNode;
  /** Which edge of the button the panel lines up with. Use "right" for a button at a right edge. */
  align?: 'left' | 'right';
  /** Width (and other sizing) of the panel. Default: w-72. */
  panelClassName?: string;
  /**
   * Also open on mouse hover and keyboard focus, like a tooltip. A click then keeps it open
   * until it is dismissed (Escape, a click elsewhere, or clicking the button again).
   * Default: opens on click only.
   */
  openOnHover?: boolean;
}

/**
 * Small "i" button that opens a short explanation.
 * Escape or a click outside closes it, and Escape does not also close the
 * surrounding report (it marks the key press as handled).
 */
export const InfoTip: React.FC<Props> = ({
  label,
  children,
  buttonLabel,
  icon,
  align = 'left',
  panelClassName = 'w-72',
  openOnHover = false,
}) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by a click: stays until dismissed
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // A tooltip opened by hover must be dismissible with Escape even though focus is elsewhere
  useEffect(() => {
    if (!open || !openOnHover) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, openOnHover]);

  const handleClick = () => {
    if (!openOnHover) {
      setOpen((o) => !o);
    } else if (!open) {
      setOpen(true);
      setPinned(true);
    } else if (!pinned) {
      setPinned(true); // already showing from the hover: keep it open
    } else {
      close();
    }
  };

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex print:hidden"
      onMouseEnter={openOnHover ? () => setOpen(true) : undefined}
      onMouseLeave={openOnHover ? () => { if (!pinned) setOpen(false); } : undefined}
      onFocus={openOnHover ? () => setOpen(true) : undefined}
      onBlur={
        openOnHover
          ? (e) => {
              if (!wrapRef.current?.contains(e.relatedTarget as Node) && !pinned) setOpen(false);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          close();
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={buttonLabel ?? `What is ${label}?`}
        className={`w-6 h-6 inline-flex items-center justify-center rounded-full transition-colors ${
          open ? 'text-lab-accent' : 'text-lab-dim hover:text-lab-text'
        }`}
      >
        {icon ?? <Info className="w-4 h-4" aria-hidden="true" />}
      </button>
      {open && (
        // The transparent top padding bridges the gap to the button, so the pointer can move
        // from the button onto the panel without the panel closing.
        <div className={`absolute top-full z-30 pt-1 ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}>
          <div
            id={panelId}
            role="note"
            className="bg-lab-card border border-lab-border rounded shadow-lg p-3 text-sm text-lab-muted leading-relaxed font-normal normal-case tracking-normal text-left"
          >
            <p className="font-bold text-lab-text mb-1">{label}</p>
            {children}
          </div>
        </div>
      )}
    </span>
  );
};
