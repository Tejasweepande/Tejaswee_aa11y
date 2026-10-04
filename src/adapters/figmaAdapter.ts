export interface FigmaUrlInfo {
  fileKey: string;
  nodeId: string;
  mode: 'proto' | 'design' | 'file';
  name?: string;
}

/**
 * Parses all 3 Figma URL formats (GEMINI.md §4A):
 * - figma.com/proto/<fileKey>/<name>?node-id=123-456
 * - figma.com/design/<fileKey>/<name>?node-id=123-456
 * - figma.com/file/<fileKey>/<name>?node-id=123-456
 */
export function parseFigmaUrl(url: string): FigmaUrlInfo | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);

    // Expected shape: [mode, fileKey, name?]
    if (parts.length < 2) return null;

    const mode = parts[0] as 'proto' | 'design' | 'file';
    if (!['proto', 'design', 'file'].includes(mode)) return null;

    const fileKey = parts[1];
    const name = parts[2] ? decodeURIComponent(parts[2]) : undefined;

    // Normalise node-id: "123-456" -> "123:456"
    const rawNodeId = parsed.searchParams.get('node-id') || '0:1';
    const nodeId = rawNodeId.replace(/-/g, ':');

    return { fileKey, nodeId, mode, name };
  } catch {
    return null;
  }
}

/**
 * Phase 2 Figma REST API Client (Direct CORS Browser Fetch)
 */
export async function fetchFigmaNode(fileKey: string, nodeId: string, patToken: string): Promise<unknown> {
  const endpoint = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`;
  const res = await fetch(endpoint, {
    headers: {
      'X-Figma-Token': patToken,
    },
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Figma 403 Forbidden: Ensure file is duplicated to your own drafts and PAT has read access.');
    }
    throw new Error(`Figma API returned HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch the rendered PNG of the specific node from Figma
 */
export async function fetchFigmaImage(fileKey: string, nodeId: string, patToken: string): Promise<string> {
  const endpoint = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png`;
  const res = await fetch(endpoint, {
    headers: {
      'X-Figma-Token': patToken,
    },
  });

  if (!res.ok) {
    throw new Error(`Figma Image API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const imageUrl = data.images && data.images[nodeId];
  if (!imageUrl) {
    throw new Error('Figma API did not return an image URL for the specified node.');
  }
  return imageUrl;
}

/**
 * Minimal type definition for a Figma Node
 */
export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: { type: string; color?: { r: number; g: number; b: number; a?: number } }[];
  style?: {
    fontSize?: number;
    fontWeight?: number;
  };
  characters?: string;
  children?: FigmaNode[];
  interactions?: {
    action?: {
      type: string;
      destinationId?: string;
    }
  }[];
}

/**
 * Convert Figma colors (0-1 floats) to CSS rgb/rgba
 */
function figmaColorToRgb(color: { r: number; g: number; b: number; a?: number }) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

import { UIElementRegion } from '../types/finding';

/**
 * Extracts UIElementRegions from the Figma API response root node.
 * Walks the tree, computing semantic kind from names, contrast colors from fills, 
 * bounding boxes relative to the root frame, and prototype focus order.
 */
