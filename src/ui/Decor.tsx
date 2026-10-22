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

/** Small seeded PRNG: the confetti is "random" but identical on the tablet and the Mac mirror. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dot {
  x: number;
  y: number;
  r: number;
  o: number;
}
interface Sparkle {
  x: number;
  y: number;
  s: number;
  delay: number;
}

// Built once. Dots lean towards the top, where the blue is deep enough for white to show.
const CONFETTI = (() => {
  const rand = seeded(21);
  const dots: Dot[] = Array.from({ length: 74 }, () => ({
    x: rand() * 1280,
    y: Math.pow(rand(), 1.35) * 760,
    r: 2 + Math.pow(rand(), 2) * 6,
    o: 0.45 + rand() * 0.45,
  }));
  const sparkles: Sparkle[] = [
    { x: 520, y: 118, s: 22, delay: 0 },
    { x: 712, y: 52, s: 16, delay: 0.9 },
    { x: 1228, y: 168, s: 20, delay: 1.7 },
    { x: 38, y: 330, s: 18, delay: 0.5 },
    { x: 560, y: 520, s: 15, delay: 2.2 },
    { x: 1036, y: 640, s: 24, delay: 1.3 },
  ];
  return { dots, sparkles };
})();

/** White dots and twinkling sparkles for the start screen, on a 1280×800 canvas. */
export function Confetti() {
  return (
    <svg className="confetti" viewBox="0 0 1280 800" width="1280" height="800" aria-hidden="true">
      {CONFETTI.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={d.o} />
      ))}
      {CONFETTI.sparkles.map((sp, i) => (
        <path
          key={`s${i}`}
          className="confetti__sparkle"
          style={{ animationDelay: `${sp.delay}s`, transformOrigin: `${sp.x}px ${sp.y}px` }}
          fill="#fff"
          d={`M${sp.x} ${sp.y - sp.s} Q${sp.x + sp.s * 0.16} ${sp.y - sp.s * 0.16} ${sp.x + sp.s} ${sp.y} Q${sp.x + sp.s * 0.16} ${sp.y + sp.s * 0.16} ${sp.x} ${sp.y + sp.s} Q${sp.x - sp.s * 0.16} ${sp.y + sp.s * 0.16} ${sp.x - sp.s} ${sp.y} Q${sp.x - sp.s * 0.16} ${sp.y - sp.s * 0.16} ${sp.x} ${sp.y - sp.s}Z`}
        />
      ))}
    </svg>
  );
}
