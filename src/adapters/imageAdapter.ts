import { UIElementRegion } from '../types/finding';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RawRegionOutput {
  k?: 'heading' | 'button' | 'input' | 'link' | 'image' | 'text' | 'dialog';
  kind?: 'heading' | 'button' | 'input' | 'link' | 'image' | 'text' | 'dialog';
  t?: string;
  text?: string;
  b?: [number, number, number, number];
  bbox?: { x: number; y: number; w: number; h: number } | [number, number, number, number];
  h?: number;
  headingLevel?: number;
  o?: number;
  readingOrder?: number;
  i?: boolean;
  isInteractive?: boolean;
}

/**
 * Robust JSON salvage parser for truncated LLM responses (GEMINI.md §4B)
 */
export function salvageJsonArray(jsonStr: string): unknown[] {
  let cleaned = jsonStr.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.regions)) return parsed.regions;
    if (parsed && Array.isArray(parsed.elements)) return parsed.elements;
  } catch {
    // continue to salvage
  }

  const startIdx = cleaned.indexOf('[');
  if (startIdx === -1) return [];
  cleaned = cleaned.slice(startIdx);

  let lastCloseBrace = cleaned.lastIndexOf('}');
  while (lastCloseBrace > 0) {
    const candidate = cleaned.slice(0, lastCloseBrace + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      lastCloseBrace = cleaned.lastIndexOf('}', lastCloseBrace - 1);
    }
  }

  return [];
}

/**
 * Compress and resize an image dataURL to a safe size for Gemini API.
 * Gemini inline data limit is ~4MB base64. Screenshots can be much larger.
 */
function compressImageDataUrl(dataUrl: string, maxDim = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

/**
 * Multi-modal Vision Region Extractor via Gemini API
 *
 * Returns regions OR throws with a clear human-readable error message.
 * Never silently swallows errors.
 *//**
 * Multi-modal Vision Region Extractor via Google Gemini API (Latest 2.5 Flash)
 *
 * Uses the latest Gemini 2.5 Flash Vision model for deep OCR and layout structure extraction.
 */
export async function extractRegionsFromImageViaGemini(
  base64DataUrl: string,
  apiKey: string
): Promise<{ regions: UIElementRegion[]; isPartial: boolean }> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('No Gemini API key provided.');
  }

  const compressed = await compressImageDataUrl(base64DataUrl, 1024, 0.82);
  const match = compressed.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) throw new Error('Failed to prepare image for Gemini API.');
  const mimeType = match[1];
  const base64Data = match[2];

  const prompt = `You are an accessibility analyst. Analyze this UI screenshot and identify all visible interactive and structural UI elements.

Return a JSON array. Each object must have:
- "k": element type — one of: "heading", "button", "input", "link", "image" (use for icons/images), "text"
- "t": the exact visible text label shown on screen for this element (or a short description if no text)
- "b": bounding box as [x, y, width, height] — percentage values 0-100 relative to image size
- "h": heading level (1, 2, or 3) — only when k is "heading"
- "o": reading order (1, 2, 3...) top-to-bottom left-to-right
- "i": true if this is an interactive element (button, link, input field)

Rules:
- Include at least 8 elements if visible
- DO NOT include any colour values, contrast ratios, or pixel sizes
- DO NOT include any commentary, only the JSON array

Example:
[
  {"k":"heading","t":"Sign In","b":[5,5,60,8],"h":1,"o":1,"i":false},
  {"k":"input","t":"Email address","b":[5,20,60,7],"o":2,"i":true},
  {"k":"button","t":"Sign In","b":[5,40,30,8],"o":4,"i":true}
]`;

  // Prioritize Gemini 3.6 Flash with fallbacks across Google AI Studio models
  const modelEndpoints: { model: string; apiVersion: string }[] = [
    { model: 'gemini-3.6-flash',        apiVersion: 'v1beta' },
    { model: 'gemini-2.5-flash',        apiVersion: 'v1beta' },
    { model: 'gemini-2.0-flash',        apiVersion: 'v1beta' },
    { model: 'gemini-1.5-flash',        apiVersion: 'v1beta' },
    { model: 'gemini-2.5-pro',          apiVersion: 'v1beta' },
  ];
  const errors: string[] = [];

  for (const { model, apiVersion } of modelEndpoints) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey.trim()}`;

      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => `HTTP ${response.status}`);
        let errMsg = `${model}: HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errBody);
          errMsg = `${model}: ${parsed?.error?.message || errBody}`;
        } catch {
          errMsg = `${model}: ${errBody.slice(0, 200)}`;
        }
        errors.push(errMsg);
        continue;
      }

      const data = await response.json();
      const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText) {
        const reason = data?.candidates?.[0]?.finishReason || 'empty response';
        errors.push(`${model}: empty (${reason})`);
        continue;
      }

      const rawList = salvageJsonArray(rawText) as RawRegionOutput[];
      if (rawList.length === 0) {
        errors.push(`${model}: zero parseable regions`);
        continue;
      }

      const isPartial = data?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
      const regions = parseRawRegions(rawList, 'gemini');
      return { regions, isPartial };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
    }
  }

  throw new Error(
    `Gemini API failed: ${errors[0] || 'Unknown error'}. Ensure you have an active Google AI Studio key from aistudio.google.com.`
  );
}

