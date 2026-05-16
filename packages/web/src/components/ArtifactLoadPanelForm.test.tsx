// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactLoadPanelForm } from './ArtifactLoadPanelForm';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderForm(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  for (const node of [...document.body.childNodes]) {
    node.parentNode?.removeChild(node);
  }
});

describe('ArtifactLoadPanelForm', () => {
  it('links load workspace button to readiness region for screen readers', () => {
    const regionId = 'test-readiness-id';
    const { container, root } = renderForm(
      <ArtifactLoadPanelForm
        readinessRegionId={regionId}
        readinessLabel="Press Enter or leave the Location field to scan for artifact runs."
        sourceKind="local"
        onSourceKindChange={vi.fn()}
        location="/tmp"
        onLocationChange={vi.fn()}
        onLocationBlur={vi.fn()}
        onLocationKeyDown={vi.fn()}
        candidateRunIds={[]}
        selectedRunId={null}
        onSelectRunId={vi.fn()}
        discoverLoading={false}
        canLoad={false}
        loadLoading={false}
        loadWorkspaceHint="Press Enter or blur Location to scan, then click Load workspace."
        onLoadWorkspace={vi.fn()}
        impersonatedServiceAccount=""
        onImpersonatedServiceAccountChange={vi.fn()}
      />,
    );
    const loadBtn = container.querySelector('button.primary-action[type="button"]');
    expect(loadBtn).not.toBeNull();
    expect(loadBtn?.getAttribute('aria-describedby')).toBe(regionId);
    const region = document.getElementById(regionId);
    expect(region?.textContent).toBe(
      'Press Enter or leave the Location field to scan for artifact runs.',
    );
    cleanupRoot(root, container);
  });

  it('shows impersonation field only for GCS with help text', () => {
    const noop = vi.fn();
    const { container: c1, root: r1 } = renderForm(
      <ArtifactLoadPanelForm
        readinessRegionId="r"
        readinessLabel=""
        sourceKind="local"
        onSourceKindChange={noop}
        location=""
        onLocationChange={noop}
        onLocationBlur={noop}
        onLocationKeyDown={noop}
        impersonatedServiceAccount=""
        onImpersonatedServiceAccountChange={noop}
        candidateRunIds={[]}
        selectedRunId={null}
        onSelectRunId={noop}
        discoverLoading={false}
        canLoad={false}
        loadLoading={false}
        loadWorkspaceHint={undefined}
        onLoadWorkspace={noop}
      />,
    );
    expect(c1.textContent).not.toContain('Impersonated service account');
    cleanupRoot(r1, c1);

    const { container: c3, root: r3 } = renderForm(
      <ArtifactLoadPanelForm
        readinessRegionId="r"
        readinessLabel=""
        sourceKind="s3"
        onSourceKindChange={noop}
        location=""
        onLocationChange={noop}
        onLocationBlur={noop}
        onLocationKeyDown={noop}
        impersonatedServiceAccount=""
        onImpersonatedServiceAccountChange={noop}
        candidateRunIds={[]}
        selectedRunId={null}
        onSelectRunId={noop}
        discoverLoading={false}
        canLoad={false}
        loadLoading={false}
        loadWorkspaceHint={undefined}
        onLoadWorkspace={noop}
      />,
    );
    expect(c3.textContent).not.toContain('Impersonated service account');
    cleanupRoot(r3, c3);

    const { container: c2, root: r2 } = renderForm(
      <ArtifactLoadPanelForm
        readinessRegionId="r"
        readinessLabel=""
        sourceKind="gcs"
        onSourceKindChange={noop}
        location=""
        onLocationChange={noop}
        onLocationBlur={noop}
        onLocationKeyDown={noop}
        impersonatedServiceAccount=""
        onImpersonatedServiceAccountChange={noop}
        candidateRunIds={[]}
        selectedRunId={null}
        onSelectRunId={noop}
        discoverLoading={false}
        canLoad={false}
        loadLoading={false}
        loadWorkspaceHint={undefined}
        onLoadWorkspace={noop}
      />,
    );
    expect(c2.textContent).toContain('Impersonated service account');
    expect(c2.textContent).toContain(
      'Uses server-side Google credentials to impersonate this service account for GCS access.',
    );
    expect(document.getElementById('artifact-gcs-impersonated-service-account')).not.toBeNull();
    cleanupRoot(r2, c2);
  });
});
