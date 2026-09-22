import { describe, expect, it, vi } from 'vitest';

import { bindMcpToolHandler, bindMcpToolHandlers } from './bind-tool-handler.js';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { McpToolProgressExtra } from '../progress/map-load-progress.js';

describe('bindMcpToolHandler', () => {
  it('forwards args and passes mcpReq as the local progress extra', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const bound = bindMcpToolHandler(handler);
    const mcpReq: McpToolProgressExtra = { _meta: { progressToken: 'tok' }, notify };
    const result = await bound({ target: './target' }, { mcpReq });

    expect(result.content[0]?.text).toBe('ok');
    expect(handler).toHaveBeenCalledWith({ target: './target' }, mcpReq);
  });

  it('forwards schema-validated input without coercing to {}', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const bound = bindMcpToolHandler(handler);
    const mcpReq: McpToolProgressExtra = { notify: vi.fn().mockResolvedValue(undefined) };
    await bound(undefined, { mcpReq });
    expect(handler).toHaveBeenCalledWith(undefined, mcpReq);
  });
});

describe('bindMcpToolHandlers', () => {
  it('binds every handler once', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const noop = vi.fn().mockResolvedValue({ content: [] });
    const handlers = {
      dbt_tools_status: status,
      dbt_tools_set_target: noop,
      dbt_tools_unset_target: noop,
      dbt_tools_clear_cached_targets: noop,
      dbt_tools_refresh: noop,
      dbt_tools_search_resources: noop,
      dbt_tools_get_resource: noop,
      dbt_tools_query_dependencies: noop,
      dbt_tools_query_executions: noop,
      dbt_tools_get_run_summary: noop,
    } satisfies DbtToolsMcpToolHandlers;

    const mcpReq: McpToolProgressExtra = { _meta: { progressToken: 1 }, notify };
    const bound = bindMcpToolHandlers(handlers);
    await bound.dbt_tools_status({}, { mcpReq });

    expect(status).toHaveBeenCalledWith({}, mcpReq);
  });
});
