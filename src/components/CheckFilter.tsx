import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ModuleType } from '../types/finding';

export const CHECK_OPTIONS: { id: ModuleType; label: string }[] = [
  { id: 'contrast', label: 'Contrast' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'screenreader', label: 'Screen reader' },
  { id: 'structure', label: 'Structure' },
];

interface Props {
  selected: ModuleType[];
  onChange: (selected: ModuleType[]) => void;
}

/**
 * "Check" filter: a small button that opens a list of tick boxes, so several
 * check types can be shown at once. Escape or a click outside closes it and
 * focus returns to the button.
 */
export const CheckFilter: React.FC<Props> = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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

  const summary =
    selected.length === CHECK_OPTIONS.length
      ? 'All'
      : selected.length === 0
      ? 'None'
      : selected.length === 1
      ? CHECK_OPTIONS.find((o) => o.id === selected[0])!.label
      : `${selected.length} selected`;

  const toggle = (id: ModuleType) =>
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
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
        className="h-full flex items-center gap-1.5 rounded border border-lab-border bg-lab-card px-2.5 py-1.5 text-sm text-lab-muted hover:bg-lab-subtle focus:outline-none focus-visible:outline-none focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        Check <span className="font-semibold text-lab-text">{summary}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <fieldset
          id={panelId}
          className="absolute right-0 top-full mt-1 z-30 w-48 bg-lab-card border border-lab-border rounded shadow-lg p-2"
        >
          <legend className="sr-only">Show issues from these checks</legend>
          {CHECK_OPTIONS.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-lab-text hover:bg-lab-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
                className="w-4 h-4 accent-[rgb(var(--lab-accent))]"
              />
              {o.label}
            </label>
          ))}
          <div className="flex justify-between border-t border-lab-border mt-1 pt-1.5 px-2 text-xs font-semibold">
            <button type="button" onClick={() => onChange(CHECK_OPTIONS.map((o) => o.id))} className="text-lab-accent hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => onChange([])} className="text-lab-muted hover:text-lab-text hover:underline">
              Clear
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
};
