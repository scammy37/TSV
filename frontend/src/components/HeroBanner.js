import React from 'react';

/**
 * The entrance on Pondview Terrace, drawn as a full scene rather than a sign
 * floating on a background.
 *
 * The first version drew only the sign, which left dead bands of colour either
 * side on a wide screen. This carries sky, planting and lawn edge to edge, so
 * widening the viewport reveals more of the scene instead of more empty space.
 * `slice` crops the outer planting rather than shrinking the sign, which keeps
 * the lettering a readable size at every width.
 */
export default function HeroBanner() {
  return (
    <svg
      className="hero-banner"
      viewBox="0 0 1600 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="The Townsquare Village entrance sign"
      focusable="false"
    >
      <defs>
        <linearGradient id="tsvSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2738" />
          <stop offset="0.7" stopColor="#28334a" />
          <stop offset="1" stopColor="#38414f" />
        </linearGradient>
        <linearGradient id="tsvLawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c4a3d" />
          <stop offset="1" stopColor="#2a3430" />
        </linearGradient>
      </defs>

      <rect width="1600" height="300" fill="#222c3d" />
      <rect width="1600" height="300" fill="url(#tsvSky)" />

      {/* Treeline across the back, so the sky has a horizon rather than an edge. */}
      <g fill="#1b2430" opacity="0.85">
        <path d="M0 214c26-4 40-30 58-30s26 16 44 18 30-22 52-22 34 24 56 26 36-18 58-18 30 20 52 20 40-26 62-26 34 22 56 24 38-16 60-16 32 18 54 18 40-24 62-24 36 20 58 22 38-14 60-14 34 16 56 16 42-22 64-22 36 18 58 20 38-12 60-12 34 14 56 14 42-20 64-20 36 16 58 18 38-10 60-10 34 12 56 12 42-18 64-18v98H0z" />
      </g>

      {/* Lawn, full width. */}
      <rect x="0" y="246" width="1600" height="54" fill="url(#tsvLawn)" />
      <rect x="0" y="246" width="1600" height="4" fill="#47563f" opacity="0.6" />

      {/* Low planting along the base, running off both edges. */}
      <g fill="#2c3a31">
        <ellipse cx="40" cy="250" rx="72" ry="30" />
        <ellipse cx="150" cy="252" rx="56" ry="24" />
        <ellipse cx="255" cy="250" rx="62" ry="27" />
        <ellipse cx="1350" cy="250" rx="62" ry="27" />
        <ellipse cx="1455" cy="252" rx="56" ry="24" />
        <ellipse cx="1560" cy="250" rx="74" ry="31" />
      </g>
      <g fill="#354639" opacity="0.8">
        <ellipse cx="95" cy="256" rx="44" ry="20" />
        <ellipse cx="205" cy="257" rx="40" ry="18" />
        <ellipse cx="1400" cy="257" rx="40" ry="18" />
        <ellipse cx="1510" cy="256" rx="44" ry="20" />
      </g>

      {/* ---- the sign itself, centred ---- */}
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

      {/* Shrubs at the foot of each pier, tying the sign into the planting. */}
      <g fill="#2c3a31">
        <ellipse cx="330" cy="252" rx="52" ry="24" />
        <ellipse cx="1272" cy="252" rx="52" ry="24" />
      </g>
    </svg>
  );
}
