export type ExceptionVerdict =
  | { status: 'exempt';        exceptionId: string; reason: string }
  | { status: 'applies' }
  | { status: 'indeterminate'; exceptionId: string; reason: string };

export type TargetBox = {
  id: string;
  box: { x: number; y: number; w: number; h: number };  // CSS px
  isTarget: boolean;        // is this a pointer target at all
  isUndersized: boolean;    // < 24×24
};

export type ExceptionContext = {
  source: 'html' | 'figma' | 'image';
  unitsAreCssPx: boolean;          // false on image path when scale = Unknown (R5)
  allTargets?: TargetBox[];        // required for the 2.5.8 spacing exception
  isDisabled?: boolean | null;     // null = unknown
  isLogo?: boolean | null;
  isInline?: boolean | null;
  isUserAgentDefault?: boolean | null;
  hasEquivalentControl?: boolean | null;
  elementKind?: string;
};

export function evaluateExceptions(
  criterion: string,
  subject: TargetBox,
  ctx: ExceptionContext
): ExceptionVerdict {
  if (criterion === '2.5.8') {
    // 1. Spacing Exception
    if (!ctx.unitsAreCssPx) {
      return {
        status: 'indeterminate',
        exceptionId: '2.5.8-spacing',
        reason: 'Export scale undeclared — spacing cannot be evaluated in CSS px (R5).',
      };
    }

    if (!ctx.allTargets || ctx.allTargets.length <= 1) {
      return {
        status: 'indeterminate',
        exceptionId: '2.5.8-spacing',
        reason: 'Incomplete target list — cannot prove isolation.',
      };
    }

    const spacingVerdict = evaluateSpacingException(subject, ctx.allTargets);
    if (spacingVerdict.status !== 'applies') {
      return spacingVerdict;
    }

    // 2. Inline Exception
    if (ctx.isInline === true) {
      return { status: 'exempt', exceptionId: '2.5.8-inline', reason: 'Target is inline within text.' };
    }
    if (ctx.isInline === null && ctx.source !== 'html') {
       return { status: 'indeterminate', exceptionId: '2.5.8-inline', reason: 'Cannot determine if target is inline from static image/Figma.' };
    }

    // 3. Equivalent Exception
    if (ctx.hasEquivalentControl === true) {
      return { status: 'exempt', exceptionId: '2.5.8-equivalent', reason: 'An equivalent control of sufficient size exists.' };
    }
    if (ctx.hasEquivalentControl === null) {
       return { status: 'indeterminate', exceptionId: '2.5.8-equivalent', reason: 'Cannot determine if an equivalent control exists.' };
    }

    // 4. User Agent Control Exception
    if (ctx.isUserAgentDefault === true) {
       return { status: 'exempt', exceptionId: '2.5.8-user-agent', reason: 'Size is determined by the user agent.' };
    }
    if (ctx.isUserAgentDefault === null) {
       return { status: 'indeterminate', exceptionId: '2.5.8-user-agent', reason: 'Cannot determine if size is modified by author.' };
    }
    
    return { status: 'applies' };
  }

  if (criterion === '1.4.3') {
     // 1. Logotype
     if (ctx.isLogo === true) {
         return {
            status: 'indeterminate',
            exceptionId: '1.4.3-logotype',
            reason: 'This may be a logo or brand mark, which is exempt from 1.4.3. Confirm and dismiss if so.'
         };
     }
     
     // 2. Incidental / Disabled
     if (ctx.isDisabled === true) {
         if (ctx.source === 'image') {
             return { status: 'indeterminate', exceptionId: '1.4.3-incidental', reason: 'Cannot confidently detect disabled state from image.' };
         }
         return { status: 'exempt', exceptionId: '1.4.3-incidental', reason: 'Text is part of an inactive component.' };
     }

     return { status: 'applies' };
  }

  if (criterion === '1.4.11') {
      // 1. Inactive components
      if (ctx.isDisabled === true) {
         if (ctx.source === 'image') {
             return { status: 'indeterminate', exceptionId: '1.4.11-inactive', reason: 'Cannot confidently detect disabled state from image.' };
         }
         return { status: 'exempt', exceptionId: '1.4.11-inactive', reason: 'Component is inactive/disabled.' };
      }

      // Essential presentation etc can be indeterminate for now
      return { status: 'applies' };
  }


  return { status: 'applies' };
}

function evaluateSpacingException(
  subject: TargetBox,
  all: TargetBox[]
): ExceptionVerdict {
  const R = 12;
  const c = {
    x: subject.box.x + subject.box.w / 2,
    y: subject.box.y + subject.box.h / 2,
  };

  for (const other of all) {
    if (other.id === subject.id || !other.isTarget) continue;

    // circle vs the other target's bounding box
    const nx = Math.max(other.box.x, Math.min(c.x, other.box.x + other.box.w));
    const ny = Math.max(other.box.y, Math.min(c.y, other.box.y + other.box.h));
    const dBox = Math.hypot(c.x - nx, c.y - ny);
    if (dBox < R) {
      return { status: 'applies' };
    }

    // circle vs the other undersized target's circle (radii sum = 24)
    if (other.isUndersized) {
      const oc = {
        x: other.box.x + other.box.w / 2,
        y: other.box.y + other.box.h / 2,
      };
      if (Math.hypot(c.x - oc.x, c.y - oc.y) < R * 2) {
        return { status: 'applies' };
      }
    }
  }

  return {
    status: 'exempt',
    exceptionId: '2.5.8-spacing',
    reason: 'Undersized, but a 24px circle centred on this target does not ' +
            'intersect any other target — the spacing exception applies.',
  };
}
