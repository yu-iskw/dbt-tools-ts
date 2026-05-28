import { detectAdapterHeavyNodes, detectBottlenecks } from '../search/run-results';
import {
  executionRowToNodeExecution,
  filterExecutionRowsByResourceTypes,
  normalizeWarehouseAdapterType,
} from '../search/warehouse';

import type { AnalysisSnapshot } from './types';
import type { AdapterTotalsSnapshot } from '../adapter/metrics';
import type { BottleneckResult, WarehouseAdapterType } from '../search/types';

export interface RunSummaryBottleneckOptions {
  metric?: 'bytes_processed' | 'execution_time' | 'slot_ms';
  topN?: number;
  resourceTypes?: string[];
}

export interface RunSummaryOptions {
  bottleneck?: RunSummaryBottleneckOptions;
}

export interface RunSummaryOutput {
  summary: AnalysisSnapshot['summary'];
  statusBreakdown: AnalysisSnapshot['statusBreakdown'];
  bottlenecks: AnalysisSnapshot['bottlenecks'];
  adapterTotals: AdapterTotalsSnapshot | null;
  warehouse_type: WarehouseAdapterType | 'unknown';
}

function buildBottlenecks(
  snapshot: AnalysisSnapshot,
  options: RunSummaryBottleneckOptions,
): BottleneckResult | undefined {
  const rows =
    options.resourceTypes != null && options.resourceTypes.length > 0
      ? filterExecutionRowsByResourceTypes(
          snapshot.executions,
          options.resourceTypes.map((t) => t.toLowerCase()),
        )
      : snapshot.executions;
  if (rows.length === 0) return undefined;

  const nodeExecutions = rows.map(executionRowToNodeExecution);
  const metric = options.metric ?? 'execution_time';
  const topN = options.topN ?? 5;

  if (metric === 'execution_time') {
    return {
      ...detectBottlenecks(nodeExecutions, {
        mode: 'top_n',
        top: topN,
      }),
      metric: 'execution_time',
    };
  }

  const adapterMetric = metric === 'slot_ms' ? 'slot_ms' : 'bytes_processed';
  const heavy = detectAdapterHeavyNodes(nodeExecutions, {
    metric: adapterMetric,
    top: topN,
  });

  const wallClockTotal = heavy.nodes.reduce((sum, node) => sum + node.execution_time, 0);

  return {
    metric: adapterMetric,
    nodes: heavy.nodes.map((node) => ({
      unique_id: node.unique_id,
      name: node.name,
      execution_time: node.execution_time,
      metric_value: node.metric_value,
      rank: node.rank,
      pct_of_total: node.pct_of_total,
      status: node.status,
    })),
    total_execution_time: wallClockTotal,
    total_metric: heavy.total_metric,
    criteria_used: 'top_n',
  };
}

function hasBottleneckOptions(options: RunSummaryBottleneckOptions): boolean {
  return (
    options.metric != null ||
    options.topN != null ||
    (options.resourceTypes != null && options.resourceTypes.length > 0)
  );
}

export function getRunSummaryFromSnapshot(
  snapshot: AnalysisSnapshot,
  options?: RunSummaryOptions,
): RunSummaryOutput {
  const bottleneckOpts = options?.bottleneck;
  const bottlenecks =
    bottleneckOpts != null && hasBottleneckOptions(bottleneckOpts)
      ? buildBottlenecks(snapshot, bottleneckOpts)
      : snapshot.bottlenecks;

  return {
    summary: snapshot.summary,
    statusBreakdown: snapshot.statusBreakdown,
    bottlenecks,
    adapterTotals: snapshot.adapterTotals ?? null,
    warehouse_type: normalizeWarehouseAdapterType(snapshot.warehouseType),
  };
}
