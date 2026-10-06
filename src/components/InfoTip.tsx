import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface Props {
  /** What the tip explains, e.g. "Automated checks score". Used for the button's name. */
  label: string;
  children: React.ReactNode;
}

/**
 * Small "i" button that opens a short explanation on click.
 * Escape or a click outside closes it, and Escape does not also close the
 * surrounding report (it marks the key press as handled).
 */
export const InfoTip: React.FC<Props> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex print:hidden"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What is ${label}?`}
        className={`w-6 h-6 inline-flex items-center justify-center rounded-full transition-colors ${
          open ? 'text-lab-accent' : 'text-lab-dim hover:text-lab-text'
        }`}
      >
        <Info className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="note"
          className="absolute left-0 top-full mt-1 z-30 w-72 bg-lab-card border border-lab-border rounded shadow-lg p-3 text-sm text-lab-muted leading-relaxed font-normal normal-case tracking-normal text-left"
        >
          <p className="font-bold text-lab-text mb-1">{label}</p>
          {children}
        </div>
      )}
    </span>
  );
};
