export type ModuleType = 'contrast' | 'keyboard' | 'screenreader' | 'structure';

export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

export type Confidence = 'measured' | 'predicted';

export type WCAGLevel = 'A' | 'AA' | 'AAA';

export type POURPrinciple = 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';

export interface WCAGInfo {
  sc: string;             // e.g. "1.4.3"
  name: string;           // e.g. "Contrast (Minimum)"
  level: WCAGLevel;       // 'A' | 'AA' | 'AAA'
  principle?: POURPrinciple;
  url?: string;
}

export interface BoundingBox {
  x: number; // percentage (0-100) or pixels in source space
  y: number;
  w: number;
  h: number;
}

export interface FindingTarget {
  selector?: string;           // HTML paths
  figmaNodePath?: string;      // Figma path
  boundingBox?: BoundingBox;   // source coordinate space
  snippet?: string;            // HTML snippet or layer label
  elementKind?: string;        // 'button' | 'heading' | 'input' | 'image' | 'link' | 'text' | 'card' | 'dialog'
  visibleText?: string;        // visible text label
  headingLevel?: number;       // 1-6, when the element is a heading
  headingLevelInferred?: boolean; // true when the level was guessed (Figma/Image modes), not read from code
  htmlTag?: string;            // lowercase tag name from the live DOM, e.g. 'p', 'div'
  inputType?: string;          // <input type=...>, e.g. 'checkbox'
}

export interface ColorSwatch {
  fg: string; // sampled hex, e.g. "#8A8A8A"
  bg: string; // sampled hex, e.g. "#FFFFFF"
}

// Measured vs. required value shown on the finding card, e.g. 3.55:1 / 4.5:1
export interface FindingMetric {
  current: string;
  required: string;
}

export interface ColorRemediation {
  suggestedFg?: string;
  suggestedBg?: string;
  ratio: number;
  explanation: string;
}

// Canonical finding shape specified in GEMINI.md §3
export interface Finding {
  id: string;                    // stable e.g. "contrast-btn-primary-01"
  module: ModuleType;
  severity: Severity;
  confidence: Confidence;
  confidenceReason?: string;     // required when predicted
  wcag: WCAGInfo;
  aria?: string;                 // related ARIA or APG rule
  target: FindingTarget;
  evidence: string;              // MUST contain real numbers computed by code
  swatch?: ColorSwatch;          // sampled pair rendered as chips
  metric?: FindingMetric;        // current vs. required value for measured rules
  note?: string;                 // caveat on threshold used
  impact?: string;               // plain-language impact text
  fix?: string;                  // plain-language remediation copy
  remediation?: ColorRemediation; // bounded-hue color suggestions
  exceptionChecked?: boolean;
  exemptedBy?: string;
  nearMiss?: boolean;
}

export type InputMode = 'image' | 'figma' | 'url' | 'history';

export type ExportScale = '1x' | '2x' | '3x' | 'unknown';

export interface UIElementRegion {
  id: string;
  kind: 'heading' | 'button' | 'input' | 'link' | 'image' | 'text' | 'dialog' | 'landmark';
  text: string;
  bbox: BoundingBox; // 0-100 relative coordinates or px
  headingLevel?: number; // 1, 2, 3, etc.
  headingLevelInferred?: boolean; // level guessed by an adapter, not read from code
  tag?: string; // lowercase HTML tag name (live DOM only)
  inputType?: string; // <input type=...> (live DOM only)
  readingOrder: number; // 1, 2, 3...
  isInteractive?: boolean;
  accessibleName?: string;
  role?: string;
  tabIndex?: number;
  hasOnClickWithoutKeyboard?: boolean;
  hasVisibleFocus?: boolean;
  styles?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: number;
    fontWeight?: number;
  };
}

export interface ScreenReaderItem {
  id: string;
  role: string;
  name: string;
  spokenPhrase: string;
  shouldSayPhrase: string;
  isProblematic: boolean;
  problemReason?: string;
  headingLevel?: number;
  landmarkType?: string;
  positionInSet?: { current: number; total: number };
  boundingBox?: BoundingBox;
}

export interface CapabilityCell {
  status: 'Measured' | 'Predicted' | 'Unavailable';
  reason: string;
}

export type CapabilityMatrixData = Record<InputMode, Record<ModuleType, CapabilityCell>>;

export interface AuditHistoryItem {
  id: string;
  timestamp: string;
  inputMode: InputMode;
  label: string;
  regionsCount: number;
  findingsCount: number;
  
  // State for restoring session
  imageSrc: string | null;
  iframeHtml: string | null;
  figmaUrl: string;
  webUrl: string;
  pastedHtml: string;
  regions: UIElementRegion[];
  findings: Finding[];
  screenReaderItems: ScreenReaderItem[];
  exemptedCount: number;
  exemptedDetails: any[];
  moduleToggles: Record<ModuleType, boolean>;
  exportScale: ExportScale;
}
