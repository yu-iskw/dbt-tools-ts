import {
  ARTIFACT_RUN_ID_CURRENT,
  discoverArtifactCandidates,
  discoverLocalArtifactRunPaths,
  joinObjectStorageKey,
  normalizeArtifactPrefix,
  remoteKeysToListedArtifacts,
  type ArtifactDiscoveryResult,
  type RemoteObjectMetadata,
} from '@dbt-tools/core';

import type { RemoteArtifactProvider, RemoteArtifactRun } from '../services/artifact-source-api';

export type { RemoteObjectMetadata };

export interface ResolvedArtifactRun {
  runId: string;
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
}

function mapCoreCandidatesToResolvedRuns(
  disc: Extract<ArtifactDiscoveryResult, { ok: true }>,
  resolveKey: (relativePath: string) => string,
): ResolvedArtifactRun[] {
  return disc.candidates.map((c) => ({
    runId: c.runId,
    manifestKey: resolveKey(c.manifestRelative),
    runResultsKey: resolveKey(c.runResultsRelative),
    ...(c.catalogRelative != null ? { catalogKey: resolveKey(c.catalogRelative) } : {}),
    ...(c.sourcesRelative != null ? { sourcesKey: resolveKey(c.sourcesRelative) } : {}),
    updatedAtMs: c.updatedAtMs,
    versionToken: c.versionToken,
  }));
}

export async function discoverLocalResolvedArtifactRuns(resolvedDirAbs: string): Promise<{
  runs: ResolvedArtifactRun[];
  discovery: ArtifactDiscoveryResult;
}> {
  const { discovery, runs: paths } = await discoverLocalArtifactRunPaths(resolvedDirAbs);
  if (!discovery.ok) {
    return { runs: [], discovery };
  }
  const runs: ResolvedArtifactRun[] = paths.map((r) => ({
    runId: r.runId,
    manifestKey: r.manifestKey,
    runResultsKey: r.runResultsKey,
    ...(r.catalogKey != null ? { catalogKey: r.catalogKey } : {}),
    ...(r.sourcesKey != null ? { sourcesKey: r.sourcesKey } : {}),
    updatedAtMs: r.updatedAtMs,
    versionToken: r.versionToken,
  }));
  return { runs, discovery };
}

export function discoverRemoteArtifactDiscovery(
  objects: RemoteObjectMetadata[],
  prefix: string,
): ArtifactDiscoveryResult {
  const listed = remoteKeysToListedArtifacts(objects, prefix);
  return discoverArtifactCandidates(listed);
}

export function discoverLatestArtifactRuns(
  objects: RemoteObjectMetadata[],
  prefix: string,
): ResolvedArtifactRun[] {
  const disc = discoverRemoteArtifactDiscovery(objects, prefix);
  if (!disc.ok) return [];
  const normPrefix = normalizeArtifactPrefix(prefix);
  return mapCoreCandidatesToResolvedRuns(disc, (rel) => joinObjectStorageKey(normPrefix, rel));
}

export function toRemoteArtifactRun(
  provider: RemoteArtifactProvider,
  run: ResolvedArtifactRun,
): RemoteArtifactRun {
  return {
    runId: run.runId,
    label:
      run.runId === ARTIFACT_RUN_ID_CURRENT
        ? `${provider.toUpperCase()} current`
        : `${provider.toUpperCase()} ${run.runId}`,
    updatedAtMs: run.updatedAtMs,
    versionToken: run.versionToken,
  };
}

export function toLocalManagedArtifactRun(run: ResolvedArtifactRun): RemoteArtifactRun {
  return {
    runId: run.runId,
    label: 'Local',
    updatedAtMs: run.updatedAtMs,
    versionToken: run.versionToken,
  };
}
