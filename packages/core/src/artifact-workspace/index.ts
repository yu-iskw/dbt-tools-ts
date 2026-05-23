import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseSources } from 'dbt-artifacts-parser/sources';

import { queryDependencies, type QueryDependenciesInput } from '../analysis/dependencies/query';
import { queryExecutions, type QueryExecutionsOutput } from '../analysis/search/run-results';
import { normalizeWarehouseAdapterType } from '../analysis/search/warehouse';
import { buildAnalysisSnapshotFromParsedArtifactBundle } from '../analysis/snapshot';
import { getRunSummaryFromSnapshot, type RunSummaryOutput } from '../analysis/snapshot/run-summary';
import {
  DEFAULT_MAX_CACHED_TARGETS,
  getDbtToolsRemoteClientEnvFromEnv,
  type DbtToolsRemoteClientEnv,
} from '../config/dbt-tools-env';
import {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from '../debug/dbt-tools-debug-log.js';
import {
  applyDiscoveryNodeFilters,
  legacySearchScore,
  parseDiscoveryQueryTokens,
} from '../discovery';
import { ArtifactTargetNotConfiguredError } from '../errors/artifact-target-not-configured-error';
import {
  discoverArtifactCandidates,
  discoverLocalArtifactRunPaths,
  remoteKeysToListedArtifacts,
  type ArtifactDiscoveryResult,
} from '../io/artifact-discovery';
import {
  type GcsArtifactSourceRequestOptions,
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
  type RemoteSourceClientOverrides,
} from '../io/artifact-location';
import { parseDbtToolsArtifactTarget } from '../io/dbt-artifact-bundle';
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from '../io/remote-object-store';
import { readValidatedUtf8 } from '../io/safe-fs';

import type { DependencyResult } from '../analysis/dependencies/service';
import type { ManifestGraph } from '../analysis/manifest/graph';
import type { QueryExecutionsRequest } from '../analysis/search/types';
import type { AnalysisSnapshot, ResourceNode } from '../analysis/snapshot';
import type { GraphNodeAttributes } from '../types';

export interface ArtifactWorkspaceOptions {
  dbtTarget?: string;
  /** Max distinct targets to retain parsed in memory. Default 3. 0 = disable cache. */
  maxCachedTargets?: number;
  /** Evict cached entries idle longer than this ms. Default 0 (disabled). */
  cacheTtlMs?: number;
  now?: () => number;
  cwd?: string;
  remoteClient?: RemoteObjectStoreClient;
  gcsRequestOptions?: GcsArtifactSourceRequestOptions;
  remoteClientOverrides?: RemoteSourceClientOverrides;
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

export interface ArtifactWorkspaceRunRef {
  runId: string;
  versionToken: string;
}

export interface ArtifactWorkspaceCachedTargetRef {
  target: string;
  loadedAtMs: number;
  versionToken: string;
  lastAccessedAtMs: number;
}

export interface ArtifactWorkspaceStatus {
  target: string | null;
  selectedRunId: string | null;
  versionToken: string | null;
  loadedAtMs: number | null;
  stale: boolean;
  lastRefreshError?: string;
  runs: ArtifactWorkspaceRunRef[];
  warehouse_type?: ReturnType<typeof normalizeWarehouseAdapterType>;
  cachedTargets?: ArtifactWorkspaceCachedTargetRef[];
  cachePolicy?: { maxTargets: number; ttlMs: number };
  fromCache?: boolean;
}

interface LoadedArtifactWorkspace {
  run: ResolvedArtifactRun;
  analysis: AnalysisSnapshot;
  graph: ManifestGraph;
  loadedAtMs: number;
}

interface CachedTargetEntry {
  runs: ResolvedArtifactRun[];
  selectedRunId: string;
  loaded: LoadedArtifactWorkspace;
  lastAccessedAtMs: number;
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

export class ArtifactWorkspace {
  private dbtTarget: string | null;
  private readonly cwd: string;
  private readonly now: () => number;
  private readonly maxCachedTargets: number;
  private readonly cacheTtlMs: number;
  private readonly injectedRemoteClient: RemoteObjectStoreClient | undefined;
  private readonly gcsRequestOptions: GcsArtifactSourceRequestOptions | undefined;
  private readonly remoteClientOverrides: RemoteSourceClientOverrides | undefined;
  private readonly targetCache = new Map<string, CachedTargetEntry>();
  private selectedRunId: string | null = null;
  private runs: ResolvedArtifactRun[] = [];
  private loaded: LoadedArtifactWorkspace | null = null;
  private stale = false;
  private lastRefreshError: string | undefined;
  private refreshPromise: Promise<ArtifactWorkspaceStatus> | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(options: ArtifactWorkspaceOptions) {
    this.dbtTarget = options.dbtTarget ?? null;
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? Date.now;
    this.maxCachedTargets = options.maxCachedTargets ?? DEFAULT_MAX_CACHED_TARGETS;
    this.cacheTtlMs = options.cacheTtlMs ?? 0;
    this.injectedRemoteClient = options.remoteClient;
    this.gcsRequestOptions = options.gcsRequestOptions;
    this.remoteClientOverrides = options.remoteClientOverrides;
  }

  async setTarget(target: string): Promise<ArtifactWorkspaceStatus> {
    const trimmed = target.trim();
    if (trimmed === '') {
      throw new Error('target is required.');
    }
    await this.awaitIdleRefresh();
    this.evictExpired();
    const cacheKey = trimmed;
    const cached = this.maxCachedTargets > 0 ? this.targetCache.get(cacheKey) : undefined;
    this.dbtTarget = trimmed;
    this.stale = false;
    this.lastRefreshError = undefined;
    if (cached != null) {
      this.touchCacheEntry(cacheKey, cached);
      this.runs = cached.runs;
      this.selectedRunId = cached.selectedRunId;
      this.loaded = cached.loaded;
      return this.status({ fromCache: true });
    }
    this.selectedRunId = null;
    this.runs = [];
    this.loaded = null;
    await this.ensureInitialized();
    this.syncActiveToCache();
    return this.status();
  }

  async unsetTarget(): Promise<ArtifactWorkspaceStatus> {
    await this.awaitIdleRefresh();
    this.dbtTarget = null;
    this.selectedRunId = null;
    this.runs = [];
    this.loaded = null;
    this.stale = false;
    this.lastRefreshError = undefined;
    return this.status();
  }

  async clearCachedTargets(): Promise<ArtifactWorkspaceStatus> {
    await this.awaitIdleRefresh();
    this.targetCache.clear();
    this.loaded = null;
    this.runs = [];
    this.selectedRunId = null;
    this.stale = false;
    this.lastRefreshError = undefined;
    return this.status();
  }

  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.loaded != null) return;
    if (this.initializePromise != null) {
      await this.initializePromise;
      return;
    }
    this.initializePromise = this.initializeInternal().finally(() => {
      this.initializePromise = null;
    });
    await this.initializePromise;
  }

  private async initializeInternal(): Promise<void> {
    const startedAt = dbtToolsDebugNow();
    const configuredTarget = this.requireTarget();
    dbtToolsDebugLog(`initialize start target=${configuredTarget}`);
    const source = await this.discoverSource();
    this.runs = source.runs;
    if (!source.discovery.ok) {
      throw new Error(
        this.discoveryErrorMessage(source.discovery) ?? 'No dbt artifact runs found.',
      );
    }
    if (source.runs.length !== 1) {
      throw new Error(
        this.discoveryErrorMessage(source.discovery) ??
          `Expected exactly one artifact set, found ${source.runs.length}.`,
      );
    }
    this.selectedRunId = this.selectedRunId ?? source.runs[0]!.runId;
    const run = this.resolveSelectedRun();
    if (run == null) {
      throw new Error(
        this.discoveryErrorMessage(source.discovery) ?? 'No dbt artifact runs found.',
      );
    }
    this.loaded = await this.loadRun(source, run);
    this.stale = false;
    this.lastRefreshError = undefined;
    this.syncActiveToCache();
    dbtToolsDebugLogPhase('initialize complete', startedAt, `runId=${run.runId}`);
  }

  async refreshIfChanged(): Promise<ArtifactWorkspaceStatus> {
    if (this.dbtTarget == null) {
      return this.status();
    }
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
    await this.awaitIdleRefresh();
    if (this.initializePromise != null) {
      await this.initializePromise;
    }
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
    this.syncActiveToCache();
    return this.status();
  }

  async getLoadedWorkspace(): Promise<LoadedArtifactWorkspace> {
    if (this.loaded == null) {
      await this.ensureInitialized();
    }
    return this.loaded!;
  }

  private async refreshIfChangedInternal(): Promise<ArtifactWorkspaceStatus> {
    if (this.loaded == null) {
      await this.ensureInitialized();
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
      this.syncActiveToCache();
    } catch (error) {
      this.stale = true;
      this.lastRefreshError = error instanceof Error ? error.message : String(error);
    }
    return this.status();
  }

  private status(options?: { fromCache?: boolean }): ArtifactWorkspaceStatus {
    const warehouseType =
      this.loaded?.analysis.warehouseType != null
        ? normalizeWarehouseAdapterType(this.loaded.analysis.warehouseType)
        : undefined;
    const cachedTargets = this.buildCachedTargetsList();
    return {
      target: this.dbtTarget,
      selectedRunId: this.selectedRunId,
      versionToken: this.loaded?.run.versionToken ?? null,
      loadedAtMs: this.loaded?.loadedAtMs ?? null,
      stale: this.stale,
      runs: this.runs.map((run) => ({ runId: run.runId, versionToken: run.versionToken })),
      ...(warehouseType != null ? { warehouse_type: warehouseType } : {}),
      ...(this.lastRefreshError != null ? { lastRefreshError: this.lastRefreshError } : {}),
      ...(cachedTargets.length > 0 ? { cachedTargets } : {}),
      cachePolicy: { maxTargets: this.maxCachedTargets, ttlMs: this.cacheTtlMs },
      ...(options?.fromCache === true ? { fromCache: true } : {}),
    };
  }

  private async awaitIdleRefresh(): Promise<void> {
    if (this.refreshPromise != null) {
      await this.refreshPromise;
      this.refreshPromise = null;
    }
  }

  private buildCachedTargetsList(): ArtifactWorkspaceCachedTargetRef[] {
    return [...this.targetCache.entries()].map(([target, entry]) => ({
      target,
      loadedAtMs: entry.loaded.loadedAtMs,
      versionToken: entry.loaded.run.versionToken,
      lastAccessedAtMs: entry.lastAccessedAtMs,
    }));
  }

  private evictExpired(): void {
    if (this.cacheTtlMs <= 0) return;
    const now = this.now();
    for (const [key, entry] of this.targetCache) {
      if (now - entry.lastAccessedAtMs > this.cacheTtlMs) {
        this.targetCache.delete(key);
      }
    }
  }

  private touchCacheEntry(cacheKey: string, entry: CachedTargetEntry): void {
    const now = this.now();
    entry.lastAccessedAtMs = now;
    this.targetCache.delete(cacheKey);
    this.targetCache.set(cacheKey, entry);
  }

  private putCacheEntry(cacheKey: string, entry: CachedTargetEntry): void {
    if (this.maxCachedTargets <= 0) return;
    this.targetCache.delete(cacheKey);
    this.targetCache.set(cacheKey, entry);
    while (this.targetCache.size > this.maxCachedTargets) {
      const oldest = this.targetCache.keys().next().value;
      if (oldest != null) {
        this.targetCache.delete(oldest);
      }
    }
  }

  private syncActiveToCache(): void {
    if (this.maxCachedTargets <= 0 || this.dbtTarget == null || this.loaded == null) {
      return;
    }
    if (this.selectedRunId == null) return;
    const cacheKey = this.dbtTarget;
    const now = this.now();
    const entry: CachedTargetEntry = {
      runs: this.runs,
      selectedRunId: this.selectedRunId,
      loaded: this.loaded,
      lastAccessedAtMs: now,
    };
    this.putCacheEntry(cacheKey, entry);
  }

  private resolveSelectedRun(): ResolvedArtifactRun | null {
    if (this.selectedRunId == null) return null;
    return this.runs.find((run) => run.runId === this.selectedRunId) ?? null;
  }

  private discoveryErrorMessage(discovery: ArtifactDiscoveryResult): string | null {
    return discovery.ok ? null : discovery.failure.message;
  }

  private mergeRemoteClientEnvLayers(
    base: DbtToolsRemoteClientEnv,
    override: DbtToolsRemoteClientEnv,
  ): {
    gcsRequestOptions?: GcsArtifactSourceRequestOptions;
    remoteClientOverrides?: RemoteSourceClientOverrides;
  } {
    const gcsRequestOptions =
      base.gcsRequestOptions != null || override.gcsRequestOptions != null
        ? { ...base.gcsRequestOptions, ...override.gcsRequestOptions }
        : undefined;
    const remoteClientOverrides =
      base.remoteClientOverrides != null || override.remoteClientOverrides != null
        ? { ...base.remoteClientOverrides, ...override.remoteClientOverrides }
        : undefined;
    return { gcsRequestOptions, remoteClientOverrides };
  }

  private requireTarget(): string {
    if (this.dbtTarget == null) {
      throw new ArtifactTargetNotConfiguredError();
    }
    return this.dbtTarget;
  }

  private async discoverSource(): Promise<DiscoveredSource> {
    const startedAt = dbtToolsDebugNow();
    const parsed = parseDbtToolsArtifactTarget(this.requireTarget(), this.cwd);
    dbtToolsDebugLog(`discoverSource kind=${parsed.kind}`);
    if (parsed.kind === 'local') {
      const { discovery, runs } = await discoverLocalArtifactRunPaths(parsed.resolvedPath);
      dbtToolsDebugLogPhase('discoverSource local done', startedAt, `runs=${runs.length}`);
      return { kind: 'local', discovery, runs };
    }

    const { gcsRequestOptions, remoteClientOverrides } = this.mergeRemoteClientEnvLayers(
      getDbtToolsRemoteClientEnvFromEnv(),
      {
        gcsRequestOptions: this.gcsRequestOptions,
        remoteClientOverrides: this.remoteClientOverrides,
      },
    );
    const config = mergeRemoteSourceConfigWithParsedLocation(
      undefined,
      parsed,
      gcsRequestOptions,
      remoteClientOverrides,
    );
    const client = this.injectedRemoteClient ?? (await createRemoteObjectStoreClient(config));
    const prefix = normalizeArtifactPrefix(config.prefix);
    const objects = await client.listObjects(config.bucket, prefix);
    const discovery = discoverArtifactCandidates(remoteKeysToListedArtifacts(objects, prefix));
    dbtToolsDebugLog(`discoverSource remote listed=${objects.length} discoveryOk=${discovery.ok}`);
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
    dbtToolsDebugLogPhase('discoverSource remote done', startedAt, `runs=${runs.length}`);
    return { kind: 'remote', bucket: config.bucket, client, discovery, runs };
  }

  private async loadRun(
    source: DiscoveredSource,
    run: ResolvedArtifactRun,
  ): Promise<LoadedArtifactWorkspace> {
    const startedAt = dbtToolsDebugNow();
    dbtToolsDebugLog(`loadRun start runId=${run.runId}`);
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
      source.kind === 'local'
        ? await this.readLocalRun(run)
        : await this.readRemoteRun(source, run);
    dbtToolsDebugLog(
      `loadRun read bytes manifest=${manifestBytes.byteLength} run_results=${runResultsBytes.byteLength}`,
    );
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
    dbtToolsDebugLogPhase('loadRun complete', startedAt, `resources=${analysis.resources.length}`);
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
    const [manifestText, runResultsText, catalogText, sourcesText] = await Promise.all([
      readValidatedUtf8(run.manifestKey),
      readValidatedUtf8(run.runResultsKey),
      this.readOptionalLocalUtf8(run.catalogKey),
      this.readOptionalLocalUtf8(run.sourcesKey),
    ]);
    const encoder = new TextEncoder();
    return [
      encoder.encode(manifestText),
      encoder.encode(runResultsText),
      catalogText != null ? encoder.encode(catalogText) : null,
      sourcesText != null ? encoder.encode(sourcesText) : null,
    ];
  }

  private async readOptionalLocalUtf8(filePath: string | undefined): Promise<string | null> {
    if (filePath == null) return null;
    try {
      return await readValidatedUtf8(filePath);
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

    async queryDependencies(input) {
      const loaded = await workspace.getLoadedWorkspace();
      return queryDependencies(loaded.graph, input);
    },

    async queryExecutions(input) {
      const loaded = await workspace.getLoadedWorkspace();
      return queryExecutions(loaded.analysis.executions, input, {
        warehouseType: loaded.analysis.warehouseType,
        graph: loaded.graph,
      });
    },

    async getRunSummary() {
      const loaded = await workspace.getLoadedWorkspace();
      return getRunSummaryFromSnapshot(loaded.analysis);
    },
  };
}
