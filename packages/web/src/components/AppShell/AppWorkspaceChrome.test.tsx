// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWorkspaceChrome } from './AppWorkspaceChrome';

import type { ArtifactLocationSnapshot } from '@web/lib/artifact-source';
import type { AnalysisState } from '@web/types';

const mockOmniboxResults = vi.fn(() => ({ results: [], loading: false }));

vi.mock('../AnalysisWorkspace', () => ({
  AnalysisWorkspace: () => <div data-testid="analysis-workspace" />,
}));

vi.mock('./AppSidebar', () => ({
  AppSidebar: () => <aside data-testid="app-sidebar" />,
}));

vi.mock('@web/hooks/use-omnibox-results', () => ({
  useOmniboxResults: () => mockOmniboxResults(),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function makeWorkspace() {
  return {
    activeView: 'health',
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    overviewFilters: { status: 'all', resourceTypes: new Set(), query: '' },
    setOverviewFilters: vi.fn(),
    timelineFilters: {
      query: '',
      activeStatuses: new Set(),
      activeTypes: new Set(),
      selectedExecutionId: null,
      showTests: false,
      failuresOnly: false,
      dependencyDirection: 'both',
      dependencyDepthHops: 1,
      timeWindow: null,
      neighborhoodRowsShowAll: false,
    },
    setTimelineFilters: vi.fn(),
    assetViewState: {
      activeTab: 'summary',
      selectedResourceId: null,
      expandedNodeIds: new Set(),
      explorerMode: 'project',
      status: 'all',
      resourceTypes: new Set(),
      materializationKinds: new Set(),
      resourceQuery: '',
      upstreamDepth: 2,
      downstreamDepth: 2,
      allDepsMode: false,
      lensMode: 'type',
      activeLegendKeys: new Set(),
    },
    setAssetViewState: vi.fn(),
    runsViewState: {
      kind: 'all',
      status: 'all',
      query: '',
      resourceTypes: new Set(),
      materializationKinds: new Set(),
      threadIds: new Set(),
      durationBand: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      groupBy: 'none',
      selectedExecutionId: null,
      showAdapterMetrics: true,
    },
    setRunsViewState: vi.fn(),
    lineageViewState: {
      rootResourceId: null,
      selectedResourceId: null,
      upstreamDepth: 2,
      downstreamDepth: 2,
      allDepsMode: false,
      lensMode: 'type',
      activeLegendKeys: new Set(),
    },
    setLineageViewState: vi.fn(),
    searchState: { query: '', recentResourceIds: [], isOpen: false },
    setSearchState: vi.fn(),
    investigationSelection: {
      selectedResourceId: null,
      selectedExecutionId: null,
      sourceLens: null,
    },
    setInvestigationSelection: vi.fn(),
    setNavigationTarget: vi.fn(),
    handleNavigateTo: vi.fn(),
    frameClass: 'app-frame',
  };
}

function renderChrome(
  analysis: AnalysisState | null,
  artifactLocationSnapshot: ArtifactLocationSnapshot | null = null,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AppWorkspaceChrome
        workspace={makeWorkspace() as never}
        analysis={analysis}
        analysisSource="preload"
        artifactLocationSnapshot={artifactLocationSnapshot}
        error={null}
        preloadLoading={false}
        pendingRemoteRun={null}
        acceptingRemoteRun={false}
        onManagedLoadStarted={vi.fn()}
        onManagedLoadEnded={vi.fn()}
        onManagedAnalysisLoaded={vi.fn()}
        onError={vi.fn()}
        onAcceptPendingRemoteRun={vi.fn(async () => {})}
        themePreference="light"
        setThemePreference={vi.fn()}
        preferences={{
          theme: 'light',
          sidebarCollapsedDefault: true,
          timelineDefaults: {
            showTests: false,
            failuresOnly: false,
            dependencyDirection: 'both',
            dependencyDepthHops: 2,
          },
          inventoryDefaults: {
            explorerMode: 'project',
            lineageLensMode: 'type',
            lineageUpstreamDepth: 2,
            lineageDownstreamDepth: 2,
            allDepsMode: false,
          },
        }}
        setPreferences={vi.fn()}
        workspaceSignals={[]}
      />,
    );
  });

  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.innerHTML = '';
  mockOmniboxResults.mockReset();
  mockOmniboxResults.mockReturnValue({ results: [], loading: false });
});

