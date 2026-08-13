import type { DbtToolsMcpToolHandlers, McpJsonToolResult } from './tool-handlers.js';
import type { McpToolProgressExtra } from '../progress/map-load-progress.js';
import type { ServerContext } from '@modelcontextprotocol/server';

type ToolInput = Record<string, unknown>;

export type BoundMcpToolHandler = (
  input: unknown,
  ctx: ServerContext,
) => Promise<McpJsonToolResult>;

export type BoundMcpToolHandlers = {
  [K in keyof DbtToolsMcpToolHandlers]: BoundMcpToolHandler;
};

export function bindMcpToolHandler(
  handler: (input: ToolInput, extra?: McpToolProgressExtra) => Promise<McpJsonToolResult>,
): BoundMcpToolHandler {
  return async (input, ctx) =>
    handler(input as ToolInput, {
      _meta: ctx.mcpReq._meta,
      notify: (notification) => ctx.mcpReq.notify(notification),
    });
}

export function bindMcpToolHandlers(handlers: DbtToolsMcpToolHandlers): BoundMcpToolHandlers {
  return {
    dbt_tools_status: bindMcpToolHandler(handlers.dbt_tools_status),
    dbt_tools_set_target: bindMcpToolHandler(handlers.dbt_tools_set_target),
    dbt_tools_unset_target: bindMcpToolHandler(handlers.dbt_tools_unset_target),
    dbt_tools_clear_cached_targets: bindMcpToolHandler(handlers.dbt_tools_clear_cached_targets),
    dbt_tools_refresh: bindMcpToolHandler(handlers.dbt_tools_refresh),
    dbt_tools_search_resources: bindMcpToolHandler(handlers.dbt_tools_search_resources),
    dbt_tools_get_resource: bindMcpToolHandler(handlers.dbt_tools_get_resource),
    dbt_tools_query_dependencies: bindMcpToolHandler(handlers.dbt_tools_query_dependencies),
    dbt_tools_query_executions: bindMcpToolHandler(handlers.dbt_tools_query_executions),
    dbt_tools_get_run_summary: bindMcpToolHandler(handlers.dbt_tools_get_run_summary),
  };
}
