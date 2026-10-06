import React, { useRef, useState } from 'react';
import { BoundingBox } from '../types/finding';

interface Props {
  imageSrc?: string | null;
  iframeHtml?: string | null;
  bbox: BoundingBox;
  number: number;
  /** Outline color for the element (the severity color). */
  color: string;
}

// Size of the cropped picture, in CSS px.
const BOX_W = 120;
const BOX_H = 72;
// Never magnify more than this, so small elements are not blown up into blur.
const MAX_SCALE = 2;
// Wide elements (a full-width paragraph) show only their first part, at a readable size.
const MAX_SOURCE_W = 220;
// Width the live copy is drawn at, matching the report's barrier map.
const FRAME_W = 1024;

/**
 * Printed report only: a small picture of just this issue's element, outlined
 * and numbered like its pin on the map, so readers do not need to flip back to
 * a full-page map. Works from the screenshot when there is one, otherwise from
 * the live copy of the page.
 */
export const IssueCrop: React.FC<Props> = ({ imageSrc, iframeHtml, bbox, number, color }) => {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Element position in source pixels (the bounding box is in percent of the page).
  const place = (w: number, h: number) => {
    const x = (bbox.x / 100) * w;
    const y = (bbox.y / 100) * h;
    const bw = Math.max(1, (bbox.w / 100) * w);
    const bh = Math.max(1, (bbox.h / 100) * h);
    // Fit the element (or the start of a wide one) plus a little context into the box.
    const shownW = Math.min(bw, MAX_SOURCE_W);
    const scale = Math.min(MAX_SCALE, (BOX_W * 0.85) / shownW, (BOX_H * 0.5) / bh);
    const left = bw > MAX_SOURCE_W ? 12 - x * scale : BOX_W / 2 - (x + bw / 2) * scale;
    const top = BOX_H / 2 - (y + bh / 2) * scale + 8; // nudge down to leave room for the pin
    return { scale, left, top, outline: { left: left + x * scale, top: top + y * scale, width: bw * scale, height: bh * scale } };
  };

  const p = dims ? place(dims.w, dims.h) : null;

  return (
    <div
      className="hidden print:block relative overflow-hidden rounded bg-[#F4F5F7] shrink-0"
      style={{ width: BOX_W, height: BOX_H }}
      aria-hidden="true"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="absolute max-w-none"
          style={p ? { left: p.left, top: p.top, width: dims!.w * p.scale, height: dims!.h * p.scale } : { visibility: 'hidden' }}
          onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : iframeHtml ? (
        <iframe
          ref={frameRef}
          srcDoc={iframeHtml}
          sandbox="allow-same-origin"
          scrolling="no"
          title=""
          tabIndex={-1}
          className="absolute border-none bg-white pointer-events-none origin-top-left"
          style={
            p
              ? { left: p.left, top: p.top, width: FRAME_W, height: dims!.h, transform: `scale(${p.scale})` }
              : { width: FRAME_W, height: 768, visibility: 'hidden' }
          }
          onLoad={() => {
            try {
              const doc = frameRef.current?.contentDocument;
              const h = Math.max(doc?.documentElement?.scrollHeight || 0, doc?.body?.scrollHeight || 0, 768);
              setDims({ w: FRAME_W, h });
            } catch {
              setDims({ w: FRAME_W, h: 768 });
            }
          }}
        />
      ) : null}

      {p && (
        <span
          className="absolute rounded border-2"
          style={{ ...p.outline, borderColor: color }}
        >
          <span className="absolute left-0 bottom-full mb-0.5 min-w-[20px] h-5 px-1 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
            {number}
          </span>
        </span>
      )}
    </div>
  );
};
