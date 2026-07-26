import { ArtifactTargetNotConfiguredError } from '@dbt-tools/core';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { MCP_TARGET_NOT_CONFIGURED_HINT, MCP_TARGET_NOT_CONFIGURED_MESSAGE } from './mcp-errors.js';
import {
  jsonResult,
  jsonToolError,
  outputSchemaValidationToolResult,
} from './tools/tool-result.js';

import type { McpJsonToolResult } from './tools/tool-handlers.js';
import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';

export function targetNotConfiguredToolResult(): McpJsonToolResult {
  return jsonToolError({
    error: ArtifactTargetNotConfiguredError.message,
    hint: MCP_TARGET_NOT_CONFIGURED_HINT,
  });
}

export function throwTargetNotConfiguredResourceError(): never {
  throw new ProtocolError(ProtocolErrorCode.InvalidParams, MCP_TARGET_NOT_CONFIGURED_MESSAGE);
}

export async function runToolWithLoadedUseCases<T>(
  schema: z.ZodType<T>,
  useCases: DbtToolsUseCases,
  run: (uc: DbtToolsUseCases) => Promise<T>,
  options?: { contentPayload?: (data: T) => unknown },
): Promise<McpJsonToolResult> {
  try {
    const data = await run(useCases);
    return jsonResult(schema, data, {
      contentPayload: options?.contentPayload?.(data),
    });
  } catch (error) {
    if (error instanceof ArtifactTargetNotConfiguredError) {
      return targetNotConfiguredToolResult();
    }
    if (error instanceof z.ZodError) {
      return outputSchemaValidationToolResult(error.message);
    }
    throw error;
  }
}

export async function runResourceWithLoadedUseCases<T>(
  useCases: DbtToolsUseCases,
  run: (uc: DbtToolsUseCases) => Promise<T>,
): Promise<T> {
  try {
    return await run(useCases);
  } catch (error) {
    if (error instanceof ArtifactTargetNotConfiguredError) {
      throwTargetNotConfiguredResourceError();
    }
    throw error;
  }
}
