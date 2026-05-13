import type {
  AnalysisState,
  ExecutionRow,
  StatusBreakdownItem,
  StatusTone,
  ThreadStat,
} from '@web/types';
import type { OverviewFilterState } from './types';
import { TEST_RESOURCE_TYPES } from './constants';
import {
  isFailedModelExecution,
  matchesExecution,
  matchesExecutionRowDashboardStatus,
} from './utils';

export interface OverviewDerivedState {
  filteredExecutions: ExecutionRow[];
  /** Same query + Types slice as `filteredExecutions`, but dashboard status treated as All (for execution-breakdown % denominators). */
  baselineExecutionsForBreakdown: ExecutionRow[];
  filteredStatusBreakdown: StatusBreakdownItem[];
  filteredThreadStats: ThreadStat[];
  filteredTypes: string[];
  failingNodes: number;
  warningNodes: number;
  failedModels: number;
  passingTests: number;
  failingTests: number;
  threadCount: number;
  filteredExecutionTime: number;
  topFailures: ExecutionRow[];
  topBottlenecks: ExecutionRow[];
}

export interface TypeStatusBreakdown {
  resourceType: string;
  /** Visible row count in the status-filtered slice (bar flex uses per-status counts from this set). */
  count: number;
  duration: number;
  /** Baseline row count for this type in the slice ignoring dashboard status (denominator for shares and of-N tooltips). */
  rowDenominatorCount: number;
  statusBreakdown: StatusBreakdownItem[];
}

function filterExecutionsForOverviewSlice(
  executions: ExecutionRow[],
  filters: OverviewFilterState,
  includeDashboardStatus: boolean,
): ExecutionRow[] {
  return executions.filter((row) => {
    if (includeDashboardStatus && !matchesExecutionRowDashboardStatus(row, filters.status)) {
      return false;
    }
    if (filters.resourceTypes.size > 0 && !filters.resourceTypes.has(row.resourceType)) {
      return false;
    }
    return matchesExecution(row, filters.query);
  });
}

export function buildStatusBreakdownForRows(
  executions: ExecutionRow[],
  options?: { denominatorTotal?: number },
): StatusBreakdownItem[] {
  const denominatorTotal = options?.denominatorTotal ?? executions.length;
  const byStatus = new Map<string, { count: number; duration: number; tone: StatusTone }>();
  for (const row of executions) {
    const current = byStatus.get(row.status) ?? {
      count: 0,
      duration: 0,
      tone: row.statusTone,
    };
    current.count += 1;
    current.duration += row.executionTime;
    byStatus.set(row.status, current);
  }
  return [...byStatus.entries()]
    .map(([status, value]) => ({
      status,
      count: value.count,
      duration: value.duration,
      share: denominatorTotal > 0 ? value.count / denominatorTotal : 0,
      tone: value.tone,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Groups visible executions by resource type; status shares use per-type counts from
 * `baselineExecutions` (query + Types only) so dashboard status filters do not renormalize to 100%.
 */
export function buildTypeStatusBreakdowns(
  visibleExecutions: ExecutionRow[],
  baselineExecutions: ExecutionRow[],
): TypeStatusBreakdown[] {
  const baselineCountByType = new Map<string, number>();
  for (const row of baselineExecutions) {
    baselineCountByType.set(row.resourceType, (baselineCountByType.get(row.resourceType) ?? 0) + 1);
  }

  const rowsByType = new Map<string, ExecutionRow[]>();
  for (const row of visibleExecutions) {
    const current = rowsByType.get(row.resourceType) ?? [];
    current.push(row);
    rowsByType.set(row.resourceType, current);
  }

  return [...rowsByType.entries()]
    .map(([resourceType, rows]) => {
      const rowDenominatorCount = baselineCountByType.get(resourceType) ?? 0;
      return {
        resourceType,
        count: rows.length,
        duration: rows.reduce((sum, row) => sum + row.executionTime, 0),
        rowDenominatorCount,
        statusBreakdown: buildStatusBreakdownForRows(rows, {
          denominatorTotal: rowDenominatorCount,
        }),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function buildThreadStatsForRows(executions: ExecutionRow[]): ThreadStat[] {
  const byThread = new Map<string, { count: number; totalExecutionTime: number }>();
  for (const row of executions) {
    const threadId = row.threadId ?? 'unknown';
    const current = byThread.get(threadId) ?? {
      count: 0,
      totalExecutionTime: 0,
    };
    current.count += 1;
    current.totalExecutionTime += row.executionTime;
    byThread.set(threadId, current);
  }
  return [...byThread.entries()]
    .map(([threadId, value]) => ({
      threadId,
      count: value.count,
      totalExecutionTime: value.totalExecutionTime,
    }))
    .sort((a, b) => b.totalExecutionTime - a.totalExecutionTime);
}

export function buildOverviewDerivedState(
  analysis: AnalysisState,
  filters: OverviewFilterState,
): OverviewDerivedState {
  const filteredExecutions = filterExecutionsForOverviewSlice(analysis.executions, filters, true);
  const baselineExecutionsForBreakdown = filterExecutionsForOverviewSlice(
    analysis.executions,
    filters,
    false,
  );

  const testRows = filteredExecutions.filter((row) => TEST_RESOURCE_TYPES.has(row.resourceType));
  const filteredThreadStats = buildThreadStatsForRows(filteredExecutions);

  return {
    filteredExecutions,
    baselineExecutionsForBreakdown,
    filteredStatusBreakdown: buildStatusBreakdownForRows(filteredExecutions),
    filteredThreadStats,
    filteredTypes: Array.from(new Set(filteredExecutions.map((row) => row.resourceType))).sort(),
    failingNodes: filteredExecutions.filter((row) => row.statusTone === 'danger').length,
    warningNodes: filteredExecutions.filter((row) => row.statusTone === 'warning').length,
    failedModels: filteredExecutions.filter(isFailedModelExecution).length,
    passingTests: testRows.filter((row) => row.statusTone === 'positive').length,
    failingTests: testRows.filter((row) => row.statusTone === 'danger').length,
    threadCount: filteredThreadStats.filter((row) => row.threadId !== 'unknown').length,
    filteredExecutionTime: filteredExecutions.reduce((sum, row) => sum + row.executionTime, 0),
    topFailures: filteredExecutions.filter((row) => row.statusTone === 'danger').slice(0, 3),
    topBottlenecks: [...filteredExecutions]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 3),
  };
}
