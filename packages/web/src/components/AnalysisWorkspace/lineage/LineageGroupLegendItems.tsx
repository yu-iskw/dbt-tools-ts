import type { ReactElement } from 'react';

export interface LineageCollapseLegend {
  collapsedCount: number;
  /** Containers that can collapse (all but the selected node's). */
  toggleableCount: number;
  bundledEdgeCount: number;
  onCollapseOthers: () => void;
  onExpandAll: () => void;
}

export interface LineageGroupLegend {
  crossingCounts: { inner: number; outer: number };
  crossingsOnly: boolean;
  onToggleCrossingsOnly: () => void;
  collapse: LineageCollapseLegend;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `4 groups collapsed, 96 edges bundled`, or `All groups expanded`. */
export function collapseStatus({
  collapsedCount,
  bundledEdgeCount,
}: LineageCollapseLegend): string {
  if (collapsedCount === 0) return 'All groups expanded';
  return `${plural(collapsedCount, 'group', 'groups')} collapsed, ${plural(bundledEdgeCount, 'edge', 'edges')} bundled`;
}

/**
 * Crossing tier legend, total crossing count (always real edges, never bundles), the
 * "Crossings only" chip, and collapse controls (grouped mode).
 */
export function LineageGroupLegendItems({
  crossingCounts,
  crossingsOnly,
  onToggleCrossingsOnly,
  collapse,
}: LineageGroupLegend): ReactElement {
  const total = crossingCounts.inner + crossingCounts.outer;
  return (
    <>
      <span className="lineage-legend__crossing">
        <span className="lineage-legend__swatch lineage-legend__swatch--cross-inner" />
        Crosses dataset/schema boundary ({crossingCounts.inner})
      </span>
      <span className="lineage-legend__crossing">
        <span className="lineage-legend__swatch lineage-legend__swatch--cross-outer" />
        Crosses project/database boundary ({crossingCounts.outer})
      </span>
      <span className="lineage-legend__count">
        {total} {total === 1 ? 'crossing' : 'crossings'}
      </span>
      <button
        type="button"
        aria-pressed={crossingsOnly}
        className={`lineage-legend__chip${crossingsOnly ? ' lineage-legend__chip--active' : ''}`}
        onClick={onToggleCrossingsOnly}
      >
        Crossings only
      </button>
      <button
        type="button"
        className="lineage-legend__chip"
        disabled={collapse.collapsedCount >= collapse.toggleableCount}
        onClick={collapse.onCollapseOthers}
      >
        Collapse others
      </button>
      <button
        type="button"
        className="lineage-legend__chip"
        disabled={collapse.collapsedCount === 0}
        onClick={collapse.onExpandAll}
      >
        Expand all
      </button>
      <span className="lineage-legend__count lineage-legend__collapse-status" aria-live="polite">
        {collapseStatus(collapse)}
      </span>
    </>
  );
}
