import * as z from 'zod/v4';

import { warehouseTypeSchema } from './shared.js';

export const artifactWorkspaceRunRefSchema = z
  .object({
    runId: z.string(),
    versionToken: z.string(),
  })
  .passthrough();

export const artifactWorkspaceCachedTargetRefSchema = z
  .object({
    target: z.string(),
    loadedAtMs: z.number().int(),
    versionToken: z.string(),
    lastAccessedAtMs: z.number().int(),
  })
  .passthrough();

export const artifactWorkspaceStatusSchema = z.object({
  target: z.string().nullable(),
  selectedRunId: z.string().nullable(),
  versionToken: z.string().nullable(),
  loadedAtMs: z.number().int().nullable(),
  stale: z.boolean(),
  lastRefreshError: z.string().optional(),
  runs: z.array(artifactWorkspaceRunRefSchema),
  warehouse_type: warehouseTypeSchema.optional(),
  fromCache: z.boolean().optional(),
  cachePolicy: z
    .object({
      maxTargets: z.number().int().min(0),
      ttlMs: z.number().int().min(0),
    })
    .optional(),
  cachedTargets: z.array(artifactWorkspaceCachedTargetRefSchema).optional(),
  pendingRun: artifactWorkspaceRunRefSchema.optional(),
});

export type ArtifactWorkspaceRunRef = z.infer<typeof artifactWorkspaceRunRefSchema>;
export type ArtifactWorkspaceCachedTargetRef = z.infer<
  typeof artifactWorkspaceCachedTargetRefSchema
>;
export type ArtifactWorkspaceStatus = z.infer<typeof artifactWorkspaceStatusSchema>;

/** @deprecated Use `ArtifactWorkspaceStatus` */
export type ArtifactWorkspaceStatusContract = ArtifactWorkspaceStatus;
