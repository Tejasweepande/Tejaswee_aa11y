import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Finding, ModuleType, Severity } from '../types/finding';
import { CheckCircle2, Search, FileDown, Sparkles } from 'lucide-react';
import { FindingCard } from './FindingCard';
import { SuggestionPanel } from './SuggestionPanel';
import { SeverityDot } from './SeverityTag';
import { CheckFilter, CHECK_OPTIONS } from './CheckFilter';

interface Props {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  hoveredFindingId: string | null;
  onHoverFinding: (id: string | null) => void;
  onOpenReportModal: () => void;
  onExportJson: () => void;
  hasAudited: boolean;
}

export const IssueRail: React.FC<Props> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
  hoveredFindingId,
  onHoverFinding,
  onOpenReportModal,
  onExportJson,
  hasAudited,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedModules, setSelectedModules] = useState<ModuleType[]>(CHECK_OPTIONS.map((o) => o.id));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Suggestions view: opened from a card's bulb icon, replaces the list inside this
  // same panel. Search, filters and scroll position are kept so Back lands exactly
  // where the user left.
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const lastTriggerId = useRef<string | null>(null);

  const handleCopySingle = (f: Finding) => {
    const index = findings.findIndex((item) => item.id === f.id);
    const formatted = `[#${index + 1} A11y Barrier: WCAG ${f.wcag.sc} ${f.wcag.name} (${f.severity.toUpperCase()})]\nEvidence: ${f.evidence}\nImpact: ${f.impact || 'Requires remediation'}\nFix: ${f.fix || 'Update design per WCAG AA'}\n`;
    navigator.clipboard.writeText(formatted);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openSuggestion = (id: string) => {
    savedScroll.current = listRef.current?.scrollTop ?? 0;
    lastTriggerId.current = id;
    onSelectFinding(id); // keep the matching pin highlighted while reading
    setSuggestionId(id);
  };

  const closeSuggestion = () => setSuggestionId(null);

  // Back: put the list scroll position and keyboard focus back where they were.
  useLayoutEffect(() => {
    if (suggestionId === null && lastTriggerId.current) {
      if (listRef.current) listRef.current.scrollTop = savedScroll.current;
      document.getElementById(`finding-${lastTriggerId.current}-suggestions`)?.focus();
      lastTriggerId.current = null;
    }
  }, [suggestionId]);

  // Picking a different pin on the preview while reading suggestions returns to the list.
  useEffect(() => {
    if (suggestionId && selectedFindingId && selectedFindingId !== suggestionId) {
      lastTriggerId.current = null;
      setSuggestionId(null);
    }
  }, [selectedFindingId, suggestionId]);

  // Keep the selected card in view when a pin on the preview is clicked.
  useEffect(() => {
    if (selectedFindingId && !suggestionId) {
      document.getElementById(`finding-${selectedFindingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedFindingId, suggestionId]);

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
    if (!selectedModules.includes(f.module)) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchText =
        f.wcag.sc.toLowerCase() +
        ' ' +
        f.wcag.name.toLowerCase() +
        ' ' +
        f.evidence.toLowerCase() +
        ' ' +
        (f.target.snippet || '').toLowerCase();
      if (!matchText.includes(query)) return false;
    }
    return true;
  });

  const suggestionFinding = suggestionId ? findings.find((f) => f.id === suggestionId) || null : null;

  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    serious: findings.filter((f) => f.severity === 'serious').length,
    moderate: findings.filter((f) => f.severity === 'moderate').length,
    minor: findings.filter((f) => f.severity === 'minor').length,
  };

  return (
    <aside
      aria-label="Accessibility Findings and Remediation Rail"
      className="bg-lab-card rounded p-5 shadow-panel flex flex-col gap-4 h-full overflow-hidden min-h-0"
    >
      {/* Rail Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-lab-text">Findings</h2>

        {hasAudited && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportJson}
              title="Download JSON canonical findings"
              className="w-8 h-8 inline-flex items-center justify-center rounded bg-lab-subtle hover:bg-lab-elevated text-lab-muted hover:text-lab-text shadow-sm transition-all"
              aria-label="Export findings as JSON"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenReportModal}
              className="h-8 px-2.5 rounded bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent text-sm font-bold transition-all flex items-center gap-1"
            >
              <span>Full Report</span>
            </button>
          </div>
        )}
      </div>

      {!hasAudited ? (
        /* Pre-Audit Clean State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-lab-subtle/40 rounded min-h-[380px] shadow-inner">
          <div className="w-12 h-12 rounded bg-lab-accent/10 text-lab-accent flex items-center justify-center mb-3 shadow-sm">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-lab-text mb-1">Ready for Audit</h3>
          <p className="text-sm text-lab-muted max-w-xs mb-5 leading-relaxed">
            Target input loaded. Press the "Run Accessibility Audit" button on the left panel to run deterministic WCAG 2.2 checks, pixel decile-core contrast sampling, and focus order inspection.
          </p>
        </div>
      ) : suggestionFinding ? (
        <SuggestionPanel
          finding={suggestionFinding}
          number={findings.findIndex((f) => f.id === suggestionFinding.id) + 1}
          onBack={closeSuggestion}
          onCopyComment={() => handleCopySingle(suggestionFinding)}
          copied={copiedId === suggestionFinding.id}
        />
      ) : (
        /* Post-Audit Findings View */
        <>
          {/* Severity filter as text tabs: no fills, the selected one is bold and underlined */}
          <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-x-4 border-b border-lab-border">
            {(['all', ...(['critical', 'serious', 'moderate', 'minor'] as Severity[]).filter((sev) => severityCounts[sev] > 0)] as (
              | 'all'
              | Severity
            )[]).map((sev) => (
              <button
                key={sev}
                type="button"
                aria-pressed={selectedSeverity === sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`-mb-px pb-2 inline-flex items-center gap-1.5 text-sm border-b-2 transition-colors ${
                  selectedSeverity === sev
                    ? 'border-lab-text text-lab-text font-bold'
                    : 'border-transparent text-lab-muted hover:text-lab-text'
                }`}
              >
                {sev !== 'all' && <SeverityDot severity={sev} />}
                {sev === 'all'
                  ? `All ${findings.length}`
                  : `${sev.charAt(0).toUpperCase() + sev.slice(1)} ${severityCounts[sev]}`}
              </button>
            ))}
          </div>

          {/* Search, with the check-type filter as a small dropdown beside it */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-lab-dim absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues"
                aria-label="Search issues"
                className="w-full bg-lab-card border border-lab-border rounded pl-8 pr-3 py-1.5 text-sm text-lab-text placeholder-lab-dim focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-sans"
              />
            </div>
            <CheckFilter selected={selectedModules} onChange={setSelectedModules} />
          </div>

          {/* Findings List (Scrollable) */}
          <div
            ref={listRef}
            role="feed"
            aria-label="Accessibility findings"
            aria-busy={false}
            className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-1"
          >
            {filteredFindings.length === 0 ? (
              <div className="text-center py-10 px-4 bg-lab-subtle/50 rounded shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" aria-hidden="true" />
                <p className="text-sm font-bold text-lab-text mb-0.5">No matching issues</p>
                <p className="text-xs text-lab-dim">
                  No accessibility barriers match the current filters.
                </p>
              </div>
            ) : (
              filteredFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  number={findings.findIndex((f) => f.id === finding.id) + 1}
                  isSelected={selectedFindingId === finding.id}
                  isHovered={hoveredFindingId === finding.id}
                  onSelect={() => onSelectFinding(selectedFindingId === finding.id ? null : finding.id)}
                  onHover={(hovering) => onHoverFinding(hovering ? finding.id : null)}
                  onOpenSuggestion={() => openSuggestion(finding.id)}
                  onCopyComment={() => handleCopySingle(finding)}
                  copied={copiedId === finding.id}
                />
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
};
