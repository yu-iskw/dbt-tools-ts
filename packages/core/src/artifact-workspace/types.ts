import type { QueryDependenciesInput } from '../analysis/dependencies/query';
import type { DependencyResult } from '../analysis/dependencies/service';
import type { ManifestGraph } from '../analysis/manifest/graph';
import type { QueryExecutionsOutput } from '../analysis/search/run-results';
import type { QueryExecutionsRequest } from '../analysis/search/types';
import type { AnalysisSnapshot, ResourceNode } from '../analysis/snapshot';
import type { RunSummaryOutput } from '../analysis/snapshot/run-summary';
import type { ArtifactDiscoveryResult } from '../io/artifact-discovery';
import type { RemoteObjectStoreClient } from '../io/remote-object-store';

export interface ResolvedArtifactRun {
  runId: string;
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
}

export interface LoadedArtifactWorkspace {
  run: ResolvedArtifactRun;
  analysis: AnalysisSnapshot;
  graph: ManifestGraph;
  loadedAtMs: number;
}

export type DiscoveredSource =
  | {
      kind: 'local';
      discovery: ArtifactDiscoveryResult;
      runs: ResolvedArtifactRun[];
    }
  | {
      kind: 'remote';
      bucket: string;
      client: RemoteObjectStoreClient;
      discovery: ArtifactDiscoveryResult;
      runs: ResolvedArtifactRun[];
    };

export interface CachedTargetEntry {
  runs: ResolvedArtifactRun[];
  selectedRunId: string;
  loaded: LoadedArtifactWorkspace;
  lastAccessedAtMs: number;
}

export interface SearchResourcesInput {
  query?: string;
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResourceResult {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  path?: string;
  tags?: string[];
  description?: string;
}

export interface SearchResourcesOutput {
  query?: string;
  total: number;
  results: SearchResourceResult[];
  limit?: number;
  offset: number;
  has_more?: boolean;
}

export interface GetResourceInput {
  uniqueId: string;
  includeCode?: boolean;
}

export type ResourceDetails = ResourceNode;

export type QueryDependenciesOutput = DependencyResult;

export interface DbtToolsUseCases {
  searchResources(input: SearchResourcesInput): Promise<SearchResourcesOutput>;
  getResource(input: GetResourceInput): Promise<ResourceDetails | null>;
  queryDependencies(input: QueryDependenciesInput): Promise<QueryDependenciesOutput>;
  queryExecutions(input: QueryExecutionsRequest): Promise<QueryExecutionsOutput>;
  getRunSummary(): Promise<RunSummaryOutput>;
}

export const SEARCH_RESOURCES_DEFAULT_LIMIT = 20;
export const SEARCH_RESOURCES_MAX_LIMIT = 200;

export const SNAPSHOT_READY_PROGRESS_MESSAGE = 'Snapshot ready';
