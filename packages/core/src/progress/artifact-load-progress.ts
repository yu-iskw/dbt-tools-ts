export type ArtifactLoadPhase =
  | 'build-graph'
  | 'build-snapshot'
  | 'discover-bundle'
  | 'download-manifest'
  | 'download-optional-artifacts'
  | 'download-run-results'
  | 'list-objects'
  | 'parse-artifacts'
  | 'ready'
  | 'validate-target';

export interface ArtifactLoadProgress {
  phase: ArtifactLoadPhase;
  progress: number;
  message: string;
}

export type ArtifactLoadProgressCallback = (event: ArtifactLoadProgress) => void;
