import { useEffect, useRef, useState } from 'react';

import { requestResourceCodeFromWorker } from '@web/services/analysis-loader';

import type { AnalysisState } from '@web/types';

export interface UseResourceCodeResult {
  compiledCode: string | null;
  rawCode: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches compiled/raw SQL for a resource from the analysis worker (manifest
 * graph), since bulk {@link AnalysisState.resources} omit code for scale.
 */
export function useResourceCode(
  uniqueId: string | null,
  analysis: AnalysisState | null,
): UseResourceCodeResult {
  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    requestSequence.current += 1;
    const requestId = requestSequence.current;

    if (!uniqueId) {
      setCompiledCode(null);
      setRawCode(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setCompiledCode(null);
    setRawCode(null);
    setLoading(true);
    setError(null);

    void requestResourceCodeFromWorker(uniqueId)
      .then((payload) => {
        if (cancelled || requestSequence.current !== requestId) return;
        setCompiledCode(payload.compiledCode);
        setRawCode(payload.rawCode);
      })
      .catch((err: unknown) => {
        if (cancelled || requestSequence.current !== requestId) return;
        setCompiledCode(null);
        setRawCode(null);
        setError(err instanceof Error ? err.message : 'Failed to load SQL');
      })
      .finally(() => {
        if (!cancelled && requestSequence.current === requestId) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analysis, uniqueId]);

  return { compiledCode, rawCode, loading, error };
}
