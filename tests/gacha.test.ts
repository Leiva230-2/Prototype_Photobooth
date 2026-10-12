import { describe, expect, it } from 'vitest';
import { FRAMES, odds, roll } from '../src/booth/gacha';

/** Small seeded PRNG so the distribution test is deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gacha', () => {
  it('has four frames with equal odds', () => {
    expect(FRAMES.map((f) => f.id)).toEqual(['hitam', 'putih', 'ungu', 'coklat']);
    expect(odds(FRAMES)).toEqual([25, 25, 25, 25]);
  });

  it('maps the random number onto the weights', () => {
    expect(roll(FRAMES, 0).id).toBe('hitam');
    expect(roll(FRAMES, 0.249).id).toBe('hitam');
    expect(roll(FRAMES, 0.25).id).toBe('putih');
    expect(roll(FRAMES, 0.6).id).toBe('ungu');
    expect(roll(FRAMES, 0.9999).id).toBe('coklat');
  });

  it('respects uneven weights', () => {
    const pool = [
      { id: 'common', weight: 60 },
      { id: 'rare', weight: 30 },
      { id: 'legendary', weight: 10 },
    ];
    expect(odds(pool)).toEqual([60, 30, 10]);
    expect(roll(pool, 0.59).id).toBe('common');
    expect(roll(pool, 0.6).id).toBe('rare');
    expect(roll(pool, 0.95).id).toBe('legendary');
  });

  it('comes out close to 25% each over many rolls', () => {
    const rand = mulberry32(42);
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const id = roll(FRAMES, rand()).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const f of FRAMES) {
      const share = (counts.get(f.id) ?? 0) / n;
      expect(share).toBeGreaterThan(0.23);
      expect(share).toBeLessThan(0.27);
    }
  });

  it('rejects an empty pool', () => {
    expect(() => roll([], 0.5)).toThrow();
  });
});
