import { describe, it, expect } from 'vitest';
import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { analyzeArtifacts } from './services/analyze';

type FixtureMap = Record<string, unknown>;
type FixtureObjectMap = Record<string, Record<string, unknown>>;
type DisabledFixtureMap = Record<string, Array<Record<string, unknown>>>;
type RunResultsFixture = FixtureMap & {
  results: Array<Record<string, unknown>>;
};
type ManifestFixture = FixtureMap & {
  nodes?: FixtureObjectMap;
  sources?: FixtureObjectMap;
  disabled?: DisabledFixtureMap;
  parent_map?: Record<string, string[]>;
  child_map?: Record<string, string[]>;
};

function loadBaseFixtures() {
  return {
    manifestJson: structuredClone(loadTestManifest('v12', 'manifest_1.10.json')) as ManifestFixture,
    runResultsJson: structuredClone(
      loadTestRunResults('v6', 'run_results.json'),
    ) as RunResultsFixture,
  };
}

function cloneResult(
  runResultsJson: RunResultsFixture,
  sourceUniqueId: string,
  overrides: Record<string, unknown>,
) {
  const source = runResultsJson.results.find(
    (entry: Record<string, unknown>) => entry.unique_id === sourceUniqueId,
  );
  if (!source) {
    throw new Error(`Missing fixture run result for ${sourceUniqueId}`);
  }

  return {
    ...structuredClone(source),
    ...overrides,
  };
}

function cloneManifestEntry(
  manifestJson: ManifestFixture,
  sourceUniqueId: string,
  overrides: Record<string, unknown>,
) {
  const source =
    manifestJson.nodes?.[sourceUniqueId] ??
    manifestJson.sources?.[sourceUniqueId] ??
    manifestJson.disabled?.[sourceUniqueId]?.[0];
  if (!source) {
    throw new Error(`Missing fixture manifest node for ${sourceUniqueId}`);
  }

  return {
    ...structuredClone(source),
    ...overrides,
  };
}

