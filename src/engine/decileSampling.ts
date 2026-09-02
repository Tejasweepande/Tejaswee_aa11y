import { RGB, getRelativeLuminance, rgbToHex, getContrastRatio } from './colorUtils';
import { BoundingBox } from '../types/finding';

export interface DecileSampleResult {
  darkestDecileRgb: RGB;
  lightestDecileRgb: RGB;
  darkestHex: string;
  lightestHex: string;
  ratio: number;
  spread: number;
  isSampleable: boolean;
  sampleCount: number;
}

/**
 * Samples pixel color pairs using the Decile-Core method from GEMINI.md §4B.
 * 
 * Takes an ImageData / region of an HTMLCanvasElement, computes relative luminance
 * for every pixel, sorts by luminance, and averages the darkest 10% and lightest 10%.
 * Antialiased pixels in the middle 80% are ignored, eliminating glyph-edge bias.
 */
export function sampleDecileCore(
  ctx: CanvasRenderingContext2D,
  bbox: BoundingBox,
  canvasWidth: number,
  canvasHeight: number
): DecileSampleResult | null {
  // Convert percentage bbox (0-100) or pixel bbox to canvas coordinate space
  const x = bbox.x <= 100 && bbox.w <= 100 ? Math.round((bbox.x / 100) * canvasWidth) : Math.round(bbox.x);
  const y = bbox.y <= 100 && bbox.h <= 100 ? Math.round((bbox.y / 100) * canvasHeight) : Math.round(bbox.y);
  const w = bbox.x <= 100 && bbox.w <= 100 ? Math.max(2, Math.round((bbox.w / 100) * canvasWidth)) : Math.max(2, Math.round(bbox.w));
  const h = bbox.y <= 100 && bbox.h <= 100 ? Math.max(2, Math.round((bbox.h / 100) * canvasHeight)) : Math.max(2, Math.round(bbox.h));

  // Clamp within canvas boundaries
  const safeX = Math.max(0, Math.min(canvasWidth - 1, x));
  const safeY = Math.max(0, Math.min(canvasHeight - 1, y));
  const safeW = Math.max(1, Math.min(canvasWidth - safeX, w));
  const safeH = Math.max(1, Math.min(canvasHeight - safeY, h));

  if (safeW < 2 || safeH < 2) {
    return null;
  }

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(safeX, safeY, safeW, safeH);
  } catch (err) {
    console.warn('Canvas getImageData failed (possibly tainted canvas)', err);
    return null;
  }

  const { data } = imageData;
  const pixels: { r: number; g: number; b: number; a: number; lum: number }[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] / 255;

    // Skip fully transparent pixels
    if (a < 0.05) continue;

    const rgb: RGB = { r, g, b, a };
    const lum = getRelativeLuminance(rgb);
    pixels.push({ r, g, b, a, lum });
  }

  if (pixels.length < 10) {
    return null;
  }

  // Sort pixels ascending by luminance
  pixels.sort((a, b) => a.lum - b.lum);

  const total = pixels.length;
  const decileSize = Math.max(1, Math.floor(total * 0.1));

  // Darkest 10% (bottom decile)
  const bottomDecile = pixels.slice(0, decileSize);
  let darkR = 0, darkG = 0, darkB = 0;
  for (const p of bottomDecile) {
    darkR += p.r;
    darkG += p.g;
    darkB += p.b;
  }
  const darkestDecileRgb: RGB = {
    r: Math.round(darkR / decileSize),
    g: Math.round(darkG / decileSize),
    b: Math.round(darkB / decileSize),
  };

  // Lightest 10% (top decile)
  const topDecile = pixels.slice(total - decileSize);
  let lightR = 0, lightG = 0, lightB = 0;
  for (const p of topDecile) {
    lightR += p.r;
    lightG += p.g;
    lightB += p.b;
  }
  const lightestDecileRgb: RGB = {
    r: Math.round(lightR / decileSize),
    g: Math.round(lightG / decileSize),
    b: Math.round(lightB / decileSize),
  };

  const darkestLum = getRelativeLuminance(darkestDecileRgb);
  const lightestLum = getRelativeLuminance(lightestDecileRgb);
  const spread = Math.abs(lightestLum - darkestLum);

  // If luminance spread is under 0.012, region is solid/uniform and unsampleable (§4B)
  const isSampleable = spread >= 0.012;

  const ratio = getContrastRatio(darkestDecileRgb, lightestDecileRgb);
  const darkestHex = rgbToHex(darkestDecileRgb.r, darkestDecileRgb.g, darkestDecileRgb.b);
  const lightestHex = rgbToHex(lightestDecileRgb.r, lightestDecileRgb.g, lightestDecileRgb.b);

  return {
    darkestDecileRgb,
    lightestDecileRgb,
    darkestHex,
    lightestHex,
    ratio,
    spread,
    isSampleable,
    sampleCount: pixels.length,
  };
}
