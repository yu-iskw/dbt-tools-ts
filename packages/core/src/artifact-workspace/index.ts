import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseSources } from 'dbt-artifacts-parser/sources';
import type { AnalysisSnapshot, ResourceNode } from '../analysis/analysis-snapshot';
import { buildAnalysisSnapshotFromParsedArtifactBundle } from '../analysis/analysis-snapshot';
import { DependencyService, type DependencyResult } from '../analysis/dependency-service';
import type { ManifestGraph } from '../analysis/manifest-graph';
import {
  getDbtToolsMaxRemoteObjectBytesFromEnv,
  getDbtToolsRemoteSourceConfigFromEnv,
  isDbtToolsDebugEnabled,
  normalizeGcsAuthOverrides,
  type GcsAuthOverrides,
} from '../config/dbt-tools-env';
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
  type ParsedArtifactLocation,
} from '../io/artifact-location';
import { parseDbtToolsArtifactTarget } from '../io/dbt-artifact-bundle';
import { readFileWithByteCap } from '../io/read-bytes-capped';
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from '../io/remote-object-store';
import type { GraphNodeAttributes } from '../types';
import {
  debugArtifactLine,
  sanitizeDebugErrorMessage,
  withDebugTiming,
  withDebugTimingSync,
} from './debug-log';

export interface ArtifactWorkspaceOptions {
  dbtTarget: string;
  now?: () => number;
  cwd?: string;
  remoteClient?: RemoteObjectStoreClient;
  /** GCS-only auth overrides (merged after `DBT_TOOLS_REMOTE_SOURCE` for `gs://` targets). */
  gcsAuth?: GcsAuthOverrides;
}

/** Input for {@link ArtifactWorkspace.switchDbtTarget}. */
export interface SwitchDbtTargetInput {
  dbtTarget: string;
  /**
   * When both fields are omitted, existing `gcsAuth` is unchanged.
   * When either is present, `gcsAuth` is replaced by `normalizeGcsAuthOverrides` (omitted keys drop out).
   */
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
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

function initializeStartFields(parsed: ParsedArtifactLocation): Record<string, string | number> {
  if (parsed.kind === 'local') {
    return { kind: 'local', resolvedPathLen: parsed.resolvedPath.length };
  }
  return {
    kind: 'remote',
    provider: parsed.provider,
    bucket: parsed.bucket,
    prefixLen: parsed.prefix.length,
  };
}

export class ArtifactWorkspace {
  private dbtTarget: string;
  private readonly cwd: string;
  private readonly now: () => number;
  private readonly injectedRemoteClient: RemoteObjectStoreClient | undefined;
  private gcsAuth: GcsAuthOverrides | undefined;
  private selectedRunId: string | null = null;
  private runs: ResolvedArtifactRun[] = [];
  private loaded: LoadedArtifactWorkspace | null = null;
  private stale = false;
  private lastRefreshError: string | undefined;
  private refreshPromise: Promise<ArtifactWorkspaceStatus> | null = null;
  private initInFlight: Promise<void> | null = null;
  private targetSwitchTail: Promise<void> = Promise.resolve();

  constructor(options: ArtifactWorkspaceOptions) {
    this.dbtTarget = options.dbtTarget;
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? Date.now;
    this.injectedRemoteClient = options.remoteClient;
    this.gcsAuth = options.gcsAuth;
  }

  async initialize(): Promise<void> {
    if (this.initInFlight != null) return this.initInFlight;
    const pending = this.initializeBody().finally(() => {
      this.initInFlight = null;
    });
    this.initInFlight = pending;
    return pending;
  }

