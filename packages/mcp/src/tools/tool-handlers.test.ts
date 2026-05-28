import { ArtifactTargetNotConfiguredError, QueryExecutionsValidationError } from '@dbt-tools/core';
import { describe, expect, it } from 'vitest';

import { createDbtToolsMcpToolHandlers, type ArtifactWorkspaceControl } from './tool-handlers.js';

import type {
  ArtifactWorkspaceStatus,
  DbtToolsUseCases,
  SearchResourcesInput,
} from '@dbt-tools/core/artifact-workspace';

class FakeWorkspaceControl implements ArtifactWorkspaceControl {
  status: ArtifactWorkspaceStatus = {
    target: './target',
    selectedRunId: 'current',
    versionToken: 'manifest:1|run_results:1',
    loadedAtMs: 100,
    stale: false,
    runs: [{ runId: 'current', versionToken: 'manifest:1|run_results:1' }],
    warehouse_type: 'bigquery',
  };

  async getStatus(): Promise<ArtifactWorkspaceStatus> {
    return this.status;
  }

  async refreshIfChanged(): Promise<ArtifactWorkspaceStatus> {
    return { ...this.status, loadedAtMs: 200 };
  }

  lastSetTarget: string | null = null;

  async setTarget(target: string): Promise<ArtifactWorkspaceStatus> {
    this.lastSetTarget = target;
    this.status = { ...this.status, target, loadedAtMs: 300 };
    return this.status;
  }

  async unsetTarget(): Promise<ArtifactWorkspaceStatus> {
    this.status = {
      ...this.status,
      target: null,
      loadedAtMs: null,
      selectedRunId: null,
      versionToken: null,
      runs: [],
    };
    return this.status;
  }

  async clearCachedTargets(): Promise<ArtifactWorkspaceStatus> {
    this.status = { ...this.status, loadedAtMs: null, cachedTargets: undefined };
    return this.status;
  }
}

class FakeUseCases implements DbtToolsUseCases {
  lastSearchInput: SearchResourcesInput | null = null;
  lastQueryExecutionsInput: unknown = null;

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

  async queryDependencies() {
    return {
      resource_id: 'model.pkg.orders',
      direction: 'upstream' as const,
      dependencies: [],
      count: 0,
    };
  }

  async queryExecutions(input: unknown) {
    this.lastQueryExecutionsInput = input;
    return {
      warehouse: 'bigquery' as const,
      run_warehouse: 'bigquery' as const,
      warehouse_criteria: null,
      resource_types: ['model'],
      sort: 'execution_time_desc' as const,
      limit: 10,
      offset: 0,
      total_matched: 0,
      returned: 0,
      has_more: false,
      rows: [],
    };
  }

  async querySubgraphCost() {
    return {
      root_unique_id: 'model.pkg.orders',
      direction: 'upstream' as const,
      metric: 'execution_time' as const,
      node_count: 0,
      executed_node_count: 0,
      truncated: false,
      totals_scope: 'complete' as const,
      totals: { slot_ms: 0, bytes_processed: 0, execution_time: 0 },
      top_contributors: [],
      not_executed: [],
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
      bottlenecks: undefined,
      adapterTotals: null,
      warehouse_type: 'bigquery' as const,
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
      runs: [{ runId: 'current' }],
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

  it('calls workspace setTarget with validated remote flags', async () => {
    const workspace = new FakeWorkspaceControl();
    const handlers = createDbtToolsMcpToolHandlers(workspace, new FakeUseCases(), {
      gcsProjectId: 'proj',
    });

    const payload = parseToolJson(
      await handlers.dbt_tools_set_target({ target: 'gs://bucket/prefix' }),
    );

    expect(workspace.lastSetTarget).toBe('gs://bucket/prefix');
    expect(payload).toMatchObject({ target: 'gs://bucket/prefix', loadedAtMs: 300 });
  });

  it('returns isError when target is missing from set_target input', async () => {
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), new FakeUseCases());
    const result = await handlers.dbt_tools_set_target({});
    expect(result.isError).toBe(true);
    expect(parseToolJson(result)).toMatchObject({ error: 'target is required.' });
  });

