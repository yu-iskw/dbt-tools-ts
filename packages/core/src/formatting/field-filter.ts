import { getObjectProperty, setObjectProperty } from '../util/typed-map';

/**
 * FieldFilter provides field selection to reduce context window usage.
 * Supports simple and nested field paths.
 */
export class FieldFilter {
  /**
   * Filter fields from an object based on a comma-separated field list
   */
  static filterFields<T>(data: T, fields?: string): Partial<T> {
    if (!fields || !fields.trim()) {
      return data as Partial<T>;
    }

    if (!data || typeof data !== 'object') {
      return data as Partial<T>;
    }

    const fieldList = fields
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    if (fieldList.length === 0) {
      return data as Partial<T>;
    }

    return this.filterObjectFields(data as Record<string, unknown>, fieldList) as Partial<T>;
  }

  /**
   * Filter fields from an array of objects
   */
  static filterArrayFields<T>(data: T[], fields?: string): Partial<T>[] {
    if (!fields || !fields.trim()) {
      return data as Partial<T>[];
    }

    if (!Array.isArray(data)) {
      return data as Partial<T>[];
    }

    return data.map((item) => this.filterFields(item, fields));
  }

  /**
   * Filter fields from an object using field paths
   */
  private static filterObjectFields(
    obj: Record<string, unknown>,
    fieldPaths: string[],
  ): Partial<Record<string, unknown>> {
    const result: Record<string, unknown> = Object.create(null);

    for (const fieldPath of fieldPaths) {
      const value = this.getNestedValue(obj, fieldPath);
      if (value !== undefined) {
        this.setNestedValue(result, fieldPath, value);
      }
    }

    return result;
  }

  /** Rejects prototype-pollution keys (__proto__, constructor, prototype). */
  private static isUnsafeKey(part: string): boolean {
    return part === '__proto__' || part === 'constructor' || part === 'prototype';
  }

  /**
   * Get a nested value from an object using dot notation.
   * Rejects prototype-pollution keys (__proto__, constructor, prototype).
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (this.isUnsafeKey(part)) return undefined;
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      if (!Object.prototype.hasOwnProperty.call(current as object, part)) {
        return undefined;
      }
      current = getObjectProperty(current as Record<string, unknown>, part);
    }

    return current;
  }

  /**
   * Set a nested value in an object using dot notation
   */
  private static setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (const part of parts.slice(0, -1)) {
      if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
        return;
      }
      const existing = getObjectProperty(current, part);
      if (existing === undefined || typeof existing !== 'object' || existing === null) {
        setObjectProperty(current, part, Object.create(null));
      }
      current = getObjectProperty(current, part) as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart === '__proto__' || lastPart === 'constructor' || lastPart === 'prototype') {
      return;
    }
    setObjectProperty(current, lastPart, value);
  }
}
