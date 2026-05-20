/**
 * Tests for failuresAction.
 */
import { rmValidated } from '@dbt-tools/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleRunResultsOnlyDir,
} from '../../internal/cli-test-bundle-dir';

import { failuresAction } from './failures-action';

describe('failuresAction', () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let dbtTargetDir: string;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    dbtTargetDir = await createJaffleArtifactBundleDir();
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    await rmValidated(dbtTargetDir, { recursive: true, force: true });
  });

  it('outputs failures JSON with schema_version and summary', async () => {
    await failuresAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      schema_version: number;
      summary: {
        non_success_total: number;
        returned: number;
        limit: number;
        has_more: boolean;
      };
      failures: Array<{ unique_id: string; status: string }>;
      next_commands: string[];
      primitive_commands: string[];
    };
    expect(parsed.schema_version).toBe(1);
    expect(parsed.summary.limit).toBe(50);
    expect(Array.isArray(parsed.failures)).toBe(true);
    expect(Array.isArray(parsed.next_commands)).toBe(true);
    expect(Array.isArray(parsed.primitive_commands)).toBe(true);
    expect(parsed.failures.every((f) => f.status !== 'success' && f.status !== 'pass')).toBe(true);
  });

  it('works when only run_results.json is present', async () => {
    const runResultsOnlyDir = await createJaffleRunResultsOnlyDir();
    try {
      await failuresAction({ dbtTarget: runResultsOnlyDir, json: true, limit: 5 }, handleError);
      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as { failures: unknown[] };
      expect(parsed.failures.length).toBeLessThanOrEqual(5);
    } finally {
      await rmValidated(runResultsOnlyDir, { recursive: true, force: true });
    }
  });

  it('respects --limit for paging', async () => {
    await failuresAction({ dbtTarget: dbtTargetDir, json: true, limit: 2, offset: 0 }, handleError);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      failures: unknown[];
      summary: { has_more: boolean; returned: number };
    };
    expect(parsed.failures.length).toBeLessThanOrEqual(2);
    expect(parsed.summary.returned).toBe(parsed.failures.length);
  });
});
