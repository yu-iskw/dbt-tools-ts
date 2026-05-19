import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerResponse,
} from '../workers/analysis-protocol';

import { loadAnalysisFromBuffers, resetAnalysisWorkerClientForTests } from './analysis-loader';

import type { AnalysisState } from '@web/types';

class MockWorker {
  onmessage: ((event: MessageEvent<AnalysisWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

function createAnalysisState(id: string): AnalysisState {
  return {
    summary: {
      total_execution_time: 1,
      total_nodes: 1,
      nodes_by_status: { success: 1 },
      critical_path: { path: [id], total_time: 1 },
      node_executions: [],
    },
    projectName: 'jaffle_shop',
    runStartedAt: 1,
    ganttData: [],
    bottlenecks: undefined,
    graphSummary: {
      totalNodes: 1,
      totalEdges: 0,
      hasCycles: false,
      nodesByType: { model: 1 },
    },
    resources: [],
    resourceGroups: [],
    executions: [],
    statusBreakdown: [],
    threadStats: [],
    dependencyIndex: {},
    timelineAdjacency: {},
    selectedResourceId: id,
    invocationId: null,
  };
}

describe('analysis-loader', () => {
  let worker: MockWorker;

  beforeEach(() => {
    worker = new MockWorker();
    vi.stubGlobal(
      'Worker',
      class WorkerCtor {
        constructor() {
          return worker as unknown as Worker;
        }
      } as unknown as typeof Worker,
    );
  });

  afterEach(() => {
    resetAnalysisWorkerClientForTests();
    vi.unstubAllGlobals();
  });

  it('correlates out-of-order worker responses by requestId', async () => {
    const p1 = loadAnalysisFromBuffers(
      {
        manifestBytes: new ArrayBuffer(1),
        runResultsBytes: new ArrayBuffer(1),
      },
      'upload',
    );
    const p2 = loadAnalysisFromBuffers(
      {
        manifestBytes: new ArrayBuffer(1),
        runResultsBytes: new ArrayBuffer(1),
      },
      'preload',
    );

    const requests = worker.postMessage.mock.calls.map(
      ([request]) => request as { requestId: number },
    );

    worker.onmessage?.({
      data: {
        type: 'analysis-ready',
        protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
        requestId: requests[1]!.requestId,
        analysis: createAnalysisState('second'),
        timings: {
          decodeMs: 1,
          parseMs: 1,
          graphBuildMs: 1,
          snapshotBuildMs: 1,
          totalWorkerMs: 4,
        },
      },
    } as MessageEvent<AnalysisWorkerResponse>);

    worker.onmessage?.({
      data: {
        type: 'analysis-ready',
        protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
        requestId: requests[0]!.requestId,
        analysis: createAnalysisState('first'),
        timings: {
          decodeMs: 1,
          parseMs: 1,
          graphBuildMs: 1,
          snapshotBuildMs: 1,
          totalWorkerMs: 4,
        },
      },
    } as MessageEvent<AnalysisWorkerResponse>);

    await expect(p2).resolves.toMatchObject({
      analysis: { selectedResourceId: 'second' },
      metrics: { requestId: requests[1]!.requestId, source: 'preload' },
    });
    await expect(p1).resolves.toMatchObject({
      analysis: { selectedResourceId: 'first' },
      metrics: { requestId: requests[0]!.requestId, source: 'upload' },
    });
  });

  it('surfaces worker runtime details when the worker crashes', async () => {
    const resultPromise = loadAnalysisFromBuffers(
      {
        manifestBytes: new ArrayBuffer(1),
        runResultsBytes: new ArrayBuffer(1),
      },
      'preload',
    );

    worker.onerror?.({
      message: 'Failed to fetch dynamically imported module',
      filename: 'http://127.0.0.1:5173/src/workers/analysis.worker.ts',
      lineno: 1,
      colno: 1,
      error: new Error('Cannot resolve dbt-artifacts-parser/sources'),
    } as ErrorEvent);

    await expect(resultPromise).rejects.toThrow(
      /Analysis worker failed: Failed to fetch dynamically imported module/,
    );
    await expect(resultPromise).rejects.toThrow(/Cannot resolve dbt-artifacts-parser\/sources/);
  });
});
