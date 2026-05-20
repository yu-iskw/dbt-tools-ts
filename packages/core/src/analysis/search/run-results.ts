import { getObjectProperty, setObjectProperty } from '../../util/typed-map';

import {
  COMMON_EXECUTION_SORTS,
  executionRowToNodeExecution,
  filterExecutionRowsByResourceTypes,
  resolveWarehouseSearchPlan,
} from './warehouse';

import type {
  AdapterHeavyMetric,
  BottleneckNode,
  BottleneckResult,
  CommonExecutionSort,
  ExecutionSortKey,
  QueryExecutionsRequest,
  RunResultsSearchCriteria,
  WarehouseAdapterType,
  WarehouseSearchBlock,
} from './types';
import type { AdapterMetricSortKey } from '../adapter/descriptors';
import type { AdapterResponseMetrics } from '../adapter/metrics';
import type { NodeExecution } from '../execution/analyzer';
import type { ManifestGraph } from '../manifest/graph';
import type { ExecutionRow } from '../snapshot/types';

/**
 * Simple glob match: * matches any chars. Avoids ReDoS from dynamic RegExp.
 */
function matchesGlob(text: string, pattern: string): boolean {
  const parts = pattern.split('*');
  if (parts.length === 1) return text === pattern;
  let pos = 0;
  let first = true;
  for (const part of parts) {
    const idx = text.indexOf(part, pos);
    if (idx === -1) return false;
    if (first && idx !== 0) return false;
    first = false;
    pos = idx + part.length;
  }
  const lastPart = parts[parts.length - 1];
  return lastPart === '' || text.endsWith(lastPart);
}

function matchesUniqueId(uniqueId: string, pattern: RegExp | string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(uniqueId);
  }
  return matchesGlob(uniqueId, pattern);
}

const ADAPTER_METRIC_SORT_FNS = new Map<
  AdapterMetricSortKey,
  (execution: NodeExecution) => number | string | undefined
>([
  ['query_id', (execution) => execution.adapterMetrics?.queryId ?? ''],
  ['adapter_code', (execution) => execution.adapterMetrics?.adapterCode ?? ''],
  ['adapter_message', (execution) => execution.adapterMetrics?.adapterMessage ?? ''],
  ['bytes_processed', (execution) => execution.adapterMetrics?.bytesProcessed],
  ['bytes_billed', (execution) => execution.adapterMetrics?.bytesBilled],
  ['slot_ms', (execution) => execution.adapterMetrics?.slotMs],
  ['rows_affected', (execution) => execution.adapterMetrics?.rowsAffected],
  ['project_id', (execution) => execution.adapterMetrics?.projectId],
  ['location', (execution) => execution.adapterMetrics?.location],
  ['rows_inserted', (execution) => execution.adapterMetrics?.rowsInserted],
  ['rows_updated', (execution) => execution.adapterMetrics?.rowsUpdated],
  ['rows_deleted', (execution) => execution.adapterMetrics?.rowsDeleted],
  ['rows_duplicated', (execution) => execution.adapterMetrics?.rowsDuplicated],
]);

export function getAdapterMetricSortValue(
  execution: NodeExecution,
  sortKey: AdapterMetricSortKey,
): number | string | undefined {
  return ADAPTER_METRIC_SORT_FNS.get(sortKey)?.(execution);
}

const ADAPTER_HEAVY_DESC_KEYS = [
  'bytes_processed',
  'bytes_billed',
  'slot_ms',
  'rows_affected',
  'rows_inserted',
  'rows_updated',
  'rows_deleted',
  'rows_duplicated',
] as const satisfies readonly AdapterHeavyMetric[];

