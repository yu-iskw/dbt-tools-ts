import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as artifactIo from '@dbt-tools/core/artifact-io';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtifactSourceService, type RemoteObjectStoreClient } from './sourceService';

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
  it('auto-selects the newest remote run during bootstrap', async () => {
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
      {
        key: 'scheduled/2026-03-29T10-00-00Z/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
      {
        key: 'scheduled/2026-03-29T10-00-00Z/run_results.json',
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
    expect(status.currentRun?.runId).toBe('2026-03-29T10-00-00Z');
    expect(status.pendingRun).toBeNull();

    const payload = await service.getCurrentArtifacts();
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('run-2');
  });

  it('uses the newest complete remote run and keeps a newer candidate pending until switched', async () => {
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
      {
        key: 'scheduled/2026-03-28T10-00-00Z/catalog.json',
        updatedAtMs: 1_000,
        etag: 'catalog-1',
        bytes: new TextEncoder().encode('{"sources":{}}'),
      },
      {
        key: 'scheduled/2026-03-28T10-00-00Z/sources.json',
        updatedAtMs: 1_000,
        etag: 'sources-1',
        bytes: new TextEncoder().encode('{"results":[]}'),
      },
      {
        key: 'scheduled/2026-03-29T10-00-00Z/manifest.json',
        updatedAtMs: 2_000,
        etag: 'manifest-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
      {
        key: 'scheduled/2026-03-29T10-00-00Z/run_results.json',
        updatedAtMs: 2_000,
        etag: 'results-2',
        bytes: new TextEncoder().encode('{"metadata":{"project_name":"run-2"}}'),
      },
      {
        key: 'scheduled/2026-03-30T10-00-00Z/manifest.json',
        updatedAtMs: 3_000,
        etag: 'manifest-3',
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

    const initialStatus = await service.getStatus();
    expect(initialStatus.mode).toBe('remote');
    expect(initialStatus.needsSelection).toBe(false);
    expect(initialStatus.currentRun?.runId).toBe('2026-03-29T10-00-00Z');
    expect(initialStatus.pendingRun).toBeNull();
    expect(initialStatus.pollIntervalMs).toBe(15_000);

    await service.switchToRun('2026-03-28T10-00-00Z');

    const switchedStatus = await service.getStatus();
    expect(switchedStatus.currentRun?.runId).toBe('2026-03-28T10-00-00Z');
    expect(switchedStatus.pendingRun?.runId).toBe('2026-03-29T10-00-00Z');
    expect(switchedStatus.supportsSwitch).toBe(true);

    const payload = await service.getCurrentArtifacts();
    expect(payload?.source).toBe('remote');
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('run-1');
    expect(new TextDecoder().decode(payload?.runResultsBytes)).toContain('run-1');
    expect(new TextDecoder().decode(payload?.catalogBytes ?? new Uint8Array())).toContain(
      'sources',
    );
    expect(new TextDecoder().decode(payload?.sourcesBytes ?? new Uint8Array())).toContain(
      'results',
    );
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
    await fs.mkdir(path.join(previewDir, 'run-a'));
    await fs.writeFile(
      path.join(previewDir, 'run-a', 'manifest.json'),
      '{"metadata":{"project_name":"preview-run"}}',
    );
    await fs.writeFile(
      path.join(previewDir, 'run-a', 'run_results.json'),
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
    expect(discovery.candidates?.map((candidate) => candidate.runId)).toEqual(['run-a']);
    expect(beforeStatus.currentRun).toEqual(afterStatus.currentRun);
    expect(afterStatus.locationDisplay).toBe(activeDir);
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('active-run');
  });

  it('commits the selected run when configureArtifactSource receives a local run id', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await fs.mkdir(path.join(dir, 'runAlpha'));
    await fs.mkdir(path.join(dir, 'runBeta'));
    await fs.writeFile(
      path.join(dir, 'runAlpha', 'manifest.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );
    await fs.writeFile(
      path.join(dir, 'runAlpha', 'run_results.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );
    await fs.writeFile(
      path.join(dir, 'runBeta', 'manifest.json'),
      '{"metadata":{"project_name":"beta"}}',
    );
    await fs.writeFile(
      path.join(dir, 'runBeta', 'run_results.json'),
      '{"metadata":{"project_name":"beta"}}',
    );

    const service = new ArtifactSourceService({ remoteConfig: null });

    const status = await service.configureArtifactSource('local', dir, 'runAlpha');
    expect(status.currentRun?.runId).toBe('runAlpha');
    expect(status.currentSource).toBe('preload');

    const payload = await service.getCurrentArtifacts();
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain('alpha');
  });

  it('rejects invalid run ids during configureArtifactSource', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifact-'));
    tempDirs.push(dir);
    await fs.mkdir(path.join(dir, 'runAlpha'));
    await fs.writeFile(
      path.join(dir, 'runAlpha', 'manifest.json'),
      '{"metadata":{"project_name":"alpha"}}',
    );
    await fs.writeFile(
      path.join(dir, 'runAlpha', 'run_results.json'),
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
          key: 'prefix/x/manifest.json',
          updatedAtMs: 1,
          bytes: new TextEncoder().encode('{"metadata":{"project_name":"x"}}'),
        },
        {
          key: 'prefix/x/run_results.json',
          updatedAtMs: 1,
          bytes: new TextEncoder().encode('{"metadata":{"project_name":"x"}}'),
        },
      ]),
    );

    try {
      delete process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST;
      delete process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES;
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

  it('rejects GCS discover when impersonation is not permitted by allowlist', async () => {
    const prevAllow = process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST;
    const prevSuf = process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES;
    process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST = 'only@allowed.iam.gserviceaccount.com';
    delete process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES;
    const spy = vi
      .spyOn(artifactIo, 'createRemoteObjectStoreClient')
      .mockResolvedValue(new FakeRemoteClient([]));
    try {
      const service = new ArtifactSourceService({ seedFromEnv: false });
      await expect(
        service.discoverArtifactSource('gcs', 'gs://mybucket/prefix', {
          impersonatedServiceAccount: 'other@proj.iam.gserviceaccount.com',
        }),
      ).rejects.toThrow(/not permitted/);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (prevAllow === undefined) delete process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST;
      else process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST = prevAllow;
      if (prevSuf === undefined) delete process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES;
      else process.env.DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES = prevSuf;
    }
  });
});