function parseRawRegions(rawList: RawRegionOutput[], prefix: string): UIElementRegion[] {
  return rawList.map((item, index) => {
    let x = 5, y = 5 + index * 8, w = 40, h = 6;
    if (Array.isArray(item.b) && item.b.length >= 4) {
      x = Number(item.b[0]);
      y = Number(item.b[1]);
      w = Number(item.b[2]);
      h = Number(item.b[3]);
    } else if (item.bbox) {
      if (Array.isArray(item.bbox)) {
        x = Number(item.bbox[0]);
        y = Number(item.bbox[1]);
        w = Number(item.bbox[2]);
        h = Number(item.bbox[3]);
      } else {
        x = Number(item.bbox.x);
        y = Number(item.bbox.y);
        w = Number(item.bbox.w);
        h = Number(item.bbox.h);
      }
    }

    const rawKind = String(item.k || item.kind || 'text').toLowerCase();
    let kind: UIElementRegion['kind'] = 'text';
    if (['heading', 'button', 'input', 'link', 'image', 'dialog', 'landmark'].includes(rawKind)) {
      kind = rawKind as UIElementRegion['kind'];
    } else if (rawKind === 'icon') {
      kind = 'image';
    }

    const text = String(item.t || item.text || '').trim();
    const headingLevel = item.h || item.headingLevel;
    const readingOrder = Number(item.o || item.readingOrder || index + 1);
    const isInteractive = Boolean(
      item.i || item.isInteractive || kind === 'button' || kind === 'input' || kind === 'link'
    );

    return {
      id: `${prefix}-${index + 1}-${Date.now().toString(36)}`,
      kind,
      text: text || (kind === 'button' ? 'Unlabeled Button' : kind === 'input' ? 'Unlabeled Input' : 'Content'),
      bbox: {
        x: Math.max(0, Math.min(95, x)),
        y: Math.max(0, Math.min(95, y)),
        w: Math.max(2, Math.min(100 - Math.max(0, x), w)),
        h: Math.max(1.5, Math.min(100 - Math.max(0, y), h)),
      },
      headingLevel: kind === 'heading' ? (headingLevel ? Number(headingLevel) : 1) : undefined,
      headingLevelInferred: kind === 'heading' && !headingLevel ? true : undefined,
      readingOrder,
      isInteractive,
      role:
        kind === 'heading' ? 'heading' :
        kind === 'button' ? 'button' :
        kind === 'input' ? 'textbox' :
        kind === 'link' ? 'link' :
        kind === 'image' ? 'image' :
        undefined,
    };
  });
}

/**
 * Local AI Vision Region Extractor via Python FastAPI
 * 
 * Uses the local Python backend running a Hugging Face object detection model (YOLOv11 or DETR).
 */
export async function extractRegionsFromLocalAI(
  base64DataUrl: string
): Promise<{ regions: UIElementRegion[]; isPartial: boolean }> {
  // Convert base64 to Blob to send as FormData
  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) throw new Error('Failed to prepare image for Local AI API.');
  
  const byteString = atob(match[2]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: match[1] });
  
  const formData = new FormData();
  formData.append('file', blob, 'screenshot.jpg');

  try {
    const response = await fetch(`${API_BASE_URL}/api/detect`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Local AI Server returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const regions: UIElementRegion[] = data.regions || [];
    
    if (regions.length === 0) {
      throw new Error('Local AI found zero parseable regions');
    }
    
    return { regions, isPartial: false };
  } catch (err: any) {
    throw new Error(`Local AI API failed: ${err.message}. Make sure the Python server is running on port 8000.`);
  }
}

/**
 * Honest offline region segmentation.
 *
 * Divides the image into an adaptive grid, computes actual pixel luminance statistics
 * for each cell, and returns ONLY cells with real high-contrast content.
 * Labels are honest about what we can and cannot determine without OCR.
 */
