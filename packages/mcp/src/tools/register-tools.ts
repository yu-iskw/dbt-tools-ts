import { QUERY_EXECUTIONS_MAX_LIMIT } from '@dbt-tools/core';
import { SEARCH_RESOURCES_MAX_LIMIT } from '@dbt-tools/core/artifact-workspace';
import * as z from 'zod/v4';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const emptySchema = z.object({});

const pageSchema = {
  limit: z.number().int().min(1).max(SEARCH_RESOURCES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
};

const bigQueryBlockSchema = z
  .object({
    sort: z
      .enum(['slot_ms_desc', 'bytes_processed_desc', 'bytes_billed_desc', 'rows_affected_desc'])
      .optional(),
    minSlotMs: z.number().optional(),
    minBytesProcessed: z.number().optional(),
    minBytesBilled: z.number().optional(),
    minRowsAffected: z.number().optional(),
  })
  .strict()
  .optional();

const snowflakeBlockSchema = z
  .object({
    sort: z
      .enum([
        'bytes_processed_desc',
        'rows_affected_desc',
        'rows_inserted_desc',
        'rows_updated_desc',
        'rows_deleted_desc',
        'rows_duplicated_desc',
      ])
      .optional(),
    minBytesProcessed: z.number().optional(),
    minRowsAffected: z.number().optional(),
    minRowsInserted: z.number().optional(),
    minRowsUpdated: z.number().optional(),
    minRowsDeleted: z.number().optional(),
    minRowsDuplicated: z.number().optional(),
  })
  .strict()
  .optional();

const baseWarehouseBlockSchema = z
  .object({
    sort: z.enum(['bytes_processed_desc', 'rows_affected_desc']).optional(),
    minBytesProcessed: z.number().optional(),
    minRowsAffected: z.number().optional(),
  })
  .strict()
  .optional();

const queryExecutionsInputSchema = z
  .object({
    resourceTypes: z.array(z.string()).optional(),
    status: z.union([z.string(), z.array(z.string())]).optional(),
    limit: z.number().int().min(1).max(QUERY_EXECUTIONS_MAX_LIMIT).optional(),
    offset: z.number().int().min(0).optional(),
    uniqueIdPattern: z.string().optional(),
    minExecutionTime: z.number().optional(),
    maxExecutionTime: z.number().optional(),
    sort: z.enum(['execution_time_desc', 'execution_time_asc', 'unique_id']).optional(),
    bigquery: bigQueryBlockSchema,
    snowflake: snowflakeBlockSchema,
    athena: baseWarehouseBlockSchema,
    postgres: baseWarehouseBlockSchema,
    redshift: baseWarehouseBlockSchema,
    spark: baseWarehouseBlockSchema,
  })
  .superRefine((value, ctx) => {
    const blocks = [
      value.bigquery,
      value.snowflake,
      value.athena,
      value.postgres,
      value.redshift,
      value.spark,
    ].filter((block) => block != null);
    if (blocks.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only one warehouse criteria block is allowed.',
      });
    }
  });

export function registerDbtToolsTools(server: McpServer, handlers: DbtToolsMcpToolHandlers): void {
  server.registerTool(
    'dbt_tools_status',
    {
      title: 'dbt-tools status',
      description:
        'Return artifact target, selected run, version token, stale state, discovered runs, and warehouse_type.',
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_status,
  );

  server.registerTool(
    'dbt_tools_set_target',
    {
      title: 'dbt-tools set target',
      description:
        'Set or change the dbt artifact root (local path, s3://, or gs://). Does not change GCS impersonation or S3 client settings configured at MCP startup.',
      inputSchema: z.object({ target: z.string().min(1) }),
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_set_target,
  );

  server.registerTool(
    'dbt_tools_refresh',
    {
      title: 'dbt-tools refresh',
      description: 'Check artifact metadata and reload the selected run if it changed.',
      inputSchema: emptySchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_refresh,
  );

  server.registerTool(
    'dbt_tools_search_resources',
    {
      title: 'dbt-tools search resources',
      description: 'Search dbt resources by terms and optional type/package/tag/path filters.',
      inputSchema: z.object({
        query: z.string().optional(),
        type: z.string().optional(),
        package: z.string().optional(),
        tag: z.string().optional(),
        path: z.string().optional(),
        ...pageSchema,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_search_resources,
  );

  server.registerTool(
    'dbt_tools_get_resource',
    {
      title: 'dbt-tools get resource',
      description: 'Return details for one dbt resource by unique_id.',
      inputSchema: z.object({
        uniqueId: z.string().min(1),
        includeCode: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_get_resource,
  );

  server.registerTool(
    'dbt_tools_query_dependencies',
    {
      title: 'dbt-tools query dependencies',
      description:
        'Return upstream or downstream dependencies for a dbt resource (replaces lineage and impact).',
      inputSchema: z.object({
        uniqueId: z.string().min(1),
        direction: z.enum(['upstream', 'downstream']).default('upstream'),
        depth: z.number().int().min(1).optional(),
        buildOrder: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_query_dependencies,
  );

  server.registerTool(
    'dbt_tools_query_executions',
    {
      title: 'dbt-tools query executions',
      description:
        'Filter and sort executed nodes from run_results. Use get_run_summary for totals. Catalog: search_resources.',
      inputSchema: queryExecutionsInputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_query_executions,
  );

  server.registerTool(
    'dbt_tools_get_run_summary',
    {
      title: 'dbt-tools get run summary',
      description:
        'Return run summary, status breakdown, bottlenecks, and adapter totals (no per-node list).',
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_get_run_summary,
  );
}
