import { describe, expect, it } from 'vitest';
import {
  BIG_CELL_H,
  BIG_CELL_W,
  BIG_COLS,
  BIG_FOOTER_Y,
  CELL_H,
  FOOTER_Y,
  GAP,
  MARGIN_TOP,
  MARGIN_X,
  SHOTS,
  SHEET_H,
  SHEET_W,
  STRIP_SHOTS,
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
    expect(FOOTER_Y).toBe(MARGIN_TOP + STRIP_SHOTS * CELL_H + (STRIP_SHOTS - 1) * GAP);
    expect(FOOTER_Y + 272).toBeLessThan(SHEET_H); // last footer line (the code)
  });
});

describe('big print geometry', () => {
  it('fits all photos in 2 columns of 3:2 cells across the sheet', () => {
    expect(BIG_COLS * 4).toBe(SHOTS);
    expect(2 * MARGIN_X + BIG_COLS * BIG_CELL_W + (BIG_COLS - 1) * GAP).toBe(SHEET_W);
    expect(BIG_CELL_W / BIG_CELL_H).toBeCloseTo(1.5, 1);
  });

  it('leaves room for one shared footer', () => {
    expect(BIG_FOOTER_Y).toBe(MARGIN_TOP + 4 * BIG_CELL_H + 3 * GAP);
    expect(SHEET_H - BIG_FOOTER_Y).toBeGreaterThanOrEqual(200);
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
