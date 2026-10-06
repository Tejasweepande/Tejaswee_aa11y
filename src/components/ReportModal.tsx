import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarrierMap } from './BarrierMap';
import { InfoTip } from './InfoTip';
import { ReportIssueCard } from './ReportIssueCard';
import { Finding, InputMode, ExportScale, ModuleType, Severity } from '../types/finding';
import { buildAffectedGroups, buildRuleRows, computeScore, RuleStatus, ScoreLabel, SCORE_MEANING } from '../utils/reportScore';
import { capitalize } from '../utils/findingCard';
import { SEVERITY_BAR } from './FindingCard';
import { SeverityDot, SeverityTag } from './SeverityTag';
import {
  X,
  Download,
  Copy,
  CheckCircle2,
  Info,
  Printer,
  Send,
  Loader2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  findings: Finding[];
  inputMode: InputMode;
  exportScale: ExportScale;
  figmaUrl?: string;
  figmaToken?: string;
  exemptedCount?: number;
  exemptedDetails?: any[];
  imageSrc?: string | null;
  iframeHtml?: string | null;
  /** Which audit modules were on; rules of switched-off modules count as not checked. */
  moduleToggles: Record<ModuleType, boolean>;
}

const INPUT_LABEL: Partial<Record<InputMode, string>> = {
  image: 'Image',
  figma: 'Figma',
  url: 'Website',
};

type ReportTab = 'overview' | 'details';
type PrintMode = 'overview' | 'details' | 'both';

const SEVERITIES: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

// Status colors reuse the severity palette, so a red means the same thing everywhere.
const PASS_COLOR = '#15803D';
const NOT_CHECKED_COLOR = '#9CA3AF';

const SCORE_COLOR: Record<ScoreLabel, string> = {
  Good: PASS_COLOR,
  Fair: SEVERITY_BAR.minor,
  Weak: SEVERITY_BAR.moderate,
  Poor: SEVERITY_BAR.critical,
};

const STATUS_LABEL: Record<RuleStatus, string> = {
  failure: 'Fails',
  warning: 'Warning',
  passed: 'Passes',
  'not-checked': 'Not checked',
};

const STATUS_COLOR: Record<RuleStatus, string> = {
  failure: SEVERITY_BAR.critical,
  warning: SEVERITY_BAR.moderate,
  passed: PASS_COLOR,
  'not-checked': NOT_CHECKED_COLOR,
};

/** Dot + plain text, the same pattern as severity tags. */
const DotLabel: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lab-text">
    <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
    {children}
  </span>
);

// Failing rules first, so the table reads like a to-do list.
const STATUS_ORDER: RuleStatus[] = ['failure', 'warning', 'passed', 'not-checked'];


