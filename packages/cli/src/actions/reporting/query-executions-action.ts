import * as fs from 'node:fs/promises';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import {
  buildAnalysisSnapshotFromParsedArtifacts,
  formatOutput,
  FieldFilter,
  queryExecutions,
  shouldOutputJSON,
  validateSafePath,
  type QueryExecutionsOutput,
  type QueryExecutionsRequest,
  type WarehouseAdapterType,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { assertOffsetRequiresLimit, parseListOffset } from '../../internal/cli-pagination';

export type QueryExecutionsOptions = {
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
  json?: boolean;
  noJson?: boolean;
} & ArtifactRootCliOptions;

async function readArtifactJson(path: string): Promise<Record<string, unknown>> {
  const text = await fs.readFile(path, 'utf8');
  return JSON.parse(text) as Record<string, unknown>;
}

function parseResourceTypes(csv: string | undefined): string[] | undefined {
  if (csv == null || csv.trim() === '') return undefined;
  return csv
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildRequest(options: QueryExecutionsOptions): QueryExecutionsRequest {
  const sort = options.sort as QueryExecutionsRequest['sort'] | undefined;
  const base: QueryExecutionsRequest = {
    resourceTypes: parseResourceTypes(options.resourceTypes),
    status: options.status,
    limit: options.limit,
    offset: options.offset,
    uniqueIdPattern: options.uniqueIdPattern,
    minExecutionTime: options.minExecutionTime,
    maxExecutionTime: options.maxExecutionTime,
    ...(sort != null ? { sort } : {}),
  };

  const warehouse = options.warehouse;
  if (warehouse == null) return base;

  return {
    ...base,
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

    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: true },
    );
    validateSafePath(paths.runResults);
    validateSafePath(paths.manifest);

    const [manifestJson, runResultsJson] = await Promise.all([
      readArtifactJson(paths.manifest),
      readArtifactJson(paths.runResults),
    ]);
    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const { analysis, graph } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      manifest,
      runResults,
    );
    const output = queryExecutions(analysis.executions, buildRequest(options), {
      warehouseType: manifest.metadata?.adapter_type ?? null,
      graph,
    });

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      let payload: unknown = output;
      if (options.fields) {
        payload = FieldFilter.filterFields(output, options.fields);
      }
      console.log(formatOutput(payload, true));
    } else {
      console.log(formatQueryExecutionsHuman(output));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