describe('AppWorkspaceChrome header', () => {
  it('shows invocation metadata instead of asset and execution stats', () => {
    const analysis = {
      resources: new Array(5).fill(null),
      summary: { total_nodes: 78 },
      projectName: 'analytics_pipeline',
      warehouseType: 'Snowflake',
      invocationId: 'abc-123',
      runStartedAt: Date.parse('2024-12-16T07:45:20.000Z'),
    } as unknown as AnalysisState;
    const { container, root } = renderChrome(analysis);

    const headerText = container.querySelector('.app-header')?.textContent ?? '';

    expect(container.querySelector('.app-header__primary-label')).toBeNull();
    expect(container.querySelector('.eyebrow')?.textContent).toBe('analytics_pipeline');
    expect(headerText).not.toContain('Workspace session');
    expect(headerText).toContain('Invocation ID');
    expect(headerText).toContain('abc-123');
    expect(headerText).toContain('Timestamp');
    expect(headerText).toContain('Warehouse type');
    expect(headerText).toContain('Snowflake');
    expect(headerText).not.toContain('assets');
    expect(headerText).not.toContain('executions');
    expect(headerText).toContain('Source mode');
    expect(headerText).toContain('Live target');
    expect(container.querySelector('.app-header__summary-item')).not.toBeNull();
    expect(container.querySelector('.app-header__summary-grid')).not.toBeNull();
    expect(container.querySelector('.app-header__metric-card')).toBeNull();
    expect(container.querySelector('.workspace-search__icon')).not.toBeNull();
    expect(container.querySelector('.app-header__search-control')).not.toBeNull();
    expect(container.querySelector('.app-header__search-shell')).not.toBeNull();
    expect(container.querySelector('.workspace-search.workspace-search--global')).toBeNull();
    expect(container.querySelector('.workspace-search__field')).toBeNull();
    expect(container.querySelector('.app-header__headline')).toBeNull();
    expect(container.querySelector('.app-header__subheadline')).toBeNull();
    expect(container.textContent).not.toContain('Search workspace');
    expect(
      container.querySelector('input[aria-label="Global search"]')?.getAttribute('placeholder'),
    ).toBe('Search runs, pipelines, assets...');
    expect(headerText.match(/Dec/g)?.length ?? 0).toBe(1);

    cleanupRoot(root, container);
  });

  it('renders the fallback header layout when invocation details are missing', () => {
    const analysis = {
      resources: [],
      summary: { total_nodes: 0 },
      invocationId: null,
      runStartedAt: null,
    } as unknown as AnalysisState;
    const { container, root } = renderChrome(analysis);

    expect(container.querySelector('.app-header__primary-label')).toBeNull();
    expect(container.textContent).toContain('Load artifacts to populate session details.');
    expect(container.textContent).toContain('Source mode');
    expect(container.querySelector('.eyebrow')?.textContent).toBe('Workspace session');
    expect(container.textContent).not.toContain('Warehouse type');

    cleanupRoot(root, container);
  });

  it('renders the header shell on the settings destination', () => {
    const workspace = {
      ...makeWorkspace(),
      activeView: 'settings',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={workspace as never}
          analysis={null}
          analysisSource={null}
          artifactLocationSnapshot={null}
          error={null}
          preloadLoading={false}
          pendingRemoteRun={null}
          acceptingRemoteRun={false}
          onManagedLoadStarted={vi.fn()}
          onManagedLoadEnded={vi.fn()}
          onManagedAnalysisLoaded={vi.fn()}
          onError={vi.fn()}
          onAcceptPendingRemoteRun={vi.fn(async () => {})}
          themePreference="system"
          setThemePreference={vi.fn()}
          preferences={{
            theme: 'system',
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: 'both',
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: 'project',
              lineageLensMode: 'type',
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.querySelector('.app-header')).not.toBeNull();
    expect(container.textContent).toContain('Settings');

    cleanupRoot(root, container);
  });

  it('settings session shows configured artifact location when snapshot is set', () => {
    const workspace = {
      ...makeWorkspace(),
      activeView: 'settings',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={workspace as never}
          analysis={
            {
              resources: [],
              summary: { total_nodes: 12 },
            } as unknown as AnalysisState
          }
          analysisSource="preload"
          artifactLocationSnapshot={{
            sourceKind: 'local',
            locationDisplay: '/tmp/dbt-target',
          }}
          error={null}
          preloadLoading={false}
          pendingRemoteRun={null}
          acceptingRemoteRun={false}
          onManagedLoadStarted={vi.fn()}
          onManagedLoadEnded={vi.fn()}
          onManagedAnalysisLoaded={vi.fn()}
          onError={vi.fn()}
          onAcceptPendingRemoteRun={vi.fn(async () => {})}
          themePreference="system"
          setThemePreference={vi.fn()}
          preferences={{
            theme: 'system',
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: 'both',
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: 'project',
              lineageLensMode: 'type',
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.textContent).toContain('Configured location');
    expect(container.textContent).toContain('Local directory');
    expect(container.textContent).toContain('/tmp/dbt-target');

    cleanupRoot(root, container);
  });

  it('shows searching copy while async omnibox results are pending', () => {
    mockOmniboxResults.mockReturnValue({ results: [], loading: true });
    const workspace = {
      ...makeWorkspace(),
      searchState: { query: 'orders', recentResourceIds: [], isOpen: true },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={workspace as never}
          analysis={{ resources: [], summary: { total_nodes: 0 } } as never}
          analysisSource="preload"
          artifactLocationSnapshot={null}
          error={null}
          preloadLoading={false}
          pendingRemoteRun={null}
          acceptingRemoteRun={false}
          onManagedLoadStarted={vi.fn()}
          onManagedLoadEnded={vi.fn()}
          onManagedAnalysisLoaded={vi.fn()}
          onError={vi.fn()}
          onAcceptPendingRemoteRun={vi.fn(async () => {})}
          themePreference="light"
          setThemePreference={vi.fn()}
          preferences={{
            theme: 'light',
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: 'both',
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: 'project',
              lineageLensMode: 'type',
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.textContent).toContain('Searching…');

    cleanupRoot(root, container);
  });

  it('shows no-match copy after async omnibox search completes empty', () => {
    mockOmniboxResults.mockReturnValue({ results: [], loading: false });
    const workspace = {
      ...makeWorkspace(),
      searchState: { query: 'orders', recentResourceIds: [], isOpen: true },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={workspace as never}
          analysis={{ resources: [], summary: { total_nodes: 0 } } as never}
          analysisSource="preload"
          artifactLocationSnapshot={null}
          error={null}
          preloadLoading={false}
          pendingRemoteRun={null}
          acceptingRemoteRun={false}
          onManagedLoadStarted={vi.fn()}
          onManagedLoadEnded={vi.fn()}
          onManagedAnalysisLoaded={vi.fn()}
          onError={vi.fn()}
          onAcceptPendingRemoteRun={vi.fn(async () => {})}
          themePreference="light"
          setThemePreference={vi.fn()}
          preferences={{
            theme: 'light',
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: 'both',
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: 'project',
              lineageLensMode: 'type',
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.textContent).toContain('No matching resources');

    cleanupRoot(root, container);
  });

  it('renders a remote update banner when a newer managed run is pending', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={makeWorkspace() as never}
          analysis={{ resources: [], summary: { total_nodes: 0 } } as never}
          analysisSource="remote"
          artifactLocationSnapshot={null}
          error={null}
          preloadLoading={false}
          pendingRemoteRun={{
            runId: '2026-03-29T13-00-00Z',
            label: 'S3 2026-03-29T13-00-00Z',
            updatedAtMs: 1,
            versionToken: 'v1',
          }}
          acceptingRemoteRun={false}
          onManagedLoadStarted={vi.fn()}
          onManagedLoadEnded={vi.fn()}
          onManagedAnalysisLoaded={vi.fn()}
          onError={vi.fn()}
          onAcceptPendingRemoteRun={vi.fn(async () => {})}
          themePreference="light"
          setThemePreference={vi.fn()}
          preferences={{
            theme: 'light',
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: 'both',
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: 'project',
              lineageLensMode: 'type',
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.textContent).toContain('Remote update available');
    expect(container.textContent).toContain('Load latest remote run');

    cleanupRoot(root, container);
  });
});
