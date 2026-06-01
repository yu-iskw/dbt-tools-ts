import { ArtifactTargetNotConfiguredError } from '@dbt-tools/core';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { readDbtToolsResource } from './resource-handlers.js';

import type { ArtifactWorkspaceStatus } from '@dbt-tools/core/artifact-workspace';
import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import type { ArtifactWorkspaceControl } from '../workspace-control.js';

class FakeWorkspace implements ArtifactWorkspaceControl {
  getStatusCalls = 0;

  constructor(private readonly status: ArtifactWorkspaceStatus) {}

  async getStatus(): Promise<ArtifactWorkspaceStatus> {
    this.getStatusCalls += 1;
    return this.status;
  }

  async refreshIfChanged(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }

  async setTarget(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }

  async unsetTarget(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }

  async clearCachedTargets(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }
}

class FakeUseCases implements DbtToolsUseCases {
  async searchResources() {
    return { total: 0, results: [], offset: 0 };
  }

  async getResource() {
    return {
      uniqueId: 'model.pkg.orders',
      name: 'orders',
      resourceType: 'model',
      packageName: 'pkg',
      path: null,
      originalFilePath: null,
      description: null,
      status: null,
      statusTone: 'neutral' as const,
      executionTime: null,
      threadId: null,
      rawCode: 'SELECT 1',
      compiledCode: 'SELECT 1',
    };
  }

  async queryDependencies() {
    return {
      resource_id: 'model.pkg.orders',
      direction: 'upstream' as const,
      dependencies: [],
      count: 0,
    };
  }

  async queryExecutions() {
    return {
      warehouse: 'unknown' as const,
      run_warehouse: 'unknown' as const,
      warehouse_criteria: null,
      resource_types: [],
      sort: 'execution_time_desc',
      limit: 10,
      offset: 0,
      total_matched: 0,
      returned: 0,
      has_more: false,
      rows: [],
    };
  }

  async getRunSummary() {
    return {
      summary: {
        total_execution_time: 0,
        total_nodes: 0,
        nodes_by_status: {},
        node_executions: [],
      },
      statusBreakdown: [],
      adapterTotals: null,
      warehouse_type: 'unknown' as const,
    };
  }
}

const loadedStatus: ArtifactWorkspaceStatus = {
  target: './target',
  selectedRunId: 'current',
  versionToken: 'v1',
  loadedAtMs: 100,
  stale: false,
  runs: [{ runId: 'current', versionToken: 'v1' }],
};

describe('readDbtToolsResource', () => {
  it('returns status with null envelope metadata when unloaded', async () => {
    const unloaded: ArtifactWorkspaceStatus = {
      target: null,
      selectedRunId: null,
      versionToken: null,
      loadedAtMs: null,
      stale: false,
      runs: [],
    };
    const result = await readDbtToolsResource(
      { workspace: new FakeWorkspace(unloaded), useCases: new FakeUseCases() },
      'dbt-tools://status',
    );
    const body = JSON.parse(result.contents[0]!.text!) as {
      versionToken: null;
      loadedAtMs: null;
    };
    expect(body.versionToken).toBeNull();
    expect(body.loadedAtMs).toBeNull();
  });

  it('throws McpError when target is not configured', async () => {
    const useCases = new FakeUseCases();
    useCases.getResource = async () => {
      throw new ArtifactTargetNotConfiguredError();
    };
    await expect(
      readDbtToolsResource(
        { workspace: new FakeWorkspace(loadedStatus), useCases },
        'dbt-tools://resources/model.pkg.orders',
      ),
    ).rejects.toBeInstanceOf(McpError);
  });

  it('calls getStatus once for resource-details envelope', async () => {
    const workspace = new FakeWorkspace(loadedStatus);
    await readDbtToolsResource(
      { workspace, useCases: new FakeUseCases() },
      'dbt-tools://resources/model.pkg.orders',
    );
    expect(workspace.getStatusCalls).toBe(1);
  });

  it('throws McpError when resource body does not match contract', async () => {
    const useCases = new FakeUseCases();
    useCases.getResource = async () =>
      ({
        uniqueId: 'model.pkg.orders',
        name: 'orders',
        resourceType: 'model',
        packageName: 'pkg',
        path: null,
        originalFilePath: null,
        description: null,
        status: null,
        statusTone: 'not-a-valid-tone',
        executionTime: null,
        threadId: null,
      }) as Awaited<ReturnType<DbtToolsUseCases['getResource']>>;

    await expect(
      readDbtToolsResource(
        { workspace: new FakeWorkspace(loadedStatus), useCases },
        'dbt-tools://resources/model.pkg.orders',
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Resource payload did not match contract'),
    });
  });

  it('truncates large SQL resources', async () => {
    const bigSql = 'x'.repeat(300_000);
    const useCases = new FakeUseCases();
    useCases.getResource = async () => ({
      ...(await new FakeUseCases().getResource()),
      rawCode: bigSql,
      compiledCode: bigSql,
    });
    const result = await readDbtToolsResource(
      { workspace: new FakeWorkspace(loadedStatus), useCases },
      'dbt-tools://resources/model.pkg.orders/sql/raw',
    );
    expect(result.contents[0]?.text).toContain('dbt-tools:');
    expect((result.contents[0]?.text?.length ?? 0) < bigSql.length).toBe(true);
  });
});
