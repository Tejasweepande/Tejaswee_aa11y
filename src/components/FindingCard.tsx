import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, EllipsisVertical, Copy, Check, ExternalLink } from 'lucide-react';
import { Finding, Severity } from '../types/finding';
import { buildFindingCardModel } from '../utils/findingCard';

/**
 * Left severity bar colors, sampled from the design (critical / moderate / minor).
 * "Serious" is not in the design; it sits between critical and moderate.
 * Severity is also written out as text on every card, so the bar is a
 * redundant cue and not the only way to tell severity apart.
 */
export const SEVERITY_BAR: Record<Severity, string> = {
  critical: '#CA3A31',
  serious: '#DD6B20',
  moderate: '#F1AB54',
  minor: '#34728D',
};

// Secondary text. The design uses #808080 (3.95:1 on white), which is below the
// 4.5:1 that small text needs; #767676 is the lightest grey that passes.
const GREY = 'text-[#767676]';

const clamp2: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

interface Props {
  finding: Finding;
  /** Position of the finding in the full list; matches the pin number on the preview. */
  number: number;
  /** 'list' = interactive card in the findings list; 'detail' = read-only header of the suggestions view. */
  variant?: 'list' | 'detail';
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
  onOpenSuggestion?: () => void;
  onCopyComment?: () => void;
  copied?: boolean;
}

const iconButton =
  'w-7 h-7 inline-flex items-center justify-center rounded text-black hover:bg-black/5 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600';

// Deliberate exception to the five-size text scale (12/14/16/20/24px): the finding
// card keeps the exact sizes from the Figma design (12, 13, 14 and 20px).
export const FindingCard: React.FC<Props> = ({
  finding,
  number,
  variant = 'list',
  isSelected = false,
  isHovered = false,
  onSelect,
  onHover,
  onOpenSuggestion,
  onCopyComment,
  copied = false,
}) => {
  const model = buildFindingCardModel(finding, number);
  const isList = variant === 'list';
  const titleId = `finding-${finding.id}-${variant}-title`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the actions menu on outside click or Escape (focus goes back to its button).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const highlighted = isList && (isSelected || isHovered);

  return (
    <article
      id={isList ? `finding-${finding.id}` : undefined}
      aria-labelledby={titleId}
      onMouseEnter={isList ? () => onHover?.(true) : undefined}
      onMouseLeave={isList ? () => onHover?.(false) : undefined}
      className={`group relative flex items-stretch gap-3 pr-4 bg-white text-black rounded border border-black/10 shadow-sm transition-shadow ${
        highlighted ? 'ring-2 ring-sky-500' : ''
      }`}
    >
      {/* Clicking anywhere on the card highlights its pin on the preview. */}
      {isList && (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={`Highlight issue ${number} on the preview: ${model.title}, ${model.severityLabel}`}
          className="absolute inset-0 w-full h-full rounded cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        />
      )}

      {/* Severity bar */}
      <span
        aria-hidden="true"
        className="w-1 shrink-0 self-stretch rounded-l"
        style={{ backgroundColor: SEVERITY_BAR[model.severity] }}
      />

      <div className={`relative flex-1 min-w-0 py-4 ${isList ? 'pointer-events-none' : ''}`}>
        {/* Header: number + severity, actions */}
        <div className="flex items-center justify-between gap-2 h-[22px]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-black text-white text-[12px] leading-none font-bold"
              aria-hidden="true"
            >
              {model.number}
            </span>
            <span className="text-[14px] leading-5 font-medium text-black">
              <span className="sr-only">Issue {model.number}, severity </span>
              {model.severityLabel}
            </span>
          </div>

          {isList && (
            // Actions show on hover or keyboard focus (and stay visible on touch screens,
            // while the menu is open, or when the card is selected) to keep the list calm.
            <div
              className={`flex items-center gap-2 pointer-events-auto transition-opacity ${
                menuOpen || isSelected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
              }`}
            >
              <button
                type="button"
                id={`finding-${finding.id}-suggestions`}
                onClick={onOpenSuggestion}
                className={iconButton}
                aria-label={`Suggestions for issue ${number}`}
                title="Suggestions"
              >
                <Lightbulb className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              </button>

              <div ref={menuWrapRef} className="relative">
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className={iconButton}
                  aria-label={`More actions for issue ${number}`}
                  aria-expanded={menuOpen}
                  aria-controls={`finding-${finding.id}-menu`}
                  title="More actions"
                >
                  <EllipsisVertical className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                </button>

                {menuOpen && (
                  <ul
                    id={`finding-${finding.id}-menu`}
                    className="absolute right-0 top-full mt-1 z-30 min-w-[168px] py-1 bg-white text-black text-[13px] rounded border border-black/10 shadow-lg"
                  >
                    <li>
                      <button
                        type="button"
                        onClick={onCopyComment}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span>{copied ? 'Copied!' : 'Copy comment'}</span>
                      </button>
                    </li>
                    {finding.wcag.url && (
                      <li>
                        <a
                          href={finding.wcag.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          <span>WCAG spec</span>
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 id={titleId} className="mt-2 text-[20px] leading-6 font-bold text-black break-words">
          {model.title}
        </h3>

        {/* Identifier: what the element says */}
        {model.identifier && (
          <p className={`mt-1 text-[12px] leading-[18px] ${GREY} break-words`} style={clamp2}>
            {model.identifier}
          </p>
        )}

        {/* Rule label + value, swatch on the right for contrast findings */}
        <div className={`${model.identifier ? 'mt-3' : 'mt-4'} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className={`text-[13px] leading-[18px] ${GREY}`}>{model.ruleLabel}</p>
            {model.value.kind === 'measured' ? (
              <p className="text-[20px] leading-6 font-bold text-black">
                <span className="sr-only">
                  {model.value.current} measured, {model.value.required} required
                </span>
                <span aria-hidden="true">
                  {model.value.current}
                  <span className={`font-light ${GREY}`}>/{model.value.required}</span>
                </span>
              </p>
            ) : (
              <p className="text-[20px] leading-6 font-bold text-black break-words">{model.value.text}</p>
            )}
          </div>

          {model.swatch && (
            <div
              role="img"
              aria-label={`Foreground color ${model.swatch.fg} on background color ${model.swatch.bg}`}
              className="flex items-center shrink-0"
            >
              <span
                className="relative z-[1] w-10 h-10 rounded-full ring-1 ring-inset ring-black/15"
                style={{ backgroundColor: model.swatch.fg }}
              />
              <span
                className="-ml-2.5 w-10 h-10 rounded-full ring-1 ring-inset ring-black/15"
                style={{ backgroundColor: model.swatch.bg }}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
