/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';

interface OrbitalLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export const OrbitalLogo: React.FC<OrbitalLogoProps> = ({
  size = 36,
  className = '',
  animate = true
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label="MESHORA Orbital Logo"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Core Node */}
        <circle cx="50" cy="50" r="7" className="fill-white dark:fill-white" />
        <circle cx="50" cy="50" r="4" className="fill-blue-500" />

        {/* Orbit 1: Tilted Ellipse */}
        <g className={animate ? 'origin-center animate-[spin_24s_linear_infinite]' : ''}>
          <ellipse
            cx="50"
            cy="50"
            rx="36"
            ry="19"
            transform="rotate(-28 50 50)"
            className="stroke-blue-400/80 dark:stroke-blue-400/70"
            strokeWidth="1.8"
          />
          <circle
            cx="20"
            cy="36"
            r="3"
            className="fill-blue-400 shadow-sm"
          />
        </g>

        {/* Orbit 2: Outer Circular Orbit with subtle dashes */}
        <g className={animate ? 'origin-center animate-[spin_40s_linear_infinite_reverse]' : ''}>
          <circle
            cx="50"
            cy="50"
            r="38"
            className="stroke-neutral-400/50 dark:stroke-neutral-600/60"
            strokeWidth="1.5"
            strokeDasharray="3 5"
          />
          <circle
            cx="78"
            cy="24"
            r="2.5"
            className="fill-neutral-300 dark:fill-neutral-200"
          />
        </g>
      </svg>
    </div>
  );
};
