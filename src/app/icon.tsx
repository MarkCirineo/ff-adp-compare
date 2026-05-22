import { ImageResponse } from 'next/og';

// Route segment config
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Image generation — lightning bolt matching the header logo mark
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #151515, #0d0d0d)',
          borderRadius: '6px',
          position: 'relative',
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            width: '4px',
            background: 'linear-gradient(180deg, #6ee7b7, #10b981)',
            borderRadius: '6px 0 0 6px',
          }}
        />
        {/* Lightning bolt — scaled up to fill the favicon */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginLeft: '2px' }}
        >
          <path
            d="M14.5 2L5 14h6l-1.2 8L20 10h-6.5L14.5 2z"
            fill="url(#b)"
          />
          <defs>
            <linearGradient id="b" x1="5" y1="2" x2="20" y2="22">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="50%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
