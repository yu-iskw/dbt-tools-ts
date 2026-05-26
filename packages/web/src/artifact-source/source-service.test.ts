import os from 'node:os';
import path from 'node:path';

import {
  mkdtempValidated,
  resolveJoinedSafe,
  rmValidated,
  writeValidatedUtf8,
} from '@dbt-tools/core';
import * as artifactIo from '@dbt-tools/core/artifact-io';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactSourceService, type RemoteObjectStoreClient } from './source-service';

class FakeRemoteClient implements RemoteObjectStoreClient {
  listDelayMs = 0;

  constructor(
    private readonly objects: Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
      bytes?: Uint8Array;
    }>,
  ) {}

  replaceObjects(
    objects: Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
      bytes?: Uint8Array;
    }>,
  ): void {
    this.objects.length = 0;
    this.objects.push(...objects);
  }

  async listObjects(): Promise<
    Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
    }>
  > {
    if (this.listDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.listDelayMs));
    }
    return this.objects.map(({ bytes: _bytes, ...object }) => object);
  }

  async readObjectBytes(_bucket: string, key: string): Promise<Uint8Array> {
    const object = this.objects.find((candidate) => candidate.key === key);
    if (object?.bytes == null) {
      throw new Error(`Missing bytes for ${key}`);
    }
    return object.bytes;
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rmValidated(dir, { recursive: true, force: true });
    }),
  );
});

