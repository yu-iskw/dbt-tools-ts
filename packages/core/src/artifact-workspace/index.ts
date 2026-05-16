import * as fs from 'node:fs/promises';
import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseSources } from 'dbt-artifacts-parser/sources';
import type { AnalysisSnapshot, ResourceNode } from '../analysis/analysis-snapshot';
import { buildAnalysisSnapshotFromParsedArtifactBundle } from '../analysis/analysis-snapshot';
import { DependencyService, type DependencyResult } from '../analysis/dependency-service';
import type { ManifestGraph } from '../analysis/manifest-graph';
import { getDbtToolsRemoteSourceConfigFromEnv } from '../config/dbt-tools-env';
import {
  applyDiscoveryNodeFilters,
  legacySearchScore,
  parseDiscoveryQueryTokens,
} from '../discovery';
import {
  discoverArtifactCandidates,
  discoverLocalArtifactRunPaths,
  remoteKeysToListedArtifacts,
  type ArtifactDiscoveryResult,
} from '../io/artifact-discovery';
import {
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
} from '../io/artifact-location';
import { parseDbtToolsArtifactTarget } from '../io/dbt-artifact-bundle';
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from '../io/remote-object-store';
import type { GraphNodeAttributes } from '../types';

export interface ArtifactWorkspaceOptions {
  dbtTarget: string;
  now?: () => number;
  cwd?: string;
  remoteClient?: RemoteObjectStoreClient;
}

export interface ResolvedArtifactRun {
  runId: string;
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
}

export interface ArtifactWorkspaceStatus {
  target: string;
  selectedRunId: string | null;
  versionToken: string | null;
  loadedAtMs: number | null;
  stale: boolean;
  lastRefreshError?: string;
}

interface LoadedArtifactWorkspace {
  run: ResolvedArtifactRun;
  analysis: AnalysisSnapshot;
  graph: ManifestGraph;
  loadedAtMs: number;
}

type DiscoveredSource =
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

export interface LineageInput {
  uniqueId: string;
  direction: 'upstream' | 'downstream';
  depth?: number;
}

export type LineageOutput = DependencyResult;

export interface ImpactInput {
  uniqueId: string;
  depth?: number;
}

export type ImpactOutput = DependencyResult;

