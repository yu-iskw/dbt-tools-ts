import { queryExecutionsInputSchema } from '@dbt-tools/core/contracts';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { emitCliUseCaseOutput } from './cli-use-case-runner';

describe('emitCliUseCaseOutput', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it('applies --fields when stdout defaults to JSON (non-TTY)', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    emitCliUseCaseOutput(
      { total: 3, results: [{ unique_id: 'model.a.b' }] },
      {
        fields: 'total',
      },
    );

    const output = JSON.parse(logSpy.mock.calls[0]![0] as string) as {
      total: number;
      results?: unknown;
    };
    expect(output.total).toBe(3);
    expect(output.results).toBeUndefined();
  });
});

describe('query executions registry input', () => {
  it('rejects BigQuery-only keys on postgres warehouse blocks', () => {
    const invalid = queryExecutionsInputSchema.safeParse({
      limit: 1,
      postgres: {
        minSlotMs: 1,
        minBytesBilled: 1,
      },
    });
    expect(invalid.success).toBe(false);
  });

  it('accepts postgres warehouse blocks with only base adapter keys', () => {
    const valid = queryExecutionsInputSchema.safeParse({
      limit: 1,
      postgres: {
        minBytesProcessed: 100,
      },
    });
    expect(valid.success).toBe(true);
  });
});
