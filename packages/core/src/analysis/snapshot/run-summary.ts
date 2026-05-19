import type { AnalysisSnapshot } from './types';
import type { AdapterTotalsSnapshot } from '../adapter/metrics';
import type { WarehouseAdapterType } from '../search/types';
import { normalizeWarehouseAdapterType } from '../search/warehouse';

export interface RunSummaryOutput {
  summary: AnalysisSnapshot['summary'];
  statusBreakdown: AnalysisSnapshot['statusBreakdown'];
  bottlenecks: AnalysisSnapshot['bottlenecks'];
  adapterTotals: AdapterTotalsSnapshot | null;
  warehouse_type: WarehouseAdapterType | 'unknown';
}

export function getRunSummaryFromSnapshot(snapshot: AnalysisSnapshot): RunSummaryOutput {
  return {
    summary: snapshot.summary,
    statusBreakdown: snapshot.statusBreakdown,
    bottlenecks: snapshot.bottlenecks,
    adapterTotals: snapshot.adapterTotals ?? null,
    warehouse_type: normalizeWarehouseAdapterType(snapshot.warehouseType),
  };
}
