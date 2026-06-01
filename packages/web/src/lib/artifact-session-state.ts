import type { AnalysisLoadResult } from '../services/analysis-loader';
import type {
  ArtifactSourceStatus,
  MissingOptionalArtifactsState,
  RemoteArtifactRun,
} from '../services/artifact-source-api';
import type { WorkspaceArtifactSource } from '@web/lib/artifact-source-kind';

/** Shared optional-artifact capability defaults when status omits the field. */
export const DEFAULT_MISSING_OPTIONAL_ARTIFACTS: MissingOptionalArtifactsState = {
  missingCatalog: false,
  missingSources: false,
};

export interface ArtifactSessionViewUpdate {
  pendingRemoteRun: RemoteArtifactRun | null;
  remotePollIntervalMs: number | null;
  analysisSource: WorkspaceArtifactSource | null;
  missingOptionalArtifacts: MissingOptionalArtifactsState;
}

export function artifactSessionViewFromStatus(
  status: ArtifactSourceStatus,
): ArtifactSessionViewUpdate {
  return {
    pendingRemoteRun: status.pendingRun,
    remotePollIntervalMs: status.pollIntervalMs,
    analysisSource: status.currentSource,
    missingOptionalArtifacts: status.missingOptionalArtifacts ?? DEFAULT_MISSING_OPTIONAL_ARTIFACTS,
  };
}

export interface ApplyArtifactSessionParams {
  status: ArtifactSourceStatus;
  analysis?: AnalysisLoadResult | null;
  setPendingRemoteRun: (run: RemoteArtifactRun | null) => void;
  setRemotePollIntervalMs: (ms: number | null) => void;
  setAnalysisSource: (source: WorkspaceArtifactSource | null) => void;
  setArtifactCapability: (capability: MissingOptionalArtifactsState) => void;
  setAnalysis?: (analysis: AnalysisLoadResult['analysis'] | null) => void;
  setError?: (message: string | null) => void;
  onMetrics?: (metrics: AnalysisLoadResult['metrics'] | null) => void;
}

/**
 * Applies server artifact session status (and optional analysis load) through one code path.
 */
export function applyArtifactSession(params: ApplyArtifactSessionParams): void {
  const view = artifactSessionViewFromStatus(params.status);
  params.setPendingRemoteRun(view.pendingRemoteRun);
  params.setRemotePollIntervalMs(view.remotePollIntervalMs);
  params.setAnalysisSource(view.analysisSource);
  params.setArtifactCapability(view.missingOptionalArtifacts);

  if (params.analysis != null) {
    params.onMetrics?.(params.analysis.metrics);
    params.setAnalysis?.(params.analysis.analysis);
    params.setError?.(null);
  }
}
