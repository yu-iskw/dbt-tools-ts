import { describe, expect, it } from 'vitest';

import { clearRunsFilters, hasActiveRunsFilters } from './runs-filters';

import type { RunsViewState } from './types';

function runsState(over: Partial<RunsViewState> = {}): RunsViewState {
  return {
    kind: 'all',
    status: 'all',
    query: '',
    resourceTypes: new Set(),
    materializationKinds: new Set(),
    threadIds: new Set(),
    durationBand: 'all',
    sortBy: 'attention',
    sortDirection: 'desc',
    groupBy: 'none',
    selectedExecutionId: null,
    showAdapterMetrics: false,
    ...over,
  };
}

describe('hasActiveRunsFilters', () => {
  it('is false for the default state and a whitespace-only query', () => {
    expect(hasActiveRunsFilters(runsState())).toBe(false);
    expect(hasActiveRunsFilters(runsState({ query: '   ' }))).toBe(false);
  });

  it.each<[string, Partial<RunsViewState>]>([
    ['kind', { kind: 'tests' }],
    ['status', { status: 'danger' }],
    ['query', { query: 'orders' }],
    ['resource types', { resourceTypes: new Set(['model']) }],
    ['materialization', { materializationKinds: new Set(['view']) }],
    ['threads', { threadIds: new Set(['Thread-1']) }],
    ['duration band', { durationBand: 'slow' }],
  ])('is true when %s narrows the rows', (_label, over) => {
    expect(hasActiveRunsFilters(runsState(over))).toBe(true);
  });

  it('ignores sort, grouping, adapter columns and selection', () => {
    expect(
      hasActiveRunsFilters(
        runsState({
          sortBy: 'name',
          sortDirection: 'asc',
          groupBy: 'thread',
          showAdapterMetrics: true,
          selectedExecutionId: 'model.pkg.orders',
        }),
      ),
    ).toBe(false);
  });
});

describe('clearRunsFilters', () => {
  it('resets every filter and keeps sort, grouping, adapter columns and selection', () => {
    const cleared = clearRunsFilters(
      runsState({
        kind: 'tests',
        status: 'danger',
        query: 'orders',
        resourceTypes: new Set(['test']),
        materializationKinds: new Set(['view']),
        threadIds: new Set(['Thread-1']),
        durationBand: 'slow',
        sortBy: 'name',
        sortDirection: 'asc',
        groupBy: 'thread',
        showAdapterMetrics: true,
        selectedExecutionId: 'model.pkg.orders',
      }),
    );

    expect(hasActiveRunsFilters(cleared)).toBe(false);
    expect(cleared).toEqual(
      runsState({
        sortBy: 'name',
        sortDirection: 'asc',
        groupBy: 'thread',
        showAdapterMetrics: true,
        selectedExecutionId: 'model.pkg.orders',
      }),
    );
  });
});
