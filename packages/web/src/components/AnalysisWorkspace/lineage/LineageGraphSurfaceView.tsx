import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type {
  LineageDisplayMode,
  LineageGraphModel,
  LineageGraphNodeLayout,
  LensLegendItem,
} from '@web/lib/analysis-workspace/lineageModel';
import type { LensMode } from '@web/lib/analysis-workspace/types';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';
import { formatResourceTypeLabel } from '../shared';
import { LineageGraphInteractiveHotspots } from './LineageGraphInteractiveHotspots';
import { LineageGraphLegendBar } from './LineageGraphLegendBar';
import { LineageGraphSvgBody } from './LineageGraphSvgBody';
import { LineageGraphZoomToolbar } from './LineageGraphZoomToolbar';

type PanDragRef = MutableRefObject<{
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
} | null>;

type NodeDragRef = MutableRefObject<{
  nodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  initialDx: number;
  initialDy: number;
  hasMoved: boolean;
} | null>;

/** Populated lineage graph: legend, zoom, SVG, hotspots, tooltip, context menu. */
export function LineageGraphSurfaceView({
  model,
  displayMode,
  fullscreen,
  lensMode,
  legendItems,
  activeLegendKeys,
  onToggleLegendKey,
  zoom,
  setZoom,
  nodeOffsets,
  setNodeOffsets,
  visibleNodeLayouts,
  visibleEdges,
  highlightedIds,
  hasHoverFocus,
  getEffectivePos,
  svgWidth,
  svgHeight,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  viewportRef,
  panDragRef,
  nodeDragRef,
  onSelectResource,
  setHoveredId,
  setTooltipNodeId,
  setContextMenu,
  setViewportTick,
  tooltipLayout,
  tooltipPosition,
  contextMenu,
}: {
  model: LineageGraphModel;
  displayMode: LineageDisplayMode;
  fullscreen: boolean;
  lensMode: LensMode;
  legendItems: LensLegendItem[];
  activeLegendKeys: Set<string>;
  onToggleLegendKey: (key: string) => void;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  nodeOffsets: Map<string, { dx: number; dy: number }>;
  setNodeOffsets: Dispatch<SetStateAction<Map<string, { dx: number; dy: number }>>>;
  visibleNodeLayouts: LineageGraphModel['nodeLayouts'];
  visibleEdges: LineageGraphModel['graphEdges'];
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => { x: number; y: number };
  svgWidth: number;
  svgHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  panDragRef: PanDragRef;
  nodeDragRef: NodeDragRef;
  onSelectResource: (id: string) => void;
  setHoveredId: (id: string | null) => void;
  setTooltipNodeId: (id: string | null) => void;
  setContextMenu: (value: { x: number; y: number; nodeId: string } | null) => void;
  setViewportTick: Dispatch<SetStateAction<number>>;
  tooltipLayout: LineageGraphNodeLayout | null;
  tooltipPosition: { left: number; top: number } | null;
  contextMenu: { x: number; y: number; nodeId: string } | null;
}) {
  return (
    <div
      className={`dependency-graph dependency-graph--${displayMode}${fullscreen ? ' dependency-graph--fullscreen' : ''}`}
    >
      <LineageGraphLegendBar
        lensMode={lensMode}
        legendItems={legendItems}
        activeLegendKeys={activeLegendKeys}
        onToggleLegendKey={onToggleLegendKey}
      />
      <LineageGraphZoomToolbar
        zoom={zoom}
        setZoom={setZoom}
        nodeOffsetsSize={nodeOffsets.size}
        onResetLayout={() => setNodeOffsets(new Map())}
        visibleNodeCount={visibleNodeLayouts.size}
        upstreamCount={model.upstreamMap.size}
        downstreamCount={model.downstreamMap.size}
      />
      <div
        ref={viewportRef}
        className={`lineage-graph__viewport${fullscreen ? ' lineage-graph__viewport--fullscreen' : ''}`}
        onPointerDown={(event) => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          panDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
          };
          viewport.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = panDragRef.current;
          const viewport = viewportRef.current;
          if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
          viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
          viewport.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
        }}
        onPointerUp={(event) => {
          const viewport = viewportRef.current;
          if (panDragRef.current?.pointerId === event.pointerId && viewport) {
            viewport.releasePointerCapture(event.pointerId);
          }
          panDragRef.current = null;
        }}
        onPointerCancel={() => {
          panDragRef.current = null;
        }}
        onScroll={() => setViewportTick((current) => current + 1)}
      >
        <div
          className="lineage-graph__canvas"
          style={{
            width: `${svgWidth * zoom}px`,
            height: `${svgHeight * zoom}px`,
          }}
        >
          <div
            className="lineage-graph__zoom-layer"
            style={{
              width: `${svgWidth}px`,
              height: `${svgHeight}px`,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              className={`dependency-graph__svg dependency-graph__svg--lens-${lensMode}`}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <LineageGraphSvgBody
                visibleEdges={visibleEdges}
                visibleNodeLayouts={visibleNodeLayouts}
                getEffectivePos={getEffectivePos}
                nodeWidth={nodeWidth}
                nodeHeight={nodeHeight}
                nodeRadius={nodeRadius}
                displayMode={displayMode}
                lensMode={lensMode}
                highlightedIds={highlightedIds}
                hasHoverFocus={hasHoverFocus}
              />
            </svg>
            <LineageGraphInteractiveHotspots
              visibleNodeLayouts={visibleNodeLayouts}
              getEffectivePos={getEffectivePos}
              svgWidth={svgWidth}
              svgHeight={svgHeight}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
              zoom={zoom}
              nodeOffsets={nodeOffsets}
              nodeDragRef={nodeDragRef}
              onSelectResource={onSelectResource}
              setHoveredId={setHoveredId}
              setTooltipNodeId={setTooltipNodeId}
              setContextMenu={setContextMenu}
              setNodeOffsets={setNodeOffsets}
            />
          </div>
          {tooltipLayout && tooltipPosition && (
            <div
              className="graph-node-tooltip"
              style={{
                left: tooltipPosition.left,
                top: tooltipPosition.top,
              }}
              aria-hidden="true"
            >
              <div className="graph-node-tooltip__name">{tooltipLayout.resource.name}</div>
              <div className="graph-node-tooltip__meta">
                {formatResourceTypeLabel(tooltipLayout.resource.resourceType)}
                {tooltipLayout.resource.packageName
                  ? ` · ${tooltipLayout.resource.packageName}`
                  : ''}
              </div>
              {tooltipLayout.resource.status && (
                <div
                  className={`graph-node-tooltip__status graph-node-tooltip__status--${tooltipLayout.resource.statusTone}`}
                >
                  {tooltipLayout.resource.status}
                  {tooltipLayout.resource.executionTime != null
                    ? ` · ${formatSeconds(tooltipLayout.resource.executionTime)}`
                    : ''}
                </div>
              )}
              {tooltipLayout.resource.description && (
                <div className="graph-node-tooltip__description">
                  {tooltipLayout.resource.description}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {contextMenu && (
        <div
          className="graph-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="graph-context-menu__item"
            onClick={() => {
              onSelectResource(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            Focus on this node
          </button>
          {(() => {
            const layout = visibleNodeLayouts.get(contextMenu.nodeId);
            return layout ? (
              <div className="graph-context-menu__label">{layout.resource.name}</div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
