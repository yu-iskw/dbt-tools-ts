// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';

import { ManifestGraph } from '../manifest/graph';

import { querySubgraphCost, SUBGRAPH_COST_MAX_NODES } from './subgraph-cost';

import type { ManifestGraph as ManifestGraphType } from '../manifest/graph';
import type { ExecutionRow } from '../snapshot/types';

function executionRow(uniqueId: string, executionTime: number): ExecutionRow {
  return {
    uniqueId,
    name: uniqueId,
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    status: 'success',
    statusTone: 'success',
    executionTime,
    threadId: null,
    start: null,
    end: null,
  };
}

describe('querySubgraphCost', () => {
  let graph: ManifestGraph;
  let rootId: string | null = null;

  beforeEach(() => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    graph = new ManifestGraph(manifest);

    const g = graph.getGraph();
    g.forEachNode((nodeId) => {
      if (rootId == null && g.outboundNeighbors(nodeId).length > 0) {
        rootId = nodeId;
      }
    });
  });

  it('sums execution_time for downstream closure', () => {
    if (rootId == null) return;

    const downstream = graph.getDownstream(rootId, 1);
    const executions: ExecutionRow[] = [
      {
        uniqueId: rootId,
        name: 'root',
        resourceType: 'model',
        packageName: 'pkg',
        path: null,
        status: 'success',
        statusTone: 'success',
        executionTime: 10,
        threadId: null,
        start: null,
        end: null,
      },
      ...downstream.map(({ nodeId }, i) => ({
        uniqueId: nodeId,
        name: nodeId,
        resourceType: 'model',
        packageName: 'pkg',
        path: null,
        status: 'success',
        statusTone: 'success' as const,
        executionTime: 5 + i,
        threadId: null,
        start: null,
        end: null,
      })),
    ];

    const result = querySubgraphCost(graph, executions, {
      uniqueId: rootId,
      direction: 'downstream',
      depth: 1,
      metric: 'execution_time',
    });

    expect(result.executed_node_count).toBeGreaterThan(0);
    expect(result.totals.execution_time).toBeGreaterThan(0);
    expect(result.top_contributors.length).toBeGreaterThan(0);
    expect(result.top_contributors[0].share_of_total).toBeGreaterThan(0);
    expect(result.totals_scope).toBe('complete');
    expect(result.truncated).toBe(false);
  });

  it('marks partial totals and keeps highest-metric nodes when truncated', () => {
    const heavyId = 'model.pkg.heavy';
    const lightId = 'model.pkg.light';
    const fillerIds = Array.from(
      { length: SUBGRAPH_COST_MAX_NODES + 2 },
      (_, i) => `model.pkg.filler_${i}`,
    );
    const allIds = [heavyId, lightId, ...fillerIds];

    const fakeGraph = {
      getDownstream: () => allIds.map((nodeId) => ({ nodeId, depth: 1 })),
      getUpstream: () => [],
      getGraph: () => ({
        hasNode: (id: string) => id === heavyId,
        getNodeAttributes: () => ({ resource_type: 'model' }),
      }),
    } as unknown as ManifestGraphType;

    const executions = [
      executionRow(heavyId, 10_000),
      executionRow(lightId, 1),
      ...fillerIds.map((id, i) => executionRow(id, 2 + i)),
    ];

    const result = querySubgraphCost(fakeGraph, executions, {
      uniqueId: heavyId,
      direction: 'downstream',
      metric: 'execution_time',
    });

    expect(result.truncated).toBe(true);
    expect(result.totals_scope).toBe('partial');
    expect(result.node_count).toBe(SUBGRAPH_COST_MAX_NODES);
    expect(result.top_contributors.some((c) => c.unique_id === heavyId)).toBe(true);
    expect(result.top_contributors.some((c) => c.unique_id === lightId)).toBe(false);
  });
});
