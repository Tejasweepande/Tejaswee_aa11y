import React from 'react';

/**
 * The A11y Lab mark: two slanted bars and two dots.
 * The shapes are the supplied A11y_logo.svg (898 x 454), unchanged. The fill is
 * currentColor, so it follows the text colour. Use text-lab-accent for the brand blue
 * (#0369A1 in the light theme) and the lighter accent in the dark theme, where the
 * darker blue would be harder to see.
 *
 * Decorative by default (the product name is written next to it). Pass `title` when the
 * mark stands alone, so it gets an accessible name.
 */
export const Logo: React.FC<{ className?: string; style?: React.CSSProperties; title?: string }> = ({ className, style, title }) => (
  <svg
    viewBox="0 0 898 454"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title && <title>{title}</title>}
    <path d="M187.957 388.842C163.104 431.888 108.061 446.637 65.015 421.784C21.9687 396.931 7.21993 341.888 32.0727 298.842L167.073 65.015C191.926 21.9687 246.969 7.21993 290.015 32.0727C333.061 56.9256 347.81 111.969 322.957 155.015L187.957 388.842Z" />
    <circle cx="381.015" cy="344" r="90" />
    <path d="M710.128 65.015C734.981 21.9687 790.024 7.21993 833.071 32.0727C876.117 56.9256 890.866 111.969 866.013 155.015L731.013 388.842C706.16 431.888 651.117 446.637 608.071 421.784C565.024 396.931 550.276 341.888 575.128 298.842L710.128 65.015Z" />
    <circle cx="517.071" cy="110.941" r="90" transform="rotate(180 517.071 110.941)" />
  </svg>
);