export interface FailuresInput {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface FailuresOutput {
  total: number;
  returned: number;
  limit: number;
  offset: number;
  has_more: boolean;
  failures: AnalysisSnapshot['executions'];
}

export interface RunReportInput {
  nodeExecutionsLimit?: number;
  nodeExecutionsOffset?: number;
}

export interface RunReportOutput {
  summary: AnalysisSnapshot['summary'];
  statusBreakdown: AnalysisSnapshot['statusBreakdown'];
  bottlenecks: AnalysisSnapshot['bottlenecks'];
  node_executions: AnalysisSnapshot['executions'];
  node_executions_limit: number;
  node_executions_offset: number;
  node_executions_has_more: boolean;
}

export interface DbtToolsUseCases {
  searchResources(input: SearchResourcesInput): Promise<SearchResourcesOutput>;
  getResource(input: GetResourceInput): Promise<ResourceDetails | null>;
  getLineage(input: LineageInput): Promise<LineageOutput>;
  getImpact(input: ImpactInput): Promise<ImpactOutput>;
  summarizeFailures(input: FailuresInput): Promise<FailuresOutput>;
  buildRunReport(input: RunReportInput): Promise<RunReportOutput>;
}

export const SEARCH_RESOURCES_DEFAULT_LIMIT = 20;
export const SEARCH_RESOURCES_MAX_LIMIT = 200;
export const FAILURES_DEFAULT_LIMIT = 50;
export const FAILURES_MAX_LIMIT = 200;
export const RUN_REPORT_DEFAULT_LIMIT = 20;
export const RUN_REPORT_MAX_LIMIT = 200;

function clampLimit(value: number | undefined, defaultValue: number, maxValue: number): number {
  if (value == null || !Number.isFinite(value)) return defaultValue;
  return Math.min(Math.max(1, Math.floor(value)), maxValue);
}

function normalizeOffset(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function resolveOptionalSearchLimit(limit: number | undefined): number | undefined {
  if (limit == null) return undefined;
  return clampLimit(limit, SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT);
}

function decodeJson(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as Record<string, unknown>;
}

function optionalDecodeJson(bytes: Uint8Array | null): Record<string, unknown> | undefined {
  return bytes == null ? undefined : decodeJson(bytes);
}

function toSearchResult(uniqueId: string, attrs: GraphNodeAttributes): SearchResourceResult {
  return {
    unique_id: uniqueId,
    resource_type: attrs.resource_type,
    name: attrs.name,
    package_name: attrs.package_name,
    path: attrs.path as string | undefined,
    tags: attrs.tags as string[] | undefined,
    description: attrs.description as string | undefined,
  };
}

function copyResourceForOutput(resource: ResourceNode, includeCode: boolean): ResourceDetails {
  if (includeCode) return resource;
  const result: ResourceDetails = { ...resource };
  delete result.compiledCode;
  delete result.rawCode;
  return result;
}

export function searchResourcesInGraph(
  graph: ManifestGraph,
  input: SearchResourcesInput,
): SearchResourcesOutput {
  const parsed = input.query ? parseDiscoveryQueryTokens(input.query) : { terms: [] };
  const effectiveType = input.type ?? parsed.type;
  const effectivePackage = input.package ?? parsed.package;
  const effectiveTag = input.tag ?? parsed.tag;
  const effectivePath = input.path ?? parsed.path;
  const scored: Array<{ score: number; result: SearchResourceResult }> = [];

  graph.getGraph().forEachNode((uniqueId, attrs) => {
    if (
      !applyDiscoveryNodeFilters(
        attrs,
        effectiveType,
        effectivePackage,
        effectiveTag,
        effectivePath,
      )
    ) {
      return;
    }
    const score = legacySearchScore(attrs, parsed.terms);
    if (score === 0) return;
    scored.push({ score, result: toSearchResult(uniqueId, attrs) });
  });

  scored.sort((a, b) =>
    b.score === a.score ? a.result.unique_id.localeCompare(b.result.unique_id) : b.score - a.score,
  );
  const limit = resolveOptionalSearchLimit(input.limit);
  const offset = normalizeOffset(input.offset);
  if (offset > 0 && limit == null) {
    throw new Error('offset requires limit');
  }
  const all = scored.map((row) => row.result);
  const results = limit == null ? all : all.slice(offset, offset + limit);
  return {
    query: input.query || undefined,
    total: all.length,
    results,
    offset,
    ...(limit != null
      ? {
          limit,
          has_more: offset + results.length < all.length,
        }
      : {}),
  };
}

function isNonSuccessStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized !== 'success' && normalized !== 'pass';
}

export class ArtifactWorkspace {
  private readonly dbtTarget: string;
  private readonly cwd: string;
  private readonly now: () => number;
  private readonly injectedRemoteClient: RemoteObjectStoreClient | undefined;
  private selectedRunId: string | null = null;
  private runs: ResolvedArtifactRun[] = [];
  private loaded: LoadedArtifactWorkspace | null = null;
  private stale = false;
  private lastRefreshError: string | undefined;
  private refreshPromise: Promise<ArtifactWorkspaceStatus> | null = null;

  constructor(options: ArtifactWorkspaceOptions) {
    this.dbtTarget = options.dbtTarget;
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? Date.now;
    this.injectedRemoteClient = options.remoteClient;
  }

  async initialize(): Promise<void> {
    const source = await this.discoverSource();
    this.runs = source.runs;
    this.selectedRunId = this.selectedRunId ?? this.runs[0]?.runId ?? null;
    const run = this.resolveSelectedRun();
    if (run == null) {
      throw new Error(
        this.discoveryErrorMessage(source.discovery) ?? 'No dbt artifact runs found.',
      );
    }
    this.loaded = await this.loadRun(source, run);
    this.stale = false;
    this.lastRefreshError = undefined;
  }

