import React, { useState } from 'react';
import { InputMode, ModuleType, ExportScale } from '../types/finding';
import { Info, X } from 'lucide-react';

interface Props {
  currentInput: InputMode;
  exportScale: ExportScale;
}

interface CellMeta {
  status: 'Measured' | 'Predicted';
  reason: string;
}

export const CapabilityMatrix: React.FC<Props> = ({ currentInput, exportScale }) => {
  const [activePopover, setActivePopover] = useState<{
    title: string;
    status: string;
    reason: string;
  } | null>(null);

  const isScaleDeclared = exportScale !== 'unknown';

  const matrixData: Record<Exclude<InputMode, 'history'>, Record<ModuleType, CellMeta>> = {
    figma: {
      contrast: {
        status: 'Measured',
        reason: 'Fills and text colours are literal values in the Figma file hierarchy.',
      },
      keyboard: {
        status: 'Predicted',
        reason: 'No runtime in design files; order derived from prototype links or geometric graph walk.',
      },
      screenreader: {
        status: 'Predicted',
        reason: 'No accessibility tree in Figma; inferred from layer, text, and component naming.',
      },
      structure: {
        status: 'Measured',
        reason: 'Sizes, text styles, and layer nesting are exact dimensions in the document.',
      },
    },
    image: {
      contrast: {
        status: 'Measured',
        reason: 'Colour pairs sampled directly from pixel decile-cores on canvas.',
      },
      keyboard: {
        status: 'Predicted',
        reason: 'Order inferred from visual reading order, not from tabindex runtime.',
      },
      screenreader: {
        status: 'Predicted',
        reason: 'Names read from visible text only; no alt or aria attributes to inspect.',
      },
      structure: {
        status: isScaleDeclared ? 'Measured' : 'Predicted',
        reason: isScaleDeclared
          ? `Target size measured in CSS pixels using declared ${exportScale} export scale.`
          : 'Target size predicted in raw image pixels until export scale is declared.',
      },
    },
    url: {
      contrast: {
        status: 'Measured',
        reason: 'Computed styles and background layer composition read from live same-origin DOM.',
      },
      keyboard: {
        status: 'Measured',
        reason: 'Walks real DOM tabindex, inert, and interactive elements.',
      },
      screenreader: {
        status: 'Measured',
        reason: 'Accessibility tree derived from full accname resolution order.',
      },
      structure: {
        status: 'Measured',
        reason: 'Real semantic HTML tags and CSS bounding boxes read from document.',
      },
    },
  };

  const inputs: { id: Exclude<InputMode, 'history'>; label: string }[] = [
    { id: 'image', label: 'Image Upload' },
    { id: 'figma', label: 'Figma Link' },
    { id: 'url', label: 'Live Website' },
  ];

  const modules: { id: ModuleType; label: string }[] = [
    { id: 'contrast', label: 'Contrast' },
    { id: 'keyboard', label: 'Keyboard' },
    { id: 'screenreader', label: 'Screen Reader' },
    { id: 'structure', label: 'Structure' },
  ];

  return (
    <div className="bg-lab-card border border-lab-border rounded p-4 shadow-panel relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-lab-muted">
            Live Capability Matrix
          </h3>
        </div>
        <span className="text-xs font-mono text-sky-400/80 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded-full">
          R2 Evidence State
        </span>
      </div>

      <p className="text-sm text-lab-dim mb-3">
        Permanently reflects source fidelity. Click any badge to inspect verification rationale.
      </p>

      {/* Accessible Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-lab-border text-lab-dim font-mono text-xs">
              <th scope="col" className="py-2 pr-2 font-medium">Input Source</th>
              {modules.map((m) => (
                <th key={m.id} scope="col" className="py-2 px-1.5 font-medium text-center">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inputs.map((inp) => {
              const isCurrent = inp.id === currentInput;
              return (
                <tr
                  key={inp.id}
                  className={`border-b border-lab-border/40 transition-colors ${
                    isCurrent ? 'bg-sky-500/10' : 'hover:bg-lab-subtle/50'
                  }`}
                >
                  <th
                    scope="row"
                    className="py-2.5 pr-2 font-medium text-lab-text whitespace-nowrap text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                      )}
                      <span>{inp.label}</span>
                    </div>
                  </th>

                  {modules.map((mod) => {
                    const cell = matrixData[inp.id][mod.id];
                    const isMeasured = cell.status === 'Measured';

                    return (
                      <td key={mod.id} className="py-2.5 px-1.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setActivePopover({
                              title: `${inp.label} — ${mod.label}`,
                              status: cell.status,
                              reason: cell.reason,
                            })
                          }
                          aria-label={`View evidence details for ${inp.label} ${mod.label}: ${cell.status}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium transition-all focus-visible:ring-2 ${
                            isMeasured
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/80'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-700/50 hover:bg-amber-900/80'
                          }`}
                        >
                          <span>{cell.status}</span>
                          <Info className="w-3 h-3 opacity-60" aria-hidden="true" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Accessible Detail Popover Dialog (Rule R3: Never use title attribute) */}
      {activePopover && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="matrix-popover-title"
          className="absolute inset-x-2 bottom-2 top-auto bg-lab-elevated border border-sky-500/40 rounded p-3 shadow-2xl z-30 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                  activePopover.status === 'Measured'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {activePopover.status}
              </span>
              <h4 id="matrix-popover-title" className="text-sm font-bold text-lab-text">
                {activePopover.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="text-lab-muted hover:text-lab-text p-0.5 rounded focus-visible:ring-1"
              aria-label="Close details popup"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-lab-muted leading-relaxed">
            {activePopover.reason}
          </p>
        </div>
      )}
    </div>
  );
};
