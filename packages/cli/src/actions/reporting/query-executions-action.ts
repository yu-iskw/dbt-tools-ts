import { FieldFilter, shouldOutputJSON, type QueryExecutionsOutput, type WarehouseAdapterType } from '@dbt-tools/core';

import { type ArtifactRootCliOptions } from '../../internal/cli-artifact-resolve';
import { assertOffsetRequiresLimit, parseListOffset } from '../../internal/cli-pagination';
import {
  createCliUseCaseRunner,
  emitCliUseCaseOutput,
  type CliUseCaseRunOptions,
} from '../../internal/cli-use-case-runner';

export type QueryExecutionsOptions = ArtifactRootCliOptions &
  CliUseCaseRunOptions & {
    warehouse?: WarehouseAdapterType;
    sort?: string;
    status?: string;
    limit?: number;
    offset?: number;
    resourceTypes?: string;
    uniqueIdPattern?: string;
    minExecutionTime?: number;
    maxExecutionTime?: number;
    minSlotMs?: number;
    minBytesProcessed?: number;
    minBytesBilled?: number;
    minRowsAffected?: number;
    minRowsInserted?: number;
    minRowsUpdated?: number;
    minRowsDeleted?: number;
    minRowsDuplicated?: number;
    fields?: string;
  };

function parseResourceTypes(csv: string | undefined): string[] | undefined {
  if (csv == null || csv.trim() === '') return undefined;
  return csv
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildRegistryInput(options: QueryExecutionsOptions) {
  const sort = options.sort as
    | 'execution_time_asc'
    | 'execution_time_desc'
    | 'unique_id'
    | undefined;
  const warehouse = options.warehouse;
  const warehouseBlock =
    warehouse == null
      ? {}
      : {
          [warehouse]: {
            ...(sort != null ? { sort } : {}),
            minSlotMs: options.minSlotMs,
            minBytesProcessed: options.minBytesProcessed,
            minBytesBilled: options.minBytesBilled,
            minRowsAffected: options.minRowsAffected,
            minRowsInserted: options.minRowsInserted,
            minRowsUpdated: options.minRowsUpdated,
            minRowsDeleted: options.minRowsDeleted,
            minRowsDuplicated: options.minRowsDuplicated,
          },
        };

  return {
    resourceTypes: parseResourceTypes(options.resourceTypes),
    status: options.status,
    limit: options.limit,
    offset: options.offset,
    uniqueIdPattern: options.uniqueIdPattern,
    minExecutionTime: options.minExecutionTime,
    maxExecutionTime: options.maxExecutionTime,
    ...(sort != null && warehouse == null ? { sort } : {}),
    ...warehouseBlock,
  };
}

function formatQueryExecutionsHuman(output: QueryExecutionsOutput): string {
  const lines: string[] = [];
  lines.push('dbt-tools query-executions');
  lines.push('========================');
  lines.push(
    `Matched ${output.total_matched} (showing ${output.returned}, sort ${output.sort}, warehouse ${output.run_warehouse})`,
  );
  if (output.has_more) {
    lines.push('(more rows — increase --limit or use --offset with --limit)');
  }
  lines.push('');
  if (output.rows.length === 0) {
    lines.push('(no matching executions)');
  } else {
    for (const row of output.rows) {
      lines.push(`${row.unique_id}  [${row.status}]  ${row.execution_time}s`);
    }
  }
  return lines.join('\n');
}

export async function queryExecutionsAction(
  options: QueryExecutionsOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const offset = parseListOffset(options.offset);
    assertOffsetRequiresLimit(options.limit, offset);

    const runner = await createCliUseCaseRunner({ dbtTarget: options.dbtTarget });
    const output = await runner.runUseCase<QueryExecutionsOutput>(
      'runs.query',
      buildRegistryInput({ ...options, offset }),
    );

    if (options.json && options.fields) {
      emitCliUseCaseOutput(FieldFilter.filterFields(output, options.fields), options);
      return;
    }

    emitCliUseCaseOutput(output, options, formatQueryExecutionsHuman);
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
