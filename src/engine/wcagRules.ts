import { Finding, UIElementRegion, ExportScale, InputMode } from '../types/finding';
import { suggestAccessibleColor } from './colorUtils';
import { DecileSampleResult } from './decileSampling';
import { resolveThreshold, ElementClass } from './thresholds';
import { evaluateExceptions, TargetBox, ExceptionContext } from './exceptions';

export interface AuditContext {
  inputMode: InputMode;
  exportScale: ExportScale;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface AuditResult {
  findings: Finding[];
  exemptedCount: number;
  exemptedDetails: any[];
}

/**
 * Runs the deterministic WCAG 2.2 audit rules against detected regions and sampled pixels.
 * Strictly adheres to Rules R1, R2, R5, and R7.
 */
export function auditElements(
  regions: UIElementRegion[],
  samples: Map<string, DecileSampleResult>,
  context: AuditContext
): AuditResult {
  const findings: Finding[] = [];
  let exemptedCount = 0;
  const exemptedDetails: any[] = [];
  const scaleMultiplier = context.exportScale === '2x' ? 2 : context.exportScale === '3x' ? 3 : 1;
  const isScaleDeclared = context.exportScale !== 'unknown';

  // 1. Contrast Module (WCAG 1.4.3, 1.4.11)
  regions.forEach((region) => {
    const sample = samples.get(region.id);
    if (!sample || !sample.isSampleable) return;

    let elementClass: ElementClass = 'text';
    if (region.kind === 'heading' && (region.headingLevel === 1 || region.headingLevel === 2)) {
      elementClass = 'largeText';
    } else if (region.kind === 'button' || region.kind === 'input') {
      elementClass = 'uiComponent';
    } else if (region.kind === 'image') {
      elementClass = 'graphicalObject';
    }

    const criterion = (elementClass === 'uiComponent' || elementClass === 'graphicalObject') ? '1.4.11' : '1.4.3';
    
    let threshold;
    try {
      threshold = resolveThreshold(criterion, elementClass);
    } catch (e) {
      return; // Fallback for unmapped or null thresholds
    }

    if (threshold.ratio === null) return;

    const exceptionCtx: ExceptionContext = {
      source: (context.inputMode === 'url' || context.inputMode === 'history') ? 'html' : context.inputMode,
      unitsAreCssPx: isScaleDeclared,
      isDisabled: null, // Hard to infer from static regions without more info, defaults to null
      isLogo: region.kind === 'image' && region.text?.toLowerCase().includes('logo') ? true : null,
      elementKind: region.kind,
    };

    const exceptionVerdict = evaluateExceptions(criterion, { id: region.id, box: region.bbox, isTarget: false, isUndersized: false }, exceptionCtx);

    if (exceptionVerdict.status === 'exempt') {
      exemptedCount++;
      exemptedDetails.push({ id: region.id, rule: criterion, reason: exceptionVerdict.reason });
      return;
    }

    if (sample.ratio < threshold.ratio) {
      const remediation = suggestAccessibleColor(sample.darkestHex, sample.lightestHex, threshold.ratio);

      // Rule R1: Evidence MUST contain the real numbers, compared against resolved threshold
      const evidence = `${sample.ratio.toFixed(2)}:1, needs ${threshold.ratio.toFixed(1)}:1 — ${sample.darkestHex} on ${sample.lightestHex}`;
      
      const isNearMiss = Math.abs(sample.ratio - threshold.ratio) < 0.05;

      findings.push({
        id: `contrast-${region.id}`,
        module: 'contrast',
        severity: sample.ratio < 3.0 ? 'critical' : 'serious',
        confidence: exceptionVerdict.status === 'indeterminate' ? 'predicted' : 'measured',
        confidenceReason: exceptionVerdict.status === 'indeterminate' ? exceptionVerdict.reason : undefined,
        wcag: {
          sc: threshold.sc,
          name: threshold.name,
          level: threshold.level,
          principle: 'Perceivable',
          url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
        },
        target: {
          boundingBox: region.bbox,
          figmaNodePath: region.id,
          snippet: region.text || region.kind,
          elementKind: region.kind,
          htmlTag: region.tag,
          inputType: region.inputType,
          headingLevelInferred: region.headingLevelInferred,
          visibleText: region.text,
          headingLevel: region.headingLevel,
        },
        evidence,
        metric: {
          current: `${sample.ratio.toFixed(2)}:1`,
          required: `${+threshold.ratio.toFixed(1)}:1`,
        },
        swatch: {
          fg: sample.darkestHex,
          bg: sample.lightestHex,
        },
        note: threshold.rationale,
        impact: `Users with low vision or color vision deficiency will have difficulty reading this text against its background.`,
        fix: remediation
          ? `Adjust foreground to ${remediation.suggestedFg} (shift lightness by ${remediation.deltaPercent}%) to achieve ${remediation.ratio.toFixed(2)}:1 contrast while preserving brand hue.`
          : `Increase contrast between foreground and background to at least ${threshold.ratio.toFixed(1)}:1.`,
        remediation: remediation
          ? {
              suggestedFg: remediation.suggestedFg,
              ratio: remediation.ratio,
              explanation: `Darken/lighten by ${remediation.deltaPercent}% to reach ${remediation.ratio.toFixed(2)}:1`,
            }
          : undefined,
        exceptionChecked: true,
        nearMiss: isNearMiss,
      });
    }
  });

  // 2. Structure & Semantics Module (WCAG 1.3.1, 2.5.8, 2.4.6)
  // Check Target Size (WCAG 2.5.8 Target Size Minimum - 24x24 CSS px)
  const canvasW = context.canvasWidth || 800;
  const canvasH = context.canvasHeight || 600;
  
  const allTargets: TargetBox[] = regions
    .filter(r => r.isInteractive || r.kind === 'button' || r.kind === 'input' || r.kind === 'link')
    .map(r => {
       const pixelW = r.bbox.w <= 100 ? (r.bbox.w / 100) * canvasW : r.bbox.w;
       const pixelH = r.bbox.h <= 100 ? (r.bbox.h / 100) * canvasH : r.bbox.h;
       const cssW = Math.round(pixelW / scaleMultiplier);
       const cssH = Math.round(pixelH / scaleMultiplier);
       return {
         id: r.id,
         box: { x: r.bbox.x, y: r.bbox.y, w: cssW, h: cssH },
         isTarget: true,
         isUndersized: cssW < 24 || cssH < 24
       };
    });

  regions.forEach((region) => {
    if (region.isInteractive || region.kind === 'button' || region.kind === 'input' || region.kind === 'link') {
      const targetBox = allTargets.find(t => t.id === region.id);
      if (!targetBox) return;

      if (targetBox.isUndersized) {
        
        const exceptionCtx: ExceptionContext = {
           source: (context.inputMode === 'url' || context.inputMode === 'history') ? 'html' : context.inputMode,
           unitsAreCssPx: isScaleDeclared,
           allTargets,
           isInline: null,
           hasEquivalentControl: null,
           isUserAgentDefault: null,
        };

        const exceptionVerdict = evaluateExceptions('2.5.8', targetBox, exceptionCtx);

        if (exceptionVerdict.status === 'exempt') {
           exemptedCount++;
           exemptedDetails.push({ id: region.id, rule: '2.5.8', reason: exceptionVerdict.reason });
           return;
        }

        // Rule R5: Declared unit shifts confidence from predicted to measured, combined with exception check
        findings.push({
          id: `target-size-${region.id}`,
          module: 'structure',
          severity: 'moderate',
          confidence: isScaleDeclared ? 'measured' : 'predicted',
          confidenceReason: !isScaleDeclared ? 'Export scale unknown; CSS pixel size estimated from raw image pixels.' : (exceptionVerdict.status === 'indeterminate' ? exceptionVerdict.reason : undefined),
          wcag: {
            sc: '2.5.8',
            name: 'Target Size (Minimum)',
            level: 'AA',
            principle: 'Operable',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
          },
          target: {
            boundingBox: region.bbox,
            figmaNodePath: region.id,
          snippet: region.text || region.kind,
            elementKind: region.kind,
            htmlTag: region.tag,
            inputType: region.inputType,
            headingLevelInferred: region.headingLevelInferred,
          },
          evidence: `Target size is ${targetBox.box.w}×${targetBox.box.h} CSS px, fails minimum requirement of 24×24 CSS px`,
          metric: { current: `${targetBox.box.w}×${targetBox.box.h}`, required: '24×24px' },
          impact: `Users with motor impairments or those using touch screens may accidentally activate adjacent elements or fail to tap this target.`,
          fix: `Increase the interactive touch bounding box padding or hit target to at least 24×24 CSS pixels.`,
          exceptionChecked: true,
        });
      }
    }
  });

  // Check Heading Hierarchy (WCAG 1.3.1, 2.4.6)
  const headings = regions
    .filter((r) => r.kind === 'heading')
    .sort((a, b) => a.readingOrder - b.readingOrder);

  let prevLevel = 0;

  headings.forEach((heading, idx) => {
    const level = heading.headingLevel || 2;

    // Check first heading is H1
    if (idx === 0 && level !== 1) {
      findings.push({
        id: `heading-first-not-h1-${heading.id}`,
        module: 'structure',
        severity: 'serious',
        confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
        confidenceReason: context.inputMode !== 'url' ? 'Heading hierarchy inferred from visual font sizing and reading order' : undefined,
        wcag: {
          sc: '1.3.1',
          name: 'Info and Relationships',
          level: 'A',
          principle: 'Perceivable',
          url: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
        },
        target: {
          boundingBox: heading.bbox,
          figmaNodePath: heading.id,
          snippet: heading.text,
          elementKind: 'heading',
          htmlTag: heading.tag,
          headingLevelInferred: heading.headingLevelInferred,
          headingLevel: level,
        },
        evidence: `First heading on page is <h${level}> ("${heading.text}"), expected <h1>`,
        impact: `Screen reader users navigating by headings will lack a primary page title landmark.`,
        fix: `Make the main section title an <h1> before introducing subheadings.`,
      });
    }

    // Check heading level skip (e.g. h1 -> h3)
    if (prevLevel > 0 && level > prevLevel + 1) {
      findings.push({
        id: `heading-skip-${heading.id}`,
        module: 'structure',
        severity: 'moderate',
        confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
        confidenceReason: context.inputMode !== 'url' ? 'Heading hierarchy inferred visually' : undefined,
        wcag: {
          sc: '1.3.1',
          name: 'Info and Relationships',
          level: 'A',
          principle: 'Perceivable',
        },
        target: {
          boundingBox: heading.bbox,
          figmaNodePath: heading.id,
          snippet: heading.text,
          elementKind: 'heading',
          htmlTag: heading.tag,
          headingLevelInferred: heading.headingLevelInferred,
          headingLevel: level,
        },
        evidence: `Heading levels skipped from <h${prevLevel}> directly to <h${level}> ("${heading.text}")`,
        metric: { current: `H${level}`, required: `H${prevLevel + 1}` },
        impact: `Creates a disorienting document outline when navigating via screen reader heading shortcuts (H key).`,
        fix: `Change heading level to <h${prevLevel + 1}> or restructure document outline sequentially.`,
      });
    }
    prevLevel = level;
  });

  // 3. Screen Reader Simulation Findings (WCAG 4.1.2, 1.1.1, 2.4.4)
  regions.forEach((region) => {
    // Check images missing alt or descriptive name (§6C flag announcements reading a filename or generic layer)
    if (region.kind === 'image') {
      const lower = (region.text || '').toLowerCase();
      const isMissingAlt =
        !region.text ||
        lower.includes('image') ||
        lower.includes('rectangle') ||
        lower.includes('group') ||
        lower.includes('frame') ||
        lower.includes('.png') ||
        lower.includes('.jpg') ||
        lower.includes('.svg') ||
        lower.includes('untitled') ||
        lower.includes('asset');
      if (isMissingAlt) {
        findings.push({
          id: `img-missing-alt-${region.id}`,
          module: 'screenreader',
          severity: 'critical',
          confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
          confidenceReason: context.inputMode !== 'url' ? 'No accessibility tree in design file; name inferred from visible label' : undefined,
          wcag: {
            sc: '1.1.1',
            name: 'Non-text Content',
            level: 'A',
            principle: 'Perceivable',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
          },
          target: {
            boundingBox: region.bbox,
            figmaNodePath: region.id,
            snippet: region.text || '<img>',
            elementKind: 'image',
            htmlTag: region.tag,
            inputType: region.inputType,
            headingLevelInferred: region.headingLevelInferred,
          },
          evidence: `Image announces as "${region.text || 'Unlabeled graphic'}" without meaningful alternative text`,
          impact: `Screen reader users will not understand the purpose or content of this graphic.`,
          fix: `Provide concise, descriptive alternative text (alt="...") or mark as decorative (alt="" / aria-hidden="true").`,
        });
      }
    }

    // Check generic/unlabeled buttons
    if (region.kind === 'button') {
      const isGeneric = !region.text || region.text.trim() === '' || region.text.toLowerCase().includes('button') || region.text.toLowerCase().includes('rectangle') || region.text.toLowerCase().includes('icon');
      if (isGeneric) {
        findings.push({
          id: `btn-unlabeled-${region.id}`,
          module: 'screenreader',
          severity: 'critical',
          confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
          confidenceReason: context.inputMode !== 'url' ? 'Inferred from visible text and layer structure' : undefined,
          wcag: {
            sc: '4.1.2',
            name: 'Name, Role, Value',
            level: 'A',
            principle: 'Robust',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
          },
          aria: 'WAI-ARIA 1.2 button accessible name computation',
          target: {
            boundingBox: region.bbox,
            figmaNodePath: region.id,
            snippet: region.text || '<button>',
            elementKind: 'button',
            htmlTag: region.tag,
            inputType: region.inputType,
            headingLevelInferred: region.headingLevelInferred,
          },
          evidence: `Button announces role with empty accessible name ("button, [empty]")`,
          impact: `Blind users using screen readers cannot discern what action this button will perform.`,
          fix: `Add visible text or aria-label describing the exact action (e.g. aria-label="Close dialog" or aria-label="Search").`,
        });
      }
    }

    // Check ambiguous link text (WCAG 2.4.4)
    if (region.kind === 'link') {
      const lower = (region.text || '').toLowerCase().trim();
      const ambiguousTerms = ['click here', 'read more', 'learn more', 'more', 'link', 'here', 'details'];
      if (ambiguousTerms.includes(lower)) {
        findings.push({
          id: `link-purpose-${region.id}`,
          module: 'screenreader',
          severity: 'serious',
          confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
          confidenceReason: context.inputMode !== 'url' ? 'Inferred from visible text' : undefined,
          wcag: {
            sc: '2.4.4',
            name: 'Link Purpose (In Context)',
            level: 'A',
            principle: 'Perceivable',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
          },
          target: {
            boundingBox: region.bbox,
            figmaNodePath: region.id,
            snippet: region.text,
            elementKind: 'link',
            htmlTag: region.tag,
            inputType: region.inputType,
            headingLevelInferred: region.headingLevelInferred,
          },
          evidence: `Ambiguous link text "${region.text}" provides no destination context in link lists`,
          impact: `When screen reader users navigate using link list dialogs (rotor/elements list), all instances sound identical.`,
          fix: `Provide meaningful link text specifying destination (e.g., "Read more about WCAG guidelines").`,
        });
      }
    }
  });

  // 4. Keyboard & Focus Order Module (WCAG 2.1.1, 2.4.3, 2.4.7)
  const interactiveRegions = regions
    .filter((r) => r.isInteractive || r.kind === 'button' || r.kind === 'input' || r.kind === 'link')
    .sort((a, b) => a.readingOrder - b.readingOrder);

  interactiveRegions.forEach((region, index) => {
    // Check for focus visible (Rule R2: on live DOM or static snapshot, focus visible is predicted from resting styles)
    if (region.hasVisibleFocus === false) {
      findings.push({
        id: `focus-visible-${region.id}`,
        module: 'keyboard',
        severity: 'serious',
        confidence: 'predicted',
        confidenceReason: 'Computed from resting styles; static snapshots never enter :focus runtime state.',
        wcag: {
          sc: '2.4.7',
          name: 'Focus Visible',
          level: 'AA',
          principle: 'Operable',
          url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
        },
        target: {
          boundingBox: region.bbox,
          figmaNodePath: region.id,
          snippet: region.text || region.kind,
          elementKind: region.kind,
          htmlTag: region.tag,
          inputType: region.inputType,
          headingLevelInferred: region.headingLevelInferred,
        },
        evidence: `Interactive element lacks distinct high-contrast focus indicator border or outline`,
        impact: `Keyboard users will lose track of their position on the page when tabbing through controls.`,
        fix: `Implement a distinct, high-contrast :focus-visible outline (minimum 2px solid with 3:1 contrast against adjacent background).`,
      });
    }

    // Check for click handler on non-interactive element or tab order anomaly
    if (region.hasOnClickWithoutKeyboard) {
      findings.push({
        id: `keyboard-div-onclick-${region.id}`,
        module: 'keyboard',
        severity: 'critical',
        confidence: context.inputMode === 'url' ? 'measured' : 'predicted',
        confidenceReason: context.inputMode !== 'url' ? 'Inferred from interactive mockup intent' : undefined,
        wcag: {
          sc: '2.1.1',
          name: 'Keyboard',
          level: 'A',
          principle: 'Operable',
          url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
        },
        target: {
          boundingBox: region.bbox,
          figmaNodePath: region.id,
          snippet: region.text || region.kind,
          elementKind: region.kind,
          htmlTag: region.tag,
          inputType: region.inputType,
          headingLevelInferred: region.headingLevelInferred,
        },
        evidence: `<div onClick> or custom control without tabindex="0" or Enter/Space keyboard event listeners`,
        impact: `Keyboard-only and switch-control users cannot reach or trigger this action.`,
        fix: `Use a native <button> element or add tabindex="0" with onKeyDown handlers for Enter and Space keys.`,
      });
    }

    // Detect unnatural focus order jumping
    if (index > 0) {
      const prev = interactiveRegions[index - 1];
      const yDist = region.bbox.y - prev.bbox.y;
      // If order jumps far backwards up the screen unexpectedly
      if (yDist < -20 && region.bbox.x < prev.bbox.x) {
        findings.push({
          id: `focus-order-jump-${region.id}`,
          module: 'keyboard',
          severity: 'moderate',
          confidence: 'predicted',
          confidenceReason: 'Focus order predicted from visual geometry graph traversal.',
          wcag: {
            sc: '2.4.3',
            name: 'Focus Order',
            level: 'A',
            principle: 'Operable',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
          },
          target: {
            boundingBox: region.bbox,
            figmaNodePath: region.id,
          snippet: region.text || region.kind,
            elementKind: region.kind,
            htmlTag: region.tag,
            inputType: region.inputType,
            headingLevelInferred: region.headingLevelInferred,
          },
          evidence: `Focus path jumps upwards from stop #${index + 1} to #${index + 2} breaking natural reading flow`,
          impact: `Users navigating via Tab key experience disorientation as focus leaps across layout regions.`,
          fix: `Align DOM / layout source order with visual reading flow or check prototype connection order.`,
        });
      }
    }
  });

  return { findings, exemptedCount, exemptedDetails };
}
