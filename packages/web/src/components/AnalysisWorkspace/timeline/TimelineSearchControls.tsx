import { PILL_BASE } from '@web/lib/analysis-workspace/constants';
import { type Dispatch, type ReactElement, type SetStateAction } from 'react';

import type { TimelineFilterState } from '@web/lib/analysis-workspace/types';

export type TimelineTypeFilterHint = {
  shown: string[];
  hidden: Array<{ type: string; count: number }>;
};

export type TimelineSearchControlsProps = {
  filters: TimelineFilterState;
  hasActiveFilters: boolean;
  typeFilterHint: TimelineTypeFilterHint | null;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
};

export function TimelineSearchControls({
  filters,
  hasActiveFilters,
  typeFilterHint,
  setFilters,
}: TimelineSearchControlsProps): ReactElement {
  return (
    <div className="timeline-toolbar">
      <label className="workspace-search workspace-search--compact timeline-toolbar__search">
        <span>Search nodes</span>
        <div className="workspace-search__input-row">
          <input
            value={filters.query}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
            placeholder="Filter by name or id…"
            aria-label="Search timeline nodes"
          />
          {filters.query && (
            <button
              type="button"
              className="workspace-search__clear"
              aria-label="Clear search"
              onClick={() => setFilters((current) => ({ ...current, query: '' }))}
            >
              ✕
            </button>
          )}
        </div>
      </label>

      {(typeFilterHint != null || hasActiveFilters) && (
        <div className="timeline-toolbar__actions">
          {typeFilterHint != null && (
            <p className="timeline-toolbar__hint" role="status">
              {typeFilterHint.shown.length > 0
                ? `Showing types: ${typeFilterHint.shown.join(', ')}. `
                : ''}
              Hidden by type filter:{' '}
              {typeFilterHint.hidden.map(({ type, count }) => `${type} (${count})`).join(', ')}.
            </p>
          )}
          <button
            type="button"
            className={PILL_BASE}
            onClick={() => {
              setFilters((current) => ({
                ...current,
                query: '',
                activeStatuses: new Set(),
                activeTypes: new Set(),
                selectedExecutionId: null,
                dependencyDirection: 'both',
                dependencyDepthHops: 2,
                neighborhoodRowsShowAll: false,
              }));
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
