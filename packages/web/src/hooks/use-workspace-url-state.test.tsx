// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceUrlState, type UseWorkspaceUrlStateResult } from './use-workspace-url-state';

import type { WorkspacePreferences } from './use-workspace-preferences';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const preferences = {
  theme: 'light',
  sidebarCollapsedDefault: true,
  timelineDefaults: {
    showTests: false,
    failuresOnly: false,
    dependencyDirection: 'both',
    dependencyDepthHops: 2,
  },
  inventoryDefaults: {
    explorerMode: 'project',
    lineageLensMode: 'type',
    lineageUpstreamDepth: 2,
    lineageDownstreamDepth: 2,
    allDepsMode: false,
  },
} as WorkspacePreferences;

function mountHook() {
  const ref: { current: UseWorkspaceUrlStateResult | null } = { current: null };
  function Probe() {
    ref.current = useWorkspaceUrlState(preferences);
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  return ref;
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
});

describe('useWorkspaceUrlState handleNavigateTo', () => {
  it('opens Runs with the requested status and all kinds', () => {
    const ref = mountHook();
    act(() => ref.current!.setRunsViewState((c) => ({ ...c, kind: 'models' })));
    act(() => ref.current!.handleNavigateTo('runs', { runsStatus: 'danger' }));

    expect(ref.current!.activeView).toBe('runs');
    expect(ref.current!.runsViewState.status).toBe('danger');
    expect(ref.current!.runsViewState.kind).toBe('all');
  });

  it('leaves the runs status alone when runsStatus is not given', () => {
    const ref = mountHook();
    act(() => ref.current!.handleNavigateTo('runs', { runsStatus: 'warning' }));
    act(() => ref.current!.handleNavigateTo('runs', {}));
    expect(ref.current!.runsViewState.status).toBe('warning');
  });
});
