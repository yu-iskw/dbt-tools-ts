import * as z from 'zod/v4';

import { artifactWorkspaceStatusSchema } from './artifact-workspace-status.js';
import { dependencyQueryOutputSchema } from './dependency-query.js';
import { resourceDetailsSchema } from './resource-details.js';
import { runSummaryOutputSchema } from './run-summary.js';

export const snapshotMetadataSchema = z.object({
  versionToken: z.string().nullable(),
  loadedAtMs: z.number().int().nullable(),
  target: z.string().nullable().optional(),
  stale: z.boolean().optional(),
});

export const statusResourceBodySchema = snapshotMetadataSchema.extend({
  status: artifactWorkspaceStatusSchema,
});

export const runSummaryResourceBodySchema = snapshotMetadataSchema.extend({
  summary: runSummaryOutputSchema,
});

export const resourceDetailsResourceBodySchema = snapshotMetadataSchema.extend({
  resource: resourceDetailsSchema,
});

export const dependenciesResourceBodySchema = snapshotMetadataSchema.extend({
  dependencies: dependencyQueryOutputSchema,
});

export type StatusResourceBodyContract = z.infer<typeof statusResourceBodySchema>;
export type RunSummaryResourceBodyContract = z.infer<typeof runSummaryResourceBodySchema>;
export type ResourceDetailsResourceBodyContract = z.infer<typeof resourceDetailsResourceBodySchema>;
export type DependenciesResourceBodyContract = z.infer<typeof dependenciesResourceBodySchema>;