function adapterNumericHeavyOrZero(execution: NodeExecution, metric: AdapterHeavyMetric): number {
  const v = getAdapterMetricSortValue(execution, metric);
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

const NUMERIC_SORT_KEY_TO_METRIC = new Map<ExecutionSortKey, AdapterHeavyMetric>(
  ADAPTER_HEAVY_DESC_KEYS.map((m) => [`${m}_desc` as ExecutionSortKey, m]),
);

function adapterTextMatches(execution: NodeExecution, token: string): boolean {
  const metrics = execution.adapterMetrics;
  if (metrics == null) return false;
  return [
    metrics.queryId,
    metrics.adapterCode,
    metrics.adapterMessage,
    metrics.projectId,
    metrics.location,
  ].some((value) => value?.toLowerCase().includes(token) === true);
}

function applyRunResultsFilters(
  executions: NodeExecution[],
  criteria: RunResultsSearchCriteria,
): NodeExecution[] {
  let result = [...executions];

  if (criteria.status !== undefined) {
    const statuses = typeof criteria.status === 'string' ? [criteria.status] : criteria.status;
    const set = new Set(statuses.map((s) => s.toLowerCase()));
    result = result.filter((e) => set.has((e.status || 'unknown').toLowerCase()));
  }

  if (criteria.min_execution_time !== undefined) {
    result = result.filter((e) => (e.execution_time ?? 0) >= criteria.min_execution_time!);
  }
  if (criteria.max_execution_time !== undefined) {
    result = result.filter((e) => (e.execution_time ?? 0) <= criteria.max_execution_time!);
  }

  if (criteria.unique_id_pattern !== undefined) {
    result = result.filter((e) => matchesUniqueId(e.unique_id, criteria.unique_id_pattern!));
  }
  if (criteria.has_adapter_key !== undefined) {
    result = result.filter(
      (e) => e.adapterMetrics?.rawKeys.includes(criteria.has_adapter_key!) === true,
    );
  }
  if (criteria.adapter_text !== undefined && criteria.adapter_text.trim() !== '') {
    const token = criteria.adapter_text.toLowerCase();
    result = result.filter((e) => adapterTextMatches(e, token));
  }

  return result;
}

function sortByCommonExecutionSort(
  executions: NodeExecution[],
  sortKey: CommonExecutionSort,
): NodeExecution[] {
  return [...executions].sort((a, b) => {
    switch (sortKey) {
      case 'execution_time_asc':
        return (a.execution_time ?? 0) - (b.execution_time ?? 0);
      case 'execution_time_desc':
        return (b.execution_time ?? 0) - (a.execution_time ?? 0);
      case 'unique_id':
        return a.unique_id.localeCompare(b.unique_id);
      default:
        return 0;
    }
  });
}

export function sortByExecutionSortKey(
  executions: NodeExecution[],
  sortKey: ExecutionSortKey,
): NodeExecution[] {
  if (COMMON_EXECUTION_SORTS.includes(sortKey as CommonExecutionSort)) {
    return sortByCommonExecutionSort(executions, sortKey as CommonExecutionSort);
  }

  return [...executions].sort((a, b) => {
    const metric = NUMERIC_SORT_KEY_TO_METRIC.get(sortKey);
    if (metric != null) {
      return adapterNumericHeavyOrZero(b, metric) - adapterNumericHeavyOrZero(a, metric);
    }
    return 0;
  });
}

const MIN_FIELD_TO_METRIC: Record<string, AdapterHeavyMetric> = {
  minSlotMs: 'slot_ms',
  minBytesProcessed: 'bytes_processed',
  minBytesBilled: 'bytes_billed',
  minRowsAffected: 'rows_affected',
  minRowsInserted: 'rows_inserted',
  minRowsUpdated: 'rows_updated',
  minRowsDeleted: 'rows_deleted',
  minRowsDuplicated: 'rows_duplicated',
};

function applyMinFields(
  executions: NodeExecution[],
  criteria: Record<string, unknown>,
): NodeExecution[] {
  let result = executions;
  for (const [field, metric] of Object.entries(MIN_FIELD_TO_METRIC)) {
    const min = getObjectProperty(criteria, field);
    if (typeof min !== 'number') continue;
    result = result.filter((e) => adapterNumericHeavyOrZero(e, metric) >= min);
  }
  return result;
}

export function applyWarehouseSearchBlock(
  executions: NodeExecution[],
  block: WarehouseSearchBlock,
): NodeExecution[] {
  return applyMinFields(executions, block.criteria as Record<string, unknown>);
}

/**
 * Filter executions by adapter metric minimums (for legacy CLI paths without a warehouse block).
 */
export function filterAdapterMetricMins(
  executions: NodeExecution[],
  mins: Partial<Record<keyof typeof MIN_FIELD_TO_METRIC, number>>,
): NodeExecution[] {
  const criteria: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(mins)) {
    if (value !== undefined) {
      setObjectProperty(criteria, field, value);
    }
  }
  return applyMinFields(executions, criteria);
}

