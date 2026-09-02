import { getContrastRatio, getRelativeLuminance, hexToRgb, suggestAccessibleColor } from '../src/engine/colorUtils';
import { auditElements } from '../src/engine/wcagRules';
import { SAMPLE_MOCKUPS } from '../src/data/sampleMockups';
import { salvageJsonArray } from '../src/adapters/imageAdapter';
import { buildScreenReaderItems } from '../src/engine/screenReaderEngine';
import { DecileSampleResult } from '../src/engine/decileSampling';
import { resolveThreshold, ElementClass } from '../src/engine/thresholds';
import { evaluateExceptions, TargetBox, ExceptionContext } from '../src/engine/exceptions';
console.log('🧪 Starting A11y Lab Verification Test Suite...\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} — ${detail || ''}`);
    failCount++;
  }
}

// TEST 1: Rule R1 Known Contrast Anchors
console.log('--- 1. Contrast Math & Luminance Anchors (Rule R1) ---');
const ratioBlackWhite = getContrastRatio('#000000', '#FFFFFF');
assert(ratioBlackWhite === 21.0, 'Black on White is 21.00:1', `Got ${ratioBlackWhite}`);

const ratioNearMiss = getContrastRatio('#777777', '#FFFFFF');
assert(ratioNearMiss === 4.48, '#777777 on White is 4.48:1 (Near-miss fails 4.5:1 by 0.02)', `Got ${ratioNearMiss}`);

const ratio8A8A8A = getContrastRatio('#8A8A8A', '#FFFFFF');
assert(ratio8A8A8A === 3.45, '#8A8A8A on White is 3.45:1 (Matches ground truth exactly per §4B)', `Got ${ratio8A8A8A}`);

// TEST 2: Bounded Hue Color Remediation Engine (§7 in GEMINI.md)
console.log('\n--- 2. Bounded Hue Color Remediation Engine ---');
const fix8A = suggestAccessibleColor('#8A8A8A', '#FFFFFF', 4.5);
assert(fix8A !== null && fix8A.ratio >= 4.5, 'Remediation adjusts #8A8A8A to clear >= 4.5:1', `Suggested: ${fix8A?.suggestedFg} with ratio ${fix8A?.ratio}`);

// TEST 3: Truncated JSON Salvage Parser (§4B in GEMINI.md)
console.log('\n--- 3. Truncated JSON Salvage Parser ---');
const truncatedJson = `[{"k":"heading","t":"Title","b":[0,0,50,10],"h":1,"o":1},{"k":"button","t":"Save","b":[0,20,30,10],"o":2},{"k":"input","t":"Email"`;
const salvaged = salvageJsonArray(truncatedJson);
assert(salvaged.length === 2, 'Salvaged 2 complete objects from truncated LLM response', `Got ${salvaged.length} items`);

// TEST 4: Full Acceptance Criteria on Broken SaaS Demo
console.log('\n--- 4. Full Audit on Deliberately Broken SaaS Demo Mockup ---');
const brokenMockup = SAMPLE_MOCKUPS.find((s) => s.id === 'broken-saas')!;
const sampleMap = new Map<string, DecileSampleResult>();

// Mock decile core results for text elements
sampleMap.set('broken-btn-lowcontrast', {
  darkestDecileRgb: hexToRgb('#999999'),
  lightestDecileRgb: hexToRgb('#FFFFFF'),
  darkestHex: '#999999',
  lightestHex: '#FFFFFF',
  ratio: 2.87,
  spread: 0.7,
  isSampleable: true,
  sampleCount: 1200,
});

sampleMap.set('broken-nearmiss-01', {
  darkestDecileRgb: hexToRgb('#777777'),
  lightestDecileRgb: hexToRgb('#FFFFFF'),
  darkestHex: '#777777',
  lightestHex: '#FFFFFF',
  ratio: 4.48,
  spread: 0.7,
  isSampleable: true,
  sampleCount: 800,
});

const { findings } = auditElements(brokenMockup.regions, sampleMap, {
  inputMode: 'image',
  exportScale: '1x',
  canvasWidth: 800,
  canvasHeight: 600,
});

