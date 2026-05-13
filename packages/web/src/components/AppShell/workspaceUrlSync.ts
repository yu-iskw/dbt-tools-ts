import type {
  AssetViewState,
  InvestigationSelectionState,
  LineageViewState,
  RunsViewState,
  TimelineFilterState,
  WorkspaceView,
} from '@web/lib/analysis-workspace/types';
import type { WorkspacePreferences } from '@web/hooks/useWorkspacePreferences';
import {
  buildInitialLineageViewState,
  getInitialAssetTab,
  parseLineageAllDepsMode,
  parseLineageDownstreamDepth,
  parseLineageLensMode,
  parseLineageUpstreamDepth,
  parseRunsKind,
  parseSelectedExecutionId,
  parseSelectedResourceId,
  parseShowAdapterMetrics,
  parseViewFromSearch,
} from './appNavigation';

/** When the timeline execution selection changes, reset neighborhood expand (show-all). */
export function mergeTimelineSelection(
  current: TimelineFilterState,
  nextSelectedExecutionId: string | null,
): TimelineFilterState {
  const selChanged = nextSelectedExecutionId !== current.selectedExecutionId;
  return {
    ...current,
    selectedExecutionId: nextSelectedExecutionId,
    ...(selChanged ? { neighborhoodRowsShowAll: false } : {}),
  };
}

export interface UrlDerivedNavigationState {
  activeView: WorkspaceView;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
  timelineFilters: TimelineFilterState;
  lineageViewState: LineageViewState;
  investigationSelection: InvestigationSelectionState;
}

const defaultAssetViewState = (
  search: string,
  preferences?: WorkspacePreferences,
): AssetViewState => ({
  activeTab: getInitialAssetTab(search),
  expandedNodeIds: new Set(),
  explorerMode: preferences?.inventoryDefaults.explorerMode ?? 'project',
  status: 'all',
  resourceTypes: new Set(),
  materializationKinds: new Set(),
  resourceQuery: '',
  selectedResourceId: parseSelectedResourceId(search),
  upstreamDepth:
    parseLineageUpstreamDepth(search) ?? preferences?.inventoryDefaults.lineageUpstreamDepth ?? 2,
  downstreamDepth:
    parseLineageDownstreamDepth(search) ??
    preferences?.inventoryDefaults.lineageDownstreamDepth ??
    2,
  allDepsMode:
    parseLineageAllDepsMode(search) ?? preferences?.inventoryDefaults.allDepsMode ?? false,
  lensMode:
    parseLineageLensMode(search) ?? preferences?.inventoryDefaults.lineageLensMode ?? 'type',
  activeLegendKeys: new Set(),
});

const defaultRunsViewState = (search: string): RunsViewState => {
  const view = parseViewFromSearch(search);
  return {
    kind: parseRunsKind(search) ?? 'all',
    status: 'all',
    query: '',
    resourceTypes: new Set(),
    materializationKinds: new Set(),
    threadIds: new Set(),
    durationBand: 'all',
    sortBy: 'attention',
    sortDirection: 'desc',
    groupBy: 'none',
    selectedExecutionId: view === 'runs' ? parseSelectedExecutionId(search) : null,
    showAdapterMetrics: view === 'runs' ? parseShowAdapterMetrics(search) : false,
  };
};

const defaultTimelineFilters = (
  search: string,
  preferences?: WorkspacePreferences,
): TimelineFilterState => {
  const view = parseViewFromSearch(search);
  const selected = view === 'runs' || view === 'timeline' ? parseSelectedExecutionId(search) : null;
  return {
    query: '',
    activeStatuses: new Set(),
    activeTypes: new Set(),
    selectedExecutionId: selected,
    showTests: preferences?.timelineDefaults.showTests ?? false,
    failuresOnly: preferences?.timelineDefaults.failuresOnly ?? false,
    dependencyDirection: preferences?.timelineDefaults.dependencyDirection ?? 'both',
    dependencyDepthHops: preferences?.timelineDefaults.dependencyDepthHops ?? 2,
    timeWindow: null,
    neighborhoodRowsShowAll: false,
  };
};

function getInventoryQueryFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const resolvedView = parseViewFromSearch(search);
  if (resolvedView !== 'inventory') return null;

  const terms: string[] = [];
  const q = params.get('q')?.trim() ?? '';
  if (q !== '') {
    terms.push(q);
  }

  for (const key of ['type', 'package', 'tag', 'path'] as const) {
    const value = params.get(key)?.trim() ?? '';
    if (value !== '') {
      terms.push(`${key}:${value}`);
    }
  }

  return terms.join(' ').trim();
}

/** Inventory/discover URLs seed the Inventory list filter (`resourceQuery`). */
function mergeInventoryQueryIntoAsset(search: string, asset: AssetViewState): AssetViewState {
  const q = getInventoryQueryFromSearch(search);
  if (q === null) return asset;
  return { ...asset, resourceQuery: q };
}

const defaultInvestigationSelection = (search: string): InvestigationSelectionState => {
  const view = parseViewFromSearch(search) ?? 'health';
  const resourceId = parseSelectedResourceId(search);
  const selectedParam = parseSelectedExecutionId(search);
  return {
    selectedResourceId: resourceId,
    selectedExecutionId: view === 'runs' || view === 'timeline' ? selectedParam : null,
    sourceLens: null,
  };
};

/** Full URL-derived slices for first paint from `location.search`. */
export function createInitialNavigationState(
  search: string,
  preferences?: WorkspacePreferences,
): UrlDerivedNavigationState {
  const activeView = parseViewFromSearch(search) ?? 'health';
  return {
    activeView,
    assetViewState: mergeInventoryQueryIntoAsset(
      search,
      defaultAssetViewState(search, preferences),
    ),
    runsViewState: defaultRunsViewState(search),
    timelineFilters: defaultTimelineFilters(search, preferences),
    lineageViewState: {
      ...buildInitialLineageViewState(search),
      upstreamDepth:
        parseLineageUpstreamDepth(search) ??
        preferences?.inventoryDefaults.lineageUpstreamDepth ??
        2,
      downstreamDepth:
        parseLineageDownstreamDepth(search) ??
        preferences?.inventoryDefaults.lineageDownstreamDepth ??
        2,
      allDepsMode:
        parseLineageAllDepsMode(search) ?? preferences?.inventoryDefaults.allDepsMode ?? false,
      lensMode:
        parseLineageLensMode(search) ?? preferences?.inventoryDefaults.lineageLensMode ?? 'type',
    },
    investigationSelection: defaultInvestigationSelection(search),
  };
}

/**
 * Maps `location.search` to state updates after history navigation (back/forward).
 * When `parseViewFromSearch` returns null, `activeView` is `undefined` and callers should not update active view.
 */
export function applySearchToWorkspaceState(search: string): {
  activeView: WorkspaceView | undefined;
  assetViewState: (current: AssetViewState) => AssetViewState;
  runsViewState: (current: RunsViewState) => RunsViewState;
  timelineFilters: (current: TimelineFilterState) => TimelineFilterState;
  lineageViewState: LineageViewState;
  investigationSelection: (current: InvestigationSelectionState) => InvestigationSelectionState;
} {
  const view = parseViewFromSearch(search);
  const resourceId = parseSelectedResourceId(search);
  const selectedParam = parseSelectedExecutionId(search);

  return {
    activeView: view ?? undefined,
    assetViewState: (current) =>
      mergeInventoryQueryIntoAsset(search, {
        ...current,
        selectedResourceId: resourceId,
        activeTab: getInitialAssetTab(search),
      }),
    runsViewState: (current) => ({
      ...current,
      kind: parseRunsKind(search) ?? current.kind,
      selectedExecutionId: view === 'runs' ? selectedParam : null,
      showAdapterMetrics:
        view === 'runs' ? parseShowAdapterMetrics(search) : current.showAdapterMetrics,
    }),
    timelineFilters: (current) =>
      mergeTimelineSelection(current, view === 'timeline' ? selectedParam : null),
    lineageViewState: buildInitialLineageViewState(search),
    investigationSelection: (current) => ({
      ...current,
      selectedResourceId: resourceId,
      selectedExecutionId: view === 'runs' || view === 'timeline' ? selectedParam : null,
      sourceLens: current.sourceLens,
    }),
  };
}

