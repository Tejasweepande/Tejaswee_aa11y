import { Finding, Severity } from '../types/finding';

/**
 * Maps an engine Finding onto the slots of the Audit Findings card:
 *
 *   (1) Critical                      <- number badge + severity
 *   Heading (H3)                      <- title
 *   Lorem ipsum is dummy text...      <- identifier (what the element says)
 *   Contrast Ratio • WCAG 1.4.3 AA    <- rule label
 *   3.55:1/4.5:1                      <- value (measured/required, or a status word)
 *
 * Every field is derived from data the engine already computes; nothing here
 * re-measures or re-judges a finding.
 */

export type CardValue =
  | { kind: 'measured'; current: string; required: string }
  | { kind: 'status'; text: string };

export interface FindingCardModel {
  id: string;
  number: number;
  severity: Severity;
  severityLabel: string;
  title: string;
  identifier: string | null;
  ruleLabel: string;
  value: CardValue;
  swatch: { fg: string; bg: string } | null;
}

interface RuleDef {
  prefix: string;
  label: string;
  /** Pass/fail rules show this word instead of a measured/required pair. */
  status?: string;
}

const RULES: RuleDef[] = [
  { prefix: 'contrast-', label: 'Contrast Ratio' },
  { prefix: 'target-size-', label: 'Target Size' },
  { prefix: 'heading-first-not-h1-', label: 'First Heading', status: 'Not H1' },
  { prefix: 'heading-skip-', label: 'Heading Order' },
  { prefix: 'img-missing-alt-', label: 'Alt Text', status: 'Missing' },
  { prefix: 'btn-unlabeled-', label: 'Accessible Name', status: 'Missing' },
  { prefix: 'link-purpose-', label: 'Link Purpose', status: 'Ambiguous' },
  { prefix: 'focus-visible-', label: 'Focus Indicator', status: 'Missing' },
  { prefix: 'keyboard-div-onclick-', label: 'Keyboard Access', status: 'Unreachable' },
  { prefix: 'focus-order-jump-', label: 'Focus Order', status: 'Out of order' },
];

const KIND_LABELS: Record<string, string> = {
  heading: 'Heading',
  button: 'Button',
  input: 'Input',
  link: 'Link',
  image: 'Image',
  text: 'Text',
  dialog: 'Dialog',
  landmark: 'Region',
  card: 'Card',
};

/** Engine placeholders used when an element has no text of its own. */
const PLACEHOLDER_SNIPPETS = new Set(['<img>', '<button>']);

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Friendly names for the HTML tags that show up as plain "text" elements. */
const TEXT_TAG_NAMES: Record<string, string> = {
  p: 'Paragraph',
  li: 'List item',
  label: 'Label',
  td: 'Table cell',
  th: 'Table header',
  span: 'Span',
  div: 'Div',
  blockquote: 'Quote',
  figcaption: 'Caption',
  caption: 'Caption',
  legend: 'Legend',
  dt: 'Term',
  dd: 'Definition',
  summary: 'Summary',
  small: 'Small print',
};

/**
 * Title = what the element is, plus the detail from the code that tells it apart:
 *   Heading (H3)        level read from <h3>
 *   Button (Div)        role="button" on a non-button tag
 *   Input (Checkbox)    <input type="checkbox">; Select / Textarea for those tags
 *   Text (Paragraph)    <p>; List item, Label, Table cell, Span, Div, ...
 * Detail is only shown when the code actually provided it. Figma and Image audits
 * have no tags, and their heading levels are guesses, so those titles stay plain.
 */
export function getTitle(finding: Finding): string {
  const { elementKind, htmlTag, inputType, headingLevel, headingLevelInferred } = finding.target;
  const kind = elementKind || '';
  const tag = (htmlTag || '').toLowerCase();
  const base = KIND_LABELS[kind] || capitalize(kind) || 'Element';

  switch (kind) {
    case 'heading':
      return headingLevel && !headingLevelInferred ? `${base} (H${headingLevel})` : base;
    case 'button':
      return tag && tag !== 'button' ? `${base} (${capitalize(tag)})` : base;
    case 'input':
      if (tag === 'select') return 'Select';
      if (tag === 'textarea') return 'Textarea';
      return inputType ? `${base} (${capitalize(inputType)})` : base;
    case 'text':
      return tag ? `${base} (${TEXT_TAG_NAMES[tag] || capitalize(tag)})` : base;
    case 'image':
      return tag ? `${base} (${tag.toUpperCase()})` : base;
    default:
      return base;
  }
}

export function getIdentifier(finding: Finding): string | null {
  const kind = finding.target.elementKind || '';
  const raw = (finding.target.visibleText ?? finding.target.snippet ?? '').trim();
  if (!raw) return null;
  if (PLACEHOLDER_SNIPPETS.has(raw) || raw.toLowerCase() === kind.toLowerCase()) return null;
  return raw;
}

export function getRuleLabel(finding: Finding): string {
  const rule = RULES.find((r) => finding.id.startsWith(r.prefix));
  const name = rule ? rule.label : finding.wcag.name;
  // Rules that are best practice rather than a WCAG criterion carry no sc.
  return finding.wcag.sc
    ? `${name} • WCAG ${finding.wcag.sc} ${finding.wcag.level}`
    : `${name} • Best Practice`;
}

function headingSkipText(finding: Finding): string | null {
  // metric.required is the first level that should have appeared (e.g. "H2"),
  // metric.current is the level that actually did (e.g. "H4").
  const from = Number(finding.metric?.required.replace(/^H/, ''));
  const to = Number(finding.metric?.current.replace(/^H/, '')) - 1;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return from === to ? `Skips H${from}` : `Skips H${from}–H${to}`;
}

export function getValue(finding: Finding): CardValue {
  const rule = RULES.find((r) => finding.id.startsWith(r.prefix));

  if (finding.id.startsWith('heading-skip-')) {
    return { kind: 'status', text: headingSkipText(finding) || 'Skipped level' };
  }

  // Measured rules (contrast, target size): current / required.
  if (finding.metric && !rule?.status) {
    return { kind: 'measured', current: finding.metric.current, required: finding.metric.required };
  }

  // "Missing" is only true when there is no name at all; a generic name such as
  // "image.png" or "icon" exists but is not descriptive.
  if (rule && (rule.prefix === 'img-missing-alt-' || rule.prefix === 'btn-unlabeled-')) {
    return { kind: 'status', text: getIdentifier(finding) ? 'Not descriptive' : 'Missing' };
  }

  if (rule?.status) return { kind: 'status', text: rule.status };

  // Unknown rule: never leave the slot empty.
  return { kind: 'status', text: finding.evidence };
}

export function buildFindingCardModel(finding: Finding, number: number): FindingCardModel {
  return {
    id: finding.id,
    number,
    severity: finding.severity,
    severityLabel: capitalize(finding.severity),
    title: getTitle(finding),
    identifier: getIdentifier(finding),
    ruleLabel: getRuleLabel(finding),
    value: getValue(finding),
    swatch: finding.swatch ? { fg: finding.swatch.fg, bg: finding.swatch.bg } : null,
  };
}
