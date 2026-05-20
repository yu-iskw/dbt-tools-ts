import { CONTEXT_MENU_OVERLAY_SIZE, positionOverlay } from './lineage-overlay-constants';

import type { LineageGraphNodeLayout } from '@web/lib/analysis-workspace/lineage-model';
import type {
  ReactElement,
  CSSProperties,
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react';

type NodeDragState = {
  nodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  initialDx: number;
  initialDy: number;
  hasMoved: boolean;
} | null;

/** Invisible hit targets over SVG nodes (selection, drag, tooltip, context menu). */
export function LineageGraphInteractiveHotspots({
  visibleNodeLayouts,
  getEffectivePos,
  svgWidth,
  svgHeight,
  nodeWidth,
  nodeHeight,
  zoom,
  nodeOffsets,
  nodeDragRef,
  onSelectResource,
  setHoveredId,
  setTooltipNodeId,
  setContextMenu,
  setNodeOffsets,
}: {
  visibleNodeLayouts: Map<string, LineageGraphNodeLayout>;
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => { x: number; y: number };
  svgWidth: number;
  svgHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  zoom: number;
  nodeOffsets: Map<string, { dx: number; dy: number }>;
  nodeDragRef: MutableRefObject<NodeDragState>;
  onSelectResource: (id: string) => void;
  setHoveredId: (id: string | null) => void;
  setTooltipNodeId: (id: string | null) => void;
  setContextMenu: (value: { x: number; y: number; nodeId: string } | null) => void;
  setNodeOffsets: Dispatch<SetStateAction<Map<string, { dx: number; dy: number }>>>;
}): ReactElement {
  return (
    <div className="dependency-graph__interactive-layer">
      {Array.from(visibleNodeLayouts.values()).map((node) => {
        const { x, y } = getEffectivePos(node.resource.uniqueId, node.x, node.y);
        const hotspotStyle: CSSProperties = {
          left: `${(x / svgWidth) * 100}%`,
          top: `${(y / svgHeight) * 100}%`,
          width: `${(nodeWidth / svgWidth) * 100}%`,
          height: `${(nodeHeight / svgHeight) * 100}%`,
        };
        return (
          <button
            key={node.resource.uniqueId}
            type="button"
            className={`dependency-graph__hotspot dependency-graph__hotspot--${node.side}`}
            style={hotspotStyle}
            onClick={() => {
              if (nodeDragRef.current?.hasMoved) return;
              onSelectResource(node.resource.uniqueId);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              const position = positionOverlay({
                anchorX: event.clientX,
                anchorY: event.clientY,
                width: CONTEXT_MENU_OVERLAY_SIZE.width,
                height: CONTEXT_MENU_OVERLAY_SIZE.height,
              });
              setContextMenu({
                x: position.x,
                y: position.y,
                nodeId: node.resource.uniqueId,
              });
            }}
            onMouseEnter={() => {
              setHoveredId(node.resource.uniqueId);
              setTooltipNodeId(node.resource.uniqueId);
            }}
            onMouseLeave={() => {
              setHoveredId(null);
              setTooltipNodeId(null);
            }}
            title={node.resource.uniqueId}
            onPointerDown={(event) => {
              event.stopPropagation();
              const existing = nodeOffsets.get(node.resource.uniqueId) ?? {
                dx: 0,
                dy: 0,
              };
              nodeDragRef.current = {
                nodeId: node.resource.uniqueId,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                initialDx: existing.dx,
                initialDy: existing.dy,
                hasMoved: false,
              };
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = nodeDragRef.current;
              if (
                !drag ||
                drag.pointerId !== event.pointerId ||
                drag.nodeId !== node.resource.uniqueId
              ) {
                return;
              }
              const rawDx = event.clientX - drag.startClientX;
              const rawDy = event.clientY - drag.startClientY;
              if (Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4) {
                drag.hasMoved = true;
              }
              const dx = drag.initialDx + rawDx / zoom;
              const dy = drag.initialDy + rawDy / zoom;
              setNodeOffsets((prev) => {
                const next = new Map(prev);
                next.set(drag.nodeId, { dx, dy });
                return next;
              });
            }}
            onPointerUp={(event) => {
              if (nodeDragRef.current?.pointerId === event.pointerId) {
                (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                setTimeout(() => {
                  nodeDragRef.current = null;
                }, 0);
              }
            }}
            onPointerCancel={() => {
              nodeDragRef.current = null;
            }}
          />
        );
      })}
    </div>
  );
}
