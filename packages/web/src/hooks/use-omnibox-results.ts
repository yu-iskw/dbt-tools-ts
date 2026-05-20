import { searchResourcesFromWorker } from '@web/services/analysis-loader';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SearchState } from '@web/lib/analysis-workspace/types';
import type { AnalysisState, ResourceNode } from '@web/types';

const OMNIBOX_LIMIT = 8;

/** Return shape of {@link use-omnibox-results} for props typing without a value import. */
export type OmniboxResultsSnapshot = {
  results: ResourceNode[];
  loading: boolean;
};

/** Recent resources only (empty query). Search hits use the analysis worker. */
export function computeOmniboxRecentResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
): ResourceNode[] {
  if (!analysis || searchState.query.trim()) return [];
  return searchState.recentResourceIds
    .map((id) => analysis.resources.find((resource) => resource.uniqueId === id) ?? null)
    .filter((resource): resource is ResourceNode => resource != null)
    .slice(0, OMNIBOX_LIMIT);
}

/**
 * Omnibox matches: recent picks when the query is empty; otherwise worker-side
 * scan (keeps the main thread responsive on huge projects).
 */
export function useOmniboxResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
): OmniboxResultsSnapshot {
  const queryTrimmed = searchState.query.trim();
  const recentResults = useMemo(
    () => computeOmniboxRecentResults(analysis, searchState),
    [analysis, searchState.query, searchState.recentResourceIds],
  );

  const [searchHits, setSearchHits] = useState<ResourceNode[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!analysis || !queryTrimmed) {
      requestSequence.current += 1;
      setSearchHits([]);
      setLoading(false);
      return;
    }

    requestSequence.current += 1;
    const requestId = requestSequence.current;
    let cancelled = false;
    setSearchHits([]);
    setLoading(true);

    void searchResourcesFromWorker(searchState.query)
      .then((resources) => {
        if (!cancelled && requestSequence.current === requestId) {
          setSearchHits(resources);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled && requestSequence.current === requestId) {
          setSearchHits([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analysis, queryTrimmed, searchState.query]);

  if (!queryTrimmed) {
    return { results: recentResults, loading: false };
  }
  return { results: searchHits, loading };
}
