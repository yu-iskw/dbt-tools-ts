// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LineagePanel } from './LineagePanel';

import type { NodeActionContext } from '@web/lib/analysis-workspace/node-actions';
import type { ResourceNode } from '@web/types';

const resource = {
  uniqueId: 'model.jaffle_shop.orders',
  name: 'orders',
  resourceType: 'model',
  packageName: 'jaffle_shop',
  path: null,
  originalFilePath: null,
  description: null,
  status: 'success',
  statusTone: 'positive',
  executionTime: 1,
  threadId: 'Thread-1',
  warehouseLocation: null,
} as unknown as ResourceNode;

const noActions: NodeActionContext = {
  timelineIds: new Set(),
  executedIds: new Set(),
  resourceIds: new Set(),
};

const roots: Root[] = [];

function renderPanel(
  container: HTMLDivElement,
  overrides: Partial<Parameters<typeof LineagePanel>[0]> = {},
): void {
  const root = createRoot(container);
  act(() => {
    root.render(
      <LineagePanel
        resource={resource}
        dependencySummary={undefined}
        dependencyIndex={{}}
        resourceById={new Map([[resource.uniqueId, resource]])}
        upstreamDepth={1}
        downstreamDepth={1}
        allDepsMode={false}
        lensMode="type"
        activeLegendKeys={new Set()}
        setUpstreamDepth={vi.fn()}
        setDownstreamDepth={vi.fn()}
        setAllDepsMode={vi.fn()}
        setLensMode={vi.fn()}
        setActiveLegendKeys={vi.fn()}
        onSelectResource={vi.fn()}
        nodeActionContext={noActions}
        onNavigateTo={vi.fn()}
        displayMode="summary"
        {...overrides}
      />,
    );
  });
  roots.push(root);
}

describe('LineagePanel Group by control in summary mode', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    container?.remove();
  });

  it('renders the Group by control in the card header next to Expand lineage', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const setGroupBy = vi.fn();
    renderPanel(container, { groupBy: 'none', setGroupBy });

    const group = container.querySelector('[role="group"][aria-label="Group by"]');
    expect(group).not.toBeNull();
    const buttons = [...(group?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
    expect(buttons).toEqual(['None', 'Warehouse']);

    const expand = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Expand lineage',
    );
    expect(expand).toBeDefined();
    expect(expand?.closest('.lineage-toolbar')).toBe(group?.parentElement);
  });

  it('calls setGroupBy with warehouse when Warehouse is clicked', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const setGroupBy = vi.fn();
    renderPanel(container, { groupBy: 'none', setGroupBy });

    const warehouse = [...container.querySelectorAll('[role="group"] button')].find(
      (b) => b.textContent === 'Warehouse',
    ) as HTMLButtonElement;

    act(() => {
      warehouse.click();
    });

    expect(setGroupBy).toHaveBeenCalledWith('warehouse');
  });

  it('omits the Group by control when setGroupBy is not provided', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderPanel(container);

    expect(container.querySelector('[role="group"][aria-label="Group by"]')).toBeNull();
    const expand = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Expand lineage',
    );
    expect(expand).toBeDefined();
  });

  it('draws focused-size nodes in the expanded dialog opened from the compact card', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderPanel(container);
    const nodeHeights = () =>
      [...document.body.querySelectorAll('rect.dependency-graph__node')].map((el) =>
        el.getAttribute('height'),
      );
    expect(nodeHeights()).toEqual(['64']);

    const expand = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Expand lineage',
    ) as HTMLButtonElement;
    act(() => {
      expand.click();
    });

    expect(nodeHeights()).toEqual(['64', '80']);
  });
});
