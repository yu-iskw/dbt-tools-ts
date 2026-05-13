import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refetchFromApi } from './artifactApi';
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerResponse,
} from '../workers/analysisProtocol';
import { resetAnalysisWorkerClientForTests } from './analysisLoader';
import type { AnalysisState } from '@web/types';

class MockWorker {
  onmessage: ((event: MessageEvent<AnalysisWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

function createAnalysisState(): AnalysisState {
  return {
    summary: {
      total_execution_time: 1,
      total_nodes: 5,
      nodes_by_status: { success: 5 },
      critical_path: { path: ['model.jaffle_shop.orders'], total_time: 1 },
      node_executions: [],
    },
    projectName: 'jaffle_shop',
    runStartedAt: 1,
    ganttData: [],
    bottlenecks: undefined,
    graphSummary: {
      totalNodes: 5,
      totalEdges: 4,
      hasCycles: false,
      nodesByType: { model: 5 },
    },
    resources: [],
    resourceGroups: [],
    executions: [],
    statusBreakdown: [],
    threadStats: [],
    dependencyIndex: {},
    timelineAdjacency: {},
    selectedResourceId: 'model.jaffle_shop.orders',
    invocationId: null,
  };
}

describe('artifactApi preload integration', () => {
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
    vi.restoreAllMocks();
  });

  it('loads API buffers through the analysis worker client', async () => {
    const manifestBytes = new TextEncoder().encode('{"manifest":true}').buffer;
    const runResultsBytes = new TextEncoder().encode('{"run_results":true}').buffer;

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          arrayBuffer: vi.fn().mockResolvedValue(manifestBytes),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          arrayBuffer: vi.fn().mockResolvedValue(runResultsBytes),
        })
        .mockResolvedValueOnce({
          ok: false,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          arrayBuffer: vi.fn(),
        })
        .mockResolvedValueOnce({
          ok: false,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          arrayBuffer: vi.fn(),
        }) as typeof fetch,
    );

    const resultPromise = refetchFromApi();
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
    });
    const request = worker.postMessage.mock.calls[0]?.[0] as
      | {
          type: string;
          requestId: number;
          source: string;
          artifactBuffers: object;
        }
      | undefined;

    expect(request?.type).toBe('load-analysis');
    expect(request?.source).toBe('preload');
    expect(request?.artifactBuffers).toEqual(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
      }),
    );
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['/api/artifacts/current/manifest.json'],
      ['/api/artifacts/current/run_results.json'],
      ['/api/artifacts/current/catalog.json'],
      ['/api/artifacts/current/sources.json'],
    ]);

    worker.onmessage?.({
      data: {
        type: 'analysis-ready',
        protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
        requestId: request!.requestId,
        analysis: createAnalysisState(),
        timings: {
          decodeMs: 1,
          parseMs: 1,
          graphBuildMs: 1,
          snapshotBuildMs: 1,
          totalWorkerMs: 4,
        },
      },
    } as MessageEvent<AnalysisWorkerResponse>);

    await expect(resultPromise).resolves.toMatchObject({
      analysis: { summary: { total_nodes: 5 } },
      metrics: { source: 'preload' },
    });
  });
});
