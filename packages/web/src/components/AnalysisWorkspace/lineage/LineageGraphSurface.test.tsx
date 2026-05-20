// @vitest-environment jsdom

import { buildLineageGraphModel } from '@web/lib/analysis-workspace/lineage-model';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LineageGraphSurface } from './LineageGraphSurface';

import type { ResourceNode } from '@web/types';

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: overrides.uniqueId ?? 'model.jaffle_shop.orders',
    name: overrides.name ?? 'orders',
    resourceType: overrides.resourceType ?? 'model',
    packageName: overrides.packageName ?? 'jaffle_shop',
    path: overrides.path ?? 'models/orders.sql',
    originalFilePath: overrides.originalFilePath ?? 'models/orders.sql',
    description: overrides.description ?? null,
    status: overrides.status ?? 'success',
    statusTone: overrides.statusTone ?? 'positive',
    executionTime: overrides.executionTime ?? 1.2,
    threadId: overrides.threadId ?? 'Thread-1',
    ...overrides,
  };
}

function makeLineageModel() {
  const resource = makeResource();
  return buildLineageGraphModel({
    resource,
    dependencySummary: {
      upstreamCount: 0,
      downstreamCount: 0,
      upstream: [],
      downstream: [],
    },
    dependencyIndex: {},
    resourceById: new Map([[resource.uniqueId, resource]]),
    upstreamDepth: 2,
    downstreamDepth: 2,
    displayMode: 'summary',
  });
}

describe('LineageGraphSurface', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not reset viewport scroll when returning to 100% zoom after panning at non-1 zoom', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const model = makeLineageModel();

    act(() => {
      root.render(
        <LineageGraphSurface
          model={model}
          onSelectResource={vi.fn()}
          activeLegendKeys={new Set()}
          onToggleLegendKey={vi.fn()}
        />,
      );
    });

    const viewport = container.querySelector('.lineage-graph__viewport') as HTMLDivElement;
    expect(viewport).toBeTruthy();

    const plus = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === '+',
    ) as HTMLButtonElement;
    const zoomPct = [...container.querySelectorAll('button')].find((b) =>
      /^\d+%$/.test(b.textContent?.trim() ?? ''),
    ) as HTMLButtonElement;
    expect(plus).toBeTruthy();
    expect(zoomPct).toBeTruthy();

    act(() => {
      plus.click();
      plus.click();
    });

    const targetLeft = 140;
    const targetTop = 95;
    act(() => {
      viewport.scrollLeft = targetLeft;
      viewport.scrollTop = targetTop;
    });

    expect(viewport.scrollLeft).toBe(targetLeft);
    expect(viewport.scrollTop).toBe(targetTop);

    act(() => {
      zoomPct.click();
    });

    expect(viewport.scrollLeft).toBe(targetLeft);
    expect(viewport.scrollTop).toBe(targetTop);
  });
});
