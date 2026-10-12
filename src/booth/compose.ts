import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import {
  CELL_H,
  CELL_W,
  COLORS,
  FONT_FAMILY,
  FOOTER_Y,
  GAP,
  GIF_FRAME_MS,
  GIF_H,
  GIF_W,
  MARGIN_TOP,
  MARGIN_X,
  SHEET_H,
  SHEET_W,
  STORY_H,
  STORY_W,
  STRIP_W,
} from './config';
import type { FrameStyle } from './gacha';
import { containRect, coverCrop } from './layout';

export interface StripInfo {
  code: string;
  eventName: string;
  date: Date;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const s = coverCrop(src.width, src.height, dw, dh);
  ctx.drawImage(src, s.x, s.y, s.w, s.h, dx, dy, dw, dh);
}

/** Canvas text silently falls back to another font if the web font isn't loaded yet. */
export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all(
      ['800 58px', '600 30px'].map((f) => document.fonts.load(`${f} "Bricolage Grotesque"`)),
    );
  } catch {
    // Offline — the fallback font is fine.
  }
}

/**
 * Plain-colour frame art from the gacha roll. Swap for drawImage(framePNG, ...)
 * once the designers export 600x1800 PNGs with transparent photo cutouts.
 */
function drawStrip(
  ctx: CanvasRenderingContext2D,
  ox: number,
  shots: HTMLCanvasElement[],
  info: StripInfo,
  frame: FrameStyle,
): void {
  ctx.fillStyle = frame.bg;
  ctx.fillRect(ox, 0, STRIP_W, SHEET_H);

  shots.forEach((shot, i) => {
    const x = ox + MARGIN_X;
    const y = MARGIN_TOP + i * (CELL_H + GAP);
    ctx.fillStyle = frame.border;
    ctx.fillRect(x - 2, y - 2, CELL_W + 4, CELL_H + 4);
    drawCover(ctx, shot, x, y, CELL_W, CELL_H);
  });

  const cx = ox + STRIP_W / 2;
  const date = info.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: [string, string, string, number][] = [
    ['PHOTOBOOTH', frame.ink, `800 58px ${FONT_FAMILY}`, 92],
    [date, frame.dim, `600 30px ${FONT_FAMILY}`, 146],
    [info.eventName.toUpperCase(), frame.accent, `600 26px ${FONT_FAMILY}`, 196],
    ['YOUR CODE', frame.dim, `600 20px ${FONT_FAMILY}`, 236],
    [info.code.split('').join(' '), frame.ink, '700 34px ui-monospace, SFMono-Regular, Menlo, monospace', 272],
  ];
  ctx.textAlign = 'center';
  for (const [text, color, font, dy] of lines) {
    if (!text) continue;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(text, cx, FOOTER_Y + dy, STRIP_W - 2 * MARGIN_X);
  }
}

export function buildStrip(
  shots: HTMLCanvasElement[],
  info: StripInfo,
  frame: FrameStyle,
): HTMLCanvasElement {
  const [c, ctx] = canvas(STRIP_W, SHEET_H);
  drawStrip(ctx, 0, shots, info, frame);
  return c;
}

/** Small JPEG of the strip for the tablet's result screen. */
export function stripThumbnail(strip: HTMLCanvasElement, width = 300): string {
  const h = Math.round((strip.height * width) / strip.width);
  const [c, ctx] = canvas(width, h);
  ctx.drawImage(strip, 0, 0, width, h);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Print sheet: two identical strips side by side. */
export function buildSheet(strip: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvas(SHEET_W, SHEET_H);
  ctx.drawImage(strip, 0, 0);
  ctx.drawImage(strip, STRIP_W, 0);
  return c;
}

/** 9:16 story image with the whole strip visible. */
export function buildStory(strip: HTMLCanvasElement, frame: FrameStyle): HTMLCanvasElement {
  const [c, ctx] = canvas(STORY_W, STORY_H);
  ctx.fillStyle = frame.storyBg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  const r = containRect(STRIP_W, SHEET_H, STORY_W, STORY_H, 0.94);
  ctx.drawImage(strip, r.x, r.y, r.w, r.h);
  return c;
}

export function buildGif(shots: HTMLCanvasElement[]): Blob {
  const enc = GIFEncoder();
  const [, ctx] = canvas(GIF_W, GIF_H);
  for (const shot of shots) {
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, GIF_W, GIF_H);
    drawCover(ctx, shot, 0, 0, GIF_W, GIF_H);
    const { data } = ctx.getImageData(0, 0, GIF_W, GIF_H);
    const palette = quantize(data, 256);
    enc.writeFrame(applyPalette(data, palette), GIF_W, GIF_H, { palette, delay: GIF_FRAME_MS });
  }
  enc.finish();
  return new Blob([enc.bytes() as BlobPart], { type: 'image/gif' });
}

export function toJpeg(c: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', quality),
  );
}
