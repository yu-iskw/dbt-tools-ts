import { useEffect } from 'react';
import { refetchFromApi } from '../services/artifactApi';
import { debug } from '../debug';
import type { AnalysisState } from '@web/types';
import type { AnalysisLoadResult } from '../services/analysisLoader';
import type { WorkspaceArtifactSource } from '../services/artifactSourceApi';

/**
 * Subscribes to dbt-artifacts-changed (Vite HMR) when analysis came from preload.
 * Refetches from /api/* and updates state on file change.
 */
export function useDbtArtifactsReload(
  analysisSource: WorkspaceArtifactSource | null,
  setAnalysis: (a: AnalysisState | null) => void,
  setError: (e: string | null) => void,
  pendingMetricsRef: { current: AnalysisLoadResult['metrics'] | null },
) {
  useEffect(() => {
    if (analysisSource !== 'preload' || !import.meta.hot) return;

    const handler = () => {
      debug('Reload: dbt-artifacts-changed received, refetching');
      refetchFromApi('preload')
        .then((result) => {
          if (result) {
            pendingMetricsRef.current = result.metrics;
            setAnalysis(result.analysis);
            setError(null);
            debug('Reload: success');
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to reload artifacts from server');
        });
    };

    import.meta.hot.on('dbt-artifacts-changed', handler);
    return () => import.meta.hot?.off('dbt-artifacts-changed', handler);
  }, [analysisSource, pendingMetricsRef, setAnalysis, setError]);
}