describe('analyzeArtifacts', () => {
  it('returns AnalysisState for valid manifest and run_results', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const result = await analyzeArtifacts(manifestJson, runResultsJson);

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.ganttData).toBeDefined();
    expect(Array.isArray(result.ganttData)).toBe(true);
    expect(result.bottlenecks).toBeDefined();
    expect(result.summary.total_execution_time).toBeGreaterThanOrEqual(0);
    expect(result.summary.total_nodes).toBeGreaterThanOrEqual(0);
    expect(result.graphSummary.totalNodes).toBeGreaterThan(0);
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.resourceGroups.length).toBeGreaterThan(0);
    expect(result.executions.length).toBe(result.summary.total_nodes);
    expect(result.statusBreakdown.length).toBeGreaterThan(0);
    expect(result.threadStats.length).toBeGreaterThan(0);
    expect(result.selectedResourceId).not.toBeNull();
    expect(result.dependencyIndex[result.selectedResourceId!]).toBeDefined();
    expect(result.timelineAdjacency).toBeDefined();
    expect(Object.keys(result.timelineAdjacency).length).toBeGreaterThan(0);
    for (const row of result.ganttData) {
      expect(result.timelineAdjacency[row.unique_id]).toBeDefined();
      expect(Array.isArray(result.timelineAdjacency[row.unique_id]!.inbound)).toBe(true);
      expect(Array.isArray(result.timelineAdjacency[row.unique_id]!.outbound)).toBe(true);
      expect(row).toHaveProperty('compileStart');
      expect(row).toHaveProperty('compileEnd');
      expect(row).toHaveProperty('executeStart');
      expect(row).toHaveProperty('executeEnd');
      expect(row).toHaveProperty('materialized');
    }
    const anyInbound = result.ganttData.some(
      (g) => (result.timelineAdjacency[g.unique_id]?.inbound.length ?? 0) > 0,
    );
    expect(anyInbound).toBe(true);
  });

  it('throws for invalid manifest JSON', async () => {
    const invalidManifest = { not: 'a manifest' };
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    await expect(analyzeArtifacts(invalidManifest, runResultsJson)).rejects.toThrow();
  });

  it('throws for invalid run_results JSON', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const invalidRunResults = { not: 'run_results' };

    await expect(analyzeArtifacts(manifestJson, invalidRunResults)).rejects.toThrow();
  });

  it('preserves native seed rows in timeline output', async () => {
    const { manifestJson, runResultsJson } = loadBaseFixtures();

    const result = await analyzeArtifacts(manifestJson, runResultsJson);

    expect(
      result.ganttData.some(
        (row) => row.unique_id === 'seed.jaffle_shop.raw_orders' && row.resourceType === 'seed',
      ),
    ).toBe(true);
  });

  it('includes synthetic source parents and attaches source tests to them', async () => {
    const { manifestJson, runResultsJson } = loadBaseFixtures();
    const sourceId = 'source.jaffle_shop.ecom.raw_orders';
    const passTestId = 'test.jaffle_shop.not_null_raw_orders_order_id.synthetic_pass';
    const failTestId = 'test.jaffle_shop.unique_raw_orders_order_id.synthetic_fail';

    manifestJson.nodes[passTestId] = cloneManifestEntry(
      manifestJson,
      'test.jaffle_shop.not_null_stg_orders_order_id.81cfe2fe64',
      {
        unique_id: passTestId,
        name: 'not_null_raw_orders_order_id',
        package_name: 'jaffle_shop',
        path: 'models/staging/__sources.yml',
        original_file_path: 'models/staging/__sources.yml',
        fqn: ['jaffle_shop', 'staging', 'source_tests', 'raw_orders'],
        attached_node: sourceId,
        depends_on: { macros: [], nodes: [sourceId] },
      },
    );
    manifestJson.nodes[failTestId] = cloneManifestEntry(
      manifestJson,
      'test.jaffle_shop.unique_stg_orders_order_id.e3b841c71a',
      {
        unique_id: failTestId,
        name: 'unique_raw_orders_order_id',
        package_name: 'jaffle_shop',
        path: 'models/staging/__sources.yml',
        original_file_path: 'models/staging/__sources.yml',
        fqn: ['jaffle_shop', 'staging', 'source_tests', 'raw_orders_unique'],
        attached_node: sourceId,
        depends_on: { macros: [], nodes: [sourceId] },
      },
    );

    manifestJson.parent_map[passTestId] = [sourceId];
    manifestJson.parent_map[failTestId] = [sourceId];
    manifestJson.child_map[sourceId] = [
      ...(manifestJson.child_map[sourceId] ?? []),
      passTestId,
      failTestId,
    ];

    runResultsJson.results.push(
      cloneResult(runResultsJson, 'test.jaffle_shop.not_null_stg_orders_order_id.81cfe2fe64', {
        unique_id: passTestId,
        status: 'pass',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:20.000Z',
            completed_at: '2024-12-16T07:45:20.100Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:20.100Z',
            completed_at: '2024-12-16T07:45:20.600Z',
          },
        ],
        execution_time: 0.5,
      }),
      cloneResult(runResultsJson, 'test.jaffle_shop.unique_stg_orders_order_id.e3b841c71a', {
        unique_id: failTestId,
        status: 'fail',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:19.000Z',
            completed_at: '2024-12-16T07:45:19.100Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:19.100Z',
            completed_at: '2024-12-16T07:45:20.900Z',
          },
        ],
        execution_time: 1.8,
      }),
    );

    const result = await analyzeArtifacts(manifestJson, runResultsJson);
    const sourceRow = result.ganttData.find((row) => row.unique_id === sourceId);
    const sourceTests = result.ganttData.filter((row) => row.parentId === sourceId);
    const expectedStart = Math.min(...sourceTests.map((row) => row.start));
    const expectedEnd = Math.max(...sourceTests.map((row) => row.end));

    expect(sourceRow).toBeDefined();
    expect(sourceRow?.resourceType).toBe('source');
    expect(sourceRow?.start).toBe(expectedStart);
    expect(sourceRow?.end).toBe(expectedEnd);
    expect(sourceRow?.duration).toBe(expectedEnd - expectedStart);
    expect(sourceRow?.status).toBe('fail');
    expect(sourceRow?.compileStart).toBeNull();
    expect(sourceRow?.executeEnd).toBeNull();
    expect(sourceTests.map((row) => row.unique_id).sort()).toEqual([failTestId, passTestId].sort());
    expect(result.timelineAdjacency[sourceId]).toBeDefined();
  });

  it('synthesizes source rows from executed models that reference the source (no source run_results row)', async () => {
    const { manifestJson, runResultsJson } = loadBaseFixtures();
    const sourceId = 'source.jaffle_shop.ecom.raw_orders';
    const modelId = 'model.jaffle_shop.stg_orders';

    expect(
      runResultsJson.results.some((r: Record<string, unknown>) => r.unique_id === sourceId),
    ).toBe(false);

    const result = await analyzeArtifacts(manifestJson, runResultsJson);

    const modelRow = result.ganttData.find((row) => row.unique_id === modelId);
    const sourceRow = result.ganttData.find((row) => row.unique_id === sourceId);

    expect(modelRow).toBeDefined();
    expect(modelRow?.resourceType).toBe('model');
    expect(sourceRow).toBeDefined();
    expect(sourceRow?.resourceType).toBe('source');
    expect(sourceRow?.start).toBe(modelRow?.start);
    expect(sourceRow?.end).toBe(modelRow?.end);
    expect(sourceRow?.compileStart).toBeNull();
    expect(sourceRow?.executeStart).toBeNull();
    expect(result.timelineAdjacency[sourceId]).toBeDefined();
  });

  it('uses dominant execution package when manifest metadata.project_name mismatches packages', async () => {
    const { manifestJson, runResultsJson } = loadBaseFixtures();
    const sourceId = 'source.jaffle_shop.ecom.raw_orders';
    const meta = manifestJson.metadata as Record<string, unknown>;
    meta.project_name = 'wrong_metadata_project';

    const result = await analyzeArtifacts(manifestJson, runResultsJson);

    expect(result.projectName).toBe('jaffle_shop');
    const sourceRow = result.ganttData.find((row) => row.unique_id === sourceId);
    expect(sourceRow).toBeDefined();
    expect(sourceRow?.resourceType).toBe('source');
  });

  it('preserves snapshot rows and resolves snapshot and seed test parents', async () => {
    const { manifestJson, runResultsJson } = loadBaseFixtures();
    const snapshotId = 'snapshot.jaffle_shop.orders_snapshot';
    const snapshotTestId = 'test.jaffle_shop.not_null_orders_snapshot_order_id.synthetic';
    const seedTestId = 'test.jaffle_shop.not_null_raw_orders_order_id.synthetic_seed';

    manifestJson.nodes[snapshotId] = cloneManifestEntry(
      manifestJson,
      'seed.jaffle_shop.raw_orders',
      {
        unique_id: snapshotId,
        resource_type: 'snapshot',
        name: 'orders_snapshot',
        path: 'snapshots/orders_snapshot.sql',
        original_file_path: 'snapshots/orders_snapshot.sql',
        package_name: 'jaffle_shop',
        fqn: ['jaffle_shop', 'snapshots', 'orders_snapshot'],
        relation_name: '"jaffle_shop"."main"."orders_snapshot"',
        depends_on: {
          macros: [],
          nodes: ['source.jaffle_shop.ecom.raw_orders'],
        },
      },
    );
    manifestJson.nodes[snapshotTestId] = cloneManifestEntry(
      manifestJson,
      'test.jaffle_shop.not_null_orders_order_id.cf6c17daed',
      {
        unique_id: snapshotTestId,
        name: 'not_null_orders_snapshot_order_id',
        path: 'snapshots/orders_snapshot.yml',
        original_file_path: 'snapshots/orders_snapshot.yml',
        attached_node: snapshotId,
        depends_on: { macros: [], nodes: [snapshotId] },
      },
    );
    manifestJson.nodes[seedTestId] = cloneManifestEntry(
      manifestJson,
      'test.jaffle_shop.not_null_stg_orders_order_id.81cfe2fe64',
      {
        unique_id: seedTestId,
        name: 'not_null_raw_orders_order_id',
        path: 'seeds/raw_orders.yml',
        original_file_path: 'seeds/raw_orders.yml',
        attached_node: 'seed.jaffle_shop.raw_orders',
        depends_on: { macros: [], nodes: ['seed.jaffle_shop.raw_orders'] },
      },
    );

    manifestJson.parent_map[snapshotId] = ['source.jaffle_shop.ecom.raw_orders'];
    manifestJson.child_map['source.jaffle_shop.ecom.raw_orders'] = [
      ...(manifestJson.child_map['source.jaffle_shop.ecom.raw_orders'] ?? []),
      snapshotId,
    ];
    manifestJson.parent_map[snapshotTestId] = [snapshotId];
    manifestJson.child_map[snapshotId] = [snapshotTestId];
    manifestJson.parent_map[seedTestId] = ['seed.jaffle_shop.raw_orders'];
    manifestJson.child_map['seed.jaffle_shop.raw_orders'] = [
      ...(manifestJson.child_map['seed.jaffle_shop.raw_orders'] ?? []),
      seedTestId,
    ];

    runResultsJson.results.push(
      cloneResult(runResultsJson, 'seed.jaffle_shop.raw_orders', {
        unique_id: snapshotId,
        status: 'success',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:14.000Z',
            completed_at: '2024-12-16T07:45:14.100Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:14.100Z',
            completed_at: '2024-12-16T07:45:16.100Z',
          },
        ],
        execution_time: 2,
      }),
      cloneResult(runResultsJson, 'test.jaffle_shop.not_null_orders_order_id.cf6c17daed', {
        unique_id: snapshotTestId,
        status: 'pass',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:16.200Z',
            completed_at: '2024-12-16T07:45:16.300Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:16.300Z',
            completed_at: '2024-12-16T07:45:16.800Z',
          },
        ],
        execution_time: 0.5,
      }),
      cloneResult(runResultsJson, 'test.jaffle_shop.not_null_stg_orders_order_id.81cfe2fe64', {
        unique_id: seedTestId,
        status: 'pass',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:10.000Z',
            completed_at: '2024-12-16T07:45:10.100Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:10.100Z',
            completed_at: '2024-12-16T07:45:10.700Z',
          },
        ],
        execution_time: 0.6,
      }),
    );

    const result = await analyzeArtifacts(manifestJson, runResultsJson);
    const snapshotRow = result.ganttData.find((row) => row.unique_id === snapshotId);
    const snapshotTestRow = result.ganttData.find((row) => row.unique_id === snapshotTestId);
    const seedTestRow = result.ganttData.find((row) => row.unique_id === seedTestId);

    expect(snapshotRow?.resourceType).toBe('snapshot');
    expect(snapshotTestRow?.parentId).toBe(snapshotId);
    expect(seedTestRow?.parentId).toBe('seed.jaffle_shop.raw_orders');
  });
});
