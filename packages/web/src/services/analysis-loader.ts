/** Posts to the analysis Web Worker and normalizes load / search / code responses. */
import { debug, markDebug, measureDebug } from '../debug';
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisArtifactBufferInputs,
  type AnalysisLoadSource,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type AnalysisWorkerTimings,
} from '../workers/analysis-protocol';

import type { AnalysisState } from '@web/types';

const ERR_UNEXPECTED_ANALYSIS_RESPONSE = 'Unexpected analysis worker response';
const ERR_UNEXPECTED_RESOURCE_CODE_RESPONSE = 'Unexpected resource-code worker response';
const ERR_UNEXPECTED_SEARCH_RESPONSE = 'Unexpected search-resources worker response';

/** Matches {@link AnalysisWorkerRequest} `search-resources` and pending map kind. */
const WORKER_MSG_SEARCH_RESOURCES = 'search-resources' as const;

export interface AnalysisLoadMetrics {
  requestId: number;
  source: AnalysisLoadSource;
  dispatchMarkName: string;
  readyMarkName: string;
  analysisReadyMeasureName: string;
  timings: AnalysisWorkerTimings;
}

export interface AnalysisLoadResult {
  analysis: AnalysisState;
  metrics: AnalysisLoadMetrics;
}

export interface ResourceCodePayload {
  compiledCode: string | null;
  rawCode: string | null;
}

type PendingLoad = {
  kind: 'load';
  resolve: (value: AnalysisLoadResult) => void;
  reject: (reason?: unknown) => void;
  source: AnalysisLoadSource;
};

type PendingResourceCode = {
  kind: 'resource-code';
  resolve: (value: ResourceCodePayload) => void;
  reject: (reason?: unknown) => void;
};

type PendingSearchResources = {
  kind: typeof WORKER_MSG_SEARCH_RESOURCES;
  resolve: (value: AnalysisState['resources']) => void;
  reject: (reason?: unknown) => void;
};

type PendingRequest = PendingLoad | PendingResourceCode | PendingSearchResources;

