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
});
