/**
 * Record accessors without computed bracket access (eslint security/detect-object-injection).
 * E2E-local mirror of @dbt-tools/core util/typed-map helpers.
 */

/** Read an own property without computed bracket access (security lint). */
export function getObjectProperty(obj: Record<string, unknown>, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    return undefined;
  }
  return Object.getOwnPropertyDescriptor(obj, key)?.value;
}

/** Set an own enumerable property without computed bracket access (security lint). */
export function setObjectProperty(obj: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
