/**
 * Regression coverage for failures --type filtering without manifest.json.
 */
import { rmValidated } from '@dbt-tools/core';
import { describe, expect, it, vi } from 'vitest';

import { createJaffleRunResultsOnlyDir } from '../../internal/cli-test-bundle-dir';

import { failuresAction } from './failures-action';

describe('failuresAction resource type filtering', () => {
  it('filters by unique_id resource type when only run_results.json is present', async () => {
    const dbtTargetDir = await createJaffleRunResultsOnlyDir();
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handleError = (error: unknown) => {
      throw error;
    };

    try {
      await failuresAction(
        {
          dbtTarget: dbtTargetDir,
          json: true,
          status: 'success',
          type: 'model',
        },
        handleError,
      );

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as {
        failures: Array<{ unique_id: string }>;
      };

      expect(parsed.failures.length).toBeGreaterThan(0);
      expect(parsed.failures.every((row) => row.unique_id.startsWith('model.'))).toBe(true);
    } finally {
      consoleLogSpy.mockRestore();
      await rmValidated(dbtTargetDir, { recursive: true, force: true });
    }
  });
});
