// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisState } from '@web/types';
import { useResourceCode } from './useResourceCode';

const { requestResourceCodeFromWorker } = vi.hoisted(() => ({
  requestResourceCodeFromWorker: vi.fn(),
}));

vi.mock('@web/services/analysisLoader', () => ({
  requestResourceCodeFromWorker,
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

function analysis(id: string): AnalysisState {
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
    projectName: id,
    resources: [],
  } as unknown as AnalysisState;
}

function HookHarness({
  uniqueId,
  currentAnalysis,
}: {
  uniqueId: string | null;
  currentAnalysis: AnalysisState | null;
}) {
  const result = useResourceCode(uniqueId, currentAnalysis);
  return (
    <div
      data-testid="result"
      data-compiled={result.compiledCode ?? ''}
      data-raw={result.rawCode ?? ''}
      data-loading={String(result.loading)}
      data-error={result.error ?? ''}
    />
  );
}

function renderHarness(props: { uniqueId: string | null; currentAnalysis: AnalysisState | null }) {
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
    uniqueId: string | null;
    currentAnalysis: AnalysisState | null;
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
    compiled: node.dataset.compiled ?? '',
    raw: node.dataset.raw ?? '',
    loading: node.dataset.loading,
    error: node.dataset.error ?? '',
  };
}

describe('useResourceCode', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('re-fetches when the analysis snapshot changes for the same unique id', async () => {
    const first = deferred<{
      compiledCode: string | null;
      rawCode: string | null;
    }>();
    const second = deferred<{
      compiledCode: string | null;
      rawCode: string | null;
    }>();
    requestResourceCodeFromWorker
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { container, root } = renderHarness({
      uniqueId: 'model.project.orders',
      currentAnalysis: analysis('first'),
    });

    expect(readResult(container)).toMatchObject({
      compiled: '',
      raw: '',
      loading: 'true',
      error: '',
    });

    await act(async () => {
      first.resolve({ compiledCode: 'select 1', rawCode: null });
      await first.promise;
    });

    expect(readResult(container)).toMatchObject({
      compiled: 'select 1',
      raw: '',
      loading: 'false',
    });

    rerenderHarness(root, {
      uniqueId: 'model.project.orders',
      currentAnalysis: analysis('second'),
    });

    expect(requestResourceCodeFromWorker).toHaveBeenCalledTimes(2);
    expect(readResult(container)).toMatchObject({
      compiled: '',
      raw: '',
      loading: 'true',
      error: '',
    });

    await act(async () => {
      second.resolve({ compiledCode: 'select 2', rawCode: null });
      await second.promise;
    });

    expect(readResult(container)).toMatchObject({
      compiled: 'select 2',
      raw: '',
      loading: 'false',
    });

    cleanupRoot(root, container);
  });

  it('ignores a stale response after a newer request starts', async () => {
    const first = deferred<{
      compiledCode: string | null;
      rawCode: string | null;
    }>();
    const second = deferred<{
      compiledCode: string | null;
      rawCode: string | null;
    }>();
    requestResourceCodeFromWorker
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { container, root } = renderHarness({
      uniqueId: 'model.project.orders',
      currentAnalysis: analysis('first'),
    });

    rerenderHarness(root, {
      uniqueId: 'model.project.orders',
      currentAnalysis: analysis('second'),
    });

    await act(async () => {
      first.resolve({ compiledCode: 'stale sql', rawCode: null });
      await first.promise;
    });

    expect(readResult(container)).toMatchObject({
      compiled: '',
      raw: '',
      loading: 'true',
    });

    await act(async () => {
      second.resolve({ compiledCode: 'fresh sql', rawCode: null });
      await second.promise;
    });

    expect(readResult(container)).toMatchObject({
      compiled: 'fresh sql',
      raw: '',
      loading: 'false',
    });

    cleanupRoot(root, container);
  });
});
