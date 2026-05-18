// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactLoadPanelForm, type ArtifactLoadPanelFormProps } from './ArtifactLoadPanelForm';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function mkFormProps(
  overrides: Partial<ArtifactLoadPanelFormProps> = {},
): ArtifactLoadPanelFormProps {
  return {
    readinessRegionId: 'r',
    readinessLabel: '',
    sourceKind: 'local',
    onSourceKindChange: vi.fn(),
    location: '',
    onLocationChange: vi.fn(),
    onLocationBlur: vi.fn(),
    onLocationKeyDown: vi.fn(),
    discoveryError: null,
    onScan: vi.fn(),
    impersonatedServiceAccount: '',
    onImpersonatedServiceAccountChange: vi.fn(),
    discoverLoading: false,
    canLoad: false,
    loadLoading: false,
    loadWorkspaceHint: undefined,
    onLoadWorkspace: vi.fn(),
    ...overrides,
  };
}

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
        {...mkFormProps({
          readinessRegionId: regionId,
          readinessLabel: 'Press Enter or Scan to check this location.',
          location: '/tmp',
          loadWorkspaceHint:
            'Press Enter, blur Location, or click Scan location, then click Load workspace.',
        })}
      />,
    );
    const loadBtn = container.querySelector('button.primary-action[type="button"]');
    expect(loadBtn).not.toBeNull();
    expect(loadBtn?.getAttribute('aria-describedby')).toBe(regionId);
    const region = document.getElementById(regionId);
    expect(region?.textContent).toBe('Press Enter or Scan to check this location.');
    cleanupRoot(root, container);
  });

  it('does not render legacy tip cards', () => {
    const { container, root } = renderForm(<ArtifactLoadPanelForm {...mkFormProps()} />);
    expect(container.querySelector('.upload-panel__tips')).toBeNull();
    cleanupRoot(root, container);
  });

  it('calls onScan when Scan location is clicked', () => {
    const onScan = vi.fn();
    const { container, root } = renderForm(
      <ArtifactLoadPanelForm {...mkFormProps({ location: '/tmp', onScan })} />,
    );
    const scanBtn = container.querySelector(
      'button.secondary-action[type="button"]',
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    cleanupRoot(root, container);
  });

  it('shows inline discovery error when provided', () => {
    const { container, root } = renderForm(
      <ArtifactLoadPanelForm
        {...mkFormProps({
          location: '/bad',
          discoveryError: 'No manifest.json at this path.',
        })}
      />,
    );
    const err = container.querySelector('#artifact-location-error');
    expect(err?.textContent).toBe('No manifest.json at this path.');
    cleanupRoot(root, container);
  });

  it('shows impersonation field only for GCS with help text', () => {
    const { container: c1, root: r1 } = renderForm(
      <ArtifactLoadPanelForm {...mkFormProps({ sourceKind: 'local' })} />,
    );
    expect(c1.textContent).not.toContain('Impersonated service account');
    cleanupRoot(r1, c1);

    const { container: c3, root: r3 } = renderForm(
      <ArtifactLoadPanelForm {...mkFormProps({ sourceKind: 's3' })} />,
    );
    expect(c3.textContent).not.toContain('Impersonated service account');
    cleanupRoot(r3, c3);

    const { container: c2, root: r2 } = renderForm(
      <ArtifactLoadPanelForm {...mkFormProps({ sourceKind: 'gcs' })} />,
    );
    expect(c2.textContent).toContain('Impersonated service account');
    expect(c2.textContent).toContain(
      'Uses server-side Google credentials to impersonate this service account for GCS access.',
    );
    expect(c2.textContent).toContain('run Scan location (or press Enter in Location).');
    expect(document.getElementById('artifact-gcs-impersonated-service-account')).not.toBeNull();
    cleanupRoot(r2, c2);
  });

  it('invokes onImpersonatedServiceAccountBlur when the impersonation field blurs', () => {
    const onImpersonatedServiceAccountBlur = vi.fn();
    const { container, root } = renderForm(
      <ArtifactLoadPanelForm
        {...mkFormProps({
          sourceKind: 'gcs',
          location: 'gs://b/p',
          onImpersonatedServiceAccountBlur,
        })}
      />,
    );
    const input = container.querySelector(
      '#artifact-gcs-impersonated-service-account',
    ) as HTMLInputElement;
    act(() => {
      input.focus();
      input.blur();
    });
    expect(onImpersonatedServiceAccountBlur).toHaveBeenCalledTimes(1);
    cleanupRoot(root, container);
  });
});
