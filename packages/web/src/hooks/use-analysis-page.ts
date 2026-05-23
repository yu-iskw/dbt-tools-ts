import { useCallback, useEffect, useRef, useState } from 'react';

import {
  artifactLocationSnapshotFromStatus,
  type ArtifactLocationSnapshot,
} from '@web/lib/artifact-source';

import { debug, markDebug, measureDebug } from '../debug';
import { invalidateAnalysisWorkerPendingLoads } from '../services/analysis-loader';
import {
  fetchArtifactSourceStatus,
  refetchFromApi,
  switchToArtifactRun,
  type MissingOptionalArtifactsState,
  type RemoteArtifactRun,
  type WorkspaceArtifactSource,
} from '../services/artifact-api';

import { useAnalysisPreload } from './use-analysis-preload';
import { useDbtArtifactsReload } from './use-dbt-artifacts-reload';
import { useRemoteArtifactPoll } from './use-remote-artifact-poll';

import type { AnalysisLoadResult } from '../services/analysis-loader';
import type { ArtifactSourceStatus } from '../services/artifact-source-api';
import type { AnalysisState } from '@web/types';

export interface UseAnalysisPageResult {
  analysis: AnalysisState | null;
  analysisSource: WorkspaceArtifactSource | null;
  artifactLocationSnapshot: ArtifactLocationSnapshot | null;
  artifactCapability: MissingOptionalArtifactsState;
  error: string | null;
  preloadLoading: boolean;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onLoadDifferent: () => void;
  onManagedAnalysisLoaded: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (error: string | null) => void;
  onAcceptPendingRemoteRun: () => Promise<void>;
}

/**
 * Composes preload and reload hooks. Exposes page state and handlers for the view.
 */
export function useAnalysisPage(): UseAnalysisPageResult {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<WorkspaceArtifactSource | null>(null);
  const [preloadLoading, setPreloadLoading] = useState(true);
  const [pendingRemoteRun, setPendingRemoteRun] = useState<RemoteArtifactRun | null>(null);
  const [acceptingRemoteRun, setAcceptingRemoteRun] = useState(false);
  const [remotePollIntervalMs, setRemotePollIntervalMs] = useState<number | null>(null);
  const [artifactCapability, setArtifactCapability] = useState<MissingOptionalArtifactsState>({
    missingCatalog: false,
    missingSources: false,
  });
  const [artifactLocationSnapshot, setArtifactLocationSnapshot] =
    useState<ArtifactLocationSnapshot | null>(null);
  const pendingMetricsRef = useRef<AnalysisLoadResult['metrics'] | null>(null);
  const preloadSupersededRef = useRef(false);

  const mergeSnapshotFromStatus = useCallback((status: ArtifactSourceStatus) => {
    setArtifactLocationSnapshot((prev) => {
      const next = artifactLocationSnapshotFromStatus(status);
      if (next == null && prev == null) return prev;
      if (
        next != null &&
        prev != null &&
        next.sourceKind === prev.sourceKind &&
        next.locationDisplay === prev.locationDisplay
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useAnalysisPreload({
    preloadSupersededRef,
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setError,
    pendingMetricsRef,
    setArtifactCapability,
    onArtifactSourceStatus: mergeSnapshotFromStatus,
  });

  useDbtArtifactsReload(analysisSource, setAnalysis, setError, pendingMetricsRef);

  useRemoteArtifactPoll(
    analysisSource,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    remotePollIntervalMs,
    mergeSnapshotFromStatus,
  );

  useEffect(() => {
    if (analysis == null || pendingMetricsRef.current == null) return;
    const metrics = pendingMetricsRef.current;
    pendingMetricsRef.current = null;

    requestAnimationFrame(() => {
      const interactiveMarkName = `analysis-load:${metrics.requestId}:interactive`;
      const interactiveMeasureName = `analysis-load:${metrics.requestId}:first-interactive-frame`;
      markDebug(interactiveMarkName);
      measureDebug(interactiveMeasureName, metrics.dispatchMarkName, interactiveMarkName);
      debug('Analysis load metrics', {
        requestId: metrics.requestId,
        source: metrics.source,
        timings: metrics.timings,
      });
    });
  }, [analysis]);

  return {
    analysis,
    analysisSource,
    artifactLocationSnapshot,
    artifactCapability,
    error,
    preloadLoading,
    pendingRemoteRun,
    acceptingRemoteRun,
    onLoadDifferent: () => {
      preloadSupersededRef.current = true;
      invalidateAnalysisWorkerPendingLoads();
      setAnalysis(null);
      setAnalysisSource(null);
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      setError(null);
      setArtifactLocationSnapshot(null);
      setArtifactCapability({
        missingCatalog: false,
        missingSources: false,
      });
    },
    onManagedAnalysisLoaded: (result, source, optionalArtifacts) => {
      preloadSupersededRef.current = true;
      pendingMetricsRef.current = result.metrics;
      setAnalysisSource(source);
      setPendingRemoteRun(null);
      setAnalysis(result.analysis);
      setArtifactCapability(optionalArtifacts);
      void fetchArtifactSourceStatus()
        .then(mergeSnapshotFromStatus)
        .catch(() => {
          /* status refresh is best-effort */
        });
    },
    onError: setError,
    onAcceptPendingRemoteRun: async () => {
      if (pendingRemoteRun == null) return;

      setAcceptingRemoteRun(true);
      try {
        const status = await switchToArtifactRun(pendingRemoteRun.runId);
        const result = await refetchFromApi('remote');
        if (result != null) {
          pendingMetricsRef.current = result.metrics;
          setAnalysis(result.analysis);
          setAnalysisSource(status.currentSource);
          setRemotePollIntervalMs(status.pollIntervalMs);
          setError(null);
          setArtifactCapability(
            status.missingOptionalArtifacts ?? {
              missingCatalog: false,
              missingSources: false,
            },
          );
        }
        setPendingRemoteRun(status.pendingRun);
        mergeSnapshotFromStatus(status);
      } catch (switchError) {
        setError(
          switchError instanceof Error
            ? switchError.message
            : 'Failed to switch remote artifact run',
        );
      } finally {
        setAcceptingRemoteRun(false);
      }
    },
  };
}
