import { runSummaryOutputSchema, type RunSummaryOutput } from '../../contracts/run-summary.js';
import { normalizeWarehouseAdapterType } from '../search/warehouse';

import type { AnalysisSnapshot } from './types';

export type { RunSummaryOutput };

export function getRunSummaryFromSnapshot(snapshot: AnalysisSnapshot): RunSummaryOutput {
  return runSummaryOutputSchema.parse({
    summary: snapshot.summary,
    statusBreakdown: snapshot.statusBreakdown,
    bottlenecks: snapshot.bottlenecks,
    adapterTotals: snapshot.adapterTotals ?? null,
    warehouse_type: normalizeWarehouseAdapterType(snapshot.warehouseType),
  });
}
