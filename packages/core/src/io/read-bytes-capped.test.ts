import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readFileWithByteCap, readStreamWithByteCap } from './read-bytes-capped';

describe('readStreamWithByteCap', () => {
  it('returns bytes when under the cap', async () => {
    async function* gen() {
      yield Buffer.from('ab');
      yield Buffer.from('c');
    }
    const out = await readStreamWithByteCap(gen(), 10, 'test');
    expect(Buffer.from(out).toString('utf8')).toBe('abc');
  });

  it('throws when cumulative size exceeds the cap', async () => {
    async function* gen() {
      yield Buffer.from('a');
      yield Buffer.from('b');
    }
    await expect(readStreamWithByteCap(gen(), 1, 'k')).rejects.toThrow(
      /Object exceeds configured maximum size \(1 bytes\): k/,
    );
  });

  it('reads from a Node Readable and throws when stream exceeds cap', async () => {
    const r = Readable.from(
      (async function* () {
        yield Buffer.from('x');
        yield Buffer.from('y');
      })(),
    );
    await expect(readStreamWithByteCap(r, 1, 'stream')).rejects.toThrow(
      /Object exceeds configured maximum size/,
    );
  });

  it('throws before buffering an oversized UTF-8 string chunk when cap would be exceeded', async () => {
    async function* gen() {
      yield 'aa';
      yield 'bbbbbbbbbb';
    }
    await expect(readStreamWithByteCap(gen(), 10, 'utf8')).rejects.toThrow(
      /Object exceeds configured maximum size \(10 bytes\): utf8/,
    );
  });

  it('throws when a Uint8Array chunk alone exceeds the cap', async () => {
    async function* gen() {
      yield new Uint8Array([1, 2, 3, 4, 5]);
    }
    await expect(readStreamWithByteCap(gen(), 4, 'u8')).rejects.toThrow(
      /Object exceeds configured maximum size \(4 bytes\): u8/,
    );
  });
});

describe('readFileWithByteCap', () => {
  it('throws when file content exceeds cap', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-read-cap-'));
    const file = path.join(dir, 'big.txt');
    try {
      await fs.writeFile(file, 'z'.repeat(500), 'utf8');
      await expect(readFileWithByteCap(file, 100)).rejects.toThrow(
        /Object exceeds configured maximum size \(100 bytes\)/,
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
