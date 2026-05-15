import { describe, expect, it } from 'vitest';
import type {
  ArtifactWorkspaceStatus,
  DbtToolsUseCases,
  ResolvedArtifactRun,
  SearchResourcesInput,
  SwitchDbtTargetInput,
} from '@dbt-tools/core/artifact-workspace';
import { createDbtToolsMcpToolHandlers, type ArtifactWorkspaceControl } from './toolHandlers.js';

class FakeWorkspaceControl implements ArtifactWorkspaceControl {
  lastSwitch: SwitchDbtTargetInput | null = null;

  status: ArtifactWorkspaceStatus = {
    target: './target',
    selectedRunId: 'current',
    versionToken: 'manifest:1|run_results:1',
    loadedAtMs: 100,
    stale: false,
  };

  runs: ResolvedArtifactRun[] = [
    {
      runId: 'current',
      manifestKey: '/target/manifest.json',
      runResultsKey: '/target/run_results.json',
      updatedAtMs: 1,
      versionToken: 'manifest:1|run_results:1',
    },
  ];

  async getStatus(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }

  async refreshIfChanged(): Promise<ArtifactWorkspaceStatus> {
    return { ...this.status, loadedAtMs: 200 };
  }

  async listRuns(): Promise<ResolvedArtifactRun[]> {
    return this.runs;
  }

  async selectRun(runId: string): Promise<ArtifactWorkspaceStatus> {
    this.status = { ...this.status, selectedRunId: runId };
    return this.status;
  }

  async switchDbtTarget(input: SwitchDbtTargetInput): Promise<ArtifactWorkspaceStatus> {
    this.lastSwitch = input;
    this.status = { ...this.status, target: input.dbtTarget };
    return this.status;
  }
}

class FakeUseCases implements DbtToolsUseCases {
  lastSearchInput: SearchResourcesInput | null = null;

  async searchResources(input: SearchResourcesInput) {
    this.lastSearchInput = input;
    return {
      query: input.query,
      total: 1,
      results: [
        {
          unique_id: 'model.pkg.orders',
          resource_type: 'model',
          name: 'orders',
          package_name: 'pkg',
        },
      ],
      limit: input.limit,
      offset: input.offset ?? 0,
      has_more: false,
    };
  }

  async getResource() {
    return {
      uniqueId: 'model.pkg.orders',
      name: 'orders',
      resourceType: 'model',
      packageName: 'pkg',
      path: 'models/orders.sql',
      originalFilePath: 'models/orders.sql',
      description: null,
      status: null,
      statusTone: 'neutral' as const,
      executionTime: null,
      threadId: null,
    };
  }

  async getLineage() {
    return {
      resource_id: 'model.pkg.orders',
      direction: 'upstream' as const,
      dependencies: [],
      count: 0,
    };
  }

  async getImpact() {
    return {
      resource_id: 'model.pkg.orders',
      direction: 'downstream' as const,
      dependencies: [],
      count: 0,
    };
  }

  async summarizeFailures() {
    return {
      total: 0,
      returned: 0,
      limit: 20,
      offset: 0,
      has_more: false,
      failures: [],
    };
  }

  async buildRunReport() {
    return {
      summary: {
        total_execution_time: 0,
        total_nodes: 0,
        nodes_by_status: {},
        node_executions: [],
      },
      statusBreakdown: [],
      bottlenecks: undefined,
      node_executions: [],
      node_executions_limit: 20,
      node_executions_offset: 0,
      node_executions_has_more: false,
    };
  }
}

function parseToolJson(result: { content: Array<{ type: 'text'; text: string }> }): unknown {
  return JSON.parse(result.content[0]!.text) as unknown;
}

describe('createDbtToolsMcpToolHandlers', () => {
  it('returns workspace status as bounded JSON text', async () => {
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), new FakeUseCases());

    const payload = parseToolJson(await handlers.dbt_tools_status({}));

    expect(payload).toMatchObject({
      target: './target',
      selectedRunId: 'current',
      stale: false,
    });
  });

  it('applies an agent-safe default limit for resource search', async () => {
    const useCases = new FakeUseCases();
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);

    const payload = parseToolJson(await handlers.dbt_tools_search_resources({ query: 'orders' }));

    expect(payload).toMatchObject({ total: 1 });
    expect(useCases.lastSearchInput).toMatchObject({
      query: 'orders',
      limit: 20,
      offset: 0,
    });
  });

  it('selects a run through the workspace control surface', async () => {
    const workspace = new FakeWorkspaceControl();
    const handlers = createDbtToolsMcpToolHandlers(workspace, new FakeUseCases());

    const payload = parseToolJson(await handlers.dbt_tools_select_run({ runId: 'new-run' }));

    expect(payload).toMatchObject({ selectedRunId: 'new-run' });
  });

  it('switches target through the workspace control surface', async () => {
    const workspace = new FakeWorkspaceControl();
    const handlers = createDbtToolsMcpToolHandlers(workspace, new FakeUseCases());

    const payload = parseToolJson(
      await handlers.dbt_tools_set_target({ dbtTarget: '/other/target' }),
    );

    expect(payload).toMatchObject({ target: '/other/target' });
    expect(workspace.lastSwitch).toEqual({ dbtTarget: '/other/target' });
  });

  it('forwards optional GCS fields when set_target includes them', async () => {
    const workspace = new FakeWorkspaceControl();
    const handlers = createDbtToolsMcpToolHandlers(workspace, new FakeUseCases());

    await handlers.dbt_tools_set_target({
      dbtTarget: 'gs://b/p',
      gcsProjectId: 'my-project',
      gcsImpersonateServiceAccount: 'svc@proj.iam.gserviceaccount.com',
    });

    expect(workspace.lastSwitch).toEqual({
      dbtTarget: 'gs://b/p',
      gcsProjectId: 'my-project',
      gcsImpersonateServiceAccount: 'svc@proj.iam.gserviceaccount.com',
    });
  });

  it('rejects set_target without dbtTarget', async () => {
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), new FakeUseCases());

    await expect(handlers.dbt_tools_set_target({})).rejects.toThrow('dbtTarget is required.');
  });
});
