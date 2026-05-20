/**
 * Constant-time string compare for non-secret categorical tokens (e.g. materialization aliases).
 * Pure JS so the same helper works in Node and browser/worker bundles (no node:crypto).
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
