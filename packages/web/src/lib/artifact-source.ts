import type { WorkspaceArtifactSource } from '@web/lib/artifact-source-kind';
import type {
  ArtifactSourceStatus,
  UserArtifactSourceKind,
} from '@web/services/artifact-source-api';

/** Resolved directory or object-store label from the server session. */
export type ArtifactLocationSnapshot = {
  sourceKind: UserArtifactSourceKind | null;
  locationDisplay: string | null;
};

export function artifactLocationSnapshotFromStatus(
  status: Pick<ArtifactSourceStatus, 'locationDisplay' | 'sourceKind'>,
): ArtifactLocationSnapshot | null {
  const loc = status.locationDisplay ?? null;
  const kind = status.sourceKind ?? null;
  if (loc == null && kind == null) return null;
  return { sourceKind: kind, locationDisplay: loc };
}

/** User-facing label for the directory/prefix source type control. */
export function userArtifactSourceKindLabel(
  kind: UserArtifactSourceKind | null | undefined,
): string | null {
  if (kind == null) return null;
  if (kind === 'local') return 'Local directory';
  if (kind === 's3') return 'Amazon S3';
  return 'Google Cloud Storage';
}

export function sourceLabel(source: WorkspaceArtifactSource | null): string {
  if (source === 'preload') return 'Live target';
  if (source === 'remote') return 'Remote source';
  if (source === 'upload') return 'Local upload';
  return 'Waiting for artifacts';
}

export function sourceBadgeLabel(source: WorkspaceArtifactSource | null): string {
  if (source === 'preload') return 'DBT_TOOLS_TARGET_DIR';
  if (source === 'remote') return 'REMOTE SOURCE';
  if (source === 'upload') return 'UPLOADED';
  return 'ARTIFACTS';
}
