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
    lineageGroupBy: 'none',
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

describe('useWorkspaceUrlState arrival resets', () => {
  const staleRuns = {
    kind: 'tests' as const,
    status: 'danger' as const,
    query: 'old search',
    materializationKinds: new Set(['table' as const]),
  };

  it('clears stale Runs filters when arriving with an executionId', () => {
    const ref = mountHook();
    act(() => ref.current!.setRunsViewState((c) => ({ ...c, ...staleRuns })));
    act(() => ref.current!.handleNavigateTo('runs', { executionId: 'model.p.orders' }));

    expect(ref.current!.runsViewState.kind).toBe('all');
    expect(ref.current!.runsViewState.status).toBe('all');
    expect(ref.current!.runsViewState.query).toBe('');
    expect(ref.current!.runsViewState.materializationKinds.size).toBe(0);
    expect(ref.current!.runsViewState.selectedExecutionId).toBe('model.p.orders');
  });

  it('keeps the requested status but clears the stale search when arriving with runsStatus', () => {
    const ref = mountHook();
    act(() => ref.current!.setRunsViewState((c) => ({ ...c, ...staleRuns })));
    act(() => ref.current!.handleNavigateTo('runs', { runsStatus: 'warning' }));

    expect(ref.current!.runsViewState.status).toBe('warning');
    expect(ref.current!.runsViewState.kind).toBe('all');
    expect(ref.current!.runsViewState.query).toBe('');
    expect(ref.current!.runsViewState.materializationKinds.size).toBe(0);
  });

  it('leaves Runs filters alone when another view is opened with an executionId', () => {
    const ref = mountHook();
    act(() => ref.current!.setRunsViewState((c) => ({ ...c, ...staleRuns })));
    act(() => ref.current!.handleNavigateTo('timeline', { executionId: 'model.p.orders' }));

    expect(ref.current!.runsViewState.status).toBe('danger');
    expect(ref.current!.runsViewState.query).toBe('old search');
  });

  it('selects the node in Timeline, keeps the user filters, and drops a zoom window', () => {
    const ref = mountHook();
    act(() =>
      ref.current!.setTimelineFilters((c) => ({
        ...c,
        query: 'customers',
        timeWindow: { start: 0, end: 5 },
      })),
    );
    act(() =>
      ref.current!.handleNavigateTo('timeline', { executionId: 'test.p.not_null_orders_id' }),
    );

    expect(ref.current!.timelineFilters.selectedExecutionId).toBe('test.p.not_null_orders_id');
    expect(ref.current!.timelineFilters.query).toBe('customers');
    expect(ref.current!.timelineFilters.timeWindow).toBeNull();
  });

  it('sets the Runs search from resourceId after clearing stale filters', () => {
    const ref = mountHook();
    act(() => ref.current!.setRunsViewState((c) => ({ ...c, ...staleRuns })));
    act(() =>
      ref.current!.handleNavigateTo('runs', {
        executionId: 'model.p.orders',
        resourceId: 'model.p.orders',
      }),
    );

    expect(ref.current!.runsViewState.query).toBe('model.p.orders');
    expect(ref.current!.runsViewState.status).toBe('all');
    expect(ref.current!.runsViewState.selectedExecutionId).toBe('model.p.orders');
  });
});

describe('useWorkspaceUrlState lineage group-by preference', () => {
  it('applies the saved group-by default when the preference changes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref: { current: UseWorkspaceUrlStateResult | null } = { current: null };
    function Probe({ prefs }: { prefs: WorkspacePreferences }) {
      ref.current = useWorkspaceUrlState(prefs);
      return null;
    }

    act(() => root.render(<Probe prefs={preferences} />));
    expect(ref.current!.lineageViewState.groupBy).toBe('none');

    act(() =>
      root.render(
        <Probe
          prefs={{
            ...preferences,
            inventoryDefaults: { ...preferences.inventoryDefaults, lineageGroupBy: 'warehouse' },
          }}
        />,
      ),
    );
    expect(ref.current!.lineageViewState.groupBy).toBe('warehouse');

    act(() => root.unmount());
    container.remove();
  });
});
