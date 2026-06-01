import { ArtifactTargetNotConfiguredError } from '@dbt-tools/core';
import { runSummaryOutputSchema } from '@dbt-tools/core/contracts';
import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';

import { runToolWithLoadedUseCases } from './loaded-use-cases.js';

import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';

describe('runToolWithLoadedUseCases', () => {
  it('returns target-not-configured tool error', async () => {
    const useCases = {
      getRunSummary: async () => {
        throw new ArtifactTargetNotConfiguredError();
      },
    } as unknown as DbtToolsUseCases;

    const result = await runToolWithLoadedUseCases(runSummaryOutputSchema, useCases, (uc) =>
      uc.getRunSummary(),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: ArtifactTargetNotConfiguredError.message,
    });
  });

  it('maps ZodError to output_schema_validation tool error', async () => {
    const useCases = {
      getRunSummary: async () => {
        throw new z.ZodError([]);
      },
    } as unknown as DbtToolsUseCases;

    const result = await runToolWithLoadedUseCases(runSummaryOutputSchema, useCases, (uc) =>
      uc.getRunSummary(),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: 'Internal tool output contract validation failed.',
      code: 'output_schema_validation',
    });
  });
});