export interface BuildUrlInput {
  pathname: string;
  hash: string;
  activeView: WorkspaceView;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
  timelineSelectedExecutionId: string | null;
  lineageViewState: LineageViewState;
}

const NAV_SEARCH_KEYS = [
  'resource',
  'assetTab',
  'selected',
  'kind',
  'adapter',
  'up',
  'down',
  'allDeps',
  'lens',
  'q',
] as const;

function deleteNavSearchKeys(url: URL, except?: ReadonlySet<string>) {
  for (const key of NAV_SEARCH_KEYS) {
    if (except?.has(key)) continue;
    url.searchParams.delete(key);
  }
}

function applyInventoryUrl(
  url: URL,
  assetViewState: AssetViewState,
  lineageViewState: LineageViewState,
) {
  if (assetViewState.selectedResourceId) {
    url.searchParams.set('resource', assetViewState.selectedResourceId);
  } else {
    url.searchParams.delete('resource');
  }
  url.searchParams.set('assetTab', assetViewState.activeTab);
  const resourceQuery = assetViewState.resourceQuery.trim();
  if (resourceQuery !== '') {
    url.searchParams.set('q', resourceQuery);
  } else {
    url.searchParams.delete('q');
  }
  url.searchParams.delete('kind');
  if (assetViewState.activeTab === 'lineage') {
    if (lineageViewState.selectedResourceId) {
      url.searchParams.set('selected', lineageViewState.selectedResourceId);
    } else {
      url.searchParams.delete('selected');
    }
    url.searchParams.set('up', String(lineageViewState.upstreamDepth));
    url.searchParams.set('down', String(lineageViewState.downstreamDepth));
    url.searchParams.set('allDeps', lineageViewState.allDepsMode ? '1' : '0');
    url.searchParams.set('lens', lineageViewState.lensMode);
  } else {
    deleteNavSearchKeys(url, new Set(['resource', 'assetTab', 'q']));
  }
}

function applyRunsUrl(url: URL, runsViewState: RunsViewState) {
  url.searchParams.set('kind', runsViewState.kind);
  if (runsViewState.selectedExecutionId) {
    url.searchParams.set('selected', runsViewState.selectedExecutionId);
  } else {
    url.searchParams.delete('selected');
  }
  if (runsViewState.showAdapterMetrics) {
    url.searchParams.delete('adapter');
  } else {
    url.searchParams.set('adapter', '0');
  }
  deleteNavSearchKeys(url, new Set(['kind', 'selected', 'adapter']));
}

function applyTimelineUrl(url: URL, timelineSelectedExecutionId: string | null) {
  if (timelineSelectedExecutionId) {
    url.searchParams.set('selected', timelineSelectedExecutionId);
  } else {
    url.searchParams.delete('selected');
  }
  deleteNavSearchKeys(url, new Set(['selected']));
}

/** Builds `pathname + search + hash` from workspace slices (same shape as history `pushState`). */
export function buildNextUrlFromWorkspaceState(input: BuildUrlInput): string {
  const {
    pathname,
    hash,
    activeView,
    assetViewState,
    runsViewState,
    timelineSelectedExecutionId,
    lineageViewState,
  } = input;

  const url = new URL(`http://local.invalid${pathname}${hash}`);
  url.searchParams.set('view', activeView);

  if (activeView === 'inventory') {
    applyInventoryUrl(url, assetViewState, lineageViewState);
  } else if (activeView === 'runs') {
    applyRunsUrl(url, runsViewState);
  } else if (activeView === 'timeline') {
    applyTimelineUrl(url, timelineSelectedExecutionId);
  } else {
    deleteNavSearchKeys(url);
  }

  return `${pathname}${url.search}${hash}`;
}