assert(findings.some((f) => f.id.includes('broken-btn-lowcontrast')), 'Catches low-contrast button (#999999 on #FFFFFF = 2.87:1, fails 3.0:1 UI Component threshold)');
assert(findings.some((f) => f.id.includes('broken-nearmiss-01')), 'Catches near-miss 4.48:1 contrast failure');
assert(findings.some((f) => f.id.includes('broken-btn-undersized')), 'Catches undersized 20x20px hit target (< 24x24 CSS px)');
assert(findings.some((f) => f.id.includes('broken-head-01')), 'Catches first heading on page is not H1');
assert(findings.some((f) => f.id.includes('broken-subhead-02')), 'Catches skipped heading level hierarchy');
assert(findings.some((f) => f.id.includes('broken-link-ambiguous')), 'Catches ambiguous link text ("Click here")');
assert(findings.some((f) => f.id.includes('broken-div-onclick')), 'Catches non-interactive div with onClick handler');
assert(findings.some((f) => f.id.includes('broken-img-unlabeled')), 'Catches image with missing/generic alt text');
assert(findings.some((f) => f.id.includes('broken-btn-undersized') && f.module === 'screenreader'), 'Catches button announcing generic layer name "Rectangle 47"');

// TEST 5: Rule R5 Export Scale State Shift
console.log('\n--- 5. Rule R5 Export Scale Shift ---');
const { findings: findingsUnknownScale } = auditElements(brokenMockup.regions, sampleMap, {
  inputMode: 'image',
  exportScale: 'unknown',
  canvasWidth: 800,
  canvasHeight: 600,
});
const targetFindingUnknown = findingsUnknownScale.find((f) => f.id.includes('broken-btn-undersized'));
assert(targetFindingUnknown?.confidence === 'predicted', 'Target size is Predicted when Export Scale is Unknown (Rule R5)');

const { findings: findings1xScale } = auditElements(brokenMockup.regions, sampleMap, {
  inputMode: 'image',
  exportScale: '1x',
  canvasWidth: 800,
  canvasHeight: 600,
});
const targetFinding1x = findings1xScale.find((f) => f.id.includes('broken-btn-undersized'));
assert(targetFinding1x?.confidence === 'measured', 'Target size flips to Measured when Export Scale is declared (Rule R5)');

// TEST 6: Screen Reader Simulation Sequence
console.log('\n--- 6. Screen Reader Speech Simulation Items ---');
const srItems = buildScreenReaderItems(brokenMockup.regions);
assert(srItems.length === brokenMockup.regions.length, `Generated ${srItems.length} screen reader phrases`);
assert(srItems.some((item) => item.isProblematic && item.spokenPhrase.includes('Rectangle 47')), 'Screen reader flags generic layer name "Rectangle 47"');

// TEST 7: Threshold Engine
console.log('\n--- 7. Threshold Engine (resolveThreshold) ---');
assert(resolveThreshold('1.4.3', 'text').ratio === 4.5, 'Normal text threshold is 4.5:1');
assert(resolveThreshold('1.4.3', 'largeText').ratio === 3.0, 'Large text threshold is 3.0:1');
assert(resolveThreshold('1.4.11', 'uiComponent').ratio === 3.0, 'UI component threshold is 3.0:1');
assert(resolveThreshold('1.4.11', 'decorative').ratio === null, 'Decorative element threshold is null');

// TEST 8: Exception Engine
console.log('\n--- 8. Exception Engine (evaluateExceptions) ---');
const btn1: TargetBox = { id: 'btn1', box: { x: 0, y: 0, w: 20, h: 20 }, isTarget: true, isUndersized: true };
const btn2: TargetBox = { id: 'btn2', box: { x: 30, y: 0, w: 20, h: 20 }, isTarget: true, isUndersized: true }; // Centered at 40,10. Distance to btn1 center (10,10) is 30.
const ctxSpaced: ExceptionContext = { source: 'html', unitsAreCssPx: true, allTargets: [btn1, btn2] };
assert(evaluateExceptions('2.5.8', btn1, ctxSpaced).status === 'exempt', 'Exempted due to spacing exception (>24px clearance)');

const btn3: TargetBox = { id: 'btn3', box: { x: 15, y: 0, w: 20, h: 20 }, isTarget: true, isUndersized: true }; // Centered at 25,10. Distance to btn1 center (10,10) is 15 (<24).
const ctxClustered: ExceptionContext = { source: 'html', unitsAreCssPx: true, allTargets: [btn1, btn3] };
assert(evaluateExceptions('2.5.8', btn1, ctxClustered).status === 'applies', 'Exception does not apply (elements too close)');

const ctxLogo: ExceptionContext = { source: 'html', unitsAreCssPx: true, isLogo: true };
assert(evaluateExceptions('1.4.3', btn1, ctxLogo).status === 'indeterminate', 'Logotype exception returns indeterminate');

const ctxDisabled: ExceptionContext = { source: 'html', unitsAreCssPx: true, isDisabled: true };
assert(evaluateExceptions('1.4.3', btn1, ctxDisabled).status === 'exempt', 'Disabled component returns exempt from contrast');
console.log(`\n========================================`);
console.log(`Verification Complete: ${passCount} Passed, ${failCount} Failed`);
console.log(`========================================\n`);

if (failCount > 0) process.exit(1);
