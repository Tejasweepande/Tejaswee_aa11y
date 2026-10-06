import React, { useRef, useState, useEffect } from 'react';
import { Finding, UIElementRegion, ScreenReaderItem } from '../types/finding';
import {
  Eye,
  Keyboard,
  Volume2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  SkipForward,
} from 'lucide-react';
import { SEVERITY_BAR } from './FindingCard';
import { speechEngine } from '../engine/screenReaderEngine';

export type CanvasMode = 'overlay' | 'keyboard' | 'screenreader';

interface Props {
  imageSrc: string | null;
  iframeHtml?: string | null;
  regions: UIElementRegion[];
  findings: Finding[];
  screenReaderItems: ScreenReaderItem[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  hoveredFindingId: string | null;
  onHoverFinding: (id: string | null) => void;
  canvasMode: CanvasMode;
  onChangeMode: (mode: CanvasMode) => void;
  hasAudited: boolean;
  onRunAudit: () => void;
  isAuditing: boolean;
}

export const PreviewCanvas: React.FC<Props> = ({
  imageSrc,
  iframeHtml,
  regions,
  findings,
  screenReaderItems,
  selectedFindingId,
  onSelectFinding,
  hoveredFindingId,
  
  canvasMode,
  onChangeMode,
  hasAudited,
  onRunAudit,
  isAuditing,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(1);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [activeSpeechIdx, setActiveSpeechIdx] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [transformOrigin, setTransformOrigin] = useState('50% 50%');
  
  // Real measured content height of the fallback DOM iframe (used only when
  // there's no screenshot to show instead). Starts null until the iframe
  // actually loads and reports its true height, so we're not locked to a
  // guessed aspect ratio that doesn't match the real page.
  const [fallbackIframeHeight, setFallbackIframeHeight] = useState<number | null>(null);
  useEffect(() => {
    setFallbackIframeHeight(null);
  }, [iframeHtml]);

  const handleWheel = React.useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      const targetRef = imageRef.current || iframeRef.current;
      if (targetRef) {
        const rect = targetRef.getBoundingClientRect();
        // Only update transform origin if we are at zoom 1, to prevent jumping
        setZoom((currentZoom) => {
          if (currentZoom === 1) {
            const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
            setTransformOrigin(`${x}% ${y}%`);
          }
          const newZoom = currentZoom - e.deltaY * 0.01;
          return Math.min(Math.max(0.5, newZoom), 5.0);
        });
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => container?.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const interactiveRegions = regions
    .filter((r) => r.isInteractive || r.kind === 'button' || r.kind === 'input' || r.kind === 'link')
    .sort((a, b) => a.readingOrder - b.readingOrder);

  // Autoplay keyboard focus walkthrough
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoplaying && interactiveRegions.length > 0) {
      timer = setInterval(() => {
        setActiveTabIdx((prev) => (prev + 1) % interactiveRegions.length);
      }, 1400);
    }
    return () => clearInterval(timer);
  }, [isAutoplaying, interactiveRegions.length]);

  // Handle Speech playback in Screen Reader mode
  const playSpeechItem = (index: number) => {
    if (index >= screenReaderItems.length) {
      setIsSpeaking(false);
      return;
    }

    const item = screenReaderItems[index];
    setActiveSpeechIdx(index);
    setIsSpeaking(true);

    speechEngine.speak(
      item.spokenPhrase,
      () => {
        // Use the next index directly — do NOT gate on isSpeaking state,
        // which is stale inside this closure. The user can stop via toggleSpeechPlayback.
        if (index + 1 < screenReaderItems.length) {
          playSpeechItem(index + 1);
        } else {
          setIsSpeaking(false);
        }
      },
      () => setIsSpeaking(false)
    );
  };

  const toggleSpeechPlayback = () => {
    if (isSpeaking) {
      speechEngine.stop();
      setIsSpeaking(false);
    } else {
      playSpeechItem(activeSpeechIdx);
    }
  };

  const handleStepSpeech = () => {
    if (screenReaderItems.length === 0) return;
    speechEngine.stop();
    const next = (activeSpeechIdx + 1) % screenReaderItems.length;
    setActiveSpeechIdx(next);
    speechEngine.speak(screenReaderItems[next].spokenPhrase);
  };

  useEffect(() => {
    if (selectedFindingId && canvasMode === 'overlay') {
      const el = document.getElementById(`finding-box-${selectedFindingId}`);
      if (el) {
        // Scroll into view with smooth behavior and center alignment
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [selectedFindingId, canvasMode]);

  // Keyboard navigation for tab order stepper
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (canvasMode === 'keyboard' && interactiveRegions.length > 0) {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          setActiveTabIdx((prev) => (prev > 0 ? prev - 1 : interactiveRegions.length - 1));
        } else {
          setActiveTabIdx((prev) => (prev + 1) % interactiveRegions.length);
        }
      }
    }
  };

