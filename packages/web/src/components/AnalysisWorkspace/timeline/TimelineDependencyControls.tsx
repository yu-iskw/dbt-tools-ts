import { TIMELINE_EXTENDED_MAX_HOPS } from './gantt/constants';
import { clampTimelineDependencyDepth } from './gantt/dependency-controls';

import type {
  TimelineDependencyDirection,
  TimelineFilterState,
} from '@web/lib/analysis-workspace/types';
import type { ReactElement, Dispatch, SetStateAction } from 'react';

const DIRECTION_OPTIONS: Array<{
  value: TimelineDependencyDirection;
  label: string;
  glyph: string;
}> = [
  { value: 'upstream', label: 'Upstream', glyph: '←' },
  { value: 'both', label: 'Both', glyph: '⇄' },
  { value: 'downstream', label: 'Downstream', glyph: '→' },
];

export function TimelineDependencyControls({
  filters,
  setFilters,
}: {
  filters: TimelineFilterState;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
}): ReactElement {
  const depth = clampTimelineDependencyDepth(filters.dependencyDepthHops);

  const setDepth = (nextDepth: number) =>
    setFilters((current) => ({
      ...current,
      dependencyDepthHops: clampTimelineDependencyDepth(nextDepth),
    }));

  return (
    <div
      className="timeline-dependency-controls gantt-legend"
      aria-label="Dependency visualization controls"
    >
      <div className="timeline-dependency-controls__top-row">
        <div className="timeline-dependency-controls__zone">
          <span className="gantt-legend__label">Depth</span>
          <div
            className="timeline-dependency-controls__stepper"
            role="group"
            aria-label="Dependency depth"
          >
            <button
              type="button"
              className="workspace-pill"
              onClick={() => setDepth(depth - 1)}
              disabled={depth <= 1}
              aria-label="Decrease dependency depth"
            >
              -
            </button>
            <span className="timeline-dependency-controls__depth-value">{depth}</span>
            <button
              type="button"
              className="workspace-pill"
              onClick={() => setDepth(depth + 1)}
              disabled={depth >= TIMELINE_EXTENDED_MAX_HOPS}
              aria-label="Increase dependency depth"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="workspace-pill timeline-dependency-controls__max-button"
            onClick={() => setDepth(TIMELINE_EXTENDED_MAX_HOPS)}
          >
            Max
          </button>
        </div>
        <div className="timeline-dependency-controls__divider" aria-hidden="true" />
        <div className="timeline-dependency-controls__zone timeline-dependency-controls__zone--direction">
          <span className="gantt-legend__label">Direction</span>
          <div
            className="workspace-segmented-control"
            role="tablist"
            aria-label="Dependency direction"
          >
            {DIRECTION_OPTIONS.map((option) => {
              const active = filters.dependencyDirection === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active
                      ? 'workspace-segmented-control__button workspace-segmented-control__button--active'
                      : 'workspace-segmented-control__button'
                  }
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      dependencyDirection: option.value,
                    }))
                  }
                >
                  <span aria-hidden="true">{option.glyph}</span> {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
