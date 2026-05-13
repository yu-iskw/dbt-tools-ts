import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../EmptyState';
import {
  type LineageDisplayMode,
  type LineageGraphModel,
  collectHighlightedGraphIds,
  filterLineageGraphModel,
  getLensLegendItems,
} from '@web/lib/analysis-workspace/lineageModel';
import type { LensMode } from '@web/lib/analysis-workspace/types';
import { getScrollToCenterSelectedNode } from './lineageViewportScroll';
import { LineageGraphSurfaceView } from './LineageGraphSurfaceView';
import { useLineageGraphTooltipPosition } from './useLineageGraphTooltipPosition';

/** Composes legend, viewport controls, SVG graph, hotspots, tooltip, and context menu. */
export function LineageGraphSurface({
  model,
  onSelectResource,
  lensMode = 'type',
  activeLegendKeys,
  onToggleLegendKey,
  fullscreen = false,
  displayMode = 'focused',
}: {
  model: LineageGraphModel;
  onSelectResource: (id: string) => void;
  lensMode?: LensMode;
  activeLegendKeys: Set<string>;
  onToggleLegendKey: (key: string) => void;
  fullscreen?: boolean;
  displayMode?: LineageDisplayMode;
}) {
  const { nodeLayouts, svgHeight, svgWidth, nodeWidth, nodeHeight, nodeRadius } = model;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipNodeId, setTooltipNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportTick, setViewportTick] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [nodeOffsets, setNodeOffsets] = useState<Map<string, { dx: number; dy: number }>>(
    new Map(),
  );
  /** Bumps after model-driven zoom/offset reset (microtask) so centering can run once zoom is 1. */
  const [lineageLayoutEpoch, setLineageLayoutEpoch] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const nodeDragRef = useRef<{
    nodeId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    initialDx: number;
    initialDy: number;
    hasMoved: boolean;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(zoom);
  const selectedResourceId = useMemo(
    () =>
      Array.from(nodeLayouts.values()).find((entry) => entry.side === 'selected')?.resource
        .uniqueId ?? '',
    [nodeLayouts],
  );
  const filteredGraph = useMemo(
    () => filterLineageGraphModel(model, lensMode, activeLegendKeys, selectedResourceId),
    [activeLegendKeys, lensMode, model, selectedResourceId],
  );
  const visibleNodeLayouts = filteredGraph.nodeLayouts;
  const visibleEdges = filteredGraph.graphEdges;

  useEffect(() => {
    queueMicrotask(() => {
      setZoom(1);
      setNodeOffsets(new Map());
      setLineageLayoutEpoch((e) => e + 1);
    });
  }, [model]);

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const pending = pendingScrollRef.current;
    const viewport = viewportRef.current;
    if (pending && viewport) {
      viewport.scrollLeft = pending.x;
      viewport.scrollTop = pending.y;
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  /**
   * Scroll to center the selected node when the graph baseline changes (model, selection, layout, dimensions,
   * or cleared drag offsets). Intentionally omits `zoom` from deps so returning to 100% zoom after panning does
   * not overwrite scrollLeft/scrollTop. Runs after the `[zoom]` layout effect so `zoomRef` matches `zoom` in
   * the same commit.
   */
  useLayoutEffect(() => {
    if (zoomRef.current !== 1 || nodeOffsets.size > 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!selectedResourceId) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      return;
    }
    const layout = visibleNodeLayouts.get(selectedResourceId);
    if (!layout) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      return;
    }
    const { scrollLeft, scrollTop } = getScrollToCenterSelectedNode({
      layoutX: layout.x,
      layoutY: layout.y,
      nodeWidth,
      nodeHeight,
      zoom: 1,
      viewportClientWidth: viewport.clientWidth,
      viewportClientHeight: viewport.clientHeight,
      scrollWidth: viewport.scrollWidth,
      scrollHeight: viewport.scrollHeight,
    });
    viewport.scrollLeft = scrollLeft;
    viewport.scrollTop = scrollTop;
  }, [
    lineageLayoutEpoch,
    model,
    nodeOffsets,
    selectedResourceId,
    visibleNodeLayouts,
    nodeWidth,
    nodeHeight,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = viewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const scrollLeft = viewport.scrollLeft;
        const scrollTop = viewport.scrollTop;
        setZoom((oldZoom) => {
          const newZoom = Math.max(0.4, Math.min(2.5, oldZoom * (1 - e.deltaY * 0.003)));
          pendingScrollRef.current = {
            x: ((scrollLeft + cursorX) / oldZoom) * newZoom - cursorX,
            y: ((scrollTop + cursorY) / oldZoom) * newZoom - cursorY,
          };
          return newZoom;
        });
      } else {
        viewport.scrollLeft += e.deltaX;
        viewport.scrollTop += e.deltaY;
      }
    };
    viewport.addEventListener('wheel', handler, { passive: false });
    return () => viewport.removeEventListener('wheel', handler);
  }, []);

  const getEffectivePos = useCallback(
    (nodeId: string, baseX: number, baseY: number) => {
      const off = nodeOffsets.get(nodeId);
      return { x: baseX + (off?.dx ?? 0), y: baseY + (off?.dy ?? 0) };
    },
    [nodeOffsets],
  );

  const resolvedTooltipNodeId =
    tooltipNodeId !== null && visibleNodeLayouts.has(tooltipNodeId) ? tooltipNodeId : null;
  const tooltipLayout = resolvedTooltipNodeId
    ? (visibleNodeLayouts.get(resolvedTooltipNodeId) ?? null)
    : null;

  useLineageGraphTooltipPosition(
    tooltipLayout,
    zoom,
    nodeWidth,
    nodeHeight,
    viewportTick,
    getEffectivePos,
    viewportRef,
    setTooltipPosition,
  );

  if (visibleNodeLayouts.size === 0) {
    return (
      <div
        className={`dependency-graph dependency-graph--empty dependency-graph--${displayMode}${fullscreen ? ' dependency-graph--fullscreen' : ''}`}
      >
        <EmptyState
          icon="↔"
          headline="No lineage available"
          subtext="This resource could not be placed on the lineage canvas."
        />
      </div>
    );
  }

  const legendItems = getLensLegendItems(lensMode, nodeLayouts);
  const highlightedIds = collectHighlightedGraphIds(hoveredId, visibleEdges);
  const hasHoverFocus = highlightedIds.size > 0;

  return (
    <LineageGraphSurfaceView
      model={model}
      displayMode={displayMode}
      fullscreen={fullscreen}
      lensMode={lensMode}
      legendItems={legendItems}
      activeLegendKeys={activeLegendKeys}
      onToggleLegendKey={onToggleLegendKey}
      zoom={zoom}
      setZoom={setZoom}
      nodeOffsets={nodeOffsets}
      setNodeOffsets={setNodeOffsets}
      visibleNodeLayouts={visibleNodeLayouts}
      visibleEdges={visibleEdges}
      highlightedIds={highlightedIds}
      hasHoverFocus={hasHoverFocus}
      getEffectivePos={getEffectivePos}
      svgWidth={svgWidth}
      svgHeight={svgHeight}
      nodeWidth={nodeWidth}
      nodeHeight={nodeHeight}
      nodeRadius={nodeRadius}
      viewportRef={viewportRef}
      panDragRef={panDragRef}
      nodeDragRef={nodeDragRef}
      onSelectResource={onSelectResource}
      setHoveredId={setHoveredId}
      setTooltipNodeId={setTooltipNodeId}
      setContextMenu={setContextMenu}
      setViewportTick={setViewportTick}
      tooltipLayout={tooltipLayout}
      tooltipPosition={tooltipPosition}
      contextMenu={contextMenu}
    />
  );
}
