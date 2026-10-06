import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Finding } from '../types/finding';
import { buildFindingCardModel } from '../utils/findingCard';
import { SEVERITY_BAR } from './FindingCard';
import { IssueCrop } from './IssueCrop';

interface Props {
  finding: Finding;
  number: number;
  /** Print only: draw a cropped picture of the element. */
  showCrop: boolean;
  imageSrc?: string | null;
  iframeHtml?: string | null;
}

const Column: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="min-w-0">
    <h4 className="text-xs uppercase tracking-wide font-bold text-[#50555F] mb-1.5 print:mb-0.5">{title}</h4>
    {children}
  </section>
);

/**
 * One issue in the report's Details tab. Same card language as the audit screen
 * (severity edge, number pin, title, measured value, swatch), with the
 * suggestion panel's content laid out underneath in three columns.
 * Like the audit screen's card it stays white in dark mode, so it uses fixed greys.
 */
export const ReportIssueCard: React.FC<Props> = ({ finding, number, showCrop, imageSrc, iframeHtml }) => {
  const model = buildFindingCardModel(finding, number);
  const titleId = `report-issue-${finding.id}-title`;
  const bbox = finding.target.boundingBox;

  return (
    <article
      id={`report-issue-${finding.id}`}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="break-inside-avoid relative bg-white text-black rounded border border-black/10 shadow-sm overflow-hidden scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
    >
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: SEVERITY_BAR[model.severity] }} />

      <div className="pl-6 pr-5 py-4 print:pl-4 print:pr-3 print:py-2.5">
        <div className="flex-1 min-w-0">
          {/* Header row: same content as the audit screen's card */}
          <div className="flex items-end gap-6 print:gap-3 pb-4 border-b border-black/10 print:pb-2">
            {/* Print only: picture of the element, next to its title so the text below keeps the full width */}
            {showCrop && bbox && (imageSrc || iframeHtml) && (
              <IssueCrop
                imageSrc={imageSrc}
                iframeHtml={iframeHtml}
                bbox={bbox}
                number={number}
                color={SEVERITY_BAR[model.severity]}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-black text-white text-[12px] leading-none font-bold"
                >
                  {model.number}
                </span>
                <span className="text-[14px] leading-5 font-medium">
                  <span className="sr-only">Issue {model.number}, severity </span>
                  {model.severityLabel}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#F4F5F7] font-medium">
                  {finding.confidence === 'measured' ? 'Measured' : 'Predicted'}
                </span>
              </div>
              <h3 id={titleId} className="mt-2 text-[20px] leading-6 font-bold break-words print:mt-1 print:text-base">
                {model.title}
              </h3>
              {model.identifier && (
                <p className="mt-1 text-[12px] leading-[18px] text-[#767676] break-words">{model.identifier}</p>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0 text-right">
              <div>
                <p className="text-[13px] leading-[18px] text-[#767676]">{model.ruleLabel}</p>
                {model.value.kind === 'measured' ? (
                  <p className="text-[20px] leading-6 font-bold print:text-base">
                    <span className="sr-only">
                      {model.value.current} measured, {model.value.required} required
                    </span>
                    <span aria-hidden="true">
                      {model.value.current}
                      <span className="font-light text-[#767676]">/{model.value.required}</span>
                    </span>
                  </p>
                ) : (
                  <p className="text-[20px] leading-6 font-bold print:text-base">{model.value.text}</p>
                )}
              </div>
              {model.swatch && (
                <div
                  role="img"
                  aria-label={`Foreground color ${model.swatch.fg} on background color ${model.swatch.bg}`}
                  className="flex items-center"
                >
                  <span className="relative z-[1] w-10 h-10 print:w-6 print:h-6 rounded-full ring-1 ring-inset ring-black/15" style={{ backgroundColor: model.swatch.fg }} />
                  <span className="-ml-2.5 print:-ml-1.5 w-10 h-10 print:w-6 print:h-6 rounded-full ring-1 ring-inset ring-black/15" style={{ backgroundColor: model.swatch.bg }} />
                </div>
              )}
            </div>
          </div>

          {/* Suggestion content, as in the audit screen's suggestion panel */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] print:grid-cols-[1fr_1fr_1.2fr] gap-6 pt-4 print:gap-3 print:pt-2 print:text-xs">
            <Column title="What was found">
              <p className="text-sm leading-relaxed print:text-xs print:leading-snug">{finding.evidence}</p>
              {finding.confidenceReason && (
                <p className="text-xs text-[#50555F] italic mt-1.5 leading-relaxed print:hidden">{finding.confidenceReason}</p>
              )}
            </Column>
            <Column title="Why it matters">
              <p className="text-sm leading-relaxed print:text-xs print:leading-snug">{finding.impact || 'Some people may not be able to use this element.'}</p>
            </Column>
            <Column title="How to fix">
              <div className="rounded bg-sky-500/10 p-3 print:p-2">
                <p className="text-sm leading-relaxed flex gap-2 print:text-xs print:leading-snug">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
                  <span>{finding.fix || 'Update the design to meet the WCAG requirement below.'}</span>
                </p>
              </div>
              {finding.remediation?.suggestedFg && (
                <p className="mt-2 flex items-center gap-2 text-sm text-[#50555F]">
                  <span
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full ring-1 ring-inset ring-black/20 shrink-0"
                    style={{ backgroundColor: finding.remediation.suggestedFg }}
                  />
                  Suggested <span className="font-mono text-black">{finding.remediation.suggestedFg}</span>
                </p>
              )}
            </Column>
          </div>

          {/* Criterion line (screen only: in print the rule is already in the header) */}
          <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-dashed border-black/10 text-[13px] text-[#50555F] print:hidden">
            <span>
              WCAG {finding.wcag.sc} {finding.wcag.name} · Level {finding.wcag.level}
              {finding.wcag.principle ? ` · ${finding.wcag.principle}` : ''}
            </span>
            {finding.wcag.url && (
              <a
                href={finding.wcag.url}
                target="_blank"
                rel="noopener noreferrer"
                className="print:hidden inline-flex items-center gap-1 font-semibold text-sky-700 underline shrink-0"
              >
                WCAG spec
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
