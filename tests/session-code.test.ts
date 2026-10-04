import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  generateSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from '../src/shared/session-code';

describe('session codes', () => {
  it('generates 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateSessionCode();
      expect(code).toHaveLength(6);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
      expect(isValidSessionCode(code)).toBe(true);
    }
  });

  it('never uses look-alike characters', () => {
    for (const c of '01OIL') expect(CODE_ALPHABET).not.toContain(c);
  });

  it('normalizes what guests type', () => {
    expect(normalizeSessionCode(' 7k9 xpq ')).toBe('7K9XPQ');
    expect(normalizeSessionCode('7K9-XPQ')).toBe('7K9XPQ');
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', '7K9XP', '7K9XPQQ', '0K9XPQ', '../../', 'ABC/EF']) {
      expect(isValidSessionCode(bad)).toBe(false);
    }
  });
});
