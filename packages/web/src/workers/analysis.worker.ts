/// <reference lib="webworker" />

import {
  buildAnalysisSnapshotFromParsedArtifactBundle,
  type AnalysisSnapshot,
  type ManifestGraph,
} from '@dbt-tools/core/browser';
import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseSources } from 'dbt-artifacts-parser/sources';

import { matchesResource } from '../lib/analysis-workspace/utils';

import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type AnalysisWorkerTimings,
  type GetResourceCodeMessage,
  type LoadAnalysisMessage,
  type SearchResourcesMessage,
} from './analysis-protocol';
import { isTrustedDedicatedWorkerMessage } from './worker-message-guard';

function now() {
  return performance.now();
}

let cachedGraph: ManifestGraph | null = null;
let cachedResources: AnalysisSnapshot['resources'] | null = null;

const OMNIBOX_LIMIT = 8;
const MSG_NO_ANALYSIS_LOADED = 'No analysis loaded';

function buildLoadErrorResponse(requestId: number, message: string): AnalysisWorkerResponse {
  return {
    type: 'analysis-error',
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId,
    message,
  };
}

function buildResourceCodeErrorResponse(
  requestId: number,
  message: string,
): AnalysisWorkerResponse {
  return {
    type: 'resource-code-error',
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId,
    message,
  };
}

function buildSearchResourcesErrorResponse(
  requestId: number,
  message: string,
): AnalysisWorkerResponse {
  return {
    type: 'search-resources-error',
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId,
    message,
  };
}

function decodeJsonBytes(bytes: ArrayBuffer): Record<string, unknown> {
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as Record<string, unknown>;
}

function decodeOptionalJsonBytes(
  bytes: ArrayBuffer | undefined,
): Record<string, unknown> | undefined {
  return bytes == null ? undefined : decodeJsonBytes(bytes);
}

function readCodeFromGraph(
  graph: ManifestGraph,
  uniqueId: string,
): { compiledCode: string | null; rawCode: string | null } {
  const g = graph.getGraph();
  if (!g.hasNode(uniqueId)) {
    return { compiledCode: null, rawCode: null };
  }
  const attrs = g.getNodeAttributes(uniqueId) as Record<string, unknown>;
  const compiledCode = typeof attrs.compiled_code === 'string' ? attrs.compiled_code : null;
  const rawCode =
    typeof attrs.raw_code === 'string'
      ? attrs.raw_code
      : typeof attrs.raw_sql === 'string'
        ? attrs.raw_sql
        : null;
  return { compiledCode, rawCode };
}

export function handleSearchResourcesMessage(
  payload: SearchResourcesMessage,
): AnalysisWorkerResponse {
  if (payload.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
    return buildSearchResourcesErrorResponse(
      payload.requestId,
      `Unsupported protocol version: ${payload.protocolVersion}`,
    );
  }
  if (!cachedResources) {
    return buildSearchResourcesErrorResponse(payload.requestId, MSG_NO_ANALYSIS_LOADED);
  }
  const matches = cachedResources
    .filter((resource) => matchesResource(resource, payload.query))
    .slice(0, OMNIBOX_LIMIT);
  return {
    type: 'search-resources-ready',
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId: payload.requestId,
    resources: matches,
  };
}

export function handleGetResourceCodeMessage(
  payload: GetResourceCodeMessage,
): AnalysisWorkerResponse {
  if (payload.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
    return buildResourceCodeErrorResponse(
      payload.requestId,
      `Unsupported protocol version: ${payload.protocolVersion}`,
    );
  }
  if (!cachedGraph) {
    return buildResourceCodeErrorResponse(payload.requestId, MSG_NO_ANALYSIS_LOADED);
  }
  const { compiledCode, rawCode } = readCodeFromGraph(cachedGraph, payload.uniqueId);
  return {
    type: 'resource-code-ready',
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId: payload.requestId,
    compiledCode,
    rawCode,
  };
}

export async function handleLoadAnalysisMessage(
  payload: LoadAnalysisMessage,
): Promise<AnalysisWorkerResponse> {
  if (payload.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
    return buildLoadErrorResponse(
      payload.requestId,
      `Unsupported protocol version: ${payload.protocolVersion}`,
    );
  }

  try {
    cachedGraph = null;
    cachedResources = null;
    const totalStart = now();
    const decodeStart = now();
    const manifestJson = decodeJsonBytes(payload.artifactBuffers.manifestBytes);
    const runResultsJson = decodeOptionalJsonBytes(payload.artifactBuffers.runResultsBytes);
    const catalogJson = decodeOptionalJsonBytes(payload.artifactBuffers.catalogBytes);
    const sourcesJson = decodeOptionalJsonBytes(payload.artifactBuffers.sourcesBytes);
    const decodeMs = now() - decodeStart;

    const parseStart = now();
    const manifest = parseManifest(manifestJson);
    const runResults = runResultsJson == null ? undefined : parseRunResults(runResultsJson);
    const catalog = catalogJson == null ? undefined : parseCatalog(catalogJson);
    const sources = sourcesJson == null ? undefined : parseSources(sourcesJson);
    const parseMs = now() - parseStart;

    const {
      analysis,
      timings: snapshotTimings,
      graph,
    }: {
      analysis: AnalysisSnapshot;
      timings: { graphBuildMs: number; snapshotBuildMs: number };
      graph: ManifestGraph;
    } = buildAnalysisSnapshotFromParsedArtifactBundle({
      manifestJson,
      runResultsJson,
      catalogJson,
      sourcesJson,
      manifest,
      runResults,
      catalog,
      sources,
    });

    cachedGraph = graph;
    cachedResources = analysis.resources;

    const timings: AnalysisWorkerTimings = {
      decodeMs,
      parseMs,
      graphBuildMs: snapshotTimings.graphBuildMs,
      snapshotBuildMs: snapshotTimings.snapshotBuildMs,
      totalWorkerMs: now() - totalStart,
    };

    return {
      type: 'analysis-ready',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: payload.requestId,
      analysis,
      timings,
    };
  } catch (error) {
    return buildLoadErrorResponse(
      payload.requestId,
      error instanceof Error ? error.message : 'Failed to analyze artifacts',
    );
  }
}

/** Dispatches load and resource-code requests (used by tests and `onmessage`). */
export function handleAnalysisWorkerRequest(
  payload: AnalysisWorkerRequest,
): Promise<AnalysisWorkerResponse> {
  if (payload.type === 'get-resource-code') {
    return Promise.resolve(handleGetResourceCodeMessage(payload));
  }
  if (payload.type === 'search-resources') {
    return Promise.resolve(handleSearchResourcesMessage(payload));
  }
  return handleLoadAnalysisMessage(payload);
}

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
    if (!isTrustedDedicatedWorkerMessage(event)) {
      return;
    }
    void handleAnalysisWorkerRequest(event.data).then((response) => {
      self.postMessage(response);
    });
  };
}
