import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import {
  getInitialSidebarCollapsed,
  SIDEBAR_STORAGE_KEY,
  type NavigationSelectionTarget,
} from '../components/AppShell/app-navigation';
import {
  applySearchToWorkspaceState,
  buildNextUrlFromWorkspaceState,
  createInitialNavigationState,
  mergeTimelineSelection,
} from '../components/AppShell/workspace-url-sync';

import type { WorkspacePreferences } from './use-workspace-preferences';
import type {
  AssetViewState,
  InvestigationSelectionState,
  LineageViewState,
  OverviewFilterState,
  RunsViewState,
  SearchState,
  TimelineFilterState,
  WorkspaceView,
} from '@web/lib/analysis-workspace/types';

export interface UseWorkspaceUrlStateResult {
  activeView: WorkspaceView;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  overviewFilters: OverviewFilterState;
  setOverviewFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  timelineFilters: TimelineFilterState;
  setTimelineFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  setAssetViewState: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  setRunsViewState: Dispatch<SetStateAction<RunsViewState>>;
  lineageViewState: LineageViewState;
  setLineageViewState: Dispatch<SetStateAction<LineageViewState>>;
  searchState: SearchState;
  setSearchState: Dispatch<SetStateAction<SearchState>>;
  investigationSelection: InvestigationSelectionState;
  setInvestigationSelection: Dispatch<SetStateAction<InvestigationSelectionState>>;
  setNavigationTarget: (target: NavigationSelectionTarget) => void;
  handleNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState['activeTab'];
      rootResourceId?: string;
    },
  ) => void;
  frameClass: string;
}

export function useWorkspaceUrlState(
  preferences: WorkspacePreferences,
): UseWorkspaceUrlStateResult {
  const preferencesHydratedRef = useRef(false);
  const initialNavigationState = createInitialNavigationState(window.location.search, preferences);
  const [activeView, setActiveViewRaw] = useState<WorkspaceView>(
    () => initialNavigationState.activeView,
  );
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(() =>
    getInitialSidebarCollapsed(preferences.sidebarCollapsedDefault),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overviewFilters, setOverviewFilters] = useState<OverviewFilterState>({
    status: 'all',
    resourceTypes: new Set(),
    query: '',
  });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterState>(
    () => initialNavigationState.timelineFilters,
  );
  const [assetViewState, setAssetViewState] = useState<AssetViewState>(
    () => initialNavigationState.assetViewState,
  );
  const [runsViewState, setRunsViewState] = useState<RunsViewState>(
    () => initialNavigationState.runsViewState,
  );
  const [lineageViewState, setLineageViewState] = useState<LineageViewState>(
    () => initialNavigationState.lineageViewState,
  );
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    recentResourceIds: [],
    isOpen: false,
  });
  const [investigationSelection, setInvestigationSelection] = useState<InvestigationSelectionState>(
    () => initialNavigationState.investigationSelection,
  );

  const setSidebarCollapsed: (fn: (c: boolean) => boolean) => void = useCallback((fn) => {
    setSidebarCollapsedRaw((current) => {
      const next = fn(current);
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setNavigationTarget = useCallback((target: NavigationSelectionTarget) => {
    setActiveViewRaw(target.view === 'search' ? 'inventory' : target.view);
  }, []);

  const handleNavigateTo = useCallback(
    (
      view: WorkspaceView,
      options?: {
        resourceId?: string;
        executionId?: string;
        assetTab?: AssetViewState['activeTab'];
        rootResourceId?: string;
      },
    ) => {
      setActiveViewRaw(view);
      if (options?.resourceId) {
        setAssetViewState((current) => ({
          ...current,
          selectedResourceId: options.resourceId ?? current.selectedResourceId,
          activeTab: options.assetTab ?? current.activeTab,
        }));
        setLineageViewState((current) => ({
          ...current,
          rootResourceId: options.rootResourceId ?? options.resourceId ?? current.rootResourceId,
          selectedResourceId: options.resourceId ?? current.selectedResourceId,
        }));
      } else if (options?.assetTab && view === 'inventory') {
        setAssetViewState((current) => ({
          ...current,
          activeTab: options.assetTab ?? current.activeTab,
        }));
      }
      if (options?.executionId) {
        setRunsViewState((current) => ({
          ...current,
          selectedExecutionId: options.executionId ?? current.selectedExecutionId,
        }));
        setTimelineFilters((current) =>
          mergeTimelineSelection(current, options.executionId ?? current.selectedExecutionId),
        );
      }
      if (view === 'runs' && options?.resourceId) {
        setRunsViewState((current) => ({
          ...current,
          query: options.resourceId ?? current.query,
        }));
      }
      setInvestigationSelection((current) => ({
        selectedResourceId: options?.resourceId ?? current.selectedResourceId,
        selectedExecutionId: options?.executionId ?? current.selectedExecutionId,
        sourceLens: view,
      }));
    },
    [],
  );

  useEffect(() => {
    const nextUrl = buildNextUrlFromWorkspaceState({
      pathname: window.location.pathname,
      hash: window.location.hash,
      activeView,
      assetViewState,
      runsViewState,
      timelineSelectedExecutionId: timelineFilters.selectedExecutionId,
      lineageViewState,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, '', nextUrl);
    }
  }, [
    activeView,
    assetViewState,
    runsViewState,
    timelineFilters.selectedExecutionId,
    lineageViewState,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const r = applySearchToWorkspaceState(window.location.search);
      if (r.activeView !== undefined) {
        setActiveViewRaw(r.activeView);
      }
      setAssetViewState((c) => r.assetViewState(c));
      setRunsViewState((c) => r.runsViewState(c));
      setTimelineFilters((c) => r.timelineFilters(c));
      setLineageViewState(r.lineageViewState);
      setInvestigationSelection((c) => r.investigationSelection(c));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) {
      preferencesHydratedRef.current = true;
      return;
    }
    setTimelineFilters((current) => ({
      ...current,
      showTests: preferences.timelineDefaults.showTests,
      failuresOnly: preferences.timelineDefaults.failuresOnly,
      dependencyDirection: preferences.timelineDefaults.dependencyDirection,
      dependencyDepthHops: preferences.timelineDefaults.dependencyDepthHops,
    }));
    setAssetViewState((current) => ({
      ...current,
      explorerMode: preferences.inventoryDefaults.explorerMode,
    }));
    setLineageViewState((current) => ({
      ...current,
      upstreamDepth: preferences.inventoryDefaults.lineageUpstreamDepth,
      downstreamDepth: preferences.inventoryDefaults.lineageDownstreamDepth,
      allDepsMode: preferences.inventoryDefaults.allDepsMode,
      lensMode: preferences.inventoryDefaults.lineageLensMode,
    }));
    setSidebarCollapsedRaw(preferences.sidebarCollapsedDefault);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(preferences.sidebarCollapsedDefault));
    } catch {
      // ignore
    }
  }, [preferences]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchState((current) => ({ ...current, isOpen: true }));
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setSearchState((current) => ({ ...current, isOpen: false }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const frameClass = [
    'app-frame',
    sidebarCollapsed ? 'app-frame--sidebar-collapsed' : '',
    sidebarOpen ? 'app-frame--nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    activeView,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    overviewFilters,
    setOverviewFilters,
    timelineFilters,
    setTimelineFilters,
    assetViewState,
    setAssetViewState,
    runsViewState,
    setRunsViewState,
    lineageViewState,
    setLineageViewState,
    searchState,
    setSearchState,
    investigationSelection,
    setInvestigationSelection,
    setNavigationTarget,
    handleNavigateTo,
    frameClass,
  };
}
