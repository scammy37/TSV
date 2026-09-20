import React from 'react';

/**
 * The entrance sign on Pondview Terrace, drawn rather than photographed.
 *
 * The photograph that was here first was 498px wide, so it was magnified
 * roughly 2.6x on a desktop and read as blurry. Drawing it solves that
 * outright: this is resolution-independent, a few kilobytes, and needs no
 * image request. It also lets the banner sit at its own size in the page
 * rather than being stretched to fill whatever the hero happens to be.
 *
 * The parts are the sign's own: two stone piers, the dark board between them,
 * the gold inset panel carrying the silhouetted terrace, and the name in a
 * letterspaced serif.
 */
export default function HeroBanner() {
  return (
    <svg
      className="hero-banner"
      viewBox="0 0 1280 288"
      role="img"
      aria-label="Townsquare Village entrance sign"
      focusable="false"
    >
      <defs>
        <linearGradient id="tsvSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3446" />
          <stop offset="1" stopColor="#151c28" />
        </linearGradient>
      </defs>

      <rect width="1280" height="288" fill="url(#tsvSky)" />

      {/* Stone piers either side, coursed like the real ones. */}
      <g fill="#3d4453">
        <rect x="60" y="54" width="96" height="190" rx="4" />
        <rect x="1124" y="54" width="96" height="190" rx="4" />
      </g>
      <g fill="#4a5261">
        <rect x="66" y="62" width="40" height="26" rx="3" />
        <rect x="110" y="62" width="40" height="26" rx="3" />
        <rect x="66" y="92" width="84" height="26" rx="3" />
        <rect x="66" y="122" width="40" height="26" rx="3" />
        <rect x="110" y="122" width="40" height="26" rx="3" />
        <rect x="66" y="152" width="84" height="26" rx="3" />
        <rect x="66" y="182" width="40" height="26" rx="3" />
        <rect x="110" y="182" width="40" height="26" rx="3" />
        <rect x="1130" y="62" width="40" height="26" rx="3" />
        <rect x="1174" y="62" width="40" height="26" rx="3" />
        <rect x="1130" y="92" width="84" height="26" rx="3" />
        <rect x="1130" y="122" width="40" height="26" rx="3" />
        <rect x="1174" y="122" width="40" height="26" rx="3" />
        <rect x="1130" y="152" width="84" height="26" rx="3" />
        <rect x="1130" y="182" width="40" height="26" rx="3" />
        <rect x="1174" y="182" width="40" height="26" rx="3" />
      </g>

      {/* The board. */}
      <rect x="140" y="74" width="1000" height="150" rx="6" fill="#2a2f3a" />
      <rect x="140" y="74" width="1000" height="150" rx="6" fill="none" stroke="#565e6e" strokeWidth="2" />

      {/* Gold inset panel with the terrace silhouette. */}
      <rect x="172" y="98" width="232" height="102" rx="3" fill="#C7A63F" />
      <g fill="#23201a">
        <rect x="214" y="118" width="7" height="20" />
        <rect x="330" y="122" width="7" height="18" />
        <path d="M186 178v-28l16-18 16 18v28z" />
        <path d="M220 178v-34l18-20 18 20v34z" />
        <path d="M258 178v-30l16-18 16 18v30z" />
        <path d="M292 178v-24l14-16 14 16v24z" />
        <path d="M322 178v-30l16-18 16 18v30z" />
        <path d="M358 178v-22l13-15 13 15v22z" />
        <rect x="182" y="178" width="210" height="6" rx="2" />
      </g>
      <g fill="#C7A63F">
        <rect x="192" y="156" width="7" height="10" />
        <rect x="205" y="156" width="7" height="10" />
        <rect x="230" y="150" width="7" height="10" />
        <rect x="245" y="150" width="7" height="10" />
        <rect x="234" y="168" width="10" height="10" />
        <rect x="266" y="156" width="7" height="10" />
        <rect x="279" y="156" width="7" height="10" />
        <rect x="300" y="160" width="7" height="9" />
        <rect x="330" y="156" width="7" height="10" />
        <rect x="343" y="156" width="7" height="10" />
        <rect x="366" y="162" width="8" height="8" />
      </g>

      <text
        x="440" y="140" fill="#EDE3CB"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="58" letterSpacing="7"
      >
        TOWNSQUARE
      </text>
      <text
        x="440" y="200" fill="#EDE3CB"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="58" letterSpacing="7"
      >
        VILLAGE
      </text>
    </svg>
  );
}
