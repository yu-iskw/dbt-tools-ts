import { useEffect, useRef } from 'react';

import { DEFAULT_REMOTE_POLL_INTERVAL_MS } from '@web/constants/managed-artifact-errors';

import { debug } from '../debug';
import { refreshArtifactSourceStatus } from '../services/artifact-api';

import type {
  ArtifactSourceStatus,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '../services/artifact-source-api';

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
  /** When true, polling is paused (e.g. while accepting a pending run). */
  pollPaused = false,
): void {
  const pollSeqRef = useRef(0);
  const intervalMsRef = useRef(DEFAULT_REMOTE_POLL_INTERVAL_MS);

  useEffect(() => {
    intervalMsRef.current =
      remotePollIntervalMs != null && remotePollIntervalMs > 0
        ? remotePollIntervalMs
        : DEFAULT_REMOTE_POLL_INTERVAL_MS;
  }, [remotePollIntervalMs]);

  useEffect(() => {
    if (analysisSource !== 'remote') {
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      onPollError?.(null);
      return;
    }

    if (pollPaused) {
      return;
    }

    let cancelled = false;

    const applyStatus = (status: ArtifactSourceStatus) => {
      setPendingRemoteRun(status.pendingRun);
      setRemotePollIntervalMs(status.pollIntervalMs);
      onPollStatus?.(status);
      const refreshMessage =
        status.discoveryError != null && status.discoveryError.trim() !== ''
          ? status.discoveryError
          : null;
      onPollError?.(refreshMessage);
    };

    const poll = async () => {
      if (cancelled || pollPaused) return;
      const seq = ++pollSeqRef.current;
      try {
        const status = await refreshArtifactSourceStatus();
        if (cancelled || pollPaused || seq !== pollSeqRef.current) {
          return;
        }
        applyStatus(status);
      } catch (pollError) {
        debug('Artifact source poll failed', pollError);
        if (cancelled || pollPaused || seq !== pollSeqRef.current) {
          return;
        }
        onPollError?.(
          pollError instanceof Error
            ? pollError.message
            : 'Failed to refresh remote artifact source',
        );
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, intervalMsRef.current);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    analysisSource,
    pollPaused,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    onPollStatus,
    onPollError,
  ]);
}
