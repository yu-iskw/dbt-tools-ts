import { useEffect } from 'react';

import { DEFAULT_REMOTE_POLL_INTERVAL_MS } from '@web/constants/managed-artifact-errors';

import { debug } from '../debug';
import { refreshArtifactSourceStatus } from '../services/artifact-api';

import type { ArtifactSourceStatus, RemoteArtifactRun } from '../services/artifact-source-api';
import type { WorkspaceArtifactSource } from '../services/artifact-source-api';

/**
 * Polls `/api/artifact-source/refresh` while the workspace is in remote mode so
 * the UI can surface `pendingRun` when a newer complete pair appears on the bucket.
 */
export function useRemoteArtifactPoll(
  analysisSource: WorkspaceArtifactSource | null,
  setPendingRemoteRun: (run: RemoteArtifactRun | null) => void,
  setRemotePollIntervalMs: (ms: number | null) => void,
  remotePollIntervalMs: number | null,
  onPollStatus?: (status: ArtifactSourceStatus) => void,
  onPollError?: (message: string | null) => void,
): void {
  useEffect(() => {
    if (analysisSource !== 'remote') {
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      onPollError?.(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const status = await refreshArtifactSourceStatus();
        if (!cancelled) {
          setPendingRemoteRun(status.pendingRun);
          setRemotePollIntervalMs(status.pollIntervalMs);
          onPollStatus?.(status);
          const refreshMessage =
            status.discoveryError != null && status.discoveryError.trim() !== ''
              ? status.discoveryError
              : null;
          onPollError?.(refreshMessage);
        }
      } catch (pollError) {
        debug('Artifact source poll failed', pollError);
        if (!cancelled) {
          onPollError?.(
            pollError instanceof Error
              ? pollError.message
              : 'Failed to refresh remote artifact source',
          );
        }
      }
    };

    const intervalMs =
      remotePollIntervalMs != null && remotePollIntervalMs > 0
        ? remotePollIntervalMs
        : DEFAULT_REMOTE_POLL_INTERVAL_MS;

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    analysisSource,
    remotePollIntervalMs,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    onPollStatus,
    onPollError,
  ]);
}
