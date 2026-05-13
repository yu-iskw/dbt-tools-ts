import { describe, it, expect } from 'vitest';
import type { ThreadStat } from '@web/types';
import {
  capSortedThreadStats,
  formatThreadDistributionMetricValue,
  getThreadStatMetricValue,
  maxThreadStatMetricValue,
  sortThreadStatsByMetric,
} from './threadDistributionMetrics';
import { formatSeconds } from './utils';

function stat(threadId: string, count: number, totalExecutionTime: number): ThreadStat {
  return { threadId, count, totalExecutionTime };
}

describe('getThreadStatMetricValue', () => {
  it('returns count for resources', () => {
    expect(getThreadStatMetricValue(stat('a', 5, 10), 'resources')).toBe(5);
  });

  it('returns totalExecutionTime for totalTime', () => {
    expect(getThreadStatMetricValue(stat('a', 5, 10), 'totalTime')).toBe(10);
  });

  it('returns average for avgTime', () => {
    expect(getThreadStatMetricValue(stat('a', 4, 10), 'avgTime')).toBe(2.5);
  });

  it('returns 0 for avgTime when count is 0', () => {
    expect(getThreadStatMetricValue(stat('a', 0, 0), 'avgTime')).toBe(0);
  });
});

describe('formatThreadDistributionMetricValue', () => {
  it('matches getThreadStatMetricValue for resources (localized)', () => {
    const s = stat('a', 1234, 99);
    expect(formatThreadDistributionMetricValue(s, 'resources')).toBe(
      getThreadStatMetricValue(s, 'resources').toLocaleString(),
    );
  });

  it('uses formatSeconds for total and avg from the same numeric value', () => {
    const total = stat('a', 1, 10.5);
    expect(formatThreadDistributionMetricValue(total, 'totalTime')).toBe(
      formatSeconds(getThreadStatMetricValue(total, 'totalTime')),
    );
    const avg = stat('b', 4, 10);
    expect(formatThreadDistributionMetricValue(avg, 'avgTime')).toBe(
      formatSeconds(getThreadStatMetricValue(avg, 'avgTime')),
    );
  });
});

describe('maxThreadStatMetricValue', () => {
  it('returns 0 for empty stats', () => {
    expect(maxThreadStatMetricValue([], 'resources')).toBe(0);
  });

  it('returns max for the chosen metric', () => {
    const stats = [stat('a', 1, 5), stat('b', 3, 2)];
    expect(maxThreadStatMetricValue(stats, 'resources')).toBe(3);
    expect(maxThreadStatMetricValue(stats, 'totalTime')).toBe(5);
  });
});

describe('sortThreadStatsByMetric', () => {
  it('sorts by total time descending by default metric totalTime', () => {
    const stats = [stat('a', 1, 1), stat('b', 1, 9), stat('c', 1, 5)];
    const sorted = sortThreadStatsByMetric(stats, 'totalTime');
    expect(sorted.map((s) => s.threadId)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by resources descending', () => {
    const stats = [stat('a', 10, 1), stat('b', 2, 1), stat('c', 5, 1)];
    const sorted = sortThreadStatsByMetric(stats, 'resources');
    expect(sorted.map((s) => s.threadId)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by avg time descending', () => {
    const stats = [stat('a', 2, 10), stat('b', 5, 10), stat('c', 1, 10)];
    const sorted = sortThreadStatsByMetric(stats, 'avgTime');
    expect(sorted.map((s) => s.threadId)).toEqual(['c', 'a', 'b']);
  });

  it('pins unknown thread after ties when values equal', () => {
    const stats = [stat('unknown', 1, 5), stat('t1', 1, 5)];
    const sorted = sortThreadStatsByMetric(stats, 'totalTime');
    expect(sorted.map((s) => s.threadId)).toEqual(['t1', 'unknown']);
  });
});

describe('capSortedThreadStats', () => {
  it('returns all rows when at or below cap', () => {
    const rows = Array.from({ length: 5 }, (_, i) => stat(`t${i}`, 1, 1));
    const out = capSortedThreadStats(rows);
    expect(out.rows).toHaveLength(5);
    expect(out.isTruncated).toBe(false);
    expect(out.totalLanes).toBe(5);
  });

  it('truncates beyond 12 lanes', () => {
    const rows = Array.from({ length: 20 }, (_, i) => stat(`t${i}`, 1, 1));
    const out = capSortedThreadStats(rows);
    expect(out.rows).toHaveLength(12);
    expect(out.isTruncated).toBe(true);
    expect(out.totalLanes).toBe(20);
  });
});
