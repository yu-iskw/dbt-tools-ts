// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BundleRow } from '@web/lib/analysis-workspace/bundleLayout';
import type { TimeWindow } from '@web/lib/analysis-workspace/types';
import type { GanttItem, ResourceTestStats } from '@web/types';
import { GanttTimeBrush, hasIssueSignal } from './GanttTimeBrush';

function parent(id: string, overrides: Partial<GanttItem> = {}): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 0,
    end: 1_000,
    duration: 1_000,
    status: 'success',
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    parentId: null,
    ...overrides,
  };
}

function testItem(id: string, parentId: string, overrides: Partial<GanttItem> = {}): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 100,
    end: 200,
    duration: 100,
    status: 'pass',
    resourceType: 'test',
    packageName: 'pkg',
    path: null,
    parentId,
    ...overrides,
  };
}

function bundle(item: GanttItem, tests: GanttItem[] = []): BundleRow {
  return {
    item,
    tests,
    lanes: tests.map((test, index) => ({ item: test, lane: index })),
    laneCount: tests.length,
  };
}

function pointer(type: string, clientX: number, pointerId = 1) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    pointerId,
  });
}

function setBrushGeometry(element: HTMLElement, left = 100, width = 1_000) {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: width,
  });
  element.getBoundingClientRect = () =>
    ({
      width,
      height: 42,
      top: 0,
      left,
      right: left + width,
      bottom: 42,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

function renderBrush({
  bundles,
  initialTimeWindow = null,
  maxEnd = 10_000,
  testStatsById,
}: {
  bundles: BundleRow[];
  initialTimeWindow?: TimeWindow | null;
  maxEnd?: number;
  testStatsById?: Map<string, ResourceTestStats>;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();

  function Harness() {
    const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(initialTimeWindow);

    return (
      <GanttTimeBrush
        bundles={bundles}
        maxEnd={maxEnd}
        timeWindow={timeWindow}
        testStatsById={testStatsById}
        onChange={(next) => {
          onChange(next);
          setTimeWindow(next);
        }}
      />
    );
  }

  act(() => {
    root.render(<Harness />);
  });

  return { container, root, onChange };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);

  const captured = new WeakMap<object, Set<number>>();
  HTMLElement.prototype.setPointerCapture = function setPointerCapture(pointerId: number) {
    const current = captured.get(this) ?? new Set<number>();
    current.add(pointerId);
    captured.set(this, current);
  };
  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(pointerId: number) {
    captured.get(this)?.delete(pointerId);
  };
  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(pointerId: number) {
    return captured.get(this)?.has(pointerId) ?? false;
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('hasIssueSignal', () => {
  it('flags failed parents and tests but not skipped statuses', () => {
    expect(hasIssueSignal(bundle(parent('error', { status: 'error' })))).toBe(true);
    expect(hasIssueSignal(bundle(parent('ok'), [testItem('t1', 'ok', { status: 'fail' })]))).toBe(
      true,
    );
    expect(hasIssueSignal(bundle(parent('skip', { status: 'skipped' })))).toBe(false);
  });
});

describe('GanttTimeBrush', () => {
  it('renders a default full-width selection when no zoom window is active', () => {
    const { container, root } = renderBrush({
      bundles: [bundle(parent('a', { end: 4_000, duration: 4_000 }))],
    });
    const selection = container.querySelector('.gantt-brush__selection') as HTMLDivElement;

    expect(selection).not.toBeNull();
    expect(selection.dataset.defaultRange).toBe('true');
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(true);

    cleanupRoot(root, container);
  });

  it('creates a global time window from a background drag', () => {
    const { container, root, onChange } = renderBrush({
      bundles: [bundle(parent('a', { end: 8_000, duration: 8_000 }))],
    });
    const brush = container.querySelector('.gantt-brush') as HTMLDivElement;
    setBrushGeometry(brush);

    act(() => {
      brush.dispatchEvent(pointer('pointerdown', 200));
      brush.dispatchEvent(pointer('pointermove', 500));
      brush.dispatchEvent(pointer('pointerup', 500));
    });

    expect(onChange).toHaveBeenLastCalledWith({ start: 1_000, end: 4_000 });
    expect(
      (container.querySelector('.gantt-brush__selection') as HTMLDivElement).dataset.defaultRange,
    ).toBe('false');

    cleanupRoot(root, container);
  });

  it('pans and resizes the active zoom window', () => {
    const { container, root, onChange } = renderBrush({
      bundles: [bundle(parent('a', { end: 8_000, duration: 8_000 }))],
      initialTimeWindow: { start: 1_000, end: 4_000 },
    });
    const brush = container.querySelector('.gantt-brush') as HTMLDivElement;
    setBrushGeometry(brush);

    const selection = container.querySelector('.gantt-brush__selection') as HTMLDivElement;

    act(() => {
      selection.dispatchEvent(pointer('pointerdown', 300));
      brush.dispatchEvent(pointer('pointermove', 500));
      brush.dispatchEvent(pointer('pointerup', 500));
    });

    expect(onChange).toHaveBeenLastCalledWith({ start: 3_000, end: 6_000 });

    const startHandle = container.querySelector('.gantt-brush__handle--start') as HTMLSpanElement;
    act(() => {
      startHandle.dispatchEvent(pointer('pointerdown', 400, 2));
      brush.dispatchEvent(pointer('pointermove', 500, 2));
      brush.dispatchEvent(pointer('pointerup', 500, 2));
    });

    expect(onChange).toHaveBeenLastCalledWith({ start: 4_000, end: 6_000 });

    cleanupRoot(root, container);
  });

  it('clears zoom from the reset control and marks issue bars', () => {
    const bundles = [
      bundle(parent('healthy', { end: 2_000, duration: 2_000 })),
      bundle(parent('issue', { start: 2_500, end: 6_000, duration: 3_500 })),
    ];
    const testStatsById = new Map<string, ResourceTestStats>([
      ['issue', { pass: 1, fail: 0, error: 1, warn: 0, skipped: 0, notExecuted: 0 }],
    ]);
    const { container, root, onChange } = renderBrush({
      bundles,
      initialTimeWindow: { start: 1_000, end: 5_000 },
      testStatsById,
    });

    expect(container.querySelectorAll('[data-issue="true"]')).toHaveLength(1);

    act(() => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(
      (container.querySelector('.gantt-brush__selection') as HTMLDivElement).dataset.defaultRange,
    ).toBe('true');
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(true);

    cleanupRoot(root, container);
  });
});