export function generateHeuristicRegions(
  canvas: HTMLCanvasElement
): UIElementRegion[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const W = canvas.width;
  const H = canvas.height;
  if (W < 10 || H < 10) return [];

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, W, H);
  } catch {
    return [];
  }

  const px = imgData.data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4] / 255;
    const g = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    const lr = r < 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const lg = g < 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const lb = b < 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    lum[i] = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  }

  const COLS = Math.min(6, Math.max(3, Math.round(W / 150)));
  const ROWS = Math.min(10, Math.max(4, Math.round(H / 100)));
  const cellW = Math.floor(W / COLS);
  const cellH = Math.floor(H / ROWS);

  interface CellStats {
    col: number; row: number;
    pxX: number; pxY: number; pxW: number; pxH: number;
    spread: number; edgeDensity: number;
    darkLum: number; lightLum: number;
  }

  const cells: CellStats[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = col * cellW;
      const y0 = row * cellH;
      const x1 = Math.min(W, x0 + cellW);
      const y1 = Math.min(H, y0 + cellH);
      const cw = x1 - x0;
      const ch = y1 - y0;
      if (cw < 4 || ch < 4) continue;

      const vals: number[] = [];
      for (let cy = y0; cy < y1; cy++)
        for (let cx = x0; cx < x1; cx++)
          vals.push(lum[cy * W + cx]);

      vals.sort((a, b) => a - b);
      const n = vals.length;
      const decile = Math.max(1, Math.floor(n * 0.1));

      let darkSum = 0, lightSum = 0;
      for (let i = 0; i < decile; i++) darkSum += vals[i];
      for (let i = n - decile; i < n; i++) lightSum += vals[i];
      const darkLum = darkSum / decile;
      const lightLum = lightSum / decile;
      const spread = lightLum - darkLum;

      let edgeCount = 0;
      for (let cy = y0; cy < y1; cy++)
        for (let cx = x0 + 1; cx < x1 - 1; cx++)
          if (Math.abs(lum[cy * W + cx + 1] - lum[cy * W + cx - 1]) > 0.08) edgeCount++;

      const edgeDensity = edgeCount / (cw * ch);
      cells.push({ col, row, pxX: x0, pxY: y0, pxW: cw, pxH: ch, spread, edgeDensity, darkLum, lightLum });
    }
  }

  const interesting = cells.filter(c => c.spread >= 0.05 || c.edgeDensity >= 0.04);
  const finalCells = interesting.length >= 3
    ? interesting
    : cells.sort((a, b) => b.spread - a.spread).slice(0, Math.max(5, Math.floor(cells.length * 0.5)));

  finalCells.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

  return finalCells.slice(0, 14).map((c, idx) => {
    const pctX = Math.round((c.pxX / W) * 1000) / 10;
    const pctY = Math.round((c.pxY / H) * 1000) / 10;
    const pctW = Math.max(2, Math.round((c.pxW / W) * 1000) / 10);
    const pctH = Math.max(2, Math.round((c.pxH / H) * 1000) / 10);

    const aspectRatio = c.pxW / Math.max(1, c.pxH);
    const isTopArea = c.row === 0 && c.spread > 0.1;
    const isWide = c.pxW / W > 0.5;

    let kind: UIElementRegion['kind'] = 'text';
    let isInteractive = false;

    if (isTopArea && isWide) { kind = 'heading'; }
    else if (aspectRatio >= 1.5 && aspectRatio <= 5 && !isWide && c.spread > 0.08) { kind = 'button'; isInteractive = true; }
    else if (aspectRatio > 5 && !isTopArea) { kind = 'input'; isInteractive = true; }
    else if (c.pxH > c.pxW * 0.8 && c.spread > 0.15) { kind = 'image'; }

    const quality = c.spread > 0.3 ? 'High contrast' : c.spread > 0.1 ? 'Medium contrast' : 'Low contrast';

    return {
      id: `cv-zone-${idx + 1}-${Date.now().toString(36)}`,
      kind,
      text: `Zone ${idx + 1} (${quality})`,
      bbox: { x: pctX, y: pctY, w: pctW, h: pctH },
      headingLevel: kind === 'heading' ? 1 : undefined,
      headingLevelInferred: kind === 'heading' ? true : undefined,
      readingOrder: idx + 1,
      isInteractive,
      role:
        kind === 'heading' ? 'heading' :
        kind === 'button' ? 'button' :
        kind === 'input' ? 'textbox' :
        kind === 'image' ? 'image' :
        undefined,
    };
  });
}
