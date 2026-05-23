// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnalysisPage } from './use-analysis-page';

import type { AnalysisState } from '@web/types';

const {
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
  refetchFromApi,
  switchToArtifactRun,
} = vi.hoisted(() => ({
  fetchArtifactSourceStatus: vi.fn(),
  loadCurrentManagedArtifacts: vi.fn(),
  refetchFromApi: vi.fn(),
  switchToArtifactRun: vi.fn(),
}));

vi.mock('../services/artifact-api', () => ({
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
  refetchFromApi,
  switchToArtifactRun,
}));

vi.mock('./use-dbt-artifacts-reload', () => ({
  useDbtArtifactsReload: vi.fn(),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function analysis(projectName: string): AnalysisState {
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
    projectName,
    resources: [],
  } as unknown as AnalysisState;
}

function loadResult(projectName: string, source: 'preload' | 'remote' | 'upload') {
  return {
    analysis: analysis(projectName),
    metrics: {
      requestId: 1,
      source,
      dispatchMarkName: `${projectName}-${source}-dispatch`,
      readyMarkName: `${projectName}-${source}-ready`,
      analysisReadyMeasureName: `${projectName}-${source}-measure`,
      timings: {
        decodeMs: 0,
        parseMs: 0,
        graphBuildMs: 0,
        snapshotBuildMs: 0,
        totalWorkerMs: 0,
      },
    },
  };
}

function HookHarness() {
  const result = useAnalysisPage();
  return (
    <div
      data-testid="result"
      data-source={result.analysisSource ?? ''}
      data-project={result.analysis?.projectName ?? ''}
      data-error={result.error ?? ''}
      data-pending={result.pendingRemoteRun?.runId ?? ''}
      data-accepting={String(result.acceptingRemoteRun)}
      data-loading={String(result.preloadLoading)}
      data-snapshot-kind={result.artifactLocationSnapshot?.sourceKind ?? ''}
      data-snapshot-location={result.artifactLocationSnapshot?.locationDisplay ?? ''}
    >
      <button type="button" onClick={() => void result.onAcceptPendingRemoteRun()}>
        accept
      </button>
      <button type="button" onClick={() => result.onLoadDifferent()}>
        reset
      </button>
      <button
        type="button"
        data-testid="simulate-managed-load"
        onClick={() =>
          result.onManagedAnalysisLoaded(loadResult('managed', 'preload'), 'preload', {
            missingCatalog: false,
            missingSources: false,
          })
        }
      >
        managed
      </button>
    </div>
  );
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HookHarness />);
  });

  return { container, root };
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
    source: node.dataset.source ?? '',
    project: node.dataset.project ?? '',
    error: node.dataset.error ?? '',
    pending: node.dataset.pending ?? '',
    accepting: node.dataset.accepting ?? '',
    loading: node.dataset.loading ?? '',
    snapshotKind: node.dataset.snapshotKind ?? '',
    snapshotLocation: node.dataset.snapshotLocation ?? '',
    acceptButton: node.querySelector('button') as HTMLButtonElement | null,
  };
}

