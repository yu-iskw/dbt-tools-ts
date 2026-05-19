import { isRunsAdapterSortBy } from './runs-adapter-columns';

import type { RunsSortBy, RunsSortDirection, RunsViewState } from './types';

export function defaultRunsSortDirection(sortBy: RunsSortBy): RunsSortDirection {
  if (isRunsAdapterSortBy(sortBy)) return 'desc';
  switch (sortBy) {
    case 'attention':
    case 'duration':
    case 'start':
      return 'desc';
    default:
      return 'asc';
  }
}

export function nextRunsSort(
  nextSortBy: RunsSortBy,
  current: Pick<RunsViewState, 'sortBy' | 'sortDirection'>,
): Pick<RunsViewState, 'sortBy' | 'sortDirection'> {
  if (current.sortBy === nextSortBy) {
    return {
      sortBy: nextSortBy,
      sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    sortBy: nextSortBy,
    sortDirection: defaultRunsSortDirection(nextSortBy),
  };
}

export function runsColumnHeaderSortUi(
  sortedBy: RunsSortBy,
  columnSortKey: RunsSortBy,
  direction: RunsSortDirection,
): {
  indicator: string;
  ariaSort: 'ascending' | 'descending' | 'none';
} {
  if (sortedBy !== columnSortKey) {
    return { indicator: ' ', ariaSort: 'none' };
  }
  return direction === 'asc'
    ? { indicator: '↑', ariaSort: 'ascending' }
    : { indicator: '↓', ariaSort: 'descending' };
}
