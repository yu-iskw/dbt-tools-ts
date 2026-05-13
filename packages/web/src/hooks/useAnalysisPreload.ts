import { useEffect, useRef } from 'react';
import {
  loadCurrentManagedArtifacts,
  type MissingOptionalArtifactsState,
  type WorkspaceArtifactSource,
} from '../services/artifactApi';
import type { ArtifactSourceStatus } from '../services/artifactSourceApi';
import { debug } from '../debug';
import type { AnalysisState } from '@web/types';
import type { AnalysisLoadResult } from '../services/analysisLoader';

interface UseAnalysisPreloadParams {
  setPreloadLoading: (loading: boolean) => void;
  setAnalysis: (a: AnalysisState | null) => void;
  setAnalysisSource: (s: WorkspaceArtifactSource | null) => void;
  setPendingRemoteRun: (
    run: Awaited<ReturnType<typeof loadCurrentManagedArtifacts>>['status']['pendingRun'],
  ) => void;
  setRemotePollIntervalMs: (pollIntervalMs: number | null) => void;
  setError: (e: string | null) => void;
  pendingMetricsRef: { current: AnalysisLoadResult['metrics'] | null };
  setArtifactCapability: (c: MissingOptionalArtifactsState) => void;
  onArtifactSourceStatus?: (status: ArtifactSourceStatus) => void;
}

/**
 * Runs artifact preload once on mount. Fetches from /api/* and updates state.
 */
export function useAnalysisPreload({
  setPreloadLoading,
  setAnalysis,
  setAnalysisSource,
  setPendingRemoteRun,
  setRemotePollIntervalMs,
  setError,
  pendingMetricsRef,
  setArtifactCapability,
  onArtifactSourceStatus,
}: UseAnalysisPreloadParams) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    debug('Preload: fetching current managed artifacts');

    loadCurrentManagedArtifacts()
      .then(({ result, status }) => {
        setPreloadLoading(false);
        setPendingRemoteRun(status.pendingRun);
        setRemotePollIntervalMs(status.pollIntervalMs);
        onArtifactSourceStatus?.(status);
        if (result) {
          debug('Preload: success, analysis loaded');
          pendingMetricsRef.current = result.metrics;
          setAnalysis(result.analysis);
          setAnalysisSource(status.currentSource);
          setError(null);
          setArtifactCapability(
            status.missingOptionalArtifacts ?? {
              missingCatalog: false,
              missingSources: false,
            },
          );
        } else {
          setAnalysisSource(status.currentSource);
          setArtifactCapability({
            missingCatalog: false,
            missingSources: false,
          });
        }
      })
      .catch((err) => {
        setPreloadLoading(false);
        debug('Preload: error', err);
        setError(err instanceof Error ? err.message : 'Failed to load artifacts from server');
      });
  }, [
    pendingMetricsRef,
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setError,
    setArtifactCapability,
    onArtifactSourceStatus,
  ]);
}
