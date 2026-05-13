import type { Dispatch, SetStateAction } from 'react';
import type { AnalysisState, MaterializationKind, StatusTone } from '@web/types';
import type { WorkspaceArtifactSource } from '@web/services/artifactSourceApi';

/**
 * New top-level workspace views.
 * Legacy values (overview, catalog, runs) are kept for backward-compat URL
 * redirects and will be removed after all references are migrated.
 */
export type WorkspaceView =
  | 'health'
  | 'inventory'
  | 'runs'
  | 'timeline'
  | 'settings'
  // legacy — redirect targets below
  | 'overview'
  | 'catalog'
  | 'execution'
  | 'quality'
  | 'dependencies'
  | 'search';

export type AssetTab = 'summary' | 'lineage' | 'sql' | 'runtime' | 'tests';
export type RunsKind = 'all' | 'models' | 'tests' | 'seeds' | 'snapshots' | 'operations';
export type RunsBaseSortBy =
  | 'attention'
  | 'duration'
  | 'name'
  | 'status'
  | 'start'
  | 'materialization'
  | 'resourceType'
  | 'thread';
export type RunsAdapterColumnId = `adapter:${string}`;
export type RunsSortBy = RunsBaseSortBy | RunsAdapterColumnId;
export type RunsSortDirection = 'asc' | 'desc';
export type RunsGroupBy = 'none' | 'type' | 'status' | 'thread';

/** `issues` = failed execution on the asset or dbt test attention rollup (explorer); runs table uses danger+warning rows. */
export type DashboardStatusFilter = 'all' | 'issues' | StatusTone;
export type AssetExplorerMode = 'project' | 'database';
export type LensMode = 'status' | 'type' | 'coverage';
export type TimelineDependencyDirection = 'upstream' | 'both' | 'downstream';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface OverviewFilterState {
  status: DashboardStatusFilter;
  resourceTypes: Set<string>;
  query: string;
}

/**
 * A selected time window used to zoom the timeline X-axis.
 * Both `start` and `end` are milliseconds relative to the run's earliest node
 * (i.e. relative to the implicit time-origin 0, same coordinate space as
 * `GanttItem.start` / `GanttItem.end`).
 */
export interface TimeWindow {
  start: number;
  end: number;
}

export interface TimelineFilterState {
  query: string;
  activeStatuses: Set<string>;
  activeTypes: Set<string>;
  selectedExecutionId: string | null;
  /** Show test chips inside bundle rows. Default false for performance on large projects. */
  showTests: boolean;
  /**
   * When true: auto-expand all bundles with failures and visually collapse
   * passing ones. Does not remove passing bundles from the view.
   */
  failuresOnly: boolean;
  /** Which dependency direction to visualize for the focused timeline node. */
  dependencyDirection: TimelineDependencyDirection;
  /**
   * Maximum dependency hop index to show. `1` means direct neighbors only;
   * values > 1 enable capped extended BFS up to the given hop.
   */
  dependencyDepthHops: number;
  /**
   * When set, the timeline X-axis is zoomed to show only [start, end] ms.
   * Bundles whose items do not overlap the window are hidden from the
   * virtualizer. null means the full timeline is shown.
   */
  timeWindow: TimeWindow | null;
  /**
   * When a row is selected, the timeline normally hides parent rows outside the
   * dependency neighborhood. When true, all filtered parents stay visible until
   * selection changes or is cleared. Session-only (not in URL).
   */
  neighborhoodRowsShowAll: boolean;
}

export interface AssetViewState {
  activeTab: AssetTab;
  selectedResourceId: string | null;
  expandedNodeIds: Set<string>;
  explorerMode: AssetExplorerMode;
  status: DashboardStatusFilter;
  resourceTypes: Set<string>;
  /** Manifest-derived materialization kinds; empty = all. */
  materializationKinds: Set<MaterializationKind>;
  resourceQuery: string;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

export interface RunsViewState {
  kind: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  resourceTypes: Set<string>;
  /** Subset of manifest-derived materialization kinds; empty = all. */
  materializationKinds: Set<MaterializationKind>;
  threadIds: Set<string>;
  durationBand: 'all' | 'fast' | 'medium' | 'slow';
  sortBy: RunsSortBy;
  sortDirection: RunsSortDirection;
  groupBy: RunsGroupBy;
  selectedExecutionId: string | null;
  /** When true, show adapter metric columns when the run includes parseable metrics. */
  showAdapterMetrics: boolean;
}

export interface LineageViewState {
  rootResourceId: string | null;
  selectedResourceId: string | null;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

export interface SearchState {
  query: string;
  recentResourceIds: string[];
  isOpen: boolean;
}

export interface InvestigationSelectionState {
  selectedResourceId: string | null;
  selectedExecutionId: string | null;
  sourceLens: WorkspaceView | null;
}

export interface WorkspaceSignal {
  label: string;
  value: string;
  detail: string;
  tone: string;
}

export interface AnalysisWorkspaceProps {
  analysis: AnalysisState;
  activeView: WorkspaceView;
  analysisSource: WorkspaceArtifactSource | null;
  /** Signals built from workspace data — Health posture block (e.g. workspace mode). */
  workspaceSignals: WorkspaceSignal[];
  overviewFilters: OverviewFilterState;
  onOverviewFiltersChange: Dispatch<SetStateAction<OverviewFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  onInvestigationSelectionChange: Dispatch<SetStateAction<InvestigationSelectionState>>;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetTab;
      rootResourceId?: string;
    },
  ) => void;
}
