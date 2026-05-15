/**
 * Trim leading and trailing U+002F in linear time. Used for object-storage key
 * prefixes; avoids polynomial-time regex on untrusted JSON/env input.
 */
export function normalizeSlashAffixes(value: string): string {
  const slash = 47;
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === slash) {
    start += 1;
  }
  while (end > start && value.charCodeAt(end - 1) === slash) {
    end -= 1;
  }
  return value.slice(start, end);
}
