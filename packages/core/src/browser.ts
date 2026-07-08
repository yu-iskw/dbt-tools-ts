/**
 * Browser-safe entry point for @dbt-tools/core.
 * Re-exports only APIs that do not depend on Node.js (fs, path).
 */
export { ManifestGraph } from './analysis/manifest/graph';
export {
  ExecutionAnalyzer,
  buildNodeExecutionsFromRunResults,
} from './analysis/execution/analyzer';
export {
  searchRunResults,
  detectBottlenecks,
  detectAdapterHeavyNodes,
} from './analysis/search/run-results';
export {
  buildAdapterTotals,
  normalizeAdapterResponse,
  adapterMetricsHasData,
} from './analysis/adapter/metrics';
export {
  ADAPTER_METRIC_DESCRIPTORS,
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getAdapterResponseFieldsBeyondNormalized,
  getPresentAdapterMetricDescriptors,
  getPresentAdapterTotalDescriptors,
} from './analysis/adapter/descriptors';
export {
  buildAnalysisSnapshotFromArtifactBundle,
  buildAnalysisSnapshotFromArtifacts,
  buildAnalysisSnapshotFromParsedArtifactBundle,
  buildAnalysisSnapshotFromParsedArtifacts,
} from './analysis/snapshot';
export type { NodeExecution, ExecutionSummary, CriticalPath } from './analysis/execution/analyzer';
export type {
  AdapterHeavyMetric,
  BottleneckNode,
  BottleneckResult,
  RunResultsSearchCriteria,
} from './analysis/search/types';
export type { AdapterHeavyNode, AdapterHeavyResult } from './analysis/search/run-results';
export type {
  AdapterResponseField,
  AdapterResponseFieldKind,
  AdapterResponseMetrics,
  AdapterTotalsSnapshot,
} from './analysis/adapter/metrics';
export type {
  AdapterMetricDescriptor,
  AdapterMetricKey,
  AdapterMetricSortKey,
  AdapterMetricValue,
} from './analysis/adapter/descriptors';
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
} from './analysis/snapshot';

export {
  buildNodeExecutionSemantics,
  deriveSemanticsFlags,
  normalizeDbtResourceTypeKey,
  normalizeMaterializationKind,
} from './analysis/snapshot';

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

export {
  searchResourcesInGraph,
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
} from './discovery/graph-search.js';
export type {
  SearchResourceResult,
  SearchResourcesInput,
  SearchResourcesOutput,
} from './discovery/graph-search.js';

export {
  getObjectProperty,
  setObjectProperty,
  groupByToMap,
  incrementMapCount,
  mapFromRecord,
  pushToMapList,
  recordFromMap,
} from './util/typed-map';
