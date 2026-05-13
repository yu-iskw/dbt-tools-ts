// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceTestStats } from '@web/types';
import { GanttChartFrame } from './GanttChartFrame';
import type { HoverState } from './hitTest';

vi.mock('./GanttEdgeLayer', () => ({
  GanttEdgeLayer: () => null,
}));

function renderFrame(hover: HoverState | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const scrollRef = { current: document.createElement('div') };
  const canvasRef = { current: document.createElement('canvas') };

  act(() => {
    root.render(
      <GanttChartFrame
        canvasRef={canvasRef}
        scrollRef={scrollRef}
        edges={[]}
        edgeFocusId={null}
        itemById={new Map()}
        bundleIndexById={new Map()}
        bundles={[]}
        rowOffsets={[]}
        containerWidth={600}
        effectiveLabelW={120}
        rangeStart={0}
        rangeEnd={20_000}
        scrollTop={0}
        viewportH={320}
        needsScroll={false}
        totalScrollH={320}
        theme="light"
        showTests={false}
        hover={hover}
        runStartedAt={null}
        canShowTimestamps={false}
        timeZone="UTC"
        testStatsById={new Map<string, ResourceTestStats>()}
        selectedId={null}
        onPointer={() => {}}
        onHoverClear={() => {}}
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

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return this.classList.contains('chart-tooltip') ? 200 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return this.classList.contains('chart-tooltip') ? 120 : 0;
    },
  });

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 600,
      height: 320,
      top: 0,
      left: 0,
      right: 600,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('GanttChartFrame', () => {
  it('keeps the hover tooltip inside the frame near the bottom-right edge', () => {
    const hover: HoverState = {
      item: {
        unique_id: 'model.customers',
        name: 'customers',
        start: 16_000,
        end: 17_000,
        duration: 1_000,
        status: 'success',
        resourceType: 'model',
        packageName: 'pkg',
        path: null,
        parentId: null,
      },
      x: 560,
      y: 280,
    };
    const { container, root } = renderFrame(hover);
    const tooltip = container.querySelector('.chart-tooltip') as HTMLDivElement;

    expect(tooltip.style.left).toBe('344px');
    expect(tooltip.style.top).toBe('188px');

    cleanupRoot(root, container);
  });
});
