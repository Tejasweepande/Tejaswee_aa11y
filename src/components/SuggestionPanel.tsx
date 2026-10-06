import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { Finding } from '../types/finding';
import { FindingCard } from './FindingCard';

interface Props {
  finding: Finding;
  number: number;
  onBack: () => void;
  onCopyComment: () => void;
  copied: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h4 className="text-xs uppercase tracking-wide font-bold text-lab-muted mb-1.5">{title}</h4>
    {children}
  </section>
);

const ColorRow: React.FC<{ label: string; hex: string }> = ({ label, hex }) => (
  <div className="flex items-center gap-2 text-sm text-lab-text">
    <span
      aria-hidden="true"
      className="w-4 h-4 rounded-full ring-1 ring-inset ring-black/20 shrink-0"
      style={{ backgroundColor: hex }}
    />
    <span className="text-lab-muted w-28">{label}</span>
    <span className="font-mono">{hex}</span>
  </div>
);

export const SuggestionPanel: React.FC<Props> = ({ finding, number, onBack, onCopyComment, copied }) => {
  const backRef = useRef<HTMLButtonElement>(null);

  // Move focus into the new view so keyboard and screen reader users land on "Back".
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section aria-label={`Suggestions for issue ${number}`} className="flex-1 min-h-0 flex flex-col gap-3">
      <button
        ref={backRef}
        type="button"
        onClick={onBack}
        className="self-start inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-lab-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Back to findings</span>
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
        {/* Same card as in the list, so the user keeps their bearings */}
        <FindingCard finding={finding} number={number} variant="detail" />

        <Section title="What was found">
          <p className="text-sm text-lab-text leading-relaxed">{finding.evidence}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-lab-subtle text-lab-text font-medium">
              {finding.confidence === 'measured' ? 'Measured' : 'Predicted'}
            </span>
            {finding.nearMiss && (
              <span className="text-xs px-2 py-0.5 rounded bg-lab-subtle text-lab-text font-medium">
                Near miss
              </span>
            )}
          </div>
          {finding.confidenceReason && (
            <p className="text-xs text-lab-muted italic mt-2 leading-relaxed">{finding.confidenceReason}</p>
          )}
        </Section>

        {finding.swatch && (
          <Section title="Colors">
            <div className="space-y-1.5">
              <ColorRow label="Foreground" hex={finding.swatch.fg} />
              <ColorRow label="Background" hex={finding.swatch.bg} />
            </div>
          </Section>
        )}

        {finding.impact && (
          <Section title="Why it matters">
            <p className="text-sm text-lab-text leading-relaxed">{finding.impact}</p>
          </Section>
        )}

        {(finding.fix || finding.remediation) && (
          <Section title="How to fix">
            {finding.fix && (
              <div className="rounded bg-sky-500/10 p-3">
                <p className="text-sm text-lab-text leading-relaxed flex gap-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                  <span>{finding.fix}</span>
                </p>
              </div>
            )}
            {finding.remediation?.suggestedFg && (
              <div className="mt-2 space-y-1.5">
                <ColorRow label="Suggested text" hex={finding.remediation.suggestedFg} />
                <p className="text-xs text-lab-muted pl-6">
                  Reaches {finding.remediation.ratio.toFixed(2)}:1. {finding.remediation.explanation}
                </p>
              </div>
            )}
          </Section>
        )}

        <Section title="Criterion">
          <p className="text-sm text-lab-text leading-relaxed">
            WCAG {finding.wcag.sc} {finding.wcag.name} (Level {finding.wcag.level})
            {finding.wcag.principle ? ` · ${finding.wcag.principle}` : ''}
          </p>
          {finding.note && <p className="text-xs text-lab-muted mt-1 leading-relaxed">{finding.note}</p>}
          <div className="flex items-center gap-3 mt-2">
            {finding.wcag.url && (
              <a
                href={finding.wcag.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                <span>WCAG spec</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            <button
              type="button"
              onClick={onCopyComment}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-semibold bg-lab-subtle hover:bg-lab-elevated text-lab-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
              <span>{copied ? 'Copied!' : 'Copy comment'}</span>
            </button>
          </div>
        </Section>
      </div>
    </section>
  );
};
