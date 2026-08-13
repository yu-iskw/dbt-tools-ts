import { artifactWorkspaceStatusSchema } from '@dbt-tools/core/contracts';

import { bindMcpToolHandler } from './bind-tool-handler.js';
import { registerRegistryAnalysisTools } from './register-registry-analysis-tools.js';
import { emptyToolInputSchema, setTargetInputSchema } from './tool-input-schemas.js';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { McpServer } from '@modelcontextprotocol/server';

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
    bindMcpToolHandler(handlers.dbt_tools_status),
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
    bindMcpToolHandler(handlers.dbt_tools_set_target),
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
    bindMcpToolHandler(handlers.dbt_tools_unset_target),
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
    bindMcpToolHandler(handlers.dbt_tools_clear_cached_targets),
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
    bindMcpToolHandler(handlers.dbt_tools_refresh),
  );

  registerRegistryAnalysisTools(server, handlers);
}
