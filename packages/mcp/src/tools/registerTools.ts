import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  RUN_REPORT_MAX_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
  FAILURES_MAX_LIMIT,
} from '@dbt-tools/core/artifact-workspace';
import * as z from 'zod/v4';
import type { DbtToolsMcpToolHandlers } from './toolHandlers.js';

const emptySchema = z.object({});

const pageSchema = {
  limit: z.number().int().min(1).max(SEARCH_RESOURCES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
};

const failuresPageSchema = {
  limit: z.number().int().min(1).max(FAILURES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
};

export function registerDbtToolsTools(server: McpServer, handlers: DbtToolsMcpToolHandlers): void {
  server.registerTool(
    'dbt_tools_status',
    {
      title: 'dbt-tools status',
      description:
        'Return the loaded artifact target, selected run, version token, and stale state.',
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_status,
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
    'dbt_tools_list_runs',
    {
      title: 'dbt-tools list runs',
      description: 'List discovered artifact runs and their version tokens.',
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_list_runs,
  );

  server.registerTool(
    'dbt_tools_select_run',
    {
      title: 'dbt-tools select run',
      description: 'Select and load one discovered artifact run by run id.',
      inputSchema: z.object({ runId: z.string().min(1) }),
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_select_run,
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
    'dbt_tools_lineage',
    {
      title: 'dbt-tools lineage',
      description: 'Return upstream or downstream dependencies for a dbt resource.',
      inputSchema: z.object({
        uniqueId: z.string().min(1),
        direction: z.enum(['upstream', 'downstream']).default('upstream'),
        depth: z.number().int().min(1).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_lineage,
  );

  server.registerTool(
    'dbt_tools_impact',
    {
      title: 'dbt-tools impact',
      description: 'Return downstream impact for a dbt resource.',
      inputSchema: z.object({
        uniqueId: z.string().min(1),
        depth: z.number().int().min(1).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_impact,
  );

  server.registerTool(
    'dbt_tools_failures',
    {
      title: 'dbt-tools failures',
      description: 'Return a bounded page of non-successful run result rows.',
      inputSchema: z.object({
        status: z.string().optional(),
        ...failuresPageSchema,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_failures,
  );

  server.registerTool(
    'dbt_tools_run_report',
    {
      title: 'dbt-tools run report',
      description: 'Return a bounded execution summary for the selected artifact run.',
      inputSchema: z.object({
        nodeExecutionsLimit: z.number().int().min(1).max(RUN_REPORT_MAX_LIMIT).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_run_report,
  );
}
