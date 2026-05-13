import type { NodeExecution } from './execution-analyzer';
import type { ManifestGraph } from './manifest-graph';
import type { AdapterMetricSortKey } from './adapter-metric-descriptors';

/**
 * Criteria for filtering run results executions
 */
export interface RunResultsSearchCriteria {
  /** Min execution time in seconds */
  min_execution_time?: number;
  /** Max execution time in seconds */
  max_execution_time?: number;
  /** Filter by status: success, error, skipped, etc. */
  status?: string | string[];
  /** Glob or regex pattern for unique_id */
  unique_id_pattern?: string | RegExp;
  /** Limit number of results (for top-N queries) */
  limit?: number;
  /** Sort key */
  sort?:
    | 'execution_time_asc'
    | 'execution_time_desc'
    | 'unique_id'
    | 'bytes_processed_desc'
    | 'bytes_billed_desc'
    | 'slot_ms_desc'
    | 'rows_affected_desc'
    | 'rows_inserted_desc'
    | 'rows_updated_desc'
    | 'rows_deleted_desc'
    | 'rows_duplicated_desc'
    | 'query_id'
    | 'adapter_code'
    | 'adapter_message';
  /** Minimum bytes_processed from adapter_response (when present) */
  min_bytes_processed?: number;
  /** Minimum slot_ms from adapter_response (when present) */
  min_slot_ms?: number;
  /** Minimum rows_affected from adapter_response (when present) */
  min_rows_affected?: number;
  /** Require adapter_response to contain this top-level key */
  has_adapter_key?: string;
  /** Free text match against canonical adapter string fields */
  adapter_text?: string;
}

/**
 * Single bottleneck node in the result
 */
export interface BottleneckNode {
  unique_id: string;
  name?: string;
  execution_time: number;
  rank: number;
  pct_of_total: number;
  status: string;
}

/**
 * Result of bottleneck detection
 */
export interface BottleneckResult {
  nodes: BottleneckNode[];
  total_execution_time: number;
  criteria_used: 'top_n' | 'threshold';
}

/**
 * Simple glob match: * matches any chars. Avoids ReDoS from dynamic RegExp.
 */
function matchesGlob(text: string, pattern: string): boolean {
  const parts = pattern.split('*');
  if (parts.length === 1) return text === pattern;
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const idx = text.indexOf(part, pos);
    if (idx === -1) return false;
    if (i === 0 && idx !== 0) return false;
    pos = idx + part.length;
  }
  return parts[parts.length - 1] === '' || text.endsWith(parts[parts.length - 1]);
}

/**
 * Filter executions by unique_id pattern (glob or RegExp)
 */
function matchesUniqueId(uniqueId: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(uniqueId);
  }
  return matchesGlob(uniqueId, pattern);
}

const ADAPTER_METRIC_VALUE_ACCESSORS = {
  query_id: (execution: NodeExecution) => execution.adapterMetrics?.queryId ?? '',
  adapter_code: (execution: NodeExecution) => execution.adapterMetrics?.adapterCode ?? '',
  adapter_message: (execution: NodeExecution) => execution.adapterMetrics?.adapterMessage ?? '',
  bytes_processed: (execution: NodeExecution) => execution.adapterMetrics?.bytesProcessed,
  bytes_billed: (execution: NodeExecution) => execution.adapterMetrics?.bytesBilled,
  slot_ms: (execution: NodeExecution) => execution.adapterMetrics?.slotMs,
  rows_affected: (execution: NodeExecution) => execution.adapterMetrics?.rowsAffected,
  project_id: (execution: NodeExecution) => execution.adapterMetrics?.projectId,
  location: (execution: NodeExecution) => execution.adapterMetrics?.location,
  rows_inserted: (execution: NodeExecution) => execution.adapterMetrics?.rowsInserted,
  rows_updated: (execution: NodeExecution) => execution.adapterMetrics?.rowsUpdated,
  rows_deleted: (execution: NodeExecution) => execution.adapterMetrics?.rowsDeleted,
  rows_duplicated: (execution: NodeExecution) => execution.adapterMetrics?.rowsDuplicated,
} as const satisfies Record<
  AdapterMetricSortKey,
  (execution: NodeExecution) => number | string | undefined
>;

export function getAdapterMetricSortValue(
  execution: NodeExecution,
  sortKey: AdapterMetricSortKey,
): number | string | undefined {
  return ADAPTER_METRIC_VALUE_ACCESSORS[sortKey](execution);
}

