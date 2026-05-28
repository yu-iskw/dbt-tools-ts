import { FORENSICS_MAX_NODES } from '../forensics/limits';
import {
  adapterNumericHeavyOrZero,
  detectAdapterHeavyNodes,
  detectBottlenecks,
} from '../search/run-results';
import { executionRowToNodeExecution } from '../search/warehouse';

import type { ManifestGraph } from '../manifest/graph';
import type { ExecutionRow } from '../snapshot/types';

/** @deprecated Use FORENSICS_MAX_NODES */
export { FORENSICS_MAX_NODES as SUBGRAPH_COST_MAX_NODES } from '../forensics/limits';

export const SUBGRAPH_COST_TOP_CONTRIBUTORS = 10;

export type SubgraphCostMetric = 'bytes_processed' | 'execution_time' | 'slot_ms';
export type SubgraphCostTotalsScope = 'complete' | 'partial';

export interface QuerySubgraphCostInput {
  uniqueId: string;
  direction: 'downstream' | 'upstream';
  depth?: number;
  resourceTypes?: string[];
  metric: SubgraphCostMetric;
}

export interface SubgraphCostContributor {
  unique_id: string;
  name?: string;
  metric_value: number;
  share_of_total: number;
}

export interface SubgraphCostOutput {
  root_unique_id: string;
  direction: 'downstream' | 'upstream';
  metric: SubgraphCostMetric;
  node_count: number;
  executed_node_count: number;
  truncated: boolean;
  totals_scope: SubgraphCostTotalsScope;
  totals: {
    slot_ms: number;
    bytes_processed: number;
    execution_time: number;
  };
  top_contributors: SubgraphCostContributor[];
  not_executed: string[];
}

function executionByIdFromInput(
  executions: ExecutionRow[] | Map<string, ExecutionRow>,
): Map<string, ExecutionRow> {
  if (executions instanceof Map) return executions;
  return new Map(executions.map((row) => [row.uniqueId, row]));
}

function rowMetricTotals(row: ExecutionRow): {
  slot_ms: number;
  bytes_processed: number;
  execution_time: number;
} {
  const execution = executionRowToNodeExecution(row);
  return {
    execution_time: row.executionTime ?? 0,
    slot_ms: adapterNumericHeavyOrZero(execution, 'slot_ms'),
    bytes_processed: adapterNumericHeavyOrZero(execution, 'bytes_processed'),
  };
}

function metricValueFromTotals(
  metric: SubgraphCostMetric,
  totals: { slot_ms: number; bytes_processed: number; execution_time: number },
): number {
  if (metric === 'slot_ms') return totals.slot_ms;
  if (metric === 'bytes_processed') return totals.bytes_processed;
  return totals.execution_time;
}

function metricValueForNode(
  uniqueId: string,
  metric: SubgraphCostMetric,
  executionById: Map<string, ExecutionRow>,
): number {
  const row = executionById.get(uniqueId);
  if (row == null) return 0;
  return metricValueFromTotals(metric, rowMetricTotals(row));
}

function rankNodeIdsByMetric(
  nodeIds: string[],
  metric: SubgraphCostMetric,
  executionById: Map<string, ExecutionRow>,
): string[] {
  const metricById = new Map(
    nodeIds.map((id) => [id, metricValueForNode(id, metric, executionById)] as const),
  );
  return [...nodeIds].sort((a, b) => (metricById.get(b) ?? 0) - (metricById.get(a) ?? 0));
}

function resolveSubgraphNodeIds(
  graph: ManifestGraph,
  input: QuerySubgraphCostInput,
  executionById: Map<string, ExecutionRow>,
): { nodeIds: string[]; truncated: boolean } {
  let nodeIds = graph.collectSubgraphNodeIds(
    input.uniqueId,
    input.direction,
    input.depth,
    input.resourceTypes,
  );

  const truncated = nodeIds.length > FORENSICS_MAX_NODES;
  if (truncated) {
    nodeIds = rankNodeIdsByMetric(nodeIds, input.metric, executionById).slice(
      0,
      FORENSICS_MAX_NODES,
    );
  }
  return { nodeIds, truncated };
}

function aggregateSubgraphExecutions(
  nodeIds: string[],
  executionById: Map<string, ExecutionRow>,
): {
  notExecuted: string[];
  executedNodeCount: number;
  totals: { slot_ms: number; bytes_processed: number; execution_time: number };
} {
  const notExecuted: string[] = [];
  let executedNodeCount = 0;
  let totalSlotMs = 0;
  let totalBytesProcessed = 0;
  let totalExecutionTime = 0;

  for (const uniqueId of nodeIds) {
    const row = executionById.get(uniqueId);
    if (row == null) {
      notExecuted.push(uniqueId);
      continue;
    }
    executedNodeCount += 1;
    const rowTotals = rowMetricTotals(row);
    totalSlotMs += rowTotals.slot_ms;
    totalBytesProcessed += rowTotals.bytes_processed;
    totalExecutionTime += rowTotals.execution_time;
  }

  return {
    notExecuted,
    executedNodeCount,
    totals: {
      slot_ms: totalSlotMs,
      bytes_processed: totalBytesProcessed,
      execution_time: totalExecutionTime,
    },
  };
}

function shareFromPct(pctOfTotal: number): number {
  return Math.round((pctOfTotal / 100) * 1000) / 1000;
}

function buildTopContributors(
  nodeIds: string[],
  executionById: Map<string, ExecutionRow>,
  metric: SubgraphCostMetric,
): SubgraphCostContributor[] {
  const nodeExecutions = nodeIds
    .map((id) => executionById.get(id))
    .filter((row): row is ExecutionRow => row != null)
    .map(executionRowToNodeExecution);

  if (metric === 'execution_time') {
    const heavy = detectBottlenecks(nodeExecutions, {
      mode: 'top_n',
      top: SUBGRAPH_COST_TOP_CONTRIBUTORS,
    });
    return heavy.nodes.map((node) => ({
      unique_id: node.unique_id,
      name: node.name,
      metric_value: node.execution_time,
      share_of_total: shareFromPct(node.pct_of_total),
    }));
  }

  const adapterMetric = metric === 'slot_ms' ? 'slot_ms' : 'bytes_processed';
  const heavy = detectAdapterHeavyNodes(nodeExecutions, {
    metric: adapterMetric,
    top: SUBGRAPH_COST_TOP_CONTRIBUTORS,
  });
  return heavy.nodes.map((node) => ({
    unique_id: node.unique_id,
    name: node.name,
    metric_value: node.metric_value,
    share_of_total: shareFromPct(node.pct_of_total),
  }));
}

export function querySubgraphCost(
  graph: ManifestGraph,
  executions: ExecutionRow[] | Map<string, ExecutionRow>,
  input: QuerySubgraphCostInput,
): SubgraphCostOutput {
  const executionById = executionByIdFromInput(executions);
  const { nodeIds, truncated } = resolveSubgraphNodeIds(graph, input, executionById);
  const { notExecuted, executedNodeCount, totals } = aggregateSubgraphExecutions(
    nodeIds,
    executionById,
  );
  const topContributors = buildTopContributors(nodeIds, executionById, input.metric);

  return {
    root_unique_id: input.uniqueId,
    direction: input.direction,
    metric: input.metric,
    node_count: nodeIds.length,
    executed_node_count: executedNodeCount,
    truncated,
    totals_scope: truncated ? 'partial' : 'complete',
    totals,
    top_contributors: topContributors,
    not_executed: notExecuted,
  };
}