  return (
    <section
      aria-label="Interface Preview and Multi-modal Barrier Simulator"
      className="bg-lab-card rounded flex flex-col shadow-panel overflow-hidden relative flex-1 min-h-0"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Canvas Mode Switcher Bar */}
      <div className="bg-lab-subtle/80 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 z-20 shadow-sm">
        {/* Mode Tabs */}
        <div
          role="tablist"
          aria-label="Preview view"
          className="flex items-center gap-1 bg-lab-subtle p-1 rounded flex-wrap"
        >
          <button
            role="tab"
            aria-selected={canvasMode === 'overlay'}
            onClick={() => onChangeMode('overlay')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all ${
              canvasMode === 'overlay'
                ? 'bg-lab-card text-lab-text shadow-sm ring-1 ring-lab-border'
                : 'text-lab-muted hover:text-lab-text'
            }`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Issues</span>
          </button>

          <button
            role="tab"
            aria-selected={canvasMode === 'keyboard'}
            onClick={() => onChangeMode('keyboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all ${
              canvasMode === 'keyboard'
                ? 'bg-lab-card text-lab-text shadow-sm ring-1 ring-lab-border'
                : 'text-lab-muted hover:text-lab-text'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tab order</span>
          </button>

          <button
            role="tab"
            aria-selected={canvasMode === 'screenreader'}
            onClick={() => onChangeMode('screenreader')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all ${
              canvasMode === 'screenreader'
                ? 'bg-lab-card text-lab-text shadow-sm ring-1 ring-lab-border'
                : 'text-lab-muted hover:text-lab-text'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Screen reader</span>
          </button>
        </div>

        {/* Zoom & Canvas Actions */}
        <div className="flex items-center gap-2 text-sm text-lab-muted">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="p-1.5 rounded bg-lab-card hover:text-lab-text hover:bg-lab-elevated shadow-sm"
            aria-label="Zoom out preview"
          >
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <span className="font-mono text-xs px-1.5 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            className="p-1.5 rounded bg-lab-card hover:text-lab-text hover:bg-lab-elevated shadow-sm"
            aria-label="Zoom in preview"
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded bg-lab-card hover:text-lab-text hover:bg-lab-elevated shadow-sm"
            aria-label="Reset zoom level"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 bg-lab-subtle relative select-none min-h-0"
      >
        {!imageSrc && !iframeHtml ? (
          <div className="flex flex-col items-center justify-center h-[560px] text-center px-12">
            <div className="w-12 h-12 rounded bg-sky-500/10 text-lab-accent mx-auto flex items-center justify-center mb-3 shadow-sm">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-lab-text mb-1">Canvas Ready</h3>
            <p className="text-sm text-lab-muted leading-relaxed">
              Upload a design mockup or load a benchmark case on the left to inspect.
            </p>
          </div>
        ) : (
          <div
            id="zoom-wrapper"
            className={`relative rounded shadow-2xl transition-transform duration-150 bg-lab-card mx-auto ${!iframeHtml ? 'w-full' : ''}`}
            style={{ 
              width: iframeHtml ? '1024px' : undefined,
              transform: `scale(${zoom})`,
              transformOrigin
            }}
          >
            {/* Base Iframe */}
            {iframeHtml && (
              <div className="relative w-full">
                {imageSrc ? (
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Audited Interface Screenshot Overlay"
                    className="w-full h-auto block select-none pointer-events-none opacity-95 mix-blend-multiply dark:mix-blend-normal relative z-10"
                  />
                ) : (
                  <div
                    className="w-full"
                    style={
                      fallbackIframeHeight
                        ? { height: `${fallbackIframeHeight}px` }
                        : { aspectRatio: '1024/768' }
                    }
                  />
                )}
                <iframe
                  ref={iframeRef}
                  srcDoc={iframeHtml}
                  sandbox="allow-same-origin"
                  onLoad={() => {
                    if (imageSrc) return; // only matters when the iframe is what's actually shown
                    try {
                      const innerDoc = iframeRef.current?.contentDocument;
                      const realHeight = Math.max(
                        innerDoc?.documentElement?.scrollHeight || 0,
                        innerDoc?.body?.scrollHeight || 0,
                        768
                      );
                      setFallbackIframeHeight(realHeight);
                    } catch {
                      // Cross-origin or sandbox restriction - keep the placeholder guess.
                    }
                  }}
                  className={`absolute inset-0 w-full h-full block select-none z-0 ${imageSrc ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
                />
              </div>
            )}
            
