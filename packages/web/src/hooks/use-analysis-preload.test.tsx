// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MANAGED_ARTIFACT_BYTES_ERROR } from '@web/constants/managed-artifact-errors';

import { useAnalysisPreload } from './use-analysis-preload';

const { loadCurrentManagedArtifacts } = vi.hoisted(() => ({
  loadCurrentManagedArtifacts: vi.fn(),
}));

vi.mock('../services/artifact-api', () => ({
  loadCurrentManagedArtifacts,
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function PreloadHarness(props: Parameters<typeof useAnalysisPreload>[0]) {
  useAnalysisPreload(props);
  return null;
}

function renderPreload(props: Parameters<typeof useAnalysisPreload>[0]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<PreloadHarness {...props} />);
  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('useAnalysisPreload', () => {
  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('surfaces discoveryError from managed status', async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'remote',
        currentSource: null,
        label: 'Remote',
        checkedAtMs: 1,
        remoteProvider: 's3',
        remoteLocation: 'S3 b/p',
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        discoveryError: 'Prefix not found',
      },
      result: null,
    });

    const setError = vi.fn();
    const { root, container } = renderPreload({
      preloadSupersededRef: { current: false },
      loadGenerationRef: { current: 0 },
      setPreloadLoading: vi.fn(),
      setAnalysis: vi.fn(),
      setAnalysisSource: vi.fn(),
      setPendingRemoteRun: vi.fn(),
      setRemotePollIntervalMs: vi.fn(),
      setError,
      pendingMetricsRef: { current: null },
      setArtifactCapability: vi.fn(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setError).toHaveBeenCalledWith('Prefix not found');
    cleanupRoot(root, container);
  });

  it('sets bytes error when currentSource is set but result is null', async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    loadCurrentManagedArtifacts.mockResolvedValue({
      status: {
        mode: 'remote',
        currentSource: 'remote',
        label: 'Remote',
        checkedAtMs: 1,
        remoteProvider: 's3',
        remoteLocation: 'S3 b/p',
        pollIntervalMs: 15_000,
        currentRun: { runId: 'r1', label: 'r1', updatedAtMs: 1, versionToken: 't1' },
        pendingRun: null,
        supportsSwitch: false,
        discoveryError: null,
      },
      result: null,
    });

    const setError = vi.fn();
    const setAnalysisSource = vi.fn();

    const { root, container } = renderPreload({
      preloadSupersededRef: { current: false },
      loadGenerationRef: { current: 0 },
      setPreloadLoading: vi.fn(),
      setAnalysis: vi.fn(),
      setAnalysisSource,
      setPendingRemoteRun: vi.fn(),
      setRemotePollIntervalMs: vi.fn(),
      setError,
      pendingMetricsRef: { current: null },
      setArtifactCapability: vi.fn(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setError).toHaveBeenCalledWith(MANAGED_ARTIFACT_BYTES_ERROR);
    expect(setAnalysisSource).toHaveBeenCalledWith('remote');
    cleanupRoot(root, container);
  });

  it('ignores stale preload when load generation advances', async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let resolveLoad!: (value: Awaited<ReturnType<typeof loadCurrentManagedArtifacts>>) => void;
    loadCurrentManagedArtifacts.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const setAnalysis = vi.fn();
    const loadGenerationRef = { current: 0 };

    const { root, container } = renderPreload({
      preloadSupersededRef: { current: false },
      loadGenerationRef,
      setPreloadLoading: vi.fn(),
      setAnalysis,
      setAnalysisSource: vi.fn(),
      setPendingRemoteRun: vi.fn(),
      setRemotePollIntervalMs: vi.fn(),
      setError: vi.fn(),
      pendingMetricsRef: { current: null },
      setArtifactCapability: vi.fn(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    loadGenerationRef.current = 1;

    await act(async () => {
      resolveLoad({
        status: {
          mode: 'preload',
          currentSource: 'preload',
          label: 'Live',
          checkedAtMs: 1,
          remoteProvider: null,
          remoteLocation: null,
          pollIntervalMs: null,
          currentRun: null,
          pendingRun: null,
          supportsSwitch: false,
        },
        result: {
          analysis: { projectName: 'stale' } as never,
          metrics: { requestId: 1, source: 'preload', timings: {}, dispatchMarkName: 'm' },
        },
      });
      await Promise.resolve();
    });

    expect(setAnalysis).not.toHaveBeenCalled();
    cleanupRoot(root, container);
  });
});
