import { describe, expect, it, vi } from 'vitest';

import {
  applyArtifactSession,
  artifactSessionViewFromStatus,
  DEFAULT_MISSING_OPTIONAL_ARTIFACTS,
} from './artifact-session-state';

import type { ArtifactSourceStatus } from '../services/artifact-source-api';

function minimalStatus(overrides: Partial<ArtifactSourceStatus> = {}): ArtifactSourceStatus {
  return {
    mode: 'remote',
    currentSource: 'remote',
    label: 'Remote',
    checkedAtMs: 1,
    remoteProvider: 's3',
    remoteLocation: 's3://b/p',
    pollIntervalMs: 30_000,
    currentRun: null,
    pendingRun: null,
    supportsSwitch: false,
    sourceKind: 's3',
    locationDisplay: 's3://b/p',
    ...overrides,
  };
}

describe('artifact-session-state', () => {
  it('maps status fields for poll and preload updates', () => {
    const view = artifactSessionViewFromStatus(
      minimalStatus({
        pendingRun: {
          runId: 'run-2',
          label: 'run-2',
          updatedAtMs: 2,
          versionToken: 'v2',
        },
      }),
    );
    expect(view.pendingRemoteRun?.runId).toBe('run-2');
    expect(view.analysisSource).toBe('remote');
    expect(view.missingOptionalArtifacts).toEqual(DEFAULT_MISSING_OPTIONAL_ARTIFACTS);
  });

  it('applyArtifactSession invokes setters once', () => {
    const setPendingRemoteRun = vi.fn();
    const setRemotePollIntervalMs = vi.fn();
    const setAnalysisSource = vi.fn();
    const setArtifactCapability = vi.fn();

    applyArtifactSession({
      status: minimalStatus(),
      setPendingRemoteRun,
      setRemotePollIntervalMs,
      setAnalysisSource,
      setArtifactCapability,
    });

    expect(setPendingRemoteRun).toHaveBeenCalledTimes(1);
    expect(setAnalysisSource).toHaveBeenCalledWith('remote');
  });
});
