// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceUrlState, type UseWorkspaceUrlStateResult } from './use-workspace-url-state';

import type { WorkspacePreferences } from './use-workspace-preferences';
import type { AnalysisState } from '@web/types';

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

function mountHook(analysis: AnalysisState | null = null) {
  const ref: { current: UseWorkspaceUrlStateResult | null } = { current: null };
  function Probe() {
    ref.current = useWorkspaceUrlState(preferences, analysis);
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

  it('shows tests and clears a conflicting search when opening a test in Timeline', () => {
    const analysis = {
      projectName: 'p',
      executions: [],
      resources: [],
      dependencyIndex: {},
      ganttData: [
        {
          unique_id: 'model.p.orders',
          name: 'orders',
          start: 0,
          end: 10,
          duration: 10,
          status: 'success',
          resourceType: 'model',
          packageName: 'p',
          path: null,
          parentId: null,
        },
        {
          unique_id: 'test.p.not_null_orders_id',
          name: 'not_null_orders_id',
          start: 10,
          end: 12,
          duration: 2,
          status: 'pass',
          resourceType: 'test',
          packageName: 'p',
          path: null,
          parentId: 'model.p.orders',
        },
      ],
    } as unknown as AnalysisState;
    const ref = mountHook(analysis);
    act(() => ref.current!.setTimelineFilters((c) => ({ ...c, query: 'customers' })));
    act(() =>
      ref.current!.handleNavigateTo('timeline', { executionId: 'test.p.not_null_orders_id' }),
    );

    expect(ref.current!.timelineFilters.selectedExecutionId).toBe('test.p.not_null_orders_id');
    expect(ref.current!.timelineFilters.showTests).toBe(true);
    expect(ref.current!.timelineFilters.query).toBe('');
  });
});