            {/* Standalone Image */}
            {!iframeHtml && imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Audited Interface Design"
                className="w-full h-auto block select-none pointer-events-none"
              />
            )}

            {/* SVG Connecting Focus Vector Path for Keyboard Mode */}
            {hasAudited && canvasMode === 'keyboard' && interactiveRegions.length > 1 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {interactiveRegions.map((region, i) => {
                  if (i === 0) return null;
                  const prev = interactiveRegions[i - 1];
                  const x1 = prev.bbox.x + prev.bbox.w / 2;
                  const y1 = prev.bbox.y + prev.bbox.h / 2;
                  const x2 = region.bbox.x + region.bbox.w / 2;
                  const y2 = region.bbox.y + region.bbox.h / 2;
                  const isActive = activeTabIdx === i;

                  return (
                    <g key={`path-${i}`}>
                      <line
                        x1={`${x1}%`}
                        y1={`${y1}%`}
                        x2={`${x2}%`}
                        y2={`${y2}%`}
                        stroke={isActive ? '#38BDF8' : '#64748B'}
                        strokeWidth={isActive ? '2.5' : '1.5'}
                        strokeDasharray={isActive ? 'none' : '4 3'}
                        className="transition-all"
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Overlay Elements: Mode 1 - Issue Overlays */}
            {hasAudited &&
              canvasMode === 'overlay' &&
              findings.map((finding, idx) => {
                const isSelected = selectedFindingId === finding.id;
                const isHovered = hoveredFindingId === finding.id;
                const bbox = finding.target.boundingBox;
                if (!bbox) return null;

                return (
                  <div
                    key={finding.id}
                    id={`box-${finding.id}`}
                    style={{
                      left: `${bbox.x}%`,
                      top: `${bbox.y}%`,
                      width: `${bbox.w}%`,
                      height: `${bbox.h}%`,
                      // Outline in the same severity color as the issue card's edge.
                      ...(isSelected || isHovered ? {} : { ['--tw-ring-color' as string]: SEVERITY_BAR[finding.severity] }),
                    }}
                    onClick={() => onSelectFinding(isSelected ? null : finding.id)}
                    className={`absolute z-20 rounded transition-all cursor-pointer flex items-start justify-start ${
                      isSelected || isHovered
                        ? 'ring-4 ring-sky-400 z-30'
                        : 'ring-2 hover:ring-4'
                    }`}
                  >
                    {/* Sits just above the box, so it does not cover the start of the text (inside the box only at the very top of the page). */}
                    <span className={`absolute left-0 ${bbox.y < 3 ? 'top-0' : 'bottom-full mb-0.5'} bg-black/90 text-white font-mono text-xs font-bold min-w-[24px] h-6 px-1 flex items-center justify-center rounded-full shadow-md ring-1 ring-white`}>
                      {idx + 1}
                    </span>
                  </div>
                );
              })}

            {/* Overlay Elements: Mode 2 - Keyboard Focus Stepper */}
            {hasAudited &&
              canvasMode === 'keyboard' &&
              interactiveRegions.map((region, idx) => {
                const isActive = activeTabIdx === idx;
                const bbox = region.bbox;

                return (
                  <div
                    key={region.id}
                    id={`box-${region.id}`}
                    style={{
                      left: `${bbox.x}%`,
                      top: `${bbox.y}%`,
                      width: `${bbox.w}%`,
                      height: `${bbox.h}%`,
                    }}
                    onClick={() => setActiveTabIdx(idx)}
                    className={`absolute z-20 rounded transition-all cursor-pointer flex items-center justify-center ${
                      isActive
                        ? 'ring-4 ring-sky-400 z-30'
                        : 'ring-2 ring-slate-400 hover:ring-4 hover:ring-sky-400'
                    }`}
                  >
                    <span
                      className={`min-w-[24px] h-6 px-1 rounded-full flex items-center justify-center text-xs font-bold font-mono shadow-lg ${
                        isActive
                          ? 'bg-lab-accent text-lab-onAccent'
                          : 'bg-lab-card text-lab-text'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </div>
                );
              })}

            {/* Overlay Elements: Mode 3 - Screen Reader Active Node */}
            {hasAudited &&
              canvasMode === 'screenreader' &&
              screenReaderItems.map((item, idx) => {
                const isActive = activeSpeechIdx === idx;
                const bbox = item.boundingBox;
                if (!bbox) return null;

                return (
                  <div
                    key={item.id}
                    id={`sr-box-${item.id}`}
                    style={{
                      left: `${bbox.x}%`,
                      top: `${bbox.y}%`,
                      width: `${bbox.w}%`,
                      height: `${bbox.h}%`,
                    }}
                    onClick={() => {
                      setActiveSpeechIdx(idx);
                      speechEngine.speak(item.spokenPhrase);
                    }}
                    className={`absolute z-20 rounded transition-all cursor-pointer ${
                      isActive
                        ? 'ring-4 ring-amber-400 z-30'
                        : item.isProblematic
                        ? 'ring-2 ring-red-500 hover:ring-4 hover:ring-red-400'
                        : 'ring-2 ring-emerald-500 hover:ring-4 hover:ring-emerald-400'
                    }`}
                  />
                );
              })}

          </div>
        )}
      </div>

      {/* State Banner: Before Audit Execution */}
      {!hasAudited && imageSrc && (
        <div className="bg-lab-elevated/90 backdrop-blur-md px-5 py-3 flex items-center justify-between flex-wrap gap-3 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5 text-sm text-lab-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span>
              <strong>Screenshot Ready:</strong> Click &ldquo;Run Accessibility Audit&rdquo; to execute deterministic checks.
            </span>
          </div>
          <button
            type="button"
            onClick={onRunAudit}
            disabled={isAuditing}
            className="px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent flex items-center gap-1.5 transition-all"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Auditing...' : 'Run Accessibility Audit'}</span>
          </button>
        </div>
      )}

      {/* Simulator Control Dock (for Keyboard & Screen Reader & Inspect Modes) */}
      {hasAudited && canvasMode === 'keyboard' && interactiveRegions.length > 0 && (
        <div className="bg-lab-elevated/90 backdrop-blur-md px-5 py-3 flex items-center justify-between flex-wrap gap-3 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
            <div>
              <p className="text-sm font-bold text-lab-text">
                Tab Stop #{activeTabIdx + 1} of {interactiveRegions.length}: &ldquo;
                {interactiveRegions[activeTabIdx]?.text || 'Interactive Target'}&rdquo;
              </p>
              <p className="text-xs font-mono text-lab-dim">
                Role: {interactiveRegions[activeTabIdx]?.role || 'button'} • Press{' '}
                <kbd className="px-1 py-0.5 bg-lab-bg rounded shadow-sm text-sky-400">
                  Tab
                </kbd>{' '}
                or{' '}
                <kbd className="px-1 py-0.5 bg-lab-bg rounded shadow-sm text-sky-400">
                  Shift+Tab
                </kbd>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveTabIdx((prev) => (prev > 0 ? prev - 1 : interactiveRegions.length - 1))
              }
              className="px-3 py-1.5 rounded text-sm font-medium bg-lab-card hover:bg-lab-subtle shadow-sm text-lab-text"
            >
              Previous Stop
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveTabIdx((prev) => (prev + 1) % interactiveRegions.length)
              }
              className="px-3 py-1.5 rounded text-sm font-medium bg-lab-card hover:bg-lab-subtle shadow-sm text-lab-text"
            >
              Next Stop
            </button>
            <button
              type="button"
              onClick={() => setIsAutoplaying(!isAutoplaying)}
              className={`px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1.5 transition-all ${
                isAutoplaying
                  ? 'bg-amber-500 text-black'
                  : 'bg-lab-accent text-lab-onAccent hover:bg-lab-accentHover'
              }`}
            >
              {isAutoplaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Pause Walkthrough</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Autoplay Flow</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {hasAudited && canvasMode === 'screenreader' && screenReaderItems.length > 0 && (
        <div className="bg-lab-elevated/90 backdrop-blur-md px-5 py-3 flex items-center justify-between flex-wrap gap-3 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded flex items-center justify-center shadow-sm ${
                screenReaderItems[activeSpeechIdx]?.isProblematic
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-lab-text flex items-center gap-2">
                <span>Announces: &ldquo;{screenReaderItems[activeSpeechIdx]?.spokenPhrase}&rdquo;</span>
                {screenReaderItems[activeSpeechIdx]?.isProblematic && (
                  <span className="text-xs font-mono text-red-300 bg-red-500/20 px-1.5 py-0.2 rounded shadow-sm">
                    Barrier Flagged
                  </span>
                )}
              </p>
              <p className="text-xs text-lab-dim">
                Should say: &ldquo;{screenReaderItems[activeSpeechIdx]?.shouldSayPhrase}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStepSpeech}
              className="px-3 py-1.5 rounded text-sm font-medium bg-lab-card hover:bg-lab-subtle shadow-sm text-lab-text flex items-center gap-1.5"
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Step Next</span>
            </button>
            <button
              type="button"
              onClick={toggleSpeechPlayback}
              className={`px-3.5 py-1.5 rounded text-sm font-bold flex items-center gap-1.5 transition-all ${
                isSpeaking
                  ? 'bg-amber-500 text-black'
                  : 'bg-lab-accent text-lab-onAccent hover:bg-lab-accentHover'
              }`}
            >
              {isSpeaking ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Stop Speech</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Play Speech Audio</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
