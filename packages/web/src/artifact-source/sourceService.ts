/** Node (Vite dev) service: configurable local path or remote S3/GCS; drives middleware routes. */
import fs from 'node:fs/promises';
import {
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  mergeRemoteSourceConfigWithParsedLocation,
  parseArtifactSourceLocation,
  type ArtifactDiscoveryResult,
  type ArtifactSourceKind,
  type DbtToolsRemoteSourceConfig,
} from '@dbt-tools/core';
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from '@dbt-tools/core/artifact-io';
import {
  discoverLatestArtifactRuns,
  discoverLocalResolvedArtifactRuns,
  discoverRemoteArtifactDiscovery,
  toLocalManagedArtifactRun,
  toRemoteArtifactRun,
  type ResolvedArtifactRun,
} from './discovery';
import { normalizeArtifactPrefix } from './prefix';
import { resolveLocalArtifactTargetDirFromEnv } from './resolveLocalTargetDir';
import type {
  ArtifactSourceDiscoveryResult,
  ArtifactSourceStatus,
  ManagedArtifactSourceMode,
  MissingOptionalArtifactsState,
  RemoteArtifactProvider,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '../services/artifactSourceApi';

export type { RemoteObjectStoreClient } from '@dbt-tools/core/artifact-io';

interface CurrentArtifactPayload {
  source: Exclude<WorkspaceArtifactSource, 'upload'>;
  manifestBytes: Uint8Array;
  runResultsBytes: Uint8Array;
  catalogBytes?: Uint8Array;
  sourcesBytes?: Uint8Array;
}

export interface ArtifactSourceAdapter {
  getStatus(): Promise<ArtifactSourceStatus>;
  getCurrentArtifacts(): Promise<CurrentArtifactPayload | null>;
  switchToRun(runId?: string): Promise<ArtifactSourceStatus>;
}

export interface ArtifactSourceServiceOptions {
  remoteConfig?: DbtToolsRemoteSourceConfig | null;
  remoteClient?: RemoteObjectStoreClient;
  targetDir?: string | null;
  adapter?: ArtifactSourceAdapter | null;
  cwd?: string;
  seedFromEnv?: boolean;
}

function debugLog(...args: unknown[]) {
  if (isDbtToolsDebugEnabled()) {
    console.log('[artifact-source]', ...args);
  }
}

function toRemoteLocationLabel(provider: RemoteArtifactProvider, bucket: string, prefix: string) {
  return `${provider.toUpperCase()} ${bucket}/${normalizeArtifactPrefix(prefix)}`;
}

function toArtifactSourceStatus(
  status: Omit<ArtifactSourceStatus, 'checkedAtMs'>,
): ArtifactSourceStatus {
  return {
    ...status,
    checkedAtMs: Date.now(),
  };
}

function runToUiRow(
  mode: ManagedArtifactSourceMode,
  provider: RemoteArtifactProvider | null,
  run: ResolvedArtifactRun,
): RemoteArtifactRun {
  if (mode === 'remote' && provider != null) {
    return toRemoteArtifactRun(provider, run);
  }
  return toLocalManagedArtifactRun(run);
}

function missingOptionalFromRun(run: ResolvedArtifactRun): MissingOptionalArtifactsState {
  return {
    missingCatalog: run.catalogKey == null,
    missingSources: run.sourcesKey == null,
  };
}

interface DiscoveredArtifactSource {
  mode: 'preload' | 'remote';
  sourceKind: ArtifactSourceKind;
  locationDisplay: string;
  remoteProvider: RemoteArtifactProvider | null;
  localDir: string | null;
  remoteConfig: DbtToolsRemoteSourceConfig | null;
  remoteClient: RemoteObjectStoreClient | null;
  runs: ResolvedArtifactRun[];
  discoveryResult: ArtifactDiscoveryResult;
}

export class ArtifactSourceService {
  private readonly cwd: string;
  private readonly seedFromEnv: boolean;

  private delegatedAdapter: ArtifactSourceAdapter | null = null;
  private initPromise: Promise<void> | null = null;

  private mode: 'none' | 'preload' | 'remote' = 'none';

  private localDir: string | null = null;
  private locationDisplay: string | null = null;
  private sourceKind: ArtifactSourceKind | null = null;

  private remoteConfig: DbtToolsRemoteSourceConfig | null = null;
  private remoteClient: RemoteObjectStoreClient | null = null;
  private remoteProvider: RemoteArtifactProvider | null = null;

  private runs: ResolvedArtifactRun[] = [];
  private discoveryResult: ArtifactDiscoveryResult | null = null;
  private selectedRunId: string | null = null;

  constructor(options: ArtifactSourceServiceOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.seedFromEnv = options.seedFromEnv !== false;

    if (options.adapter !== undefined) {
      this.delegatedAdapter = options.adapter;
      return;
    }

    if (options.remoteConfig !== undefined || options.targetDir !== undefined) {
      this.initPromise = this.bootstrapFromExplicitOptions(options);
      return;
    }

    if (this.seedFromEnv) {
      this.initPromise = this.seedFromEnvironment();
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.delegatedAdapter != null) return;
    if (this.initPromise != null) {
      await this.initPromise;
    }
  }

  private async bootstrapFromExplicitOptions(options: ArtifactSourceServiceOptions): Promise<void> {
    if (options.remoteConfig != null) {
      await this.applyRemoteConfiguration(
        options.remoteConfig,
        options.remoteClient ?? createRemoteObjectStoreClient(options.remoteConfig),
        true,
      );
      return;
    }

    if (options.targetDir != null) {
      const resolved = resolveLocalArtifactTargetDirFromEnv(this.cwd, options.targetDir);
      await this.applyLocalDirectory(resolved, true);
    }
  }

  private async seedFromEnvironment(): Promise<void> {
    const remoteEnv = getDbtToolsRemoteSourceConfigFromEnv();
    if (remoteEnv != null) {
      await this.applyRemoteConfiguration(
        remoteEnv,
        createRemoteObjectStoreClient(remoteEnv),
        true,
      );
      return;
    }

    const rawTarget = getDbtToolsTargetDirFromEnv();
    if (rawTarget == null) return;

    const resolved = resolveLocalArtifactTargetDirFromEnv(this.cwd, rawTarget);
    await this.applyLocalDirectory(resolved, true);
  }

  private pickBootstrapRunId(
    mode: 'preload' | 'remote',
    runs: ResolvedArtifactRun[],
  ): string | null {
    if (mode === 'remote') return runs[0]?.runId ?? null;
    if (runs.length === 1) return runs[0]!.runId;
    return null;
  }

  private discoveryErrorMessage(): string | null {
    return this.discoveryResult != null && !this.discoveryResult.ok
      ? this.discoveryResult.failure.message
      : null;
  }

  private resolveSelectedRun(): ResolvedArtifactRun | null {
    if (this.selectedRunId == null) return null;
    return this.runs.find((r) => r.runId === this.selectedRunId) ?? null;
  }

  private statusWhenNone(): ArtifactSourceStatus {
    return toArtifactSourceStatus({
      mode: 'none',
      currentSource: null,
      label: 'Waiting for artifacts',
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: null,
      pendingRun: null,
      supportsSwitch: false,
      needsSelection: false,
      candidates: undefined,
      discoveryError: null,
      sourceKind: null,
      locationDisplay: null,
      missingOptionalArtifacts: undefined,
    });
  }

  private mapRunsToUiRows(): RemoteArtifactRun[] {
    return this.runs.map((run) => runToUiRow(this.mode, this.remoteProvider, run));
  }

  private runToUiOrNull(run: ResolvedArtifactRun | null): RemoteArtifactRun | null {
    if (run == null) return null;
    return runToUiRow(this.mode, this.remoteProvider, run);
  }

  private needsExplicitRunSelection(discoveryError: string | null): boolean {
    return this.runs.length > 0 && this.selectedRunId == null && discoveryError == null;
  }

  private optionalArtifactsForResolved(
    currentResolved: ResolvedArtifactRun | null,
  ): MissingOptionalArtifactsState | undefined {
    return currentResolved == null ? undefined : missingOptionalFromRun(currentResolved);
  }

  private remotePollIntervalOrNull(): number | null {
    if (this.mode !== 'remote') return null;
    return this.remoteConfig?.pollIntervalMs ?? null;
  }

  private remoteSupportsPendingSwitch(
    pendingRun: RemoteArtifactRun | null,
    needsSelection: boolean,
  ): boolean {
    return this.mode === 'remote' && pendingRun != null && !needsSelection;
  }

  private currentManagedSourceOrNull(params: {
    needsSelection: boolean;
    discoveryError: string | null;
    currentResolved: ResolvedArtifactRun | null;
  }): Exclude<WorkspaceArtifactSource, 'upload'> | null {
    if (params.needsSelection || params.discoveryError != null || params.currentResolved == null) {
      return null;
    }
    if (this.mode === 'none') return null;
    return this.mode;
  }

  private buildActiveArtifactStatus(): Omit<ArtifactSourceStatus, 'checkedAtMs'> {
    const discoveryError = this.discoveryErrorMessage();
    const candidatesUi = this.mapRunsToUiRows();
    const currentResolved = this.resolveSelectedRun();
    const currentRunUi = this.runToUiOrNull(currentResolved);
    const pendingRun = this.pendingRunAfterLatest(currentResolved);
    const needsSelection = this.needsExplicitRunSelection(discoveryError);
    const missingOptionalArtifacts = this.optionalArtifactsForResolved(currentResolved);
    const supportsSwitch = this.remoteSupportsPendingSwitch(pendingRun, needsSelection);
    const pollIntervalMs = this.remotePollIntervalOrNull();
    const currentSource = this.currentManagedSourceOrNull({
      needsSelection,
      discoveryError,
      currentResolved,
    });

    return {
      mode: this.mode,
      currentSource,
      label: this.locationDisplay ?? 'Artifacts',
      remoteProvider: this.remoteProvider,
      remoteLocation: this.mode === 'remote' ? this.locationDisplay : null,
      pollIntervalMs,
      currentRun: currentRunUi,
      pendingRun,
      supportsSwitch,
      needsSelection,
      candidates: candidatesUi.length > 0 ? candidatesUi : undefined,
      discoveryError,
      sourceKind: this.sourceKind ?? undefined,
      locationDisplay: this.locationDisplay,
      missingOptionalArtifacts,
    };
  }

  private pendingRunAfterLatest(
    currentResolved: ResolvedArtifactRun | null,
  ): RemoteArtifactRun | null {
    const latestRun = this.runs[0] ?? null;
    if (
      this.mode !== 'remote' ||
      this.remoteProvider == null ||
      latestRun == null ||
      currentResolved == null ||
      latestRun.runId === currentResolved.runId
    ) {
      return null;
    }
    return runToUiRow('remote', this.remoteProvider, latestRun);
  }

  private async readPreloadArtifacts(run: ResolvedArtifactRun): Promise<CurrentArtifactPayload> {
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
      fs.readFile(run.manifestKey),
      fs.readFile(run.runResultsKey),
      run.catalogKey != null
        ? fs.readFile(run.catalogKey).catch(() => null)
        : Promise.resolve(null),
      run.sourcesKey != null
        ? fs.readFile(run.sourcesKey).catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      source: 'preload',
      manifestBytes,
      runResultsBytes,
      ...(catalogBytes != null ? { catalogBytes } : {}),
      ...(sourcesBytes != null ? { sourcesBytes } : {}),
    };
  }

  private async readRemoteArtifacts(
    run: ResolvedArtifactRun,
    bucket: string,
    client: RemoteObjectStoreClient,
  ): Promise<CurrentArtifactPayload> {
    const readOptional = async (key: string | undefined): Promise<Uint8Array | null> => {
      if (key == null) return null;
      try {
        return await client.readObjectBytes(bucket, key);
      } catch {
        return null;
      }
    };

    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
      client.readObjectBytes(bucket, run.manifestKey),
      client.readObjectBytes(bucket, run.runResultsKey),
      readOptional(run.catalogKey),
      readOptional(run.sourcesKey),
    ]);

    return {
      source: 'remote',
      manifestBytes,
      runResultsBytes,
      ...(catalogBytes != null ? { catalogBytes } : {}),
      ...(sourcesBytes != null ? { sourcesBytes } : {}),
    };
  }

  private previewToUiRows(discovery: DiscoveredArtifactSource): RemoteArtifactRun[] {
    return discovery.runs.map((run) => runToUiRow(discovery.mode, discovery.remoteProvider, run));
  }

  private discoveryNeedsSelection(
    discovery: DiscoveredArtifactSource,
    selectedRunId: string | null,
  ): boolean {
    const discoveryError =
      discovery.discoveryResult.ok === true ? null : discovery.discoveryResult.failure.message;
    return discovery.runs.length > 0 && selectedRunId == null && discoveryError == null;
  }

  private resolveConfiguredRunId(discovery: DiscoveredArtifactSource, runId?: string): string {
    if (!discovery.discoveryResult.ok) {
      throw new Error(discovery.discoveryResult.failure.message);
    }
    const trimmedRunId = runId?.trim();
    if (trimmedRunId != null && trimmedRunId !== '') {
      const found = discovery.runs.some((run) => run.runId === trimmedRunId);
      if (!found) {
        throw new Error(
          `Unknown run id "${trimmedRunId}". Candidates: ${discovery.runs
            .map((run) => run.runId)
            .join(', ')}`,
        );
      }
      return trimmedRunId;
    }
    if (discovery.runs.length === 1) {
      return discovery.runs[0]!.runId;
    }
    if (discovery.runs.length === 0) {
      throw new Error('No complete dbt artifact pair found at this location.');
    }
    throw new Error(
      `Multiple artifact sets found (${discovery.runs.length}). Select a candidate run before loading.`,
    );
  }

  private applyDiscoveredArtifactSource(
    discovery: DiscoveredArtifactSource,
    selectedRunId: string | null,
  ): void {
    this.mode = discovery.mode;
    this.localDir = discovery.localDir;
    this.locationDisplay = discovery.locationDisplay;
    this.sourceKind = discovery.sourceKind;
    this.remoteConfig = discovery.remoteConfig;
    this.remoteClient = discovery.remoteClient;
    this.remoteProvider = discovery.remoteProvider;
    this.discoveryResult = discovery.discoveryResult;
    this.runs = discovery.runs;
    this.selectedRunId = selectedRunId;
  }

  private async discoverLocalDirectory(resolvedDir: string): Promise<DiscoveredArtifactSource> {
    const { runs, discovery } = await discoverLocalResolvedArtifactRuns(resolvedDir);
    if (!discovery.ok) {
      debugLog('Local discovery failed', discovery.failure.message);
    }
    return {
      mode: 'preload',
      sourceKind: 'local',
      locationDisplay: resolvedDir,
      remoteProvider: null,
      localDir: resolvedDir,
      remoteConfig: null,
      remoteClient: null,
      runs,
      discoveryResult: discovery,
    };
  }

  private async discoverRemoteConfiguration(
    config: DbtToolsRemoteSourceConfig,
    client: RemoteObjectStoreClient,
  ): Promise<DiscoveredArtifactSource> {
    const prefixNorm = normalizeArtifactPrefix(config.prefix);
    const objects = await client.listObjects(config.bucket, prefixNorm);
    const discovery = discoverRemoteArtifactDiscovery(objects, config.prefix);
    const runs = discovery.ok ? discoverLatestArtifactRuns(objects, config.prefix) : [];
    if (!discovery.ok) {
      debugLog('Remote discovery failed', discovery.failure.message);
    }
    return {
      mode: 'remote',
      sourceKind: config.provider,
      locationDisplay: toRemoteLocationLabel(config.provider, config.bucket, config.prefix),
      remoteProvider: config.provider,
      localDir: null,
      remoteConfig: config,
      remoteClient: client,
      runs,
      discoveryResult: discovery,
    };
  }

  private async discoverArtifactSourceInternal(
    kind: ArtifactSourceKind,
    location: string,
  ): Promise<DiscoveredArtifactSource> {
    const parsed = parseArtifactSourceLocation(kind, location, this.cwd);
    if (parsed.kind === 'local') {
      return this.discoverLocalDirectory(parsed.resolvedPath);
    }

    const env = getDbtToolsRemoteSourceConfigFromEnv();
    const merged = mergeRemoteSourceConfigWithParsedLocation(env, parsed);
    const client = createRemoteObjectStoreClient(merged);
    return this.discoverRemoteConfiguration(merged, client);
  }

  private async applyLocalDirectory(resolvedDir: string, fromEnvBootstrap: boolean): Promise<void> {
    const discovery = await this.discoverLocalDirectory(resolvedDir);
    const selectedRunId =
      discovery.discoveryResult.ok && fromEnvBootstrap
        ? this.pickBootstrapRunId('preload', discovery.runs)
        : null;
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);
  }

  private async applyRemoteConfiguration(
    config: DbtToolsRemoteSourceConfig,
    client: RemoteObjectStoreClient,
    fromEnvBootstrap: boolean,
  ): Promise<void> {
    const discovery = await this.discoverRemoteConfiguration(config, client);
    const selectedRunId =
      discovery.discoveryResult.ok && fromEnvBootstrap
        ? this.pickBootstrapRunId('remote', discovery.runs)
        : null;
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);
  }

  async discoverArtifactSource(
    kind: ArtifactSourceKind,
    location: string,
  ): Promise<ArtifactSourceDiscoveryResult> {
    await this.ensureReady();
    const discovery = await this.discoverArtifactSourceInternal(kind, location);
    const candidates = this.previewToUiRows(discovery);
    const needsSelection = this.discoveryNeedsSelection(discovery, null);
    return {
      sourceKind: discovery.sourceKind,
      locationDisplay: discovery.locationDisplay,
      candidates: candidates.length > 0 ? candidates : undefined,
      needsSelection,
      discoveryError:
        discovery.discoveryResult.ok === true ? null : discovery.discoveryResult.failure.message,
    };
  }

  /**
   * User-driven configuration (UI or API). Commits the location only when the
   * selected run is explicit or uniquely determined.
   */
  async configureArtifactSource(
    kind: ArtifactSourceKind,
    location: string,
    runId?: string,
  ): Promise<ArtifactSourceStatus> {
    await this.ensureReady();
    const discovery = await this.discoverArtifactSourceInternal(kind, location);
    const selectedRunId = this.resolveConfiguredRunId(discovery, runId);
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);

    return this.getStatus();
  }

  async getStatus(): Promise<ArtifactSourceStatus> {
    await this.ensureReady();

    if (this.delegatedAdapter != null) {
      return this.delegatedAdapter.getStatus();
    }

    if (this.mode === 'none') {
      return this.statusWhenNone();
    }

    return toArtifactSourceStatus(this.buildActiveArtifactStatus());
  }

  async getCurrentArtifacts(): Promise<CurrentArtifactPayload | null> {
    await this.ensureReady();

    if (this.delegatedAdapter != null) {
      return this.delegatedAdapter.getCurrentArtifacts();
    }

    if (this.selectedRunId == null || this.discoveryResult?.ok !== true) {
      return null;
    }

    const run = this.runs.find((r) => r.runId === this.selectedRunId);
    if (run == null) return null;

    if (this.mode === 'preload' && this.localDir != null) {
      return this.readPreloadArtifacts(run);
    }

    if (this.mode === 'remote' && this.remoteClient != null && this.remoteConfig != null) {
      return this.readRemoteArtifacts(run, this.remoteConfig.bucket, this.remoteClient);
    }

    return null;
  }

  async switchToRun(runId?: string): Promise<ArtifactSourceStatus> {
    await this.ensureReady();

    if (this.delegatedAdapter != null) {
      return this.delegatedAdapter.switchToRun(runId);
    }

    if (runId != null && runId.trim() !== '') {
      const found = this.runs.some((r) => r.runId === runId);
      if (found) {
        this.selectedRunId = runId;
        debugLog('Selected artifact run', this.selectedRunId);
      }
    }

    return this.getStatus();
  }
}
