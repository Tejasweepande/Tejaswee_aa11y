import React, { useEffect, useRef, useState } from 'react';
import { Finding } from '../types/finding';

/**
 * "Visual Barrier Map" for the audit report: the audited page with every barrier
 * marked and numbered like the pins on the preview.
 *
 * - On screen it is shown in full, with no inner scrollbar (the report itself scrolls).
 * - In print it is cut into page-sized slices. A printed page cannot scroll, and a
 *   single very tall image would be clipped at the bottom of its page, so each slice
 *   holds one page-height piece of the screenshot together with the pins that fall
 *   inside it. Slices never split across pages.
 */

// Tallest slice, in CSS px (~80mm). A4 and Letter pages with 12mm margins hold roughly
// 960-1030px, so three slices fit on a page with little wasted space, and the first
// slice can share a page with the section heading instead of jumping to the next one.
const MAX_SLICE_HEIGHT = 300;
// Widest the printed report content can be, in CSS px (Letter with 12mm margins).
const PRINT_CONTENT_WIDTH = 725;
// A map this short (printed height, CSS px, ~185mm) fits on one page whole, so it is not cut up.
const SINGLE_SLICE_MAX = 700;
// Safety cap so an enormous screenshot cannot create hundreds of DOM nodes.
const MAX_SLICES = 40;

const RING_BY_SEVERITY: Record<string, string> = {
  critical: 'ring-red-500',
  serious: 'ring-orange-500',
  moderate: 'ring-amber-500',
  minor: 'ring-sky-500',
};

const Pins: React.FC<{ findings: Finding[] }> = ({ findings }) => (
  <div className="absolute inset-0 z-10 pointer-events-none">
    {findings.map((f, idx) => {
      const bbox = f.target.boundingBox;
      if (!bbox) return null;
      return (
        <div
          key={f.id}
          data-barrier-pin={idx + 1}
          style={{ left: `${bbox.x}%`, top: `${bbox.y}%`, width: `${bbox.w}%`, height: `${bbox.h}%` }}
          className={`absolute ring-2 ${RING_BY_SEVERITY[f.severity] || 'ring-sky-500'} rounded flex items-start justify-start`}
        >
          <span className="min-w-[24px] h-6 px-1 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shadow-md -translate-x-2 -translate-y-2 ring-1 ring-white/30 shrink-0">
            {idx + 1}
          </span>
        </div>
      );
    })}
  </div>
);

interface Props {
  imageSrc?: string | null;
  iframeHtml?: string | null;
  findings: Finding[];
}

export const BarrierMap: React.FC<Props> = ({ imageSrc, iframeHtml, findings }) => {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [frameHeight, setFrameHeight] = useState(768);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setDims(null);
  }, [imageSrc]);

  useEffect(() => {
    setFrameHeight(768);
  }, [iframeHtml]);

  // A screenshot always wins over the live copy: it is the full-length page the pins
  // were measured against (the live copy was drawn at a fixed 768px and cut the page off).
  if (imageSrc) {
    const aspect = dims && dims.w > 0 ? dims.h / dims.w : null;
    const printedHeight = aspect ? aspect * PRINT_CONTENT_WIDTH : 0;
    const sliceCount =
      printedHeight <= SINGLE_SLICE_MAX
        ? 1
        : Math.min(MAX_SLICES, Math.ceil(printedHeight / MAX_SLICE_HEIGHT));

    return (
      <>
        {/* Screen: whole map, no scrollbar of its own */}
        <div className="print:hidden flex justify-center border border-lab-border rounded bg-lab-bg p-2">
          <div className="relative inline-block max-w-full">
            <img
              src={imageSrc}
              alt="Screenshot of the audited page with numbered barrier markers"
              className="max-w-full h-auto block"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) setDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            <Pins findings={findings} />
          </div>
        </div>

        {/* Print: the same map in page-sized slices (screen never shows this) */}
        <div
          className="hidden print:block mx-auto w-full"
          data-barrier-print
          style={{ maxWidth: dims ? `${dims.w}px` : undefined }}
        >
          {aspect === null ? (
            <div className="relative w-full" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <img src={imageSrc} alt="" className="w-full h-auto block" />
              <Pins findings={findings} />
            </div>
          ) : (
            Array.from({ length: sliceCount }, (_, i) => (
              <div
                key={i}
                data-barrier-slice={i}
                className="relative w-full overflow-hidden"
                style={{
                  paddingTop: `${(aspect / sliceCount) * 100}%`,
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                <div
                  className="absolute left-0 w-full"
                  style={{ top: `${-i * 100}%`, height: `${sliceCount * 100}%` }}
                >
                  <img src={imageSrc} alt="" className="w-full h-full block" />
                  <Pins findings={findings} />
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  if (iframeHtml) {
    // Fallback when there is no screenshot: the live copy, sized to its real content
    // height so there is nothing to scroll.
    return (
      <div className="border border-lab-border rounded bg-lab-bg p-2 flex justify-center">
        <div className="relative inline-block max-w-full">
          <iframe
            ref={frameRef}
            srcDoc={iframeHtml}
            sandbox="allow-same-origin"
            scrolling="no"
            title="Audit preview"
            className="block border-none bg-white pointer-events-none"
            style={{ width: 1024, maxWidth: '100%', height: frameHeight }}
            onLoad={() => {
              try {
                const doc = frameRef.current?.contentDocument;
                const real = Math.max(doc?.documentElement?.scrollHeight || 0, doc?.body?.scrollHeight || 0, 768);
                setFrameHeight(real);
              } catch {
                /* keep the default height */
              }
            }}
          />
          <Pins findings={findings} />
        </div>
      </div>
    );
  }

  return null;
};
