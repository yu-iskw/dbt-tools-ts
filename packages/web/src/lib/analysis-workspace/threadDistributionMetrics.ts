import type { ThreadStat } from '@web/types';

import { formatSeconds } from './utils';

export type ThreadDistributionMetric = 'resources' | 'totalTime' | 'avgTime';

export const THREAD_DISTRIBUTION_METRIC_OPTIONS: {
  value: ThreadDistributionMetric;
  label: string;
}[] = [
  { value: 'resources', label: 'Resources' },
  { value: 'totalTime', label: 'Total time' },
  { value: 'avgTime', label: 'Avg time' },
];

export function getThreadStatMetricValue(
  stat: ThreadStat,
  metric: ThreadDistributionMetric,
): number {
  switch (metric) {
    case 'resources':
      return stat.count;
    case 'totalTime':
      return stat.totalExecutionTime;
    case 'avgTime':
      return stat.count > 0 ? stat.totalExecutionTime / stat.count : 0;
  }
}

export function formatThreadDistributionMetricValue(
  stat: ThreadStat,
  metric: ThreadDistributionMetric,
): string {
  const value = getThreadStatMetricValue(stat, metric);
  if (metric === 'resources') {
    return value.toLocaleString();
  }
  return formatSeconds(value);
}

export function maxThreadStatMetricValue(
  stats: ThreadStat[],
  metric: ThreadDistributionMetric,
): number {
  let max = 0;
  for (const s of stats) {
    const v = getThreadStatMetricValue(s, metric);
    if (v > max) max = v;
  }
  return max;
}

function isUnknownThread(threadId: string): boolean {
  return threadId === 'unknown';
}

/**
 * Sort by metric descending; `unknown` thread id is pinned last among equal ties
 * and after all known threads when values tie at zero.
 */
export function sortThreadStatsByMetric(
  stats: ThreadStat[],
  metric: ThreadDistributionMetric,
): ThreadStat[] {
  return [...stats].sort((a, b) => {
    const va = getThreadStatMetricValue(a, metric);
    const vb = getThreadStatMetricValue(b, metric);
    if (vb !== va) return vb - va;
    const ua = isUnknownThread(a.threadId);
    const ub = isUnknownThread(b.threadId);
    if (ua !== ub) return ua ? 1 : -1;
    return a.threadId.localeCompare(b.threadId);
  });
}

const DISPLAY_CAP = 12;

export function capSortedThreadStats(stats: ThreadStat[]): {
  rows: ThreadStat[];
  totalLanes: number;
  isTruncated: boolean;
} {
  const totalLanes = stats.length;
  const isTruncated = totalLanes > DISPLAY_CAP;
  return {
    rows: isTruncated ? stats.slice(0, DISPLAY_CAP) : stats,
    totalLanes,
    isTruncated,
  };
}
