/**
 * Parse untrusted JSON with null-prototype objects (RFC-0001 §7.3, CWE-1321).
 */
export function parseUntrustedJson(text: string): unknown {
  return reviveWithoutPrototype(JSON.parse(text));
}

function reviveWithoutPrototype(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveWithoutPrototype(item));
  }
  const result = Object.create(null) as Record<string, unknown>;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    // nosemgrep: eslint.security.detect-object-injection -- keys filtered; null-prototype target
    result[key] = reviveWithoutPrototype(child);
  }
  return result;
}