  it('returns isError when analysis runs before target is configured', async () => {
    const useCases = new FakeUseCases();
    useCases.searchResources = async () => {
      throw new ArtifactTargetNotConfiguredError();
    };
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);
    const result = await handlers.dbt_tools_search_resources({ query: 'orders' });
    expect(result.isError).toBe(true);
    expect(parseToolJson(result)).toMatchObject({
      error: ArtifactTargetNotConfiguredError.message,
      hint: expect.stringContaining('dbt_tools_set_target'),
    });
  });

  it('forwards query_executions filters including uniqueIds and globMode', async () => {
    const useCases = new FakeUseCases();
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);

    await handlers.dbt_tools_query_executions({
      uniqueIds: ['model.pkg.orders'],
      uniqueIdPattern: 'orders',
      globMode: 'strict',
      adapterText: 'job-1',
    });

    expect(useCases.lastQueryExecutionsInput).toMatchObject({
      uniqueIds: ['model.pkg.orders'],
      uniqueIdPattern: 'orders',
      globMode: 'strict',
      adapterText: 'job-1',
    });
  });

  it('forwards query_dependencies include flags', async () => {
    const useCases = new FakeUseCases();
    let depsInput: unknown;
    useCases.queryDependencies = async (input) => {
      depsInput = input;
      return {
        resource_id: input.uniqueId,
        direction: input.direction,
        dependencies: [],
        count: 0,
      };
    };
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);

    await handlers.dbt_tools_query_dependencies({
      uniqueId: 'model.pkg.orders',
      includeCode: true,
      includeExecutionMetrics: true,
    });

    expect(depsInput).toMatchObject({
      uniqueId: 'model.pkg.orders',
      includeCode: true,
      includeExecutionMetrics: true,
    });
  });

  it('calls querySubgraphCost with parsed metric', async () => {
    const useCases = new FakeUseCases();
    let costInput: unknown;
    useCases.querySubgraphCost = async (input) => {
      costInput = input;
      return {
        root_unique_id: input.uniqueId,
        direction: input.direction,
        metric: input.metric,
        node_count: 0,
        executed_node_count: 0,
        truncated: false,
        totals_scope: 'complete' as const,
        totals: { slot_ms: 0, bytes_processed: 0, execution_time: 0 },
        top_contributors: [],
        not_executed: [],
      };
    };
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);

    await handlers.dbt_tools_query_subgraph_cost({
      uniqueId: 'model.pkg.orders',
      direction: 'downstream',
      metric: 'slot_ms',
    });

    expect(costInput).toMatchObject({
      uniqueId: 'model.pkg.orders',
      direction: 'downstream',
      metric: 'slot_ms',
    });
  });

  it('forwards run summary bottleneck options', async () => {
    const useCases = new FakeUseCases();
    let summaryOptions: unknown;
    useCases.getRunSummary = async (options) => {
      summaryOptions = options;
      return {
        summary: {
          total_execution_time: 0,
          total_nodes: 0,
          nodes_by_status: {},
          node_executions: [],
        },
        statusBreakdown: [],
        bottlenecks: undefined,
        adapterTotals: null,
        warehouse_type: 'bigquery' as const,
      };
    };
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);

    await handlers.dbt_tools_get_run_summary({
      bottleneck: { metric: 'slot_ms', topN: 10, resourceTypes: ['model'] },
    });

    expect(summaryOptions).toMatchObject({
      bottleneck: { metric: 'slot_ms', topN: 10, resourceTypes: ['model'] },
    });
  });

  it('maps validation errors to isError tool results', async () => {
    const useCases = new FakeUseCases();
    useCases.queryExecutions = async () => {
      throw new QueryExecutionsValidationError('bad sort', {
        hint: 'use execution_time_desc',
        allowed_sorts: ['execution_time_desc'],
      });
    };
    const handlers = createDbtToolsMcpToolHandlers(new FakeWorkspaceControl(), useCases);
    const result = await handlers.dbt_tools_query_executions({ sort: 'slot_ms_desc' });
    expect(result.isError).toBe(true);
    expect(parseToolJson(result)).toMatchObject({
      error: 'bad sort',
      allowed_sorts: ['execution_time_desc'],
    });
  });
});
