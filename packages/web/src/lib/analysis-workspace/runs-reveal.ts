import type { RunsViewState, WorkspaceView } from './types';

/**
 * Runs state after a navigation, applied as one update so later steps cannot undo earlier ones.
 * Arriving in Runs drops filters left from an earlier visit so the requested rows are shown:
 * with `runsStatus` (Health counts) that status is kept; with only `executionId` every filter
 * that could hide the row is cleared. An `executionId` selects the row from any view.
 */
export function runsStateAfterNavigate(
  current: RunsViewState,
  view: WorkspaceView,
  options: { executionId?: string; runsStatus?: RunsViewState['status']; resourceId?: string },
): RunsViewState {
  let next = current;
  if (view === 'runs' && (options.runsStatus || options.executionId)) {
    next = { ...next, kind: 'all', query: '', materializationKinds: new Set() };
    next = options.runsStatus
      ? { ...next, status: options.runsStatus }
      : {
          ...next,
          status: 'all',
          resourceTypes: new Set(),
          threadIds: new Set(),
          durationBand: 'all',
        };
  }
  if (options.executionId) next = { ...next, selectedExecutionId: options.executionId };
  if (view === 'runs' && options.resourceId) next = { ...next, query: options.resourceId };
  return next;
}
