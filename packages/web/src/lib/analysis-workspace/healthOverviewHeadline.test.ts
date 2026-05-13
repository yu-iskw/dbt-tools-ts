import { describe, expect, it } from 'vitest';
import type { AnalysisState } from '@web/types';
import { buildHealthOverviewHeadline, buildHealthSummaryBits } from './healthOverviewHeadline';
import type { OverviewDerivedState } from './overviewState';

const baseDerived = (over: Partial<OverviewDerivedState>): OverviewDerivedState =>
  ({
    filteredExecutions: [],
    baselineExecutionsForBreakdown: [],
    filteredStatusBreakdown: [],
    filteredThreadStats: [],
    filteredTypes: [],
    failingNodes: 0,
    warningNodes: 0,
    failedModels: 0,
    passingTests: 0,
    failingTests: 0,
    threadCount: 0,
    filteredExecutionTime: 0,
    topFailures: [],
    topBottlenecks: [],
    ...over,
  }) as OverviewDerivedState;

describe('buildHealthOverviewHeadline', () => {
  it('returns danger when failing nodes', () => {
    const r = buildHealthOverviewHeadline(baseDerived({ failingNodes: 2 }), false);
    expect(r.tone).toBe('danger');
    expect(r.title).toContain('2 failing nodes');
  });

  it('returns warning when only warnings', () => {
    const r = buildHealthOverviewHeadline(baseDerived({ failingNodes: 0, warningNodes: 1 }), false);
    expect(r.tone).toBe('warning');
    expect(r.title).toContain('1 warning node');
  });

  it('returns positive when clean', () => {
    const r = buildHealthOverviewHeadline(baseDerived({}), false);
    expect(r.tone).toBe('positive');
    expect(r.title).toBe('Healthy run');
  });
});

describe('buildHealthSummaryBits', () => {
  it('includes project and graph counts', () => {
    const analysis = {
      graphSummary: {
        totalNodes: 10,
        totalEdges: 0,
        nodesByType: {},
        hasCycles: false,
      },
      summary: { total_nodes: 5, total_execution_time: 0 },
      invocationId: null,
    } as unknown as AnalysisState;
    const bits = buildHealthSummaryBits(analysis, 'my_proj');
    expect(bits[0]).toBe('my_proj');
    expect(bits.some((b) => b.includes('10 graph nodes'))).toBe(true);
    expect(bits.some((b) => b.includes('5 executions'))).toBe(true);
  });
});
