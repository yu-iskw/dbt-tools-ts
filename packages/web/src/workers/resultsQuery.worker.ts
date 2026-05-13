/// <reference lib="webworker" />

import type { ExecutionRow, MaterializationKind } from '@web/types';
import type {
  DashboardStatusFilter,
  RunsKind,
  RunsViewState,
} from '@web/lib/analysis-workspace/types';
import {
  createRunsResultsIndex,
  filterRunsResultsIndex,
  type RunsResultsIndex,
  type RunsResultsSummary,
} from '@web/lib/analysis-workspace/resultsDataSource';

interface InitMessage {
  type: 'init';
  rows: ExecutionRow[];
}

interface QueryMessage {
  type: 'query';
  requestId: number;
  kind: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  resourceTypes: string[];
  materializationKinds: MaterializationKind[];
  threadIds: string[];
  durationBand: RunsViewState['durationBand'];
  sortBy: RunsViewState['sortBy'];
  sortDirection: RunsViewState['sortDirection'];
  limit: number;
}

type WorkerMessage = InitMessage | QueryMessage;

interface ReadyMessage {
  type: 'ready';
  summary: RunsResultsSummary;
}

interface QueryResultMessage {
  type: 'query-result';
  requestId: number;
  rows: ExecutionRow[];
  totalMatches: number;
  summary: RunsResultsSummary;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

let index: RunsResultsIndex | null = null;
let lastQueryKey: string | null = null;
let lastMatches: ReturnType<typeof filterRunsResultsIndex> = [];

function postError(message: string) {
  self.postMessage({ type: 'error', message } satisfies ErrorMessage);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;

  if (payload.type === 'init') {
    index = createRunsResultsIndex(payload.rows);
    lastQueryKey = null;
    lastMatches = [];
    self.postMessage({
      type: 'ready',
      summary: index.summary,
    } satisfies ReadyMessage);
    return;
  }

  if (index == null) {
    postError('Results worker queried before initialization.');
    return;
  }

  const queryKey = [
    payload.kind,
    payload.status,
    payload.query.trim().toLowerCase(),
    payload.resourceTypes.sort().join(','),
    payload.materializationKinds.sort().join(','),
    payload.threadIds.sort().join(','),
    payload.durationBand,
    payload.sortBy,
    payload.sortDirection,
  ].join('::');

  if (queryKey !== lastQueryKey) {
    lastMatches = filterRunsResultsIndex(index, {
      kind: payload.kind,
      status: payload.status,
      query: payload.query,
      resourceTypes: payload.resourceTypes,
      materializationKinds: payload.materializationKinds,
      threadIds: payload.threadIds,
      durationBand: payload.durationBand,
      sortBy: payload.sortBy,
      sortDirection: payload.sortDirection,
    });
    lastQueryKey = queryKey;
  }

  const visibleMatches = lastMatches.slice(0, payload.limit);
  self.postMessage({
    type: 'query-result',
    requestId: payload.requestId,
    rows: visibleMatches.map((entry) => entry.row),
    totalMatches: lastMatches.length,
    summary: {
      status: {
        all: lastMatches.length,
        positive: lastMatches.filter((entry) => entry.row.statusTone === 'positive').length,
        warning: lastMatches.filter((entry) => entry.row.statusTone === 'warning').length,
        danger: lastMatches.filter((entry) => entry.row.statusTone === 'danger').length,
      },
      facets: {
        all: lastMatches.length,
        models: lastMatches.filter((entry) => {
          const type = entry.row.resourceType;
          return (
            type !== 'test' &&
            type !== 'unit_test' &&
            type !== 'seed' &&
            type !== 'snapshot' &&
            type !== 'operation' &&
            type !== 'sql_operation' &&
            type !== 'macro'
          );
        }).length,
        tests: lastMatches.filter(
          (entry) => entry.row.resourceType === 'test' || entry.row.resourceType === 'unit_test',
        ).length,
        seeds: lastMatches.filter((entry) => entry.row.resourceType === 'seed').length,
        snapshots: lastMatches.filter((entry) => entry.row.resourceType === 'snapshot').length,
        operations: lastMatches.filter((entry) =>
          ['operation', 'sql_operation', 'macro'].includes(entry.row.resourceType),
        ).length,
        healthy: lastMatches.filter((entry) => entry.row.statusTone === 'positive').length,
        warnings: lastMatches.filter((entry) => entry.row.statusTone === 'warning').length,
        errors: lastMatches.filter((entry) => entry.row.statusTone === 'danger').length,
        issues: lastMatches.filter(
          (entry) => entry.row.statusTone === 'danger' || entry.row.statusTone === 'warning',
        ).length,
      },
      resourceTypes: Object.fromEntries(
        Object.entries(
          visibleMatches.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.row.resourceType] = (acc[entry.row.resourceType] ?? 0) + 1;
            return acc;
          }, {}),
        ),
      ),
      threadIds: Object.fromEntries(
        Object.entries(
          visibleMatches.reduce<Record<string, number>>((acc, entry) => {
            if (entry.row.threadId) {
              acc[entry.row.threadId] = (acc[entry.row.threadId] ?? 0) + 1;
            }
            return acc;
          }, {}),
        ),
      ),
    },
  } satisfies QueryResultMessage);
};
