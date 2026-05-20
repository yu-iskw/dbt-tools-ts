// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GanttTooltip, computeTooltipPlacement } from './GanttTooltip';

import type { HoverState } from './hit-test';
import type { ResourceNode } from '@web/types';

function renderTooltip({
  hover,
  frameWidth = 600,
  frameHeight = 320,
  resourceByUniqueId,
}: {
  hover: HoverState;
  frameWidth?: number;
  frameHeight?: number;
  resourceByUniqueId?: ReadonlyMap<string, ResourceNode>;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <GanttTooltip
        hover={hover}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        runStartedAt={null}
        canShowTimestamps={false}
        timeZone="UTC"
        resourceByUniqueId={resourceByUniqueId}
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
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('computeTooltipPlacement', () => {
  it('uses the default right-side placement when there is room', () => {
    expect(
      computeTooltipPlacement({
        hoverX: 100,
        hoverY: 80,
        frameWidth: 600,
        frameHeight: 320,
        tooltipWidth: 200,
        tooltipHeight: 120,
      }),
    ).toEqual({ left: 116, top: 80 });
  });

  it('flips left when the tooltip would overflow the right edge', () => {
    expect(
      computeTooltipPlacement({
        hoverX: 560,
        hoverY: 80,
        frameWidth: 600,
        frameHeight: 320,
        tooltipWidth: 200,
        tooltipHeight: 120,
      }),
    ).toEqual({ left: 344, top: 80 });
  });

  it('shifts upward when the tooltip would overflow the bottom edge', () => {
    expect(
      computeTooltipPlacement({
        hoverX: 180,
        hoverY: 280,
        frameWidth: 600,
        frameHeight: 320,
        tooltipWidth: 200,
        tooltipHeight: 120,
      }),
    ).toEqual({ left: 196, top: 188 });
  });

  it('clamps inside very small frames', () => {
    expect(
      computeTooltipPlacement({
        hoverX: 40,
        hoverY: 40,
        frameWidth: 150,
        frameHeight: 90,
        tooltipWidth: 200,
        tooltipHeight: 120,
      }),
    ).toEqual({ left: 12, top: 12 });
  });
});

describe('GanttTooltip', () => {
  it('renders clamped placement styles for edge hovers', () => {
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
    const { container, root } = renderTooltip({ hover });
    const tooltip = container.querySelector('.chart-tooltip') as HTMLDivElement;

    expect(tooltip.style.left).toBe('344px');
    expect(tooltip.style.top).toBe('188px');

    cleanupRoot(root, container);
  });

  it('shows Adapter response when the resource has normalized adapter metrics', () => {
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
      x: 100,
      y: 80,
    };
    const resource: ResourceNode = {
      uniqueId: 'model.customers',
      name: 'customers',
      resourceType: 'model',
      packageName: 'pkg',
      path: null,
      originalFilePath: null,
      description: null,
      status: 'success',
      statusTone: 'positive',
      executionTime: 1,
      threadId: null,
      adapterMetrics: {
        rawKeys: ['bytes_processed'],
        bytesProcessed: 12_345,
      },
    };
    const resourceByUniqueId = new Map<string, ResourceNode>([['model.customers', resource]]);
    const { container, root } = renderTooltip({ hover, resourceByUniqueId });

    expect(container.textContent).toContain('Adapter response');
    expect(container.textContent).toContain('Bytes processed');
    expect(container.textContent).toContain('12,345');

    cleanupRoot(root, container);
  });

  it('omits Adapter response when the map has no entry for the hovered node', () => {
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
      x: 100,
      y: 80,
    };
    const { container, root } = renderTooltip({ hover });

    expect(container.textContent).not.toContain('Adapter response');

    cleanupRoot(root, container);
  });
});
