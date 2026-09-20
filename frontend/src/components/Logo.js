import React from 'react';

/**
 * The association mark, taken from the entrance sign on Pondview Terrace: a
 * gold panel carrying a silhouetted row of gabled townhomes.
 *
 * Drawn rather than photographed so it stays sharp at any size and needs no
 * image request. The row is deliberately uneven -- varied ridge heights and
 * two chimneys -- because a row of identical gables reads as a pattern rather
 * than as houses.
 */
export default function Logo({ size = 34, title = 'Townsquare Village' }) {
  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 64 50"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <rect x="0" y="0" width="64" height="50" rx="5" fill="#C7A63F" />

      <g fill="#2E241A">
        {/* Chimneys sit behind the roofline so they read as part of the mass. */}
        <rect x="16" y="12" width="3" height="9" />
        <rect x="43" y="14" width="3" height="8" />

        {/* A connected terrace of five gables, as on the sign: one continuous
            block with the ridge stepping up and down across it. */}
        <path d="M5 40V28l7-8 7 8v12z" />
        <path d="M18 40V25l8-9 8 9v15z" />
        <path d="M33 40V27l7-8 7 8v13z" />
        <path d="M46 40V30l6-7 6 7v10z" />

        <rect x="3" y="40" width="58" height="3" rx="1.5" />
      </g>

      {/* Windows and doors punched back out in the panel colour. */}
      <g fill="#C7A63F">
        <rect x="8.5" y="30" width="3" height="4" />
        <rect x="14" y="30" width="3" height="4" />
        <rect x="10.5" y="36" width="4" height="4" />

        <rect x="21.5" y="28" width="3" height="4" />
        <rect x="28" y="28" width="3" height="4" />
        <rect x="24.5" y="35" width="4" height="5" />

        <rect x="36" y="30" width="3" height="4" />
        <rect x="41.5" y="30" width="3" height="4" />
        <rect x="38.5" y="36" width="4" height="4" />

        <rect x="49" y="32" width="3" height="3" />
        <rect x="53.5" y="32" width="3" height="3" />
      </g>

    </svg>
  );
}