/**
 * Search and filter NodeExecution array by execution-level criteria only.
 */
export function searchRunResults(
  executions: NodeExecution[],
  criteria: RunResultsSearchCriteria,
): NodeExecution[] {
  let result = applyRunResultsFilters(executions, criteria);

  if (criteria.sort) {
    result = sortByCommonExecutionSort(result, criteria.sort);
  }

  if (criteria.limit !== undefined && criteria.limit >= 0) {
    result = result.slice(0, criteria.limit);
  }

  return result;
}

function getNodeName(uniqueId: string, graph?: ManifestGraph): string | undefined {
  if (!graph) return undefined;
  const g = graph.getGraph();
  if (!g.hasNode(uniqueId)) return undefined;
  const attrs = g.getNodeAttributes(uniqueId);
  return (attrs?.name as string) || undefined;
}

export function detectBottlenecks(
  executions: NodeExecution[],
  options:
    | {
        mode: 'threshold';
        min_seconds: number;
        graph?: ManifestGraph;
      }
    | {
        mode: 'top_n';
        top: number;
        graph?: ManifestGraph;
      },
): BottleneckResult {
  const totalExecutionTime = executions.reduce((sum, e) => sum + (e.execution_time ?? 0), 0);

  let filtered: NodeExecution[];

  if (options.mode === 'top_n') {
    filtered = searchRunResults(executions, {
      sort: 'execution_time_desc',
      limit: options.top,
    });
  } else {
    filtered = searchRunResults(executions, {
      min_execution_time: options.min_seconds,
      sort: 'execution_time_desc',
    });
  }

  const nodes: BottleneckNode[] = filtered.map((e, i) => {
    const time = e.execution_time ?? 0;
    const pct = totalExecutionTime > 0 ? (time / totalExecutionTime) * 100 : 0;
    return {
      unique_id: e.unique_id,
      name: getNodeName(e.unique_id, options.graph),
      execution_time: time,
      rank: i + 1,
      pct_of_total: Math.round(pct * 10) / 10,
      status: e.status || 'unknown',
    };
  });

  return {
    nodes,
    total_execution_time: totalExecutionTime,
    criteria_used: options.mode === 'top_n' ? 'top_n' : 'threshold',
  };
}

export interface AdapterHeavyNode {
  unique_id: string;
  name?: string;
  metric_value: number;
  rank: number;
  pct_of_total: number;
  status: string;
  execution_time: number;
}

export interface AdapterHeavyResult {
  metric: AdapterHeavyMetric;
  nodes: AdapterHeavyNode[];
  total_metric: number;
  criteria_used: 'top_n';
}

export interface QueryExecutionsResultRow {
  unique_id: string;
  name?: string;
  resource_type?: string;
  status: string;
  execution_time: number;
  adapter_metrics?: AdapterResponseMetrics;
}

export interface QueryExecutionsOutput {
  warehouse: WarehouseAdapterType | 'unknown';
  run_warehouse: WarehouseAdapterType | 'unknown';
  warehouse_criteria: Record<string, unknown> | null;
  resource_types: string[];
  sort: ExecutionSortKey;
  limit: number;
  offset: number;
  total_matched: number;
  returned: number;
  has_more: boolean;
  allowed_sorts?: string[];
  allowed_min_filters?: string[];
  rows: QueryExecutionsResultRow[];
}

