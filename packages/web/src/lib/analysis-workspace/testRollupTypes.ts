/**
 * Minimal shape for “test attention” rollups (failed/errored/warn/skipped attachments).
 * Shared by explorer tree stats and asset status matching to avoid circular imports.
 */
export interface ResourceTestRollupCounts {
  /** Legacy bucket; `buildResourceTestStats` leaves this at 0. */
  fail: number;
  error: number;
  warn: number;
  skipped: number;
}

export function rollupCountsHaveAttention(stats: ResourceTestRollupCounts | undefined): boolean {
  if (!stats) return false;
  return stats.fail + stats.error + stats.warn + stats.skipped > 0;
}
