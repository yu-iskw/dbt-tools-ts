// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lineageModelOf, noActions } from '@web/lib/analysis-workspace/lineage-test-fixtures';

import { LineageGraphSurface } from './LineageGraphSurface';

import type {
  LineageGraphModel,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineage-model';
import type { ResourceNode } from '@web/types';

const SELECTED_ID = 'model.pkg.hub';

function layoutFor(id: string, index: number, side: LineageGraphNodeLayout['side']) {
  const resource = {
    uniqueId: id,
    name: id.split('.').at(-1) ?? id,
    resourceType: 'model',
    packageName: 'pkg',
    statusTone: 'neutral',
    warehouseLocation: null,
  } as unknown as ResourceNode;
  return {
    resource,
    x: 20 + (index % 5) * 240,
    y: 20 + Math.floor(index / 5) * 100,
    column: 0,
    depth: 0,
    side,
    passCount: 0,
    failCount: 0,
    notExecutedCount: 0,
    skippedCount: 0,
  } satisfies LineageGraphNodeLayout;
}

/** A hub with `spokes` upstream models plus a chain between the spokes (edges not touching the hub). */
function makeModel(spokes: number): LineageGraphModel {
  const ids = Array.from({ length: spokes }, (_, i) => `model.pkg.s${i}`);
  const nodeLayouts = new Map<string, LineageGraphNodeLayout>([
    [SELECTED_ID, layoutFor(SELECTED_ID, 0, 'selected')],
    ...ids.map((id, i): [string, LineageGraphNodeLayout] => [id, layoutFor(id, i + 1, 'upstream')]),
  ]);
  const hubEdges = ids.map((id) => ({ from: id, to: SELECTED_ID }));
  const chainEdges = ids.slice(1).map((id, i) => ({ from: ids.at(i) ?? id, to: id }));
  return lineageModelOf(nodeLayouts, [...hubEdges, ...chainEdges], {
    svgWidth: 1400,
    svgHeight: 800,
  });
}

describe('LineageGraphSurface dense graphs', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(spokes: number) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <LineageGraphSurface
          model={makeModel(spokes)}
          onSelectResource={vi.fn()}
          activeLegendKeys={new Set()}
          onToggleLegendKey={vi.fn()}
          nodeActionContext={noActions}
          onNavigateTo={vi.fn()}
        />,
      );
    });
  }

  it('rests edges that do not touch the selected node when the graph is dense', () => {
    render(14); // 14 hub edges + 13 chain edges = 27 > 24
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(27);
    expect(container.querySelectorAll('.dependency-graph__edge--resting')).toHaveLength(13);
  });

  it('keeps every edge at full weight in a small graph', () => {
    render(5);
    expect(container.querySelectorAll('.dependency-graph__edge')).toHaveLength(9);
    expect(container.querySelectorAll('.dependency-graph__edge--resting')).toHaveLength(0);
  });

  it('puts an opaque base under every node', () => {
    render(5);
    expect(container.querySelectorAll('rect.dependency-graph__node-base')).toHaveLength(6);
    expect(container.querySelectorAll('rect.dependency-graph__node')).toHaveLength(6);
  });
});
