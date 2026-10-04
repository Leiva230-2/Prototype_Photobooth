import { describe, expect, it } from 'vitest';
import {
  CELL_H,
  FOOTER_Y,
  GAP,
  MARGIN_TOP,
  SHEET_H,
  SHEET_W,
  SHOTS,
  STORY_H,
  STORY_W,
  STRIP_W,
} from '../src/booth/config';
import { containRect, coverCrop } from '../src/booth/layout';

describe('print geometry', () => {
  it('fits two strips on a 4x6 sheet', () => {
    expect(SHEET_W).toBe(2 * STRIP_W);
  });

  it('leaves room for the footer under four cells', () => {
    expect(FOOTER_Y).toBe(MARGIN_TOP + SHOTS * CELL_H + (SHOTS - 1) * GAP);
    expect(FOOTER_Y + 272).toBeLessThan(SHEET_H); // last footer line (the code)
  });
});

describe('coverCrop', () => {
  it('crops the sides of a wide source', () => {
    const r = coverCrop(1920, 1080, 528, 352);
    expect(r.h).toBe(1080);
    expect(r.w).toBeCloseTo(1620);
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBe(0);
  });

  it('crops top and bottom of a tall source', () => {
    const r = coverCrop(1080, 1920, 528, 352);
    expect(r.w).toBe(1080);
    expect(r.h).toBeCloseTo(720);
    expect(r.y).toBeCloseTo(600);
  });
});

describe('story layout', () => {
  it('shows the whole strip, including the code footer', () => {
    const r = containRect(STRIP_W, SHEET_H, STORY_W, STORY_H, 0.94);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(STORY_W);
    expect(r.y + r.h).toBeLessThanOrEqual(STORY_H);
  });
});
