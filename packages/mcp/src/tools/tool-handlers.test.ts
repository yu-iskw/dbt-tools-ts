import { QueryExecutionsValidationError } from '@dbt-tools/core';
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
