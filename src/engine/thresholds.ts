export type ElementClass =
  | 'text'              // body copy, labels, paragraph text
  | 'largeText'         // ≥24px, or ≥18.66px at weight ≥700
  | 'uiComponent'       // button, input, checkbox, control boundary, focus ring
  | 'graphicalObject'   // icon, chart element, meaningful graphic
  | 'decorative'        // no requirement
  | 'logo'              // no requirement (1.4.3 logotype exception)
  | 'disabled';         // no requirement (incidental / inactive exception)

export type Threshold = {
  ratio: number | null;   // null = no contrast requirement for this class
  sc: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  rationale: string;      // shown in the finding note; explains WHY this number
};

const THRESHOLDS: Record<string, Partial<Record<ElementClass, Threshold>>> = {
  '1.4.3': {
    text:      { ratio: 4.5, sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA',
                 rationale: 'Body text requires 4.5:1.' },
    largeText: { ratio: 3.0, sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA',
                 rationale: 'Large text (≥24px, or ≥18.66px bold) requires 3:1.' },
    logo:      { ratio: null, sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA',
                 rationale: 'Text that is part of a logo or brand name has no contrast requirement.' },
    disabled:  { ratio: null, sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA',
                 rationale: 'Inactive user interface components are incidental and exempt.' },
    decorative:{ ratio: null, sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA',
                 rationale: 'Pure decoration is exempt.' },
  },
  '1.4.11': {
    uiComponent:     { ratio: 3.0, sc: '1.4.11', name: 'Non-text Contrast', level: 'AA',
                       rationale: 'Visual information needed to identify a UI component or its state requires 3:1.' },
    graphicalObject: { ratio: 3.0, sc: '1.4.11', name: 'Non-text Contrast', level: 'AA',
                       rationale: 'Parts of a graphic required to understand the content require 3:1.' },
    disabled:        { ratio: null, sc: '1.4.11', name: 'Non-text Contrast', level: 'AA',
                       rationale: 'Inactive components are exempt from non-text contrast.' },
    decorative:      { ratio: null, sc: '1.4.11', name: 'Non-text Contrast', level: 'AA',
                       rationale: 'Purely decorative graphics are exempt.' },
  },
  '1.4.6': {   // AAA — surface only if AAA mode is enabled
    text:      { ratio: 7.0, sc: '1.4.6', name: 'Contrast (Enhanced)', level: 'AAA',
                 rationale: 'AAA body text requires 7:1.' },
    largeText: { ratio: 4.5, sc: '1.4.6', name: 'Contrast (Enhanced)', level: 'AAA',
                 rationale: 'AAA large text requires 4.5:1.' },
  },
  '2.5.8': {
    uiComponent: { ratio: 24, sc: '2.5.8', name: 'Target Size (Minimum)', level: 'AA',
                   rationale: 'Pointer targets must be at least 24×24 CSS px unless an exception applies.' },
  },
  '2.5.5': {   // AAA
    uiComponent: { ratio: 44, sc: '2.5.5', name: 'Target Size (Enhanced)', level: 'AAA',
                   rationale: 'AAA pointer targets must be at least 44×44 CSS px.' },
  },
};

export type TextMetrics = { fontSizePx: number; fontWeight: number };

/** Large text = ≥24px, or ≥18.66px at weight ≥700. */
export function isLargeText(m: TextMetrics): boolean {
  return m.fontSizePx >= 24 || (m.fontSizePx >= 18.66 && m.fontWeight >= 700);
}

export function resolveThreshold(
  criterion: string,
  elementClass: ElementClass,
): Threshold {
  const t = THRESHOLDS[criterion]?.[elementClass];
  if (!t) {
    throw new Error(
      `No threshold defined for ${criterion} × ${elementClass}. ` +
      `Add it to THRESHOLDS rather than inlining a constant.`
    );
  }
  return t;
}