class AnalysisWorkerClient {
  private worker: Worker;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  constructor() {
    this.worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      const message = this.formatWorkerError(event);
      debug('Analysis worker error', message);
      for (const pending of this.pending.values()) {
        pending.reject(new Error(message));
      }
      this.pending.clear();
    };
    this.worker.onmessageerror = () => {
      const message = 'Analysis worker failed to deserialize a message';
      debug('Analysis worker message error');
      for (const pending of this.pending.values()) {
        pending.reject(new Error(message));
      }
      this.pending.clear();
    };
  }

  private formatWorkerError(event: ErrorEvent): string {
    const details: string[] = [];
    if (typeof event.filename === 'string' && event.filename.length > 0) {
      const location =
        event.lineno > 0
          ? `${event.filename}:${event.lineno}${event.colno > 0 ? `:${event.colno}` : ''}`
          : event.filename;
      details.push(location);
    }
    if (event.error instanceof Error && event.error.message.trim() !== '') {
      details.push(event.error.message);
    }

    const primary = event.message?.trim();
    if (primary) {
      return details.length > 0
        ? `Analysis worker failed: ${primary} (${details.join(' | ')})`
        : `Analysis worker failed: ${primary}`;
    }

    if (details.length > 0) {
      return `Analysis worker failed: ${details.join(' | ')}`;
    }

    return 'Analysis worker failed';
  }

  private collectTransferables(artifactBuffers: AnalysisArtifactBufferInputs): ArrayBuffer[] {
    return [
      artifactBuffers.manifestBytes,
      artifactBuffers.runResultsBytes,
      artifactBuffers.catalogBytes,
      artifactBuffers.sourcesBytes,
    ].filter((value): value is ArrayBuffer => value instanceof ArrayBuffer);
  }

  async loadAnalysis(
    artifactBuffers: AnalysisArtifactBufferInputs,
    source: AnalysisLoadSource,
  ): Promise<AnalysisLoadResult> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const dispatchMarkName = `analysis-load:${requestId}:dispatch`;
    const readyMarkName = `analysis-load:${requestId}:ready`;
    const analysisReadyMeasureName = `analysis-load:${requestId}:analysis-ready`;

    markDebug(dispatchMarkName);

    const request: AnalysisWorkerRequest = {
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      artifactBuffers,
      source,
    };

    const promise = new Promise<AnalysisLoadResult>((resolve, reject) => {
      this.pending.set(requestId, { kind: 'load', resolve, reject, source });
    });

    this.worker.postMessage(request, this.collectTransferables(artifactBuffers));

    return promise.then((result) => {
      markDebug(readyMarkName);
      measureDebug(analysisReadyMeasureName, dispatchMarkName, readyMarkName);
      debug('Analysis worker ready', {
        requestId,
        source,
        timings: result.metrics.timings,
      });
      return {
        ...result,
        metrics: {
          ...result.metrics,
          dispatchMarkName,
          readyMarkName,
          analysisReadyMeasureName,
        },
      };
    });
  }

  async requestResourceCode(uniqueId: string): Promise<ResourceCodePayload> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const request: AnalysisWorkerRequest = {
      type: 'get-resource-code',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      uniqueId,
    };

    const promise = new Promise<ResourceCodePayload>((resolve, reject) => {
      this.pending.set(requestId, { kind: 'resource-code', resolve, reject });
    });

    this.worker.postMessage(request);
    return promise;
  }

  invalidatePendingLoads(): void {
    this.worker.postMessage({ type: 'invalidate-pending-loads' });
  }

  async searchResources(query: string): Promise<AnalysisState['resources']> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const request: AnalysisWorkerRequest = {
      type: WORKER_MSG_SEARCH_RESOURCES,
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      query,
    };

    const promise = new Promise<AnalysisState['resources']>((resolve, reject) => {
      this.pending.set(requestId, {
        kind: WORKER_MSG_SEARCH_RESOURCES,
        resolve,
        reject,
      });
    });

    this.worker.postMessage(request);
    return promise;
  }

  terminate() {
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Analysis worker terminated'));
    }
    this.pending.clear();
  }

  private resolveLoadResponse(pending: PendingLoad, payload: AnalysisWorkerResponse): boolean {
    if (payload.type === 'analysis-error') {
      pending.reject(new Error(payload.message));
      return true;
    }
    if (payload.type === 'analysis-ready') {
      pending.resolve({
        analysis: payload.analysis,
        metrics: {
          requestId: payload.requestId,
          source: pending.source,
          dispatchMarkName: '',
          readyMarkName: '',
          analysisReadyMeasureName: '',
          timings: payload.timings,
        },
      });
      return true;
    }
    return false;
  }

  private resolveResourceCodeResponse(
    pending: PendingResourceCode,
    payload: AnalysisWorkerResponse,
  ): boolean {
    if (payload.type === 'resource-code-error') {
      pending.reject(new Error(payload.message));
      return true;
    }
    if (payload.type === 'resource-code-ready') {
      pending.resolve({
        compiledCode: payload.compiledCode,
        rawCode: payload.rawCode,
      });
      return true;
    }
    return false;
  }

  private resolveSearchResourcesResponse(
    pending: PendingSearchResources,
    payload: AnalysisWorkerResponse,
  ): boolean {
    if (payload.type === 'search-resources-error') {
      pending.reject(new Error(payload.message));
      return true;
    }
    if (payload.type === 'search-resources-ready') {
      pending.resolve(payload.resources);
      return true;
    }
    return false;
  }

  private handleMessage(payload: AnalysisWorkerResponse) {
    const pending = this.pending.get(payload.requestId);
    if (!pending) return;
    this.pending.delete(payload.requestId);

    if (pending.kind === 'load') {
      if (this.resolveLoadResponse(pending, payload)) return;
      pending.reject(new Error(ERR_UNEXPECTED_ANALYSIS_RESPONSE));
      return;
    }

    if (pending.kind === 'resource-code') {
      if (this.resolveResourceCodeResponse(pending, payload)) return;
      pending.reject(new Error(ERR_UNEXPECTED_RESOURCE_CODE_RESPONSE));
      return;
    }

    if (pending.kind === WORKER_MSG_SEARCH_RESOURCES) {
      if (this.resolveSearchResourcesResponse(pending, payload)) return;
      pending.reject(new Error(ERR_UNEXPECTED_SEARCH_RESPONSE));
    }
  }
}

let workerClient: AnalysisWorkerClient | null = null;

function getWorkerClient(): AnalysisWorkerClient {
  workerClient ??= new AnalysisWorkerClient();
  return workerClient;
}

export async function loadAnalysisFromBuffers(
  artifactBuffers: AnalysisArtifactBufferInputs,
  source: AnalysisLoadSource,
): Promise<AnalysisLoadResult> {
  const client = getWorkerClient();
  if (source !== 'preload') {
    client.invalidatePendingLoads();
  }
  return client.loadAnalysis(artifactBuffers, source);
}

export function invalidateAnalysisWorkerPendingLoads(): void {
  if (typeof Worker === 'undefined') return;
  getWorkerClient().invalidatePendingLoads();
}

export async function requestResourceCodeFromWorker(
  uniqueId: string,
): Promise<ResourceCodePayload> {
  return getWorkerClient().requestResourceCode(uniqueId);
}

export async function searchResourcesFromWorker(
  query: string,
): Promise<AnalysisState['resources']> {
  return getWorkerClient().searchResources(query);
}

export function resetAnalysisWorkerClientForTests(): void {
  workerClient?.terminate();
  workerClient = null;
}
