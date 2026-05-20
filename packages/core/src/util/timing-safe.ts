import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string compare for non-secret categorical tokens (e.g. materialization aliases).
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
