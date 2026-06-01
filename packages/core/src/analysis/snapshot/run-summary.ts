import { normalizeWarehouseAdapterType } from '../search/warehouse';

import type { AnalysisSnapshot } from './types';
import type { RunSummaryOutput } from '../../contracts/run-summary.js';

export type { RunSummaryOutput };

export function getRunSummaryFromSnapshot(snapshot: AnalysisSnapshot): RunSummaryOutput {
  return {
    summary: snapshot.summary,
    statusBreakdown: snapshot.statusBreakdown,
    bottlenecks: snapshot.bottlenecks,
    adapterTotals: snapshot.adapterTotals ?? null,
    warehouse_type: normalizeWarehouseAdapterType(snapshot.warehouseType),
  } as RunSummaryOutput;
}
