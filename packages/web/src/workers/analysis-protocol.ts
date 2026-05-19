import type { WorkspaceArtifactSource } from '../lib/artifact-source-kind';
import type { AnalysisSnapshot } from '@dbt-tools/core/browser';

export const ANALYSIS_WORKER_PROTOCOL_VERSION = 4;

export type AnalysisLoadSource = WorkspaceArtifactSource;

export interface AnalysisArtifactBufferInputs {
  manifestBytes: ArrayBuffer;
  runResultsBytes?: ArrayBuffer;
  catalogBytes?: ArrayBuffer;
  sourcesBytes?: ArrayBuffer;
}

export interface AnalysisWorkerTimings {
  decodeMs: number;
  parseMs: number;
  graphBuildMs: number;
  snapshotBuildMs: number;
  totalWorkerMs: number;
}

export interface LoadAnalysisMessage {
  type: 'load-analysis';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  artifactBuffers: AnalysisArtifactBufferInputs;
  source: AnalysisLoadSource;
}

export interface GetResourceCodeMessage {
  type: 'get-resource-code';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  uniqueId: string;
}

export interface SearchResourcesMessage {
  type: 'search-resources';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  query: string;
}

export interface AnalysisReadyMessage {
  type: 'analysis-ready';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  analysis: AnalysisSnapshot;
  timings: AnalysisWorkerTimings;
}

export interface ResourceCodeReadyMessage {
  type: 'resource-code-ready';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  compiledCode: string | null;
  rawCode: string | null;
}

export interface SearchResourcesReadyMessage {
  type: 'search-resources-ready';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  resources: AnalysisSnapshot['resources'];
}

export interface AnalysisErrorMessage {
  type: 'analysis-error';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  message: string;
}

export interface ResourceCodeErrorMessage {
  type: 'resource-code-error';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  message: string;
}

export interface SearchResourcesErrorMessage {
  type: 'search-resources-error';
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  message: string;
}

export type AnalysisWorkerRequest =
  | GetResourceCodeMessage
  | LoadAnalysisMessage
  | SearchResourcesMessage;

export type AnalysisWorkerResponse =
  | AnalysisErrorMessage
  | AnalysisReadyMessage
  | ResourceCodeErrorMessage
  | ResourceCodeReadyMessage
  | SearchResourcesErrorMessage
  | SearchResourcesReadyMessage;