export const ReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  findings,
  inputMode,
  exportScale,
  figmaUrl,
  figmaToken,
  exemptedCount = 0,
  imageSrc,
  iframeHtml,
  moduleToggles,
}) => {
  const [copiedFigma, setCopiedFigma] = useState(false);
  const [pushingToFigma, setPushingToFigma] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overviewTabRef = useRef<HTMLButtonElement>(null);
  const detailsTabRef = useRef<HTMLButtonElement>(null);
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<ReportTab>('overview');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  // Print box: open while choosing, then printMode is set for the duration of printing.
  const [printBoxOpen, setPrintBoxOpen] = useState(false);
  const [printChoice, setPrintChoice] = useState<PrintMode>('both');
  const [printChecklist, setPrintChecklist] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);

  // Auto-focus close button and trap focus within dialog (R3, GEMINI.md §6B)
  useEffect(() => {
    if (!isOpen) return;
    // Move focus into the dialog on open
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // A small popup inside the report (info tip, print box) handles Escape itself.
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // While the report is open, tell the page so the print stylesheet can hide the app
  // and print only the report (the report itself is rendered outside the app root).
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('report-open');
    return () => document.body.classList.remove('report-open');
  }, [isOpen]);

  if (!isOpen) return null;

  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    serious: findings.filter((f) => f.severity === 'serious').length,
    moderate: findings.filter((f) => f.severity === 'moderate').length,
    minor: findings.filter((f) => f.severity === 'minor').length,
  };

  const ruleRows = buildRuleRows(findings, moduleToggles);
  const sortedRuleRows = [...ruleRows].sort((x, y) => STATUS_ORDER.indexOf(x.status) - STATUS_ORDER.indexOf(y.status));
  const score = computeScore(ruleRows, findings);
  const affected = buildAffectedGroups(findings, ruleRows);

  const printOverview = printMode === 'overview' || printMode === 'both';
  const printDetails = printMode === 'details' || printMode === 'both';

  // From a pin on the map to its card: show it even if filtered out, then scroll and focus it.
  const goToIssue = (finding: Finding) => {
    if (severityFilter !== 'all' && severityFilter !== finding.severity) setSeverityFilter('all');
    requestAnimationFrame(() => {
      const card = document.getElementById(`report-issue-${finding.id}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card?.focus({ preventScroll: true });
    });
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(findings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `a11y-lab-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyFigmaComments = () => {
    const formatted = findings
      .map(
        (f, i) =>
          `[#${i + 1} A11y Barrier: WCAG ${f.wcag.sc} ${f.wcag.name} (${f.severity.toUpperCase()})]\nEvidence: ${f.evidence}\nImpact: ${f.impact || 'Requires remediation'}\nFix: ${f.fix || 'Update design per WCAG AA'}\n`
      )
      .join('\n---\n\n');

    navigator.clipboard.writeText(formatted);
    setCopiedFigma(true);
    setTimeout(() => setCopiedFigma(false), 2500);
  };

  const handlePushToFigmaAPI = async () => {
    if (!figmaUrl || !figmaToken) return;
    
    // Extract fileKey from URL
    let fileKey = '';
    try {
      const urlObj = new URL(figmaUrl);
      const pathParts = urlObj.pathname.split('/');
      fileKey = pathParts[2];
      if (!fileKey) return;
    } catch (e) {
      return;
    }

    setPushingToFigma(true);
    setPushError(null);
    
    try {
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const message = `[#${i + 1} A11y Barrier: WCAG ${f.wcag.sc} ${f.wcag.name} (${f.severity.toUpperCase()})]\nEvidence: ${f.evidence}\nImpact: ${f.impact || 'Requires remediation'}\nFix: ${f.fix || 'Update design per WCAG AA'}`;
        
        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
          const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
            method: 'POST',
            headers: {
              'X-Figma-Token': figmaToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message,
              client_meta: f.target.figmaNodePath ? { node_id: f.target.figmaNodePath, node_offset: { x: 0, y: 0 } } : undefined
            })
          });
          
          if (res.status === 429) {
            console.warn(`Rate limit hit on finding ${i+1}. Waiting 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            retries--;
            continue;
          }
          
          if (!res.ok) {
            const errText = await res.text();
            console.error(`Failed to post finding ${i+1}:`, errText);
            break; // Break the retry loop on non-429 errors
          }
          
          success = true;
          successCount++;
        }
        
        if (!success) {
           failureCount++;
        }
        
        // Wait 1 second between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (failureCount > 0) {
        setPushError(`Pushed ${successCount} comments. ${failureCount} failed (see console).`);
      } else {
        setPushSuccess(true);
        setTimeout(() => setPushSuccess(false), 5000);
      }
    } catch (err: any) {
      console.error('Failed to push comments to Figma', err);
      setPushError(err.message || 'Unknown error occurred while pushing comments.');
    } finally {
      setPushingToFigma(false);
    }
  };

  // Print the chosen parts. The cropped pictures render only now, then printing
  // starts once they have had a moment to load; afterwards the screen view returns.
  const handlePrint = () => {
    setPrintBoxOpen(false);
    setPrintMode(printChoice);
    const reset = () => {
      setPrintMode(null);
      window.removeEventListener('afterprint', reset);
    };
    window.addEventListener('afterprint', reset);
    window.setTimeout(() => window.print(), 600);
  };

  return createPortal(
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="report-print-root fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto p-4"
    >
      <div className="report-print-panel bg-lab-card border border-lab-border rounded max-w-5xl w-full p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-lab-border pb-4 mb-5">
          <div>
            <h2 id="report-modal-title" className="text-xl font-bold text-lab-text">
              Accessibility report
            </h2>
            <p className="text-sm text-lab-muted mt-1">
              WCAG 2.2 A/AA · {INPUT_LABEL[inputMode] ?? inputMode} · Scale {exportScale} · {findings.length} {findings.length === 1 ? 'issue' : 'issues'}
              {exemptedCount > 0 && ` · ${exemptedCount} exempt`}
            </p>
          </div>

          <div className="print:hidden flex items-center gap-2">
          <div
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && printBoxOpen) {
                e.preventDefault();
                setPrintBoxOpen(false);
                printButtonRef.current?.focus();
              }
            }}
          >
            <button
              ref={printButtonRef}
              type="button"
              onClick={() => setPrintBoxOpen((o) => !o)}
              aria-expanded={printBoxOpen}
              aria-controls="report-print-box"
              className="px-3 py-2 rounded text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-lab-muted" aria-hidden="true" />
              <span>Print</span>
            </button>

            {printBoxOpen && (
              <div
                id="report-print-box"
                role="group"
                aria-labelledby="report-print-box-title"
                className="absolute right-0 top-full mt-2 z-40 w-80 bg-lab-card border border-lab-border rounded shadow-xl p-4"
              >
                <p id="report-print-box-title" className="text-base font-bold text-lab-text">Print</p>
                <p className="text-xs text-lab-muted mt-0.5 mb-3">Every issue is printed, whatever filter is on screen.</p>
                <fieldset className="space-y-2">
                  <legend className="sr-only">What to print</legend>
                  {(
                    [
                      { v: 'overview', t: 'Overview', d: 'Score, KPIs, who is affected and WCAG rules.' },
                      { v: 'details', t: 'Details', d: 'Every issue with a cropped picture, impact and fix.' },
                      { v: 'both', t: 'Both', d: 'Overview first, then Details.' },
                    ] as { v: PrintMode; t: string; d: string }[]
                  ).map((o) => (
                    <label
                      key={o.v}
                      className={`flex gap-2.5 items-start p-2.5 rounded border cursor-pointer ${
                        printChoice === o.v ? 'border-lab-accent bg-lab-accent/5' : 'border-lab-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-print-choice"
                        value={o.v}
                        checked={printChoice === o.v}
                        onChange={() => setPrintChoice(o.v)}
                        autoFocus={printChoice === o.v}
                        className="mt-0.5 accent-[rgb(var(--lab-accent))]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-lab-text">{o.t}</span>
                        <span className="block text-xs text-lab-muted">{o.d}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="flex items-center gap-2 mt-3 text-sm text-lab-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printChecklist}
                    onChange={(e) => setPrintChecklist(e.target.checked)}
                    className="accent-[rgb(var(--lab-accent))]"
                  />
                  Include manual review checklist
                </label>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintBoxOpen(false);
                      printButtonRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded text-sm font-bold bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent"
                  >
                    Print
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-lab-muted hover:text-lab-text p-1.5 rounded focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label="Close audit report"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          </div>
        </div>

        {/* Tabs (screen only; printing uses the choice in the print box) */}
        <div role="tablist" aria-label="Report view" className="print:hidden flex gap-1 border-b border-lab-border mb-5 -mt-1">
          {(['overview', 'details'] as ReportTab[]).map((t) => (
            <button
              key={t}
              id={`report-tab-${t}`}
              ref={t === 'overview' ? overviewTabRef : detailsTabRef}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`report-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const next = t === 'overview' ? 'details' : 'overview';
                  setTab(next);
                  (next === 'overview' ? overviewTabRef : detailsTabRef).current?.focus();
                }
              }}
              className={`px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-lab-text text-lab-text' : 'border-transparent text-lab-muted hover:text-lab-text'
              }`}
            >
              {t === 'overview' ? 'Overview' : 'Details'}
            </button>
          ))}
        </div>

        {/* Scrollable Report Content */}
        <div className="report-print-scroll flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Statutory Disclaimer (§7 in GEMINI.md) */}
          <div className="break-inside-avoid bg-lab-subtle rounded p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-lab-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-lab-text mb-0.5">Automated checks only</h3>
              <p className="text-xs text-lab-muted leading-relaxed">
                Automated accessibility testing tools detect approximately <strong>30% to 40%</strong> of all WCAG success criteria. <strong>This report never claims full legal or technical conformance.</strong> Overclaiming conformance is itself an accessibility harm. The findings below must be paired with the manual review checklist.
              </p>
            </div>
          </div>

          {/* ---------- Overview ---------- */}
          <div
            id="report-panel-overview"
            role="tabpanel"
            aria-labelledby="report-tab-overview"
            className={`space-y-6 ${tab === 'overview' ? '' : 'hidden'} ${printOverview ? 'print:block' : 'print:hidden'}`}
          >
            <h3 className="hidden print:block text-lg font-bold text-lab-text">Overview</h3>

            {/* Summary cards: answer "does it pass?", "how good is it?" and "how much to fix?" */}
            <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3">
              <div className="break-inside-avoid bg-lab-subtle rounded p-4">
                <div className="flex items-center gap-0.5 text-sm font-semibold text-lab-muted">
                  Passes automated accessibility checks?
                  <InfoTip label="Passes automated accessibility checks?">
                    <p>Yes when none of the tested WCAG 2.2 rules has a critical or serious issue.</p>
                    <p className="mt-1.5">Automated checks cover only about a third of WCAG, so a Yes still needs the manual review before you can call it accessible.</p>
                  </InfoTip>
                </div>
                <p className="mt-1 flex items-center gap-2 text-xl font-extrabold text-lab-text">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: score.passing ? PASS_COLOR : SEVERITY_BAR.critical }} />
                  {score.passing ? 'Yes' : 'No'}
                </p>
                <p className="mt-1.5 text-sm text-lab-muted">
                  {score.passing
                    ? 'No rule fails the automated checks.'
                    : `${score.failing} of ${score.tested} rules fail${
                        severityCounts.critical > 0
                          ? `, with ${severityCounts.critical} critical ${severityCounts.critical === 1 ? 'issue' : 'issues'} that can stop people using it`
                          : ''
                      }.`}
                </p>
              </div>

              <div className="break-inside-avoid bg-lab-subtle rounded p-4">
                <div className="flex items-center gap-0.5 text-sm font-semibold text-lab-muted">
                  Score
                  <InfoTip label="Score">
                    <p>How many of the tested WCAG rules pass, out of 10. A rule with only minor problems counts as half a pass.</p>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1">
                      <li>9–10 Good · 7–8 Fair · 5–6 Weak · 0–4 Poor</li>
                      <li>While a critical issue remains, it can't be better than Weak.</li>
                    </ul>
                  </InfoTip>
                </div>
                {score.score === null ? (
                  <p className="mt-1 text-sm text-lab-muted">No rules were checked.</p>
                ) : (
                  <>
                    <p className="mt-1 flex items-center gap-2">
                      <span className="text-xl font-extrabold tabular-nums text-lab-text">
                        {score.score}
                        <span className="text-base font-semibold text-lab-dim"> / 10</span>
                      </span>
                      <DotLabel color={SCORE_COLOR[score.label!]}>{score.label}</DotLabel>
                    </p>
                    <p className="mt-1.5 text-sm text-lab-muted">
                      {score.capped ? 'Critical issues hold this at Weak. Fix them before release.' : SCORE_MEANING[score.label!]}
                    </p>
                  </>
                )}
              </div>

              <div className="break-inside-avoid bg-lab-subtle rounded p-4">
                <div className="flex items-center gap-0.5 text-sm font-semibold text-lab-muted">
                  Issues to fix
                  <InfoTip label="Issues to fix">
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="text-lab-text">Critical:</strong> stops some people using it. Fix first.</li>
                      <li><strong className="text-lab-text">Serious:</strong> makes it very hard for some people.</li>
                      <li><strong className="text-lab-text">Moderate and minor:</strong> annoying or slower, but usable.</li>
                    </ul>
                  </InfoTip>
                </div>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-lab-text">{findings.length}</p>
                <p className="mt-1.5 text-sm text-lab-muted">
                  {SEVERITIES.filter((s) => severityCounts[s] > 0)
                    .map((s) => `${severityCounts[s]} ${s}`)
                    .join(' · ') || 'None found'}
                </p>
              </div>
            </div>

            {/* Who is affected */}
            <div className="break-inside-avoid">
              <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted mb-2">Who is affected</h3>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-lab-border text-xs font-bold text-lab-muted uppercase tracking-wider">
                    <th className="py-2.5 px-3">People</th>
                    <th className="py-2.5 px-3">What gets in their way</th>
                    <th className="py-2.5 px-3 w-20 text-right">Issues</th>
                    <th className="py-2.5 px-3 w-32">Worst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lab-border">
                  {affected.map((g) => (
                    <tr key={g.people}>
                      <td className="py-2.5 px-3 text-lab-text font-medium">{g.people}</td>
                      <td className="py-2.5 px-3 text-lab-muted">{g.barriers}</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-lab-text">{g.tested || g.issueCount > 0 ? g.issueCount : '–'}</td>
                      <td className="py-2.5 px-3">
                        {g.worst ? (
                          <SeverityTag severity={g.worst} />
                        ) : g.tested ? (
                          <DotLabel color={PASS_COLOR}>No issues</DotLabel>
                        ) : (
                          <DotLabel color={NOT_CHECKED_COLOR}>Not checked</DotLabel>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* WCAG rules */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted mb-2">WCAG rules</h3>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-lab-border text-xs font-bold text-lab-muted uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-20">Rule</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3 w-16">Level</th>
                    <th className="py-2.5 px-3 w-32">Status</th>
                    <th className="py-2.5 px-3 w-20 text-right">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lab-border">
                  {sortedRuleRows.map((row) => (
                    <tr key={row.sc} className="break-inside-avoid">
                      <td className="py-2.5 px-3 tabular-nums text-lab-muted">{row.sc}</td>
                      <td className="py-2.5 px-3 text-lab-text">{row.name}</td>
                      <td className="py-2.5 px-3 text-lab-muted">{row.level}</td>
                      <td className="py-2.5 px-3">
                        <DotLabel color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</DotLabel>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-lab-text">{row.issueCount > 0 ? row.issueCount : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- Details ---------- */}
          <div
            id="report-panel-details"
            role="tabpanel"
            aria-labelledby="report-tab-details"
            className={`space-y-6 ${tab === 'details' ? '' : 'hidden'} ${printDetails ? 'print:block' : 'print:hidden'} ${printMode === 'both' ? 'print:break-before-page' : ''}`}
          >
            <h3 className="hidden print:block text-lg font-bold text-lab-text">Details</h3>

            {/* Barrier map: screen only. Print shows a cropped picture on each issue instead. */}
            {(imageSrc || iframeHtml) && (
              <div className="print:hidden">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted">Visual barrier map</h3>
                  <p className="text-xs text-lab-muted">Select a pin to jump to its issue.</p>
                </div>
                <BarrierMap imageSrc={imageSrc} iframeHtml={iframeHtml} findings={findings} onPinClick={goToIssue} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted">Issues</h3>
                {findings.length > 0 && (
                  <div role="group" aria-label="Filter issues by severity" className="print:hidden flex flex-wrap gap-1.5">
                    {(['all', ...SEVERITIES.filter((s) => severityCounts[s] > 0)] as ('all' | Severity)[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={severityFilter === s}
                        onClick={() => setSeverityFilter(s)}
                        className={`px-2.5 py-1 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                          severityFilter === s ? 'bg-lab-text text-lab-card' : 'bg-lab-subtle text-lab-text hover:bg-lab-elevated'
                        }`}
                      >
                        {s !== 'all' && <SeverityDot severity={s} />}
                        {s === 'all' ? `All ${findings.length}` : `${capitalize(s)} ${severityCounts[s]}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {findings.length === 0 ? (
                <p className="text-sm text-lab-muted p-4 bg-lab-subtle rounded">No issues found.</p>
              ) : (
                <div className="space-y-4 print:space-y-2">
                  {findings.map((f, index) => (
                    // On screen the filter hides cards; print always includes every issue.
                    <div key={f.id} className={severityFilter === 'all' || severityFilter === f.severity ? '' : 'hidden print:block'}>
                      <ReportIssueCard
                        finding={f}
                        number={index + 1}
                        showCrop={printMode !== null}
                        imageSrc={imageSrc}
                        iframeHtml={iframeHtml}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manual Review Checklist (§7 in GEMINI.md): end of Details on screen; in print when ticked */}
          <div
            className={`break-inside-avoid bg-lab-subtle rounded p-4 space-y-3 ${tab === 'details' ? '' : 'hidden'} ${
              printMode !== null && printChecklist ? 'print:block' : 'print:hidden'
            }`}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-lab-muted">
              Essential Manual Review Checklist
            </h3>
            <ul className="space-y-2 text-sm text-lab-muted">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-lab-accent mt-1.5 flex-shrink-0" />
                <span>
                  <strong>Modal Focus Trapping:</strong> Test that opening dialogs confines keyboard Tab focus within the modal until dismissed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-lab-accent mt-1.5 flex-shrink-0" />
                <span>
                  <strong>Screen Reader Meaningful Sequence:</strong> Verify that interactive screen readers (NVDA, VoiceOver) announce dynamic alerts with appropriate live region priority.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-lab-accent mt-1.5 flex-shrink-0" />
                <span>
                  <strong>200% Text Zoom:</strong> Verify that browser zoom up to 200% causes no text truncation or overlapping elements.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="print:hidden border-t border-lab-border pt-4 mt-5 flex items-start justify-end flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyFigmaComments}
            className="px-3 py-2 rounded text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text flex items-center gap-1.5 transition-colors"
          >
            {copiedFigma ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Copied Figma Comments!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-lab-accent" aria-hidden="true" />
                <span>Copy as Figma Review Comments</span>
              </>
            )}
          </button>

          {inputMode === 'figma' && figmaUrl && figmaToken && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handlePushToFigmaAPI}
                disabled={pushingToFigma}
                className={`px-3 py-2 rounded text-sm font-bold flex items-center gap-1.5 transition-all ${
                  pushSuccess
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent disabled:opacity-50'
                }`}
              >
                {pushingToFigma ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : pushSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{pushingToFigma ? 'Pushing...' : pushSuccess ? 'Pushed Successfully!' : 'Push to Figma'}</span>
              </button>
              {pushError && (
                <span className="text-xs text-red-700 dark:text-red-400 max-w-xs leading-tight">
                  {pushError}
                </span>
              )}
              {pushSuccess && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Press <strong>C</strong> in Figma to view comments.
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-3 py-2 rounded text-sm font-bold bg-lab-accent hover:bg-lab-accentHover text-lab-onAccent flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Export Canonical JSON</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
