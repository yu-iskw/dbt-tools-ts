import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as artifactIo from '@dbt-tools/core/artifact-io';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactSourceService, type RemoteObjectStoreClient } from './source-service';

class FakeRemoteClient implements RemoteObjectStoreClient {
  constructor(
    private readonly objects: Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
      bytes?: Uint8Array;
    }>,
  ) {}

  async listObjects(): Promise<
    Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
    }>
  > {
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
      await fs.rm(dir, { recursive: true, force: true });
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
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-source-'));
    tempDirs.push(targetDir);

    await fs.writeFile(
      path.join(targetDir, 'manifest.json'),
      '{"metadata":{"project_name":"local-run"}}',
    );
    await fs.writeFile(
      path.join(targetDir, 'run_results.json'),
      '{"metadata":{"project_name":"local-run"}}',
    );
    await fs.writeFile(path.join(targetDir, 'catalog.json'), '{"nodes":{}}');
    await fs.writeFile(path.join(targetDir, 'sources.json'), '{"results":[]}');

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
    const activeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-active-'));
    tempDirs.push(activeDir);
    await fs.writeFile(
      path.join(activeDir, 'manifest.json'),
      '{"metadata":{"project_name":"active-run"}}',
    );
    await fs.writeFile(
      path.join(activeDir, 'run_results.json'),
      '{"metadata":{"project_name":"active-run"}}',
    );

    const previewDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-preview-'));
    tempDirs.push(previewDir);
    await fs.writeFile(
      path.join(previewDir, 'manifest.json'),
      '{"metadata":{"project_name":"preview-run"}}',
    );
    await fs.writeFile(
      path.join(previewDir, 'run_results.json'),
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
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, 'manifest.json'), '{"metadata":{"project_name":"alpha"}}');
    await fs.writeFile(path.join(dir, 'run_results.json'), '{"metadata":{"project_name":"alpha"}}');

    const service = new ArtifactSourceService({ remoteConfig: null });

    const status = await service.configureArtifactSource('local', dir);
    expect(status.currentRun?.runId).toBe('current');
    expect(status.currentSource).toBe('preload');

    const payload = await service.getCurrentArtifacts();
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('alpha');
  });

  it('rejects invalid run ids during configureArtifactSource', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, 'manifest.json'), '{"metadata":{"project_name":"alpha"}}');
    await fs.writeFile(path.join(dir, 'run_results.json'), '{"metadata":{"project_name":"alpha"}}');

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
});
