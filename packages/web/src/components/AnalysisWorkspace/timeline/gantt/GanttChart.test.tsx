// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GanttChart } from './GanttChart';

import type { GanttItem } from '@web/types';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    scrollOffset: 0,
    measure: () => {},
    getTotalSize: () => 180,
  }),
}));

vi.mock('@web/hooks/use-theme', () => ({
  useSyncedDocumentTheme: () => 'light',
}));

vi.mock('./use-gantt-canvas-draw', () => ({
  useGanttCanvasDraw: () => {},
}));

vi.mock('./use-gantt-focus-edges', () => ({
  useGanttFocusEdges: () => ({
    edges: [],
  }),
}));

vi.mock('./GanttModeToggle', () => ({
  GanttModeToggle: () => <div data-testid="mode-toggle" />,
}));

vi.mock('./GanttTimeBrush', () => ({
  GanttTimeBrush: () => <div data-testid="time-brush" />,
}));

vi.mock('./GanttChartFrame', () => ({
  GanttChartFrame: ({ bundles }: { bundles: Array<{ item: { unique_id: string } }> }) => (
    <div data-testid="chart-frame">{bundles.map((bundle) => bundle.item.unique_id).join(',')}</div>
  ),
}));

function item(id: string, start: number, end: number): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: 'success',
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    parentId: null,
  };
}

function renderChart(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GanttChart', () => {
  it('renders a single merged time brush', () => {
    const { container, root } = renderChart(<GanttChart data={[item('a', 0, 1_000)]} />);

    expect(container.querySelectorAll('[data-testid="time-brush"]')).toHaveLength(1);

    cleanupRoot(root, container);
  });

  it('filters frame bundles to the active time window', () => {
    const { container, root } = renderChart(
      <GanttChart
        data={[item('a', 0, 1_000), item('b', 2_000, 3_000), item('c', 4_500, 5_500)]}
        timeWindow={{ start: 1_500, end: 4_000 }}
      />,
    );

    expect(container.querySelector('[data-testid="chart-frame"]')?.textContent).toBe('b');

    cleanupRoot(root, container);
  });
});