export function extractFromFigma(
  rootNode: FigmaNode, 
  rootWidth: number, 
  rootHeight: number, 
  rootX: number, 
  rootY: number
): { regions: UIElementRegion[]; rootNode: FigmaNode } {
  
  const regions: UIElementRegion[] = [];
  
  // Depth-first traversal
  function walk(node: FigmaNode, index: number, parentBg?: string) {
    let currentBg = parentBg;
    
    // Attempt to extract background color from fills (assuming first solid fill)
    if (node.fills && node.fills.length > 0) {
      const solidFill = node.fills.find(f => f.type === 'SOLID' && f.color);
      if (solidFill && solidFill.color) {
        currentBg = figmaColorToRgb(solidFill.color);
      }
    }

    if (node.absoluteBoundingBox && rootWidth > 0 && rootHeight > 0) {
      const bbox = node.absoluteBoundingBox;
      
      // Calculate coordinates relative to the root frame, as percentages (0-100)
      const relX = ((bbox.x - rootX) / rootWidth) * 100;
      const relY = ((bbox.y - rootY) / rootHeight) * 100;
      const relW = (bbox.width / rootWidth) * 100;
      const relH = (bbox.height / rootHeight) * 100;

      // Determine kind from node name and type
      let kind: UIElementRegion['kind'] = 'text';
      const nameLower = node.name.toLowerCase();
      
      if (nameLower.includes('button') || nameLower.includes('btn')) kind = 'button';
      else if (nameLower.includes('input') || nameLower.includes('field') || nameLower.includes('textbox')) kind = 'input';
      else if (nameLower.includes('heading') || nameLower.match(/^h[1-6]/)) kind = 'heading';
      else if (nameLower.includes('link') || nameLower.includes('href')) kind = 'link';
      else if (nameLower.includes('dialog') || nameLower.includes('modal') || nameLower.includes('popup')) kind = 'dialog';
      else if (node.type === 'IMAGE' || node.type === 'VECTOR' || nameLower.includes('image') || nameLower.includes('icon') || nameLower.includes('img') || nameLower.includes('vector')) kind = 'image';
      
      let headingLevel = undefined;
      let headingLevelInferred = false;
      if (kind === 'heading') {
        const match = nameLower.match(/h([1-6])/);
        if (match) headingLevel = parseInt(match[1], 10);
        else { headingLevel = 2; headingLevelInferred = true; } // fallback is a guess
      }

      // We only consider leaf nodes or explicitly semantic component nodes as interactive regions
      const isInteractive = ['button', 'input', 'link'].includes(kind);
      const isContent = kind === 'heading' || node.type === 'TEXT' || kind === 'image';
      
      if (isInteractive || isContent) {
        const region: UIElementRegion = {
          id: node.id,
          kind,
          text: node.characters || node.name,
          bbox: {
            x: Math.max(0, Math.min(100, relX)),
            y: Math.max(0, Math.min(100, relY)),
            w: Math.max(0, Math.min(100, relW)),
            h: Math.max(0, Math.min(100, relH)),
          },
          headingLevel,
          headingLevelInferred: headingLevelInferred || undefined,
          readingOrder: index,
          styles: {
            backgroundColor: currentBg, // Inherited or literal
            color: (node.type === 'TEXT' || node.type === 'VECTOR') && currentBg !== parentBg ? currentBg : undefined,
            fontSize: node.style?.fontSize,
            fontWeight: node.style?.fontWeight,
          }
        };

        // For text and vector nodes, the node's fill is actually its foreground color.
        if ((node.type === 'TEXT' || node.type === 'VECTOR') && node.fills && node.fills.length > 0) {
           const solidFill = node.fills.find(f => f.type === 'SOLID' && f.color);
           if (solidFill && solidFill.color) {
             region.styles!.color = figmaColorToRgb(solidFill.color);
             region.styles!.backgroundColor = parentBg; // Revert background to parent's
           }
        }

        regions.push(region);
      }
    }

    if (node.children) {
      node.children.forEach((child, i) => walk(child, index + i + 1, currentBg));
    }
  }

  walk(rootNode, 0);

  // If prototype interactions exist, we could re-sort `regions` based on them
  // For now, we rely on geometric sorting (handled inside `auditElements` or here)
  regions.sort((a, b) => {
    // Top to bottom, then left to right
    if (Math.abs(a.bbox.y - b.bbox.y) > 2) {
      return a.bbox.y - b.bbox.y;
    }
    return a.bbox.x - b.bbox.x;
  });

  // Re-assign reading order after geometric sort
  regions.forEach((r, i) => r.readingOrder = i + 1);

  return { regions, rootNode };
}
