import { describe, expect, it } from 'vitest';
import {
  ALL_CELL_H,
  ALL_CELL_W,
  ALL_COLS,
  ALL_FOOTER_Y,
  ALL_GAP,
  ALL_MARGIN,
  BIG_CELL_H,
  BIG_CELL_W,
  BIG_COLS,
  BIG_FOOTER_Y,
  BIG_ROWS,
  CELL_H,
  CELL_W,
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

  it('matches the frame template: 520×340 holes at 40,43 with a 37 px gap', () => {
    expect(2 * MARGIN_X + CELL_W).toBe(STRIP_W);
    expect(MARGIN_TOP + 4 * CELL_H + 3 * GAP).toBe(1514);
    expect(FOOTER_Y).toBe(MARGIN_TOP + STRIP_SHOTS * CELL_H + (STRIP_SHOTS - 1) * GAP);
    expect(FOOTER_Y + 252).toBeLessThan(SHEET_H); // last footer line (the code)
  });
});

describe('big print geometry', () => {
  it('has 2.55 × 3.5 cm cells at 300 dpi, edge to edge', () => {
    const cm = (px: number) => (px / 300) * 2.54;
    expect(cm(BIG_CELL_W)).toBeCloseTo(2.54, 1);
    expect(cm(BIG_CELL_H)).toBeCloseTo(3.5, 1);
    expect(BIG_COLS * BIG_CELL_W).toBe(SHEET_W);
  });

  it('fits every photo once in each half, with room for the footer', () => {
    expect((BIG_COLS / 2) * BIG_ROWS).toBe(SHOTS);
    expect(BIG_FOOTER_Y).toBe(BIG_ROWS * BIG_CELL_H);
    expect(SHEET_H - BIG_FOOTER_Y).toBeGreaterThanOrEqual(140);
  });
});

describe('digital all-photos sheet', () => {
  it('fits 8 landscape photos in 2 columns across the sheet', () => {
    expect(ALL_COLS * 4).toBe(SHOTS);
    expect(2 * ALL_MARGIN + ALL_COLS * ALL_CELL_W + (ALL_COLS - 1) * ALL_GAP).toBe(SHEET_W);
    expect(ALL_CELL_W / ALL_CELL_H).toBeCloseTo(1.5, 1);
    expect(SHEET_H - ALL_FOOTER_Y).toBeGreaterThanOrEqual(200);
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
