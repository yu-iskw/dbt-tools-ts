import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';

function throwOverCap(maxBytes: number, labelForErrors: string): never {
  throw new Error(`Object exceeds configured maximum size (${maxBytes} bytes): ${labelForErrors}`);
}

/**
 * Reads an async-iterable byte stream (e.g. Node Readable) until `maxBytes` is exceeded
 * or the stream ends. Throws before buffering beyond the cap.
 */
export async function readStreamWithByteCap(
  stream: AsyncIterable<Buffer | Uint8Array | string>,
  maxBytes: number,
  labelForErrors: string,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    let buf: Buffer;
    if (Buffer.isBuffer(chunk)) {
      if (total + chunk.length > maxBytes) {
        throwOverCap(maxBytes, labelForErrors);
      }
      buf = chunk;
      total += chunk.length;
    } else if (chunk instanceof Uint8Array) {
      const addLen = chunk.byteLength;
      if (total + addLen > maxBytes) {
        throwOverCap(maxBytes, labelForErrors);
      }
      buf = Buffer.from(chunk);
      total += addLen;
    } else if (typeof chunk === 'string') {
      const s = chunk;
      const addLen = Buffer.byteLength(s, 'utf8');
      if (total + addLen > maxBytes) {
        throwOverCap(maxBytes, labelForErrors);
      }
      buf = Buffer.from(s, 'utf8');
      total += addLen;
    } else {
      throw new Error(`Unsupported stream chunk type for ${labelForErrors}`);
    }
    chunks.push(buf);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export async function readFileWithByteCap(filePath: string, maxBytes: number): Promise<Uint8Array> {
  const stream = createReadStream(filePath) as Readable;
  try {
    return await readStreamWithByteCap(stream, maxBytes, filePath);
  } finally {
    stream.destroy();
  }
}
