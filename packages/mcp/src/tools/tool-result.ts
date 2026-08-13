import { toolErrorSchema } from '@dbt-tools/core/contracts';

import type { McpJsonToolResult } from './tool-handlers.js';
import type * as z from 'zod/v4';

/**
 * MCP SDK v2 skips outputSchema validation when result.isError is true.
 * Tool errors use toolErrorSchema in structuredContent for clients that read it.
 */

function isOutputValidationEnabled(): boolean {
  const flag = process.env.DBT_TOOLS_VALIDATE_OUTPUT;
  if (flag === '0' || flag === 'false') return false;
  return true;
}

export function jsonResult<T>(
  schema: z.ZodType<T>,
  payload: T,
  options?: { isError?: boolean; contentPayload?: unknown },
): McpJsonToolResult {
  const contentValue = options?.contentPayload !== undefined ? options.contentPayload : payload;
  const text = JSON.stringify(contentValue, null, 2);
  const base = {
    content: [{ type: 'text', text } as const],
    ...(options?.isError === true ? { isError: true } : {}),
  };

  const attachStructured =
    payload !== null && typeof payload === 'object'
      ? { structuredContent: payload as Record<string, unknown> }
      : {};

  if (!isOutputValidationEnabled()) {
    return {
      ...base,
      ...attachStructured,
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return jsonToolError({
      error: 'Internal tool output contract validation failed.',
      hint: parsed.error.message,
      code: 'output_schema_validation',
    });
  }

  return {
    ...base,
    ...attachStructured,
  };
}

export function jsonToolError(
  payload: z.input<typeof toolErrorSchema>,
  options?: { isError?: boolean },
): McpJsonToolResult {
  return jsonResult(toolErrorSchema, toolErrorSchema.parse(payload), {
    isError: options?.isError ?? true,
  });
}

export function outputSchemaValidationToolResult(hint: string): McpJsonToolResult {
  return jsonToolError({
    error: 'Internal tool output contract validation failed.',
    hint,
    code: 'output_schema_validation',
  });
}

export function invalidToolInputResult(error: z.ZodError): McpJsonToolResult {
  return jsonToolError({
    error: 'Invalid tool input.',
    hint: error.message,
  });
}
