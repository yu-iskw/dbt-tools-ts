import { normalizeWarehouseAdapterType } from '../analysis/search/warehouse';
import { DEFAULT_MAX_CACHED_TARGETS, type DbtToolsRemoteClientEnv } from '../config/dbt-tools-env';
import { queryDependenciesInputSchema } from '../contracts/dependency-query-input.js';
import { getResourceInputSchema } from '../contracts/get-resource-input.js';
import { queryExecutionsInputSchema } from '../contracts/query-executions-input.js';
import { searchResourcesInputSchema } from '../contracts/search-resources-input.js';
import {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from '../debug/dbt-tools-debug-log.js';
import { ArtifactTargetNotConfiguredError } from '../errors/artifact-target-not-configured-error';
import {
  type GcsArtifactSourceRequestOptions,
  type RemoteSourceClientOverrides,
} from '../io/artifact-location';
import {
  captureSessionBinding,
  isSessionBindingCurrent,
  type SessionBinding,
} from '../session-binding';
import { findUseCaseByName } from '../usecases/registry.js';

import { ArtifactLoadPipeline } from './load-pipeline.js';
import { ArtifactLoadProgressHub } from './progress.js';
import {
  SNAPSHOT_READY_PROGRESS_MESSAGE,
  type CachedTargetEntry,
  type DiscoveredSource,
  type DbtToolsUseCases,
  type LoadedArtifactWorkspace,
  type ResourceDetails,
  type ResolvedArtifactRun,
} from './types.js';

import type {
  ArtifactWorkspaceCachedTargetRef,
  ArtifactWorkspaceStatus,
} from '../contracts/artifact-workspace-status.js';
import type { ArtifactDiscoveryResult } from '../io/artifact-discovery';
import type { RemoteObjectStoreClient } from '../io/remote-object-store';
import type {
  ArtifactLoadPhase,
  ArtifactLoadProgressCallback,
} from '../progress/artifact-load-progress.js';

export type {
  ArtifactWorkspaceCachedTargetRef,
  ArtifactWorkspaceRunRef,
  ArtifactWorkspaceStatus,
} from '../contracts/artifact-workspace-status.js';

export interface ArtifactWorkspaceLoadOptions {
  onProgress?: ArtifactLoadProgressCallback;
  /**
   * When the target is bound but no snapshot is in memory (for example after
   * `clearCachedTargets`), allow `refreshIfChanged` to run a full load.
   * Background poll passes `false` so `--dbt-target` alone does not auto-load.
   */
  coldLoadIfUnloaded?: boolean;
}

export interface ArtifactWorkspaceOptions {
  dbtTarget?: string;
  /** Max distinct targets to retain parsed in memory. Default 3. 0 = disable cache. */
  maxCachedTargets?: number;
  /** Evict cached entries idle longer than this ms. Default 0 (disabled). */
  cacheTtlMs?: number;
  /**
   * When false (web UX), poll detects newer runs but does not auto-reload;
   * call `acceptPendingRun` to load. MCP defaults to true (ADR-0004).
   */
  autoReloadOnPoll?: boolean;
  now?: () => number;
  cwd?: string;
  remoteClient?: RemoteObjectStoreClient;
  gcsRequestOptions?: GcsArtifactSourceRequestOptions;
  remoteClientOverrides?: RemoteSourceClientOverrides;
  /** Optional protocol-level progress for expensive loads (MCP maps when progressToken is set). */
  onProgress?: ArtifactLoadProgressCallback;
}

export type {
  DbtToolsUseCases,
  GetResourceInput,
  QueryDependenciesOutput,
  ResourceDetails,
  ResolvedArtifactRun,
  SearchResourceResult,
  SearchResourcesInput,
  SearchResourcesOutput,
} from './types.js';

export { SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT } from './types.js';

export { copyResourceForOutput, searchResourcesInGraph } from './graph-search.js';

export class ArtifactWorkspace {
  private dbtTarget: string | null;
  private readonly cwd: string;
  private readonly now: () => number;
  private readonly maxCachedTargets: number;
  private readonly cacheTtlMs: number;
  private readonly autoReloadOnPoll: boolean;
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
  private serializedOps: Promise<void> = Promise.resolve();
  private initializePromise: Promise<void> | null = null;
  /** Bumped when the active target binding changes; stale loads must not assign `loaded`. */
  private loadGeneration = 0;
  private pendingRun: ResolvedArtifactRun | null = null;
  private readonly progressHub = new ArtifactLoadProgressHub();
  private readonly loadPipeline: ArtifactLoadPipeline;

  constructor(options: ArtifactWorkspaceOptions) {
    this.dbtTarget = options.dbtTarget ?? null;
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? Date.now;
    this.maxCachedTargets = options.maxCachedTargets ?? DEFAULT_MAX_CACHED_TARGETS;
    this.cacheTtlMs = options.cacheTtlMs ?? 0;
    this.autoReloadOnPoll = options.autoReloadOnPoll !== false;
    this.injectedRemoteClient = options.remoteClient;
    this.gcsRequestOptions = options.gcsRequestOptions;
    this.remoteClientOverrides = options.remoteClientOverrides;
    this.progressHub.setCallback(options.onProgress);
    this.loadPipeline = new ArtifactLoadPipeline({
      cwd: this.cwd,
      now: () => this.now(),
      requireTarget: () => this.requireTarget(),
      reportProgress: (phase, progress, message) => this.reportProgress(phase, progress, message),
      mergeRemoteClientEnvLayers: (base, override) =>
        this.mergeRemoteClientEnvLayers(base, override),
      injectedRemoteClient: this.injectedRemoteClient,
      gcsRequestOptions: this.gcsRequestOptions,
      remoteClientOverrides: this.remoteClientOverrides,
    });
  }

  private reportProgress(phase: ArtifactLoadPhase, progress: number, message: string): void {
    this.progressHub.emit(phase, progress, message);
  }

  async setTarget(
    target: string,
    options?: ArtifactWorkspaceLoadOptions,
  ): Promise<ArtifactWorkspaceStatus> {
    return this.runSerialized(async () => {
      const restoreCallback =
        options?.onProgress != null ? this.progressHub.swapCallback(options.onProgress) : undefined;
      try {
        const trimmed = target.trim();
        if (trimmed === '') {
          throw new Error('target is required.');
        }
        this.evictExpired();
        const cacheKey = trimmed;
        const cached = this.maxCachedTargets > 0 ? this.targetCache.get(cacheKey) : undefined;
        this.dbtTarget = trimmed;
        this.stale = false;
        this.lastRefreshError = undefined;
        if (cached != null) {
          return await this.applyCachedTarget(cacheKey, cached);
        }
        this.bumpLoadGeneration();
        this.selectedRunId = null;
        this.runs = [];
        this.loaded = null;
        await this.ensureInitialized();
        this.syncActiveToCache();
        return this.status();
      } finally {
        if (options?.onProgress != null) {
          this.progressHub.setCallback(restoreCallback);
        }
      }
    });
  }

  async unsetTarget(): Promise<ArtifactWorkspaceStatus> {
    return this.runSerialized(async () => {
      this.bumpLoadGeneration();
      this.dbtTarget = null;
      this.selectedRunId = null;
      this.runs = [];
      this.loaded = null;
      this.stale = false;
      this.lastRefreshError = undefined;
      return this.status();
    });
  }

  async clearCachedTargets(): Promise<ArtifactWorkspaceStatus> {
    return this.runSerialized(async () => {
      this.bumpLoadGeneration();
      this.targetCache.clear();
      this.loaded = null;
      this.runs = [];
      this.selectedRunId = null;
      this.stale = true;
      this.lastRefreshError = undefined;
      return this.status();
    });
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
    const binding = this.captureBinding();
    this.initializePromise = this.initializeInternal(binding).finally(() => {
      this.initializePromise = null;
    });
    await this.initializePromise;
  }

  private async initializeInternal(binding: SessionBinding): Promise<void> {
    const startedAt = dbtToolsDebugNow();
    const configuredTarget = this.requireTarget();
    dbtToolsDebugLog(`initialize start target=${configuredTarget}`);
    this.reportProgress('validate-target', 5, 'Validating artifact target');
    const source = await this.discoverSource();
    if (!this.bindingStillActive(binding)) {
      dbtToolsDebugLog(`initialize aborted (stale) target=${configuredTarget}`);
      return;
    }
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
    const loaded = await this.loadRun(source, run);
    if (!this.bindingStillActive(binding)) {
      dbtToolsDebugLog(`initialize aborted after load (stale) target=${configuredTarget}`);
      return;
    }
    this.loaded = loaded;
    this.stale = false;
    this.lastRefreshError = undefined;
    this.syncActiveToCache();
    this.reportProgress('ready', 100, SNAPSHOT_READY_PROGRESS_MESSAGE);
    dbtToolsDebugLogPhase('initialize complete', startedAt, `runId=${run.runId}`);
  }

  private reportSnapshotReadyIfListening(): void {
    if (this.progressHub.hasConsumers()) {
      this.reportProgress('ready', 100, SNAPSHOT_READY_PROGRESS_MESSAGE);
    }
  }

  private async applyCachedTarget(
    cacheKey: string,
    cached: CachedTargetEntry,
  ): Promise<ArtifactWorkspaceStatus> {
    this.touchCacheEntry(cacheKey, cached);
    this.runs = cached.runs;
    this.selectedRunId = cached.selectedRunId;
    this.loaded = cached.loaded;
    try {
      const revalidated = await this.revalidateCachedLoad(cached);
      if (revalidated) {
        this.syncActiveToCache();
        this.reportSnapshotReadyIfListening();
        return this.status();
      }
    } catch (error) {
      this.stale = true;
      this.lastRefreshError = error instanceof Error ? error.message : String(error);
    }
    if (!this.stale) {
      this.reportProgress('ready', 100, SNAPSHOT_READY_PROGRESS_MESSAGE);
    }
    return this.status({ fromCache: true });
  }

  async refreshIfChanged(options?: ArtifactWorkspaceLoadOptions): Promise<ArtifactWorkspaceStatus> {
    if (this.dbtTarget == null) {
      return this.status();
    }
    const unsubscribe =
      options?.onProgress != null ? this.progressHub.subscribe(options.onProgress) : undefined;
    try {
      if (this.refreshPromise == null) {
        const coldLoadIfUnloaded = options?.coldLoadIfUnloaded !== false;
        this.refreshPromise = this.runSerialized(() =>
          this.refreshIfChangedInternal({ coldLoadIfUnloaded }),
        ).finally(() => {
          this.refreshPromise = null;
        });
      }
      return await this.refreshPromise;
    } finally {
      unsubscribe?.();
    }
  }

  async getStatus(): Promise<ArtifactWorkspaceStatus> {
    return this.status();
  }

  async listRuns(): Promise<ResolvedArtifactRun[]> {
    if (this.runs.length === 0) {
      const source = await this.discoverSource();
      this.runs = source.runs;
      if (this.loaded != null) {
        this.syncActiveToCache();
      }
    }
    return this.runs;
  }

  async selectRun(runId: string): Promise<ArtifactWorkspaceStatus> {
    return this.runSerialized(async () => {
      const binding = this.captureBinding();
      const source = await this.discoverSource();
      if (!this.bindingStillActive(binding)) {
        return this.status();
      }
      this.runs = source.runs;
      const run = this.runs.find((candidate) => candidate.runId === runId);
      if (run == null) {
        throw new Error(`Unknown artifact run id: ${runId}`);
      }
      this.selectedRunId = runId;
      const loaded = await this.loadRun(source, run);
      if (!this.bindingStillActive(binding)) {
        return this.status();
      }
      this.loaded = loaded;
      this.stale = false;
      this.lastRefreshError = undefined;
      this.syncActiveToCache();
      return this.status();
    });
  }

  async getLoadedWorkspace(): Promise<LoadedArtifactWorkspace> {
    return this.runSerialized(async () => {
      await this.ensureInitialized();
      if (this.loaded == null) {
        throw new ArtifactTargetNotConfiguredError();
      }
      return this.loaded;
    });
  }

  async runUseCase<In, Out>(useCaseName: string, input: In): Promise<Out> {
    const loaded = await this.getLoadedWorkspace();
    const useCase = findUseCaseByName(useCaseName);
    if (useCase == null) {
      throw new Error(`Unknown use case: ${useCaseName}`);
    }
    const parsedInput = useCase.input.parse(input);
    return useCase.run(loaded, parsedInput) as Out;
  }

  async acceptPendingRun(): Promise<ArtifactWorkspaceStatus> {
    return this.runSerialized(async () => {
      const pending = this.pendingRun;
      if (pending == null) {
        return this.status();
      }
      const binding = this.captureBinding();
      const source = await this.discoverSource();
      if (!this.bindingStillActive(binding)) {
        return this.status();
      }
      try {
        const loaded = await this.loadRun(source, pending);
        if (!this.bindingStillActive(binding)) {
          return this.status();
        }
        this.loaded = loaded;
        this.selectedRunId = pending.runId;
        this.pendingRun = null;
        this.stale = false;
        this.lastRefreshError = undefined;
        this.syncActiveToCache();
      } catch (error) {
        this.stale = true;
        this.lastRefreshError = error instanceof Error ? error.message : String(error);
      }
      return this.status();
    });
  }

  private async refreshIfChangedInternal(options?: {
    coldLoadIfUnloaded?: boolean;
  }): Promise<ArtifactWorkspaceStatus> {
    if (this.dbtTarget == null) {
      return this.status();
    }

    if (this.loaded == null) {
      if (options?.coldLoadIfUnloaded === false) {
        return this.status();
      }
      await this.ensureInitialized();
      return this.status();
    }

    const binding = this.captureBinding();
    try {
      const reloaded = await this.reloadSelectedRunIfVersionChanged(
        binding,
        this.loaded.run.versionToken,
        this.selectedRunId,
      );
      if (reloaded) {
        this.reportSnapshotReadyIfListening();
      }
      if (!reloaded && !this.bindingStillActive(binding)) {
        return this.status();
      }
    } catch (error) {
      if (!this.bindingStillActive(binding)) {
        return this.status();
      }
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
      ...(this.pendingRun != null
        ? { pendingRun: { runId: this.pendingRun.runId, versionToken: this.pendingRun.versionToken } }
        : {}),
      ...(options?.fromCache === true ? { fromCache: true } : {}),
    };
  }

  private bumpLoadGeneration(): void {
    this.loadGeneration += 1;
  }

  private captureBinding(): SessionBinding {
    return captureSessionBinding(this.loadGeneration, this.dbtTarget);
  }

  private bindingStillActive(binding: SessionBinding): boolean {
    return isSessionBindingCurrent(binding, this.loadGeneration, this.dbtTarget);
  }

  private runSerialized<T>(work: () => Promise<T>): Promise<T> {
    const run = this.serializedOps.then(work, work);
    this.serializedOps = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Returns true when cached artifacts were reloaded because the version token changed. */
  private async revalidateCachedLoad(cached: CachedTargetEntry): Promise<boolean> {
    return this.reloadSelectedRunIfVersionChanged(
      this.captureBinding(),
      cached.loaded.run.versionToken,
      cached.selectedRunId,
    );
  }

  /**
   * Discover, compare version token, and reload the selected run when changed.
   * Returns true when a new snapshot was committed.
   */
  private async reloadSelectedRunIfVersionChanged(
    binding: SessionBinding,
    previousVersionToken: string,
    preferredRunId: string | null,
  ): Promise<boolean> {
    const source = await this.discoverSource();
    if (!this.bindingStillActive(binding)) {
      return false;
    }

    this.runs = source.runs;
    const run =
      preferredRunId != null
        ? (source.runs.find((candidate) => candidate.runId === preferredRunId) ?? null)
        : (source.runs[0] ?? null);
    if (run == null) {
      if (preferredRunId != null) {
        this.stale = true;
        this.lastRefreshError = `Unknown artifact run id: ${preferredRunId}`;
      }
      return false;
    }
    this.selectedRunId = run.runId;

    if (run.versionToken === previousVersionToken) {
      this.pendingRun = null;
      return false;
    }

    if (!this.autoReloadOnPoll) {
      this.pendingRun = run;
      this.stale = true;
      return false;
    }

    try {
      const loaded = await this.loadRun(source, run);
      if (!this.bindingStillActive(binding)) {
        return false;
      }
      this.loaded = loaded;
      this.stale = false;
      this.lastRefreshError = undefined;
      this.pendingRun = null;
      this.syncActiveToCache();
      return true;
    } catch (error) {
      if (!this.bindingStillActive(binding)) {
        return false;
      }
      this.stale = true;
      this.lastRefreshError = error instanceof Error ? error.message : String(error);
      return false;
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

  private discoverSource(): Promise<DiscoveredSource> {
    return this.loadPipeline.discoverSource();
  }

  private loadRun(
    source: DiscoveredSource,
    run: ResolvedArtifactRun,
  ): Promise<LoadedArtifactWorkspace> {
    return this.loadPipeline.loadRun(source, run);
  }
}

export function createDbtToolsUseCases(workspace: ArtifactWorkspace): DbtToolsUseCases {
  const runLoaded = async <In, Out>(useCaseName: string, input: In): Promise<Out> => {
    const loaded = await workspace.getLoadedWorkspace();
    const useCase = findUseCaseByName(useCaseName);
    if (useCase == null) {
      throw new Error(`Unknown use case: ${useCaseName}`);
    }
    return useCase.run(loaded, input) as Out;
  };

  return {
    async searchResources(input) {
      const parsed = searchResourcesInputSchema.parse({
        query: input.query,
        type: input.type,
        package: input.package,
        tag: input.tag,
        path: input.path,
        limit: input.limit,
        offset: input.offset ?? 0,
      });
      return runLoaded('resource.search', parsed);
    },

    async getResource(input) {
      const parsed = getResourceInputSchema.parse({
        uniqueId: input.uniqueId,
        includeCode: input.includeCode,
      });
      const result = await runLoaded<
        typeof parsed,
        { resource: ResourceDetails | null }
      >('resource.details', parsed);
      return result.resource;
    },

    async queryDependencies(input) {
      const parsed = queryDependenciesInputSchema.parse({
        uniqueId: input.uniqueId,
        direction: input.direction,
        depth: input.depth,
        buildOrder: input.buildOrder,
      });
      return runLoaded('resource.dependencies', parsed);
    },

    async queryExecutions(input) {
      const parsed = queryExecutionsInputSchema.parse(input);
      return runLoaded('runs.query', parsed);
    },

    async getRunSummary() {
      return runLoaded('runs.summary', {});
    },
  };
}
