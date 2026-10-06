import React from 'react';

/** Material Design "close" icon (Apache-2.0, google/material-design-icons). */
const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

interface Props {
  /** Accessible name, e.g. "Clear Figma link". */
  label: string;
  onClick: () => void;
  /** Vertical placement inside the field wrapper. */
  align?: 'center' | 'top';
}

/**
 * Round "x" button that sits inside the right edge of a text field.
 * The parent renders it only while the field has content, and reserves the
 * right padding (pr-10) so the text never shifts when it appears.
 * 28px hit area, above the 24px minimum the tool itself audits for.
 */
export const ClearButton: React.FC<Props> = ({ label, onClick, align = 'center' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title="Clear"
    className={`absolute right-1.5 w-7 h-7 inline-flex items-center justify-center rounded-full text-lab-muted hover:text-lab-text hover:bg-lab-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
      align === 'center' ? 'top-1/2 -translate-y-1/2' : 'top-1.5'
    }`}
  >
    <CloseIcon />
  </button>
);
