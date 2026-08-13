import { progressExtraFromContext } from '../progress/map-load-progress.js';

import type { McpJsonToolResult } from './tool-handlers.js';
import type { McpToolProgressExtra } from '../progress/map-load-progress.js';
import type { ServerContext } from '@modelcontextprotocol/server';

type ToolInput = Record<string, unknown>;

export function bindMcpToolHandler(
  handler: (input: ToolInput, extra?: McpToolProgressExtra) => Promise<McpJsonToolResult>,
) {
  return async (input: unknown, ctx: ServerContext): Promise<McpJsonToolResult> => {
    const args =
      input != null && typeof input === 'object' && !Array.isArray(input)
        ? (input as ToolInput)
        : {};
    return handler(args, progressExtraFromContext(ctx));
  };
}
