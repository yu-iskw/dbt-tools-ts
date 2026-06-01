/**
 * Shared session-binding model for artifact investigation surfaces.
 *
 * Each consumer keeps its own epoch counter and scope key, but the stale-load rule
 * is the same: only the latest binding may commit observable session state.
 *
 * | Surface | Epoch field | Scope key |
 * | ------- | ----------- | --------- |
 * | MCP `ArtifactWorkspace` | `loadGeneration` | `dbtTarget` |
 * | Web `ArtifactSourceService` | `sessionGeneration` | (generation only; configure supersedes in-flight refresh) |
 * | Web analysis worker | `activeLoadGeneration` | (generation only; `invalidate-pending-loads` bumps epoch) |
 */
export interface SessionBinding {
  readonly epoch: number;
  readonly scopeKey: string | null;
}

export function captureSessionBinding(epoch: number, scopeKey: string | null): SessionBinding {
  return { epoch, scopeKey };
}

export function isSessionBindingCurrent(
  binding: SessionBinding,
  currentEpoch: number,
  currentScopeKey: string | null,
): boolean {
  return binding.epoch === currentEpoch && binding.scopeKey === currentScopeKey;
}
