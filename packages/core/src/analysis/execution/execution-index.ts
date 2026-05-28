import type { ExecutionRow } from '../snapshot/types';

export function buildExecutionByUniqueId(rows: ExecutionRow[]): Map<string, ExecutionRow> {
  return new Map(rows.map((row) => [row.uniqueId, row]));
}
