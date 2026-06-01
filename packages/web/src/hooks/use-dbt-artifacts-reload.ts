import { useEffect, type RefObject } from 'react';

import { debug } from '../debug';
import { refetchFromApi } from '../services/artifact-api';

import type { AnalysisLoadResult } from '../services/analysis-loader';
import type { WorkspaceArtifactSource } from '../services/artifact-source-api';
import type { AnalysisState } from '@web/types';

/**
 * Subscribes to dbt-artifacts-changed (Vite HMR) when analysis came from preload.
 * Refetches from /api/* and updates state on file change.
 */
export function useDbtArtifactsReload(
  analysisSource: WorkspaceArtifactSource | null,
  setAnalysis: (a: AnalysisState | null) => void,
  setError: (e: string | null) => void,
  pendingMetricsRef: { current: AnalysisLoadResult['metrics'] | null },
  loadGenerationRef: RefObject<number>,
  preloadSupersededRef: RefObject<boolean>,
): void {
  useEffect(() => {
    if (analysisSource !== 'preload' || !import.meta.hot) return;

    const handler = () => {
      const generationAtStart = loadGenerationRef.current;
      debug('Reload: dbt-artifacts-changed received, refetching');
      refetchFromApi('preload')
        .then((result) => {
          if (
            preloadSupersededRef.current ||
            loadGenerationRef.current !== generationAtStart
          ) {
            debug('Reload: skipped stale HMR refetch');
            return;
          }
          if (result) {
            pendingMetricsRef.current = result.metrics;
            setAnalysis(result.analysis);
            setError(null);
            debug('Reload: success');
          }
        })
        .catch((err) => {
          if (
            preloadSupersededRef.current ||
            loadGenerationRef.current !== generationAtStart
          ) {
            return;
          }
          setError(err instanceof Error ? err.message : 'Failed to reload artifacts from server');
        });
    };

    import.meta.hot.on('dbt-artifacts-changed', handler);
    return () => import.meta.hot?.off('dbt-artifacts-changed', handler);
  }, [
    analysisSource,
    loadGenerationRef,
    pendingMetricsRef,
    preloadSupersededRef,
    setAnalysis,
    setError,
  ]);
}
