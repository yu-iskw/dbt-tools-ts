// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bigQueryLocation,
  lineageModelOf,
  noActions,
} from '@web/lib/analysis-workspace/lineage-test-fixtures';

import { LineageGraphSurface } from './LineageGraphSurface';

import type { WarehouseLocation } from '@dbt-tools/core/browser';
import type {
  LineageGraphModel,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineage-model';
import type { ResourceNode } from '@web/types';

function makeResource(id: string, location: WarehouseLocation): ResourceNode {
  return {
    uniqueId: id,
    name: id.split('.').at(-1) ?? id,
    resourceType: 'model',
    packageName: 'jaffle_shop',
    path: null,
    originalFilePath: null,
    description: null,
    status: 'success',
    statusTone: 'positive',
    executionTime: 1,
    threadId: 'Thread-1',
    warehouseLocation: location,
  } as ResourceNode;
}

function makeLayout(
  id: string,
  x: number,
  y: number,
  side: LineageGraphNodeLayout['side'],
  location: WarehouseLocation,
): LineageGraphNodeLayout {
  return {
    resource: makeResource(id, location),
    x,
    y,
    column: 0,
    depth: 0,
    side,
    passCount: 0,
    failCount: 0,
    notExecutedCount: 0,
    skippedCount: 0,
  };
}

/**
 * Synthetic graph: a (raw) -> b (marts, selected) crosses datasets inside one project;
 * c (marts) -> b stays inside the marts dataset. Nothing crosses projects.
 */
function makeGroupedModel(): LineageGraphModel {
  const raw = bigQueryLocation('proj', 'raw', 'raw_orders_table');
  const marts = bigQueryLocation('proj', 'marts');
  const nodeLayouts = new Map<string, LineageGraphNodeLayout>([
    ['model.jaffle_shop.a', makeLayout('model.jaffle_shop.a', 20, 20, 'upstream', raw)],
    ['model.jaffle_shop.b', makeLayout('model.jaffle_shop.b', 320, 20, 'selected', marts)],
    ['model.jaffle_shop.c', makeLayout('model.jaffle_shop.c', 20, 200, 'upstream', marts)],
  ]);
  return lineageModelOf(nodeLayouts, [
    { from: 'model.jaffle_shop.a', to: 'model.jaffle_shop.b' },
    { from: 'model.jaffle_shop.c', to: 'model.jaffle_shop.b' },
  ]);
}

describe('LineageGraphSurface warehouse grouping', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(groupBy: 'none' | 'warehouse') {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <LineageGraphSurface
          model={makeGroupedModel()}
          onSelectResource={vi.fn()}
          activeLegendKeys={new Set()}
          onToggleLegendKey={vi.fn()}
          nodeActionContext={noActions}
          onNavigateTo={vi.fn()}
          groupBy={groupBy}
        />,
      );
    });
  }

  function buttonByText(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`Button not found: ${text}`);
    return found;
  }

  it('renders nested group boxes with labels and a cross-dataset edge in grouped mode', () => {
    render('warehouse');

    expect(container.querySelectorAll('.lineage-group--outer')).toHaveLength(1);
    expect(container.querySelectorAll('.lineage-group--inner')).toHaveLength(2);
    const labels = [...container.querySelectorAll('.lineage-group__label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(
      expect.arrayContaining(['Project: proj', 'Dataset: raw', 'Dataset: marts']),
    );

    expect(container.querySelectorAll('.dependency-graph__edge--cross-inner')).toHaveLength(1);
    expect(container.querySelectorAll('.dependency-graph__edge--cross-outer')).toHaveLength(0);
    expect(container.textContent).toContain('Crosses dataset/schema boundary (1)');
    expect(container.textContent).toContain('1 crossing');
    expect(container.textContent).not.toContain('1 crossings');
  });

  it('"Crossings only" hides the non-crossing edge and the nodes it alone touches', () => {
    render('warehouse');
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(2);
    expect(container.querySelectorAll('.dependency-graph__hotspot')).toHaveLength(3);

    act(() => {
      buttonByText('Crossings only').click();
    });

    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(1);
    expect(container.querySelectorAll('.dependency-graph__edge--cross-inner')).toHaveLength(1);
    // c only touched the non-crossing edge, so it is hidden; the selected node b stays.
    expect(container.querySelectorAll('.dependency-graph__hotspot')).toHaveLength(2);
    expect(buttonByText('Crossings only').getAttribute('aria-pressed')).toBe('true');
  });

  it('does not move a node when dragged in grouped mode and hides Reset layout', () => {
    render('warehouse');
    const nodeRect = () =>
      container.querySelector('rect.dependency-graph__node:not(.dependency-graph__node--selected)');
    const before = nodeRect()?.getAttribute('x');
    const hotspot = container.querySelector('.dependency-graph__hotspot') as HTMLButtonElement;

    act(() => {
      hotspot.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }),
      );
      hotspot.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 200,
          clientY: 180,
          pointerId: 1,
        }),
      );
    });

    expect(nodeRect()?.getAttribute('x')).toBe(before);
    expect(
      [...container.querySelectorAll('button')].some((b) => b.textContent === 'Reset layout'),
    ).toBe(false);
  });

  it('labels nodes with their relation in grouped mode and the dbt name otherwise', () => {
    const titles = () =>
      [...container.querySelectorAll('.dependency-graph__node-title-text')].map(
        (el) => el.textContent,
      );

    render('warehouse');
    expect(titles()).toEqual(expect.arrayContaining(['raw_orders_table', 'b', 'c']));
    expect(titles()).not.toContain('a');
    act(() => {
      root.unmount();
    });
    container.remove();

    render('none');
    expect(titles()).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(titles()).not.toContain('raw_orders_table');
  });

  it('renders no group boxes or crossing legend in ungrouped mode', () => {
    render('none');

    expect(container.querySelectorAll('.lineage-group')).toHaveLength(0);
    expect(container.querySelectorAll('.dependency-graph__edge--cross-inner')).toHaveLength(0);
    expect(container.textContent).not.toContain('Crossings only');
  });
});
