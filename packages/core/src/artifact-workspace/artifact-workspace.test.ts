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

  it('serves setTarget from cache when switching back within LRU capacity', async () => {
    const dirA = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-cache-a-'));
    const dirB = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-cache-b-'));
    try {
      await writeArtifacts(dirA);
      await writeArtifacts(dirB);
      let now = 100;
      const workspace = new ArtifactWorkspace({
        maxCachedTargets: 2,
        now: () => now,
      });

      const first = await workspace.setTarget(dirA);
      now = 200;
      await workspace.setTarget(dirB);
      now = 300;
      const third = await workspace.setTarget(dirA);

      expect(first.loadedAtMs).toBe(100);
      expect(third.fromCache).toBe(true);
      expect(third.loadedAtMs).toBe(100);
      expect(third.cachedTargets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: dirA, loadedAtMs: 100 }),
          expect.objectContaining({ target: dirB, loadedAtMs: 200 }),
        ]),
      );
    } finally {
      await rmValidated(dirA, { recursive: true, force: true });
      await rmValidated(dirB, { recursive: true, force: true });
    }
  });

  it('reloads when LRU capacity evicts a prior target', async () => {
    const dirA = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-lru-a-'));
    const dirB = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-lru-b-'));
    try {
      await writeArtifacts(dirA);
      await writeArtifacts(dirB);
      let now = 100;
      const workspace = new ArtifactWorkspace({
        maxCachedTargets: 1,
        now: () => now,
      });

      await workspace.setTarget(dirA);
      now = 200;
      await workspace.setTarget(dirB);
      now = 300;
      const third = await workspace.setTarget(dirA);

      expect(third.fromCache).toBeUndefined();
      expect(third.loadedAtMs).toBe(300);
    } finally {
      await rmValidated(dirA, { recursive: true, force: true });
      await rmValidated(dirB, { recursive: true, force: true });
    }
  });

  it('reloads after cache TTL expires', async () => {
    await writeArtifacts(tempDir);
    let now = 1000;
    const workspace = new ArtifactWorkspace({
      maxCachedTargets: 2,
      cacheTtlMs: 1000,
      now: () => now,
    });

    const first = await workspace.setTarget(tempDir);
    now = 2500;
    const second = await workspace.setTarget(tempDir);

    expect(first.loadedAtMs).toBe(1000);
    expect(second.fromCache).toBeUndefined();
    expect(second.loadedAtMs).toBe(2500);
  });

  it('unsetTarget clears active binding but retains cache', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ maxCachedTargets: 2, now: () => 123 });
    await workspace.setTarget(tempDir);

    const status = await workspace.unsetTarget();

    expect(status.target).toBeNull();
    expect(status.loadedAtMs).toBeNull();
    expect(status.cachedTargets).toEqual([
      expect.objectContaining({ target: tempDir, loadedAtMs: 123 }),
    ]);
    await expect(workspace.getLoadedWorkspace()).rejects.toBeInstanceOf(
      ArtifactTargetNotConfiguredError,
    );
  });

  it('does not apply refresh results after setTarget switches to another target', async () => {
    const dirA = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-race-a-'));
    const dirB = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-race-b-'));
    try {
      await writeArtifacts(dirA);
      const nodesB = { ...(manifestJson.nodes as Record<string, unknown>) };
      delete nodesB['model.jaffle_shop.customers'];
      const manifestB = { ...manifestJson, nodes: nodesB };
      await writeValidatedUtf8(
        resolveJoinedSafe(dirB, DBT_MANIFEST_JSON),
        JSON.stringify(manifestB),
      );
      await writeValidatedUtf8(
        resolveJoinedSafe(dirB, DBT_RUN_RESULTS_JSON),
        JSON.stringify(runResultsJson),
      );

      const workspace = new ArtifactWorkspace({ maxCachedTargets: 2, now: () => 100 });
      await workspace.setTarget(dirA);

      const useCases = createDbtToolsUseCases(workspace);
      const customersOnA = await useCases.searchResources({ query: 'customers', limit: 5 });
      expect(customersOnA.total).toBeGreaterThan(0);

      let releaseRefresh: (() => void) | undefined;
      const refreshGate = new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
      const originalDiscover = (
        workspace as unknown as { discoverSource: () => Promise<unknown> }
      ).discoverSource.bind(workspace);
      (workspace as unknown as { discoverSource: () => Promise<unknown> }).discoverSource =
        async () => {
          const source = await originalDiscover();
          await refreshGate;
          return source;
        };

      const refreshPromise = workspace.refreshIfChanged();
      const switchPromise = workspace.setTarget(dirB);
      releaseRefresh?.();
      await Promise.all([refreshPromise, switchPromise]);

      await expect(
        useCases.getResource({ uniqueId: 'model.jaffle_shop.customers' }),
      ).resolves.toBeNull();

      const status = await workspace.getStatus();
      expect(status.target).toBe(dirB);
    } finally {
      await rmValidated(dirA, { recursive: true, force: true });
      await rmValidated(dirB, { recursive: true, force: true });
    }
  });

  it('serves cached snapshot when cached target revalidation listing fails', async () => {
    const dirA = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-reval-a-'));
    const dirB = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-workspace-reval-b-'));
    try {
      await writeArtifacts(dirA);
      await writeArtifacts(dirB);

      const workspace = new ArtifactWorkspace({ maxCachedTargets: 2, now: () => 100 });
      await workspace.setTarget(dirA);
      const useCases = createDbtToolsUseCases(workspace);
      const customersOnA = await useCases.searchResources({ query: 'customers', limit: 5 });
      expect(customersOnA.total).toBeGreaterThan(0);

      await workspace.setTarget(dirB);

      (workspace as unknown as { discoverSource: () => Promise<unknown> }).discoverSource =
        async () => {
          throw new Error('transient listing outage');
        };

      const restored = await workspace.setTarget(dirA);
      expect(restored.fromCache).toBe(true);
      expect(restored.stale).toBe(true);
      expect(restored.lastRefreshError).toContain('transient listing outage');

      await expect(
        useCases.getResource({ uniqueId: 'model.jaffle_shop.customers' }),
      ).resolves.not.toBeNull();
    } finally {
      await rmValidated(dirA, { recursive: true, force: true });
      await rmValidated(dirB, { recursive: true, force: true });
    }
  });

  it('revalidates cached target when remote version token changes', async () => {
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix-a/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix-a/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    remoteClient.put(`prefix-b/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix-b/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);

    let now = 100;
    const workspace = new ArtifactWorkspace({
      maxCachedTargets: 2,
      remoteClient,
      now: () => now,
    });

    await workspace.setTarget('s3://bucket/prefix-a');
    const readsAfterA = remoteClient.reads.length;
    now = 200;
    await workspace.setTarget('s3://bucket/prefix-b');
    remoteClient.put(`prefix-a/${DBT_MANIFEST_JSON}`, manifestJson, 2);

    now = 300;
    const restored = await workspace.setTarget('s3://bucket/prefix-a');

    expect(restored.fromCache).toBeUndefined();
    expect(restored.loadedAtMs).toBe(300);
    expect(remoteClient.reads.length).toBeGreaterThan(readsAfterA);
  });

  it('fans out refresh progress to coalesced refreshIfChanged callers', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ maxCachedTargets: 1, now: () => 100 });
    await workspace.setTarget(tempDir);

    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const originalDiscover = (
      workspace as unknown as { discoverSource: () => Promise<unknown> }
    ).discoverSource.bind(workspace);
    (workspace as unknown as { discoverSource: () => Promise<unknown> }).discoverSource =
      async () => {
        await refreshGate;
        return originalDiscover();
      };

    const eventsA: Array<{ phase: string }> = [];
    const eventsB: Array<{ phase: string }> = [];
    const refreshA = workspace.refreshIfChanged({ onProgress: (event) => eventsA.push(event) });
    const refreshB = workspace.refreshIfChanged({ onProgress: (event) => eventsB.push(event) });
    releaseRefresh?.();
    await Promise.all([refreshA, refreshB]);

    expect(eventsA.length).toBeGreaterThan(0);
    expect(eventsB.length).toBeGreaterThan(0);
  });

  it('reports ready progress when serving setTarget from cache', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ maxCachedTargets: 2, now: () => 100 });
    await workspace.setTarget(tempDir);

    const events: Array<{ phase: string; progress: number }> = [];
    const status = await workspace.setTarget(tempDir, {
      onProgress: (event) => events.push(event),
    });

    expect(status.fromCache).toBe(true);
    expect(events.some((event) => event.phase === 'ready' && event.progress === 100)).toBe(true);
  });

  it('reports ready progress when cached target revalidates after remote artifact change', async () => {
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix-a/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix-a/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    remoteClient.put(`other/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`other/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);

    const workspace = new ArtifactWorkspace({
      maxCachedTargets: 2,
      remoteClient,
      now: () => 100,
    });
    await workspace.setTarget('s3://bucket/prefix-a');
    await workspace.setTarget('s3://bucket/other');
    remoteClient.put(`prefix-a/${DBT_MANIFEST_JSON}`, manifestJson, 2);

    const events: Array<{ phase: string; progress: number }> = [];
    await workspace.setTarget('s3://bucket/prefix-a', {
      onProgress: (event) => events.push(event),
    });

    expect(events.some((event) => event.phase === 'ready' && event.progress === 100)).toBe(true);
  });

  it('clearCachedTargets drops cache and active loaded state', async () => {
    await writeArtifacts(tempDir);
    const workspace = new ArtifactWorkspace({ maxCachedTargets: 2, now: () => 123 });
    await workspace.setTarget(tempDir);

    const status = await workspace.clearCachedTargets();

    expect(status.cachedTargets).toBeUndefined();
    expect(status.loadedAtMs).toBeNull();
    expect(status.runs).toEqual([]);
    expect(status.target).toBe(tempDir);

    const useCases = createDbtToolsUseCases(workspace);
    await expect(useCases.searchResources({ query: 'customers', limit: 1 })).resolves.toMatchObject(
      { total: expect.any(Number) },
    );
    const afterSearch = await workspace.getStatus();
    expect(afterSearch.loadedAtMs).toBe(123);
  });
});
