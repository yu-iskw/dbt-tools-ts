// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LineageGraphSurface } from './LineageGraphSurface';

import type { WarehouseLocation } from '@dbt-tools/core/browser';
import type {
  LineageGraphModel,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineage-model';
import type { NodeActionContext } from '@web/lib/analysis-workspace/node-actions';
import type { ResourceNode } from '@web/types';

const GROUP_COUNT = 10;
const NODES_PER_GROUP = 4;
const SELECTED = 'model.p.sel';
const HUB = 'model.p.hub';

function location(dataset: string): WarehouseLocation {
  return {
    levels: [
      { kind: 'project', label: 'project', name: 'proj' },
      { kind: 'dataset', label: 'dataset', name: dataset },
    ],
    relation: null,
  };
}

function layoutOf(
  id: string,
  dataset: string,
  x: number,
  y: number,
  side: LineageGraphNodeLayout['side'],
): [string, LineageGraphNodeLayout] {
  const resource = {
    uniqueId: id,
    name: id.split('.').at(-1) ?? id,
    resourceType: 'model',
    packageName: 'p',
    path: null,
    originalFilePath: null,
    description: null,
    status: 'success',
    statusTone: 'positive',
    executionTime: 1,
    threadId: null,
    warehouseLocation: location(dataset),
  } as ResourceNode;
  return [
    id,
    {
      resource,
      x,
      y,
      column: 0,
      depth: 0,
      side,
      passCount: 0,
      failCount: 0,
      notExecutedCount: 0,
      skippedCount: 0,
    },
  ];
}

/**
 * g0..g9 hold four models each and all feed a hub, which feeds the selected node. That is 42 nodes
 * and 41 edges, all crossing a dataset boundary.
 */
function makeDenseModel(groups = GROUP_COUNT): LineageGraphModel {
  const entries: Array<[string, LineageGraphNodeLayout]> = [
    layoutOf(SELECTED, 'sel', 620, 20, 'selected'),
    layoutOf(HUB, 'hub', 320, 20, 'upstream'),
  ];
  const graphEdges: Array<{ from: string; to: string }> = [{ from: HUB, to: SELECTED }];
  for (let group = 0; group < groups; group += 1) {
    for (let index = 0; index < NODES_PER_GROUP; index += 1) {
      const id = `model.p.g${group}_${index}`;
      entries.push(
        layoutOf(id, `g${group}`, 20, (group * NODES_PER_GROUP + index) * 100, 'upstream'),
      );
      graphEdges.push({ from: id, to: HUB });
    }
  }
  return {
    upstreamMap: new Map(),
    downstreamMap: new Map(),
    columnNodes: [],
    nodeLayouts: new Map(entries),
    graphEdges,
    svgWidth: 900,
    svgHeight: groups * NODES_PER_GROUP * 100 + 100,
    hasRelatedNodes: true,
    nodeWidth: 200,
    nodeHeight: 60,
    nodeRadius: 12,
    rowGap: 24,
    displayMode: 'focused',
  };
}

const noActions: NodeActionContext = {
  timelineIds: new Set(),
  executedIds: new Set(),
  resourceIds: new Set(),
};

describe('LineageGraphSurface collapsible groups', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(model: LineageGraphModel, groupBy: 'none' | 'warehouse' = 'warehouse') {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <LineageGraphSurface
          model={model}
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

  const summaryCards = () => container.querySelectorAll('.dependency-graph__summary-node');
  const statusLine = () => container.querySelector('.lineage-legend__collapse-status')?.textContent;

  function button(selector: string): HTMLButtonElement {
    const found = container.querySelector<HTMLButtonElement>(selector);
    if (!found) throw new Error(`Not found: ${selector}`);
    return found;
  }

  function buttonByText(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`Button not found: ${text}`);
    return found;
  }

  it('auto-collapses a dense graph to one summary per group but the selected one', () => {
    render(makeDenseModel());

    // Ten groups and the hub collapse.
    expect(summaryCards()).toHaveLength(GROUP_COUNT + 1);
    // 10 bundles into the hub plus the hub to the selected node, instead of 41 edges.
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(GROUP_COUNT + 1);
    expect(statusLine()).toBe('11 groups collapsed, 41 edges bundled');
    const labels = [...container.querySelectorAll('.dependency-graph__bundle-label-text')];
    expect(labels).toHaveLength(GROUP_COUNT);
    expect(labels.every((label) => label.textContent === `×${NODES_PER_GROUP}`)).toBe(true);
  });

  it('keeps the selected node group expanded, with its node drawn', () => {
    render(makeDenseModel());

    expect(container.querySelector('.dependency-graph__hotspot--selected')).not.toBeNull();
    // The hub holds a direct neighbour and still collapses.
    expect(button('button[aria-label^="Expand dataset hub,"]').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('does not offer a toggle for the selected node group', () => {
    render(makeDenseModel());

    expect(container.querySelector('button[aria-label$="dataset sel"]')).toBeNull();
  });

  it('keeps legend crossing counts on real edges whatever is collapsed', () => {
    render(makeDenseModel());
    const collapsedText = container.textContent ?? '';
    expect(collapsedText).toContain('Crosses dataset/schema boundary (41)');
    expect(collapsedText).toContain('41 crossings');

    act(() => {
      buttonByText('Expand all').click();
    });

    const expandedText = container.textContent ?? '';
    expect(expandedText).toContain('Crosses dataset/schema boundary (41)');
    expect(expandedText).toContain('41 crossings');
  });

  it('expands one group from its summary card and collapses it again from its header', () => {
    render(makeDenseModel());
    const summary = button('button[aria-label^="Expand dataset g3,"]');
    expect(summary.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      summary.click();
    });

    expect(summaryCards()).toHaveLength(GROUP_COUNT);
    expect(statusLine()).toBe('10 groups collapsed, 41 edges bundled');
    // g3's four real nodes; the hub stays a summary.
    expect(container.querySelectorAll('.dependency-graph__hotspot--upstream')).toHaveLength(
      NODES_PER_GROUP,
    );

    const header = button('button[aria-label="Collapse dataset g3"]');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      header.click();
    });

    expect(summaryCards()).toHaveLength(GROUP_COUNT + 1);
    expect(button('button[aria-label^="Expand dataset g3,"]').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('expands every group with Expand all and restores every real edge', () => {
    render(makeDenseModel());

    act(() => {
      buttonByText('Expand all').click();
    });

    expect(summaryCards()).toHaveLength(0);
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(41);
    expect(container.querySelectorAll('.dependency-graph__bundle-label')).toHaveLength(0);
    expect(statusLine()).toBe('All groups expanded');
    expect(buttonByText('Expand all').disabled).toBe(true);
  });

  it('collapses every other group with Collapse others', () => {
    render(makeDenseModel());
    act(() => {
      buttonByText('Expand all').click();
    });

    act(() => {
      buttonByText('Collapse others').click();
    });

    // g0..g9 and the hub; only the selected node's group stays open.
    expect(summaryCards()).toHaveLength(GROUP_COUNT + 1);
    expect(statusLine()).toBe('11 groups collapsed, 41 edges bundled');
    expect(buttonByText('Collapse others').disabled).toBe(true);
  });

  it('expands both end groups when a bundle count chip is pressed', () => {
    render(makeDenseModel());
    const chip = button('button[aria-label^="4 edges from g0 to hub"]');

    act(() => {
      chip.click();
    });

    // The bundle between the g0 summary and the hub summary opens both groups.
    expect(summaryCards()).toHaveLength(GROUP_COUNT - 1);
    expect(container.querySelectorAll('.dependency-graph__hotspot--upstream').length).toBe(
      NODES_PER_GROUP + 1,
    );
  });

  it('starts a small grouped graph fully expanded', () => {
    render(makeDenseModel(2));

    expect(summaryCards()).toHaveLength(0);
    expect(statusLine()).toBe('All groups expanded');
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(9);
  });

  it('draws bundle strokes thicker than single edges but never wider than 4px', () => {
    render(makeDenseModel());

    const bundled = [...container.querySelectorAll<SVGPathElement>('.dependency-graph__edge')]
      .map((path) => Number.parseFloat(path.style.strokeWidth))
      .filter((width) => !Number.isNaN(width));
    expect(bundled).toHaveLength(GROUP_COUNT);
    expect(bundled.every((width) => width > 1.4 && width <= 4)).toBe(true);
  });

  it('shows no collapse controls in ungrouped mode', () => {
    render(makeDenseModel(), 'none');

    expect(summaryCards()).toHaveLength(0);
    expect(container.textContent).not.toContain('Expand all');
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(41);
  });
});
