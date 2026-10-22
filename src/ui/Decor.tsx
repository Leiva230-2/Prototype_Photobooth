import type { CSSProperties } from 'react';

/** SVG filter that roughens edges, like the deck's printed-sticker look. Render once per page. */
export function RoughFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="dearly-rough" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
      </filter>
    </svg>
  );
}

/** Hand-drawn five-point star, slightly lopsided on purpose. */
export function Star({ size = 40, style, className = '' }: { size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      className={`star ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M51 4 L63 36 L97 37 L70 58 L80 93 L50 72 L19 95 L30 59 L3 39 L38 35 Z"
      />
    </svg>
  );
}

/** Thin eight-point starburst, like the big ones on the title slide. */
export function Burst({ size = 120, style, className = '' }: { size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      className={`star ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M50 0 L56 40 L88 12 L61 46 L100 52 L60 57 L84 90 L54 62 L47 100 L44 61 L12 86 L39 55 L0 47 L40 43 L16 13 L46 39 Z"
      />
    </svg>
  );
}
