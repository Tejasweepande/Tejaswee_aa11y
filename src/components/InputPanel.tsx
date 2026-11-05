import React, { useEffect, useRef, useState } from 'react';
import { InputMode, ExportScale, ModuleType, AuditHistoryMeta } from '../types/finding';
import { ClearButton } from './ClearButton';
import { InfoTip, MaterialInfoIcon } from './InfoTip';
import { HOW_IT_WORKS } from '../data/howItWorks';
import {
  UploadCloud,
  Layers,
  Globe,
  Play,
  History,
  Key,
} from 'lucide-react';
import { HistoryNotice } from './HistoryTools';
import { HistoryEntries } from './HistoryEntries';

import { RememberKeys } from './RememberKeys';

// Upload progress layer (the frosted glass that fills the box left to right)
type UploadStage = 'reading' | 'waiting' | 'fading';
const SWEEP_MS = 350; // time the glass needs to travel to 100%
const FADE_MS = 300; // time the glass takes to clear once the preview is ready
const PREVIEW_FALLBACK_MS = 4000; // never leave the glass up if the preview can't report back

/** Resolves once the browser has painted a frame (or shortly after, in a hidden tab). */
const nextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    window.setTimeout(() => resolve(), 120);
  });

/** Material Design "delete" (bin) icon (Apache-2.0, google/material-design-icons). */
const DeleteIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

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
  /** Opens the Gemini key dialog (Image page). Optional so the panel works without it. */
  onOpenApiKeyModal?: () => void;
  hasGeminiKey?: boolean;
  figmaUrl: string;
  onChangeFigmaUrl: (url: string) => void;
  figmaPat: string;
  onChangeFigmaPat: (pat: string) => void;
  webUrl: string;
  onChangeWebUrl: (url: string) => void;
  pastedHtml: string;
  onChangePastedHtml: (html: string) => void;
  /** Saved audits, light summaries only; the full audit is loaded when one is opened */
  pastAudits: AuditHistoryMeta[];
  hasImage: boolean;
  imageSrc: string | null;
  imageFileName: string;
  onClearImage: () => void;
  onLoadHistoryItem: (item: AuditHistoryMeta) => void;
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
  hasGeminiKey = false,
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
  imageSrc,
  imageFileName,
  onClearImage,
  onLoadHistoryItem,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const figmaUrlRef = useRef<HTMLInputElement>(null);
  const figmaPatRef = useRef<HTMLInputElement>(null);
  const webUrlRef = useRef<HTMLInputElement>(null);
  const pastedHtmlRef = useRef<HTMLTextAreaElement>(null);

  // ---- Upload: read the file with real progress, show it as a glass layer, then reveal the preview
  const [upload, setUpload] = useState<{ progress: number; stage: UploadStage } | null>(null);
  const readerRef = useRef<FileReader | null>(null);
  const uploadIdRef = useRef(0); // lets a newer upload / cancel make older callbacks harmless
  const sweepDoneRef = useRef(false);
  const previewReadyRef = useRef(false);
  const fadeStartedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const previewImgRef = useRef<HTMLImageElement>(null);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  useEffect(
    () => () => {
      readerRef.current?.abort();
      clearTimers();
    },
    []
  );

  // Clear the glass only when it has reached 100% AND the preview image is ready
  const finishIfReady = (id: number) => {
    if (id !== uploadIdRef.current || fadeStartedRef.current) return;
    if (!sweepDoneRef.current || !previewReadyRef.current) return;
    fadeStartedRef.current = true;
    setUpload({ progress: 1, stage: 'fading' });
    later(() => {
      if (id === uploadIdRef.current) setUpload(null);
    }, FADE_MS);
  };

  const handlePreviewSettled = () => {
    previewReadyRef.current = true;
    finishIfReady(uploadIdRef.current);
  };

  // Choosing the very same image again does not fire a new load event; catch that case here
  useEffect(() => {
    if (upload?.stage !== 'waiting') return;
    const img = previewImgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && img.getAttribute('src') === imageSrc) {
      handlePreviewSettled();
    }
  }, [upload?.stage, imageSrc]);

  const cancelUpload = () => {
    readerRef.current?.abort();
    uploadIdRef.current += 1;
    clearTimers();
    setUpload(null);
  };

  const readFile = (file: File) => {
    readerRef.current?.abort();
    clearTimers();
    const id = ++uploadIdRef.current;
    sweepDoneRef.current = false;
    previewReadyRef.current = false;
    fadeStartedRef.current = false;
    setUpload({ progress: 0, stage: 'reading' });
    const painted = nextPaint(); // the empty (0%) layer is on screen before any real progress shows

    const reader = new FileReader();
    readerRef.current = reader;
    reader.onprogress = (e) => {
      if (!e.lengthComputable || e.total === 0) return;
      const p = Math.min(1, e.loaded / e.total);
      painted.then(() => {
        if (id !== uploadIdRef.current) return;
        setUpload((u) => (u && u.stage === 'reading' ? { progress: Math.max(u.progress, p), stage: 'reading' } : u));
      });
    };
    reader.onload = () => {
      painted.then(() => {
        if (id !== uploadIdRef.current || typeof reader.result !== 'string') return;
        setUpload({ progress: 1, stage: 'waiting' });
        later(() => {
          sweepDoneRef.current = true;
          finishIfReady(id);
        }, SWEEP_MS);
        later(() => {
          previewReadyRef.current = true;
          finishIfReady(id);
        }, PREVIEW_FALLBACK_MS);
        onImageUploaded(reader.result, file.name);
      });
    };
    reader.onerror = () => {
      if (id === uploadIdRef.current) setUpload(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const isImage = currentInput === 'image';
  // An uploaded image is shown inside the dropzone itself
  const hasPreview = isImage && hasImage && !!imageSrc;
  const previewName = imageFileName || 'Uploaded image';

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation(); // the dropzone is clickable (opens the file picker); the bin must not
    cancelUpload();
    if (fileInputRef.current) fileInputRef.current.value = ''; // so the same file can be chosen again
    onClearImage();
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
       <div className={`w-full max-w-xl mx-auto flex flex-col gap-5 flex-1 ${isImage ? 'min-h-0' : ''}`}>
        {/* Header */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-lab-text flex items-center gap-2">
              {currentInput === 'history'
                ? 'Audit History'
                : currentInput === 'image'
                ? 'Image Upload'
                : currentInput === 'figma'
                ? 'Figma Upload'
                : 'Live Link'}
            </h2>
            {currentInput !== 'history' && (
              <InfoTip
                label={HOW_IT_WORKS[currentInput].title}
                buttonLabel={HOW_IT_WORKS[currentInput].title}
                icon={<MaterialInfoIcon />}
                align="right"
                panelClassName="w-80 max-w-[calc(100vw-4rem)]"
                openOnHover
              >
                <ol className="list-decimal pl-5 space-y-1.5 marker:text-lab-dim">
                  {HOW_IT_WORKS[currentInput].steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </InfoTip>
            )}
          </div>
          {currentInput === 'history' && (
            <p className="text-sm text-lab-muted mt-1">Past audits done on this product</p>
          )}
        </div>

      {/* Body. On the image page this fills the room between the title and the Run button: the
          dropzone grows to take whatever is left, so the settings and the Run button sit at the
          bottom of the page. When room is short the preview is cropped from the bottom and this
          part scrolls. Elsewhere it is display: contents, i.e. it changes nothing about the layout. */}
      <div
        className={
          isImage
            ? 'flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto px-1 -mx-1 py-1 -my-1'
            : 'contents'
        }
      >
      {/* Mode Specific Inputs */}
      {currentInput === 'image' && (
        <div className={`flex flex-col flex-1 ${hasPreview ? 'min-h-[96px]' : 'min-h-[118px]'}`}>
          {/* File Upload Dropzone. With an image loaded, the image fills the box at its full
              width and is cropped from the bottom when space is short. */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`ring-2 ring-dashed ring-lab-border hover:ring-sky-500/40 transition-colors rounded ${
              hasPreview ? '' : 'p-4 text-center flex-1 flex flex-col items-center justify-center '
            }bg-lab-subtle/50 cursor-pointer group${
              hasPreview ? ' relative flex-auto min-h-0 overflow-hidden' : upload ? ' relative overflow-hidden' : ''
            }`}
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
            {hasPreview ? (
              <>
                <img
                  ref={previewImgRef}
                  onLoad={handlePreviewSettled}
                  onError={handlePreviewSettled}
                  src={imageSrc as string}
                  alt={`Preview of ${previewName}`}
                  draggable={false}
                  className="block w-full h-auto select-none"
                />
                {/* Name and bin appear on hover or keyboard focus (always on touch screens). The strip is
                    blurred and darkened so white text stays readable on any image, light or busy. */}
                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2 bg-black/60 backdrop-blur-lg border-b border-white/10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                  <span className="min-w-0 truncate pl-1 text-sm font-medium text-white" title={previewName}>
                    {previewName}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearImage}
                    aria-label={`Remove image ${previewName}`}
                    title="Remove image"
                    className="shrink-0 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className="w-10 h-10 rounded-full bg-sky-500/10 text-lab-accent mx-auto flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-lab-text mb-0.5">
              Upload any UI screenshot or <span className="text-lab-accent underline">browse</span>
            </p>
            <p className="text-xs text-lab-dim">Instant Computer Vision &amp; Decile Contrast Audit</p>
              </>
            )}

            {/* Upload progress: a frosted-glass layer that fills the box from left to right
                with the real read progress (no numbers), then clears to reveal the preview. */}
            {upload && (
              <div
                role="progressbar"
                aria-label="Uploading image"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(upload.progress * 100)}
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-0 z-20 overflow-hidden cursor-progress transition-opacity ease-out motion-reduce:transition-none ${
                  upload.stage === 'fading' ? 'opacity-0 duration-300' : 'opacity-100 duration-0'
                }`}
              >
                <div
                  className="absolute inset-0 bg-lab-accent/30 backdrop-blur-md border-r-2 border-lab-accent shadow-[4px_0_16px_rgb(var(--lab-accent)/0.35)] transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateX(${(upload.progress - 1) * 100}%)` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {currentInput === 'history' && (
        <div>
          <HistoryNotice />
          <HistoryEntries items={pastAudits} onOpen={onLoadHistoryItem} />
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
          <p className="text-xs text-lab-dim leading-relaxed !mt-2">
            Lets this tool read your Figma file.{' '}
            <a
              href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
              target="_blank"
              rel="noreferrer"
              className="text-lab-accent underline font-semibold"
            >
              Get a token<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <RememberKeys />
        </div>
      )}

      {currentInput === 'url' && (
        <div className="flex flex-col gap-3 flex-1 bg-lab-subtle rounded p-3 shadow-sm">
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
          
          <div className="flex flex-col flex-1 pt-2 border-t border-lab-border">
            <label htmlFor="pasted-html" className="text-sm font-semibold text-lab-text block mb-2">HTML fallback</label>
            <div className="relative flex flex-col flex-1 min-h-[96px]">
              <textarea
                id="pasted-html"
                ref={pastedHtmlRef}
                value={pastedHtml}
                onChange={(e) => onChangePastedHtml(e.target.value)}
                placeholder="Paste raw HTML here if the auto-fetch proxy fails due to CORS..."
                className="block w-full flex-1 min-h-[96px] bg-lab-card border border-lab-border rounded pl-3 pr-10 py-2.5 text-sm font-mono text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none resize-none"
              />
              {pastedHtml.length > 0 && (
                <ClearButton
                  label="Clear pasted HTML"
                  align="top"
                  onClick={() => { onChangePastedHtml(''); pastedHtmlRef.current?.focus(); }}
                />
              )}
            </div>
            <p className="text-xs text-lab-dim leading-relaxed mt-2">
              On your page, right-click → “View Page Source” → Select all → Copy → Paste into the box above.
            </p>
          </div>
        </div>
      )}

      {/* Module Toggles */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted">
            Audit Modules
          </h3>
          {currentInput === 'image' && onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-lab-accent hover:underline focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
            >
              <Key className="w-3 h-3" aria-hidden="true" />
              {hasGeminiKey ? 'Gemini AI vision: on' : 'Add Gemini key (optional)'}
            </button>
          )}
        </div>
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

      </div>

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
              className={`shrink-0 w-full mt-1 py-3 px-4 rounded text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${buttonClass}`}
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
