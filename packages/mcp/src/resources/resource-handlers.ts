import {
  dependenciesResourceBodySchema,
  resourceDetailsResourceBodySchema,
  runSummaryResourceBodySchema,
  statusResourceBodySchema,
} from '@dbt-tools/core/contracts';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';

import { runResourceWithLoadedUseCases } from '../loaded-use-cases.js';
import { loadResourceNode, loadResourceSqlText } from './fetch-resource.js';
import { buildSnapshotEnvelope } from './resource-envelope-build.js';
import type * as z from 'zod/v4';
import {
  DbtToolsResourceUriError,
  parseDbtToolsResourceUri,
  type DbtToolsResourceRequest,
} from './resource-uri.js';

import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import type { ArtifactWorkspaceControl } from '../workspace-control.js';
import type { ReadResourceResult } from '@modelcontextprotocol/server';

export interface DbtToolsResourceContext {
  workspace: ArtifactWorkspaceControl;
  useCases: DbtToolsUseCases;
}

function resourceNotFound(message: string): never {
  throw new ProtocolError(ProtocolErrorCode.InvalidParams, message);
}

function invalidResourceUri(error: unknown): never {
  const message =
    error instanceof DbtToolsResourceUriError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  throw new ProtocolError(ProtocolErrorCode.InvalidParams, message);
}

async function readJsonResourceWithEnvelope<T>(
  ctx: DbtToolsResourceContext,
  schema: z.ZodType<T>,
  load: (uc: DbtToolsUseCases) => Promise<Record<string, unknown>>,
): Promise<T> {
  const payload = await runResourceWithLoadedUseCases(ctx.useCases, load);
  const status = await ctx.workspace.getStatus();
  return buildSnapshotEnvelope(status, schema, payload);
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
    const body = buildSnapshotEnvelope(status, statusResourceBodySchema, { status });
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
    const body = await readJsonResourceWithEnvelope(ctx, runSummaryResourceBodySchema, (uc) =>
      uc.getRunSummary().then((summary) => ({ summary })),
    );
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
    const body = await readJsonResourceWithEnvelope(
      ctx,
      resourceDetailsResourceBodySchema,
      async (uc) => {
        const resource = await uc.getResource({ uniqueId: request.uniqueId, includeCode: false });
        if (resource == null) {
          resourceNotFound(
            `Resource not found for unique_id ${request.uniqueId}. Use dbt_tools_search_resources to discover available resources.`,
          );
        }
        return { resource };
      },
    );
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
    const text = await runResourceWithLoadedUseCases(ctx.useCases, (uc) =>
      loadResourceSqlText(uc, request.uniqueId, request.sqlKind),
    );
    if (text == null) {
      resourceNotFound(
        `Resource not found or ${request.sqlKind} SQL is not available for unique_id ${request.uniqueId}. Use dbt_tools_search_resources to discover available resources.`,
      );
    }
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

  const body = await readJsonResourceWithEnvelope(ctx, dependenciesResourceBodySchema, (uc) =>
    uc
      .queryDependencies({
        uniqueId: request.uniqueId,
        direction: request.direction,
      })
      .then((dependencies) => ({ dependencies })),
  );
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
