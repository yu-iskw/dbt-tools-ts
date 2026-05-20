import { PILL_BASE } from '@web/lib/analysis-workspace/constants';

import type { ReactElement, Dispatch, SetStateAction } from 'react';

/** Zoom / layout reset + node counts (presentation layer for lineage graph). */
export function LineageGraphZoomToolbar({
  zoom,
  setZoom,
  nodeOffsetsSize,
  onResetLayout,
  visibleNodeCount,
  upstreamCount,
  downstreamCount,
}: {
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  nodeOffsetsSize: number;
  onResetLayout: () => void;
  visibleNodeCount: number;
  upstreamCount: number;
  downstreamCount: number;
}): ReactElement {
  return (
    <div className="lineage-graph__viewport-toolbar">
      <div className="lineage-graph__zoom-controls">
        <button
          type="button"
          className={PILL_BASE}
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
        >
          −
        </button>
        <button type="button" className={PILL_BASE} onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className={PILL_BASE}
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
        >
          +
        </button>
        {nodeOffsetsSize > 0 && (
          <button type="button" className={PILL_BASE} onClick={onResetLayout}>
            Reset layout
          </button>
        )}
      </div>
      <p className="lineage-graph__summary">
        {visibleNodeCount} nodes · {upstreamCount} upstream · {downstreamCount} downstream
      </p>
    </div>
  );
}
