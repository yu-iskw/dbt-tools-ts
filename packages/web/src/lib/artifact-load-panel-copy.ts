import type { UserArtifactSourceKind } from '../services/artifact-source-api';

export function artifactLocationPlaceholder(sourceKind: UserArtifactSourceKind): string {
  if (sourceKind === 'local') {
    return '/path/to/target or relative/path';
  }
  if (sourceKind === 's3') {
    return 's3://bucket/prefix or bucket/prefix';
  }
  return 'gs://bucket/prefix or bucket/prefix';
}

export function artifactLocationHelper(sourceKind: UserArtifactSourceKind): string {
  if (sourceKind === 'local') {
    return 'Resolved on the server running this app, not in your browser.';
  }
  return 'Uses server-side SDK credentials; keys never enter the browser.';
}

export type ArtifactLoadReadinessInput = {
  discoverLoading: boolean;
  discoveryError: string | null;
  scanSucceeded: boolean;
  location: string;
};

export function getArtifactReadinessLabel(input: ArtifactLoadReadinessInput): string {
  if (input.discoverLoading) {
    return 'Scanning for artifacts…';
  }
  if (input.discoveryError != null) {
    return 'Scan failed. Fix the location and scan again.';
  }
  if (input.scanSucceeded) {
    return 'Artifacts found. You can load the workspace again if needed.';
  }
  if (input.location.trim() === '') {
    return 'Enter a location, then scan.';
  }
  return 'Press Enter or Scan to check this location.';
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
    return 'Scanning for artifacts…';
  }
  if (input.discoveryError != null) {
    return 'Fix the error below, then scan again.';
  }
  if (input.location.trim() === '') {
    return 'Enter a path, then press Enter, blur the field, or click Scan location.';
  }
  if (!input.scanSucceeded) {
    return 'Press Enter, blur Location, or click Scan location, then click Load workspace.';
  }
  return undefined;
}