  async refreshIfChanged(): Promise<ArtifactWorkspaceStatus> {
    if (this.refreshPromise != null) return this.refreshPromise;
    this.refreshPromise = this.refreshIfChangedInternal().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async getStatus(): Promise<ArtifactWorkspaceStatus> {
    return this.status();
  }

  async listRuns(): Promise<ResolvedArtifactRun[]> {
    if (this.runs.length === 0) {
      const source = await this.discoverSource();
      this.runs = source.runs;
    }
    return this.runs;
  }

  async selectRun(runId: string): Promise<ArtifactWorkspaceStatus> {
    const source = await this.discoverSource();
    this.runs = source.runs;
    const run = this.runs.find((candidate) => candidate.runId === runId);
    if (run == null) {
      throw new Error(`Unknown artifact run id: ${runId}`);
    }
    this.selectedRunId = runId;
    this.loaded = await this.loadRun(source, run);
    this.stale = false;
    this.lastRefreshError = undefined;
    return this.status();
  }

  async getLoadedWorkspace(): Promise<LoadedArtifactWorkspace> {
    if (this.loaded == null) {
      await this.initialize();
    }
    return this.loaded!;
  }

  private async refreshIfChangedInternal(): Promise<ArtifactWorkspaceStatus> {
    if (this.loaded == null) {
      await this.initialize();
      return this.status();
    }

    const source = await this.discoverSource();
    this.runs = source.runs;
    const run = this.resolveSelectedRun() ?? this.runs[0] ?? null;
    if (run == null) {
      return this.status();
    }
    this.selectedRunId = run.runId;

    if (run.versionToken === this.loaded.run.versionToken) {
      return this.status();
    }

    try {
      this.loaded = await this.loadRun(source, run);
      this.stale = false;
      this.lastRefreshError = undefined;
    } catch (error) {
      this.stale = true;
      this.lastRefreshError = error instanceof Error ? error.message : String(error);
    }
    return this.status();
  }

  private status(): ArtifactWorkspaceStatus {
    return {
      target: this.dbtTarget,
      selectedRunId: this.selectedRunId,
      versionToken: this.loaded?.run.versionToken ?? null,
      loadedAtMs: this.loaded?.loadedAtMs ?? null,
      stale: this.stale,
      ...(this.lastRefreshError != null ? { lastRefreshError: this.lastRefreshError } : {}),
    };
  }

  private resolveSelectedRun(): ResolvedArtifactRun | null {
    if (this.selectedRunId == null) return null;
    return this.runs.find((run) => run.runId === this.selectedRunId) ?? null;
  }

  private discoveryErrorMessage(discovery: ArtifactDiscoveryResult): string | null {
    return discovery.ok ? null : discovery.failure.message;
  }

  private async discoverSource(): Promise<DiscoveredSource> {
    const parsed = parseDbtToolsArtifactTarget(this.dbtTarget, this.cwd);
    if (parsed.kind === 'local') {
      const { discovery, runs } = await discoverLocalArtifactRunPaths(parsed.resolvedPath);
      return { kind: 'local', discovery, runs };
    }

    const config = mergeRemoteSourceConfigWithParsedLocation(
      getDbtToolsRemoteSourceConfigFromEnv(),
      parsed,
    );
    const client =
      this.injectedRemoteClient ?? (await createRemoteObjectStoreClient(config));
    const prefix = normalizeArtifactPrefix(config.prefix);
    const objects = await client.listObjects(config.bucket, prefix);
    const discovery = discoverArtifactCandidates(remoteKeysToListedArtifacts(objects, prefix));
    const runs: ResolvedArtifactRun[] = discovery.ok
      ? discovery.candidates.map((candidate) => ({
          runId: candidate.runId,
          manifestKey: joinObjectStorageKey(prefix, candidate.manifestRelative),
          runResultsKey: joinObjectStorageKey(prefix, candidate.runResultsRelative),
          ...(candidate.catalogRelative != null
            ? { catalogKey: joinObjectStorageKey(prefix, candidate.catalogRelative) }
            : {}),
          ...(candidate.sourcesRelative != null
            ? { sourcesKey: joinObjectStorageKey(prefix, candidate.sourcesRelative) }
            : {}),
          updatedAtMs: candidate.updatedAtMs,
          versionToken: candidate.versionToken,
        }))
      : [];
    return { kind: 'remote', bucket: config.bucket, client, discovery, runs };
  }

  private async loadRun(
    source: DiscoveredSource,
    run: ResolvedArtifactRun,
  ): Promise<LoadedArtifactWorkspace> {
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
      source.kind === 'local'
        ? await this.readLocalRun(run)
        : await this.readRemoteRun(source, run);
    const manifestJson = decodeJson(manifestBytes);
    const runResultsJson = decodeJson(runResultsBytes);
    const catalogJson = optionalDecodeJson(catalogBytes);
    const sourcesJson = optionalDecodeJson(sourcesBytes);
    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const catalog = catalogJson == null ? undefined : parseCatalog(catalogJson);
    const sources = sourcesJson == null ? undefined : parseSources(sourcesJson);
    const { analysis, graph } = buildAnalysisSnapshotFromParsedArtifactBundle({
      manifestJson,
      runResultsJson,
      catalogJson,
      sourcesJson,
      manifest,
      runResults,
      catalog,
      sources,
    });
    return {
      run,
      analysis,
      graph,
      loadedAtMs: this.now(),
    };
  }

  private async readLocalRun(
    run: ResolvedArtifactRun,
  ): Promise<[Uint8Array, Uint8Array, Uint8Array | null, Uint8Array | null]> {
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
      fs.readFile(run.manifestKey),
      fs.readFile(run.runResultsKey),
      this.readOptionalLocalFile(run.catalogKey),
      this.readOptionalLocalFile(run.sourcesKey),
    ]);
    return [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes];
  }

