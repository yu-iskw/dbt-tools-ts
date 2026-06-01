import { ArtifactTargetNotConfiguredError } from '@dbt-tools/core';
import {
  dependenciesResourceBodySchema,
  resourceDetailsResourceBodySchema,
  runSummaryResourceBodySchema,
  statusResourceBodySchema,
} from '@dbt-tools/core/contracts';
import type { ArtifactWorkspaceStatus } from '@dbt-tools/core/artifact-workspace';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';

import { MCP_TARGET_NOT_CONFIGURED_MESSAGE } from '../mcp-errors.js';
import { truncateSqlResourceText } from './resource-limits.js';
import {
  DbtToolsResourceUriError,
  parseDbtToolsResourceUri,
  type DbtToolsResourceRequest,
} from './resource-uri.js';

import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import type { ArtifactWorkspaceControl } from '../workspace-control.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export interface DbtToolsResourceContext {
  workspace: ArtifactWorkspaceControl;
  useCases: DbtToolsUseCases;
}

function snapshotMetadataFromStatus(status: ArtifactWorkspaceStatus) {
  return {
    versionToken: status.versionToken,
    loadedAtMs: status.loadedAtMs,
    target: status.target,
    stale: status.stale,
  };
}

function resourceNotFound(message: string): never {
  throw new McpError(ErrorCode.InvalidParams, message);
}

function invalidResourceUri(error: unknown): never {
  const message =
    error instanceof DbtToolsResourceUriError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  throw new McpError(ErrorCode.InvalidParams, message);
}

function parseResourceBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Resource payload did not match contract: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

async function withLoadedUseCases<T>(
  ctx: DbtToolsResourceContext,
  run: (uc: DbtToolsUseCases) => Promise<T>,
): Promise<T> {
  try {
    return await run(ctx.useCases);
  } catch (error) {
    if (error instanceof ArtifactTargetNotConfiguredError) {
      resourceNotFound(MCP_TARGET_NOT_CONFIGURED_MESSAGE);
    }
    throw error;
  }
}

export async function readDbtToolsResource(
  ctx: DbtToolsResourceContext,
  uriString: string,
): Promise<ReadResourceResult> {
  let request: DbtToolsResourceRequest;
  try {
    request = parseDbtToolsResourceUri(uriString);
  } catch (error) {
    invalidResourceUri(error);
  }

  const uri = new URL(uriString);

  if (request.kind === 'status') {
    const status = await ctx.workspace.getStatus();
    const body = parseResourceBody(statusResourceBodySchema, {
      ...snapshotMetadataFromStatus(status),
      status,
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(body, null, 2),
        },
      ],
    };
  }

  if (request.kind === 'run-summary') {
    const summary = await withLoadedUseCases(ctx, (uc) => uc.getRunSummary());
    const status = await ctx.workspace.getStatus();
    const body = parseResourceBody(runSummaryResourceBodySchema, {
      ...snapshotMetadataFromStatus(status),
      summary,
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(body, null, 2),
        },
      ],
    };
  }

  if (request.kind === 'resource-details') {
    const resource = await withLoadedUseCases(ctx, (uc) =>
      uc.getResource({ uniqueId: request.uniqueId, includeCode: false }),
    );
    if (resource == null) {
      resourceNotFound(
        `Resource not found for unique_id ${request.uniqueId}. Use dbt_tools_search_resources to discover available resources.`,
      );
    }
    const status = await ctx.workspace.getStatus();
    const body = parseResourceBody(resourceDetailsResourceBodySchema, {
      ...snapshotMetadataFromStatus(status),
      resource,
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(body, null, 2),
        },
      ],
    };
  }

  if (request.kind === 'resource-sql') {
    const resource = await withLoadedUseCases(ctx, (uc) =>
      uc.getResource({ uniqueId: request.uniqueId, includeCode: true }),
    );
    if (resource == null) {
      resourceNotFound(
        `Resource not found for unique_id ${request.uniqueId}. Use dbt_tools_search_resources to discover available resources.`,
      );
    }
    const sql =
      request.sqlKind === 'raw' ? (resource.rawCode ?? null) : (resource.compiledCode ?? null);
    if (sql == null || sql === '') {
      resourceNotFound(
        `${request.sqlKind} SQL is not available for unique_id ${request.uniqueId}.`,
      );
    }
    const { text } = truncateSqlResourceText(sql);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/sql',
          text,
        },
      ],
    };
  }

  const dependencies = await withLoadedUseCases(ctx, (uc) =>
    uc.queryDependencies({
      uniqueId: request.uniqueId,
      direction: request.direction,
    }),
  );
  const status = await ctx.workspace.getStatus();
  const body = parseResourceBody(dependenciesResourceBodySchema, {
    ...snapshotMetadataFromStatus(status),
    dependencies,
  });
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(body, null, 2),
      },
    ],
  };
}
