import type { UserArtifactSourceKind } from '../services/artifactSourceApi';

export function artifactLocationPlaceholder(sourceKind: UserArtifactSourceKind): string {
  if (sourceKind === 'local') {
    return '/path/to/target or relative/path';
  }
  if (sourceKind === 's3') {
    return 's3://bucket/prefix or bucket/prefix';
  }
  return 'gs://bucket/prefix or bucket/prefix';
}

export type ArtifactLoadReadinessInput = {
  discoverLoading: boolean;
  discoveryError: string | null;
  candidateRunIds: readonly string[];
  selectedRunId: string | null;
  location: string;
};

export function getArtifactReadinessLabel(input: ArtifactLoadReadinessInput): string {
  const hasRunSelection = input.selectedRunId != null && input.selectedRunId.trim() !== '';
  if (input.discoverLoading) {
    return 'Scanning for artifact runs…';
  }
  if (input.discoveryError) {
    return input.discoveryError;
  }
  if (input.candidateRunIds.length > 0 && hasRunSelection) {
    return 'Ready to load the workspace.';
  }
  if (input.candidateRunIds.length > 1 && !hasRunSelection) {
    return 'Pick a candidate set, then load.';
  }
  if (input.location.trim() === '') {
    return 'Enter a location, then press Enter or move focus away to scan.';
  }
  if (input.candidateRunIds.length === 0) {
    return 'Press Enter or leave the Location field to scan for artifact runs.';
  }
  return 'Press Enter or leave the field to refresh the scan, then load.';
}

export type ArtifactLoadWorkspaceHintInput = ArtifactLoadReadinessInput & {
  loadLoading: boolean;
  canLoad: boolean;
};

export function getArtifactLoadWorkspaceHint(
  input: ArtifactLoadWorkspaceHintInput,
): string | undefined {
  if (input.loadLoading) {
    return 'Loading artifact workspace…';
  }
  if (input.canLoad) {
    return undefined;
  }
  if (input.discoverLoading) {
    return 'Scanning for artifact runs…';
  }
  if (input.discoveryError != null) {
    return input.discoveryError;
  }
  if (input.location.trim() === '') {
    return 'Enter a path, then press Enter or leave the Location field to scan.';
  }
  if (input.candidateRunIds.length === 0) {
    return 'Press Enter or blur Location to scan, then click Load workspace.';
  }
  const hasRunSelection = input.selectedRunId != null && input.selectedRunId.trim() !== '';
  if (input.candidateRunIds.length > 1 && !hasRunSelection) {
    return 'Pick a candidate run, then click Load workspace.';
  }
  return 'Press Enter or blur Location to scan, then click Load workspace.';
}
