import React, { useRef } from 'react';
import { InputMode, ExportScale, ModuleType, AuditHistoryItem } from '../types/finding';
import { ClearButton } from './ClearButton';
import {
  UploadCloud,
  Layers,
  Globe,
  Play,
  History,
  Clock,
} from 'lucide-react';

interface Props {
  currentInput: InputMode;
  onSelectInput: (mode: InputMode) => void;
  exportScale: ExportScale;
  onChangeScale: (scale: ExportScale) => void;
  onImageUploaded: (dataUrl: string, name: string) => void;
  moduleToggles: Record<ModuleType, boolean>;
  onToggleModule: (mod: ModuleType) => void;
  onRunAudit: () => void;
  isAuditing: boolean;
  figmaUrl: string;
  onChangeFigmaUrl: (url: string) => void;
  figmaPat: string;
  onChangeFigmaPat: (pat: string) => void;
  webUrl: string;
  onChangeWebUrl: (url: string) => void;
  pastedHtml: string;
  onChangePastedHtml: (html: string) => void;
  pastAudits: AuditHistoryItem[];
  hasImage: boolean;
  onLoadHistoryItem: (item: AuditHistoryItem) => void;
}

export const InputPanel: React.FC<Props> = ({
  currentInput,
  onSelectInput,
  exportScale,
  onChangeScale,
  onImageUploaded,
  moduleToggles,
  onToggleModule,
  onRunAudit,
  isAuditing,
  figmaUrl,
  onChangeFigmaUrl,
  figmaPat,
  onChangeFigmaPat,
  webUrl,
  onChangeWebUrl,
  pastedHtml,
  onChangePastedHtml,
  pastAudits,
  hasImage,
  onLoadHistoryItem,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const figmaUrlRef = useRef<HTMLInputElement>(null);
  const figmaPatRef = useRef<HTMLInputElement>(null);
  const webUrlRef = useRef<HTMLInputElement>(null);
  const pastedHtmlRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageUploaded(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageUploaded(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      aria-label="Audit Configuration Panel"
      className="bg-lab-card/95 backdrop-blur-md border border-lab-border rounded shadow-panel flex flex-row h-full overflow-hidden"
    >
      {/* Left Navigation */}
      {/* Each item shows its name under the icon, so it does not rely on a hover tooltip. */}
      <nav aria-label="Audit source" className="w-20 shrink-0 border-r border-lab-border flex flex-col items-center py-5 bg-lab-card/50">
        <div className="flex flex-col gap-2 w-full px-2">
          {(
            [
              { mode: 'image', label: 'Image', Icon: UploadCloud },
              { mode: 'figma', label: 'Figma', Icon: Layers },
              { mode: 'url', label: 'Website', Icon: Globe },
              { mode: 'history', label: 'History', Icon: History },
            ] as { mode: InputMode; label: string; Icon: typeof History }[]
          ).map(({ mode, label, Icon }) => (
            <React.Fragment key={mode}>
              {mode === 'history' && <hr className="border-lab-border w-full my-1" />}
              <button
                type="button"
                onClick={() => onSelectInput(mode)}
                aria-current={currentInput === mode ? 'page' : undefined}
                className={`relative py-2 rounded flex flex-col items-center gap-1 transition-colors ${
                  currentInput === mode
                    ? 'bg-lab-accent/10 text-lab-accent'
                    : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-xs font-semibold">{label}</span>
                {mode === 'history' && pastAudits.length > 0 && (
                  <span className="absolute top-1.5 right-3 w-2 h-2 bg-lab-accent rounded-full" aria-hidden="true"></span>
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      </nav>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col py-8 px-4 sm:px-8 overflow-y-auto">
       <div className="w-full max-w-xl mx-auto flex flex-col gap-5 flex-1">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-lab-text flex items-center gap-2">
            {currentInput === 'history'
              ? 'Audit History'
              : currentInput === 'image'
              ? 'Image Upload'
              : currentInput === 'figma'
              ? 'Figma Upload'
              : 'Live Link'}
          </h2>
          {currentInput === 'history' && (
            <p className="text-sm text-lab-muted mt-1">Past audits done on this product</p>
          )}
        </div>

      {/* Mode Specific Inputs */}
      {currentInput === 'image' && (
        <div className="space-y-4">
          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="ring-2 ring-dashed ring-lab-border hover:ring-sky-500/40 transition-colors rounded p-4 text-center bg-lab-subtle/50 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
            role="region"
            aria-label="Image dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload interface screenshot or mockup"
            />
            <div className="w-10 h-10 rounded-full bg-sky-500/10 text-lab-accent mx-auto flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-lab-text mb-0.5">
              Upload any UI screenshot or <span className="text-lab-accent underline">browse</span>
            </p>
            <p className="text-xs text-lab-dim">Instant Computer Vision &amp; Decile Contrast Audit</p>
          </div>
        </div>
      )}

      {currentInput === 'history' && (
        <div className="space-y-4">
          {pastAudits.length === 0 ? (
            <div className="text-sm text-lab-muted italic py-4 text-center bg-lab-subtle/30 rounded border border-lab-border border-dashed">
              No previous audits in this session.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pastAudits.map((audit) => (
                <button 
                  key={audit.id} 
                  type="button"
                  onClick={() => onLoadHistoryItem(audit)}
                  className="flex flex-col gap-2 p-3 bg-lab-subtle/50 rounded border border-lab-border text-sm shadow-sm transition-all hover:border-sky-500/50 text-left hover:bg-lab-elevated"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-lab-text truncate pr-2">{audit.label}</span>
                    <span className="text-lab-muted flex items-center gap-1 shrink-0"><Clock className="w-3 h-3"/> {audit.timestamp}</span>
                  </div>
                  <div className="flex items-center text-xs text-lab-muted w-full">
                    <span className="flex gap-3">
                      <span title="Regions Scanned" className="flex items-center gap-1">
                        <span className="font-semibold text-lab-text">{audit.regionsCount}</span> Regions
                      </span>
                      <span title="Barriers Found" className={`flex items-center gap-1 font-semibold ${audit.findingsCount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                        {audit.findingsCount} Barriers
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {currentInput !== 'history' && (
        <>
          {/* Export Scale Selector (image mode only — Figma/URL provide real pixel dimensions) */}
          {currentInput === 'image' && (
            <div className="bg-lab-subtle rounded p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted">Export Scale</h3>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(['unknown', '1x', '2x', '3x'] as ExportScale[]).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => onChangeScale(sc)}
                    className={`py-1.5 text-sm font-mono rounded transition-all ${
                      exportScale === sc
                        ? 'bg-lab-card text-lab-text font-bold shadow-sm ring-1 ring-lab-border'
                        : 'text-lab-muted hover:bg-lab-elevated hover:text-lab-text'
                    }`}
                  >
                    {sc === 'unknown' ? 'Unknown' : `@${sc}`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-lab-dim mt-2 leading-tight">
                Declaring export ratio moves 2.5.8 target size from Predicted to Measured.
              </p>
            </div>
          )}
      {currentInput === 'figma' && (
        <div className="space-y-3 bg-lab-subtle rounded p-3 shadow-sm">
          <label htmlFor="figma-url" className="block text-sm font-semibold text-lab-text">Figma prototype link</label>
          <div className="relative">
            <input
              id="figma-url"
              ref={figmaUrlRef}
              type="text"
              value={figmaUrl}
              onChange={(e) => onChangeFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/proto/... or /design/..."
              className="w-full bg-lab-card border border-lab-border rounded pl-3 pr-10 py-2.5 text-sm font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
            />
            {figmaUrl.length > 0 && (
              <ClearButton
                label="Clear Figma link"
                onClick={() => { onChangeFigmaUrl(''); figmaUrlRef.current?.focus(); }}
              />
            )}
          </div>
          <label htmlFor="figma-token" className="block text-sm font-semibold text-lab-text pt-1">Figma access token</label>
          <div className="relative">
            <input
              id="figma-token"
              ref={figmaPatRef}
              type="password"
              value={figmaPat}
              onChange={(e) => onChangeFigmaPat(e.target.value.trim())}
              placeholder="figd_..."
              className="w-full bg-lab-card border border-lab-border rounded pl-3 pr-10 py-2.5 text-sm font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
            />
            {figmaPat.length > 0 && (
              <ClearButton
                label="Clear Figma access token"
                onClick={() => { onChangeFigmaPat(''); figmaPatRef.current?.focus(); }}
              />
            )}
          </div>
          <p className="text-xs text-lab-dim leading-relaxed">
            The token is needed to read the file.{' '}
            <a
              href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
              target="_blank"
              rel="noreferrer"
              className="text-lab-accent underline font-semibold"
            >
              How to get a token<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <p className="text-xs text-lab-dim leading-relaxed">
            Extracts prototype transition links to walk user focus flow deterministically.
          </p>
        </div>
      )}

      {currentInput === 'url' && (
        <div className="space-y-3 bg-lab-subtle rounded p-3 shadow-sm">
          <label htmlFor="website-url" className="block text-sm font-semibold text-lab-text">Website URL</label>
          <div className="relative">
            <input
              id="website-url"
              ref={webUrlRef}
              type="text"
              value={webUrl}
              onChange={(e) => onChangeWebUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-lab-card border border-lab-border rounded pl-3 pr-10 py-2.5 text-sm font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
            />
            {webUrl.length > 0 && (
              <ClearButton
                label="Clear website URL"
                onClick={() => { onChangeWebUrl(''); webUrlRef.current?.focus(); }}
              />
            )}
          </div>
          
          <div className="pt-2 border-t border-lab-border">
            <label htmlFor="pasted-html" className="text-sm font-semibold text-lab-text block mb-2">HTML fallback</label>
            <div className="relative">
              <textarea
                id="pasted-html"
                ref={pastedHtmlRef}
                value={pastedHtml}
                onChange={(e) => onChangePastedHtml(e.target.value)}
                placeholder="Paste raw HTML here if the auto-fetch proxy fails due to CORS..."
                className="w-full h-24 bg-lab-card border border-lab-border rounded pl-3 pr-10 py-2.5 text-sm font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none resize-none"
              />
              {pastedHtml.length > 0 && (
                <ClearButton
                  label="Clear pasted HTML"
                  align="top"
                  onClick={() => { onChangePastedHtml(''); pastedHtmlRef.current?.focus(); }}
                />
              )}
            </div>
            <p className="text-xs text-lab-dim leading-relaxed mt-1.5">
              On the target page, right-click and choose "View Page Source", then select all and copy the HTML into the box above.
            </p>
          </div>
          
          <p className="text-xs text-lab-dim leading-relaxed">
            Automatically fetches a visual screenshot and evaluates the underlying DOM. Use the HTML fallback if the site blocks public proxies.
          </p>
        </div>
      )}

      {/* Module Toggles */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted mb-2">
          Audit Modules
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'contrast', label: 'Contrast (1.4.3)' },
              { id: 'keyboard', label: 'Keyboard (2.4.3)' },
              { id: 'screenreader', label: 'Screen Reader' },
              { id: 'structure', label: 'Structure (1.3.1)' },
            ] as { id: ModuleType; label: string }[]
          ).map((mod) => {
            const enabled = moduleToggles[mod.id];
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onToggleModule(mod.id)}
                className={`py-2 px-3 rounded text-sm font-medium shadow-sm text-left flex items-center justify-between transition-all ${
                  enabled
                    ? 'bg-lab-card text-lab-text ring-1 ring-lab-accent'
                    : 'bg-lab-subtle/50 text-lab-dim hover:bg-lab-subtle'
                }`}
              >
                <span>{mod.label}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    enabled ? 'bg-lab-accent' : 'bg-lab-dim/30'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

        </>
      )}

      {/* Launch Action Button */}
      {currentInput !== 'history' && (
        (() => {
          let isReadyToAudit = false;
          if (currentInput === 'image') isReadyToAudit = hasImage;
          else if (currentInput === 'figma') isReadyToAudit = !!figmaUrl.trim() && !!figmaPat.trim();
          else if (currentInput === 'url') isReadyToAudit = !!webUrl.trim() || !!pastedHtml.trim();

          const isDisabled = isAuditing || !isReadyToAudit;
          
          let buttonClass = 'bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent focus-visible:ring-2';
          if (isAuditing) buttonClass = 'bg-lab-accent/60 text-lab-onAccent cursor-wait';
          else if (!isReadyToAudit) buttonClass = 'bg-lab-border text-lab-muted cursor-not-allowed opacity-60';

          return (
            <button
              type="button"
              onClick={onRunAudit}
              disabled={isDisabled}
              className={`w-full mt-1 py-3 px-4 rounded text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${buttonClass}`}
            >
              <Play className={`w-4 h-4 fill-current ${isAuditing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isAuditing ? 'Auditing Interface...' : 'Run Accessibility Audit'}</span>
            </button>
          );
        })()
      )}
       </div>
      </div>
    </aside>
  );
};
