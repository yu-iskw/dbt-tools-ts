import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { ArtifactWorkspaceStatus } from '@dbt-tools/core/artifact-workspace';

export function snapshotMetadataFromStatus(status: ArtifactWorkspaceStatus) {
  return {
    versionToken: status.versionToken,
    loadedAtMs: status.loadedAtMs,
    target: status.target,
    stale: status.stale,
  };
}

export function parseResourceBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Resource payload did not match contract: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function buildSnapshotEnvelope<T>(
  status: ArtifactWorkspaceStatus,
  schema: z.ZodType<T>,
  payload: Record<string, unknown>,
): T {
  return parseResourceBody(schema, {
    ...snapshotMetadataFromStatus(status),
    ...payload,
  });
}
