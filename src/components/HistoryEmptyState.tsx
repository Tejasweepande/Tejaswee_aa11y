import React from 'react';
import { useHistoryController } from '../hooks/useAuditHistory';

/**
 * What the History page shows before any audit has been saved: a small illustration of the cards
 * that will appear here, and one plain sentence about how they get here.
 *
 * If the browser cannot save at all (some private windows), the usual sentence would be untrue,
 * so it says so instead. Colours come from the theme, so it works in light and dark.
 */
export const HistoryEmptyState: React.FC = () => {
  const canSave = useHistoryController()?.canSave ?? true;
  return (
    <div className="flex flex-col items-center text-center px-4 py-10" data-testid="history-empty">
      <svg viewBox="0 0 160 120" className="w-40 h-auto mb-5" fill="none" aria-hidden="true" focusable="false">
        {/* two empty slots behind, drawn dashed */}
        <rect x="32" y="12" width="96" height="36" rx="7" className="fill-lab-subtle stroke-lab-border" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" />
        <rect x="23" y="30" width="114" height="40" rx="7" className="fill-lab-subtle stroke-lab-border" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />
        {/* the card an audit will become: a title, then the regions and barriers counts */}
        <rect x="14" y="50" width="132" height="52" rx="8" className="fill-lab-card stroke-lab-border" strokeWidth="1.5" />
        <rect x="27" y="63" width="58" height="8" rx="4" className="fill-lab-border" />
        <rect x="27" y="82" width="30" height="7" rx="3.5" className="fill-lab-subtle stroke-lab-border" strokeWidth="1" />
        <rect x="63" y="82" width="40" height="7" rx="3.5" className="fill-lab-accent" opacity="0.35" />
        {/* a clock: this is where past audits are kept */}
        <circle cx="132" cy="54" r="15" className="fill-lab-accent" />
        <g className="text-lab-onAccent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M132 46.5V54l5 3.2" />
        </g>
      </svg>
      <h3 tabIndex={-1} data-testid="history-empty-title" className="text-base font-bold text-lab-text focus:outline-none">
        {canSave ? 'No saved audits yet' : "Saving isn't available here"}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-lab-muted leading-relaxed">
        {canSave
          ? 'Each audit you run is saved on this device automatically.'
          : 'Audits you run still appear in this list, but they are lost when you refresh. A private window can cause this.'}
      </p>
    </div>
  );
};
