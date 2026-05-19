import type { RemoteArtifactRun } from '@web/services/artifact-source-api';
import type { ReactElement } from 'react';

export interface RemoteUpdateBannerProps {
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onAcceptPendingRemoteRun: () => Promise<void> | void;
}

export function RemoteUpdateBanner({
  pendingRemoteRun,
  acceptingRemoteRun,
  onAcceptPendingRemoteRun,
}: RemoteUpdateBannerProps): ReactElement | null {
  if (pendingRemoteRun == null) return null;

  return (
    <section className="remote-update-banner" aria-label="Remote update available">
      <div className="remote-update-banner__copy">
        <p className="eyebrow">Remote update available</p>
        <strong>{pendingRemoteRun.label}</strong>
        <span>
          A newer complete remote artifact pair is ready. Keep the current investigation until you
          decide to switch.
        </span>
      </div>
      <button
        type="button"
        className="primary-action"
        onClick={() => void onAcceptPendingRemoteRun()}
        disabled={acceptingRemoteRun}
      >
        {acceptingRemoteRun ? 'Switching…' : 'Load latest remote run'}
      </button>
    </section>
  );
}
