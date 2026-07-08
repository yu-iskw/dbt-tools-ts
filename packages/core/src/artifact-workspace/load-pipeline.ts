import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseSources } from 'dbt-artifacts-parser/sources';

import { buildAnalysisSnapshotFromParsedArtifactBundle } from '../analysis/snapshot';
import {
  getDbtToolsRemoteClientEnvFromEnv,
  type DbtToolsRemoteClientEnv,
} from '../config/dbt-tools-env';
import {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from '../debug/dbt-tools-debug-log.js';
import {
  discoverArtifactCandidates,
  discoverLocalArtifactRunPaths,
  remoteKeysToListedArtifacts,
} from '../io/artifact-discovery';
import {
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
  type GcsArtifactSourceRequestOptions,
  type RemoteSourceClientOverrides,
} from '../io/artifact-location';
import { parseDbtToolsArtifactTarget } from '../io/dbt-artifact-bundle';
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from '../io/remote-object-store';
import { readValidatedUtf8 } from '../io/safe-fs';
import { parseUntrustedJson } from '../node/parse-untrusted-json.js';

import type { DiscoveredSource, LoadedArtifactWorkspace, ResolvedArtifactRun } from './types.js';
import type { ArtifactLoadPhase } from '../progress/artifact-load-progress.js';

export function decodeJson(bytes: Uint8Array): Record<string, unknown> {
  return parseUntrustedJson(Buffer.from(bytes).toString('utf8')) as Record<string, unknown>;
}

export function optionalDecodeJson(bytes: Uint8Array | null): Record<string, unknown> | undefined {
  return bytes == null ? undefined : decodeJson(bytes);
}

export interface ArtifactLoadPipelineHost {
  readonly cwd: string;
  now(): number;
  requireTarget(): string;
  reportProgress(phase: ArtifactLoadPhase, progress: number, message: string): void;
  mergeRemoteClientEnvLayers(
    base: DbtToolsRemoteClientEnv,
    override: DbtToolsRemoteClientEnv,
  ): {
    gcsRequestOptions?: GcsArtifactSourceRequestOptions;
    remoteClientOverrides?: RemoteSourceClientOverrides;
  };
  readonly injectedRemoteClient: RemoteObjectStoreClient | undefined;
  readonly gcsRequestOptions: GcsArtifactSourceRequestOptions | undefined;
  readonly remoteClientOverrides: RemoteSourceClientOverrides | undefined;
}

export class ArtifactLoadPipeline {
  constructor(private readonly host: ArtifactLoadPipelineHost) {}

  async discoverSource(): Promise<DiscoveredSource> {
    const startedAt = dbtToolsDebugNow();
    const parsed = parseDbtToolsArtifactTarget(this.host.requireTarget(), this.host.cwd);
    dbtToolsDebugLog(`discoverSource kind=${parsed.kind}`);
    if (parsed.kind === 'local') {
      this.host.reportProgress('discover-bundle', 25, 'Discovering artifact bundle');
      const { discovery, runs } = await discoverLocalArtifactRunPaths(parsed.resolvedPath);
      dbtToolsDebugLogPhase('discoverSource local done', startedAt, `runs=${runs.length}`);
      return { kind: 'local', discovery, runs };
    }

    this.host.reportProgress('list-objects', 15, 'Listing artifact objects');
    const { gcsRequestOptions, remoteClientOverrides } = this.host.mergeRemoteClientEnvLayers(
      getDbtToolsRemoteClientEnvFromEnv(),
      {
        gcsRequestOptions: this.host.gcsRequestOptions,
        remoteClientOverrides: this.host.remoteClientOverrides,
      },
    );
    const config = mergeRemoteSourceConfigWithParsedLocation(
      undefined,
      parsed,
      gcsRequestOptions,
      remoteClientOverrides,
    );
    const client = this.host.injectedRemoteClient ?? (await createRemoteObjectStoreClient(config));
    const prefix = normalizeArtifactPrefix(config.prefix);
    const objects = await client.listObjects(config.bucket, prefix);
    this.host.reportProgress('discover-bundle', 25, 'Discovering artifact bundle');
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

  async loadRun(
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
    this.host.reportProgress('parse-artifacts', 75, 'Parsing dbt artifacts');
    const manifestJson = decodeJson(manifestBytes);
    const runResultsJson = decodeJson(runResultsBytes);
    const catalogJson = optionalDecodeJson(catalogBytes);
    const sourcesJson = optionalDecodeJson(sourcesBytes);
    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const catalog = catalogJson == null ? undefined : parseCatalog(catalogJson);
    const sources = sourcesJson == null ? undefined : parseSources(sourcesJson);
    this.host.reportProgress('build-graph', 85, 'Building dependency graph');
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
    this.host.reportProgress('build-snapshot', 95, 'Building analysis snapshot');
    dbtToolsDebugLogPhase('loadRun complete', startedAt, `resources=${analysis.resources.length}`);
    return {
      run,
      analysis,
      graph,
      loadedAtMs: this.host.now(),
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
    this.host.reportProgress('download-manifest', 40, 'Downloading manifest');
    this.host.reportProgress('download-run-results', 50, 'Downloading run results');
    const [manifestBytes, runResultsBytes] = await Promise.all([
      source.client.readObjectBytes(source.bucket, run.manifestKey),
      source.client.readObjectBytes(source.bucket, run.runResultsKey),
    ]);
    this.host.reportProgress('download-optional-artifacts', 60, 'Downloading optional artifacts');
    const [catalogBytes, sourcesBytes] = await Promise.all([
      readOptional(run.catalogKey),
      readOptional(run.sourcesKey),
    ]);
    return [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes];
  }
}
