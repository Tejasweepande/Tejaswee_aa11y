import { Finding, ModuleType, Severity, WCAGLevel } from '../types/finding';

/**
 * Numbers for the report's Overview tab: rule statuses, the automated checks
 * score and the "who is affected" groups. Everything is derived from the
 * findings the engine already produced; nothing is re-measured here.
 */

export type RuleStatus = 'passed' | 'warning' | 'failure' | 'not-checked';

interface Criterion {
  sc: string;
  name: string;
  level: WCAGLevel;
  /** Audit module that checks this rule; null when no module checks it automatically. */
  module: ModuleType | null;
}

export const CRITERIA: Criterion[] = [
  { sc: '1.1.1', name: 'Non-text Content', level: 'A', module: 'screenreader' },
  { sc: '1.3.1', name: 'Info and Relationships', level: 'A', module: 'structure' },
  { sc: '1.4.1', name: 'Use of Color', level: 'A', module: null },
  { sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA', module: 'contrast' },
  { sc: '1.4.11', name: 'Non-text Contrast', level: 'AA', module: 'contrast' },
  { sc: '2.1.1', name: 'Keyboard', level: 'A', module: 'keyboard' },
  { sc: '2.4.3', name: 'Focus Order', level: 'A', module: 'keyboard' },
  { sc: '2.4.4', name: 'Link Purpose (In Context)', level: 'A', module: 'screenreader' },
  { sc: '2.4.7', name: 'Focus Visible', level: 'AA', module: 'keyboard' },
  { sc: '2.5.8', name: 'Target Size (Minimum)', level: 'AA', module: 'structure' },
  { sc: '4.1.2', name: 'Name, Role, Value', level: 'A', module: 'screenreader' },
];

export interface RuleRow extends Criterion {
  status: RuleStatus;
  issueCount: number;
}

/**
 * A rule fails on any critical or serious issue, has a warning when it only has
 * moderate or minor issues, and passes with none. Rules whose module was switched
 * off, or that no module checks, are "not checked" and left out of the score.
 */
export function buildRuleRows(findings: Finding[], modules: Record<ModuleType, boolean>): RuleRow[] {
  return CRITERIA.map((c) => {
    const issues = findings.filter((f) => f.wcag.sc === c.sc);
    const tested = c.module !== null && modules[c.module];
    let status: RuleStatus = 'passed';
    if (issues.some((f) => f.severity === 'critical' || f.severity === 'serious')) status = 'failure';
    else if (issues.length > 0) status = 'warning';
    else if (!tested) status = 'not-checked';
    return { ...c, status, issueCount: issues.length };
  });
}

export type ScoreLabel = 'Good' | 'Fair' | 'Needs work' | 'Poor';

export interface ScoreResult {
  /** 0-100, or null when no rule was tested. */
  score: number | null;
  label: ScoreLabel | null;
  /** True when the label was lowered because critical issues remain. */
  capped: boolean;
  tested: number;
  passed: number;
  warnings: number;
  failing: number;
}

const labelFor = (score: number): ScoreLabel =>
  score >= 90 ? 'Good' : score >= 70 ? 'Fair' : score >= 50 ? 'Needs work' : 'Poor';

/**
 * Automated checks score: pass = 1 point, warning = 1/2, fail = 0, divided by the
 * rules tested. While any critical issue remains, the label is at best "Needs work".
 */
export function computeScore(rows: RuleRow[], findings: Finding[]): ScoreResult {
  const tested = rows.filter((r) => r.status !== 'not-checked');
  const passed = tested.filter((r) => r.status === 'passed').length;
  const warnings = tested.filter((r) => r.status === 'warning').length;
  const failing = tested.filter((r) => r.status === 'failure').length;
  if (tested.length === 0) {
    return { score: null, label: null, capped: false, tested: 0, passed, warnings, failing };
  }
  const score = Math.round(((passed + warnings * 0.5) / tested.length) * 100);
  let label = labelFor(score);
  let capped = false;
  if (findings.some((f) => f.severity === 'critical') && (label === 'Good' || label === 'Fair')) {
    label = 'Needs work';
    capped = true;
  }
  return { score, label, capped, tested: tested.length, passed, warnings, failing };
}

const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

export interface AffectedGroup {
  people: string;
  barriers: string;
  issueCount: number;
  worst: Severity | null;
  /** False when none of the group's rules were tested. */
  tested: boolean;
}

const GROUPS: { people: string; barriers: string; rules: string[] }[] = [
  { people: 'Screen-reader users', barriers: 'Missing names and text alternatives, unclear links, structure', rules: ['1.1.1', '4.1.2', '2.4.4', '1.3.1'] },
  { people: 'Low-vision users', barriers: 'Text and control contrast', rules: ['1.4.3', '1.4.11', '1.4.1'] },
  { people: 'People with motor impairments', barriers: 'Small tap targets', rules: ['2.5.8'] },
  { people: 'Keyboard-only users', barriers: 'Keyboard access, focus order, visible focus', rules: ['2.1.1', '2.4.3', '2.4.7'] },
];

export function buildAffectedGroups(findings: Finding[], rows: RuleRow[]): AffectedGroup[] {
  return GROUPS.map((g) => {
    const issues = findings.filter((f) => g.rules.includes(f.wcag.sc));
    const worst = SEVERITY_ORDER.find((s) => issues.some((f) => f.severity === s)) ?? null;
    const tested = rows.some((r) => g.rules.includes(r.sc) && r.status !== 'not-checked');
    return { people: g.people, barriers: g.barriers, issueCount: issues.length, worst, tested };
  });
}