function resourceTypeForQuery(uniqueId: string, graph?: ManifestGraph): string | undefined {
  const attrs = graph?.getGraph().getNodeAttributes(uniqueId);
  const rt = attrs?.resource_type;
  if (rt != null) return String(rt);
  return uniqueId.split('.')[0];
}

export function queryExecutions(
  executionRows: ExecutionRow[],
  request: QueryExecutionsRequest,
  options: { warehouseType?: string | null; graph?: ManifestGraph },
): QueryExecutionsOutput {
  const plan = resolveWarehouseSearchPlan(request, {
    warehouseType: options.warehouseType,
    graph: options.graph,
  });

  let filtered = filterExecutionRowsByResourceTypes(executionRows, plan.resourceTypes);

  if (plan.status != null && plan.status.length > 0) {
    const statusSet = new Set(plan.status);
    filtered = filtered.filter((row) => statusSet.has(row.status.toLowerCase()));
  }

  let matched = searchRunResults(filtered.map(executionRowToNodeExecution), plan.base);
  if (plan.activeWarehouseBlock != null) {
    matched = applyWarehouseSearchBlock(matched, plan.activeWarehouseBlock);
  }
  matched = sortByExecutionSortKey(matched, plan.effectiveSort);

  const totalMatched = matched.length;
  const page = matched.slice(plan.offset, plan.offset + plan.limit);

  const rows: QueryExecutionsResultRow[] = page.map((execution) => ({
    unique_id: execution.unique_id,
    name: getNodeName(execution.unique_id, options.graph),
    resource_type: resourceTypeForQuery(execution.unique_id, options.graph),
    status: execution.status || 'unknown',
    execution_time: execution.execution_time ?? 0,
    ...(execution.adapterMetrics != null ? { adapter_metrics: execution.adapterMetrics } : {}),
  }));

  const profile = plan.profile;
  const warehouseCriteria =
    plan.activeWarehouseBlock != null
      ? (plan.activeWarehouseBlock.criteria as Record<string, unknown>)
      : null;

  return {
    warehouse: plan.warehouse,
    run_warehouse: plan.runWarehouse,
    warehouse_criteria: warehouseCriteria,
    resource_types: plan.resourceTypes,
    sort: plan.effectiveSort,
    limit: plan.limit,
    offset: plan.offset,
    total_matched: totalMatched,
    returned: rows.length,
    has_more: plan.offset + rows.length < totalMatched,
    allowed_sorts:
      profile != null
        ? [...COMMON_EXECUTION_SORTS, ...profile.allowedSorts]
        : [...COMMON_EXECUTION_SORTS],
    ...(profile != null ? { allowed_min_filters: [...profile.allowedMinFields] } : {}),
    rows,
  };
}

export function detectAdapterHeavyNodes(
  executions: NodeExecution[],
  options: {
    metric: AdapterHeavyMetric;
    top: number;
    graph?: ManifestGraph;
  },
): AdapterHeavyResult {
  const m = options.metric;
  const totalMetric = executions.reduce(
    (sum, e) => sum + Math.max(0, adapterNumericHeavyOrZero(e, m)),
    0,
  );

  const topN = options.top > 0 ? options.top : 10;
  const positive = executions.filter((e) => adapterNumericHeavyOrZero(e, m) > 0);
  const sorted = [...positive].sort(
    (a, b) => adapterNumericHeavyOrZero(b, m) - adapterNumericHeavyOrZero(a, m),
  );
  const filtered = sorted.slice(0, topN);

  const nodes: AdapterHeavyNode[] = filtered.map((e, i) => {
    const value = adapterNumericHeavyOrZero(e, m);
    const pct = totalMetric > 0 ? (value / totalMetric) * 100 : 0;
    return {
      unique_id: e.unique_id,
      name: getNodeName(e.unique_id, options.graph),
      metric_value: value,
      rank: i + 1,
      pct_of_total: Math.round(pct * 10) / 10,
      status: e.status || 'unknown',
      execution_time: e.execution_time ?? 0,
    };
  });

  return {
    metric: options.metric,
    nodes,
    total_metric: totalMetric,
    criteria_used: 'top_n',
  };
}
