import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import {
  CELL_H,
  CELL_W,
  COLORS,
  FONTS,
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
    await Promise.all([
      document.fonts.load(`400 92px ${FONTS.script}`),
      document.fonts.load(`400 34px ${FONTS.chunky}`),
      document.fonts.load(`700 24px ${FONTS.body}`),
    ]);
  } catch {
    // Fonts are bundled, so this only fails in very old browsers; the fallback is fine.
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

  // Footer: the Dearly logo, date, event and the session code for the gallery.
  const cx = ox + STRIP_W / 2;
  const maxW = STRIP_W - 2 * MARGIN_X;
  const date = info.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: [string, string, string, number][] = [
    ['Dearly', frame.ink, `400 92px ${FONTS.script}`, 96],
    ['Photobooth', frame.accent, `400 34px ${FONTS.chunky}`, 140],
    [date, frame.dim, `700 24px ${FONTS.body}`, 188],
    [info.eventName, frame.dim, `800 21px ${FONTS.body}`, 222],
    [`Kode ${info.code}`, frame.ink, `400 30px ${FONTS.chunky}`, 276],
  ];
  ctx.textAlign = 'center';
  for (const [text, color, font, dy] of lines) {
    if (!text) continue;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(text, cx, FOOTER_Y + dy, maxW);
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

/** Blue gingham like the brand background: overlapping half-transparent stripes. */
function drawGingham(ctx: CanvasRenderingContext2D, w: number, h: number, size: number): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.check;
  for (let x = 0; x < w; x += size) ctx.fillRect(x, 0, size / 2, h);
  for (let y = 0; y < h; y += size) ctx.fillRect(0, y, w, size / 2);
  // Fine diagonal weave.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let d = -h; d < w; d += 7) {
    ctx.moveTo(d, h);
    ctx.lineTo(d + h, 0);
  }
  ctx.stroke();
  ctx.restore();
}

/** 9:16 story image: the strip, slightly tilted, on the Dearly gingham. */
export function buildStory(strip: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvas(STORY_W, STORY_H);
  drawGingham(ctx, STORY_W, STORY_H, 150);
  const r = containRect(STRIP_W, SHEET_H, STORY_W, STORY_H, 0.86);
  ctx.save();
  ctx.translate(STORY_W / 2, STORY_H / 2);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.drawImage(strip, -r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();
  return c;
}

export function buildGif(shots: HTMLCanvasElement[]): Blob {
  const enc = GIFEncoder();
  const [, ctx] = canvas(GIF_W, GIF_H);
  for (const shot of shots) {
    ctx.fillStyle = COLORS.cream;
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
