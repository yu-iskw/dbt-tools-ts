import type { RunsViewState } from './types';

export function hasActiveRunsFilters(state: RunsViewState): boolean {
  return (
    state.kind !== 'all' ||
    state.status !== 'all' ||
    state.query.trim() !== '' ||
    state.resourceTypes.size > 0 ||
    state.materializationKinds.size > 0 ||
    state.threadIds.size > 0 ||
    state.durationBand !== 'all'
  );
}

/** Resets what narrows the rows; keeps sort, grouping, adapter columns and the selected row. */
export function clearRunsFilters(state: RunsViewState): RunsViewState {
  return {
    ...state,
    kind: 'all',
    status: 'all',
    query: '',
    resourceTypes: new Set(),
    materializationKinds: new Set(),
    threadIds: new Set(),
    durationBand: 'all',
  };
}