  private async readOptionalLocalFile(filePath: string | undefined): Promise<Uint8Array | null> {
    if (filePath == null) return null;
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  private async readRemoteRun(
    source: Extract<DiscoveredSource, { kind: 'remote' }>,
    run: ResolvedArtifactRun,
  ): Promise<[Uint8Array, Uint8Array, Uint8Array | null, Uint8Array | null]> {
    const readOptional = async (key: string | undefined): Promise<Uint8Array | null> => {
      if (key == null) return null;
      try {
        return await source.client.readObjectBytes(source.bucket, key);
      } catch {
        return null;
      }
    };
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
      source.client.readObjectBytes(source.bucket, run.manifestKey),
      source.client.readObjectBytes(source.bucket, run.runResultsKey),
      readOptional(run.catalogKey),
      readOptional(run.sourcesKey),
    ]);
    return [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes];
  }
}

export function createDbtToolsUseCases(workspace: ArtifactWorkspace): DbtToolsUseCases {
  return {
    async searchResources(input) {
      const loaded = await workspace.getLoadedWorkspace();
      return searchResourcesInGraph(loaded.graph, input);
    },

    async getResource(input) {
      const loaded = await workspace.getLoadedWorkspace();
      const resource =
        loaded.analysis.resources.find((candidate) => candidate.uniqueId === input.uniqueId) ??
        null;
      return resource == null ? null : copyResourceForOutput(resource, input.includeCode === true);
    },

    async getLineage(input) {
      const loaded = await workspace.getLoadedWorkspace();
      return DependencyService.getDependencies(
        loaded.graph,
        input.uniqueId,
        input.direction,
        undefined,
        input.depth,
        'flat',
      ) as DependencyResult;
    },

    async getImpact(input) {
      const loaded = await workspace.getLoadedWorkspace();
      return DependencyService.getDependencies(
        loaded.graph,
        input.uniqueId,
        'downstream',
        undefined,
        input.depth,
        'flat',
      ) as DependencyResult;
    },

    async summarizeFailures(input) {
      const loaded = await workspace.getLoadedWorkspace();
      const statuses = input.status
        ?.split(',')
        .map((status) => status.trim().toLowerCase())
        .filter(Boolean);
      const failures = loaded.analysis.executions.filter((execution) =>
        statuses != null && statuses.length > 0
          ? statuses.includes(execution.status.toLowerCase())
          : isNonSuccessStatus(execution.status),
      );
      const limit = clampLimit(input.limit, FAILURES_DEFAULT_LIMIT, FAILURES_MAX_LIMIT);
      const offset = normalizeOffset(input.offset);
      const page = failures.slice(offset, offset + limit);
      return {
        total: failures.length,
        returned: page.length,
        limit,
        offset,
        has_more: offset + page.length < failures.length,
        failures: page,
      };
    },

    async buildRunReport(input) {
      const loaded = await workspace.getLoadedWorkspace();
      const limit = clampLimit(
        input.nodeExecutionsLimit,
        RUN_REPORT_DEFAULT_LIMIT,
        RUN_REPORT_MAX_LIMIT,
      );
      const offset = normalizeOffset(input.nodeExecutionsOffset);
      const executions = loaded.analysis.executions.slice(offset, offset + limit);
      return {
        summary: loaded.analysis.summary,
        statusBreakdown: loaded.analysis.statusBreakdown,
        bottlenecks: loaded.analysis.bottlenecks,
        node_executions: executions,
        node_executions_limit: limit,
        node_executions_offset: offset,
        node_executions_has_more: offset + executions.length < loaded.analysis.executions.length,
      };
    },
  };
}
