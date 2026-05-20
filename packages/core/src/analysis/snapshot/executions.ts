import { setObjectProperty } from '../../util/typed-map';

import { statusLabel, statusTone } from './shared';

import type { NeighborGraph } from './internal';
import type { AnalysisSnapshot, StatusTone } from './types';

export function buildStatusBreakdown(
  summary: { nodes_by_status: Record<string, number>; total_nodes: number },
  nodeExecutions: Array<{ status?: string; execution_time?: number }>,
): { status: string; count: number; duration: number; share: number; tone: StatusTone }[] {
  const durationByStatus = new Map<string, number>();
  for (const execution of nodeExecutions) {
    const status = statusLabel(execution.status);
    durationByStatus.set(
      status,
      (durationByStatus.get(status) ?? 0) + (execution.execution_time ?? 0),
    );
  }
  return Object.entries(summary.nodes_by_status)
    .map(([status, count]) => ({
      status: statusLabel(status),
      count,
      duration: durationByStatus.get(statusLabel(status)) ?? 0,
      share: summary.total_nodes > 0 ? count / summary.total_nodes : 0,
      tone: statusTone(status),
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildTimelineAdjacency(
  graphologyGraph: NeighborGraph,
  executedUniqueIds: string[],
): AnalysisSnapshot['timelineAdjacency'] {
  const out: AnalysisSnapshot['timelineAdjacency'] = {};
  for (const id of executedUniqueIds) {
    setObjectProperty(
      out as unknown as Record<string, unknown>,
      id,
      graphologyGraph.hasNode(id)
        ? {
            inbound: [...graphologyGraph.inboundNeighbors(id)],
            outbound: [...graphologyGraph.outboundNeighbors(id)],
          }
        : { inbound: [], outbound: [] },
    );
  }
  return out;
}

export function buildThreadStats(
  executions: Array<{ threadId: string | null; executionTime: number }>,
): { threadId: string; count: number; totalExecutionTime: number }[] {
  const threadAggregation = new Map<string, { count: number; totalExecutionTime: number }>();
  for (const execution of executions) {
    const threadId = execution.threadId ?? 'unknown';
    const current = threadAggregation.get(threadId) ?? {
      count: 0,
      totalExecutionTime: 0,
    };
    current.count += 1;
    current.totalExecutionTime += execution.executionTime;
    threadAggregation.set(threadId, current);
  }
  return [...threadAggregation.entries()]
    .map(([threadId, value]) => ({
      threadId,
      count: value.count,
      totalExecutionTime: value.totalExecutionTime,
    }))
    .sort((a, b) => b.totalExecutionTime - a.totalExecutionTime);
}
