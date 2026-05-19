import {
  QUERY_EXECUTIONS_DEFAULT_LIMIT,
  QUERY_EXECUTIONS_MAX_LIMIT,
  QueryExecutionsValidationError,
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
  type AthenaSearchCriteria,
  type BaseAdapterSearchCriteria,
  type BigQuerySearchCriteria,
  type SnowflakeSearchCriteria,
} from '@dbt-tools/core';
import {
  type ArtifactWorkspaceStatus,
  type DbtToolsUseCases,
  type GetResourceInput,
  type SearchResourcesInput,
} from '@dbt-tools/core/artifact-workspace';
import type { QueryDependenciesInput } from '@dbt-tools/core';
import type { QueryExecutionsRequest } from '@dbt-tools/core';

export interface ArtifactWorkspaceControl {
  getStatus(): Promise<ArtifactWorkspaceStatus>;
  refreshIfChanged(): Promise<ArtifactWorkspaceStatus>;
}

export interface McpJsonToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

type ToolInput = Record<string, unknown>;

const MSG_UNIQUE_ID_REQUIRED = 'uniqueId is required.';

function jsonResult(
  payload: Record<string, unknown>,
  options?: { isError?: boolean },
): McpJsonToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    ...(options?.isError === true ? { isError: true } : {}),
  };
}

function jsonResultFromValue(payload: unknown, options?: { isError?: boolean }): McpJsonToolResult {
  return jsonResult(payload as Record<string, unknown>, options);
}

function optionalString(input: ToolInput, key: string): string | undefined {
  const value = input[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function optionalNumber(input: ToolInput, key: string): number | undefined {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalStringArray(input: ToolInput, key: string): string[] | undefined {
  const value = input[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return undefined;
}

function boundedLimit(
  input: ToolInput,
  defaultLimit: number,
  maxLimit: number,
  key = 'limit',
): number {
  const raw = optionalNumber(input, key);
  if (raw == null) return defaultLimit;
  return Math.min(Math.max(1, Math.floor(raw)), maxLimit);
}

function offset(input: ToolInput): number {
  const raw = optionalNumber(input, 'offset');
  if (raw == null) return 0;
  return Math.max(0, Math.floor(raw));
}

function optionalRecord(input: ToolInput, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function pickWarehouseBlock(
  block: Record<string, unknown> | undefined,
  fields: Record<string, string>,
): Record<string, unknown> | undefined {
  if (block == null) return undefined;
  const out: Record<string, unknown> = {};
  for (const [targetKey, sourceKey] of Object.entries(fields)) {
    const value = block[sourceKey];
    if (value !== undefined) out[targetKey] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function searchInput(input: ToolInput): SearchResourcesInput {
  return {
    query: optionalString(input, 'query'),
    type: optionalString(input, 'type'),
    package: optionalString(input, 'package'),
    tag: optionalString(input, 'tag'),
    path: optionalString(input, 'path'),
    limit: boundedLimit(input, SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT),
    offset: offset(input),
  };
}

function getResourceInput(input: ToolInput): GetResourceInput {
  const uniqueId = optionalString(input, 'uniqueId');
  if (uniqueId == null) {
    throw new Error(MSG_UNIQUE_ID_REQUIRED);
  }
  return {
    uniqueId,
    includeCode: input.includeCode === true,
  };
}

function queryDependenciesInput(input: ToolInput): QueryDependenciesInput {
  const uniqueId = optionalString(input, 'uniqueId');
  if (uniqueId == null) {
    throw new Error(MSG_UNIQUE_ID_REQUIRED);
  }
  const direction = input.direction === 'downstream' ? 'downstream' : 'upstream';
  return {
    uniqueId,
    direction,
    depth: optionalNumber(input, 'depth'),
    buildOrder: input.buildOrder === true,
  };
}

function queryExecutionsInput(input: ToolInput): QueryExecutionsRequest {
  const statusRaw = input.status;
  let status: string | string[] | undefined;
  if (typeof statusRaw === 'string') status = statusRaw;
  else if (Array.isArray(statusRaw)) {
    status = statusRaw.filter((item): item is string => typeof item === 'string');
  }

  const sortRaw = optionalString(input, 'sort');
  const sort =
    sortRaw === 'execution_time_asc' || sortRaw === 'execution_time_desc' || sortRaw === 'unique_id'
      ? sortRaw
      : undefined;

  const request: QueryExecutionsRequest = {
    resourceTypes: optionalStringArray(input, 'resourceTypes'),
    status,
    limit: boundedLimit(input, QUERY_EXECUTIONS_DEFAULT_LIMIT, QUERY_EXECUTIONS_MAX_LIMIT),
    offset: offset(input),
    uniqueIdPattern: optionalString(input, 'uniqueIdPattern'),
    minExecutionTime: optionalNumber(input, 'minExecutionTime'),
    maxExecutionTime: optionalNumber(input, 'maxExecutionTime'),
    ...(sort != null ? { sort } : {}),
    bigquery: pickWarehouseBlock(optionalRecord(input, 'bigquery'), {
      sort: 'sort',
      minSlotMs: 'minSlotMs',
      minBytesProcessed: 'minBytesProcessed',
      minBytesBilled: 'minBytesBilled',
      minRowsAffected: 'minRowsAffected',
    }) as BigQuerySearchCriteria | undefined,
    snowflake: pickWarehouseBlock(optionalRecord(input, 'snowflake'), {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
      minRowsInserted: 'minRowsInserted',
      minRowsUpdated: 'minRowsUpdated',
      minRowsDeleted: 'minRowsDeleted',
      minRowsDuplicated: 'minRowsDuplicated',
    }) as SnowflakeSearchCriteria | undefined,
    athena: pickWarehouseBlock(optionalRecord(input, 'athena'), {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as AthenaSearchCriteria | undefined,
    postgres: pickWarehouseBlock(optionalRecord(input, 'postgres'), {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
    redshift: pickWarehouseBlock(optionalRecord(input, 'redshift'), {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
    spark: pickWarehouseBlock(optionalRecord(input, 'spark'), {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
  };

  return request;
}

function validationErrorResult(error: QueryExecutionsValidationError): McpJsonToolResult {
  return jsonResult(
    {
      error: error.message,
      hint: error.hint,
      allowed_sorts: error.allowed_sorts,
      allowed_min_filters: error.allowed_min_filters,
    },
    { isError: true },
  );
}

export function createDbtToolsMcpToolHandlers(
  workspace: ArtifactWorkspaceControl,
  useCases: DbtToolsUseCases,
) {
  return {
    dbt_tools_status: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await workspace.getStatus()),

    dbt_tools_refresh: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await workspace.refreshIfChanged()),

    dbt_tools_search_resources: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await useCases.searchResources(searchInput(input))),

    dbt_tools_get_resource: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await useCases.getResource(getResourceInput(input))),

    dbt_tools_query_dependencies: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await useCases.queryDependencies(queryDependenciesInput(input))),

    dbt_tools_query_executions: async (input: ToolInput): Promise<McpJsonToolResult> => {
      try {
        return jsonResultFromValue(await useCases.queryExecutions(queryExecutionsInput(input)));
      } catch (error) {
        if (error instanceof QueryExecutionsValidationError) {
          return validationErrorResult(error);
        }
        throw error;
      }
    },

    dbt_tools_get_run_summary: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResultFromValue(await useCases.getRunSummary()),
  };
}

export type DbtToolsMcpToolHandlers = ReturnType<typeof createDbtToolsMcpToolHandlers>;
