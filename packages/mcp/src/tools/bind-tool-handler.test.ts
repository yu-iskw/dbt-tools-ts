import { describe, expect, it, vi } from 'vitest';

import { bindMcpToolHandler } from './bind-tool-handler.js';

import type { ServerContext } from '@modelcontextprotocol/server';

describe('bindMcpToolHandler', () => {
  it('forwards object args and progress extra from ServerContext', async () => {
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
  });

  it('uses an empty object when args are not a plain object', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const bound = bindMcpToolHandler(handler);
    await bound(undefined, {
      mcpReq: { notify: vi.fn().mockResolvedValue(undefined) },
    } as unknown as ServerContext);
    expect(handler).toHaveBeenCalledWith({}, expect.any(Object));
  });
});
