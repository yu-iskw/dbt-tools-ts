import { useEffect, useRef, type RefObject } from 'react';

import { MANAGED_ARTIFACT_BYTES_ERROR } from '@web/constants/managed-artifact-errors';

import { debug } from '../debug';
import {
  loadCurrentManagedArtifacts,
  type MissingOptionalArtifactsState,
  type WorkspaceArtifactSource,
} from '../services/artifact-api';

import type { AnalysisLoadResult } from '../services/analysis-loader';
import type { ArtifactSourceStatus } from '../services/artifact-source-api';
import type { AnalysisState } from '@web/types';

interface UseAnalysisPreloadParams {
  /** When true, preload must not overwrite analysis state (user loaded or cleared). */
  preloadSupersededRef: RefObject<boolean>;
  /** Bumped when user loads, accepts, or clears — stale preload responses are ignored. */
  loadGenerationRef: RefObject<number>;
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

function isPreloadStillCurrent(
  loadGenerationRef: RefObject<number>,
  preloadSupersededRef: RefObject<boolean>,
  generationAtStart: number,
): boolean {
  return !preloadSupersededRef.current && loadGenerationRef.current === generationAtStart;
}

/**
 * Runs artifact preload once on mount. Fetches from /api/* and updates state.
 */
export function useAnalysisPreload({
  preloadSupersededRef,
  loadGenerationRef,
  setPreloadLoading,
  setAnalysis,
  setAnalysisSource,
  setPendingRemoteRun,
  setRemotePollIntervalMs,
  setError,
  pendingMetricsRef,
  setArtifactCapability,
  onArtifactSourceStatus,
}: UseAnalysisPreloadParams): void {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    const generationAtStart = loadGenerationRef.current;

    debug('Preload: fetching current managed artifacts');

    loadCurrentManagedArtifacts()
      .then(({ result, status }) => {
        if (
          cancelled ||
          !isPreloadStillCurrent(loadGenerationRef, preloadSupersededRef, generationAtStart)
        ) {
          debug('Preload: skipped — stale or superseded');
          return;
        }
        setPreloadLoading(false);

        if (status.discoveryError != null && status.discoveryError.trim() !== '') {
          setError(status.discoveryError);
          setAnalysisSource(null);
          setPendingRemoteRun(null);
          setRemotePollIntervalMs(null);
          onArtifactSourceStatus?.(status);
          return;
        }

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
          return;
        }

        if (status.currentSource != null) {
          setError(MANAGED_ARTIFACT_BYTES_ERROR);
        }
        setAnalysisSource(status.currentSource);
        setArtifactCapability(
          status.missingOptionalArtifacts ?? {
            missingCatalog: false,
            missingSources: false,
          },
        );
      })
      .catch((err) => {
        if (
          cancelled ||
          !isPreloadStillCurrent(loadGenerationRef, preloadSupersededRef, generationAtStart)
        ) {
          return;
        }
        setPreloadLoading(false);
        debug('Preload: error', err);
        setError(err instanceof Error ? err.message : 'Failed to load artifacts from server');
      });

    return () => {
      cancelled = true;
    };
  }, [
    loadGenerationRef,
    preloadSupersededRef,
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
