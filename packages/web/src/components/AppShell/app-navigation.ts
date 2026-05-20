import type {
  AssetViewState,
  LineageViewState,
  RunsViewState,
  WorkspaceView,
} from '../AnalysisWorkspace';

export interface SidebarNavigationTarget {
  id: string;
  label: string;
  view: Exclude<
    WorkspaceView,
    'catalog' | 'dependencies' | 'execution' | 'overview' | 'quality' | 'search'
  >;
}

export interface NavigationSelectionTarget {
  view: WorkspaceView;
}

export const navigationItems: SidebarNavigationTarget[] = [
  { id: 'health', view: 'health', label: 'Health' },
  { id: 'timeline', view: 'timeline', label: 'Timeline' },
  { id: 'inventory', view: 'inventory', label: 'Inventory' },
  { id: 'runs', view: 'runs', label: 'Runs' },
];

const VALID_VIEWS = new Set<WorkspaceView>([
  'health',
  'inventory',
  'runs',
  'timeline',
  'settings',
  'overview',
  'catalog',
  'execution',
  'quality',
  'dependencies',
  'search',
]);

/** Legacy URLs: ?view=lineage or ?view=dependencies open Inventory with the Lineage tab. */
export function viewParamImpliesInventoryLineageTab(search: string): boolean {
  const raw = new URLSearchParams(search).get('view');
  return raw === 'lineage' || raw === 'dependencies';
}

export function resolveView(raw: string): WorkspaceView {
  switch (raw) {
    case 'overview':
      return 'health';
    case 'catalog':
      return 'inventory';
    case 'execution':
    case 'quality':
      return 'runs';
    case 'dependencies':
    case 'lineage':
      return 'inventory';
    case 'search':
      return 'inventory';
    case 'discover':
      return 'inventory';
    case 'runs':
    case 'timeline':
    case 'inventory':
    case 'health':
    case 'settings':
      return raw;
    default:
      return 'health';
  }
}

export function parseViewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const raw = params.get('view');
  if (!raw) return null;
  /** Legacy: Discover workspace removed; open Inventory instead. */
  if (raw === 'discover') return 'inventory';
  if (raw === 'runs' && params.get('tab') === 'timeline') return 'timeline';
  if (raw === 'lineage' || raw === 'dependencies') return 'inventory';
  if (VALID_VIEWS.has(raw as WorkspaceView)) {
    return resolveView(raw);
  }
  return null;
}

export function getInitialView(): WorkspaceView {
  return parseViewFromSearch(window.location.search) ?? 'health';
}

export function parseSelectedResourceId(search: string): string | null {
  return new URLSearchParams(search).get('resource');
}

/** `selected` query param: execution id on Runs/Timeline; graph node id when Inventory lineage tab. */
export function parseSelectedExecutionId(search: string): string | null {
  return new URLSearchParams(search).get('selected');
}

export function parseAssetTab(search: string): AssetViewState['activeTab'] | null {
  const raw = new URLSearchParams(search).get('assetTab');
  if (
    raw === 'summary' ||
    raw === 'lineage' ||
    raw === 'sql' ||
    raw === 'runtime' ||
    raw === 'tests'
  ) {
    return raw;
  }
  return null;
}

/** Asset tab for first paint: explicit assetTab wins; else lineage/deps views imply lineage tab. */
export function getInitialAssetTab(search: string): AssetViewState['activeTab'] {
  return (
    parseAssetTab(search) ?? (viewParamImpliesInventoryLineageTab(search) ? 'lineage' : 'summary')
  );
}

export function parseRunsKind(search: string): RunsViewState['kind'] | null {
  const raw = new URLSearchParams(search).get('kind');
  if (
    raw === 'all' ||
    raw === 'models' ||
    raw === 'tests' ||
    raw === 'seeds' ||
    raw === 'snapshots' ||
    raw === 'operations'
  ) {
    return raw;
  }
  return null;
}

/**
 * Runs lens: omit `adapter` → show columns when data exists (default on).
 * `adapter=0` / `false` / `no` hides; `adapter=1` / `true` / `yes` is explicit show.
 */
export function parseShowAdapterMetrics(search: string): boolean {
  const raw = new URLSearchParams(search).get('adapter');
  if (raw == null || raw === '') return true;
  const v = raw.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

export function parseLineageLensMode(search: string): LineageViewState['lensMode'] | null {
  const raw = new URLSearchParams(search).get('lens');
  if (raw === 'status' || raw === 'type' || raw === 'coverage') return raw;
  return null;
}

export function parseLineageUpstreamDepth(search: string): number | null {
  const raw = new URLSearchParams(search).get('up');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseLineageDownstreamDepth(search: string): number | null {
  const raw = new URLSearchParams(search).get('down');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseLineageAllDepsMode(search: string): boolean | null {
  const raw = new URLSearchParams(search).get('allDeps');
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

function clampLineageDepth(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function buildInitialLineageViewState(search: string): LineageViewState {
  const resourceId = parseSelectedResourceId(search);
  const selectedParam = new URLSearchParams(search).get('selected');
  const explicitTab = parseAssetTab(search);
  const lineageLike = viewParamImpliesInventoryLineageTab(search) || explicitTab === 'lineage';

  const up = parseLineageUpstreamDepth(search);
  const down = parseLineageDownstreamDepth(search);
  const allDeps = parseLineageAllDepsMode(search);
  const lens = parseLineageLensMode(search);

  return {
    rootResourceId: resourceId,
    selectedResourceId: lineageLike ? (selectedParam ?? resourceId) : resourceId,
    upstreamDepth: clampLineageDepth(up ?? 2),
    downstreamDepth: clampLineageDepth(down ?? 2),
    allDepsMode: allDeps ?? false,
    lensMode: lens ?? 'type',
    activeLegendKeys: new Set(),
  };
}

export const SIDEBAR_STORAGE_KEY = 'dbt-tools.sidebarCollapsed';

export function getInitialSidebarCollapsed(fallback = true): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return fallback;
}

export function isNavigationTargetActive(
  target: SidebarNavigationTarget,
  activeView: WorkspaceView,
): boolean {
  return resolveView(activeView) === target.view;
}

export function getActiveNavigationItem(activeView: WorkspaceView): SidebarNavigationTarget {
  return (
    navigationItems.find((item) => isNavigationTargetActive(item, activeView)) ?? navigationItems[0]
  );
}
