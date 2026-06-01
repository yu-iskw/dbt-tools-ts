import { describe, expect, it } from 'vitest';

import { truncateSqlText } from './sql-truncation.js';

describe('truncateSqlText', () => {
  it('does not split a multibyte code point at the byte cap', () => {
    const prefix = 'select ';
    const sql = `${prefix}é`; // é is 2 UTF-8 bytes after 7-byte ASCII prefix
    const maxBytes = new TextEncoder().encode(prefix).byteLength + 1;
    const { text, truncated } = truncateSqlText(sql, maxBytes);
    expect(truncated).toBe(true);
    expect(text).not.toContain('\uFFFD');
    expect(text.startsWith(prefix)).toBe(true);
    expect(text.includes('é')).toBe(false);
  });

  it('keeps a complete multibyte character when it ends exactly at the cap', () => {
    const sql = 'xé';
    const maxBytes = new TextEncoder().encode(sql).byteLength;
    const { text, truncated } = truncateSqlText(sql, maxBytes);
    expect(truncated).toBe(false);
    expect(text).toBe(sql);
  });

  it('truncates a 4-byte emoji without replacement characters', () => {
    const prefix = 'a'.repeat(100);
    const sql = `${prefix}😀`;
    const maxBytes = new TextEncoder().encode(prefix).byteLength + 2;
    const { text, truncated } = truncateSqlText(sql, maxBytes);
    expect(truncated).toBe(true);
    expect(text).not.toContain('\uFFFD');
    expect(text.includes('😀')).toBe(false);
  });
});
