/**
 * Session codes are printed on the strip and used as the Cloudinary
 * public_id namespace, so guests can find their photos later without us
 * handing out raw Cloudinary URLs.
 */

/** No 0/O or 1/I/L — easy to read off a printed strip. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function generateSessionCode(length = CODE_LENGTH): string {
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let code = '';
  while (code.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && code.length < length) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return code;
}

/** Uppercases and strips spaces/dashes, so "7k9 xpq" still works. */
export function normalizeSessionCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidSessionCode(code: string): boolean {
  return CODE_RE.test(code);
}
