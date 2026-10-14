import React from 'react';
import { Logo } from './Logo';

/**
 * Logo + product name, sized so the capital letters of "A11y Lab" are exactly as tall as
 * the logo mark: the tops of A, 1 and L line up with the top of the mark, and the
 * baseline with its bottom. (The tail of the y hangs below, as in any lockup.)
 *
 * The wordmark size is DERIVED from the logo size, not chosen from the text scale. It is a
 * deliberate exception to the 12/14/16/20/24px scale, because it is part of the logo.
 *
 * Numbers:
 *  - the mark's ink spans y = 20..434 of the logo's 454-unit viewBox, centred in it
 *  - Urbanist capitals are 0.70 em tall, and with line-height: 1 their vertical centre is
 *    the centre of the line, so items-center lines them up with the mark's centre
 */
const LOGO_HEIGHT_PX = 28;
const MARK_HEIGHT_PX = LOGO_HEIGHT_PX * (414 / 454); // visible height of the mark
const URBANIST_CAP_HEIGHT_EM = 0.7;
const WORDMARK_FONT_SIZE_PX = MARK_HEIGHT_PX / URBANIST_CAP_HEIGHT_EM; // about 36.5px

export const BrandLockup: React.FC = () => (
  <div className="flex items-center gap-3">
    <Logo className="w-auto shrink-0 text-lab-accent" style={{ height: LOGO_HEIGHT_PX }} />
    <h1
      className="font-extrabold tracking-tight leading-none whitespace-nowrap text-lab-text"
      style={{ fontSize: WORDMARK_FONT_SIZE_PX }}
    >
      A11y Lab
    </h1>
  </div>
);
