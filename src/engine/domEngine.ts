import { UIElementRegion, BoundingBox } from '../types/finding';
import { DecileSampleResult } from './decileSampling';
import { RGB, rgbToHex, getContrastRatio } from './colorUtils';

/**
 * Parses a CSS color string like rgb(255, 0, 0) or rgba(0, 0, 0, 0.5) into RGB object
 */
function parseCssColor(colorStr: string): RGB {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 }; // Default to white if unparseable or 'transparent'
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

/**
 * Composites a foreground color over a background color
 */
function compositeColors(fg: RGB, bg: RGB): RGB {
  if (fg.a === 1 || fg.a === undefined) return { ...fg, a: 1 };
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/**
 * Walks up the DOM to resolve the true opaque background color of an element
 */
function getResolvedBackgroundColor(element: Element): RGB {
  let current: Element | null = element;
  let bgRgb: RGB | null = null;

  while (current) {
    const style = window.getComputedStyle(current);
    const bgColorStr = style.backgroundColor;
    if (bgColorStr && bgColorStr !== 'rgba(0, 0, 0, 0)' && bgColorStr !== 'transparent') {
      const parsedBg = parseCssColor(bgColorStr);
      if (bgRgb) {
        bgRgb = compositeColors(bgRgb, parsedBg);
      } else {
        bgRgb = parsedBg;
      }
      if (bgRgb.a === 1) break;
    }
    current = current.parentElement;
  }

  // Default to white if we reach the top and it's still transparent
  if (!bgRgb || (bgRgb.a !== undefined && bgRgb.a < 1)) {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    bgRgb = bgRgb ? compositeColors(bgRgb, white) : white;
  }
  return bgRgb;
}

/**
 * DOM extraction pipeline for Live URL mode (Phase 3).
 * Extracts elements, computes bounding boxes (relative to iframe), and reads computed styles.
 */
export function extractFromDOM(
  doc: Document,
  iframeRect: { width: number; height: number }
): { regions: UIElementRegion[]; samples: Map<string, DecileSampleResult> } {
  const regions: UIElementRegion[] = [];
  const samples = new Map<string, DecileSampleResult>();

  // Use a TreeWalker to find all text-containing elements and interactive elements
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node: Element) => {
      const tag = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'meta', 'link', 'svg', 'path'].includes(tag)) return NodeFilter.FILTER_REJECT;
      
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return NodeFilter.FILTER_REJECT;
      }

      // Accept interactive elements
      if (['a', 'button', 'input', 'select', 'textarea'].includes(tag) || node.getAttribute('role') === 'button' || node.hasAttribute('tabindex')) {
        return NodeFilter.FILTER_ACCEPT;
      }

      // Accept headings
      if (/^h[1-6]$/.test(tag)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      // Accept elements that contain direct text
      const hasDirectText = Array.from(node.childNodes).some(
        child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim().length! > 0
      );
      if (hasDirectText) return NodeFilter.FILTER_ACCEPT;

      return NodeFilter.FILTER_SKIP;
    }
  });

  let node = walker.nextNode() as Element;
  let order = 1;

  while (node) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const bbox: BoundingBox = {
        x: (rect.left / iframeRect.width) * 100,
        y: (rect.top / iframeRect.height) * 100,
        w: (rect.width / iframeRect.width) * 100,
        h: (rect.height / iframeRect.height) * 100,
      };

      const tag = node.tagName.toLowerCase();
      let kind: UIElementRegion['kind'] = 'text';
      let headingLevel = undefined;
      let isInteractive = false;

      if (tag === 'a') { kind = 'link'; isInteractive = true; }
      else if (tag === 'button' || node.getAttribute('role') === 'button') { kind = 'button'; isInteractive = true; }
      else if (['input', 'select', 'textarea'].includes(tag)) { kind = 'input'; isInteractive = true; }
      else if (/^h([1-6])$/.test(tag)) {
        kind = 'heading';
        headingLevel = parseInt(tag[1], 10);
      }

      const tabindexAttr = node.getAttribute('tabindex');
      if (tabindexAttr && !isNaN(parseInt(tabindexAttr, 10))) {
        isInteractive = true;
      }

      const text = (node.getAttribute('aria-label') || node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);

      const regionId = `dom-${order}`;
      const region: UIElementRegion = {
        id: regionId,
        kind,
        text: text || tag,
        bbox,
        readingOrder: order,
        isInteractive,
        role: node.getAttribute('role') || kind,
        headingLevel,
        tag,
        inputType: tag === 'input' ? (node.getAttribute('type') || 'text').toLowerCase() : undefined,
      };

      // -------------------------------------------------------------
      // Deterministic Contrast Calculation via Computed Styles
      // -------------------------------------------------------------
      const style = window.getComputedStyle(node);
      const fgColorStr = style.color;
      let fgRgb = parseCssColor(fgColorStr);
      const bgRgb = getResolvedBackgroundColor(node);

      // Composite foreground over background if foreground is translucent
      fgRgb = compositeColors(fgRgb, bgRgb);

      const darkestHex = rgbToHex(fgRgb.r, fgRgb.g, fgRgb.b);
      const lightestHex = rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b);
      
      // Determine contrast ratio based on luminance
      const ratio = getContrastRatio(fgRgb, bgRgb);

      samples.set(regionId, {
        darkestDecileRgb: fgRgb, 
        lightestDecileRgb: bgRgb,
        darkestHex: darkestHex,
        lightestHex: lightestHex,
        ratio,
        spread: 0,
        isSampleable: true,
        sampleCount: 1,
      });

      regions.push(region);
      order++;
    }
    node = walker.nextNode() as Element;
  }

  // Sort regions by visual reading order
  regions.sort((a, b) => {
    if (Math.abs(a.bbox.y - b.bbox.y) > 2) {
      return a.bbox.y - b.bbox.y;
    }
    return a.bbox.x - b.bbox.x;
  });

  // Re-assign reading order after sort
  regions.forEach((r, idx) => { r.readingOrder = idx + 1; });

  return { regions, samples };
}
