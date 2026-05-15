import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from '../io/artifact-filenames';
import type { RemoteObjectMetadata } from '../io/artifact-discovery';
import type { RemoteObjectStoreClient } from '../io/remote-object-store';
import { ARTIFACT_WORKSPACE_DEBUG_PREFIX } from './debug-log';
import { ArtifactWorkspace, createDbtToolsUseCases } from './index';

class FakeRemoteObjectStoreClient implements RemoteObjectStoreClient {
  readonly reads: string[] = [];
  failReads = false;
  listObjectsCalls = 0;

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
    this.listObjectsCalls += 1;
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
  await fs.writeFile(path.join(dir, DBT_MANIFEST_JSON), JSON.stringify(manifestJson), 'utf8');
  await fs.writeFile(path.join(dir, DBT_RUN_RESULTS_JSON), JSON.stringify(runResultsJson), 'utf8');
}

function stderrSpyText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .map((call) => {
      const chunk = call[0];
      if (typeof chunk === 'string') return chunk;
      if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
      if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
      return '';
    })
    .join('');
}

describe('ArtifactWorkspace debug logging', () => {
  let debugTempDir: string;
  let savedDebug: string | undefined;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    debugTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-workspace-debug-'));
    savedDebug = process.env.DBT_TOOLS_DEBUG;
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    if (savedDebug === undefined) {
      delete process.env.DBT_TOOLS_DEBUG;
    } else {
      process.env.DBT_TOOLS_DEBUG = savedDebug;
    }
    stderrSpy.mockRestore();
    await fs.rm(debugTempDir, { recursive: true, force: true });
  });

  it('does not write artifact-workspace debug lines when DBT_TOOLS_DEBUG is unset', async () => {
    delete process.env.DBT_TOOLS_DEBUG;
    await writeArtifacts(debugTempDir);
    const workspace = new ArtifactWorkspace({ dbtTarget: debugTempDir });
    await workspace.initialize();
    expect(stderrSpyText(stderrSpy)).not.toContain(ARTIFACT_WORKSPACE_DEBUG_PREFIX);
  });

  it('emits phased stderr lines for local target when DBT_TOOLS_DEBUG=1', async () => {
    process.env.DBT_TOOLS_DEBUG = '1';
    await writeArtifacts(debugTempDir);
    const workspace = new ArtifactWorkspace({ dbtTarget: debugTempDir });
    await workspace.initialize();
    const out = stderrSpyText(stderrSpy);
    expect(out).toContain(`${ARTIFACT_WORKSPACE_DEBUG_PREFIX} initialize_start`);
    expect(out).toContain('kind=local');
    expect(out).toContain('discover_local_start');
    expect(out).toContain('fetch_artifacts_start');
    expect(out).toContain('parse_manifest_start');
    expect(out).toContain(`${ARTIFACT_WORKSPACE_DEBUG_PREFIX} initialize_end`);
  });

  it('emits remote_list_objects and refresh_skip_unchanged when remote version is unchanged', async () => {
    process.env.DBT_TOOLS_DEBUG = '1';
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    const workspace = new ArtifactWorkspace({
      dbtTarget: 's3://bucket/prefix',
      remoteClient,
    });
    await workspace.initialize();
    stderrSpy.mockClear();
    await workspace.refreshIfChanged();
    const out = stderrSpyText(stderrSpy);
    expect(out).toContain('remote_list_objects_start');
    expect(out).toContain('refresh_skip_unchanged');
  });

  it('emits refresh_reload_done after a remote version bump', async () => {
    process.env.DBT_TOOLS_DEBUG = '1';
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    const workspace = new ArtifactWorkspace({
      dbtTarget: 's3://bucket/prefix',
      remoteClient,
    });
    await workspace.initialize();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 2);
    stderrSpy.mockClear();
    await workspace.refreshIfChanged();
    const out = stderrSpyText(stderrSpy);
    expect(out).toContain('refresh_reload_done');
    expect(out).not.toContain('refresh_skip_unchanged');
  });

  it('emits refresh_error when reload fails after a remote version bump', async () => {
    process.env.DBT_TOOLS_DEBUG = '1';
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
    stderrSpy.mockClear();
    await workspace.refreshIfChanged();
    expect(stderrSpyText(stderrSpy)).toContain('refresh_error');
  });
});

