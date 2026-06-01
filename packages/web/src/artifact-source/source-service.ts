/** Node (Vite dev) service: configurable local path or remote S3/GCS; drives middleware routes. */
import {
  getDbtToolsDbtTargetFromEnv,
  getDbtToolsRemoteClientEnvFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  mergeRemoteSourceConfigWithParsedLocation,
  parseArtifactSourceLocation,
  parseDbtToolsArtifactTarget,
  readValidatedUtf8,
  type ArtifactDiscoveryResult,
  type ArtifactSourceKind,
  type DbtToolsRemoteSourceConfig,
  type GcsArtifactSourceRequestOptions,
  captureSessionBinding,
  isSessionBindingCurrent,
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
import { resolveLocalArtifactTargetDirFromEnv } from './resolve-local-target-dir';

import type {
  ArtifactSourceDiscoveryResult,
  ArtifactSourceStatus,
  ManagedArtifactSourceMode,
  MissingOptionalArtifactsState,
  RemoteArtifactProvider,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '../services/artifact-source-api';

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
  /** Version token of artifacts the active investigation is using (ADR-0004 detect-notify-confirm). */
  private loadedVersionToken: string | null = null;
  private remoteDiscoveryRefreshPromise: Promise<void> | null = null;
  /** Bytes last committed for investigation; pins remote reads while a newer prefix version is pending. */
  private loadedArtifactCache: CurrentArtifactPayload | null = null;
  /** Incremented on user configure so in-flight remote poll refresh cannot revert the session. */
  private sessionGeneration = 0;
  /** Set when background remote list/refresh fails; surfaced via discoveryError when discovery is otherwise ok. */
  private remoteRefreshError: string | null = null;

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
        options.remoteClient ?? (await createRemoteObjectStoreClient(options.remoteConfig)),
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
    const rawDbtTarget = getDbtToolsDbtTargetFromEnv();
    if (rawDbtTarget != null) {
      const parsed = parseDbtToolsArtifactTarget(rawDbtTarget, this.cwd);
      if (parsed.kind === 'remote') {
        const discovery = await this.discoverArtifactSourceInternal(parsed.provider, rawDbtTarget);
        const selectedRunId =
          discovery.discoveryResult.ok && discovery.mode === 'remote'
            ? this.pickBootstrapRunId(discovery.runs)
            : null;
        this.applyDiscoveredArtifactSource(discovery, selectedRunId);
        if (selectedRunId != null) {
          await this.refreshLoadedArtifactCache();
        }
        return;
      }
      await this.applyLocalDirectory(parsed.resolvedPath, true);
      return;
    }

    const rawTarget = getDbtToolsTargetDirFromEnv();
    if (rawTarget == null) return;

    const resolved = resolveLocalArtifactTargetDirFromEnv(this.cwd, rawTarget);
    await this.applyLocalDirectory(resolved, true);
  }

  private pickBootstrapRunId(runs: ResolvedArtifactRun[]): string | null {
    return runs.length === 1 ? runs[0]!.runId : null;
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
      discoveryError: null,
      sourceKind: null,
      locationDisplay: null,
      missingOptionalArtifacts: undefined,
    });
  }

  private runToUiOrNull(run: ResolvedArtifactRun | null): RemoteArtifactRun | null {
    if (run == null) return null;
    return runToUiRow(this.mode, this.remoteProvider, run);
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

  private remoteSupportsPendingSwitch(pendingRun: RemoteArtifactRun | null): boolean {
    return this.mode === 'remote' && pendingRun != null;
  }

  private currentManagedSourceOrNull(params: {
    discoveryError: string | null;
    currentResolved: ResolvedArtifactRun | null;
  }): Exclude<WorkspaceArtifactSource, 'upload'> | null {
    if (params.discoveryError != null || params.currentResolved == null) {
      return null;
    }
    if (this.mode === 'none') return null;
    return this.mode;
  }

  private buildActiveArtifactStatus(): Omit<ArtifactSourceStatus, 'checkedAtMs'> {
    const discoveryError = this.discoveryErrorMessage() ?? this.remoteRefreshError;
    const currentResolved = this.resolveSelectedRun();
    const currentRunUi = this.runToUiOrNull(currentResolved);
    const pendingRun = this.pendingRunAfterLatest(currentResolved);
    const missingOptionalArtifacts = this.optionalArtifactsForResolved(currentResolved);
    const supportsSwitch = this.remoteSupportsPendingSwitch(pendingRun);
    const pollIntervalMs = this.remotePollIntervalOrNull();
    const currentSource = this.currentManagedSourceOrNull({
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
      discoveryError,
      sourceKind: this.sourceKind ?? undefined,
      locationDisplay: this.locationDisplay,
      missingOptionalArtifacts,
    };
  }

  private syncLoadedVersionToken(selectedRunId: string | null, runs: ResolvedArtifactRun[]): void {
    if (selectedRunId == null) {
      this.loadedVersionToken = null;
      return;
    }
    const run = runs.find((candidate) => candidate.runId === selectedRunId);
    this.loadedVersionToken = run?.versionToken ?? null;
  }

  private pendingRunAfterLatest(
    _currentResolved: ResolvedArtifactRun | null,
  ): RemoteArtifactRun | null {
    const latestRun = this.runs[0] ?? null;
    if (this.mode !== 'remote' || this.remoteProvider == null || latestRun == null) {
      return null;
    }
    if (this.loadedVersionToken == null || latestRun.versionToken === this.loadedVersionToken) {
      return null;
    }
    return runToUiRow('remote', this.remoteProvider, latestRun);
  }

  /** Re-list the remote prefix so polling can detect newer artifact pairs (ADR-0004). */
  private async refreshRemoteDiscovery(): Promise<void> {
    if (this.mode !== 'remote' || this.remoteConfig == null || this.remoteClient == null) {
      return;
    }
    if (this.remoteDiscoveryRefreshPromise != null) {
      return this.remoteDiscoveryRefreshPromise;
    }
    this.remoteDiscoveryRefreshPromise = this.refreshRemoteDiscoveryInternal().finally(() => {
      this.remoteDiscoveryRefreshPromise = null;
    });
    return this.remoteDiscoveryRefreshPromise;
  }

  private async refreshRemoteDiscoveryInternal(): Promise<void> {
    if (this.mode !== 'remote' || this.remoteConfig == null || this.remoteClient == null) {
      return;
    }
    const binding = captureSessionBinding(this.sessionGeneration, null);
    try {
      const discovery = await this.discoverRemoteConfiguration(
        this.remoteConfig,
        this.remoteClient,
      );
      if (!discovery.discoveryResult.ok) {
        this.remoteRefreshError =
          discovery.discoveryResult.failure.message ?? 'Remote artifact discovery failed.';
        return;
      }
      if (!isSessionBindingCurrent(binding, this.sessionGeneration, null)) {
        return;
      }
      this.remoteRefreshError = null;
      this.applyDiscoveredArtifactSource(discovery, this.selectedRunId, {
        commitLoadedVersion: false,
      });
    } catch (error) {
      this.remoteRefreshError =
        error instanceof Error ? error.message : 'Remote artifact discovery refresh failed.';
      debugLog('Remote discovery refresh failed', error);
    }
  }

  private async readCurrentArtifactPayload(
    run: ResolvedArtifactRun,
  ): Promise<CurrentArtifactPayload | null> {
    if (this.mode === 'preload' && this.localDir != null) {
      return this.readPreloadArtifacts(run);
    }
    if (this.mode === 'remote' && this.remoteClient != null && this.remoteConfig != null) {
      return this.readRemoteArtifacts(run, this.remoteConfig.bucket, this.remoteClient);
    }
    return null;
  }

  private async refreshLoadedArtifactCache(): Promise<void> {
    const run = this.resolveSelectedRun();
    if (run == null || this.discoveryResult?.ok !== true) {
      this.loadedArtifactCache = null;
      return;
    }
    this.loadedArtifactCache = await this.readCurrentArtifactPayload(run);
  }

  private async readPreloadArtifacts(run: ResolvedArtifactRun): Promise<CurrentArtifactPayload> {
    const encoder = new TextEncoder();
    const [manifestText, runResultsText, catalogText, sourcesText] = await Promise.all([
      readValidatedUtf8(run.manifestKey),
      readValidatedUtf8(run.runResultsKey),
      run.catalogKey != null
        ? readValidatedUtf8(run.catalogKey).catch(() => null)
        : Promise.resolve(null),
      run.sourcesKey != null
        ? readValidatedUtf8(run.sourcesKey).catch(() => null)
        : Promise.resolve(null),
    ]);
    const manifestBytes = encoder.encode(manifestText);
    const runResultsBytes = encoder.encode(runResultsText);
    const catalogBytes = catalogText != null ? encoder.encode(catalogText) : null;
    const sourcesBytes = sourcesText != null ? encoder.encode(sourcesText) : null;

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

  private resolveConfiguredRunId(discovery: DiscoveredArtifactSource, runId?: string): string {
    if (!discovery.discoveryResult.ok) {
      throw new Error(discovery.discoveryResult.failure.message);
    }
    if (discovery.runs.length === 0) {
      throw new Error('No complete dbt artifact pair found at this location.');
    }
    const sole = discovery.runs[0]!;
    const trimmedRunId = runId?.trim();
    if (trimmedRunId != null && trimmedRunId !== '' && trimmedRunId !== sole.runId) {
      throw new Error(`Unknown run id "${trimmedRunId}".`);
    }
    return sole.runId;
  }

  private applyDiscoveredArtifactSource(
    discovery: DiscoveredArtifactSource,
    selectedRunId: string | null,
    options?: { commitLoadedVersion?: boolean },
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
    if (options?.commitLoadedVersion !== false) {
      this.syncLoadedVersionToken(selectedRunId, discovery.runs);
      this.loadedArtifactCache = null;
    }
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
    providerOptions?: GcsArtifactSourceRequestOptions,
  ): Promise<DiscoveredArtifactSource> {
    const parsed = parseArtifactSourceLocation(kind, location, this.cwd);
    if (parsed.kind === 'local') {
      return this.discoverLocalDirectory(parsed.resolvedPath);
    }

    const envClient = getDbtToolsRemoteClientEnvFromEnv();
    const gcsRequestOptions =
      kind === 'gcs' ? { ...envClient.gcsRequestOptions, ...providerOptions } : undefined;
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      undefined,
      parsed,
      gcsRequestOptions,
      envClient.remoteClientOverrides,
    );
    const client = await createRemoteObjectStoreClient(merged);
    return this.discoverRemoteConfiguration(merged, client);
  }

  private async applyLocalDirectory(resolvedDir: string, fromEnvBootstrap: boolean): Promise<void> {
    const discovery = await this.discoverLocalDirectory(resolvedDir);
    const selectedRunId =
      discovery.discoveryResult.ok && fromEnvBootstrap
        ? this.pickBootstrapRunId(discovery.runs)
        : null;
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);
    if (selectedRunId != null) {
      await this.refreshLoadedArtifactCache();
    }
  }

  private async applyRemoteConfiguration(
    config: DbtToolsRemoteSourceConfig,
    client: RemoteObjectStoreClient,
    fromEnvBootstrap: boolean,
  ): Promise<void> {
    const discovery = await this.discoverRemoteConfiguration(config, client);
    const selectedRunId =
      discovery.discoveryResult.ok && fromEnvBootstrap
        ? this.pickBootstrapRunId(discovery.runs)
        : null;
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);
    if (selectedRunId != null) {
      await this.refreshLoadedArtifactCache();
    }
  }

  async discoverArtifactSource(
    kind: ArtifactSourceKind,
    location: string,
    providerOptions?: GcsArtifactSourceRequestOptions,
  ): Promise<ArtifactSourceDiscoveryResult> {
    await this.ensureReady();
    const discovery = await this.discoverArtifactSourceInternal(kind, location, providerOptions);
    return {
      sourceKind: discovery.sourceKind,
      locationDisplay: discovery.locationDisplay,
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
    providerOptions?: GcsArtifactSourceRequestOptions,
  ): Promise<ArtifactSourceStatus> {
    await this.ensureReady();
    this.sessionGeneration += 1;
    const binding = captureSessionBinding(this.sessionGeneration, null);
    const discovery = await this.discoverArtifactSourceInternal(kind, location, providerOptions);
    if (!isSessionBindingCurrent(binding, this.sessionGeneration, null)) {
      return this.getStatus();
    }
    const selectedRunId = this.resolveConfiguredRunId(discovery, runId);
    this.applyDiscoveredArtifactSource(discovery, selectedRunId);
    await this.refreshLoadedArtifactCache();

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

  /** Re-list remote prefix and merge discovery (poll / explicit refresh). */
  async refreshRemoteArtifactDiscovery(): Promise<ArtifactSourceStatus> {
    await this.ensureReady();
    if (this.delegatedAdapter != null) {
      return this.delegatedAdapter.getStatus();
    }
    if (this.mode === 'remote') {
      await this.refreshRemoteDiscovery();
    }
    return this.getStatus();
  }

  /**
   * Switch to a pending remote run and return status plus current artifact bytes.
   * Server commits run selection and artifact cache before the client loads analysis.
   */
  async acceptPendingRemoteRun(runId: string): Promise<ArtifactSourceStatus> {
    await this.ensureReady();
    if (this.delegatedAdapter != null) {
      throw new Error('acceptPendingRemoteRun is not supported with a delegated adapter.');
    }
    if (this.mode !== 'remote') {
      throw new Error('acceptPendingRemoteRun requires a remote artifact source.');
    }
    const trimmed = runId.trim();
    if (trimmed === '') {
      throw new Error('runId is required.');
    }
    if (!this.runs.some((run) => run.runId === trimmed)) {
      throw new Error(`Unknown artifact run id: ${trimmed}`);
    }
    this.selectedRunId = trimmed;
    this.syncLoadedVersionToken(this.selectedRunId, this.runs);
    this.loadedArtifactCache = null;
    await this.refreshLoadedArtifactCache();
    return this.getStatus();
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

    if (
      this.mode === 'remote' &&
      this.loadedVersionToken != null &&
      run.versionToken !== this.loadedVersionToken &&
      this.loadedArtifactCache != null
    ) {
      return this.loadedArtifactCache;
    }

    const payload = await this.readCurrentArtifactPayload(run);
    if (
      payload != null &&
      this.mode === 'remote' &&
      this.loadedVersionToken != null &&
      run.versionToken === this.loadedVersionToken
    ) {
      this.loadedArtifactCache = payload;
    }
    return payload;
  }

  async switchToRun(runId?: string): Promise<ArtifactSourceStatus> {
    await this.ensureReady();

    if (this.delegatedAdapter != null) {
      return this.delegatedAdapter.switchToRun(runId);
    }

    if (runId != null && runId.trim() !== '') {
      const trimmed = runId.trim();
      if (!this.runs.some((r) => r.runId === trimmed)) {
        throw new Error(`Unknown artifact run id: ${trimmed}`);
      }
      this.selectedRunId = trimmed;
      this.syncLoadedVersionToken(this.selectedRunId, this.runs);
      this.loadedArtifactCache = null;
      await this.refreshLoadedArtifactCache();
      debugLog('Selected artifact run', this.selectedRunId);
    }

    return this.getStatus();
  }
}
