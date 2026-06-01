import {
  artifactWorkspaceStatusSchema,
  dependencyQueryOutputSchema,
  getResourceToolOutputSchema,
  queryExecutionsOutputSchema,
  runSummaryOutputSchema,
  searchResourcesOutputSchema,
} from '@dbt-tools/core/contracts';

import {
  emptyToolInputSchema,
  getResourceInputSchema,
  queryDependenciesInputSchema,
  queryExecutionsInputSchema,
  searchResourcesInputSchema,
  setTargetInputSchema,
} from './tool-input-schemas.js';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDbtToolsTools(server: McpServer, handlers: DbtToolsMcpToolHandlers): void {
  server.registerTool(
    'dbt_tools_status',
    {
      title: 'dbt-tools status',
      description:
        'Return artifact target, selected run, version token, stale state, discovered runs, and warehouse_type.',
      inputSchema: emptyToolInputSchema,
      outputSchema: artifactWorkspaceStatusSchema,
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
      inputSchema: setTargetInputSchema,
      outputSchema: artifactWorkspaceStatusSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_set_target,
  );

  server.registerTool(
    'dbt_tools_unset_target',
    {
      title: 'dbt-tools unset target',
      description:
        'Clear the active artifact target binding. Retains in-memory cached targets. Does not delete artifact files.',
      inputSchema: emptyToolInputSchema,
      outputSchema: artifactWorkspaceStatusSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_unset_target,
  );

  server.registerTool(
    'dbt_tools_clear_cached_targets',
    {
      title: 'dbt-tools clear cached targets',
      description:
        'Drop all in-memory parsed artifact caches and clear the active loaded snapshot. Does not delete remote or local artifact files.',
      inputSchema: emptyToolInputSchema,
      outputSchema: artifactWorkspaceStatusSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_clear_cached_targets,
  );

  server.registerTool(
    'dbt_tools_refresh',
    {
      title: 'dbt-tools refresh',
      description: 'Check artifact metadata and reload the selected run if it changed.',
      inputSchema: emptyToolInputSchema,
      outputSchema: artifactWorkspaceStatusSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handlers.dbt_tools_refresh,
  );

  server.registerTool(
    'dbt_tools_search_resources',
    {
      title: 'dbt-tools search resources',
      description: 'Search dbt resources by terms and optional type/package/tag/path filters.',
      inputSchema: searchResourcesInputSchema,
      outputSchema: searchResourcesOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_search_resources,
  );

  server.registerTool(
    'dbt_tools_get_resource',
    {
      title: 'dbt-tools get resource',
      description: 'Return details for one dbt resource by unique_id.',
      inputSchema: getResourceInputSchema,
      outputSchema: getResourceToolOutputSchema,
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
      inputSchema: queryDependenciesInputSchema,
      outputSchema: dependencyQueryOutputSchema,
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
      outputSchema: queryExecutionsOutputSchema,
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
      inputSchema: emptyToolInputSchema,
      outputSchema: runSummaryOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handlers.dbt_tools_get_run_summary,
  );
}
