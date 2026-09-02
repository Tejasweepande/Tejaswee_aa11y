// WCAG 2.2 Luminance and Contrast Calculations (Rule R1: 100% deterministic code)

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Converts a hex string (#RGB, #RRGGBB, #RRGGBBAA) to RGB
 */
export function hexToRgb(hex: string): RGB {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 8) {
    const num = parseInt(clean, 16);
    return {
      r: (num >> 24) & 255,
      g: (num >> 16) & 255,
      b: (num >> 8) & 255,
      a: (num & 255) / 255,
    };
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: 1,
  };
}

/**
 * Converts RGB to hex string (#RRGGBB)
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * WCAG 2.2 sRGB gamma linearization
 */
function sRgbToLinear(c: number): number {
  const cNorm = c / 255;
  return cNorm <= 0.04045 ? cNorm / 12.92 : Math.pow((cNorm + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.2 Relative Luminance Formula
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function getRelativeLuminance(rgb: RGB): number {
  const rLin = sRgbToLinear(rgb.r);
  const gLin = sRgbToLinear(rgb.g);
  const bLin = sRgbToLinear(rgb.b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * WCAG 2.2 Contrast Ratio Formula
 * (L1 + 0.05) / (L2 + 0.05)
 */
export function getContrastRatio(color1: string | RGB, color2: string | RGB): number {
  const rgb1 = typeof color1 === 'string' ? hexToRgb(color1) : color1;
  const rgb2 = typeof color2 === 'string' ? hexToRgb(color2) : color2;

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);

  const ratio = (l1 + 0.05) / (l2 + 0.05);
  // Round to 2 decimal places deterministically
  return Math.round(ratio * 100) / 100;
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: 1,
  };
}

/**
 * Bounded-Hue Accessible Colour Suggestion (§7 in GEMINI.md)
 * Adjusts lightness while preserving hue within ±0° to prevent changing brand identity.
 */
export function suggestAccessibleColor(
  fgHex: string,
  bgHex: string,
  targetRatio: number = 4.5
): { suggestedFg: string; ratio: number; deltaPercent: number } | null {
  const fgRgb = hexToRgb(fgHex);
  const bgRgb = hexToRgb(bgHex);
  const bgLum = getRelativeLuminance(bgRgb);
  const fgHsl = rgbToHsl(fgRgb);

  // If already passing
  const currentRatio = getContrastRatio(fgRgb, bgRgb);
  if (currentRatio >= targetRatio) {
    return { suggestedFg: fgHex, ratio: currentRatio, deltaPercent: 0 };
  }

  // Determine whether to darken or lighten based on background luminance
  const shouldDarken = bgLum > 0.2;

  if (shouldDarken) {
    // Darken lightness from current down to 0
    for (let l = fgHsl.l; l >= 0; l -= 0.5) {
      const candidateRgb = hslToRgb({ ...fgHsl, l });
      const ratio = getContrastRatio(candidateRgb, bgRgb);
      if (ratio >= targetRatio) {
        const delta = Math.round(Math.abs(fgHsl.l - l));
        return {
          suggestedFg: rgbToHex(candidateRgb.r, candidateRgb.g, candidateRgb.b),
          ratio,
          deltaPercent: delta,
        };
      }
    }
  } else {
    // Lighten lightness from current up to 100
    for (let l = fgHsl.l; l <= 100; l += 0.5) {
      const candidateRgb = hslToRgb({ ...fgHsl, l });
      const ratio = getContrastRatio(candidateRgb, bgRgb);
      if (ratio >= targetRatio) {
        const delta = Math.round(Math.abs(l - fgHsl.l));
        return {
          suggestedFg: rgbToHex(candidateRgb.r, candidateRgb.g, candidateRgb.b),
          ratio,
          deltaPercent: delta,
        };
      }
    }
  }

  return null;
}
