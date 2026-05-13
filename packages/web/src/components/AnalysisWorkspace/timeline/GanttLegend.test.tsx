// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GanttLegend } from './GanttLegend';

vi.mock('@web/hooks/useTheme', () => ({
  useSyncedDocumentTheme: () => 'light',
}));

function renderLegend(
  props: Omit<ComponentProps<typeof GanttLegend>, 'statusCounts' | 'typeCounts'> & {
    statusCounts?: Record<string, number>;
    typeCounts?: Record<string, number>;
  },
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <GanttLegend
        statusCounts={props.statusCounts ?? {}}
        typeCounts={props.typeCounts ?? {}}
        showBarEncodingKey={props.showBarEncodingKey ?? false}
        {...props}
      />,
    );
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
  document.body.replaceChildren();
});

describe('GanttLegend', () => {
  it('lists primary types with zero counts when absent from typeCounts', () => {
    const { container, root } = renderLegend({
      typeCounts: { model: 5 },
      showBarEncodingKey: false,
    });

    const typeGroup = container.querySelector('.gantt-legend__group');
    expect(typeGroup).not.toBeNull();

    const items = container.querySelectorAll('.gantt-legend__item');
    const sourceItem = [...items].find((el) => el.textContent?.includes('source'));
    const seedItem = [...items].find((el) => el.textContent?.includes('seed'));
    expect(sourceItem?.textContent).toMatch(/0/);
    expect(seedItem?.textContent).toMatch(/0/);

    cleanupRoot(root, container);
  });

  it('calls onToggleType when a zero-count primary type chip is clicked', () => {
    const onToggleType = vi.fn();
    const { container, root } = renderLegend({
      typeCounts: { model: 1 },
      showBarEncodingKey: false,
      activeTypes: new Set(['model']),
      onToggleType,
    });

    const sourceButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('source'),
    );
    expect(sourceButton).toBeDefined();
    act(() => {
      sourceButton!.click();
    });
    expect(onToggleType).toHaveBeenCalledWith('source');

    cleanupRoot(root, container);
  });

  it('renders Tests chip in the type group with testsLegendCount', () => {
    const onToggleShowTests = vi.fn();
    const { container, root } = renderLegend({
      typeCounts: { model: 1 },
      testsLegendCount: 3,
      showBarEncodingKey: false,
      onToggleShowTests,
    });

    const typeLabel = [...container.querySelectorAll('.gantt-legend__label')].find(
      (el) => el.textContent === 'Type',
    );
    expect(typeLabel).toBeDefined();
    const typeGroup = typeLabel?.closest('.gantt-legend__group');
    expect(typeGroup?.textContent).toMatch(/tests/i);
    expect(typeGroup?.textContent).toMatch(/3/);

    cleanupRoot(root, container);
  });

  it('renders materialization read-only row when counts provided', () => {
    const { container, root } = renderLegend({
      statusCounts: {},
      typeCounts: { model: 1 },
      materializationCounts: { view: 2, incremental: 1 },
      showBarEncodingKey: false,
      onToggleType: vi.fn(),
    });

    expect(container.textContent).toMatch(/Materialization/i);
    expect(container.textContent).toMatch(/View/);
    expect(container.textContent).toMatch(/Incr/);

    cleanupRoot(root, container);
  });

  it('renders Failures only in the status group after status chips', () => {
    const onToggleFailuresOnly = vi.fn();
    const { container, root } = renderLegend({
      statusCounts: { success: 4 },
      typeCounts: {},
      showBarEncodingKey: false,
      onToggleFailuresOnly,
    });

    const statusGroup = [...container.querySelectorAll('.gantt-legend__group')].find(
      (g) => g.querySelector('.gantt-legend__label')?.textContent === 'Status',
    );
    expect(statusGroup?.textContent).toMatch(/success/i);
    expect(statusGroup?.textContent).toMatch(/failures only/i);

    cleanupRoot(root, container);
  });
});
