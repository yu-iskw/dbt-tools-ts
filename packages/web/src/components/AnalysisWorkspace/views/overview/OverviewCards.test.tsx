// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewActionListCard, OverviewCriticalPathCard } from './OverviewCards';

import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';
import type { AnalysisState } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function analysisWithPath(path: string[]): AnalysisState {
  return {
    summary: { critical_path: { path, total_time: 12 } },
    graphSummary: { hasCycles: false, totalEdges: 4 },
    resources: path.map((id) => ({ uniqueId: id, name: id.split('.').pop() })),
  } as unknown as AnalysisState;
}

describe('Health cards', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigateTo = vi.fn();

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    onNavigateTo.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    act(() => root.unmount());
    container.remove();
  });

  const buttonNamed = (text: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text);

  it('opens a bottleneck in Timeline when its row is clicked', () => {
    const derived = {
      filteredExecutionTime: 10,
      topBottlenecks: [
        { uniqueId: 'model.pkg.slow', name: 'slow', executionTime: 6 },
        { uniqueId: 'model.pkg.fast', name: 'fast', executionTime: 1 },
      ],
    } as unknown as OverviewDerivedState;
    act(() =>
      root.render(<OverviewActionListCard derived={derived} onNavigateTo={onNavigateTo} />),
    );

    const rows = container.querySelectorAll('button.action-list__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('1. slow');
    act(() => (rows[0] as HTMLButtonElement).click());

    expect(onNavigateTo).toHaveBeenCalledWith('timeline', {
      resourceId: 'model.pkg.slow',
      executionId: 'model.pkg.slow',
    });
  });

  it('says "1 node" for a single-node critical path and lists it as a link', () => {
    act(() =>
      root.render(
        <OverviewCriticalPathCard
          analysis={analysisWithPath(['model.pkg.orders'])}
          filtered={false}
          onNavigateTo={onNavigateTo}
        />,
      ),
    );

    expect(container.textContent).toContain('1 node');
    expect(container.textContent).not.toContain('1 nodes');
    act(() => buttonNamed('orders')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('timeline', {
      resourceId: 'model.pkg.orders',
      executionId: 'model.pkg.orders',
    });
  });

  it('lists the first six path nodes and summarizes the rest', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => `model.pkg.${n}`);
    act(() =>
      root.render(
        <OverviewCriticalPathCard
          analysis={analysisWithPath(ids)}
          filtered={false}
          onNavigateTo={onNavigateTo}
        />,
      ),
    );

    expect(container.textContent).toContain('8 nodes');
    const names = Array.from(container.querySelectorAll('.critical-path-card__node')).map(
      (node) => node.textContent,
    );
    expect(names).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(container.textContent).toContain('+2 more');
  });
});
