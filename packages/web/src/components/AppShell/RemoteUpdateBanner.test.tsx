// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteUpdateBanner } from './RemoteUpdateBanner';

describe('RemoteUpdateBanner', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders nothing when there is no pending run', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <RemoteUpdateBanner
          pendingRemoteRun={null}
          acceptingRemoteRun={false}
          onAcceptPendingRemoteRun={vi.fn()}
        />,
      );
    });
    expect(container.querySelector('.remote-update-banner')).toBeNull();
    root.unmount();
  });

  it('shows accept action when a pending run exists', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onAccept = vi.fn();
    act(() => {
      root.render(
        <RemoteUpdateBanner
          pendingRemoteRun={{
            runId: 'run-2',
            label: 'GCS run-2',
            updatedAtMs: 1,
            versionToken: 't',
          }}
          acceptingRemoteRun={false}
          onAcceptPendingRemoteRun={onAccept}
        />,
      );
    });
    expect(container.querySelector('.remote-update-banner')).not.toBeNull();
    expect(container.textContent).toContain('GCS run-2');
    const btn = container.querySelector('button');
    expect(btn?.textContent).toContain('Load latest remote run');
    act(() => {
      btn?.click();
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
    root.unmount();
  });
});
