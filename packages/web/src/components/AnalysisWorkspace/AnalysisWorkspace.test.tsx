// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisState, MaterializationKind, ResourceNode } from '@web/types';
import type { AssetViewState } from '@web/lib/analysis-workspace/types';
import { AnalysisWorkspace } from './AnalysisWorkspace';

function makeAnalysis(
  resources: ResourceNode[],
  dependencyIndex: AnalysisState['dependencyIndex'] = {},
): AnalysisState {
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      total_edges: 0,
      nodes_by_status: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
    resources,
    projectName: 'pkg',
    executions: [],
    dependencyIndex,
  } as unknown as AnalysisState;
}

function makeModel(
  uniqueId: string,
  name: string,
  path: string,
  overrides: Partial<ResourceNode> = {},
): ResourceNode {
  return {
    uniqueId,
    name,
    resourceType: 'model',
    packageName: 'pkg',
    path,
    originalFilePath: path,
    statusTone: 'neutral',
    ...overrides,
  } as ResourceNode;
}

const baseAssetState: Omit<AssetViewState, 'selectedResourceId'> = {
  activeTab: 'summary',
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
};

const noopRuns = {
  kind: 'all' as const,
  status: 'all' as const,
  query: '',
  resourceTypes: new Set<string>(),
  materializationKinds: new Set<MaterializationKind>(),
  threadIds: new Set<string>(),
  durationBand: 'all' as const,
  sortBy: 'name' as const,
  sortDirection: 'asc' as const,
  groupBy: 'none' as const,
  selectedExecutionId: null,
  showAdapterMetrics: true,
};

const noopLineage = {
  rootResourceId: null,
  selectedResourceId: null,
  upstreamDepth: 2,
  downstreamDepth: 2,
  allDepsMode: false,
  lensMode: 'type' as const,
  activeLegendKeys: new Set<string>(),
};

const noopTimeline = {
  query: '',
  activeStatuses: new Set<string>(),
  activeTypes: new Set<string>(),
  selectedExecutionId: null,
  showTests: false,
  failuresOnly: false,
  dependencyDirection: 'both' as const,
  dependencyDepthHops: 1,
  timeWindow: null,
  neighborhoodRowsShowAll: false,
};

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('AnalysisWorkspace explorer expansion', () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not auto-select a resource; expands project root only when selection is null', async () => {
    const analysis = makeAnalysis([
      makeModel('model.pkg.alpha', 'alpha', 'models/alpha.sql'),
      makeModel('model.pkg.beta', 'beta', 'models/beta.sql'),
    ]);

    let latestAsset: AssetViewState | null = null;

    function Harness() {
      const [asset, setAsset] = useState<AssetViewState>({
        ...baseAssetState,
        selectedResourceId: null,
      });
      latestAsset = asset;
      return (
        <AnalysisWorkspace
          analysis={analysis}
          activeView="inventory"
          analysisSource={null}
          workspaceSignals={[]}
          overviewFilters={{
            status: 'all',
            resourceTypes: new Set(),
            query: '',
          }}
          onOverviewFiltersChange={vi.fn()}
          timelineFilters={noopTimeline}
          onTimelineFiltersChange={vi.fn()}
          assetViewState={asset}
          onAssetViewStateChange={setAsset}
          runsViewState={noopRuns}
          onRunsViewStateChange={vi.fn()}
          lineageViewState={noopLineage}
          onLineageViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />
      );
    }

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
    });

    await vi.waitFor(() => {
      expect(latestAsset?.expandedNodeIds.has('project:branch:pkg')).toBe(true);
    });

    expect(latestAsset).not.toBeNull();
    const assetAfterLoad = latestAsset!;
    expect(assetAfterLoad.selectedResourceId).toBe(null);
    const expanded = assetAfterLoad.expandedNodeIds;
    expect(expanded.has('project:branch:pkg/models')).toBe(false);
  });

  it('merges ancestor branch ids for a deep-linked nested model path', async () => {
    const analysis = makeAnalysis([
      makeModel('model.pkg.deep', 'deep', 'models/nested/deep.sql'),
      makeModel('model.pkg.other', 'other', 'staging/other.sql'),
    ]);

    let latestAsset: AssetViewState | null = null;

    function Harness() {
      const [asset, setAsset] = useState<AssetViewState>({
        ...baseAssetState,
        selectedResourceId: 'model.pkg.deep',
      });
      latestAsset = asset;
      return (
        <AnalysisWorkspace
          analysis={analysis}
          activeView="inventory"
          analysisSource={null}
          workspaceSignals={[]}
          overviewFilters={{
            status: 'all',
            resourceTypes: new Set(),
            query: '',
          }}
          onOverviewFiltersChange={vi.fn()}
          timelineFilters={noopTimeline}
          onTimelineFiltersChange={vi.fn()}
          assetViewState={asset}
          onAssetViewStateChange={setAsset}
          runsViewState={noopRuns}
          onRunsViewStateChange={vi.fn()}
          lineageViewState={noopLineage}
          onLineageViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />
      );
    }

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
    });

    await vi.waitFor(() => {
      expect(latestAsset?.expandedNodeIds.has('project:branch:pkg/models/nested')).toBe(true);
    });

    const expanded = latestAsset!.expandedNodeIds;
    expect(expanded.has('project:branch:pkg')).toBe(true);
    expect(expanded.has('project:branch:pkg/models')).toBe(true);
  });

  it('Fail filter hides model with successful run but failing dbt test; Issues filter shows it', async () => {
    const model = makeModel('model.pkg.orders', 'orders', 'models/orders.sql', {
      statusTone: 'positive',
    });
    const testResource = {
      uniqueId: 'test.pkg.unique_orders_id',
      name: 'unique_orders_id',
      resourceType: 'test',
      packageName: 'pkg',
      path: 'tests/unique.sql',
      originalFilePath: 'tests/unique.sql',
      statusTone: 'danger',
    } as ResourceNode;

    const dependencyIndex: AnalysisState['dependencyIndex'] = {
      'test.pkg.unique_orders_id': {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: 'model.pkg.orders',
            name: 'orders',
            resourceType: 'model',
            depth: 1,
          },
        ],
        downstream: [],
      },
    };

    const analysis = makeAnalysis([model, testResource], dependencyIndex);

    function Harness({ status }: { status: 'danger' | 'issues' }) {
      const [asset, setAsset] = useState<AssetViewState>({
        ...baseAssetState,
        selectedResourceId: null,
        status,
      });
      return (
        <AnalysisWorkspace
          analysis={analysis}
          activeView="inventory"
          analysisSource={null}
          workspaceSignals={[]}
          overviewFilters={{
            status: 'all',
            resourceTypes: new Set(),
            query: '',
          }}
          onOverviewFiltersChange={vi.fn()}
          timelineFilters={noopTimeline}
          onTimelineFiltersChange={vi.fn()}
          assetViewState={asset}
          onAssetViewStateChange={setAsset}
          runsViewState={noopRuns}
          onRunsViewStateChange={vi.fn()}
          lineageViewState={noopLineage}
          onLineageViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />
      );
    }

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness key="danger" status="danger" />);
    });
    await vi.waitFor(() => {
      expect(container.textContent).toMatch(/No resources found/);
    });

    await act(async () => {
      root.render(<Harness key="issues" status="issues" />);
    });
    await vi.waitFor(() => {
      expect(container.textContent).not.toMatch(/No resources found/);
      expect(container.textContent).toMatch(/1\s*of\s*2/);
    });
  });
});
