export const DEFAULT_MAX_SQL_BYTES = 256 * 1024;
export const ABSOLUTE_MAX_SQL_BYTES = 1024 * 1024;

const TRUNCATION_NOTICE_PREFIX = '-- dbt-tools:';

export function truncateSqlText(
  text: string,
  maxBytes: number = DEFAULT_MAX_SQL_BYTES,
): { text: string; truncated: boolean; originalBytes: number } {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const originalBytes = bytes.byteLength;
  if (originalBytes <= maxBytes) {
    return { text, truncated: false, originalBytes };
  }

  const capped = Math.min(maxBytes, ABSOLUTE_MAX_SQL_BYTES);
  let end = capped;
  while (end > 0) {
    const byte = bytes[end - 1];
    if (byte === undefined || (byte & 0xc0) !== 0x80) {
      break;
    }
    end -= 1;
  }
  const truncatedText = new TextDecoder().decode(bytes.subarray(0, end));
  const notice = `${TRUNCATION_NOTICE_PREFIX} SQL truncated after ${capped} bytes`;
  return {
    text: `${truncatedText}\n${notice}\n`,
    truncated: true,
    originalBytes,
  };
}
