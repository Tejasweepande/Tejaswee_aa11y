import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Key, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';

/** Why the dialog is being shown. */
export type KeyPromptWhy =
  /** The built-in detectors could not find enough clear elements in this screenshot. */
  | { kind: 'needed' }
  /** Gemini was tried and could not read it. `message` is plain language and never contains the key. */
  | {
      kind: 'failed';
      message: string;
      /** The underlying message, for when the plain-language one is not enough. Never contains the key. */
      detail?: string;
      /** What went wrong, so the title can say it. */
      cause?: 'key' | 'quota' | 'network' | 'other';
    };

/**
 * The title says what the situation is, and the line under it says what to do (the same pattern for every state).
 * Sentence case, no full stop on the title.
 */
const FIRST_ASK = {
  title: 'This screenshot needs Gemini to be analysed',
  line: "Our built-in methods couldn't read it. Add your Gemini API key to continue.",
};
const FAILURE_COPY: Record<NonNullable<Extract<KeyPromptWhy, { kind: 'failed' }>['cause']>, { title: string; line: string }> = {
  key: { title: "Google didn't accept this Gemini key", line: 'Check that you copied all of it, or enter another key.' },
  quota: { title: 'This Gemini key has reached its limit', line: 'Free keys have a limit per minute and per day. Enter another key, or try again later.' },
  network: { title: "We couldn't reach Gemini", line: 'Check your internet connection, then try again.' },
  other: { title: "Gemini couldn't read this screenshot", line: '' },
};

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
 * The key is saved in this browser (see storage/geminiKey.ts), so it is asked for once. The field always opens
 * EMPTY: a key entered earlier is never shown again. The title says why the dialog is open; the single helper
 * line under the field links to Google's guide for getting a key (same pattern as the Figma token field).
 */
export const ApiKeyModal: React.FC<Props> = ({ why, onSubmit, onSkip }) => {
  const titleId = useId();
  const leadId = useId();
  const inputId = useId();
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const failure = why.kind === 'failed' ? FAILURE_COPY[why.cause ?? 'other'] : null;
  const title = failure ? failure.title : FIRST_ASK.title;
  const line =
    why.kind !== 'failed'
      ? FIRST_ASK.line
      : failure!.line ||
        // Anything else: say what Gemini said when that is more than the title already does
        (why.message.startsWith('Gemini could not read this screenshot') ? 'Try again with another key, or skip.' : `${why.message} Try again with another key, or skip.`);
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
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-lab-accent shrink-0">
            <Key className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-lg font-bold text-lab-text leading-snug">
            {title}
          </h2>
        </div>

        {why.kind === 'failed' ? (
          <div id={leadId} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded p-3 mb-4 flex items-start gap-2.5">
            <TriangleAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-900 dark:text-red-200/90 leading-relaxed">
              {line}
              {why.detail && (
                <span data-testid="key-failure-detail" className="block mt-1.5 text-xs font-mono break-words text-red-900/80 dark:text-red-200/70">
                  Details: {why.detail}
                </span>
              )}
            </p>
          </div>
        ) : (
          <p id={leadId} className="text-sm text-lab-text leading-relaxed mb-4">
            {line}
          </p>
        )}

        <form onSubmit={submit}>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={inputId} className="block text-sm font-semibold text-lab-text">
              Google Gemini API Key
            </label>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Gemini
            </span>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            name="gemini-key"
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Paste your key"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            className="w-full bg-lab-bg border border-lab-border rounded px-3.5 py-2.5 text-sm font-mono text-lab-text focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />

          <p data-testid="key-helper" className="mt-2 text-xs text-lab-dim leading-relaxed">
            Lets this tool read your screenshot with Gemini.{' '}
            <a
              href="https://ai.google.dev/gemini-api/docs/api-key"
              target="_blank"
              rel="noreferrer"
              className="text-lab-accent underline font-semibold"
            >
              Get a key<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded p-3 mt-4 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
              <strong className="font-semibold">Privacy:</strong> saved in this browser only and sent only to Google, so you add it once. Your
              screenshot is also sent to Google to be read. On a free key, Google may use it to improve its products.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-lab-border">
            <button
              type="button"
              onClick={onSkip}
              className="px-3.5 py-2 rounded text-sm font-medium text-lab-muted hover:text-lab-text hover:bg-lab-subtle transition-colors"
            >
              Skip
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
