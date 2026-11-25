// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimelineView } from './TimelineView';

import type { TimelineFilterState } from '@web/lib/analysis-workspace/types';
import type { AnalysisState } from '@web/types';

vi.mock('./GanttChart', () => ({
  GanttChart: ({ onSelect }: { onSelect: (id: string | null) => void }) => (
    <button type="button" onClick={() => onSelect('model.pkg.orders')}>
      pick orders bar
    </button>
  ),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const ORDERS_ID = 'model.pkg.orders';
const ERROR_MESSAGE = 'Database Error: relation "raw_orders" does not exist';

const analysis = {
  projectName: 'pkg',
  runStartedAt: null,
  summary: {},
  graphSummary: {},
  ganttData: [
    {
      unique_id: ORDERS_ID,
      name: 'orders',
      start: 0,
      end: 2500,
      duration: 2500,
      status: 'error',
      resourceType: 'model',
      packageName: 'pkg',
      path: 'models/orders.sql',
      parentId: null,
    },
  ],
  executions: [
    {
      uniqueId: ORDERS_ID,
      name: 'orders',
      resourceType: 'model',
      packageName: 'pkg',
      path: 'models/orders.sql',
      status: 'error',
      statusTone: 'danger',
      executionTime: 2.5,
      threadId: 'Thread-1',
      start: 0,
      end: 2500,
      runResultMessage: ERROR_MESSAGE,
    },
  ],
  resources: [
    {
      uniqueId: ORDERS_ID,
      name: 'orders',
      resourceType: 'model',
      packageName: 'pkg',
      statusTone: 'danger',
    },
  ],
  dependencyIndex: {},
  timelineAdjacency: {},
} as unknown as AnalysisState;

const initialFilters: TimelineFilterState = {
  query: '',
  activeStatuses: new Set(),
  activeTypes: new Set(),
  selectedExecutionId: null,
  showTests: false,
  failuresOnly: false,
  dependencyDirection: 'both',
  dependencyDepthHops: 1,
  timeWindow: null,
  neighborhoodRowsShowAll: false,
};

describe('TimelineView node inspector', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigateTo = vi.fn();

  function Harness() {
    const [filters, setFilters] = useState(initialFilters);
    return (
      <TimelineView
        analysis={analysis}
        filters={filters}
        setFilters={setFilters}
        onInvestigationSelectionChange={vi.fn()}
        onNavigateTo={onNavigateTo}
      />
    );
  }

  const button = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === text,
    ) as HTMLButtonElement | undefined;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    onNavigateTo.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    act(() => root.unmount());
    container.remove();
  });

  it('shows no inspector until a bar is selected', () => {
    expect(container.querySelector('.entity-inspector')).toBeNull();
  });

  it('shows the selected node with its run error, stats and the other views', () => {
    act(() => button('pick orders bar')!.click());

    const inspector = container.querySelector('.entity-inspector') as HTMLElement;
    expect(inspector.textContent).toContain('orders');
    expect(inspector.textContent).toContain(ERROR_MESSAGE);
    expect(inspector.textContent).toContain('2.50s');
    expect(button('Open in Inventory')).toBeTruthy();
    expect(button('Open in Runs')).toBeTruthy();
    expect(button('Open in Lineage')).toBeTruthy();
    expect(button('Open in Timeline')).toBeUndefined();
    expect(inspector.querySelector('[aria-label="Copy unique ID"]')).toBeTruthy();
  });

  it('opens the Inventory summary for the selected node', () => {
    act(() => button('pick orders bar')!.click());
    act(() => button('Open in Inventory')!.click());

    expect(onNavigateTo).toHaveBeenCalledWith('inventory', {
      resourceId: ORDERS_ID,
      assetTab: 'summary',
    });
  });

  it('closes the inspector and clears the selection', () => {
    act(() => button('pick orders bar')!.click());
    act(() => (container.querySelector('[aria-label="Close inspector"]') as HTMLElement).click());

    expect(container.querySelector('.entity-inspector')).toBeNull();
  });
});
