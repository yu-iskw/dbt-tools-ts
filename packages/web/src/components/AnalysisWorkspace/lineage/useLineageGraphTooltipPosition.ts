import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useLayoutEffect } from 'react';
import type { LineageGraphNodeLayout } from '@web/lib/analysis-workspace/lineageModel';
import {
  OVERLAY_VIEWPORT_MARGIN,
  TOOLTIP_NODE_PADDING,
  TOOLTIP_OVERLAY_SIZE,
} from './lineageOverlayConstants';

/** Positions the floating node tooltip inside the scrollable viewport. */
export function useLineageGraphTooltipPosition(
  tooltipLayout: LineageGraphNodeLayout | null,
  zoom: number,
  nodeWidth: number,
  nodeHeight: number,
  viewportTick: number,
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => { x: number; y: number },
  viewportRef: RefObject<HTMLDivElement | null>,
  setTooltipPosition: Dispatch<SetStateAction<{ left: number; top: number } | null>>,
): void {
  useLayoutEffect(() => {
    if (!tooltipLayout) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const { x, y } = getEffectivePos(
      tooltipLayout.resource.uniqueId,
      tooltipLayout.x,
      tooltipLayout.y,
    );
    const scaledX = x * zoom;
    const scaledY = y * zoom;
    const nodeWidthScaled = nodeWidth * zoom;
    const nodeHeightScaled = nodeHeight * zoom;

    let left = scaledX + nodeWidthScaled - TOOLTIP_OVERLAY_SIZE.width - TOOLTIP_NODE_PADDING.x;
    let top = scaledY + TOOLTIP_NODE_PADDING.y;

    if (left < viewport.scrollLeft + OVERLAY_VIEWPORT_MARGIN) {
      left = scaledX + TOOLTIP_NODE_PADDING.x;
    }
    if (top + TOOLTIP_OVERLAY_SIZE.height > viewport.scrollTop + viewport.clientHeight) {
      top = scaledY + nodeHeightScaled - TOOLTIP_OVERLAY_SIZE.height - TOOLTIP_NODE_PADDING.y;
    }

    left = Math.min(
      Math.max(viewport.scrollLeft + OVERLAY_VIEWPORT_MARGIN, left),
      Math.max(
        viewport.scrollLeft + OVERLAY_VIEWPORT_MARGIN,
        viewport.scrollLeft +
          viewport.clientWidth -
          TOOLTIP_OVERLAY_SIZE.width -
          OVERLAY_VIEWPORT_MARGIN,
      ),
    );
    top = Math.min(
      Math.max(viewport.scrollTop + OVERLAY_VIEWPORT_MARGIN, top),
      Math.max(
        viewport.scrollTop + OVERLAY_VIEWPORT_MARGIN,
        viewport.scrollTop +
          viewport.clientHeight -
          TOOLTIP_OVERLAY_SIZE.height -
          OVERLAY_VIEWPORT_MARGIN,
      ),
    );

    setTooltipPosition({ left, top });
  }, [
    tooltipLayout,
    zoom,
    nodeWidth,
    nodeHeight,
    viewportTick,
    getEffectivePos,
    viewportRef,
    setTooltipPosition,
  ]);
}
