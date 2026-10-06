import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarrierMap } from './BarrierMap';
import { Finding, InputMode, ExportScale } from '../types/finding';
import {
  FileText,
  X,
  Download,
  Copy,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
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
}

const ALL_CRITERIA = [
  { sc: '1.1.1', name: 'Non-text Content', level: 'A' },
  { sc: '1.3.1', name: 'Info and Relationships', level: 'A' },
  { sc: '1.4.1', name: 'Use of Color', level: 'A' },
  { sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA' },
  { sc: '1.4.11', name: 'Non-text Contrast', level: 'AA' },
  { sc: '2.1.1', name: 'Keyboard', level: 'A' },
  { sc: '2.4.3', name: 'Focus Order', level: 'A' },
  { sc: '2.4.4', name: 'Link Purpose (In Context)', level: 'A' },
  { sc: '2.4.7', name: 'Focus Visible', level: 'AA' },
  { sc: '2.5.8', name: 'Target Size (Minimum)', level: 'AA' },
  { sc: '4.1.2', name: 'Name, Role, Value', level: 'A' },
];

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
}) => {
  const [copiedFigma, setCopiedFigma] = useState(false);
  const [pushingToFigma, setPushingToFigma] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button and trap focus within dialog (R3, GEMINI.md §6B)
  useEffect(() => {
    if (!isOpen) return;
    // Move focus into the dialog on open
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const criteriaRows = ALL_CRITERIA.map(criterion => {
    const issues = findings.filter(f => f.wcag.sc === criterion.sc);
    const failureCount = issues.filter(f => ['critical', 'serious'].includes(f.severity)).length;
    const warningCount = issues.filter(f => ['moderate', 'minor'].includes(f.severity)).length;
    
    let status: 'passed' | 'warning' | 'failure' = 'passed';
    if (failureCount > 0) status = 'failure';
    else if (warningCount > 0) status = 'warning';
    
    return {
      ...criterion,
      issueCount: issues.length,
      status
    };
  });

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

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="report-print-root fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      <div className="report-print-panel bg-lab-card border border-lab-border rounded max-w-3xl w-full p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-lab-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded_SM bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-lg font-bold text-lab-text">
                Accessibility Audit Summary &amp; Conformance Report
              </h2>
              <p className="text-sm text-lab-muted">
                Evaluated against WCAG 2.2 (Levels A/AA) • Input: {inputMode.toUpperCase()} • Scale: {exportScale}
              </p>
              <p className="text-sm font-semibold text-emerald-400 mt-1">
                {findings.length} findings • {exemptedCount} exempt
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="print:hidden text-lab-muted hover:text-lab-text p-1.5 rounded focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label="Close audit report"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Report Content */}
        <div className="report-print-scroll flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Statutory Disclaimer (§7 in GEMINI.md) */}
          <div className="break-inside-avoid bg-amber-400 border border-amber-500 rounded p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-black flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-black mb-1">
                Automated Testing Coverage Boundary Notice
              </h3>
              <p className="text-sm text-black leading-relaxed">
                Automated accessibility testing tools detect approximately <strong>30% to 40%</strong> of all WCAG success criteria. <strong>This report never claims full legal or technical conformance.</strong> Overclaiming conformance is itself an accessibility harm. The findings below must be paired with the manual review checklist.
              </p>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="break-inside-avoid bg-lab-bg border border-lab-border rounded_SM p-3.5 text-center">
              <span className="text-xl font-mono font-extrabold text-red-400 block mb-1">
                {severityCounts.critical}
              </span>
              <span className="text-xs uppercase font-semibold text-lab-muted">Critical Barriers</span>
            </div>

            <div className="break-inside-avoid bg-lab-bg border border-lab-border rounded_SM p-3.5 text-center">
              <span className="text-xl font-mono font-extrabold text-orange-400 block mb-1">
                {severityCounts.serious}
              </span>
              <span className="text-xs uppercase font-semibold text-lab-muted">Serious Issues</span>
            </div>

            <div className="break-inside-avoid bg-lab-bg border border-lab-border rounded_SM p-3.5 text-center">
              <span className="text-xl font-mono font-extrabold text-amber-400 block mb-1">
                {severityCounts.moderate}
              </span>
              <span className="text-xs uppercase font-semibold text-lab-muted">Moderate Notices</span>
            </div>

            <div className="break-inside-avoid bg-lab-bg border border-lab-border rounded_SM p-3.5 text-center">
              <span className="text-xl font-mono font-extrabold text-sky-400 block mb-1">
                {severityCounts.minor}
              </span>
              <span className="text-xs uppercase font-semibold text-lab-muted">Minor Polish</span>
            </div>
          </div>

          {/* Visual Barrier Map */}
          {(imageSrc || iframeHtml) && (
            <div className="bg-lab-card border border-lab-border rounded p-4 mb-6">
              <h3 className="break-after-avoid text-base font-bold text-lab-text uppercase tracking-wider mb-4 border-b border-lab-border pb-2">
                Visual Barrier Map
              </h3>
              <BarrierMap imageSrc={imageSrc} iframeHtml={iframeHtml} findings={findings} />
            </div>
          )}

          {/* Matrix Table */}
          <div className="bg-lab-card border border-lab-border rounded overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-lab-border text-xs font-bold text-lab-muted uppercase tracking-wider">
                  <th className="py-3 px-4 w-24">Criterion</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 w-20 text-center">Level</th>
                  <th className="py-3 px-4 w-24 text-center">Status</th>
                  <th className="py-3 px-4 w-20 text-center">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lab-border text-base">
                {criteriaRows.map(row => (
                  <tr key={row.sc} className="break-inside-avoid hover:bg-lab-bg/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-lab-dim">{row.sc}</td>
                    <td className="py-3 px-4 text-lab-text font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded border border-lab-border text-xs font-bold text-lab-muted bg-lab-bg">
                        {row.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.status === 'failure' && (
                        <div className="mx-auto w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                        </div>
                      )}
                      {row.status === 'warning' && (
                        <div className="mx-auto w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-sm">
                          !
                        </div>
                      )}
                      {row.status === 'passed' && (
                        <div className="mx-auto w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {row.issueCount > 0 ? (
                        <span className={row.status === 'failure' ? 'text-red-400' : 'text-amber-400'}>
                          {row.issueCount}
                        </span>
                      ) : (
                        <span className="text-lab-dim">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Findings List */}
          <div className="space-y-4">
            <h3 className="break-after-avoid text-base font-bold text-lab-text uppercase tracking-wider border-b border-lab-border pb-2">
              Detailed Findings
            </h3>
            <div className="space-y-4">
              {findings.length === 0 ? (
                <p className="text-base text-lab-muted italic p-4 bg-lab-card rounded border border-lab-border">No findings to display.</p>
              ) : (
                findings.map((f, index) => {
                  return (
                    <div key={f.id} className="break-inside-avoid bg-lab-card border border-lab-border rounded p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`min-w-[28px] h-7 px-1 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm bg-black text-white border border-white/20`}>
                            {index + 1}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            f.severity === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            f.severity === 'serious' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            f.severity === 'moderate' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          }`}>
                            {f.severity}
                          </span>
                          <span className="text-base font-bold text-lab-text">
                            {f.wcag.sc} {f.wcag.name}
                          </span>
                          <span className="text-sm text-lab-muted border-l border-lab-border pl-3">
                            {f.confidence === 'measured' ? 'Measured' : 'Predicted'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-lab-bg rounded p-3 mb-3 border border-lab-border">
                        <p className="text-base text-lab-text font-mono">Evidence: {f.evidence}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        {f.impact && (
                          <div className="bg-lab-bg rounded p-3 border border-lab-border text-base">
                            <strong className="text-lab-muted block mb-1">Impact:</strong>
                            <span className="text-lab-text">{f.impact}</span>
                          </div>
                        )}
                        {f.fix && (
                          <div className="bg-lab-bg rounded p-3 border border-lab-border text-base">
                            <strong className="text-lab-muted block mb-1">Fix:</strong>
                            <span className="text-lab-text">{f.fix}</span>
                          </div>
                        )}
                      </div>
                      
                      {f.target.snippet && (
                        <div className="bg-[#1e1e1e] rounded p-3 overflow-x-auto text-sm font-mono text-gray-300 print:bg-gray-100 print:text-gray-900 print:overflow-visible print:whitespace-pre-wrap print:break-words">
                          {f.target.snippet}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Manual Review Checklist (§7 in GEMINI.md) */}
          <div className="break-inside-avoid bg-lab-bg border border-lab-border rounded_SM p-4 space-y-3">
            <h3 className="text-sm font-bold text-lab-text uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" aria-hidden="true" />
              Essential Manual Review Checklist
            </h3>
            <ul className="space-y-2 text-sm text-lab-muted">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>
                  <strong>Modal Focus Trapping:</strong> Test that opening dialogs confines keyboard Tab focus within the modal until dismissed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>
                  <strong>Screen Reader Meaningful Sequence:</strong> Verify that interactive screen readers (NVDA, VoiceOver) announce dynamic alerts with appropriate live region priority.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>
                  <strong>200% Text Zoom:</strong> Verify that browser zoom up to 200% causes no text truncation or overlapping elements.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="print:hidden border-t border-lab-border pt-4 mt-5 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyFigmaComments}
            className="px-3 py-2 rounded_SM text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text flex items-center gap-1.5 transition-colors"
          >
            {copiedFigma ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Copied Figma Comments!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>Copy as Figma Review Comments</span>
              </>
            )}
          </button>

          {inputMode === 'figma' && figmaUrl && figmaToken && (
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={handlePushToFigmaAPI}
                disabled={pushingToFigma}
                className={`px-3 py-2 rounded_SM text-sm font-bold shadow-glow-cyan flex items-center gap-1.5 transition-all ${
                  pushSuccess
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
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
                <span className="text-xs text-red-400 max-w-xs leading-tight">
                  {pushError}
                </span>
              )}
              {pushSuccess && (
                <span className="text-xs text-emerald-400">
                  Press <strong>C</strong> in Figma to view comments.
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded_SM text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated border border-lab-border text-lab-text flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-lab-muted" aria-hidden="true" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-4 py-2 rounded_SM text-sm font-bold bg-sky-500 hover:bg-sky-400 text-lab-bg shadow-glow-cyan flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Export Canonical JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
