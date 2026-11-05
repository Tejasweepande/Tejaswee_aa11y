import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Key, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';

/** Why the dialog is being shown. */
export type KeyPromptWhy =
  /** The built-in detectors could not find enough clear elements in this screenshot. */
  | { kind: 'needed' }
  /** Gemini was tried and could not read it. `message` is plain language and never contains the key. */
  | { kind: 'failed'; message: string };

interface Props {
  why: KeyPromptWhy;
  /** The user pasted a key and chose to run Gemini. */
  onSubmit: (key: string) => void;
  /** The user chose not to use Gemini (button or Escape). */
  onSkip: () => void;
}

/**
 * Asks for a Google Gemini key, but only when the built-in detectors could not read the screenshot,
 * or when Gemini was tried and failed (a used-up limit, a key Google does not accept, no connection).
 *
 * The key lives in this tab's memory only. The field always opens EMPTY: a key that was entered
 * earlier is never shown again, so anyone else using this browser cannot read it back. Because of
 * that, a failed key is thrown away and the user is asked for a new one.
 */
export const ApiKeyModal: React.FC<Props> = ({ why, onSubmit, onSkip }) => {
  const titleId = useId();
  const leadId = useId();
  const inputId = useId();
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      if (before && document.contains(before) && !(before as HTMLButtonElement).disabled) before.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onSkip();
      return;
    }
    if (e.key === 'Tab') {
      // Keep Tab inside the dialog
      const order = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled)') ?? []);
      if (order.length === 0) return;
      const at = order.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? order.length - 1 : at - 1) : at === -1 || at === order.length - 1 ? 0 : at + 1;
      e.preventDefault();
      order[next].focus();
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = val.trim();
    if (!key) return;
    setVal('');
    onSubmit(key);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 animate-fade-in overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        onKeyDown={onKeyDown}
        className="bg-lab-card border border-lab-border rounded max-w-md w-full p-6 shadow-2xl my-auto"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-lab-accent shrink-0">
            <Key className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-lab-text">
              Google Gemini Vision API Key
            </h2>
            <p className="text-sm text-lab-muted">Powered by Gemini 3.6 Flash Multimodal Vision</p>
          </div>
        </div>

        {why.kind === 'needed' ? (
          <p id={leadId} className="text-sm text-lab-text leading-relaxed mb-4">
            The AI model server is not available here, and the offline detector can only measure contrast: it cannot read text or name
            elements. Gemini Vision can read this screenshot properly. Paste a Gemini API key to use it, or skip to continue offline.
          </p>
        ) : (
          <div id={leadId} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded p-3 mb-4 flex items-start gap-2.5">
            <TriangleAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-900 dark:text-red-200/90 leading-relaxed">
              <strong className="font-semibold">Gemini could not read it.</strong> {why.message} Enter a key to try again, or skip Gemini.
            </p>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={inputId} className="block text-sm font-semibold text-lab-text">
              Google Gemini API Key
            </label>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Gemini 3.6 Flash
            </span>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            name="gemini-key"
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="AIzaSy..."
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            className="w-full bg-lab-bg border border-lab-border rounded px-3.5 py-2.5 text-sm font-mono text-lab-text focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />

          <div className="mt-3 text-xs text-lab-dim leading-relaxed" data-testid="key-instructions">
            <p className="font-semibold text-lab-muted mb-1">How to get a key</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>
                Open{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-lab-accent underline font-medium">
                  Google AI Studio
                </a>{' '}
                and sign in with a Google account.
              </li>
              <li>Click “Get API key”, then “Create API key”.</li>
              <li>Copy the key (it starts with “AIza”) and paste it above.</li>
            </ol>
            <p className="mt-1.5">A free key has a limit per minute and per day. If you reach it, you will be asked for another key.</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded p-3 mt-4 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
              <strong className="font-semibold">Privacy:</strong> your key stays in this tab&apos;s memory only. It is never saved, never shown
              again, and goes only to Google. It is gone when you refresh or close the tab. Your screenshot is sent to Google to be read, and
              on a free key Google may use it to improve its products, so skip this for confidential designs.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-lab-border">
            <button
              type="button"
              onClick={onSkip}
              className="px-3.5 py-2 rounded text-sm font-medium text-lab-muted hover:text-lab-text hover:bg-lab-subtle transition-colors"
            >
              Skip Gemini
            </button>
            <button
              type="submit"
              disabled={val.trim() === ''}
              className="px-4 py-2 rounded text-sm font-bold bg-lab-accent text-lab-onAccent hover:bg-lab-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Run with Gemini
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
