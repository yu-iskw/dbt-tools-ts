/** Minimal decode for HTML entities that sometimes appear in cloud SDK error strings. */
export function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}
