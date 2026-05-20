import { useEffect, useMemo, useRef, useState } from 'react';

import type { RunsResultsSummary } from '@web/lib/analysis-workspace/results-data-source';
import type { RunsViewState } from '@web/lib/analysis-workspace/types';
import type { ExecutionRow } from '@web/types';

const RESULTS_BATCH_SIZE = 100;

type WorkerReadyMessage = {
  type: 'ready';
  summary: RunsResultsSummary;
};

type WorkerQueryResultMessage = {
  type: 'query-result';
  requestId: number;
  rows: ExecutionRow[];
  totalMatches: number;
  summary: RunsResultsSummary;
};

type WorkerErrorMessage = {
  type: 'error';
  message: string;
};

type WorkerResponse = WorkerErrorMessage | WorkerQueryResultMessage | WorkerReadyMessage;

function emptySummary(): RunsResultsSummary {
  return {
    status: { all: 0, positive: 0, warning: 0, danger: 0 },
    facets: {
      all: 0,
      models: 0,
      tests: 0,
      seeds: 0,
      snapshots: 0,
      operations: 0,
      healthy: 0,
      warnings: 0,
      errors: 0,
      issues: 0,
    },
    resourceTypes: {},
    threadIds: {},
  };
}

export interface RunsResultsSourceState {
  rows: ExecutionRow[];
  totalMatches: number;
  totalVisible: number;
  summary: RunsResultsSummary;
  hasMore: boolean;
  isIndexing: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
}

export function useRunsResultsSource(
  allRows: ExecutionRow[],
  viewState: RunsViewState,
  enabled = true,
): RunsResultsSourceState {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [revealedCount, setRevealedCount] = useState(RESULTS_BATCH_SIZE);
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [summary, setSummary] = useState<RunsResultsSummary>(emptySummary);
  const [isIndexing, setIsIndexing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRevealedCount(RESULTS_BATCH_SIZE);
  }, [
    viewState.kind,
    viewState.status,
    viewState.query,
    viewState.durationBand,
    viewState.sortBy,
    viewState.sortDirection,
    viewState.resourceTypes,
    viewState.materializationKinds,
    viewState.threadIds,
    allRows,
  ]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setIsIndexing(false);
      setIsLoading(false);
      setRows([]);
      setTotalMatches(0);
      setSummary(emptySummary());
      setError(null);
      return;
    }

    const worker = new Worker(new URL('../workers/results-query.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    setReady(false);
    setIsIndexing(true);
    setRows([]);
    setTotalMatches(0);
    setSummary(emptySummary());
    setError(null);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      if (payload.type === 'ready') {
        setReady(true);
        setIsIndexing(false);
        setSummary(payload.summary);
        return;
      }
      if (payload.type === 'query-result') {
        if (payload.requestId !== requestIdRef.current) return;
        setRows(payload.rows);
        setTotalMatches(payload.totalMatches);
        setSummary(payload.summary);
        setIsLoading(false);
        return;
      }
      setError(payload.message);
      setIsIndexing(false);
      setIsLoading(false);
    };

    worker.postMessage({ type: 'init', rows: allRows });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [allRows, enabled]);

  useEffect(() => {
    if (!enabled || !ready || workerRef.current == null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'query',
      requestId,
      kind: viewState.kind,
      status: viewState.status,
      query: viewState.query,
      resourceTypes: Array.from(viewState.resourceTypes),
      materializationKinds: Array.from(viewState.materializationKinds),
      threadIds: Array.from(viewState.threadIds),
      durationBand: viewState.durationBand,
      sortBy: viewState.sortBy,
      sortDirection: viewState.sortDirection,
      limit: revealedCount,
    });
  }, [enabled, ready, revealedCount, viewState]);

  return useMemo(
    () => ({
      rows,
      totalMatches,
      totalVisible: rows.length,
      summary,
      hasMore: rows.length < totalMatches,
      isIndexing,
      isLoading,
      error,
      loadMore: () => setRevealedCount((current) => current + RESULTS_BATCH_SIZE),
    }),
    [rows, totalMatches, summary, isIndexing, isLoading, error],
  );
}
