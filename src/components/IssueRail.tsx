import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Finding, ModuleType, Severity } from '../types/finding';
import { CheckCircle2, Search, FileDown, Sparkles, SlidersHorizontal } from 'lucide-react';
import { FindingCard } from './FindingCard';
import { SuggestionPanel } from './SuggestionPanel';

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
  const [selectedModule, setSelectedModule] = useState<ModuleType | 'all'>('all');
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
    if (selectedModule !== 'all' && f.module !== selectedModule) return false;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-lab-text flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-lab-accent" aria-hidden="true" />
            <span>Audit Findings ({hasAudited ? findings.length : 0})</span>
          </h2>
          <p className="text-sm text-lab-muted">WCAG 2.2 AA deterministic violations</p>
        </div>

        {hasAudited && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExportJson}
              title="Download JSON canonical findings"
              className="p-1.5 rounded bg-lab-subtle hover:bg-lab-elevated text-lab-muted hover:text-lab-text text-sm shadow-sm transition-all"
              aria-label="Export findings as JSON"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenReportModal}
              className="px-2.5 py-1.5 rounded bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent text-sm font-bold shadow-glow-cyan transition-all flex items-center gap-1"
            >
              <span>Full Report</span>
            </button>
          </div>
        )}
      </div>

      {!hasAudited ? (
        /* Pre-Audit Clean State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-lab-subtle/40 rounded_SM min-h-[380px] shadow-inner">
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
          {/* Severity Metric Pills */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <button
              type="button"
              onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? 'all' : 'critical')}
              className={`p-2 rounded_SM transition-all shadow-sm ${
                selectedSeverity === 'critical'
                  ? 'bg-red-500/20 text-red-700 dark:text-red-300 ring-2 ring-red-500/50 shadow-glow-red'
                  : 'bg-lab-subtle text-lab-muted hover:bg-lab-elevated hover:ring-1 hover:ring-red-500/30'
              }`}
            >
              <span className="block text-sm font-extrabold font-mono text-red-600 dark:text-red-400">
                {severityCounts.critical}
              </span>
              <span className="text-xs uppercase font-bold text-lab-dim">Critical</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSeverity(selectedSeverity === 'serious' ? 'all' : 'serious')}
              className={`p-2 rounded_SM transition-all shadow-sm ${
                selectedSeverity === 'serious'
                  ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/50 shadow-glow-amber'
                  : 'bg-lab-subtle text-lab-muted hover:bg-lab-elevated hover:ring-1 hover:ring-orange-500/30'
              }`}
            >
              <span className="block text-sm font-extrabold font-mono text-orange-600 dark:text-orange-400">
                {severityCounts.serious}
              </span>
              <span className="text-xs uppercase font-bold text-lab-dim">Serious</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSeverity(selectedSeverity === 'moderate' ? 'all' : 'moderate')}
              className={`p-2 rounded_SM transition-all shadow-sm ${
                selectedSeverity === 'moderate'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/50 shadow-glow-amber'
                  : 'bg-lab-subtle text-lab-muted hover:bg-lab-elevated hover:ring-1 hover:ring-amber-500/30'
              }`}
            >
              <span className="block text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400">
                {severityCounts.moderate}
              </span>
              <span className="text-xs uppercase font-bold text-lab-dim">Moderate</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSeverity(selectedSeverity === 'minor' ? 'all' : 'minor')}
              className={`p-2 rounded_SM transition-all shadow-sm ${
                selectedSeverity === 'minor'
                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/50 shadow-glow-cyan'
                  : 'bg-lab-subtle text-lab-muted hover:bg-lab-elevated hover:ring-1 hover:ring-sky-500/30'
              }`}
            >
              <span className="block text-sm font-extrabold font-mono text-sky-600 dark:text-sky-400">
                {severityCounts.minor}
              </span>
              <span className="text-xs uppercase font-bold text-lab-dim">Minor</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-lab-dim absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues, WCAG criteria, selectors..."
                className="w-full bg-lab-card shadow-inner rounded_SM pl-8 pr-3 py-1.5 text-sm text-lab-text placeholder-lab-dim focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-sans"
              />
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm no-scrollbar">
              {(['all', 'contrast', 'keyboard', 'screenreader', 'structure'] as (ModuleType | 'all')[]).map(
                (mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => setSelectedModule(mod)}
                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-all shadow-sm ${
                      selectedModule === mod
                        ? 'bg-lab-accent text-lab-onAccent shadow-glow-cyan'
                        : 'bg-lab-subtle text-lab-muted hover:text-lab-text hover:bg-lab-elevated'
                    }`}
                  >
                    {mod === 'all'
                      ? 'All Modules'
                      : mod === 'screenreader'
                      ? 'Screen Reader'
                      : mod.charAt(0).toUpperCase() + mod.slice(1)}
                  </button>
                )
              )}
            </div>
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
              <div className="text-center py-10 px-4 bg-lab-subtle/50 rounded_SM shadow-inner">
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
