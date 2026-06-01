export const DEFAULT_MAX_SQL_BYTES = 256 * 1024;
export const ABSOLUTE_MAX_SQL_BYTES = 1024 * 1024;

const TRUNCATION_NOTICE_PREFIX = '-- dbt-tools:';

/** Bytes for one UTF-8 code point starting at `leadByte` (invalid sequences treated as length 1). */
function utf8CodePointByteLength(leadByte: number): number {
  if (leadByte < 0x80) return 1;
  if ((leadByte & 0xe0) === 0xc0) return 2;
  if ((leadByte & 0xf0) === 0xe0) return 3;
  if ((leadByte & 0xf8) === 0xf0) return 4;
  return 1;
}

/** Largest `end` ≤ `maxBytes` so `bytes.subarray(0, end)` is valid UTF-8. */
function utf8SafeEndIndex(bytes: Uint8Array, maxBytes: number): number {
  const capped = Math.min(maxBytes, bytes.byteLength);
  let end = capped;
  while (end > 0) {
    const lead = bytes[end - 1];
    if (lead === undefined) {
      break;
    }
    if ((lead & 0xc0) === 0x80) {
      end -= 1;
      continue;
    }
    const start = end - 1;
    const codePointBytes = utf8CodePointByteLength(lead);
    if (start + codePointBytes <= capped) {
      end = start + codePointBytes;
      break;
    }
    end = start;
  }
  return end;
}

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
  const end = utf8SafeEndIndex(bytes, capped);
  const truncatedText = new TextDecoder().decode(bytes.subarray(0, end));
  const notice = `${TRUNCATION_NOTICE_PREFIX} SQL truncated after ${capped} bytes`;
  return {
    text: `${truncatedText}\n${notice}\n`,
    truncated: true,
    originalBytes,
  };
}
