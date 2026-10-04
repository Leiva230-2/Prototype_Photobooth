/** Every session's files live under booth/<CODE>/<asset>. */
export const ASSETS = {
  sheet: { name: 'sheet', ext: 'jpg' },
  story: { name: 'story', ext: 'jpg' },
  gif: { name: 'anim', ext: 'gif' },
} as const;

export type AssetKey = keyof typeof ASSETS;

export const DEFAULT_CLOUD_NAME: string = import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || 'fbhrxtkn';

export function publicId(code: string, asset: AssetKey): string {
  return `booth/${code}/${ASSETS[asset].name}`;
}

export function deliveryUrl(cloud: string, code: string, asset: AssetKey): string {
  const { ext } = ASSETS[asset];
  return `https://res.cloudinary.com/${cloud}/image/upload/${publicId(code, asset)}.${ext}`;
}

/** fl_attachment forces a real download — the `download` attribute is ignored on cross-origin links. */
export function attachmentUrl(cloud: string, code: string, asset: AssetKey): string {
  const { ext } = ASSETS[asset];
  return `https://res.cloudinary.com/${cloud}/image/upload/fl_attachment/${publicId(code, asset)}.${ext}`;
}

/** Appends ?s=CODE (or &s=CODE) to the hosted gallery page URL. */
export function galleryLink(galleryUrl: string, code: string): string {
  const url = new URL(galleryUrl);
  url.searchParams.set('s', code);
  return url.toString();
}

export async function uploadUnsigned(
  cloud: string,
  preset: string,
  blob: Blob,
  id: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', preset);
  form.append('public_id', id);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}