  private async initializeBody(): Promise<void> {
    const debug = isDbtToolsDebugEnabled();
    const initT0 = debug ? performance.now() : 0;
    if (debug) {
      const parsed = parseDbtToolsArtifactTarget(this.dbtTarget, this.cwd);
      debugArtifactLine('initialize_start', initializeStartFields(parsed));
    }
    try {
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
      debugArtifactLine('initialize_end', {
        selectedRunId: this.selectedRunId ?? '',
        loadedAtMs: this.loaded.loadedAtMs,
        versionTokenLen: this.loaded.run.versionToken.length,
        durationMs: Math.round(performance.now() - initT0),
      });
    } catch (error) {
      debugArtifactLine('initialize_error', {
        message: sanitizeDebugErrorMessage(error instanceof Error ? error.message : String(error)),
        durationMs: Math.round(performance.now() - initT0),
      });
      throw error;
    }
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

  /** Repoint at a new artifact root and load the default run (queues on `targetSwitchTail`; awaits in-flight init/refresh first). */
  async switchDbtTarget(input: SwitchDbtTargetInput): Promise<ArtifactWorkspaceStatus> {
    const result: Promise<ArtifactWorkspaceStatus> = this.targetSwitchTail.then(() =>
      this.switchDbtTargetUnlocked(input),
    );
    this.targetSwitchTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async switchDbtTargetUnlocked(
    input: SwitchDbtTargetInput,
  ): Promise<ArtifactWorkspaceStatus> {
    if (this.initInFlight !== null) await this.initInFlight;
    if (this.refreshPromise !== null) await this.refreshPromise;
    const nextTarget = input.dbtTarget.trim();
    if (nextTarget === '') {
      throw new Error('dbtTarget is required.');
    }
    const hasGcsOverride =
      input.gcsProjectId !== undefined || input.gcsImpersonateServiceAccount !== undefined;
    if (hasGcsOverride) {
      this.gcsAuth = normalizeGcsAuthOverrides({
        projectId: input.gcsProjectId,
        impersonateServiceAccount: input.gcsImpersonateServiceAccount,
      });
    }
    this.selectedRunId = null;
    this.runs = [];
    this.loaded = null;
    this.stale = false;
    this.lastRefreshError = undefined;
    this.dbtTarget = nextTarget;
    await this.initialize();
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

    const refreshDebug = isDbtToolsDebugEnabled();
    const refreshT0 = refreshDebug ? performance.now() : 0;
    debugArtifactLine('refresh_start', {
      selectedRunId: this.selectedRunId ?? '',
      versionTokenLen: this.loaded.run.versionToken.length,
    });

    const source = await this.discoverSource();
    this.runs = source.runs;
    const run = this.resolveSelectedRun() ?? this.runs[0] ?? null;
    if (run == null) {
      return this.status();
    }
    this.selectedRunId = run.runId;

    if (run.versionToken === this.loaded.run.versionToken) {
      debugArtifactLine('refresh_skip_unchanged', {
        runId: run.runId,
        durationMs: Math.round(performance.now() - refreshT0),
      });
      return this.status();
    }

    try {
      this.loaded = await this.loadRun(source, run);
      this.stale = false;
      this.lastRefreshError = undefined;
      debugArtifactLine('refresh_reload_done', {
        runId: run.runId,
        durationMs: Math.round(performance.now() - refreshT0),
      });
    } catch (error) {
      this.stale = true;
      this.lastRefreshError = error instanceof Error ? error.message : String(error);
      debugArtifactLine('refresh_error', {
        message: sanitizeDebugErrorMessage(this.lastRefreshError),
        durationMs: Math.round(performance.now() - refreshT0),
      });
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
      const { discovery, runs } = await withDebugTiming(
        'discover_local',
        { pathLen: parsed.resolvedPath.length },
        () => discoverLocalArtifactRunPaths(parsed.resolvedPath),
      );
      debugArtifactLine('discover_local_result', {
        ok: discovery.ok,
        runsCount: runs.length,
      });
      return { kind: 'local', discovery, runs };
    }

    const config = mergeRemoteSourceConfigWithParsedLocation(
      getDbtToolsRemoteSourceConfigFromEnv(),
      parsed,
      this.gcsAuth,
    );
    const client = this.injectedRemoteClient ?? createRemoteObjectStoreClient(config);
    const prefix = normalizeArtifactPrefix(config.prefix);
    const objects = await withDebugTiming(
      'remote_list_objects',
      { bucket: config.bucket, prefixLen: prefix.length },
      () => client.listObjects(config.bucket, prefix),
    );
    debugArtifactLine('remote_list_objects_result', { count: objects.length });
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
    debugArtifactLine('discover_remote_candidates', {
      ok: discovery.ok,
      runsCount: runs.length,
    });
    return { kind: 'remote', bucket: config.bucket, client, discovery, runs };
  }

  private async loadRun(
    source: DiscoveredSource,
    run: ResolvedArtifactRun,
  ): Promise<LoadedArtifactWorkspace> {
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await withDebugTiming(
      'fetch_artifacts',
      { runId: run.runId, sourceKind: source.kind },
      async () =>
        source.kind === 'local' ? this.readLocalRun(run) : this.readRemoteRun(source, run),
    );
    debugArtifactLine('fetch_artifact_sizes', {
      manifestBytes: manifestBytes.byteLength,
      runResultsBytes: runResultsBytes.byteLength,
      catalogBytes: catalogBytes?.byteLength ?? 0,
      sourcesBytes: sourcesBytes?.byteLength ?? 0,
    });

    const { manifestJson, runResultsJson, catalogJson, sourcesJson } = withDebugTimingSync(
      'decode_json',
      {
        manifestBytes: manifestBytes.byteLength,
        runResultsBytes: runResultsBytes.byteLength,
      },
      () => ({
        manifestJson: decodeJson(manifestBytes),
        runResultsJson: decodeJson(runResultsBytes),
        catalogJson: optionalDecodeJson(catalogBytes),
        sourcesJson: optionalDecodeJson(sourcesBytes),
      }),
    );

    const manifest = withDebugTimingSync(
      'parse_manifest',
      { manifestBytes: manifestBytes.byteLength },
      () => parseManifest(manifestJson),
    );
    const runResults = withDebugTimingSync('parse_run_results', {}, () =>
      parseRunResults(runResultsJson),
    );
    const catalog =
      catalogJson == null
        ? undefined
        : withDebugTimingSync('parse_catalog', {}, () => parseCatalog(catalogJson));
    const sources =
      sourcesJson == null
        ? undefined
        : withDebugTimingSync('parse_sources', {}, () => parseSources(sourcesJson));

    const { analysis, graph } = withDebugTimingSync('build_analysis_snapshot', {}, () =>
      buildAnalysisSnapshotFromParsedArtifactBundle({
        manifestJson,
        runResultsJson,
        catalogJson,
        sourcesJson,
        manifest,
        runResults,
        catalog,
        sources,
      }),
    );
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
    const maxBytes = getDbtToolsMaxRemoteObjectBytesFromEnv();
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
      readFileWithByteCap(run.manifestKey, maxBytes),
      readFileWithByteCap(run.runResultsKey, maxBytes),
      this.readOptionalLocalFile(run.catalogKey, maxBytes),
      this.readOptionalLocalFile(run.sourcesKey, maxBytes),
    ]);
    return [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes];
  }

  private async readOptionalLocalFile(
    filePath: string | undefined,
    maxBytes: number,
  ): Promise<Uint8Array | null> {
    if (filePath == null) return null;
    try {
      return await readFileWithByteCap(filePath, maxBytes);
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return null;
      }
      throw error;
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        debugArtifactLine('optional_remote_read_failed', {
          key,
          error: sanitizeDebugErrorMessage(message),
        });
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
