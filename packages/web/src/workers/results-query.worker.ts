/// <reference lib="webworker" />

import {
  createRunsResultsIndex,
  filterRunsResultsIndex,
  summarizeRunsFacets,
  type RunsResultsIndex,
  type RunsResultsSummary,
} from '@web/lib/analysis-workspace/results-data-source';

import { isTrustedDedicatedWorkerMessage } from './worker-message-guard';

import type {
  DashboardStatusFilter,
  RunsKind,
  RunsViewState,
} from '@web/lib/analysis-workspace/types';
import type { ExecutionRow, MaterializationKind } from '@web/types';

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
let lastQuery: {
  key: string;
  matches: ReturnType<typeof filterRunsResultsIndex>;
  summary: RunsResultsSummary;
} | null = null;

function postError(message: string) {
  self.postMessage({ type: 'error', message } satisfies ErrorMessage);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (!isTrustedDedicatedWorkerMessage(event)) {
    return;
  }
  const payload = event.data;

  if (payload.type === 'init') {
    index = createRunsResultsIndex(payload.rows);
    lastQuery = null;
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

  if (lastQuery?.key !== queryKey) {
    lastQuery = {
      key: queryKey,
      matches: filterRunsResultsIndex(index, payload),
      summary: summarizeRunsFacets(index, payload),
    };
  }

  self.postMessage({
    type: 'query-result',
    requestId: payload.requestId,
    rows: lastQuery.matches.slice(0, payload.limit).map((entry) => entry.row),
    totalMatches: lastQuery.matches.length,
    summary: lastQuery.summary,
  } satisfies QueryResultMessage);
};
