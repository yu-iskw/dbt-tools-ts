import { describe, expect, it, vi } from 'vitest';

import { bindMcpToolHandler, bindMcpToolHandlers } from './bind-tool-handler.js';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { ServerContext } from '@modelcontextprotocol/server';

describe('bindMcpToolHandler', () => {
  it('forwards args and maps mcpReq onto the local progress extra', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const bound = bindMcpToolHandler(handler);
    const result = await bound({ target: './target' }, {
      mcpReq: { _meta: { progressToken: 'tok' }, notify },
    } as ServerContext);

    expect(result.content[0]?.text).toBe('ok');
    expect(handler).toHaveBeenCalledWith(
      { target: './target' },
      expect.objectContaining({ _meta: { progressToken: 'tok' } }),
    );
    const extra = handler.mock.calls[0]?.[1];
    await extra.notify({
      method: 'notifications/progress',
      params: { progressToken: 'tok', progress: 10 },
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('forwards schema-validated input without coercing to {}', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const bound = bindMcpToolHandler(handler);
    await bound(undefined, {
      mcpReq: { notify: vi.fn().mockResolvedValue(undefined) },
    } as unknown as ServerContext);
    expect(handler).toHaveBeenCalledWith(undefined, expect.any(Object));
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

    const bound = bindMcpToolHandlers(handlers);
    await bound.dbt_tools_status({}, {
      mcpReq: { _meta: { progressToken: 1 }, notify },
    } as ServerContext);

    expect(status).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ _meta: { progressToken: 1 } }),
    );
  });
});
