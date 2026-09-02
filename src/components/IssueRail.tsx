import React, { useState } from 'react';
import { Finding, ModuleType, Severity } from '../types/finding';
import {
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  FileDown,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  Play,
  Type,
  ImageIcon,
  Copy,
} from 'lucide-react';

interface Props {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  hoveredFindingId: string | null;
  onHoverFinding: (id: string | null) => void;
  onOpenReportModal: () => void;
  onExportJson: () => void;
  hasAudited: boolean;
  onRunAudit: () => void;
  isAuditing: boolean;
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
  onRunAudit,
  isAuditing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedModule, setSelectedModule] = useState<ModuleType | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopySingle = (f: Finding, e: React.MouseEvent) => {
    e.stopPropagation();
    const index = findings.findIndex((item) => item.id === f.id);
    const formatted = `[#${index + 1} A11y Barrier: WCAG ${f.wcag.sc} ${f.wcag.name} (${f.severity.toUpperCase()})]\nEvidence: ${f.evidence}\nImpact: ${f.impact || 'Requires remediation'}\nFix: ${f.fix || 'Update design per WCAG AA'}\n`;
    navigator.clipboard.writeText(formatted);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  React.useEffect(() => {
    if (selectedFindingId) {
      const el = document.getElementById(`finding-${selectedFindingId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Expand if not already expanded
        if (!expandedIds.has(selectedFindingId)) {
          toggleExpand(selectedFindingId);
        }
      }
    }
  }, [selectedFindingId, expandedIds]);

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
          <h2 className="text-sm font-bold text-lab-text flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>Audit Findings ({hasAudited ? findings.length : 0})</span>
          </h2>
          <p className="text-xs text-lab-muted">WCAG 2.2 AA deterministic violations</p>
        </div>

        {hasAudited && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExportJson}
              title="Download JSON canonical findings"
              className="p-1.5 rounded bg-lab-subtle hover:bg-lab-elevated text-lab-muted hover:text-lab-text text-xs shadow-sm transition-all"
              aria-label="Export findings as JSON"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenReportModal}
              className="px-2.5 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-lab-bg text-xs font-bold shadow-glow-cyan transition-all flex items-center gap-1"
            >
              <span>Full Report</span>
            </button>
          </div>
        )}
      </div>

      {!hasAudited ? (
        /* Pre-Audit Clean State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-lab-subtle/40 rounded_SM min-h-[380px] shadow-inner">
          <div className="w-12 h-12 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 shadow-sm">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-bold text-lab-text mb-1">Ready for Audit</h3>
          <p className="text-xs text-lab-muted max-w-xs mb-5 leading-relaxed">
            Target input loaded. Press the "Run Accessibility Audit" button on the left panel to run deterministic WCAG 2.2 checks, pixel decile-core contrast sampling, and focus order inspection.
          </p>
        </div>
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
              <span className="block text-xs font-extrabold font-mono text-red-600 dark:text-red-400">
                {severityCounts.critical}
              </span>
              <span className="text-[10px] uppercase font-bold text-lab-dim">Critical</span>
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
              <span className="block text-xs font-extrabold font-mono text-orange-600 dark:text-orange-400">
                {severityCounts.serious}
              </span>
              <span className="text-[10px] uppercase font-bold text-lab-dim">Serious</span>
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
              <span className="block text-xs font-extrabold font-mono text-amber-600 dark:text-amber-400">
                {severityCounts.moderate}
              </span>
              <span className="text-[10px] uppercase font-bold text-lab-dim">Moderate</span>
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
              <span className="block text-xs font-extrabold font-mono text-sky-600 dark:text-sky-400">
                {severityCounts.minor}
              </span>
              <span className="text-[10px] uppercase font-bold text-lab-dim">Minor</span>
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
                className="w-full bg-lab-card shadow-inner rounded_SM pl-8 pr-3 py-1.5 text-xs text-lab-text placeholder-lab-dim focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-sans"
              />
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {(['all', 'contrast', 'keyboard', 'screenreader', 'structure'] as (ModuleType | 'all')[]).map(
                (mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => setSelectedModule(mod)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-all shadow-sm ${
                      selectedModule === mod
                        ? 'bg-sky-500 text-white dark:text-lab-bg shadow-glow-cyan'
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
            role="feed"
            aria-busy={false}
            className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1"
          >
            {filteredFindings.length === 0 ? (
              <div className="text-center py-10 px-4 bg-lab-subtle/50 rounded_SM shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" aria-hidden="true" />
                <p className="text-xs font-bold text-lab-text mb-0.5">No matching issues</p>
                <p className="text-[11px] text-lab-dim">
                  No accessibility barriers match the current filters.
                </p>
              </div>
            ) : (
              filteredFindings.map((finding) => {
                const isSelected = selectedFindingId === finding.id;
                const isHovered = hoveredFindingId === finding.id;
                const isExpanded = expandedIds.has(finding.id);

                const severityBadge =
                  finding.severity === 'critical'
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                    : finding.severity === 'serious'
                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                    : finding.severity === 'moderate'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-sky-500/20 text-sky-700 dark:text-sky-300';

                return (
                  <div
                    key={finding.id}
                    id={`finding-${finding.id}`}
                    className={`rounded_SM transition-all shadow-md ${
                      isSelected || isHovered
                        ? 'bg-lab-elevated ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/10'
                        : 'bg-lab-card hover:bg-lab-subtle hover:shadow-lg'
                    }`}
                    onMouseEnter={() => onHoverFinding(finding.id)}
                    onMouseLeave={() => onHoverFinding(null)}
                  >
                    {/* Collapsed Header / Single Accessible Button (Rule R3) */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFinding(isSelected ? null : finding.id);
                        toggleExpand(finding.id);
                      }}
                      className="w-full text-left p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded_SM"
                      aria-expanded={isExpanded}
                      aria-label={`${finding.wcag.sc} ${finding.wcag.name} severity ${finding.severity}`}
                    >
                      {/* Top Meta Line */}
                      <span className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shadow-sm ${severityBadge}`}
                          >
                            {finding.severity.toUpperCase()}
                          </span>

                          <span className="text-[10px] font-mono text-sky-700 dark:text-sky-300 bg-sky-500/15 px-1.5 py-0.2 rounded font-semibold shadow-sm">
                            {finding.wcag.sc} {finding.wcag.level}
                          </span>

                          {finding.wcag.sc === '1.4.3' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded shadow-sm border border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                              <Type className="w-3 h-3" /> Text on bg
                            </span>
                          )}
                          {finding.wcag.sc === '1.4.11' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded shadow-sm border border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> Icon on bg
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded shadow-sm ${
                              finding.confidence === 'measured'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {finding.confidence === 'measured' ? 'Measured' : 'Predicted'}
                          </span>

                          {finding.nearMiss && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded shadow-sm border border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-bold ml-1">
                              Near Miss
                            </span>
                          )}
                        </span>

                        <span className="text-lab-dim">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          )}
                        </span>
                      </span>

                      {/* Finding Title & Target */}
                      <span className="block text-xs font-bold text-lab-text mb-1">
                        #{findings.findIndex(f => f.id === finding.id) + 1} - {finding.wcag.name}
                      </span>

                      {finding.target.snippet && (
                        <span className="block text-[11px] font-mono text-lab-dim truncate mb-1.5">
                          Target: {finding.target.snippet}
                        </span>
                      )}

                      {/* Code-computed Exact Evidence (Rule R1) */}
                      <span className="block text-xs font-mono text-sky-900 dark:text-sky-300 bg-sky-500/10 px-2 py-1 rounded shadow-inner mb-1.5 font-medium">
                        {finding.evidence}
                      </span>

                      {/* Sampled Color Chips for Contrast findings */}
                      {finding.swatch && (
                        <span className="flex items-center gap-2 mb-1.5">
                          <span className="flex items-center gap-1">
                            <span
                              className="w-4 h-4 rounded shadow-sm border border-lab-border"
                              style={{ backgroundColor: finding.swatch.fg }}
                            />
                            <span className="text-[11px] font-mono text-lab-muted">
                              {finding.swatch.fg} ({finding.wcag.sc === '1.4.11' ? 'Icon' : 'Text'})
                            </span>
                          </span>
                          <span className="text-lab-dim text-xs">on</span>
                          <span className="flex items-center gap-1">
                            <span
                              className="w-4 h-4 rounded shadow-sm border border-lab-border"
                              style={{ backgroundColor: finding.swatch.bg }}
                            />
                            <span className="text-[11px] font-mono text-lab-muted">
                              {finding.swatch.bg} (Bg)
                            </span>
                          </span>
                        </span>
                      )}

                      {/* Confidence Reason Callout (Rule R2) */}
                      {finding.confidenceReason && (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-400 italic mb-1 font-medium">
                          ℹ️ {finding.confidenceReason}
                        </span>
                      )}
                    </button>

                    {/* Expanded Details Body */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 text-xs space-y-3 bg-lab-card/50 rounded-b-xl animate-fade-in">
                        {finding.impact && (
                          <div>
                            <span className="text-[10px] uppercase font-mono font-bold text-red-400 block mb-0.5">
                              User Experience Impact
                            </span>
                            <p className="text-xs text-lab-muted leading-relaxed">
                              {finding.impact}
                            </p>
                          </div>
                        )}

                        {finding.fix && (
                          <div className="bg-sky-500/10 shadow-inner rounded_SM p-2.5">
                            <span className="text-[10px] uppercase font-mono font-bold text-sky-500 dark:text-sky-400 block mb-0.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                              Recommended Remediation
                            </span>
                            <p className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
                              {finding.fix}
                            </p>
                          </div>
                        )}

                        {finding.remediation && (
                          <div className="flex items-center justify-between bg-lab-subtle p-2 rounded shadow-sm text-[11px]">
                            <span className="text-lab-muted font-medium">Bounded Hue Suggestion:</span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 rounded shadow-sm"
                                style={{ backgroundColor: finding.remediation.suggestedFg }}
                              />
                              <span className="font-mono text-emerald-600 dark:text-emerald-300 font-bold">
                                {finding.remediation.suggestedFg}
                              </span>
                              <span className="text-lab-dim">
                                ({finding.remediation.ratio.toFixed(2)}:1)
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-lab-dim pt-3">
                          <div className="flex items-center gap-3">
                            <span>Principle: {finding.wcag.principle || 'WCAG 2.2'}</span>
                            {finding.wcag.url && (
                              <a
                                href={finding.wcag.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:underline flex items-center gap-1"
                              >
                                <span>WCAG Spec</span>
                                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => handleCopySingle(finding, e)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text flex items-center gap-1.5 transition-colors"
                          >
                            {copiedId === finding.id ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-sky-400" aria-hidden="true" />
                                <span>Copy Comment</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
};
