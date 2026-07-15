import { shouldOutputJSON } from '@dbt-tools/core';

import { type ArtifactRootCliOptions } from '../../internal/cli-artifact-resolve';
import {
  createCliUseCaseRunner,
  emitCliUseCaseOutput,
  type CliUseCaseRunOptions,
} from '../../internal/cli-use-case-runner';

import type { RunSummaryOutput } from '@dbt-tools/core/contracts';

export type RunSummaryOptions = ArtifactRootCliOptions &
  CliUseCaseRunOptions & {
    fields?: string;
  };

function formatRunSummaryHuman(output: RunSummaryOutput): string {
  const lines: string[] = [];
  lines.push('dbt-tools run-summary');
  lines.push('====================');
  lines.push(`Total execution time: ${output.summary.total_execution_time}s`);
  lines.push(`Total nodes: ${output.summary.total_nodes}`);
  lines.push(`Warehouse: ${output.warehouse_type}`);
  if (output.bottlenecks?.nodes?.length) {
    lines.push('');
    lines.push('Top bottlenecks (execution time):');
    for (const node of output.bottlenecks.nodes.slice(0, 5)) {
      lines.push(`  ${node.unique_id}  ${node.execution_time}s  (${node.pct_of_total}%)`);
    }
  }
  return lines.join('\n');
}

export async function runSummaryAction(
  options: RunSummaryOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const runner = await createCliUseCaseRunner({ dbtTarget: options.dbtTarget });
    const output = await runner.runUseCase<RunSummaryOutput>('runs.summary', {});

    emitCliUseCaseOutput(output, options, formatRunSummaryHuman);
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
