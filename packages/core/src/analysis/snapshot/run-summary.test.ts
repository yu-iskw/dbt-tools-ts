import { describe, it, expect } from 'vitest';

import { getRunSummaryFromSnapshot } from './run-summary';

import type { AnalysisSnapshot } from './types';

/** Documented ceiling for MCP get_run_summary — must never embed full node lists. */
const RUN_SUMMARY_MAX_JSON_BYTES = 256 * 1024;

function minimalSnapshot(nodeCount: number): AnalysisSnapshot {
  const executions = Array.from({ length: nodeCount }, (_, i) => ({
    uniqueId: `model.pkg.model_${i}`,
    name: `model_${i}`,
    resourceType: 'model',
    packageName: 'pkg',
    path: `models/m_${i}.sql`,
    status: 'success',
    statusTone: 'success' as const,
    executionTime: 1 + (i % 10),
    threadId: null,
    start: i * 1000,
    end: i * 1000 + 500,
  }));

  return {
    summary: {
      total_nodes: nodeCount,
      executed_nodes: nodeCount,
      skipped_nodes: 0,
      failed_nodes: 0,
      total_execution_time: nodeCount,
      node_executions: [],
    },
    statusBreakdown: { success: nodeCount },
    bottlenecks: {
      nodes: executions.slice(0, 5).map((e, rank) => ({
        unique_id: e.uniqueId,
        name: e.name,
        execution_time: e.executionTime,
        rank: rank + 1,
        pct_of_total: 10,
        status: 'success',
      })),
      total_execution_time: nodeCount,
      criteria_used: 'top_n',
    },
    adapterTotals: null,
    warehouseType: 'bigquery',
    resources: [],
    dependencyIndex: new Map(),
    executions,
    ganttData: [],
    timelineGanttData: [],
    timelineAdjacency: new Map(),
    graphSummary: {
      node_count: nodeCount,
      edge_count: 0,
      model_count: nodeCount,
      source_count: 0,
      test_count: 0,
    },
    runStartedAt: 0,
    timing: { graphBuildMs: 0, snapshotBuildMs: 0 },
  } as unknown as AnalysisSnapshot;
}

describe('getRunSummaryFromSnapshot', () => {
  it('stays under documented JSON size for large runs', () => {
    const output = getRunSummaryFromSnapshot(minimalSnapshot(2000));
    const bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
    expect(bytes).toBeLessThan(RUN_SUMMARY_MAX_JSON_BYTES);
    expect(output.summary.node_executions).toEqual([]);
  });

  it('labels adapter bottleneck nodes with metric_value and total_metric', () => {
    const snapshot = minimalSnapshot(3);
    snapshot.executions = snapshot.executions.map((row, i) => ({
      ...row,
      adapterMetrics: {
        rawKeys: ['slot_ms'],
        slotMs: (i + 1) * 1_000_000,
      },
    }));

    const output = getRunSummaryFromSnapshot(snapshot, {
      bottleneck: { metric: 'slot_ms', topN: 2 },
    });

    expect(output.bottlenecks?.metric).toBe('slot_ms');
    expect(output.bottlenecks?.total_metric).toBeGreaterThan(0);
    expect(output.bottlenecks?.nodes[0]?.metric_value).toBeGreaterThan(0);
    expect(output.bottlenecks?.nodes[0]?.execution_time).toBeDefined();
  });
});
