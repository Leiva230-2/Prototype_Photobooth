/** Pure geometry helpers, kept DOM-free so they can be unit tested. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Source rectangle for a centered "object-fit: cover" crop. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const w = srcH * dstRatio;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / dstRatio;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

/** Destination rectangle for a centered "object-fit: contain", scaled down by `padding`. */
export function containRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  padding = 1,
): Rect {
  const scale = Math.min(dstW / srcW, dstH / srcH) * padding;
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}
