import React from 'react';
import { Severity } from '../types/finding';
import { SEVERITY_BAR } from './FindingCard';

/**
 * Severity shown the same way everywhere: a dot in the severity color (the same
 * color as the issue card's edge and the map outline) followed by plain text.
 * The color never carries the text, so every label stays readable.
 */
export const SeverityDot: React.FC<{ severity: Severity; className?: string }> = ({ severity, className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
    style={{ backgroundColor: SEVERITY_BAR[severity] }}
  />
);

export const SeverityTag: React.FC<{ severity: Severity; children?: React.ReactNode }> = ({ severity, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lab-text">
    <SeverityDot severity={severity} />
    {children ?? severity.charAt(0).toUpperCase() + severity.slice(1)}
  </span>
);
