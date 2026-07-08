import { describe, expect, it } from 'vitest';

import { parseUntrustedJson } from './parse-untrusted-json.js';

describe('parseUntrustedJson', () => {
  it('returns null-prototype objects', () => {
    const parsed = parseUntrustedJson('{"a":1}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(parsed.a).toBe(1);
  });

  it('drops pollution keys', () => {
    const parsed = parseUntrustedJson(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"safe":"ok"}',
    ) as Record<string, unknown>;
    expect(parsed.safe).toBe('ok');
    expect('__proto__' in parsed).toBe(false);
    expect('constructor' in parsed).toBe(false);
    expect('prototype' in parsed).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('revives nested structures', () => {
    const parsed = parseUntrustedJson('{"nodes":[{"id":"x"}]}') as {
      nodes: Record<string, unknown>[];
    };
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Object.getPrototypeOf(parsed.nodes[0]!)).toBeNull();
  });
});