describe('use-analysis-page', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    fetchArtifactSourceStatus.mockReset();
    loadCurrentManagedArtifacts.mockReset();
    refetchFromApi.mockReset();
    switchToArtifactRun.mockReset();
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'none',
        currentSource: null,
        label: 'Waiting for artifacts',
        checkedAtMs: Date.now(),
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        sourceKind: null,
        locationDisplay: null,
      },
      result: null,
    });
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('does not apply preload after the user loads a different artifact set', async () => {
    fetchArtifactSourceStatus.mockResolvedValue({
      mode: 'preload',
      currentSource: 'preload',
      label: 'Env preload',
      checkedAtMs: Date.now(),
      remoteProvider: null,
      remoteLocation: null,
      sourceKind: null,
      locationDisplay: null,
      pollIntervalMs: null,
      currentRun: null,
      pendingRun: null,
      supportsSwitch: false,
    });

    let resolvePreload:
      | ((
          value: Awaited<ReturnType<typeof loadCurrentManagedArtifacts>>,
        ) => void)
      | undefined;
    loadCurrentManagedArtifacts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreload = resolve;
        }),
    );

    const { container, root } = renderHarness();

    await act(async () => {
      container.querySelector('[data-testid="simulate-managed-load"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });

    expect(readResult(container).project).toBe('managed');
    expect(readResult(container).loading).toBe('true');

    await act(async () => {
      resolvePreload?.({
        status: {
          mode: 'preload',
          currentSource: 'preload',
          label: 'Env preload',
          checkedAtMs: Date.now(),
          remoteProvider: null,
          remoteLocation: null,
          pollIntervalMs: null,
          currentRun: null,
          pendingRun: null,
          supportsSwitch: false,
          sourceKind: null,
          locationDisplay: null,
        },
        result: loadResult('env-preload', 'preload'),
      });
      await Promise.resolve();
    });

    expect(readResult(container).project).toBe('managed');

    cleanupRoot(root, container);
  });

  it('keeps the current remote analysis loaded while polling surfaces a newer run', async () => {
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'remote',
        currentSource: 'remote',
        label: 'Remote source',
        checkedAtMs: Date.now(),
        remoteProvider: 's3',
        remoteLocation: 'S3 bucket/prefix',
        pollIntervalMs: 2_000,
        currentRun: {
          runId: 'run-1',
          label: 'run-1',
          updatedAtMs: 1_000,
          versionToken: 'run-1',
        },
        pendingRun: null,
        supportsSwitch: false,
        sourceKind: 's3',
        locationDisplay: 'S3 bucket/prefix',
      },
      result: loadResult('run-1', 'remote'),
    });

    fetchArtifactSourceStatus.mockResolvedValue({
      mode: 'remote',
      currentSource: 'remote',
      label: 'Remote source',
      checkedAtMs: Date.now(),
      remoteProvider: 's3',
      remoteLocation: 'S3 bucket/prefix',
      sourceKind: 's3',
      locationDisplay: 'S3 bucket/prefix',
      pollIntervalMs: 2_000,
      currentRun: {
        runId: 'run-1',
        label: 'run-1',
        updatedAtMs: 1_000,
        versionToken: 'run-1',
      },
      pendingRun: {
        runId: 'run-2',
        label: 'run-2',
        updatedAtMs: 2_000,
        versionToken: 'run-2',
      },
      supportsSwitch: true,
    });

    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
    });

    expect(readResult(container)).toMatchObject({
      source: 'remote',
      project: 'run-1',
      pending: 'run-2',
      loading: 'false',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(fetchArtifactSourceStatus).toHaveBeenCalledTimes(2);
    expect(readResult(container)).toMatchObject({
      source: 'remote',
      project: 'run-1',
      pending: 'run-2',
    });

    cleanupRoot(root, container);
  });

  it('switches to a pending remote run only after explicit confirmation', async () => {
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'remote',
        currentSource: 'remote',
        label: 'Remote source',
        checkedAtMs: Date.now(),
        remoteProvider: 'gcs',
        remoteLocation: 'GCS bucket/prefix',
        pollIntervalMs: 5_000,
        currentRun: {
          runId: 'run-1',
          label: 'run-1',
          updatedAtMs: 1_000,
          versionToken: 'run-1',
        },
        pendingRun: {
          runId: 'run-2',
          label: 'run-2',
          updatedAtMs: 2_000,
          versionToken: 'run-2',
        },
        supportsSwitch: true,
        sourceKind: 'gcs',
        locationDisplay: 'GCS bucket/prefix',
      },
      result: loadResult('run-1', 'remote'),
    });

    fetchArtifactSourceStatus.mockResolvedValue({
      mode: 'remote',
      currentSource: 'remote',
      label: 'Remote source',
      checkedAtMs: Date.now(),
      remoteProvider: 'gcs',
      remoteLocation: 'GCS bucket/prefix',
      sourceKind: 'gcs',
      locationDisplay: 'GCS bucket/prefix',
      pollIntervalMs: 5_000,
      currentRun: {
        runId: 'run-1',
        label: 'run-1',
        updatedAtMs: 1_000,
        versionToken: 'run-1',
      },
      pendingRun: {
        runId: 'run-2',
        label: 'run-2',
        updatedAtMs: 2_000,
        versionToken: 'run-2',
      },
      supportsSwitch: true,
    });
    switchToArtifactRun.mockResolvedValue({
      mode: 'remote',
      currentSource: 'remote',
      label: 'Remote source',
      checkedAtMs: Date.now(),
      remoteProvider: 'gcs',
      remoteLocation: 'GCS bucket/prefix',
      pollIntervalMs: 5_000,
      currentRun: {
        runId: 'run-2',
        label: 'run-2',
        updatedAtMs: 2_000,
        versionToken: 'run-2',
      },
      pendingRun: null,
      supportsSwitch: false,
      sourceKind: 'gcs',
      locationDisplay: 'GCS bucket/prefix',
    });
    refetchFromApi.mockResolvedValue(loadResult('run-2', 'remote'));

    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
    });

    expect(readResult(container)).toMatchObject({
      project: 'run-1',
      pending: 'run-2',
      accepting: 'false',
    });

    await act(async () => {
      readResult(container).acceptButton?.click();
      await Promise.resolve();
    });

    expect(switchToArtifactRun).toHaveBeenCalledWith('run-2');
    expect(refetchFromApi).toHaveBeenCalledWith('remote');
    expect(readResult(container)).toMatchObject({
      source: 'remote',
      project: 'run-2',
      pending: '',
      accepting: 'false',
      error: '',
    });

    cleanupRoot(root, container);
  });

  it('hydrates artifact location snapshot from preload status', async () => {
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
        checkedAtMs: Date.now(),
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        sourceKind: 'local',
        locationDisplay: '/tmp/dbt-artifacts',
      },
      result: loadResult('proj', 'preload'),
    });

    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
    });

    expect(readResult(container)).toMatchObject({
      snapshotKind: 'local',
      snapshotLocation: '/tmp/dbt-artifacts',
    });

    cleanupRoot(root, container);
  });

  it('refreshes snapshot after managed load via fetchArtifactSourceStatus', async () => {
    fetchArtifactSourceStatus.mockResolvedValue({
      mode: 'preload',
      currentSource: 'preload',
      label: 'Artifacts',
      checkedAtMs: Date.now(),
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: null,
      pendingRun: null,
      supportsSwitch: false,
      sourceKind: 's3',
      locationDisplay: 'S3 refreshed/prefix',
    });

    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
    });

    const managedBtn = container.querySelector('[data-testid="simulate-managed-load"]');
    expect(managedBtn).not.toBeNull();

    await act(async () => {
      (managedBtn as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(fetchArtifactSourceStatus).toHaveBeenCalled();
    expect(readResult(container)).toMatchObject({
      snapshotKind: 's3',
      snapshotLocation: 'S3 refreshed/prefix',
    });

    cleanupRoot(root, container);
  });

  it('clears artifact location snapshot when load different is invoked', async () => {
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
        checkedAtMs: Date.now(),
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        sourceKind: 'local',
        locationDisplay: '/tmp/x',
      },
      result: loadResult('proj', 'preload'),
    });

    const { container, root } = renderHarness();

    await act(async () => {
      await Promise.resolve();
    });

    expect(readResult(container).snapshotLocation).toBe('/tmp/x');

    const resetBtn = container.querySelectorAll('button')[1];
    await act(() => {
      resetBtn?.click();
    });

    expect(readResult(container).snapshotLocation).toBe('');

    cleanupRoot(root, container);
  });
});