describe('ArtifactSourceService', () => {
  it('bootstraps a remote prefix with root-level artifacts', async () => {
    const client = new FakeRemoteClient([
      {
        key: 'scheduled/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
      {
        key: 'scheduled/run_results.json',
        updatedAtMs: 2_000,
        etag: 'results-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
    ]);

    const service = new ArtifactSourceService({
      remoteConfig: {
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: 'scheduled',
        pollIntervalMs: 15_000,
      },
      remoteClient: client,
    });

    const status = await service.getStatus();
    expect(status.mode).toBe('remote');
    expect(status.currentSource).toBe('remote');
    expect(status.currentRun?.runId).toBe('current');
    expect(status.pendingRun).toBeNull();

    const payload = await service.getCurrentArtifacts();
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('run-2');
  });

  it('ignores artifact files in subdirectories under a remote prefix', async () => {
    const client = new FakeRemoteClient([
      {
        key: 'scheduled/2026-03-28T10-00-00Z/manifest.json',
        updatedAtMs: 1_000,
        etag: 'manifest-1',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-1"}}'),
      },
      {
        key: 'scheduled/2026-03-28T10-00-00Z/run_results.json',
        updatedAtMs: 1_000,
        etag: 'results-1',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-1"}}'),
      },
    ]);

    const service = new ArtifactSourceService({
      remoteConfig: {
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: 'scheduled',
        pollIntervalMs: 15_000,
      },
      remoteClient: client,
    });

    const status = await service.getStatus();
    expect(status.mode).toBe('remote');
    expect(status.currentSource).toBeNull();
    expect(status.discoveryError).toMatch(/manifest\.json/);
    expect(await service.getCurrentArtifacts()).toBeNull();
  });

  it('reads the current local preload pair when a target dir is configured', async () => {
    const targetDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-artifact-source-'));
    tempDirs.push(targetDir);

    await writeValidatedUtf8(
      resolveJoinedSafe(targetDir, 'manifest.json'),
      '{"metadata":{"project_name":"local-run"}}',
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(targetDir, 'run_results.json'),
      '{"metadata":{"project_name":"local-run"}}',
    );
    await writeValidatedUtf8(resolveJoinedSafe(targetDir, 'catalog.json'), '{"nodes":{}}');
    await writeValidatedUtf8(resolveJoinedSafe(targetDir, 'sources.json'), '{"results":[]}');

    const service = new ArtifactSourceService({
      remoteConfig: null,
      targetDir,
    });

    const status = await service.getStatus();
    expect(status.mode).toBe('preload');
    expect(status.currentSource).toBe('preload');
    expect(status.pendingRun).toBeNull();

    const payload = await service.getCurrentArtifacts();
    expect(payload?.source).toBe('preload');
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('local-run');
    expect(new TextDecoder().decode(payload?.runResultsBytes)).toContain('local-run');
    expect(new TextDecoder().decode(payload?.catalogBytes ?? new Uint8Array())).toContain('nodes');
    expect(new TextDecoder().decode(payload?.sourcesBytes ?? new Uint8Array())).toContain(
      'results',
    );
  });

  it('discovery previews a location without changing the active session', async () => {
    const activeDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-artifact-active-'));
    tempDirs.push(activeDir);
    await writeValidatedUtf8(
      resolveJoinedSafe(activeDir, 'manifest.json'),
      '{"metadata":{"project_name":"active-run"}}',
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(activeDir, 'run_results.json'),
      '{"metadata":{"project_name":"active-run"}}',
    );

    const previewDir = await mkdtempValidated(
      path.join(os.tmpdir(), 'dbt-tools-artifact-preview-'),
    );
    tempDirs.push(previewDir);
    await writeValidatedUtf8(
      resolveJoinedSafe(previewDir, 'manifest.json'),
      '{"metadata":{"project_name":"preview-run"}}',
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(previewDir, 'run_results.json'),
      '{"metadata":{"project_name":"preview-run"}}',
    );

    const service = new ArtifactSourceService({
      remoteConfig: null,
      targetDir: activeDir,
    });

    const beforeStatus = await service.getStatus();
    const discovery = await service.discoverArtifactSource('local', previewDir);
    const afterStatus = await service.getStatus();
    const payload = await service.getCurrentArtifacts();

    expect(discovery.locationDisplay).toBe(previewDir);
    expect(discovery.discoveryError).toBeNull();
    expect(beforeStatus.currentRun).toEqual(afterStatus.currentRun);
    expect(afterStatus.locationDisplay).toBe(activeDir);
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('active-run');
  });

  it('commits root-level artifacts when configureArtifactSource is called', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await writeValidatedUtf8(
      resolveJoinedSafe(dir, 'manifest.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(dir, 'run_results.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );

    const service = new ArtifactSourceService({ remoteConfig: null });

    const status = await service.configureArtifactSource('local', dir);
    expect(status.currentRun?.runId).toBe('current');
    expect(status.currentSource).toBe('preload');

    const payload = await service.getCurrentArtifacts();
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('alpha');
  });

  it('rejects invalid run ids during configureArtifactSource', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await writeValidatedUtf8(
      resolveJoinedSafe(dir, 'manifest.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(dir, 'run_results.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );

    const service = new ArtifactSourceService({ remoteConfig: null });

    await expect(service.configureArtifactSource('local', dir, 'missing-run')).rejects.toThrow(
      /Unknown run id/,
    );
  });

  it('forwards trimmed GCS impersonation to remote object store client creation', async () => {
    const spy = vi.spyOn(artifactIo, 'createRemoteObjectStoreClient').mockResolvedValue(
      new FakeRemoteClient([
        {
          key: 'prefix/manifest.json',
          updatedAtMs: 1,
          bytes: new TextEncoder().encode('{"metadata":{"project_name":"x"}}'),
        },
        {
          key: 'prefix/run_results.json',
          updatedAtMs: 1,
          bytes: new TextEncoder().encode('{"metadata":{"project_name":"x"}}'),
        },
      ]),
    );

    try {
      const service = new ArtifactSourceService({ seedFromEnv: false });
      await service.discoverArtifactSource('gcs', 'mybucket/prefix', {
        impersonatedServiceAccount: '  target@svc.iam.gserviceaccount.com  ',
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gcs',
          bucket: 'mybucket',
          prefix: 'prefix',
          impersonatedServiceAccount: 'target@svc.iam.gserviceaccount.com',
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('does not revert configure when a stale remote poll list completes later', async () => {
    const spy = vi.spyOn(artifactIo, 'createRemoteObjectStoreClient');
    const client = new FakeRemoteClient([
      {
        key: 'prefix-a/manifest.json',
        updatedAtMs: 1_000,
        etag: 'manifest-a',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-a"}}'),
      },
      {
        key: 'prefix-a/run_results.json',
        updatedAtMs: 1_000,
        etag: 'results-a',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-a"}}'),
      },
      {
        key: 'prefix-b/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-b',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-b"}}'),
      },
      {
        key: 'prefix-b/run_results.json',
        updatedAtMs: 2_000,
        etag: 'results-b',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-b"}}'),
      },
    ]);
    client.listDelayMs = 50;
    spy.mockResolvedValue(client);

    try {
      const service = new ArtifactSourceService({
        remoteConfig: {
          provider: 's3',
          bucket: 'dbt-artifacts',
          prefix: 'prefix-a',
          pollIntervalMs: 15_000,
        },
        remoteClient: client,
      });

      const stalePoll = service.getStatus();
      await service.configureArtifactSource('s3', 'dbt-artifacts/prefix-b');
      await stalePoll;

      const status = await service.getStatus();
      expect(status.remoteLocation).toContain('prefix-b');
      expect(status.remoteLocation).not.toContain('prefix-a');

      const payload = await service.getCurrentArtifacts();
      expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('run-b');
    } finally {
      spy.mockRestore();
    }
  });

  it('surfaces pendingRun after getStatus when remote root artifacts are overwritten in place', async () => {
    const client = new FakeRemoteClient([
      {
        key: 'scheduled/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-v1',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-v1"}}'),
      },
      {
        key: 'scheduled/run_results.json',
        updatedAtMs: 2_000,
        etag: 'results-v1',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-v1"}}'),
      },
    ]);

    const service = new ArtifactSourceService({
      remoteConfig: {
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: 'scheduled',
        pollIntervalMs: 15_000,
      },
      remoteClient: client,
    });

    const initial = await service.getStatus();
    expect(initial.pendingRun).toBeNull();
    expect(initial.currentRun?.versionToken).toContain('manifest-v1');

    client.replaceObjects([
      {
        key: 'scheduled/manifest.json',
        updatedAtMs: 3_000,
        etag: 'manifest-v2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-v2"}}'),
      },
      {
        key: 'scheduled/run_results.json',
        updatedAtMs: 3_000,
        etag: 'results-v2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-v2"}}'),
      },
    ]);

    const refreshed = await service.getStatus();
    expect(refreshed.currentRun?.runId).toBe('current');
    expect(refreshed.pendingRun?.runId).toBe('current');
    expect(refreshed.pendingRun?.versionToken).not.toBe(initial.currentRun?.versionToken);
    expect(refreshed.supportsSwitch).toBe(true);
  });

  it('seeds remote artifact root from DBT_TOOLS_DBT_TARGET at startup', async () => {
    const client = new FakeRemoteClient([
      {
        key: 'scheduled/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
      {
        key: 'scheduled/run_results.json',
        updatedAtMs: 2_000,
        etag: 'results-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
    ]);
    const spy = vi.spyOn(artifactIo, 'createRemoteObjectStoreClient').mockResolvedValue(client);

    const prev = process.env.DBT_TOOLS_DBT_TARGET;
    process.env.DBT_TOOLS_DBT_TARGET = 's3://dbt-artifacts/scheduled';
    try {
      const service = new ArtifactSourceService({ seedFromEnv: true });
      const status = await service.getStatus();
      expect(status.mode).toBe('remote');
      expect(status.remoteLocation).toContain('dbt-artifacts');
    } finally {
      spy.mockRestore();
      if (prev === undefined) {
        delete process.env.DBT_TOOLS_DBT_TARGET;
      } else {
        process.env.DBT_TOOLS_DBT_TARGET = prev;
      }
    }
  });
});
