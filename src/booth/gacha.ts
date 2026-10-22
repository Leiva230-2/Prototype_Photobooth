/**
 * Gacha frames. For now every frame has the same weight, so each one has an
 * equal chance. To move to rarity tiers later (e.g. 60/30/10), change the
 * weights — roll() and odds() already handle any weighting.
 */
export interface FrameStyle {
  id: string;
  name: string;
  weight: number;
  /** Strip background. */
  bg: string;
  /** Thin border around each photo. */
  border: string;
  /** Main text on the strip. */
  ink: string;
  /** Secondary text (date, labels). */
  dim: string;
  /** "Photobooth" wordmark and event name. */
  accent: string;
}

export const FRAMES = [
  {
    id: 'hitam',
    name: 'Hitam',
    weight: 1,
    bg: '#161414',
    border: '#2E2A28',
    ink: '#EFE8DF',
    dim: '#9A928A',
    accent: '#F1D98A',
  },
  {
    id: 'putih',
    name: 'Putih',
    weight: 1,
    bg: '#EFE8DF',
    border: '#DCD2C2',
    ink: '#9E2A2B',
    dim: '#A0766A',
    accent: '#9E2A2B',
  },
  {
    id: 'ungu',
    name: 'Ungu',
    weight: 1,
    bg: '#4B2A7B',
    border: '#3A1F61',
    ink: '#EFE8DF',
    dim: '#C9B6E8',
    accent: '#F1D98A',
  },
  {
    id: 'coklat',
    name: 'Coklat',
    weight: 1,
    bg: '#6B4429',
    border: '#56351F',
    ink: '#F3E6D3',
    dim: '#D7B99A',
    accent: '#F1D98A',
  },
] as const satisfies readonly FrameStyle[];

export type FrameId = (typeof FRAMES)[number]['id'];

export function frameById(id: FrameId): FrameStyle {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

/**
 * Weighted pick. `r` is a random number in [0, 1); passing it in keeps this
 * function pure and testable.
 */
export function roll<T extends { weight: number }>(items: readonly T[], r: number): T {
  if (items.length === 0) throw new Error('Gacha pool is empty');
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let target = r * total;
  for (const it of items) {
    if (target < it.weight) return it;
    target -= it.weight;
  }
  return items[items.length - 1];
}

/** Chance of each item as a percentage, for the published odds. */
export function odds<T extends { weight: number }>(items: readonly T[]): number[] {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  return items.map((it) => (it.weight / total) * 100);
}

/** Cryptographically random number in [0, 1). */
export function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