function compareOptionalMetric(
  left: number | string | undefined,
  right: number | string | undefined,
): number {
  const leftMissing = left === undefined || left === '';
  const rightMissing = right === undefined || right === '';
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export type AdapterHeavyMetric =
  | 'bytes_processed'
  | 'bytes_billed'
  | 'slot_ms'
  | 'rows_affected'
  | 'rows_inserted'
  | 'rows_updated'
  | 'rows_deleted'
  | 'rows_duplicated';

/** Numeric adapter fields used for top-N, filters, and *_desc sorts (treat missing as 0). */
function adapterNumericHeavyOrZero(execution: NodeExecution, metric: AdapterHeavyMetric): number {
  const v = getAdapterMetricSortValue(execution, metric);
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
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

const NUMERIC_SORT_ACCESSORS = Object.fromEntries(
  ADAPTER_HEAVY_DESC_KEYS.map((m) => [
    `${m}_desc`,
    (e: NodeExecution) => adapterNumericHeavyOrZero(e, m),
  ]),
) as Record<
  | 'bytes_processed_desc'
  | 'bytes_billed_desc'
  | 'slot_ms_desc'
  | 'rows_affected_desc'
  | 'rows_inserted_desc'
  | 'rows_updated_desc'
  | 'rows_deleted_desc'
  | 'rows_duplicated_desc',
  (execution: NodeExecution) => number
>;

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

  const numericFilters: Array<{
    value: number | undefined;
    keep: (execution: NodeExecution, expected: number) => boolean;
  }> = [
    {
      value: criteria.min_execution_time,
      keep: (execution, expected) => (execution.execution_time ?? 0) >= expected,
    },
    {
      value: criteria.max_execution_time,
      keep: (execution, expected) => (execution.execution_time ?? 0) <= expected,
    },
    {
      value: criteria.min_bytes_processed,
      keep: (execution, expected) =>
        adapterNumericHeavyOrZero(execution, 'bytes_processed') >= expected,
    },
    {
      value: criteria.min_slot_ms,
      keep: (execution, expected) => adapterNumericHeavyOrZero(execution, 'slot_ms') >= expected,
    },
    {
      value: criteria.min_rows_affected,
      keep: (execution, expected) =>
        adapterNumericHeavyOrZero(execution, 'rows_affected') >= expected,
    },
  ];

  for (const filter of numericFilters) {
    if (filter.value === undefined) continue;
    result = result.filter((execution) => filter.keep(execution, filter.value!));
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

function sortRunResults(
  executions: NodeExecution[],
  sortKey: NonNullable<RunResultsSearchCriteria['sort']>,
): NodeExecution[] {
  return [...executions].sort((a, b) => {
    if (sortKey in NUMERIC_SORT_ACCESSORS) {
      const accessor = NUMERIC_SORT_ACCESSORS[sortKey as keyof typeof NUMERIC_SORT_ACCESSORS];
      return accessor(b) - accessor(a);
    }
    if (sortKey === 'query_id' || sortKey === 'adapter_code' || sortKey === 'adapter_message') {
      return compareOptionalMetric(
        getAdapterMetricSortValue(a, sortKey),
        getAdapterMetricSortValue(b, sortKey),
      );
    }
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

/**
 * Search and filter NodeExecution array by criteria.
 * Pure function: returns new array, no side effects.
 */
export function searchRunResults(
  executions: NodeExecution[],
  criteria: RunResultsSearchCriteria,
): NodeExecution[] {
  let result = applyRunResultsFilters(executions, criteria);

  const sortKey = criteria.sort;
  if (sortKey) {
    result = sortRunResults(result, sortKey);
  }

  // Limit
  if (criteria.limit !== undefined && criteria.limit >= 0) {
    result = result.slice(0, criteria.limit);
  }

  return result;
}

/**
 * Get display name for a node from the graph, or fallback to unique_id
 */
function getNodeName(uniqueId: string, graph?: ManifestGraph): string | undefined {
  if (!graph) return undefined;
  const g = graph.getGraph();
  if (!g.hasNode(uniqueId)) return undefined;
  const attrs = g.getNodeAttributes(uniqueId);
  return (attrs?.name as string) || undefined;
}

/**
 * Detect bottlenecks in execution results.
 * Uses searchRunResults internally for filtering.
 */
export function detectBottlenecks(
  executions: NodeExecution[],
  options:
    | {
        mode: 'top_n';
        top: number;
        graph?: ManifestGraph;
      }
    | {
        mode: 'threshold';
        min_seconds: number;
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

/**
 * Top-N nodes by an adapter-reported metric (bytes, slot ms, or rows affected).
 * Percentages use the sum of that metric across nodes with value &gt; 0.
 */
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
