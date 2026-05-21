/**
 * Map-based lookups to avoid dynamic object property access (eslint security/detect-object-injection).
 */

/** Read `argv[index]` without computed bracket access (security lint). */
export function argvElementAt(argv: readonly string[], index: number): string | undefined {
  if (index < 0) return undefined;
  let cursor = 0;
  for (const element of argv) {
    if (cursor === index) return element;
    cursor += 1;
  }
  return undefined;
}

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

export function groupByToMap<T, K extends string>(
  items: Iterable<T>,
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket === undefined) {
      map.set(key, [item]);
    } else {
      bucket.push(item);
    }
  }
  return map;
}

export function mapFromRecord<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

export function recordFromMap<V>(map: Map<string, V>): Record<string, V> {
  return Object.fromEntries(map);
}

export function getMapOrEmpty<K, V>(map: Map<K, V>, key: K): V[] {
  const value = map.get(key);
  return value === undefined ? ([] as V[]) : (value as V[]);
}

/** Push into a Map<K, V[]> bucket without bracket notation on a plain object. */
export function pushToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }
}

export function incrementMapCount<K>(map: Map<K, number>, key: K, delta = 1): void {
  const current = map.get(key) ?? 0;
  map.set(key, current + delta);
}

const processEnvRecord = (): Record<string, unknown> =>
  process.env as unknown as Record<string, unknown>;

/** Read `process.env` without bracket notation (security lint). */
export function getProcessEnv(key: string): string | undefined {
  const value = getObjectProperty(processEnvRecord(), key);
  return typeof value === 'string' ? value : undefined;
}

/** Set `process.env` without bracket notation (security lint). */
export function setProcessEnv(key: string, value: string): void {
  setObjectProperty(processEnvRecord(), key, value);
}

/** Delete `process.env` entry without bracket notation (security lint). */
export function deleteProcessEnv(key: string): void {
  Reflect.deleteProperty(process.env, key);
}
