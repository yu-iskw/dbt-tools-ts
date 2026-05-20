import * as os from 'node:os';
import * as path from 'node:path';

import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ArtifactTargetNotConfiguredError } from '../errors/artifact-target-not-configured-error';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from '../io/artifact-filenames';
import {
  mkdtempValidated,
  resolveJoinedSafe,
  rmValidated,
  writeValidatedUtf8,
} from '../io/safe-fs';

import { ArtifactWorkspace, createDbtToolsUseCases } from './index';

import type { RemoteObjectMetadata } from '../io/artifact-discovery';
import type { RemoteObjectStoreClient } from '../io/remote-object-store';

class FakeRemoteObjectStoreClient implements RemoteObjectStoreClient {
  readonly reads: string[] = [];
  failReads = false;

  private objects = new Map<
    string,
    { bytes: Uint8Array; metadata: Omit<RemoteObjectMetadata, 'key'> }
  >();

  put(key: string, json: Record<string, unknown>, version: number): void {
    this.objects.set(key, {
      bytes: Buffer.from(JSON.stringify(json)),
      metadata: {
        updatedAtMs: version,
        etag: `etag-${version}`,
      },
    });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    if (bucket !== 'bucket') {
      throw new Error(`unexpected bucket ${bucket}`);
    }
    return [...this.objects.entries()]
      .filter(([key]) => prefix === '' || key.startsWith(`${prefix}/`))
      .map(([key, value]) => ({
        key,
        ...value.metadata,
      }));
  }

  async readObjectBytes(_bucket: string, key: string): Promise<Uint8Array> {
    this.reads.push(key);
    if (this.failReads) {
      throw new Error(`read failed for ${key}`);
    }
    const object = this.objects.get(key);
    if (object == null) {
      throw new Error(`missing object ${key}`);
    }
    return object.bytes;
  }
}

const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

async function writeArtifacts(dir: string): Promise<void> {
  await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_MANIFEST_JSON), JSON.stringify(manifestJson));
  await writeValidatedUtf8(
    resolveJoinedSafe(dir, DBT_RUN_RESULTS_JSON),
    JSON.stringify(runResultsJson),
  );
}

describe('ArtifactWorkspace', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-'));
  });

  afterEach(async () => {
    await rmValidated(tempDir, { recursive: true, force: true });
  });

  it('loads a local target once and serves shared search/resource/lineage use cases', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ dbtTarget: tempDir, now: () => 123 });

    await workspace.initialize();

    const status = await workspace.getStatus();
    expect(status.selectedRunId).toBe('current');
    expect(status.loadedAtMs).toBe(123);
    expect(status.stale).toBe(false);
    expect(status.versionToken).toContain(DBT_MANIFEST_JSON);

    const useCases = createDbtToolsUseCases(workspace);
    const search = await useCases.searchResources({ query: 'customers', limit: 5 });
    expect(search.total).toBeGreaterThan(0);
    expect(search.results.map((result) => result.unique_id)).toContain(
      'model.jaffle_shop.customers',
    );

    const resource = await useCases.getResource({
      uniqueId: 'model.jaffle_shop.customers',
      includeCode: true,
    });
    expect(resource?.uniqueId).toBe('model.jaffle_shop.customers');
    expect(resource?.name).toBe('customers');

    const deps = await useCases.queryDependencies({
      uniqueId: 'model.jaffle_shop.customers',
      direction: 'upstream',
      depth: 1,
    });
    expect(deps.count).toBeGreaterThan(0);
    expect(deps.dependencies.some((dependency) => dependency.depth === 1)).toBe(true);
  });

  it('skips remote artifact reads when the version token has not changed', async () => {
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    const workspace = new ArtifactWorkspace({
      dbtTarget: 's3://bucket/prefix',
      remoteClient,
      now: () => 456,
    });

    await workspace.initialize();
    const readsAfterInitialize = remoteClient.reads.length;

    const status = await workspace.refreshIfChanged();

    expect(status.stale).toBe(false);
    expect(remoteClient.reads).toHaveLength(readsAfterInitialize);
  });

  it('keeps serving the previous good workspace when a changed remote refresh fails', async () => {
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    const workspace = new ArtifactWorkspace({
      dbtTarget: 's3://bucket/prefix',
      remoteClient,
    });
    await workspace.initialize();

    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 2);
    remoteClient.failReads = true;

    const status = await workspace.refreshIfChanged();

    expect(status.stale).toBe(true);
    expect(status.lastRefreshError).toContain('read failed');
    const useCases = createDbtToolsUseCases(workspace);
    await expect(useCases.searchResources({ query: 'customers', limit: 1 })).resolves.toMatchObject(
      {
        total: expect.any(Number),
      },
    );
  });

  it('reports null target before configuration', async () => {
    const workspace = new ArtifactWorkspace({ now: () => 123 });
    const status = await workspace.getStatus();
    expect(status.target).toBeNull();
    expect(status.loadedAtMs).toBeNull();
    await expect(workspace.getLoadedWorkspace()).rejects.toBeInstanceOf(
      ArtifactTargetNotConfiguredError,
    );
    await expect(workspace.refreshIfChanged()).resolves.toMatchObject({ target: null });
  });

  it('loads artifacts after setTarget on an unconfigured workspace', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ now: () => 123 });
    const status = await workspace.setTarget(tempDir);
    expect(status.target).toBe(tempDir);
    expect(status.loadedAtMs).toBe(123);

    const useCases = createDbtToolsUseCases(workspace);
    const search = await useCases.searchResources({ query: 'customers', limit: 5 });
    expect(search.total).toBeGreaterThan(0);
  });

  it('replaces the loaded snapshot when setTarget changes path', async () => {
    const dirA = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-a-'));
    const dirB = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-b-'));
    try {
      await writeArtifacts(dirA);
      await writeArtifacts(dirB);

      const workspace = new ArtifactWorkspace({ now: () => 100 });
      const first = await workspace.setTarget(dirA);
      const second = await workspace.setTarget(dirB);

      expect(first.target).toBe(dirA);
      expect(second.target).toBe(dirB);
      expect(second.loadedAtMs).toBe(100);

      const useCases = createDbtToolsUseCases(workspace);
      await expect(
        useCases.searchResources({ query: 'customers', limit: 1 }),
      ).resolves.toMatchObject({ total: expect.any(Number) });
    } finally {
      await rmValidated(dirA, { recursive: true, force: true });
      await rmValidated(dirB, { recursive: true, force: true });
    }
  });
});
