import React from 'react';

/**
 * The entrance sign on Pondview Terrace: the two stone piers, the board between
 * them, the gold panel with its terrace of gables, and the name.
 *
 * Drawn and nothing else. An earlier version set it in an invented landscape of
 * treeline and lawn, which read as decoration standing in for a photograph
 * nobody had. The sign alone on a flat ground is honest about what it is, and
 * the viewBox frames it tightly so it scales to the width of the page's
 * content rather than floating in a band of its own.
 */
export default function HeroBanner() {
  return (
    <svg
      className="hero-banner"
      viewBox="288 60 1024 208"
      role="img"
      aria-label="The Townsquare Village entrance sign"
      focusable="false"
    >

                        {/* ---- the sign itself ----
          Scaled about its own centre (800, 164) so the surrounding scene
          carries more of the frame and the sign reads as part of it. */}
      <g fill="#3d4453">
        <rect x="300" y="72" width="94" height="184" rx="4" />
        <rect x="1206" y="72" width="94" height="184" rx="4" />
      </g>
      <g fill="#4a5261">
        <rect x="306" y="80" width="39" height="25" rx="3" />
        <rect x="349" y="80" width="39" height="25" rx="3" />
        <rect x="306" y="109" width="82" height="25" rx="3" />
        <rect x="306" y="138" width="39" height="25" rx="3" />
        <rect x="349" y="138" width="39" height="25" rx="3" />
        <rect x="306" y="167" width="82" height="25" rx="3" />
        <rect x="306" y="196" width="39" height="25" rx="3" />
        <rect x="349" y="196" width="39" height="25" rx="3" />
        <rect x="1212" y="80" width="39" height="25" rx="3" />
        <rect x="1255" y="80" width="39" height="25" rx="3" />
        <rect x="1212" y="109" width="82" height="25" rx="3" />
        <rect x="1212" y="138" width="39" height="25" rx="3" />
        <rect x="1255" y="138" width="39" height="25" rx="3" />
        <rect x="1212" y="167" width="82" height="25" rx="3" />
        <rect x="1212" y="196" width="39" height="25" rx="3" />
        <rect x="1255" y="196" width="39" height="25" rx="3" />
      </g>

      <rect x="380" y="88" width="840" height="148" rx="6" fill="#2a2f3a" />
      <rect x="380" y="88" width="840" height="148" rx="6" fill="none" stroke="#5b6372" strokeWidth="2" />

      <rect x="410" y="112" width="228" height="100" rx="3" fill="#C7A63F" />
      <g fill="#23201a">
        <rect x="451" y="132" width="7" height="19" />
        <rect x="566" y="136" width="7" height="17" />
        <path d="M424 191v-27l16-18 16 18v27z" />
        <path d="M457 191v-33l18-20 18 20v33z" />
        <path d="M495 191v-29l16-18 16 18v29z" />
        <path d="M529 191v-23l14-16 14 16v23z" />
        <path d="M558 191v-29l16-18 16 18v29z" />
        <path d="M594 191v-21l13-15 13 15v21z" />
        <rect x="420" y="191" width="208" height="6" rx="2" />
      </g>
      <g fill="#C7A63F">
        <rect x="430" y="170" width="7" height="10" />
        <rect x="443" y="170" width="7" height="10" />
        <rect x="467" y="164" width="7" height="10" />
        <rect x="482" y="164" width="7" height="10" />
        <rect x="471" y="182" width="10" height="9" />
        <rect x="503" y="170" width="7" height="10" />
        <rect x="516" y="170" width="7" height="10" />
        <rect x="537" y="174" width="7" height="9" />
        <rect x="566" y="170" width="7" height="10" />
        <rect x="579" y="170" width="7" height="10" />
        <rect x="602" y="176" width="8" height="8" />
      </g>

      <text
        x="672" y="152" fill="#EDE3CB"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="55" letterSpacing="7"
      >
        TOWNSQUARE
      </text>
      <text
        x="672" y="210" fill="#EDE3CB"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="55" letterSpacing="7"
      >
        VILLAGE
      </text>

      </svg>
  );
}
