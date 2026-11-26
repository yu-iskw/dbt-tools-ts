import type { ReactElement } from 'react';

export interface LineageGroupLegend {
  crossingCounts: { inner: number; outer: number };
  crossingsOnly: boolean;
  onToggleCrossingsOnly: () => void;
}

/** Crossing tier legend, total crossing count, and the "Crossings only" chip (grouped mode). */
export function LineageGroupLegendItems({
  crossingCounts,
  crossingsOnly,
  onToggleCrossingsOnly,
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
    </>
  );
}
