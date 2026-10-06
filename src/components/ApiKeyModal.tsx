import React, { useState, useEffect } from 'react';
import { Key, ShieldAlert, X, CheckCircle2, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
}) => {
  const [val, setVal] = useState(apiKey);

  useEffect(() => {
    setVal(apiKey);
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(val.trim());
    onClose();
  };

  const handleClear = () => {
    setVal('');
    onSaveKey('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-lab-card border border-lab-border rounded max-w-md w-full p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-lab-muted hover:text-lab-text p-1.5 rounded focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Close API configuration dialog"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-lab-accent">
            <Key className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="api-key-dialog-title" className="text-lg font-bold text-lab-text">
              Google Gemini Vision API Key
            </h2>
            <p className="text-sm text-lab-muted">Powered by Gemini 3.6 Flash Multimodal Vision</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded p-3 mb-4 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-amber-900 dark:text-amber-200/90 leading-relaxed">
            <strong className="font-semibold">Privacy:</strong> API keys reside strictly in React memory for this active session. They are never saved to localStorage, disk, or telemetry.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="gemini-key-input" className="block text-sm font-semibold text-lab-text">
                Google Gemini API Key
              </label>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Gemini 3.6 Flash
              </span>
            </div>
            <input
              id="gemini-key-input"
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-lab-bg border border-lab-border rounded px-3.5 py-2.5 text-sm font-mono text-lab-text focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-xs text-lab-dim mt-1.5 leading-relaxed">
              Get an API key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-lab-accent underline font-medium">aistudio.google.com</a>. Leave blank to run offline with zero API calls.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-lab-border">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium transition-colors"
            >
              Use Offline Mode (Clear Key)
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded text-sm font-medium text-lab-muted hover:text-lab-text hover:bg-lab-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded text-sm font-bold bg-lab-accent text-lab-onAccent hover:bg-lab-accentHover focus-visible:ring-2 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Save for Session
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};


