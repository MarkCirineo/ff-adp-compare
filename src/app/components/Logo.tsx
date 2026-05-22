'use client';

/**
 * Draft Edge — Logo Component
 *
 * Premium inline SVG logo mark + wordmark.
 * The bolt icon is a custom, sharp-geometric lightning bolt designed
 * to sit inside a subtle rounded-rect container with an emerald gradient
 * accent bar on the left edge.
 */

export function Logo({ size = 28 }: { size?: number }) {
  const iconSize = size;
  const fontSize = size * 0.64;

  return (
    <div
      className="logo"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.38,
        userSelect: 'none',
      }}
    >
      {/* ---- Logo Mark ---- */}
      <div
        className="logo__mark"
        style={{
          width: iconSize,
          height: iconSize,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Background rounded rect */}
          <rect
            x="0"
            y="0"
            width="40"
            height="40"
            rx="8"
            fill="url(#mark-bg)"
          />

          {/* Left accent bar */}
          <rect
            x="0"
            y="0"
            width="5"
            height="40"
            rx="3"
            fill="url(#accent-bar)"
          />

          {/* Lightning bolt — sharp geometric */}
          <path
            d="M22.5 6L11 22h8l-1.5 12L29 18h-8l1.5-12z"
            fill="url(#bolt-gradient)"
          />

          {/* Bolt highlight (top half subtly lighter) */}
          <path
            d="M22.5 6L11 22h8l-0.5-4h4.5L22.5 6z"
            fill="rgba(255,255,255,0.12)"
          />

          <defs>
            <linearGradient
              id="mark-bg"
              x1="0"
              y1="0"
              x2="40"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#151515" />
              <stop offset="100%" stopColor="#0d0d0d" />
            </linearGradient>

            <linearGradient
              id="accent-bar"
              x1="0"
              y1="0"
              x2="0"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <linearGradient
              id="bolt-gradient"
              x1="11"
              y1="6"
              x2="29"
              y2="34"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="50%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ---- Wordmark ---- */}
      <div
        className="logo__wordmark"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: size * 0.18,
          lineHeight: 1.15,
        }}
      >
        <span
          className="logo__text-draft"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#f0f0f0',
          }}
        >
          Draft
        </span>
        <span
          className="logo__text-edge"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #6ee7b7, #10b981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Edge
        </span>
      </div>
    </div>
  );
}
