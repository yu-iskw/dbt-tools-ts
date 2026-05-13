/**
 * Browser-safe entry point for @dbt-tools/core.
 * Re-exports only APIs that do not depend on Node.js (fs, path).
 */
export { ManifestGraph } from './analysis/manifest-graph';
export {
  ExecutionAnalyzer,
  buildNodeExecutionsFromRunResults,
} from './analysis/execution-analyzer';
export {
  searchRunResults,
  detectBottlenecks,
  detectAdapterHeavyNodes,
} from './analysis/run-results-search';
export {
  buildAdapterTotals,
  normalizeAdapterResponse,
  adapterMetricsHasData,
} from './analysis/adapter-response-metrics';
export {
  ADAPTER_METRIC_DESCRIPTORS,
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getAdapterResponseFieldsBeyondNormalized,
  getPresentAdapterMetricDescriptors,
  getPresentAdapterTotalDescriptors,
} from './analysis/adapter-metric-descriptors';
export {
  buildAnalysisSnapshotFromArtifactBundle,
  buildAnalysisSnapshotFromArtifacts,
  buildAnalysisSnapshotFromParsedArtifactBundle,
  buildAnalysisSnapshotFromParsedArtifacts,
} from './analysis/analysis-snapshot';
export type { NodeExecution, ExecutionSummary, CriticalPath } from './analysis/execution-analyzer';
export type {
  BottleneckNode,
  BottleneckResult,
  RunResultsSearchCriteria,
  AdapterHeavyMetric,
  AdapterHeavyNode,
  AdapterHeavyResult,
} from './analysis/run-results-search';
export type {
  AdapterResponseField,
  AdapterResponseFieldKind,
  AdapterResponseMetrics,
  AdapterTotalsSnapshot,
} from './analysis/adapter-response-metrics';
export type {
  AdapterMetricDescriptor,
  AdapterMetricKey,
  AdapterMetricSortKey,
  AdapterMetricValue,
} from './analysis/adapter-metric-descriptors';
export type {
  AnalysisArtifactInputs,
  AnalysisSnapshot,
  AnalysisSnapshotBuildTimings,
  CatalogResourceStats,
  DependencyPreview,
  ExecutionRow,
  GanttItem,
  GraphSnapshot,
  MaterializationKind,
  MaterializationProvenance,
  MetricDefinition,
  NodeExecutionSemantics,
  ParsedAnalysisArtifactInputs,
  ResourceConnectionSummary,
  ResourceDefinition,
  ResourceGroup,
  ResourceNode,
  SemanticModelDefinition,
  SourceFreshnessCriteria,
  SourceFreshnessDetails,
  StatusBreakdownItem,
  StatusTone,
  ThreadStat,
  TimelineAdjacencyEntry,
} from './analysis/analysis-snapshot';

export {
  buildNodeExecutionSemantics,
  deriveSemanticsFlags,
  normalizeDbtResourceTypeKey,
  normalizeMaterializationKind,
} from './analysis/analysis-snapshot';

export {
  discoverResources,
  levenshteinDistance,
  parseDiscoveryQueryTokens,
  applyDiscoveryNodeFilters,
  legacySearchScore,
} from './discovery';
export type {
  DiscoverConfidence,
  DiscoverDisambiguationEntry,
  DiscoverMatch,
  DiscoverNextAction,
  DiscoverOptions,
  DiscoverOutput,
  DiscoverReason,
  DiscoverRelatedEntry,
  DiscoverRelatedRelation,
  InvestigationTranscript,
} from './discovery/types';
export { DISCOVER_SCHEMA_VERSION } from './discovery';
