import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ArtifactWorkspace, createDbtToolsUseCases } from '../artifact-workspace/index.js';

import {
  artifactWorkspaceStatusSchema,
  dependencyQueryOutputSchema,
  getResourceToolOutputSchema,
  queryExecutionsInputSchema,
  queryExecutionsOutputSchema,
  resourceDetailsSchema,
  runSummaryOutputSchema,
  searchResourcesOutputSchema,
  toQueryExecutionsRequest,
  toolErrorSchema,
} from './index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixtureManifest = path.join(
  repoRoot,
  'packages/test-fixtures/dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json',
);
const fixtureRunResults = path.join(
  repoRoot,
  'packages/test-fixtures/dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json',
);

async function prepareArtifactDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-contracts-'));
  await fs.copyFile(fixtureManifest, path.join(dir, 'manifest.json'));
  await fs.copyFile(fixtureRunResults, path.join(dir, 'run_results.json'));
  return dir;
}

describe('core contracts', () => {
  it('parses artifact workspace status shape', () => {
    const parsed = artifactWorkspaceStatusSchema.parse({
      target: './target',
      selectedRunId: 'current',
      versionToken: 'v1',
      loadedAtMs: 100,
      stale: false,
      runs: [{ runId: 'current', versionToken: 'v1' }],
    });
    expect(parsed.target).toBe('./target');
  });

  it('parses search resources output', () => {
    const parsed = searchResourcesOutputSchema.parse({
      total: 1,
      results: [
        {
          unique_id: 'model.pkg.orders',
          resource_type: 'model',
          name: 'orders',
          package_name: 'pkg',
        },
      ],
      offset: 0,
    });
    expect(parsed.results).toHaveLength(1);
  });

  it('parses resource details and nullable get_resource output', () => {
    const node = {
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
    };
    expect(resourceDetailsSchema.parse(node).uniqueId).toBe('model.pkg.orders');
    expect(getResourceToolOutputSchema.parse(null)).toBeNull();
    expect(getResourceToolOutputSchema.parse(node).uniqueId).toBe('model.pkg.orders');
  });

  it('maps query executions input and rejects dual warehouse blocks', () => {
    const parsed = queryExecutionsInputSchema.parse({
      resourceTypes: ['model'],
      limit: 5,
      bigquery: { minSlotMs: 1 },
    });
    expect(toQueryExecutionsRequest(parsed)).toMatchObject({
      resourceTypes: ['model'],
      limit: 5,
      offset: 0,
      bigquery: { minSlotMs: 1 },
    });

    expect(() =>
      queryExecutionsInputSchema.parse({
        bigquery: { minSlotMs: 1 },
        snowflake: { minRowsAffected: 2 },
      }),
    ).toThrow();
  });

  it('parses dependency and execution outputs', () => {
    expect(
      dependencyQueryOutputSchema.parse({
        resource_id: 'model.pkg.orders',
        direction: 'upstream',
        dependencies: [],
        count: 0,
      }).count,
    ).toBe(0);

    expect(
      queryExecutionsOutputSchema.parse({
        warehouse: 'bigquery',
        run_warehouse: 'bigquery',
        warehouse_criteria: null,
        resource_types: ['model'],
        sort: 'execution_time_desc',
        limit: 10,
        offset: 0,
        total_matched: 0,
        returned: 0,
        has_more: false,
        rows: [],
      }).returned,
    ).toBe(0);
  });

  it('parses run summary and tool errors', () => {
    expect(
      runSummaryOutputSchema.parse({
        summary: {
          total_execution_time: 1,
          total_nodes: 1,
          nodes_by_status: {},
          node_executions: [],
        },
        statusBreakdown: [],
        adapterTotals: null,
        warehouse_type: 'unknown',
      }).warehouse_type,
    ).toBe('unknown');

    expect(toolErrorSchema.parse({ error: 'x', hint: 'y' }).hint).toBe('y');
  });

  it('rejects invalid workspace status payloads', () => {
    expect(() =>
      artifactWorkspaceStatusSchema.parse({
        target: './target',
        selectedRunId: null,
        versionToken: null,
        loadedAtMs: 'bad',
        stale: false,
        runs: [],
      }),
    ).toThrow();
  });

  it('parses golden jaffle_shop run summary from loaded workspace', async () => {
    const dir = await prepareArtifactDir();
    try {
      const workspace = new ArtifactWorkspace({ dbtTarget: dir });
      const useCases = createDbtToolsUseCases(workspace);
      await workspace.setTarget(dir);
      const summary = await useCases.getRunSummary();
      expect(() => runSummaryOutputSchema.parse(summary)).not.toThrow();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
