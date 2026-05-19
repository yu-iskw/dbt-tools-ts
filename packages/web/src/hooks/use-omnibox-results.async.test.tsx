// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOmniboxResults } from './use-omnibox-results';

import type { AnalysisState, ResourceNode } from '@web/types';

const { searchResourcesFromWorker } = vi.hoisted(() => ({
  searchResourcesFromWorker: vi.fn(),
}));

vi.mock('@web/services/analysis-loader', () => ({
  searchResourcesFromWorker,
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function analysisWithResources(resources: ResourceNode[]): AnalysisState {
  return {
    resources,
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      total_edges: 0,
      nodes_by_status: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
  } as unknown as AnalysisState;
}

function HookHarness({
  analysis,
  query,
  recentResourceIds,
}: {
  analysis: AnalysisState | null;
  query: string;
  recentResourceIds: string[];
}) {
  const result = useOmniboxResults(analysis, {
    query,
    recentResourceIds,
    isOpen: true,
  });

  return (
    <div
      data-testid="result"
      data-loading={String(result.loading)}
      data-results={result.results.map((item) => item.uniqueId).join(',')}
    />
  );
}

function renderHarness(props: {
  analysis: AnalysisState | null;
  query: string;
  recentResourceIds: string[];
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HookHarness {...props} />);
  });

  return { container, root };
}

function rerenderHarness(
  root: Root,
  props: {
    analysis: AnalysisState | null;
    query: string;
    recentResourceIds: string[];
  },
) {
  act(() => {
    root.render(<HookHarness {...props} />);
  });
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function readResult(container: HTMLElement) {
  const node = container.querySelector('[data-testid="result"]');
  if (!(node instanceof HTMLElement)) {
    throw new Error('Result node missing');
  }
  return {
    loading: node.dataset.loading,
    results: node.dataset.results ?? '',
  };
}

describe('use-omnibox-results', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('marks non-empty queries as loading until the worker responds', async () => {
    const pending = deferred<ResourceNode[]>();
    searchResourcesFromWorker.mockReturnValueOnce(pending.promise);
    const analysis = analysisWithResources([
      {
        uniqueId: 'model.pkg.orders',
        name: 'orders',
        resourceType: 'model',
        packageName: 'pkg',
        path: 'models/orders.sql',
      } as ResourceNode,
    ]);

    const { container, root } = renderHarness({
      analysis,
      query: 'ord',
      recentResourceIds: [],
    });

    expect(readResult(container)).toMatchObject({
      loading: 'true',
      results: '',
    });

    await act(async () => {
      pending.resolve([
        {
          uniqueId: 'model.pkg.orders',
          name: 'orders',
          resourceType: 'model',
          packageName: 'pkg',
          path: 'models/orders.sql',
        } as ResourceNode,
      ]);
      await pending.promise;
    });

    expect(readResult(container)).toMatchObject({
      loading: 'false',
      results: 'model.pkg.orders',
    });

    cleanupRoot(root, container);
  });

  it('ignores stale worker responses after the query changes', async () => {
    const first = deferred<ResourceNode[]>();
    const second = deferred<ResourceNode[]>();
    searchResourcesFromWorker
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const analysis = analysisWithResources([]);
    const { container, root } = renderHarness({
      analysis,
      query: 'or',
      recentResourceIds: [],
    });

    rerenderHarness(root, {
      analysis,
      query: 'ord',
      recentResourceIds: [],
    });

    await act(async () => {
      first.resolve([
        {
          uniqueId: 'model.pkg.old',
          name: 'old',
          resourceType: 'model',
          packageName: 'pkg',
          path: 'models/old.sql',
        } as ResourceNode,
      ]);
      await first.promise;
    });

    expect(readResult(container)).toMatchObject({
      loading: 'true',
      results: '',
    });

    await act(async () => {
      second.resolve([
        {
          uniqueId: 'model.pkg.current',
          name: 'current',
          resourceType: 'model',
          packageName: 'pkg',
          path: 'models/current.sql',
        } as ResourceNode,
      ]);
      await second.promise;
    });

    expect(readResult(container)).toMatchObject({
      loading: 'false',
      results: 'model.pkg.current',
    });

    cleanupRoot(root, container);
  });
});