describe('ArtifactWorkspace', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-workspace-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('switchDbtTarget loads a different local directory', async () => {
    const dirA = path.join(tempDir, 'a');
    const dirB = path.join(tempDir, 'b');
    await fs.mkdir(dirA, { recursive: true });
    await fs.mkdir(dirB, { recursive: true });
    await writeArtifacts(dirA);
    await writeArtifacts(dirB);

    const workspace = new ArtifactWorkspace({ dbtTarget: dirA, now: () => 1 });
    await workspace.initialize();
    expect((await workspace.getStatus()).target).toBe(dirA);

    const afterSwitch = await workspace.switchDbtTarget({ dbtTarget: dirB });
    expect(afterSwitch.target).toBe(dirB);
    expect(afterSwitch.selectedRunId).toBe('current');
    expect(afterSwitch.versionToken).toContain(DBT_MANIFEST_JSON);
    expect(afterSwitch.loadedAtMs).toBe(1);

    const useCases = createDbtToolsUseCases(workspace);
    const search = await useCases.searchResources({ query: 'customers', limit: 1 });
    expect(search.total).toBeGreaterThan(0);
  });

  it('serializes concurrent switchDbtTarget so the last switch wins', async () => {
    const dirA = path.join(tempDir, 'a');
    const dirB = path.join(tempDir, 'b');
    const dirC = path.join(tempDir, 'c');
    await fs.mkdir(dirA, { recursive: true });
    await fs.mkdir(dirB, { recursive: true });
    await fs.mkdir(dirC, { recursive: true });
    await writeArtifacts(dirA);
    await writeArtifacts(dirB);
    await writeArtifacts(dirC);

    const workspace = new ArtifactWorkspace({ dbtTarget: dirA });
    await workspace.initialize();

    await Promise.all([
      workspace.switchDbtTarget({ dbtTarget: dirB }),
      workspace.switchDbtTarget({ dbtTarget: dirC }),
    ]);
    expect((await workspace.getStatus()).target).toBe(dirC);
  });

  it('rejects local initialize when manifest exceeds DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES', async () => {
    const prevMax = process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES;
    process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = '100';
    try {
      await fs.writeFile(path.join(tempDir, DBT_MANIFEST_JSON), 'm'.repeat(200), 'utf8');
      await fs.writeFile(
        path.join(tempDir, DBT_RUN_RESULTS_JSON),
        JSON.stringify(runResultsJson),
        'utf8',
      );
      const workspace = new ArtifactWorkspace({ dbtTarget: tempDir });
      await expect(workspace.initialize()).rejects.toThrow(
        /Object exceeds configured maximum size/,
      );
    } finally {
      if (prevMax === undefined) delete process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES;
      else process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = prevMax;
    }
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

    const lineage = await useCases.getLineage({
      uniqueId: 'model.jaffle_shop.customers',
      direction: 'upstream',
      depth: 1,
    });
    expect(lineage.count).toBeGreaterThan(0);
    expect(lineage.dependencies.some((dependency) => dependency.depth === 1)).toBe(true);
  });

  it('deduplicates concurrent getLoadedWorkspace into one remote listObjects', async () => {
    const remoteClient = new FakeRemoteObjectStoreClient();
    remoteClient.put(`prefix/${DBT_MANIFEST_JSON}`, manifestJson, 1);
    remoteClient.put(`prefix/${DBT_RUN_RESULTS_JSON}`, runResultsJson, 1);
    const workspace = new ArtifactWorkspace({
      dbtTarget: 's3://bucket/prefix',
      remoteClient,
    });
    const [first, second] = await Promise.all([
      workspace.getLoadedWorkspace(),
      workspace.getLoadedWorkspace(),
    ]);
    expect(first).toBe(second);
    expect(remoteClient.listObjectsCalls).toBe(1);
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
});
