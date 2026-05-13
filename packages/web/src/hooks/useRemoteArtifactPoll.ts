import { useEffect } from 'react';
import { debug } from '../debug';
import { fetchArtifactSourceStatus } from '../services/artifactApi';
import type { WorkspaceArtifactSource } from '@web/lib/artifactSourceKind';
import type { ArtifactSourceStatus, RemoteArtifactRun } from '../services/artifactSourceApi';

/**
 * Polls `/api/artifact-source` while the workspace is in remote mode so the UI
 * can surface `pendingRun` when a newer complete pair appears on the bucket.
 */
export function useRemoteArtifactPoll(
  analysisSource: WorkspaceArtifactSource | null,
  setPendingRemoteRun: (run: RemoteArtifactRun | null) => void,
  setRemotePollIntervalMs: (ms: number | null) => void,
  remotePollIntervalMs: number | null,
  onPollStatus?: (status: ArtifactSourceStatus) => void,
): void {
  useEffect(() => {
    if (analysisSource !== 'remote') {
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const status = await fetchArtifactSourceStatus();
        if (!cancelled) {
          setPendingRemoteRun(status.pendingRun);
          setRemotePollIntervalMs(status.pollIntervalMs);
          onPollStatus?.(status);
        }
      } catch (pollError) {
        debug('Artifact source poll failed', pollError);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, remotePollIntervalMs ?? 30_000);
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
  ]);
}
