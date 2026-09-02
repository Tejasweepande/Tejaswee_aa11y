import React, { useRef } from 'react';
import { InputMode, ExportScale, ModuleType, AuditHistoryItem } from '../types/finding';
import {
  UploadCloud,
  Layers,
  Globe,
  Play,
  Key,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
  geminiApiKey: string;
  onChangeApiKey: (key: string) => void;
  figmaUrl: string;
  onChangeFigmaUrl: (url: string) => void;
  figmaPat: string;
  onChangeFigmaPat: (pat: string) => void;
  webUrl: string;
  onChangeWebUrl: (url: string) => void;
  pastedHtml: string;
  onChangePastedHtml: (html: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  onOpenApiKeyModal,
  hasApiKey,
  geminiApiKey,
  onChangeApiKey,
  figmaUrl,
  onChangeFigmaUrl,
  figmaPat,
  onChangeFigmaPat,
  webUrl,
  onChangeWebUrl,
  pastedHtml,
  onChangePastedHtml,
  isCollapsed,
  onToggleCollapse,
  pastAudits,
  hasImage,
  onLoadHistoryItem,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (isCollapsed) {
    return (
      <aside
        aria-label="Audit Configuration Panel (Collapsed)"
        className="bg-lab-card/95 backdrop-blur-md border-r border-lab-border flex flex-col h-full py-5 items-center gap-6 shadow-panel"
      >
        <div className="flex flex-col gap-4 w-full px-2">
           <button onClick={() => { onSelectInput('image'); onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'image' ? 'bg-sky-500/20 text-sky-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Image Upload">
             <UploadCloud className="w-5 h-5" />
           </button>
           <button onClick={() => { onSelectInput('figma'); onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'figma' ? 'bg-fuchsia-500/20 text-fuchsia-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Figma Link">
             <Layers className="w-5 h-5" />
           </button>
           <button onClick={() => { onSelectInput('url'); onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'url' ? 'bg-indigo-500/20 text-indigo-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Live URL">
             <Globe className="w-5 h-5" />
           </button>
           
           <hr className="border-lab-border w-full my-1" />
           
           <button onClick={() => { onSelectInput('history'); onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors relative ${currentInput === 'history' ? 'bg-amber-500/20 text-amber-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Audit History">
             <History className="w-5 h-5" />
             {pastAudits.length > 0 && (
               <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full"></span>
             )}
           </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Audit Configuration Panel"
      className="bg-lab-card/95 backdrop-blur-md border-r border-lab-border shadow-panel flex flex-row h-full overflow-hidden"
    >
      {/* Left Navigation */}
      <div className="w-16 shrink-0 border-r border-lab-border flex flex-col items-center py-5 gap-6 bg-lab-card/50">
        <div className="flex flex-col gap-4 w-full px-2">
           <button onClick={() => { onSelectInput('image'); if (isCollapsed) onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'image' ? 'bg-sky-500/20 text-sky-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Image Upload">
             <UploadCloud className="w-5 h-5" />
           </button>
           <button onClick={() => { onSelectInput('figma'); if (isCollapsed) onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'figma' ? 'bg-fuchsia-500/20 text-fuchsia-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Figma Link">
             <Layers className="w-5 h-5" />
           </button>
           <button onClick={() => { onSelectInput('url'); if (isCollapsed) onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors ${currentInput === 'url' ? 'bg-indigo-500/20 text-indigo-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Live URL">
             <Globe className="w-5 h-5" />
           </button>

           <hr className="border-lab-border w-full my-1" />
           
           <button onClick={() => { onSelectInput('history'); if (isCollapsed) onToggleCollapse(); }} className={`p-2 rounded flex justify-center transition-colors relative ${currentInput === 'history' ? 'bg-amber-500/20 text-amber-500' : 'text-lab-muted hover:text-lab-text hover:bg-lab-subtle'}`} title="Audit History">
             <History className="w-5 h-5" />
             {pastAudits.length > 0 && (
               <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full"></span>
             )}
           </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col py-5 px-4 sm:px-5 gap-5 overflow-y-auto">
        {/* Header */}
        <div>
          <h2 className="text-sm font-bold text-lab-text flex items-center gap-2">
            {currentInput === 'history'
              ? 'Audit History'
              : currentInput === 'image'
              ? 'Image Upload'
              : currentInput === 'figma'
              ? 'Figma Upload'
              : 'Live Link'}
          </h2>
          <p className="text-[11px] text-lab-muted mt-0.5">
            {currentInput === 'history' ? 'Past audits done on this product' : 'Configure input source and rules.'}
          </p>
        </div>

      {/* Mode Specific Inputs */}
      {currentInput === 'image' && (
        <div className="space-y-4">
          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="ring-2 ring-dashed ring-lab-border hover:ring-sky-500/40 transition-colors rounded_SM p-4 text-center bg-lab-subtle/50 cursor-pointer group"
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
            <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-500 dark:text-sky-400 mx-auto flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-lab-text mb-0.5">
              Upload any UI screenshot or <span className="text-sky-500 dark:text-sky-400 underline">browse</span>
            </p>
            <p className="text-[11px] text-lab-dim">Instant Computer Vision &amp; Decile Contrast Audit</p>
          </div>
        </div>
      )}

      {currentInput === 'history' && (
        <div className="space-y-4">
          {pastAudits.length === 0 ? (
            <div className="text-xs text-lab-muted italic py-4 text-center bg-lab-subtle/30 rounded_SM border border-lab-border border-dashed">
              No previous audits in this session.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pastAudits.map((audit) => (
                <button 
                  key={audit.id} 
                  type="button"
                  onClick={() => onLoadHistoryItem(audit)}
                  className="flex flex-col gap-2 p-3 bg-lab-subtle/50 rounded_SM border border-lab-border text-xs shadow-sm transition-all hover:border-sky-500/50 text-left hover:bg-lab-elevated hover:shadow-glow-cyan"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-lab-text truncate pr-2">{audit.label}</span>
                    <span className="text-lab-muted flex items-center gap-1 shrink-0"><Clock className="w-3 h-3"/> {audit.timestamp}</span>
                  </div>
                  <div className="flex items-center text-[11px] text-lab-muted w-full">
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
          {/* Export Scale Selector (Rule R5 live demonstration) */}
          <div className="bg-lab-subtle rounded_SM p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-lab-muted">Export Scale</label>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {(['unknown', '1x', '2x', '3x'] as ExportScale[]).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => onChangeScale(sc)}
                  className={`py-1.5 text-xs font-mono rounded transition-all shadow-sm ${
                    exportScale === sc
                      ? 'bg-sky-500 text-white dark:text-lab-bg font-bold shadow-glow-cyan'
                      : 'bg-lab-card text-lab-muted hover:bg-lab-elevated hover:text-lab-text'
                  }`}
                >
                  {sc === 'unknown' ? 'Unknown' : `@${sc}`}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-lab-dim mt-2 leading-tight">
              Declaring export ratio moves 2.5.8 target size from Predicted to Measured.
            </p>
          </div>
      {currentInput === 'figma' && (
        <div className="space-y-3 bg-lab-subtle rounded_SM p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-lab-text">Figma Prototype Link</span>
          </div>
          <input
            type="text"
            value={figmaUrl}
            onChange={(e) => onChangeFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/proto/... or /design/..."
            className="w-full bg-lab-card shadow-inner rounded_SM px-3 py-2.5 text-xs font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
          />
          <input
            type="password"
            value={figmaPat}
            onChange={(e) => onChangeFigmaPat(e.target.value.trim())}
            placeholder="Figma Personal Access Token (figd_...)"
            className="w-full bg-lab-card shadow-inner rounded_SM px-3 py-2.5 text-xs font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
          />
          <p className="text-[11px] text-lab-dim leading-relaxed">
            Extracts prototype transition links to walk user focus flow deterministically.
          </p>
        </div>
      )}

      {currentInput === 'url' && (
        <div className="space-y-3 bg-lab-subtle rounded_SM p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-lab-text">Website URL</span>
          </div>
          <input
            type="text"
            value={webUrl}
            onChange={(e) => onChangeWebUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full bg-lab-card shadow-inner rounded_SM px-3 py-2.5 text-xs font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
          />
          
          <div className="pt-2 border-t border-lab-border">
            <span className="text-xs font-semibold text-lab-text block mb-2">HTML Fallback</span>
            <textarea
              value={pastedHtml}
              onChange={(e) => onChangePastedHtml(e.target.value)}
              placeholder="Paste raw HTML here if the auto-fetch proxy fails due to CORS..."
              className="w-full h-24 bg-lab-card shadow-inner rounded_SM px-3 py-2.5 text-xs font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none resize-none"
            />
            <p className="text-[11px] text-lab-dim leading-relaxed mt-1.5">
              On the target page, right-click and choose "View Page Source", then select all and copy the HTML into the box above.
            </p>
          </div>
          
          <p className="text-[11px] text-lab-dim leading-relaxed">
            Automatically fetches a visual screenshot and evaluates the underlying DOM. Use the HTML fallback if the site blocks public proxies.
          </p>
        </div>
      )}

      {/* Module Toggles */}
      <div>
        <label className="text-xs font-semibold text-lab-muted block mb-2">
          Audit Modules
        </label>
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
                className={`py-2 px-3 rounded_SM text-xs font-medium shadow-sm text-left flex items-center justify-between transition-all ${
                  enabled
                    ? 'bg-lab-card text-lab-text shadow-glow-cyan ring-1 ring-sky-500/30'
                    : 'bg-lab-subtle/50 text-lab-dim hover:bg-lab-subtle'
                }`}
              >
                <span>{mod.label}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    enabled ? 'bg-sky-400 shadow-glow-cyan' : 'bg-lab-dim/30'
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
          else if (currentInput === 'figma') isReadyToAudit = !!figmaUrl.trim();
          else if (currentInput === 'url') isReadyToAudit = !!webUrl.trim() || !!pastedHtml.trim();

          const isDisabled = isAuditing || !isReadyToAudit;
          
          let buttonClass = 'bg-sky-500 hover:bg-sky-400 text-lab-bg focus-visible:ring-2 shadow-glow-cyan';
          if (isAuditing) buttonClass = 'bg-sky-500/50 text-lab-bg cursor-wait shadow-glow-cyan';
          else if (!isReadyToAudit) buttonClass = 'bg-lab-border text-lab-muted cursor-not-allowed opacity-60';

          return (
            <button
              type="button"
              onClick={onRunAudit}
              disabled={isDisabled}
              className={`w-full mt-auto py-3 px-4 rounded_SM text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${buttonClass}`}
            >
              <Play className={`w-4 h-4 fill-current ${isAuditing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isAuditing ? 'Auditing Interface...' : 'Run Accessibility Audit'}</span>
            </button>
          );
        })()
      )}
      </div>
    </aside>
  );
};
