import type { LensLegendItem } from '@web/lib/analysis-workspace/lineageModel';
import type { LensMode } from '@web/lib/analysis-workspace/types';

/** Lens legend + clear control (presentation layer for lineage graph). */
export function LineageGraphLegendBar({
  lensMode,
  legendItems,
  activeLegendKeys,
  onToggleLegendKey,
}: {
  lensMode: LensMode;
  legendItems: LensLegendItem[];
  activeLegendKeys: Set<string>;
  onToggleLegendKey: (key: string) => void;
}) {
  return (
    <div className="lineage-legend">
      <span className="lineage-legend__mode-label">
        {lensMode === 'status' ? 'By status' : lensMode === 'type' ? 'By type' : 'By coverage'}
      </span>
      {legendItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`lineage-legend__item${activeLegendKeys.size === 0 || activeLegendKeys.has(item.key) ? ' lineage-legend__item--active' : ' lineage-legend__item--inactive'}`}
          onClick={() => onToggleLegendKey(item.key)}
        >
          <span
            className="lineage-legend__swatch"
            style={{
              background: item.color,
              borderColor: item.borderColor,
            }}
          />
          {item.label}
        </button>
      ))}
      {activeLegendKeys.size > 0 && (
        <button
          type="button"
          className="lineage-legend__clear"
          onClick={() =>
            activeLegendKeys.forEach((key) => {
              onToggleLegendKey(key);
            })
          }
        >
          Clear
        </button>
      )}
    </div>
  );
}
