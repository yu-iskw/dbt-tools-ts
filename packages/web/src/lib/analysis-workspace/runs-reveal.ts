import type { RunsViewState } from './types';

/**
 * Runs filters after a handoff into the Runs view, so the table shows what the handoff asked for.
 * - `runsStatus` (Health counts): keep that status; drop search and materialization filters left from an earlier visit.
 * - `executionId` alone: drop every filter that could hide the row.
 */
export function revealRunsTarget(
  current: RunsViewState,
  arrival: { executionId?: string; runsStatus?: RunsViewState['status'] },
): RunsViewState {
  if (arrival.runsStatus) {
    return {
      ...current,
      status: arrival.runsStatus,
      kind: 'all',
      query: '',
      materializationKinds: new Set(),
    };
  }
  if (arrival.executionId) {
    return {
      ...current,
      kind: 'all',
      status: 'all',
      query: '',
      materializationKinds: new Set(),
      resourceTypes: new Set(),
      threadIds: new Set(),
      durationBand: 'all',
    };
  }
  return current;
}
