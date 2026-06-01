// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRemoteArtifactPoll } from './use-remote-artifact-poll';

import type { RemoteArtifactRun } from '../services/artifact-source-api';

const { refreshArtifactSourceStatus } = vi.hoisted(() => ({
  refreshArtifactSourceStatus: vi.fn(),
}));

vi.mock('../services/artifact-api', () => ({
  refreshArtifactSourceStatus,
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type PollHarnessProps = {
  analysisSource: 'remote' | null;
  setPendingRemoteRun: (run: RemoteArtifactRun | null) => void;
  setRemotePollIntervalMs: (ms: number | null) => void;
  remotePollIntervalMs: number | null;
  pollPaused?: boolean;
};

function PollHarness(props: PollHarnessProps) {
  useRemoteArtifactPoll(
    props.analysisSource,
    props.setPendingRemoteRun,
    props.setRemotePollIntervalMs,
    props.remotePollIntervalMs,
    undefined,
    undefined,
    props.pollPaused,
  );
  return null;
}

function renderPoll(props: PollHarnessProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<PollHarness {...props} />);
  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('useRemoteArtifactPoll', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('ignores stale poll responses when a newer poll completes first', async () => {
    vi.useFakeTimers();

    let resolveSlow!: (value: Awaited<ReturnType<typeof refreshArtifactSourceStatus>>) => void;
    let resolveFast!: (value: Awaited<ReturnType<typeof refreshArtifactSourceStatus>>) => void;

    refreshArtifactSourceStatus
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSlow = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFast = resolve;
          }),
      );

    const setPendingRemoteRun = vi.fn<(run: RemoteArtifactRun | null) => void>();
    const { root, container } = renderPoll({
      analysisSource: 'remote',
      setPendingRemoteRun,
      setRemotePollIntervalMs: vi.fn<(ms: number | null) => void>(),
      remotePollIntervalMs: 50,
      pollPaused: false,
    });

    await act(async () => {
      await Promise.resolve();
    });

    const stalePending = {
      runId: 'stale',
      label: 'stale',
      updatedAtMs: 1,
      versionToken: 'stale',
    };
    const freshPending = {
      runId: 'fresh',
      label: 'fresh',
      updatedAtMs: 2,
      versionToken: 'fresh',
    };

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      resolveFast({
        mode: 'remote',
        currentSource: 'remote',
        label: 'Remote',
        checkedAtMs: 1,
        remoteProvider: 's3',
        remoteLocation: 's3://b/p',
        pollIntervalMs: 50,
        currentRun: null,
        pendingRun: freshPending,
        supportsSwitch: true,
      });
      await Promise.resolve();
    });

    await act(async () => {
      resolveSlow({
        mode: 'remote',
        currentSource: 'remote',
        label: 'Remote',
        checkedAtMs: 1,
        remoteProvider: 's3',
        remoteLocation: 's3://b/p',
        pollIntervalMs: 50,
        currentRun: null,
        pendingRun: stalePending,
        supportsSwitch: true,
      });
      await Promise.resolve();
    });

    expect(setPendingRemoteRun).toHaveBeenCalledWith(freshPending);
    expect(setPendingRemoteRun).not.toHaveBeenCalledWith(stalePending);

    cleanupRoot(root, container);
  });

  it('does not poll while paused', async () => {
    const setPendingRemoteRun = vi.fn<(run: RemoteArtifactRun | null) => void>();
    const { root, container } = renderPoll({
      analysisSource: 'remote',
      setPendingRemoteRun,
      setRemotePollIntervalMs: vi.fn<(ms: number | null) => void>(),
      remotePollIntervalMs: 60_000,
      pollPaused: true,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshArtifactSourceStatus).not.toHaveBeenCalled();
    expect(setPendingRemoteRun).not.toHaveBeenCalled();

    cleanupRoot(root, container);
  });
});
