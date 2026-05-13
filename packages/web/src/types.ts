export type {
  AnalysisSnapshot as AnalysisState,
  DependencyPreview,
  ExecutionRow,
  GanttItem,
  GraphSnapshot,
  MaterializationKind,
  MaterializationProvenance,
  MetricDefinition,
  NodeExecutionSemantics,
  ResourceConnectionSummary,
  ResourceDefinition,
  ResourceGroup,
  ResourceNode,
  SemanticModelDefinition,
  StatusBreakdownItem,
  StatusTone,
  ThreadStat,
  TimelineAdjacencyEntry,
} from '@dbt-tools/core/browser';

export interface ResourceTestStats {
  pass: number;
  /** Legacy bucket; aggregation keeps this at 0. */
  fail: number;
  error: number;
  warn: number;
  skipped: number;
  /** Tests with no run row or unknown status (`neutral` tone), not dbt skipped. */
  notExecuted: number;
}
