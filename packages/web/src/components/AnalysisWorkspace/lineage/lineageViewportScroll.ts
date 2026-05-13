/**
 * Scroll coordinates for the lineage viewport. The canvas applies `scale(zoom)` from the top-left;
 * scrollLeft/scrollTop are in the same coordinate space as that scaled canvas.
 *
 * Uses **base layout coordinates** (`layoutX` / `layoutY`) only. Per-node drag offsets (`dx`/`dy` from
 * `nodeOffsets`) are intentionally **not** passed here: callers skip auto-centering while any drag
 * offset is active (`LineageGraphSurface` when `nodeOffsets.size > 0`).
 */
export interface ScrollToCenterSelectedNodeParams {
  layoutX: number;
  layoutY: number;
  nodeWidth: number;
  nodeHeight: number;
  zoom: number;
  viewportClientWidth: number;
  viewportClientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export function getScrollToCenterSelectedNode(params: ScrollToCenterSelectedNodeParams): {
  scrollLeft: number;
  scrollTop: number;
} {
  const {
    layoutX,
    layoutY,
    nodeWidth,
    nodeHeight,
    zoom,
    viewportClientWidth,
    viewportClientHeight,
    scrollWidth,
    scrollHeight,
  } = params;

  if (
    viewportClientWidth <= 0 ||
    viewportClientHeight <= 0 ||
    !Number.isFinite(layoutX) ||
    !Number.isFinite(layoutY) ||
    !Number.isFinite(nodeWidth) ||
    !Number.isFinite(nodeHeight) ||
    !Number.isFinite(zoom)
  ) {
    return { scrollLeft: 0, scrollTop: 0 };
  }

  const centerX = (layoutX + nodeWidth / 2) * zoom;
  const centerY = (layoutY + nodeHeight / 2) * zoom;

  const maxScrollLeft = Math.max(0, scrollWidth - viewportClientWidth);
  const maxScrollTop = Math.max(0, scrollHeight - viewportClientHeight);

  const targetLeft = centerX - viewportClientWidth / 2;
  const targetTop = centerY - viewportClientHeight / 2;

  return {
    scrollLeft: Math.min(maxScrollLeft, Math.max(0, targetLeft)),
    scrollTop: Math.min(maxScrollTop, Math.max(0, targetTop)),
  };
}
